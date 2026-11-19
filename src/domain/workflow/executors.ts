import type { Rng } from '../rng';
import {
  APPROVAL_TEMPLATES,
  CI_CHECKS,
  CI_FAILURES,
  COMMIT_MESSAGES,
  PLAN_STEPS,
  REVIEW_FINDINGS,
} from '../scenarios';
import type { ControlState, EventPayloads, EventType, GuardAction, Job, JobStatus } from '../types';
import type { Workflow, WorkflowNode } from './types';

/** Private per-job simulation state. Never leaves the simulator. */
export interface SimJob {
  /** The node the job is on. */
  node: string;
  /** The version of the workflow the job started with. It keeps it until it ends or is retried. */
  revision: number;
  workflow: Workflow;
  wait: number;
  needsApproval: boolean;
  commitsLeft: number;
  ciFails: number;
  willFail: boolean;
  findingsLeft: number;
  tryHooks: boolean;
  tryOwner: boolean;
  tryMerge: boolean;
  designerHold: boolean;
  holdUntil: number | null;
  waitingOnDependency: boolean;
  manualHold: boolean;
  /** CI failures so far, counted against the CI node's attempt limit. */
  ciFailures: number;
  /** Finding rounds so far, counted against the review node's round limit. */
  reviewRounds: number;
}

/** What a node did with its turn. */
export type Outcome =
  /** Used the turn and stays on the node. */
  | { kind: 'stay' }
  /** Leaves through a port. With `sameTick` the next node runs in the same tick, otherwise the job rests until the next one. */
  | { kind: 'go'; port: string; sameTick?: boolean }
  /** The job ended: a done or failed event was emitted. */
  | { kind: 'finish' };

/** What an executor may use. The simulator implements it, which keeps the world, the random stream and the clock in one place. */
export interface ExecContext {
  readonly rng: Rng;
  readonly tick: number;
  /** Simulated wall clock in epoch milliseconds. */
  readonly now: number;
  readonly s: SimJob;
  /** The world as it is right now. */
  world(): ControlState;
  /** The job as it is in the world right now. */
  job(): Job;
  emit<T extends EventType>(type: T, jobId: string | null, payload: EventPayloads[T]): void;
  setStatus(job: Job, status: JobStatus): void;
  /** Runs the guard check for an action. Returns true when the action is blocked. */
  attempt(job: Job, action: GuardAction, detail: string): boolean;
  sha(): string;
  openPullRequest(job: Job): void;
  /** A run id for CI events. Unique per event, numbered by the events that are not node moves. */
  ciRunId(): string;
}

const finish = (ctx: ExecContext, type: 'job.done' | 'job.failed', reason: string): Outcome => {
  const job = ctx.job();
  if (type === 'job.done') ctx.emit('job.done', job.id, { prNumber: job.pr?.number });
  else ctx.emit('job.failed', job.id, { reason });
  return { kind: 'finish' };
};

const GUARD_DETAIL: Record<Exclude<GuardAction, 'mark-ready'>, string> = {
  merge: 'Tried to merge after approvals because the branch was green',
  'skip-hooks': 'Tried git push --no-verify because the pre-commit hook took over 90 seconds',
  'post-as-owner': 'Drafted a review reply that would be posted from the owner account',
};

const TRIES = { merge: 'tryMerge', 'skip-hooks': 'tryHooks', 'post-as-owner': 'tryOwner' } as const;

type Of<T extends WorkflowNode['type']> = Extract<WorkflowNode, { type: T }>;

const trigger = (node: Of<'trigger'>, ctx: ExecContext): Outcome => {
  const job = ctx.job();
  if (!node.config.kinds.includes(job.kind))
    return finish(ctx, 'job.failed', `No trigger accepts ${job.kind} jobs`);
  return { kind: 'go', port: 'next', sameTick: true };
};

const plan = (_node: Of<'plan'>, ctx: ExecContext): Outcome => {
  const job = ctx.job();
  const steps = PLAN_STEPS[job.kind].map((step, i) => `${i + 1}. ${step}`).join('\n');
  ctx.emit('plan.posted', job.id, {
    plan: `Plan for ${job.ticket.id}: ${job.ticket.title}\n${steps}`,
  });
  return { kind: 'go', port: 'next', sameTick: true };
};

const approval = (_node: Of<'approval'>, ctx: ExecContext): Outcome => {
  const job = ctx.job();
  const { s } = ctx;
  if (!s.needsApproval) {
    ctx.setStatus(job, 'implementing');
    return { kind: 'go', port: 'next' };
  }
  const template = APPROVAL_TEMPLATES[job.kind];
  ctx.emit('approval.requested', job.id, {
    approval: {
      id: `apr-${job.id}-${job.attempts}`,
      jobId: job.id,
      ...template,
      status: 'pending',
      createdAt: ctx.now,
    },
  });
  s.needsApproval = false;
  // The job rests here until an operator answers. answerApproval moves it on.
  return { kind: 'stay' };
};

const build = (ctx: ExecContext): Outcome => {
  const job = ctx.job();
  const { s, rng: r } = ctx;
  if (job.status !== 'implementing') ctx.setStatus(job, 'implementing');
  const messages = COMMIT_MESSAGES[job.kind];
  const index = messages.length - s.commitsLeft;
  if (s.designerHold && index === 1) {
    s.designerHold = false;
    s.holdUntil = ctx.tick + r.int(6, 10);
    ctx.emit('job.held', job.id, {
      reason: 'Waiting on a designer for the empty state spec',
      by: 'agent',
    });
    return { kind: 'stay' };
  }
  if (s.tryHooks && index === 0) {
    s.tryHooks = false;
    if (ctx.attempt(job, 'skip-hooks', GUARD_DETAIL['skip-hooks'])) {
      s.wait = 1;
      return { kind: 'stay' };
    }
  }
  const message = messages[index];
  if (s.commitsLeft > 0 && message) {
    s.commitsLeft -= 1;
    ctx.emit('commit.pushed', job.id, { sha: ctx.sha(), message });
    if (s.commitsLeft === 0 && !job.pr) ctx.openPullRequest(job);
    s.wait = r.int(0, 1);
    return { kind: 'stay' };
  }
  return { kind: 'go', port: 'next' };
};

/** A fix step repairs whatever the job is waiting on: a failed CI run or an open review finding. */
const fix = (ctx: ExecContext): Outcome => {
  const job = ctx.job();
  const { s, rng: r } = ctx;
  if (job.status === 'fixing-ci') {
    const check = r.pick(CI_CHECKS);
    if (s.willFail)
      return finish(ctx, 'job.failed', `CI still red on ${check} after the fix attempt`);
    const sha = ctx.sha();
    ctx.emit('commit.pushed', job.id, { sha, message: `fix: make ${check} pass` });
    ctx.emit('ci.fixed', job.id, { runId: ctx.ciRunId(), check, sha });
    s.ciFails = Math.max(0, s.ciFails - 1);
    ctx.setStatus(job, 'implementing');
    return { kind: 'go', port: 'next' };
  }
  if (job.status === 'answering-review') {
    const open = job.findings.find((finding) => !finding.reply);
    if (s.tryOwner) {
      s.tryOwner = false;
      if (ctx.attempt(job, 'post-as-owner', GUARD_DETAIL['post-as-owner'])) {
        s.wait = 1;
        return { kind: 'stay' };
      }
    }
    const reply = open && REVIEW_FINDINGS.find((finding) => finding.body === open.body)?.reply;
    if (open && reply) {
      ctx.emit('commit.pushed', job.id, {
        sha: ctx.sha(),
        message: 'fix: address review feedback',
      });
      ctx.emit('review.replied', job.id, { findingId: open.id, body: reply });
    }
    ctx.setStatus(job, 'implementing');
    s.wait = 1;
    return { kind: 'go', port: 'next' };
  }
  return { kind: 'go', port: 'next', sameTick: true };
};

const implement = (node: Of<'implement'>, ctx: ExecContext): Outcome =>
  node.config.mode === 'fix' ? fix(ctx) : build(ctx);

const ci = (node: Of<'ci'>, ctx: ExecContext): Outcome => {
  const { s, rng: r } = ctx;
  const job = ctx.job();
  const check = r.pick(CI_CHECKS);
  if (s.ciFails > 0 || s.willFail) {
    if (s.ciFailures >= node.config.maxAttempts)
      return finish(ctx, 'job.failed', `CI still red after ${node.config.maxAttempts} attempts`);
    s.ciFailures += 1;
    ctx.emit('ci.failed', job.id, { runId: ctx.ciRunId(), check, detail: r.pick(CI_FAILURES) });
    s.wait = 1;
    return { kind: 'go', port: 'fail' };
  }
  ctx.emit('ci.passed', job.id, { runId: ctx.ciRunId(), check: 'all checks' });
  s.wait = r.int(1, 2);
  return { kind: 'go', port: 'pass' };
};

const review = (node: Of<'review'>, ctx: ExecContext): Outcome => {
  const { s, rng: r } = ctx;
  const job = ctx.job();
  if (s.findingsLeft > 0 && s.reviewRounds < node.config.maxRounds) {
    s.findingsLeft -= 1;
    s.reviewRounds += 1;
    const finding = r.pick(REVIEW_FINDINGS);
    ctx.emit('review.finding', job.id, {
      findingId: `rf-${job.id}-${job.findings.length + 1}`,
      author: r.pick(['review-bot', 'code-owner']),
      file: finding.file,
      body: finding.body,
    });
    s.wait = 1;
    return { kind: 'go', port: 'findings' };
  }
  return { kind: 'go', port: 'clean' };
};

const condition = (node: Of<'condition'>, ctx: ExecContext): Outcome => {
  const job = ctx.job();
  const { field, operator, value } = node.config;
  const actual = field === 'kind' ? job.kind : field === 'repo' ? job.ticket.repo : job.attempts;
  const result =
    operator === 'at-least'
      ? Number(actual) >= Number(value)
      : (String(actual) === value) === (operator === 'equals');
  return { kind: 'go', port: result ? 'true' : 'false', sameTick: true };
};

const waitDependency = (_node: Of<'wait-dependency'>, ctx: ExecContext): Outcome => {
  const job = ctx.job();
  const dep = job.dependsOn ? ctx.world().jobs[job.dependsOn] : undefined;
  if (dep && dep.status !== 'done') {
    if (
      ctx.attempt(
        job,
        'mark-ready',
        `Tried to mark the PR ready while ${dep.ticket.id} is still unmerged`,
      )
    ) {
      ctx.s.waitingOnDependency = true;
      ctx.emit('job.held', job.id, {
        reason: `Waiting on ${dep.ticket.id} to merge first`,
        by: 'agent',
      });
      return { kind: 'stay' };
    }
  }
  return { kind: 'go', port: 'next', sameTick: true };
};

const markReady = (_node: Of<'mark-ready'>, ctx: ExecContext): Outcome => {
  ctx.setStatus(ctx.job(), 'ready-for-review');
  ctx.s.wait = ctx.rng.int(4, 9);
  return { kind: 'go', port: 'next' };
};

const guard = (node: Of<'guard'>, ctx: ExecContext): Outcome => {
  const { s } = ctx;
  const flag = TRIES[node.config.action];
  if (s[flag]) {
    s[flag] = false;
    if (ctx.attempt(ctx.job(), node.config.action, GUARD_DETAIL[node.config.action])) {
      s.wait = 2;
      return { kind: 'stay' };
    }
  }
  return { kind: 'go', port: 'next', sameTick: true };
};

const end = (node: Of<'end'>, ctx: ExecContext): Outcome =>
  node.config.outcome === 'done'
    ? finish(ctx, 'job.done', '')
    : finish(ctx, 'job.failed', `Ended at ${node.label}`);

/** Runs one node for one job. Each node type is the part of the old phase machine that it replaces. */
export const runNode = (node: WorkflowNode, ctx: ExecContext): Outcome => {
  switch (node.type) {
    case 'trigger':
      return trigger(node, ctx);
    case 'plan':
      return plan(node, ctx);
    case 'approval':
      return approval(node, ctx);
    case 'implement':
      return implement(node, ctx);
    case 'ci':
      return ci(node, ctx);
    case 'review':
      return review(node, ctx);
    case 'condition':
      return condition(node, ctx);
    case 'wait-dependency':
      return waitDependency(node, ctx);
    case 'mark-ready':
      return markReady(node, ctx);
    case 'guard':
      return guard(node, ctx);
    case 'end':
      return end(node, ctx);
  }
};
