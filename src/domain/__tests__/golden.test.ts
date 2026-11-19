import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@/domain/types';
import { GOLDEN_SEEDS, runGoldenScript } from '@/test-utils/golden-script';

const readGolden = (seed: string): unknown[] =>
  readFileSync(path.join(import.meta.dirname, '../../test-utils/golden', `${seed}.jsonl`), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));

/** Node moves and publishes did not exist when the streams were recorded. With them removed and the rest renumbered, the streams must match exactly. */
const asBefore = (events: AgentEvent[]): unknown[] => {
  let removed = 0;
  const kept: unknown[] = [];
  for (const event of events) {
    if (event.type === 'job.node' || event.type === 'workflow.published') removed += 1;
    else kept.push(JSON.parse(JSON.stringify({ ...event, seq: event.seq - removed })) as unknown);
  }
  return kept;
};

describe('Simulator golden streams', () => {
  // The streams were captured from the phase machine simulator before workflows existed.
  it.each(GOLDEN_SEEDS)(
    'replays the recorded event stream for seed %s with the default workflow',
    (seed) => {
      expect(asBefore(runGoldenScript(seed))).toEqual(readGolden(seed));
    },
  );
});
