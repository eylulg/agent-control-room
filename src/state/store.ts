import { type StoreApi, createStore } from "zustand/vanilla";
import { applyEvent, createInitialState } from "@/domain/reducer";
import { DEFAULT_SEED, Simulator } from "@/domain/simulator";
import { AGENT_EVENT, type AgentEventSource, type AgentMessageEvent, SimulatedAgentSource, parseAgentEvent } from "@/domain/source";
import type { AgentEvent, ControlState, OperatorCommand } from "@/domain/types";

export interface Toast {
    id: string;
    title: string;
    body: string;
    href: string;
}

export interface SimStatus {
    running: boolean;
    speed: number;
    seed: string;
    tick: number;
}

export interface AppState {
    control: ControlState;
    connected: boolean;
    sim: SimStatus | null;
    toasts: Toast[];
    announcement: { id: number; text: string };
    send: (command: OperatorCommand) => Promise<void>;
    play: () => void;
    pause: () => void;
    step: () => void;
    reset: (seed: string) => void;
    setSpeed: (speed: number) => void;
    dismissToast: (id: string) => void;
    disconnect: () => void;
}

export type AppStore = StoreApi<AppState>;

export interface CreateAppStoreOptions {
    seed?: string;
    warmup?: number;
    autoStart?: boolean;
    speed?: number;
    /** Supply a real backend instead of the simulator. */
    source?: AgentEventSource;
}

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
    const simulator = options.source ? null : new Simulator({ seed: options.seed ?? DEFAULT_SEED, warmup: options.warmup ?? 0, speed: options.speed ?? 1 });
    const source = options.source ?? new SimulatedAgentSource(simulator!);

    const simStatus = (): SimStatus | null =>
        simulator ? { running: simulator.running, speed: simulator.speed, seed: simulator.seed, tick: simulator.tick } : null;

    const store = createStore<AppState>()((set, get) => ({
        control: createInitialState(),
        connected: false,
        sim: simStatus(),
        toasts: [],
        announcement: { id: 0, text: "" },
        send: (command) => source.send(command),
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
        disconnect: () => {
            simulator?.pause();
            source.removeEventListener(AGENT_EVENT, onMessage);
            source.close();
            set({ connected: false, sim: simStatus() });
        },
    }));

    function onMessage(message: AgentMessageEvent) {
        const event = parseAgentEvent(message);
        const current = store.getState();
        const control = applyEvent(current.control, event);
        const patch: Partial<AppState> = { control, connected: true, sim: simStatus() };
        const text = describeEvent(event, control);
        if (text) patch.announcement = { id: current.announcement.id + 1, text };
        if (event.type === "approval.requested") {
            const job = control.jobs[event.payload.approval.jobId];
            const toast: Toast = {
                id: event.payload.approval.id,
                title: `Approval needed on ${job?.ticket.id ?? "a job"}`,
                body: event.payload.approval.question,
                href: "/approvals",
            };
            patch.toasts = [...current.toasts.filter((t) => t.id !== toast.id), toast].slice(-3);
        }
        store.setState(patch);
    }

    source.addEventListener(AGENT_EVENT, onMessage);
    if (options.autoStart) store.getState().play();
    return store;
};
