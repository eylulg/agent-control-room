import type { Simulator } from './simulator';
import type { AgentEvent, OperatorCommand } from './types';

/** The SSE event name every agent event is sent under. */
export const AGENT_EVENT = 'agent-event';

export type ReadyState = 0 | 1 | 2;

const OPEN: ReadyState = 1;
export const CLOSED: ReadyState = 2;

export interface AgentMessageEvent {
  /** JSON encoded AgentEvent, exactly like `MessageEvent.data` from a real EventSource. */
  data: string;
  lastEventId: string;
}

export type AgentSourceListener = (event: AgentMessageEvent) => void;

export type ConnectionStatus = 'connecting' | 'open' | 'error';
export type StatusListener = (status: ConnectionStatus) => void;

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

const toMessage = (event: AgentEvent): AgentMessageEvent => ({
  data: JSON.stringify(event),
  lastEventId: String(event.seq),
});

/** Adapts the simulator to the EventSource shape. Sends a snapshot first, like the real server. */
export class SimulatedAgentSource implements AgentEventSource {
  readonly url = 'sim://local';
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
    listener('open');
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
