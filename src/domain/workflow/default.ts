import { JOB_KINDS } from "../types";
import { WORKFLOW_FORMAT_VERSION, type Workflow, type WorkflowEdge, type WorkflowNode } from "./types";

/**
 * Four rows by three columns, read top to bottom and then left to right, with the two loops beside the step they repeat.
 * The whole graph is about 760 by 470 units, so it opens fully visible on a laptop canvas at a zoom where text reads.
 * A layered layout would run ten columns wide.
 */
const COLUMN = 270;
const ROW = 130;
const at = (column: number, row: number) => ({ x: column * COLUMN, y: row * ROW });

const nodes: WorkflowNode[] = [
    { id: "trigger", type: "trigger", label: "Ticket arrives", position: at(0, 0), config: { kinds: [...JOB_KINDS] } },
    { id: "plan", type: "plan", label: "Plan", position: at(0, 1), config: {} },
    { id: "approval", type: "approval", label: "Ask when unclear", position: at(0, 2), config: {} },
    { id: "build", type: "implement", label: "Implement", position: at(0, 3), config: { mode: "build" } },
    { id: "ci", type: "ci", label: "Run CI", position: at(1, 1), config: { maxAttempts: 3 } },
    { id: "ci-fix", type: "implement", label: "Fix CI", position: at(1, 0), config: { mode: "fix" } },
    { id: "review", type: "review", label: "Review", position: at(1, 2), config: { maxRounds: 3 } },
    { id: "review-fix", type: "implement", label: "Address findings", position: at(1, 3), config: { mode: "fix" } },
    { id: "dependency", type: "wait-dependency", label: "Wait for base PR", position: at(2, 0), config: {} },
    { id: "ready", type: "mark-ready", label: "Mark ready", position: at(2, 1), config: {} },
    { id: "merge-guard", type: "guard", label: "Merge guard", position: at(2, 2), config: { action: "merge" } },
    { id: "done", type: "end", label: "Done", position: at(2, 3), config: { outcome: "done" } },
];

const link = (node: string, port: string, to: string): WorkflowEdge => ({ id: `${node}:${port}`, from: { node, port }, to });

const edges: WorkflowEdge[] = [
    link("trigger", "next", "plan"),
    link("plan", "next", "approval"),
    link("approval", "next", "build"),
    link("build", "next", "ci"),
    link("ci", "pass", "review"),
    link("ci", "fail", "ci-fix"),
    link("ci-fix", "next", "ci"),
    link("review", "clean", "dependency"),
    link("review", "findings", "review-fix"),
    link("review-fix", "next", "review"),
    link("dependency", "next", "ready"),
    link("ready", "next", "merge-guard"),
    link("merge-guard", "next", "done"),
];

/** The workflow the simulator ran before workflows were data. Publishing it again changes nothing. */
export const DEFAULT_WORKFLOW: Workflow = { version: WORKFLOW_FORMAT_VERSION, name: "Ticket to pull request", nodes, edges };
