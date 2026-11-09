import type { Simulator } from "./simulator";
import type { AgentEvent, OperatorCommand } from "./types";

/** The SSE event name every agent event is sent under. */
export const AGENT_EVENT = "agent-event";

export interface AgentMessageEvent {
    /** JSON encoded AgentEvent, exactly like `MessageEvent.data` from a real EventSource. */
    data: string;
    lastEventId: string;
}

export type AgentSourceListener = (event: AgentMessageEvent) => void;

/**
 * The shape of the browser `EventSource`, narrowed to what the control room needs,
 * plus a `send` channel for operator commands (a POST in a real backend).
 * Anything that satisfies this can drive the UI: the in browser simulator or a
 * real agent over server sent events.
 */
export interface AgentEventSource {
    readonly url: string;
    readonly readyState: 0 | 1 | 2;
    addEventListener(type: typeof AGENT_EVENT, listener: AgentSourceListener): void;
    removeEventListener(type: typeof AGENT_EVENT, listener: AgentSourceListener): void;
    close(): void;
    send(command: OperatorCommand): Promise<void>;
}

export const CONNECTING = 0;
export const OPEN = 1;
export const CLOSED = 2;

export const parseAgentEvent = (message: AgentMessageEvent): AgentEvent => JSON.parse(message.data) as AgentEvent;

const toMessage = (event: AgentEvent): AgentMessageEvent => ({ data: JSON.stringify(event), lastEventId: String(event.seq) });

/** Adapts the simulator to the EventSource shape. Sends a snapshot first, like the real server. */
export class SimulatedAgentSource implements AgentEventSource {
    readonly url = "sim://local";
    private state: 0 | 1 | 2 = CONNECTING;
    private listeners = new Set<AgentSourceListener>();
    private unsubscribe: (() => void) | null;
    readonly simulator: Simulator;

    constructor(simulator: Simulator) {
        this.simulator = simulator;
        this.unsubscribe = simulator.subscribe((event) => this.dispatch(event));
        this.state = OPEN;
    }

    get readyState(): 0 | 1 | 2 {
        return this.state;
    }

    addEventListener(_type: typeof AGENT_EVENT, listener: AgentSourceListener): void {
        this.listeners.add(listener);
        listener(toMessage(this.simulator.snapshot()));
    }

    removeEventListener(_type: typeof AGENT_EVENT, listener: AgentSourceListener): void {
        this.listeners.delete(listener);
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

export interface SseSourceOptions {
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

    constructor(options: SseSourceOptions) {
        this.url = options.streamUrl;
        this.commandUrl = options.commandUrl;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
        this.source = (options.createEventSource ?? ((url) => new EventSource(url)))(options.streamUrl);
    }

    get readyState(): 0 | 1 | 2 {
        return this.source.readyState as 0 | 1 | 2;
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

    close(): void {
        this.source.close();
    }

    async send(command: OperatorCommand): Promise<void> {
        const response = await this.fetchImpl(this.commandUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command),
        });
        if (!response.ok) throw new Error(`Command ${command.type} failed with ${response.status}`);
    }
}
