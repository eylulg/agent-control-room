import { DEFAULT_GUARDS } from "./guards";
import { DEFAULT_ROUTING } from "./routing";
import { type AgentEvent, type ControlState, type Job } from "./types";

const MAX_EVENTS = 400;

export const createInitialState = (): ControlState => ({
    jobs: {},
    jobOrder: [],
    approvals: {},
    guards: DEFAULT_GUARDS.map((guard) => ({ ...guard, blocked: [] })),
    routing: { ...DEFAULT_ROUTING },
    events: [],
    completions: [],
    health: { lastHeartbeat: null, tick: 0, activeJobs: 0 },
});

const patchJob = (state: ControlState, event: AgentEvent, patch: (job: Job) => Partial<Job>): ControlState => {
    const job = event.jobId ? state.jobs[event.jobId] : undefined;
    if (!job) return state;
    return { ...state, jobs: { ...state.jobs, [job.id]: { ...job, ...patch(job) } } };
};

/** A request on a job that failed or restarted can no longer be answered, so it is closed instead of left pending. */
const supersedeApprovals = (state: ControlState, jobId: string | null): ControlState => {
    const stale = Object.values(state.approvals).filter((approval) => approval.jobId === jobId && approval.status === "pending");
    if (stale.length === 0) return state;
    const approvals = { ...state.approvals };
    for (const approval of stale) approvals[approval.id] = { ...approval, status: "superseded" };
    return { ...state, approvals };
};

const applyToJob = (state: ControlState, event: AgentEvent): ControlState => {
    switch (event.type) {
        case "job.status":
            return patchJob(state, event, () => ({ status: event.payload.status }));
        case "plan.posted":
            return patchJob(state, event, () => ({ plan: event.payload.plan }));
        case "approval.requested":
            return {
                ...patchJob(state, event, () => ({ status: "awaiting-approval" })),
                approvals: { ...state.approvals, [event.payload.approval.id]: event.payload.approval },
            };
        case "approval.answered": {
            const approval = state.approvals[event.payload.approvalId];
            if (!approval) return state;
            const answered = { ...approval, status: "answered" as const, answer: { option: event.payload.option, note: event.payload.note, ts: event.ts } };
            return { ...state, approvals: { ...state.approvals, [approval.id]: answered } };
        }
        case "commit.pushed":
            return patchJob(state, event, (job) => ({ commits: [...job.commits, { sha: event.payload.sha, message: event.payload.message, ts: event.ts }] }));
        case "pr.opened":
            return patchJob(state, event, () => ({ pr: { number: event.payload.number, url: event.payload.url } }));
        case "ci.passed":
            return patchJob(state, event, (job) => ({
                ciRuns: [...job.ciRuns, { id: event.payload.runId, status: "passed", check: event.payload.check, detail: "All checks passed", ts: event.ts }],
            }));
        case "ci.failed":
            return patchJob(state, event, (job) => ({
                status: "fixing-ci",
                ciRuns: [...job.ciRuns, { id: event.payload.runId, status: "failed", check: event.payload.check, detail: event.payload.detail, ts: event.ts }],
            }));
        case "ci.fixed":
            return patchJob(state, event, (job) => ({
                ciRuns: [
                    ...job.ciRuns,
                    { id: event.payload.runId, status: "fixed", check: event.payload.check, detail: `Fixed in ${event.payload.sha}`, ts: event.ts },
                ],
            }));
        case "review.finding":
            return patchJob(state, event, (job) => ({
                status: "answering-review",
                findings: [
                    ...job.findings,
                    { id: event.payload.findingId, author: event.payload.author, file: event.payload.file, body: event.payload.body, ts: event.ts },
                ],
            }));
        case "review.replied":
            return patchJob(state, event, (job) => ({
                findings: job.findings.map((finding) => (finding.id === event.payload.findingId ? { ...finding, reply: event.payload.body } : finding)),
            }));
        case "guard.blocked":
            return {
                ...state,
                guards: state.guards.map((guard) =>
                    guard.id === event.payload.guardId
                        ? {
                              ...guard,
                              blocked: [
                                  ...guard.blocked,
                                  { ts: event.ts, jobId: event.jobId ?? "", action: event.payload.action, detail: event.payload.detail },
                              ],
                          }
                        : guard,
                ),
            };
        case "guard.toggled":
            return {
                ...state,
                guards: state.guards.map((guard) => (guard.id === event.payload.guardId ? { ...guard, enabled: event.payload.enabled } : guard)),
            };
        case "routing.updated":
            return { ...state, routing: { ...event.payload.routing } };
        case "job.held":
            return patchJob(state, event, (job) => ({
                status: "on-hold",
                holdReason: event.payload.reason,
                statusBeforeHold: job.status === "on-hold" ? job.statusBeforeHold : job.status,
            }));
        case "job.resumed":
            return patchJob(state, event, (job) => ({ status: job.statusBeforeHold ?? "implementing", holdReason: undefined, statusBeforeHold: undefined }));
        case "job.retried":
            return patchJob(supersedeApprovals(state, event.jobId), event, () => ({
                status: "queued",
                attempts: event.payload.attempt,
                model: event.payload.model,
                plan: undefined,
                failureReason: undefined,
                holdReason: undefined,
                statusBeforeHold: undefined,
            }));
        case "job.done":
            return { ...patchJob(state, event, () => ({ status: "done" })), completions: [...state.completions, event.ts] };
        case "job.failed":
            return patchJob(supersedeApprovals(state, event.jobId), event, () => ({
                status: "failed",
                failureReason: event.payload.reason,
                holdReason: undefined,
            }));
        case "health.heartbeat":
            return { ...state, health: { lastHeartbeat: event.ts, tick: event.payload.tick, activeJobs: event.payload.activeJobs } };
        default:
            return state;
    }
};

/**
 * The single state transition function. Both the simulator and any client that
 * consumes a real event stream fold events through this, so they cannot drift.
 */
export const applyEvent = (state: ControlState, event: AgentEvent): ControlState => {
    if (event.type === "world.snapshot") return event.payload.state;

    let next: ControlState;
    if (event.type === "job.created") {
        const job = event.payload.job;
        next = { ...state, jobs: { ...state.jobs, [job.id]: { ...job, timeline: [] } }, jobOrder: [...state.jobOrder, job.id] };
    } else {
        next = applyToJob(state, event);
    }

    const owner = event.jobId ? next.jobs[event.jobId] : undefined;
    if (owner) {
        next = { ...next, jobs: { ...next.jobs, [owner.id]: { ...owner, timeline: [...owner.timeline, event] } } };
    }
    const events = next.events.length >= MAX_EVENTS ? [...next.events.slice(-(MAX_EVENTS - 1)), event] : [...next.events, event];
    return { ...next, events };
};
