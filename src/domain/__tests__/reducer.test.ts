import { describe, expect, it } from 'vitest';
import { pendingApprovals } from '../selectors';
import { Simulator } from '../simulator';

const awaitingApproval = () => {
  const sim = new Simulator({ seed: 'approvals' });
  sim.step(4);
  const approval = pendingApprovals(sim.state)[0];
  if (!approval) throw new Error('expected a pending approval');
  return { sim, approval };
};

describe('applyEvent', () => {
  it('closes the pending approval when a job is cancelled and retried', () => {
    const { sim, approval } = awaitingApproval();

    sim.send({ type: 'job.cancel', jobId: approval.jobId });
    sim.send({ type: 'job.retry', jobId: approval.jobId });

    expect(pendingApprovals(sim.state)).toEqual([]);
    expect(sim.state.approvals[approval.id]?.status).toBe('superseded');
  });

  it('posts a fresh plan for a retried job instead of acting on the stale approval', () => {
    const { sim, approval } = awaitingApproval();
    sim.send({ type: 'job.cancel', jobId: approval.jobId });
    sim.send({ type: 'job.retry', jobId: approval.jobId });

    sim.send({ type: 'approval.answer', approvalId: approval.id, option: 'A' });
    sim.step(4);

    const plan = sim.state.jobs[approval.jobId]?.plan;
    expect(plan).toMatch(/^Plan for/);
    expect(plan).not.toContain('Decision');
  });
});
