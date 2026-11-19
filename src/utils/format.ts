import type { BadgeColor } from "@eylulg/ui/badge";
import type { AgentEvent, JobKind, JobStatus } from "@/domain/types";

export const formatClock = (ts: number): string => {
    const d = new Date(ts);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

export const STATUS_META: Record<JobStatus, { label: string; color: BadgeColor }> = {
    queued: { label: "Queued", color: "gray" },
    planning: { label: "Planning", color: "blue" },
    "awaiting-approval": { label: "Awaiting approval", color: "warning" },
    implementing: { label: "Implementing", color: "brand" },
    "fixing-ci": { label: "Fixing CI", color: "orange" },
    "answering-review": { label: "Answering review", color: "purple" },
    "on-hold": { label: "On hold", color: "pink" },
    "ready-for-review": { label: "Ready for review", color: "indigo" },
    done: { label: "Done", color: "success" },
    failed: { label: "Failed", color: "error" },
};

export const KIND_LABEL: Record<JobKind, string> = {
    feature: "Feature",
    bug: "Bug",
    chore: "Chore",
    "review-fix": "Review fix",
    release: "Release",
};

export type Tone = "neutral" | "good" | "warning" | "critical";

/** One line, human readable description of an event. */
export const describe = (event: AgentEvent): { text: string; tone: Tone } => {
    switch (event.type) {
        case "world.snapshot":
            return { text: "Connected to the agent", tone: "neutral" };
        case "job.created":
            return { text: `Picked up ${event.payload.job.ticket.id}: ${event.payload.job.ticket.title}`, tone: "neutral" };
        case "job.status":
            return { text: `Status changed to ${STATUS_META[event.payload.status].label.toLowerCase()}`, tone: "neutral" };
        case "plan.posted":
            return { text: "Posted a plan", tone: "neutral" };
        case "approval.requested":
            return { text: `Asked for approval: ${event.payload.approval.question}`, tone: "warning" };
        case "approval.answered":
            return { text: `Approval answered with option ${event.payload.option}${event.payload.note ? ` (${event.payload.note})` : ""}`, tone: "good" };
        case "commit.pushed":
            return { text: `Pushed ${event.payload.sha}: ${event.payload.message}`, tone: "neutral" };
        case "pr.opened":
            return { text: `Opened pull request #${event.payload.number}`, tone: "neutral" };
        case "ci.passed":
            return { text: "CI passed", tone: "good" };
        case "ci.failed":
            return { text: `CI failed on ${event.payload.check}: ${event.payload.detail}`, tone: "critical" };
        case "ci.fixed":
            return { text: `CI fixed on ${event.payload.check} in ${event.payload.sha}`, tone: "good" };
        case "review.finding":
            return { text: `Review finding from ${event.payload.author} on ${event.payload.file}`, tone: "warning" };
        case "review.replied":
            return { text: "Replied to a review finding", tone: "neutral" };
        case "guard.blocked":
            return { text: `Guard blocked: ${event.payload.detail}`, tone: "critical" };
        case "guard.allowed":
            return { text: `Guard off, allowed: ${event.payload.detail}`, tone: "warning" };
        case "guard.toggled":
            return { text: `Guard ${event.payload.guardId} switched ${event.payload.enabled ? "on" : "off"}`, tone: "neutral" };
        case "routing.updated":
            return { text: "Routing table updated", tone: "neutral" };
        case "job.held":
            return { text: `On hold (${event.payload.by}): ${event.payload.reason}`, tone: "warning" };
        case "job.resumed":
            return { text: `Resumed by ${event.payload.by}`, tone: "good" };
        case "job.retried":
            return { text: `Retry ${event.payload.attempt} queued on ${event.payload.model}`, tone: "neutral" };
        case "job.done":
            return { text: event.payload.prNumber ? `PR #${event.payload.prNumber} merged by a human, job done` : "Job done", tone: "good" };
        case "job.failed":
            return { text: `Failed: ${event.payload.reason}`, tone: "critical" };
        case "job.node":
            return { text: "Moved to the next workflow step", tone: "neutral" };
        case "workflow.published":
            return { text: `Published workflow version ${event.payload.revision}`, tone: "good" };
        case "health.heartbeat":
            return { text: `Heartbeat: ${event.payload.activeJobs} active, ${event.payload.queueDepth} queued`, tone: "neutral" };
    }
};
