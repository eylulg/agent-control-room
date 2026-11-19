import { z } from "zod/mini";
import { type AgentEvent, type ControlState, EVENT_TYPES, JOB_KINDS, JOB_STATUSES, type Job, type OperatorCommand } from "./types";
import { workflowSchema } from "./workflow/schema";

const jobStatus = z.enum(JOB_STATUSES);
const jobKind = z.enum(JOB_KINDS);
const optionKey = z.enum(["A", "B"]);
const guardAction = z.enum(["merge", "mark-ready", "skip-hooks", "post-as-owner"]);
const actor = z.enum(["agent", "operator"]);
const routingTable = z.object({ feature: z.string(), bug: z.string(), chore: z.string(), "review-fix": z.string(), release: z.string() });

const approvalOption = z.object({ label: z.string(), description: z.string() });
const approval = z.object({
    id: z.string(),
    jobId: z.string(),
    question: z.string(),
    options: z.object({ A: approvalOption, B: approvalOption }),
    recommended: optionKey,
    reason: z.string(),
    status: z.enum(["pending", "answered", "superseded"]),
    answer: z.optional(z.object({ option: optionKey, note: z.optional(z.string()), ts: z.number() })),
    createdAt: z.number(),
});

const guard = z.object({
    id: z.string(),
    action: guardAction,
    rule: z.string(),
    description: z.string(),
    enabled: z.boolean(),
    blocked: z.array(z.object({ ts: z.number(), jobId: z.string(), action: guardAction, detail: z.string() })),
});

const envelope = { seq: z.int(), ts: z.number(), jobId: z.nullable(z.string()) };

// Events are recursive (a snapshot holds jobs, a job holds its timeline), so the
// job and state schemas refer to the event schema lazily.
const job: z.ZodMiniType<Job> = z.lazy(() =>
    z.object({
        id: z.string(),
        ticket: z.object({ id: z.string(), title: z.string(), repo: z.string() }),
        kind: jobKind,
        status: jobStatus,
        model: z.string(),
        attempts: z.int(),
        createdAt: z.number(),
        timeline: z.array(agentEvent),
        plan: z.optional(z.string()),
        pr: z.optional(z.object({ number: z.int(), url: z.string() })),
        holdReason: z.optional(z.string()),
        statusBeforeHold: z.optional(jobStatus),
        dependsOn: z.optional(z.string()),
        commits: z.array(z.object({ sha: z.string(), message: z.string(), ts: z.number() })),
        ciRuns: z.array(z.object({ id: z.string(), status: z.enum(["passed", "failed", "fixed"]), check: z.string(), detail: z.string(), ts: z.number() })),
        findings: z.array(z.object({ id: z.string(), author: z.string(), file: z.string(), body: z.string(), ts: z.number(), reply: z.optional(z.string()) })),
        failureReason: z.optional(z.string()),
    }),
);

const controlState: z.ZodMiniType<ControlState> = z.lazy(() =>
    z.object({
        jobs: z.record(z.string(), job),
        jobOrder: z.array(z.string()),
        approvals: z.record(z.string(), approval),
        guards: z.array(guard),
        routing: routingTable,
        events: z.array(agentEvent),
        completions: z.array(z.number()),
        health: z.object({ lastHeartbeat: z.nullable(z.number()), tick: z.number(), activeJobs: z.number() }),
        workflows: z.array(z.object({ revision: z.int(), publishedAt: z.number(), workflow: workflowSchema })),
        runs: z.record(
            z.string(),
            z.object({ revision: z.int(), steps: z.array(z.object({ nodeId: z.string(), edgeId: z.nullable(z.string()), ts: z.number() })) }),
        ),
    }),
);

const event = <T extends (typeof EVENT_TYPES)[number], P extends z.ZodMiniType>(type: T, payload: P) =>
    z.object({ ...envelope, type: z.literal(type), payload });

const agentEvent: z.ZodMiniType<AgentEvent> = z.lazy(() =>
    z.discriminatedUnion("type", [
        event("world.snapshot", z.object({ state: controlState })),
        event("job.created", z.object({ job })),
        event("job.status", z.object({ status: jobStatus })),
        event("plan.posted", z.object({ plan: z.string() })),
        event("approval.requested", z.object({ approval })),
        event("approval.answered", z.object({ approvalId: z.string(), option: optionKey, note: z.optional(z.string()) })),
        event("commit.pushed", z.object({ sha: z.string(), message: z.string() })),
        event("pr.opened", z.object({ number: z.int(), url: z.string() })),
        event("ci.passed", z.object({ runId: z.string(), check: z.string() })),
        event("ci.failed", z.object({ runId: z.string(), check: z.string(), detail: z.string() })),
        event("ci.fixed", z.object({ runId: z.string(), check: z.string(), sha: z.string() })),
        event("review.finding", z.object({ findingId: z.string(), author: z.string(), file: z.string(), body: z.string() })),
        event("review.replied", z.object({ findingId: z.string(), body: z.string() })),
        event("guard.blocked", z.object({ guardId: z.string(), action: guardAction, detail: z.string() })),
        event("guard.allowed", z.object({ guardId: z.string(), action: guardAction, detail: z.string() })),
        event("guard.toggled", z.object({ guardId: z.string(), enabled: z.boolean() })),
        event("routing.updated", z.object({ routing: routingTable })),
        event("job.held", z.object({ reason: z.string(), by: actor })),
        event("job.resumed", z.object({ by: actor })),
        event("job.retried", z.object({ attempt: z.int(), model: z.string() })),
        event("job.done", z.object({ prNumber: z.optional(z.int()) })),
        event("job.failed", z.object({ reason: z.string(), cancelled: z.optional(z.boolean()) })),
        event("job.node", z.object({ nodeId: z.string(), edgeId: z.nullable(z.string()), revision: z.int() })),
        event("workflow.published", z.object({ revision: z.int(), workflow: workflowSchema })),
        event("health.heartbeat", z.object({ tick: z.number(), activeJobs: z.number(), queueDepth: z.number() })),
    ]),
);

/** Parses one SSE `data` string. Returns null for malformed JSON or an unknown or invalid event, which the client then ignores. */
export const parseAgentEventData = (data: string): AgentEvent | null => {
    let json: unknown;
    try {
        json = JSON.parse(data);
    } catch {
        return null;
    }
    const result = agentEvent.safeParse(json);
    return result.success ? result.data : null;
};

export const operatorCommand: z.ZodMiniType<OperatorCommand> = z.discriminatedUnion("type", [
    z.object({ type: z.literal("approval.answer"), approvalId: z.string(), option: optionKey, note: z.optional(z.string()) }),
    z.object({ type: z.literal("job.hold"), jobId: z.string(), reason: z.string() }),
    z.object({ type: z.literal("job.resume"), jobId: z.string() }),
    z.object({ type: z.literal("job.cancel"), jobId: z.string() }),
    z.object({ type: z.literal("job.retry"), jobId: z.string() }),
    z.object({ type: z.literal("routing.set"), routing: routingTable }),
    z.object({ type: z.literal("guard.toggle"), guardId: z.string(), enabled: z.boolean() }),
    z.object({ type: z.literal("workflow.publish"), workflow: workflowSchema }),
]);
