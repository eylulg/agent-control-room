import { describe, expect, it, vi } from 'vitest';
import { applyEvent, createInitialState } from '../reducer';
import { Simulator } from '../simulator';
import { AGENT_EVENT, SimulatedAgentSource, SseAgentSource, parseAgentEvent } from '../source';

describe('SimulatedAgentSource', () => {
  it('streams events that rebuild the simulator state on the client', () => {
    const sim = new Simulator({ seed: 'fold' });
    const source = new SimulatedAgentSource(sim);
    let client = createInitialState();
    source.addEventListener(AGENT_EVENT, (message) => {
      const event = parseAgentEvent(message);
      if (event) client = applyEvent(client, event);
    });

    sim.step(50);

    expect(client).toEqual(sim.state);
  });
});

describe('parseAgentEvent', () => {
  it.each([
    ['malformed JSON', '{not json'],
    [
      'an unknown type',
      JSON.stringify({ seq: 1, ts: 0, jobId: null, type: 'job.teleported', payload: {} }),
    ],
    [
      'a payload of the wrong shape',
      JSON.stringify({
        seq: 1,
        ts: 0,
        jobId: 'job-1',
        type: 'job.status',
        payload: { status: 'sleeping' },
      }),
    ],
  ])('rejects %s', (_case, data) => {
    expect(parseAgentEvent({ data, lastEventId: '1' })).toBeNull();
  });
});

describe('SseAgentSource', () => {
  it('reports the stream failing and recovering', () => {
    const stream = new EventTarget();
    const source = new SseAgentSource({
      streamUrl: 'https://agent.test/events',
      commandUrl: 'https://agent.test/commands',
      createEventSource: () => stream as EventSource,
    });
    const seen: string[] = [];
    source.subscribeStatus((status) => seen.push(status));

    stream.dispatchEvent(new Event('error'));
    stream.dispatchEvent(new Event('open'));

    expect(seen).toEqual(['connecting', 'error', 'open']);
  });

  it('rejects a command the backend does not accept', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 }));
    const source = new SseAgentSource({
      streamUrl: 'https://agent.test/events',
      commandUrl: 'https://agent.test/commands',
      fetchImpl,
      createEventSource: () => new EventTarget() as EventSource,
    });

    const result = source.send({ type: 'job.resume', jobId: 'job-1' });

    await expect(result).rejects.toThrow('did not accept');
  });
});
