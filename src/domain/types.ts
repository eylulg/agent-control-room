import type { Workflow } from './workflow/types';

export const JOB_KINDS = ['feature', 'bug', 'chore', 'review-fix', 'release'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATUSES = [
  'queued',
  'planning',
  'awaiting-approval',
  'implementing',
  'fixing-ci',
  'answering-review',
  'on-hold',
  'ready-for-review',
  'done',
  'failed',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

interface Ticket {
  id: string;
  title: string;
  repo: string;
}

interface Commit {
  sha: string;
  message: string;
  ts: number;
}

interface CiRun {
  id: string;
  status: 'passed' | 'failed' | 'fixed';
  check: string;
  detail: string;
  ts: number;
}

interface ReviewFinding {
  id: string;
  author: string;
  file: string;
  body: string;
  ts: number;
  reply?: string;
}

interface PullRequest {
  number: number;
  url: string;
}

export interface Job {
  id: string;
  ticket: Ticket;
  kind: JobKind;
  status: JobStatus;
  model: string;
  attempts: number;
  createdAt: number;
  timeline: AgentEvent[];
  plan?: string;
  pr?: PullRequest;
  holdReason?: string;
  /** Status to return to when a hold is lifted. */
  statusBeforeHold?: JobStatus;
  /** Another job whose PR must merge before this one may be marked ready. */
  dependsOn?: string;
  commits: Commit[];
  ciRuns: CiRun[];
  findings: ReviewFinding[];
  failureReason?: string;
}

export type ApprovalOptionKey = 'A' | 'B';

export interface ApprovalOption {
  label: string;
  description: string;
}

export interface ApprovalRequest {
  id: string;
  jobId: string;
  question: string;
  options: Record<ApprovalOptionKey, ApprovalOption>;
  recommended: ApprovalOptionKey;
  reason: string;
  status: 'pending' | 'answered' | 'superseded';
  answer?: { option: ApprovalOptionKey; note?: string; ts: number };
  createdAt: number;
}

export type GuardAction = 'merge' | 'mark-ready' | 'skip-hooks' | 'post-as-owner';

interface GuardBlock {
  ts: number;
  jobId: string;
  action: GuardAction;
  detail: string;
}

export interface Guard {
  id: string;
  action: GuardAction;
  rule: string;
  description: string;
  enabled: boolean;
  blocked: GuardBlock[];
}

export type RoutingTable = Record<JobKind, string>;

/** Builds a record with every key of a closed key list. */
export const recordFromKeys = <K extends string, V>(
  keys: readonly K[],
  value: (key: K) => V,
): Record<K, V> =>
  // Safe: the entries cover every key in `keys`, which is exactly K.
  Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, V>;

export const EVENT_TYPES = [
  'world.snapshot',
  'job.created',
  'job.status',
  'plan.posted',
  'approval.requested',
  'approval.answered',
  'commit.pushed',
  'pr.opened',
  'ci.passed',
  'ci.failed',
  'ci.fixed',
  'review.finding',
  'review.replied',
  'guard.blocked',
  'guard.allowed',
  'guard.toggled',
  'routing.updated',
  'job.held',
  'job.resumed',
  'job.retried',
  'job.done',
  'job.failed',
  'job.node',
  'workflow.published',
  'health.heartbeat',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** One version of the workflow that jobs walk. Version numbers only grow. */
interface PublishedWorkflow {
  revision: number;
  publishedAt: number;
  workflow: Workflow;
}

interface RunStep {
  nodeId: string;
  /** The connection the job took to get here. Null for the trigger. */
  edgeId: string | null;
  ts: number;
}

/** Where a job has been in the workflow it started with. */
export interface JobRun {
  revision: number;
  steps: RunStep[];
}

interface HealthState {
  lastHeartbeat: number | null;
  tick: number;
  activeJobs: number;
}

/** The read model the UI renders. It is rebuilt purely from the event stream. */
export interface ControlState {
  jobs: Record<string, Job>;
  jobOrder: string[];
  approvals: Record<string, ApprovalRequest>;
  guards: Guard[];
  routing: RoutingTable;
  events: AgentEvent[];
  completions: number[];
  health: HealthState;
  /** Published workflows, oldest first. The last one is what new jobs use. */
  workflows: PublishedWorkflow[];
  runs: Record<string, JobRun>;
}

export interface EventPayloads {
  'world.snapshot': { state: ControlState };
  'job.created': { job: Job };
  'job.status': { status: JobStatus };
  'plan.posted': { plan: string };
  'approval.requested': { approval: ApprovalRequest };
  'approval.answered': { approvalId: string; option: ApprovalOptionKey; note?: string };
  'commit.pushed': { sha: string; message: string };
  'pr.opened': { number: number; url: string };
  'ci.passed': { runId: string; check: string };
  'ci.failed': { runId: string; check: string; detail: string };
  'ci.fixed': { runId: string; check: string; sha: string };
  'review.finding': { findingId: string; author: string; file: string; body: string };
  'review.replied': { findingId: string; body: string };
  'guard.blocked': { guardId: string; action: GuardAction; detail: string };
  'guard.allowed': { guardId: string; action: GuardAction; detail: string };
  'guard.toggled': { guardId: string; enabled: boolean };
  'routing.updated': { routing: RoutingTable };
  'job.held': { reason: string; by: 'agent' | 'operator' };
  'job.resumed': { by: 'agent' | 'operator' };
  'job.retried': { attempt: number; model: string };
  'job.done': { prNumber?: number };
  'job.failed': { reason: string; cancelled?: boolean };
  'job.node': { nodeId: string; edgeId: string | null; revision: number };
  'workflow.published': { revision: number; workflow: Workflow };
  'health.heartbeat': { tick: number; activeJobs: number; queueDepth: number };
}

interface AgentEventOf<T extends EventType> {
  /** Monotonic sequence number, used as the SSE `id` for resume. */
  seq: number;
  ts: number;
  jobId: string | null;
  type: T;
  payload: EventPayloads[T];
}

export type AgentEvent = { [T in EventType]: AgentEventOf<T> }[EventType];

/** Operator commands travel the other way: UI to agent (POST in a real backend). */
export type OperatorCommand =
  | { type: 'approval.answer'; approvalId: string; option: ApprovalOptionKey; note?: string }
  | { type: 'job.hold'; jobId: string; reason: string }
  | { type: 'job.resume'; jobId: string }
  | { type: 'job.cancel'; jobId: string }
  | { type: 'job.retry'; jobId: string }
  | { type: 'routing.set'; routing: RoutingTable }
  | { type: 'guard.toggle'; guardId: string; enabled: boolean }
  | { type: 'workflow.publish'; workflow: Workflow };
