import { parseAgentEventData } from './event-schema';
import {
  AGENT_EVENT,
  type AgentEventSource,
  type AgentMessageEvent,
  type AgentSourceListener,
  CLOSED,
  type ConnectionStatus,
  type ReadyState,
  type StatusListener,
} from './source';
import type { AgentEvent, OperatorCommand } from './types';

/** Returns null for anything that is not a valid agent event, so a bad message never reaches the state. */
export const parseAgentEvent = (message: AgentMessageEvent): AgentEvent | null =>
  parseAgentEventData(message.data);

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
  private status: ConnectionStatus = 'connecting';

  constructor(options: SseSourceOptions) {
    this.url = options.streamUrl;
    this.commandUrl = options.commandUrl;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const create = options.createEventSource ?? ((url: string) => new EventSource(url));
    this.source = create(options.streamUrl);
    this.source.addEventListener('open', () => this.setStatus('open'));
    this.source.addEventListener('error', () => this.setStatus('error'));
  }

  get readyState(): ReadyState {
    const state = this.source.readyState;
    return state === 0 || state === 1 ? state : CLOSED;
  }

  addEventListener(type: typeof AGENT_EVENT, listener: AgentSourceListener): void {
    const handler = (event: MessageEvent<string>) => {
      const message = { data: event.data, lastEventId: event.lastEventId };
      if (parseAgentEvent(message)) listener(message);
    };
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal,
    });
    if (!response.ok)
      throw new Error('The agent did not accept the request. Try again in a moment.');
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const listener of [...this.statusListeners]) listener(status);
  }
}
