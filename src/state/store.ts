import { type StoreApi, createStore } from "zustand/vanilla";
import { applyEvent, createInitialState } from "@/domain/reducer";
import { DEFAULT_SEED, Simulator } from "@/domain/simulator";
import { AGENT_EVENT, type AgentEventSource, type AgentMessageEvent, type ConnectionStatus, SimulatedAgentSource, parseAgentEvent } from "@/domain/source";
import type { AgentEvent, ControlState, OperatorCommand } from "@/domain/types";

interface Toast {
    id: string;
    title: string;
    body: string;
}

interface SimStatus {
    running: boolean;
    speed: number;
    seed: string;
    tick: number;
}

export interface AppState {
    control: ControlState;
    /** True once the first event has arrived. */
    connected: boolean;
    connection: ConnectionStatus;
    /** Wall clock time of the last event from a real source. */
    lastEventAt: number | null;
    /** Wall clock time of the last heartbeat and the gap before it, which is how long one heartbeat interval is. */
    heartbeat: { at: number | null; gapMs: number };
    sim: SimStatus | null;
    toasts: Toast[];
    announcement: string;
    send: (command: OperatorCommand, signal?: AbortSignal) => Promise<void>;
    play: () => void;
    pause: () => void;
    step: () => void;
    reset: (seed: string) => void;
    setSpeed: (speed: number) => void;
    dismissToast: (id: string) => void;
}

export type AppStore = StoreApi<AppState>;

interface CreateAppStoreOptions {
    seed?: string;
    warmup?: number;
    autoStart?: boolean;
    /** Supply a real backend instead of the simulator. */
    source?: AgentEventSource;
}

const MAX_TOASTS = 3;
/** Heartbeat spacing assumed until two heartbeats have shown the real one. */
const DEFAULT_HEARTBEAT_GAP_MS = 15_000;

const describeEvent = (event: AgentEvent, state: ControlState): string | null => {
    const ticket = event.jobId ? (state.jobs[event.jobId]?.ticket.id ?? event.jobId) : "";
    switch (event.type) {
        case "approval.requested":
            return `Approval requested on ${ticket}`;
        case "guard.blocked":
            return `Guard blocked ${event.payload.action.replace("-", " ")} on ${ticket}`;
        case "job.held":
            return `${ticket} on hold: ${event.payload.reason}`;
        case "job.failed":
            return `${ticket} failed: ${event.payload.reason}`;
        case "job.done":
            return `${ticket} merged and done`;
        default:
            return null;
    }
};

export const createAppStore = (options: CreateAppStoreOptions = {}): AppStore => {
    const simulator = options.source ? null : new Simulator({ seed: options.seed ?? DEFAULT_SEED, warmup: options.warmup ?? 0 });
    const source = options.source ?? new SimulatedAgentSource(simulator ?? new Simulator());

    const simStatus = (): SimStatus | null =>
        simulator ? { running: simulator.running, speed: simulator.speed, seed: simulator.seed, tick: simulator.tick } : null;

    const store = createStore<AppState>()((set, get) => ({
        control: createInitialState(),
        connected: false,
        connection: "connecting",
        lastEventAt: null,
        heartbeat: { at: null, gapMs: DEFAULT_HEARTBEAT_GAP_MS },
        sim: simStatus(),
        toasts: [],
        announcement: "",
        send: (command, signal) => source.send(command, signal),
        play: () => {
            simulator?.start();
            set({ sim: simStatus() });
        },
        pause: () => {
            simulator?.pause();
            set({ sim: simStatus() });
        },
        step: () => {
            simulator?.step();
            set({ sim: simStatus() });
        },
        reset: (seed) => {
            simulator?.reset(seed.trim() || DEFAULT_SEED);
            set({ sim: simStatus(), toasts: [] });
        },
        setSpeed: (speed) => {
            if (simulator) simulator.speed = speed;
            set({ sim: simStatus() });
        },
        dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
    }));

    const onMessage = (message: AgentMessageEvent) => {
        const event = parseAgentEvent(message);
        if (!event) return;
        const current = store.getState();
        const control = applyEvent(current.control, event);
        const now = Date.now();
        const patch: Partial<AppState> = { control, connected: true, lastEventAt: now, sim: simStatus() };
        if (event.type === "health.heartbeat") {
            const { at, gapMs } = current.heartbeat;
            patch.heartbeat = { at: now, gapMs: at === null ? gapMs : now - at };
        }
        const text = describeEvent(event, control);
        if (text) patch.announcement = text;
        if (event.type === "approval.requested") {
            const ticket = control.jobs[event.payload.approval.jobId]?.ticket.id ?? "a job";
            const toast: Toast = { id: event.payload.approval.id, title: `Approval needed on ${ticket}`, body: event.payload.approval.question };
            patch.toasts = [...current.toasts.filter((t) => t.id !== toast.id), toast].slice(-MAX_TOASTS);
        }
        store.setState(patch);
    };

    source.subscribeStatus((connection) => store.setState({ connection }));
    source.addEventListener(AGENT_EVENT, onMessage);
    if (options.autoStart) store.getState().play();
    return store;
};
