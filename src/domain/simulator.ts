import { findBlockingGuard, guardFor } from './guards';
import { applyEvent, createInitialState } from './reducer';
import { type Rng, createRng } from './rng';
import { validateRouting } from './routing';
import { COMMIT_MESSAGES, TICKET_TEMPLATES, type TicketTemplate } from './scenarios';
import type {
  AgentEvent,
  ControlState,
  EventPayloads,
  EventType,
  GuardAction,
  Job,
  JobKind,
  JobStatus,
  OperatorCommand,
} from './types';
import { DEFAULT_WORKFLOW } from './workflow/default';
import { type ExecContext, type SimJob, runNode } from './workflow/executors';
import type { Workflow } from './workflow/types';
import { validateWorkflow } from './workflow/validate';

export const SIM_EPOCH = Date.UTC(2026, 0, 5, 9, 0, 0);
export const TICK_MS = 60_000;
const MAX_PARALLEL = 4;
/** Jobs the agent keeps in flight, not counting the ones parked on an approval. */
const MAX_ACTIVE = 8;
/** Hard cap including parked jobs, so an unattended inbox cannot grow forever. */
const MAX_OPEN = 16;
/** Nodes that may run in one tick. A longer chain carries on in the next tick, so one tick stays bounded. */
const MAX_HOPS = 40;
export const HEARTBEAT_EVERY = 5;
/** A simulated teammate answers an approval with the recommended option once it has waited this many ticks. */
export const TEAMMATE_AFTER_TICKS = 30;
const TEAMMATE_NOTE = 'answered by teammate';
export const DEFAULT_SEED = 'control-room';

export type Listener = (event: AgentEvent) => void;

type IntervalHandle = ReturnType<typeof globalThis.setInterval>;

export interface SimulatorOptions {
  seed?: string;
  /** Ticks per second while running. */
  speed?: number;
  /** Ticks to run immediately after reset so the world is not empty. */
  warmup?: number;
  /** The workflow version 1 runs. Defaults to the one the simulator always ran. */
  workflow?: Workflow;
  /** Run one job of this kind and nothing else, for a dry run. No tickets arrive and there is no scripted opening. */
  only?: JobKind;
}

/**
 * A deterministic stand in for the real agent. Given the same seed and the same
 * sequence of operator commands it emits exactly the same events.
 */
export class Simulator {
  private rng: Rng;
  private world: ControlState;
  private sim: Record<string, SimJob> = {};
  private seq = 0;
  private tickCount = 0;
  private ticketCount = 0;
  private prCount = 0;
  /** Counts events that are not node moves. CI run ids use it, so they read the same as before workflows existed. */
  private domainSeq = 0;
  private listeners = new Set<Listener>();
  private handle: IntervalHandle | null = null;
  private currentSeed: string;
  private ticksPerSecond: number;
  private readonly warmup: number;
  private readonly options: SimulatorOptions;

  constructor(options: SimulatorOptions = {}) {
    this.currentSeed = options.seed ?? DEFAULT_SEED;
    this.ticksPerSecond = options.speed ?? 1;
    this.warmup = options.warmup ?? 0;
    this.options = options;
    this.rng = createRng(this.currentSeed);
    this.world = createInitialState(options.workflow);
    this.boot();
  }

  get state(): ControlState {
    return this.world;
  }

  get seed(): string {
    return this.currentSeed;
  }

  get tick(): number {
    return this.tickCount;
  }

  get now(): number {
    return SIM_EPOCH + this.tickCount * TICK_MS;
  }

  get running(): boolean {
    return this.handle !== null;
  }

  get speed(): number {
    return this.ticksPerSecond;
  }

  set speed(value: number) {
    this.ticksPerSecond = Math.min(8, Math.max(0.25, value));
    if (this.running) {
      this.pause();
      this.start();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** A full snapshot event, sent first to every new subscriber of a stream. */
  snapshot(): AgentEvent {
    return {
      seq: this.seq,
      ts: this.now,
      jobId: null,
      type: 'world.snapshot',
      payload: { state: this.world },
    };
  }

  start(): void {
    if (this.running) return;
    this.handle = globalThis.setInterval(() => this.step(), 1000 / this.ticksPerSecond);
  }

  pause(): void {
    if (this.handle === null) return;
    globalThis.clearInterval(this.handle);
    this.handle = null;
  }

  step(count = 1): AgentEvent[] {
    const before = this.seq;
    const emitted: AgentEvent[] = [];
    const capture = (event: AgentEvent) => emitted.push(event);
    this.listeners.add(capture);
    for (let i = 0; i < count; i++) this.advance();
    this.listeners.delete(capture);
    return emitted.filter((event) => event.seq > before);
  }

  reset(seed: string = this.currentSeed): void {
    const wasRunning = this.running;
    this.pause();
    this.currentSeed = seed;
    this.rng = createRng(seed);
    this.world = createInitialState(this.options.workflow);
    this.sim = {};
    this.seq = 0;
    this.domainSeq = 0;
    this.tickCount = 0;
    this.ticketCount = 0;
    this.prCount = 0;
    this.boot();
    this.notify(this.snapshot());
    if (wasRunning) this.start();
  }

  send(command: OperatorCommand): void {
    switch (command.type) {
      case 'approval.answer':
        return this.answerApproval(command.approvalId, command.option, command.note);
      case 'job.hold': {
        const job = this.world.jobs[command.jobId];
        if (!job || job.status === 'on-hold' || job.status === 'done' || job.status === 'failed')
          return;
        this.simOf(job).manualHold = true;
        this.emit('job.held', job.id, {
          reason: command.reason.trim() || 'Held by operator',
          by: 'operator',
        });
        return;
      }
      case 'job.resume': {
        const job = this.world.jobs[command.jobId];
        if (!job || job.status !== 'on-hold') return;
        this.resume(job, 'operator');
        return;
      }
      case 'job.cancel': {
        const job = this.world.jobs[command.jobId];
        if (!job || job.status === 'done' || job.status === 'failed') return;
        this.emit('job.failed', job.id, { reason: 'Cancelled by operator', cancelled: true });
        return;
      }
      case 'job.retry': {
        const job = this.world.jobs[command.jobId];
        if (!job || job.status !== 'failed') return;
        this.sim[job.id] = this.freshSim(job, false);
        this.emit('job.retried', job.id, {
          attempt: job.attempts + 1,
          model: this.world.routing[job.kind],
        });
        return;
      }
      case 'routing.set': {
        if (Object.keys(validateRouting(command.routing)).length > 0) return;
        this.emit('routing.updated', null, { routing: command.routing });
        return;
      }
      case 'workflow.publish':
        return this.publish(command.workflow);
      case 'guard.toggle':
        if (!this.world.guards.some((guard) => guard.id === command.guardId)) return;
        this.emit('guard.toggled', null, { guardId: command.guardId, enabled: command.enabled });
        return;
    }
  }

  // ---- internals ---------------------------------------------------------

  private boot(): void {
    const only = this.options.only;
    if (only) {
      const template =
        TICKET_TEMPLATES.find((candidate) => candidate.kind === only) ?? TICKET_TEMPLATES[0];
      if (template) this.createJob(template);
      return;
    }
    // A fixed opening so every seed shows each mechanic early.
    const first = this.createJob(
      { kind: 'feature', title: 'Saved filters on the search page', repo: 'acme/web' },
      { needsApproval: true, tryMerge: true },
    );
    this.createJob(
      { kind: 'feature', title: 'Saved filters API and persistence', repo: 'acme/api' },
      { needsApproval: false, dependsOn: first.id },
    );
    this.createJob(
      { kind: 'bug', title: 'Toast stack overlaps the footer on small screens', repo: 'acme/web' },
      { needsApproval: false, ciFails: 1 },
    );
    this.createJob(
      { kind: 'feature', title: 'Empty state for the activity feed', repo: 'acme/design-system' },
      { needsApproval: false, designerHold: true },
    );
    this.createJob(
      { kind: 'chore', title: 'Speed up the pre-commit hook', repo: 'acme/mobile' },
      { needsApproval: false, tryHooks: true, findingsLeft: 1, tryOwner: true },
    );
    for (let i = 0; i < this.warmup; i++) this.advance();
  }

  private notify(event: AgentEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  private emit<T extends EventType>(
    type: T,
    jobId: string | null,
    payload: EventPayloads[T],
  ): void {
    this.seq += 1;
    if (type !== 'job.node' && type !== 'workflow.published') this.domainSeq += 1;
    // TypeScript cannot correlate the generic T with one member of the AgentEvent union.
    const event = { seq: this.seq, ts: this.now, jobId, type, payload } as AgentEvent;
    this.world = applyEvent(this.world, event);
    this.notify(event);
  }

  private freshSim(job: Job, initial: boolean, overrides: Partial<SimJob> = {}): SimJob {
    const r = this.rng;
    const published = this.world.workflows.at(-1);
    const workflow = published?.workflow ?? DEFAULT_WORKFLOW;
    return {
      node: workflow.nodes.find((node) => node.type === 'trigger')?.id ?? '',
      revision: published?.revision ?? 1,
      workflow,
      ciFailures: 0,
      reviewRounds: 0,
      wait: 0,
      needsApproval: initial ? r.chance(job.kind === 'feature' ? 0.5 : 0.15) : false,
      commitsLeft: COMMIT_MESSAGES[job.kind].length,
      ciFails: r.chance(0.25) ? 1 : 0,
      willFail: initial && r.chance(0.06),
      findingsLeft: r.chance(0.45) ? r.int(1, 2) : 0,
      tryHooks: r.chance(0.08),
      tryOwner: r.chance(0.1),
      tryMerge: r.chance(0.08),
      designerHold:
        job.ticket.repo === 'acme/design-system' && job.kind === 'feature' && r.chance(0.5),
      holdUntil: null,
      waitingOnDependency: false,
      manualHold: false,
      ...overrides,
    };
  }

  private createJob(
    template: TicketTemplate,
    overrides: Partial<SimJob> & { dependsOn?: string } = {},
  ): Job {
    this.ticketCount += 1;
    const { dependsOn, ...simOverrides } = overrides;
    const job: Job = {
      id: `job-${this.ticketCount}`,
      ticket: { id: `ACME-${100 + this.ticketCount}`, title: template.title, repo: template.repo },
      kind: template.kind,
      status: 'queued',
      model: this.world.routing[template.kind],
      attempts: 1,
      createdAt: this.now,
      timeline: [],
      dependsOn,
      commits: [],
      ciRuns: [],
      findings: [],
    };
    this.sim[job.id] = this.freshSim(job, true, simOverrides);
    this.emit('job.created', job.id, { job });
    return job;
  }

  private setStatus(job: Job, status: JobStatus): void {
    if (job.status !== status) this.emit('job.status', job.id, { status });
  }

  /** Runs the guard check for an action. Returns true when the action is blocked. */
  private attempt(job: Job, action: GuardAction, detail: string): boolean {
    const blocking = findBlockingGuard(this.world.guards, action);
    if (blocking) {
      this.emit('guard.blocked', job.id, { guardId: blocking.id, action, detail });
      return true;
    }
    const guard = guardFor(this.world.guards, action);
    if (guard) this.emit('guard.allowed', job.id, { guardId: guard.id, action, detail });
    return false;
  }

  private sha(): string {
    let out = '';
    for (let i = 0; i < 7; i++) out += Math.floor(this.rng.next() * 16).toString(16);
    return out;
  }

  private simOf(job: Job): SimJob {
    const s = this.sim[job.id];
    if (!s) throw new Error(`No simulation state for ${job.id}`);
    return s;
  }

  private resume(job: Job, by: 'agent' | 'operator'): void {
    const s = this.simOf(job);
    s.manualHold = false;
    s.holdUntil = null;
    this.emit('job.resumed', job.id, { by });
    const after = this.world.jobs[job.id];
    const pending = Object.values(this.world.approvals).some(
      (a) => a.jobId === job.id && a.status === 'pending',
    );
    if (after?.status === 'awaiting-approval' && !pending) this.setStatus(after, 'implementing');
  }

  private answerApproval(approvalId: string, option: 'A' | 'B', note?: string): void {
    const approval = this.world.approvals[approvalId];
    if (!approval || approval.status !== 'pending') return;
    const job = this.world.jobs[approval.jobId];
    if (!job || job.status === 'done' || job.status === 'failed') return;
    const trimmed = note?.trim();
    this.emit('approval.answered', job.id, {
      approvalId,
      option,
      ...(trimmed ? { note: trimmed } : {}),
    });
    const chosen = approval.options[option];
    this.emit('plan.posted', job.id, {
      plan: `${job.plan ?? ''}\n\nDecision: option ${option}, ${chosen.label}.${trimmed ? ` Note: ${trimmed}` : ''}`.trim(),
    });
    const s = this.simOf(job);
    if (s.workflow.nodes.find((node) => node.id === s.node)?.type === 'approval')
      this.move(job, s, 'next');
    s.wait = 1;
    if (job.status === 'awaiting-approval') this.setStatus(job, 'implementing');
  }

  private answerStaleApprovals(): void {
    for (const approval of Object.values(this.world.approvals)) {
      if (
        approval.status !== 'pending' ||
        this.now - approval.createdAt <= TEAMMATE_AFTER_TICKS * TICK_MS
      )
        continue;
      this.answerApproval(approval.id, approval.recommended, TEAMMATE_NOTE);
    }
  }

  private advance(): void {
    this.tickCount += 1;
    const r = this.rng;

    this.answerStaleApprovals();

    const open = Object.values(this.world.jobs).filter(
      (job) => job.status !== 'done' && job.status !== 'failed',
    );
    const parked = open.filter((job) => job.status === 'awaiting-approval').length;
    if (
      !this.options.only &&
      open.length - parked < MAX_ACTIVE &&
      open.length < MAX_OPEN &&
      r.chance(0.16)
    )
      this.createJob(r.pick(TICKET_TEMPLATES));

    let working = Object.values(this.world.jobs).filter((job) =>
      ['planning', 'implementing', 'fixing-ci', 'answering-review'].includes(job.status),
    ).length;

    for (const id of [...this.world.jobOrder]) {
      const job = this.world.jobs[id];
      const s = this.sim[id];
      if (!job || !s) continue;
      if (job.status === 'queued') {
        if (working >= MAX_PARALLEL) continue;
        working += 1;
        s.wait = 1;
        this.setStatus(job, 'planning');
        this.emit('job.node', job.id, { nodeId: s.node, edgeId: null, revision: s.revision });
        continue;
      }
      this.advanceJob(job, s);
    }

    if (this.tickCount % HEARTBEAT_EVERY === 0) {
      const jobs = Object.values(this.world.jobs);
      this.emit('health.heartbeat', null, {
        tick: this.tickCount,
        activeJobs: jobs.filter(
          (job) => job.status !== 'done' && job.status !== 'failed' && job.status !== 'queued',
        ).length,
        queueDepth: jobs.filter((job) => job.status === 'queued').length,
      });
    }
  }

  /** Takes the connection from a port of the job's current node and records the move. Returns false when there is none. */
  private move(job: Job, s: SimJob, port: string): boolean {
    const edge = s.workflow.edges.find(
      (candidate) => candidate.from.node === s.node && candidate.from.port === port,
    );
    if (!edge) return false;
    s.node = edge.to;
    this.emit('job.node', job.id, { nodeId: edge.to, edgeId: edge.id, revision: s.revision });
    return true;
  }

  /** Runs the job's node, and the nodes after it that finish in the same tick. */
  private walk(job: Job, s: SimJob): void {
    const context: ExecContext = {
      rng: this.rng,
      s,
      tick: this.tickCount,
      now: this.now,
      world: () => this.world,
      job: () => this.world.jobs[job.id] ?? job,
      emit: (type, jobId, payload) => this.emit(type, jobId, payload),
      setStatus: (target, status) => this.setStatus(target, status),
      attempt: (target, action, detail) => this.attempt(target, action, detail),
      sha: () => this.sha(),
      openPullRequest: (target) => {
        this.prCount += 1;
        const number = 400 + this.prCount;
        this.emit('pr.opened', target.id, {
          number,
          url: `https://github.com/${target.ticket.repo}/pull/${number}`,
        });
      },
      ciRunId: () => `ci-${this.domainSeq}`,
    };
    for (let hops = 0; hops < MAX_HOPS; hops++) {
      const node = s.workflow.nodes.find((candidate) => candidate.id === s.node);
      if (!node) {
        this.emit('job.failed', job.id, {
          reason:
            'The workflow has no step for this job to run. Publish a workflow with a trigger.',
        });
        return;
      }
      const outcome = runNode(node, context);
      if (outcome.kind !== 'go') return;
      if (!this.move(job, s, outcome.port)) {
        this.emit('job.failed', job.id, {
          reason: `The workflow has no connection from ${node.label}. Connect every port before publishing.`,
        });
        return;
      }
      if (!outcome.sameTick) return;
    }
    // A long chain of steps that finish at once is not an error. The job rests here and carries on next tick.
  }

  private publish(workflow: Workflow): void {
    const latest = this.world.workflows.at(-1);
    if (validateWorkflow(workflow).length > 0) return;
    if (latest && JSON.stringify(latest.workflow) === JSON.stringify(workflow)) return;
    this.emit('workflow.published', null, { revision: (latest?.revision ?? 0) + 1, workflow });
  }

  private advanceJob(job: Job, s: SimJob): void {
    switch (job.status) {
      case 'done':
      case 'failed':
      case 'awaiting-approval':
        return;
      case 'on-hold': {
        if (s.manualHold) return;
        if (s.waitingOnDependency) {
          const dep = job.dependsOn ? this.world.jobs[job.dependsOn] : undefined;
          if (!dep || dep.status === 'done') {
            s.waitingOnDependency = false;
            this.resume(job, 'agent');
          }
          return;
        }
        if (s.holdUntil !== null && this.tickCount >= s.holdUntil) this.resume(job, 'agent');
        return;
      }
    }

    if (s.wait > 0) {
      s.wait -= 1;
      return;
    }

    this.walk(job, s);
  }
}
