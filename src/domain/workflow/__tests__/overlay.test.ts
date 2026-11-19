import { describe, expect, it } from 'vitest';
import { Simulator } from '@/domain/simulator';
import { defaultWorkflow } from '@/test-utils/workflow';
import { generateWorkflow } from '../generate';
import { updateNode } from '../ops';
import { liveOverlay, nodeStates } from '../overlay';
import { validateWorkflow } from '../validate';

describe('execution overlay', () => {
  it('counts open jobs on the node they are at', () => {
    const sim = new Simulator({ seed: 'overlay' });
    sim.step(20);

    const overlay = liveOverlay(sim.state);
    const open = Object.values(sim.state.jobs).filter(
      (job) => job.status !== 'done' && job.status !== 'failed' && sim.state.runs[job.id],
    );
    const counted = Object.values(overlay.nodes).reduce((sum, node) => sum + node.count, 0);

    expect(counted).toBe(open.length);
    expect(Object.keys(overlay.edges).length).toBeGreaterThan(0);
  });

  it('keeps counting open jobs from an older version after a publish', () => {
    const sim = new Simulator({ seed: 'overlay' });
    sim.step(20);
    const before = Object.values(liveOverlay(sim.state).nodes).reduce(
      (sum, node) => sum + node.count,
      0,
    );

    sim.send({
      type: 'workflow.publish',
      workflow: updateNode(defaultWorkflow(), 'ci', { config: { maxAttempts: 5 } }),
    });

    const after = Object.values(liveOverlay(sim.state).nodes).reduce(
      (sum, node) => sum + node.count,
      0,
    );
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(before);
  });

  it('marks passed, current and never visited nodes of a finished job', () => {
    const sim = new Simulator({ seed: 'dry', workflow: defaultWorkflow(), only: 'chore' });
    sim.step(200);

    const states = nodeStates(defaultWorkflow(), sim.state.runs['job-1'], sim.state.jobs['job-1']);

    expect(states.done).toBe('passed');
    expect(states.trigger).toBe('passed');
    expect(Object.values(states)).toContain('skipped');
  });

  it('shows a job waiting for approval as waiting', () => {
    const sim = new Simulator({ seed: 'approvals' });
    sim.step(8);
    const waiting = Object.values(sim.state.jobs).find((job) => job.status === 'awaiting-approval');

    const states = nodeStates(defaultWorkflow(), waiting && sim.state.runs[waiting.id], waiting);

    expect(states.approval).toBe('waiting');
  });
});

describe('generateWorkflow', () => {
  it('makes a valid graph of about the requested size', () => {
    const workflow = generateWorkflow(200);

    expect(workflow.nodes.length).toBeGreaterThanOrEqual(198);
    expect(validateWorkflow(workflow)).toEqual([]);
  });
});
