import { parseAgentEventData } from "./schema";
import type { Simulator } from "./simulator";
import type { AgentEvent, OperatorCommand } from "./types";

/** The SSE event name every agent event is sent under. */
export const AGENT_EVENT = "agent-event";

type ReadyState = 0 | 1 | 2;

const OPEN: ReadyState = 1;
const CLOSED: ReadyState = 2;

export interface AgentMessageEvent {
    /** JSON encoded AgentEvent, exactly like `MessageEvent.data` from a real EventSource. */
    data: string;
    lastEventId: string;
}

type AgentSourceListener = (event: AgentMessageEvent) => void;

export type ConnectionStatus = "connecting" | "open" | "error";
type StatusListener = (status: ConnectionStatus) => void;

/**
 * The shape of the browser `EventSource`, narrowed to what the control room needs,
 * plus a `send` channel for operator commands (a POST in a real backend).
 */
export interface AgentEventSource {
    readonly url: string;
    readonly readyState: ReadyState;
    addEventListener(type: typeof AGENT_EVENT, listener: AgentSourceListener): void;
    removeEventListener(type: typeof AGENT_EVENT, listener: AgentSourceListener): void;
    /** Reports the link state now and on every change. Returns a function that stops listening. */
    subscribeStatus(listener: StatusListener): () => void;
    close(): void;
    send(command: OperatorCommand, signal?: AbortSignal): Promise<void>;
}

/** Returns null for anything that is not a valid agent event, so a bad message never reaches the state. */
export const parseAgentEvent = (message: AgentMessageEvent): AgentEvent | null => parseAgentEventData(message.data);

const toMessage = (event: AgentEvent): AgentMessageEvent => ({ data: JSON.stringify(event), lastEventId: String(event.seq) });

/** Adapts the simulator to the EventSource shape. Sends a snapshot first, like the real server. */
export class SimulatedAgentSource implements AgentEventSource {
    readonly url = "sim://local";
    readonly simulator: Simulator;
    private state: ReadyState = OPEN;
    private listeners = new Set<AgentSourceListener>();
    private unsubscribe: (() => void) | null;

    constructor(simulator: Simulator) {
        this.simulator = simulator;
        this.unsubscribe = simulator.subscribe((event) => this.dispatch(event));
    }

    get readyState(): ReadyState {
        return this.state;
    }

    addEventListener(_type: typeof AGENT_EVENT, listener: AgentSourceListener): void {
        this.listeners.add(listener);
        listener(toMessage(this.simulator.snapshot()));
    }

    removeEventListener(_type: typeof AGENT_EVENT, listener: AgentSourceListener): void {
        this.listeners.delete(listener);
    }

    subscribeStatus(listener: StatusListener): () => void {
        listener("open");
        return () => {};
    }

    close(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.listeners.clear();
        this.state = CLOSED;
    }

    async send(command: OperatorCommand): Promise<void> {
        this.simulator.send(command);
    }

    private dispatch(event: AgentEvent): void {
        const message = toMessage(event);
        for (const listener of [...this.listeners]) listener(message);
    }
}

interface SseSourceOptions {
    /** GET endpoint that streams `agent-event` messages. */
    streamUrl: string;
    /** POST endpoint that accepts an OperatorCommand as JSON. */
    commandUrl: string;
    fetchImpl?: typeof fetch;
    createEventSource?: (url: string) => EventSource;
}

/** Talks to a real agent backend. See docs/protocol.md. */
export class SseAgentSource implements AgentEventSource {
    readonly url: string;
    private readonly source: EventSource;
    private readonly commandUrl: string;
    private readonly fetchImpl: typeof fetch;
    private readonly wrapped = new Map<AgentSourceListener, (event: MessageEvent<string>) => void>();
    private readonly statusListeners = new Set<StatusListener>();
    private status: ConnectionStatus = "connecting";

    constructor(options: SseSourceOptions) {
        this.url = options.streamUrl;
        this.commandUrl = options.commandUrl;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
        const create = options.createEventSource ?? ((url: string) => new EventSource(url));
        this.source = create(options.streamUrl);
        this.source.addEventListener("open", () => this.setStatus("open"));
        this.source.addEventListener("error", () => this.setStatus("error"));
    }

    get readyState(): ReadyState {
        const state = this.source.readyState;
        return state === 0 || state === 1 ? state : CLOSED;
    }

    addEventListener(type: typeof AGENT_EVENT, listener: AgentSourceListener): void {
        const handler = (event: MessageEvent<string>) => listener({ data: event.data, lastEventId: event.lastEventId });
        this.wrapped.set(listener, handler);
        this.source.addEventListener(type, handler);
    }

    removeEventListener(type: typeof AGENT_EVENT, listener: AgentSourceListener): void {
        const handler = this.wrapped.get(listener);
        if (handler) this.source.removeEventListener(type, handler);
        this.wrapped.delete(listener);
    }

    subscribeStatus(listener: StatusListener): () => void {
        this.statusListeners.add(listener);
        listener(this.status);
        return () => this.statusListeners.delete(listener);
    }

    close(): void {
        this.source.close();
    }

    async send(command: OperatorCommand, signal?: AbortSignal): Promise<void> {
        const response = await this.fetchImpl(this.commandUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command),
            signal,
        });
        if (!response.ok) throw new Error("The agent did not accept the request. Try again in a moment.");
    }

    private setStatus(status: ConnectionStatus): void {
        this.status = status;
        for (const listener of [...this.statusListeners]) listener(status);
    }
}
