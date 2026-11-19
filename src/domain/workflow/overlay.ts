import { TICK_MS } from "../simulator";
import type { ControlState, Job, JobRun } from "../types";
import type { Workflow } from "./types";

export type NodeRunState = "idle" | "running" | "waiting" | "passed" | "failed" | "skipped";

export interface NodeOverlay {
    state: NodeRunState;
    /** Jobs currently on the node, for the live view. */
    count: number;
    /** Where a traced job entered the node, for the trace view. */
    visits: number[];
}

interface EdgeOverlay {
    /** Times a job took this connection. */
    count: number;
    /** Taken within the last few ticks. */
    recent: boolean;
    /** Part of the traced path. */
    traced: boolean;
}

export interface Overlay {
    nodes: Record<string, NodeOverlay>;
    edges: Record<string, EdgeOverlay>;
}

/** Edges taken this recently count as active. */
const RECENT_MS = 6 * TICK_MS;

const isOpen = (job: Job): boolean => job.status !== "done" && job.status !== "failed";

const parked = (job: Job): boolean => job.status === "awaiting-approval" || job.status === "on-hold";

/**
 * The state of every node for one job's run: where it is, which nodes it passed, and which it never reached.
 * A node is waiting while the job on it waits for an approval or a hold to lift.
 */
export const nodeStates = (workflow: Workflow, run: JobRun | undefined, job: Job | undefined): Record<string, NodeRunState> => {
    const states: Record<string, NodeRunState> = {};
    const visited = new Set(run?.steps.map((step) => step.nodeId));
    const current = run?.steps.at(-1)?.nodeId;
    for (const node of workflow.nodes) {
        if (node.id === current && job) {
            if (job.status === "failed") states[node.id] = "failed";
            else if (job.status === "done") states[node.id] = "passed";
            else states[node.id] = parked(job) ? "waiting" : "running";
        } else if (visited.has(node.id)) {
            states[node.id] = "passed";
        } else {
            states[node.id] = job && !isOpen(job) ? "skipped" : "idle";
        }
    }
    return states;
};

const blank = (): NodeOverlay => ({ state: "idle", count: 0, visits: [] });

/**
 * Jobs on each step, and how busy each connection has been. Jobs from older versions count too, on the steps and connections whose ids
 * still exist, so publishing does not empty the view. Ids that no longer exist are never drawn.
 */
export const liveOverlay = (control: Pick<ControlState, "jobs" | "runs" | "workflows" | "events">): Overlay => {
    const latest = control.workflows.at(-1);
    const overlay: Overlay = { nodes: {}, edges: {} };
    if (!latest) return overlay;
    const now = control.events.at(-1)?.ts ?? 0;
    for (const [jobId, run] of Object.entries(control.runs)) {
        const job = control.jobs[jobId];
        if (!job) continue;
        for (const step of run.steps) {
            if (!step.edgeId) continue;
            const edge = overlay.edges[step.edgeId] ?? { count: 0, recent: false, traced: false };
            overlay.edges[step.edgeId] = { ...edge, count: edge.count + 1, recent: edge.recent || now - step.ts <= RECENT_MS };
        }
        const current = run.steps.at(-1)?.nodeId;
        if (!current || !isOpen(job)) continue;
        const node = overlay.nodes[current] ?? blank();
        const waiting = node.state === "waiting" || parked(job);
        overlay.nodes[current] = { ...node, count: node.count + 1, state: waiting ? "waiting" : "running" };
    }
    return overlay;
};

/** One job's path through a workflow: node states, the times it entered each node and the connections it took. */
export const runOverlay = (workflow: Workflow, run: JobRun | undefined, job: Job | undefined): Overlay => {
    const states = nodeStates(workflow, run, job);
    const overlay: Overlay = { nodes: {}, edges: {} };
    for (const node of workflow.nodes) overlay.nodes[node.id] = { ...blank(), state: states[node.id] ?? "idle" };
    for (const step of run?.steps ?? []) {
        const node = overlay.nodes[step.nodeId];
        if (node) overlay.nodes[step.nodeId] = { ...node, visits: [...node.visits, step.ts] };
        if (step.edgeId) {
            const edge = overlay.edges[step.edgeId] ?? { count: 0, recent: false, traced: true };
            overlay.edges[step.edgeId] = { ...edge, count: edge.count + 1 };
        }
    }
    return overlay;
};
