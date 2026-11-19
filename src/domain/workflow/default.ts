import { JOB_KINDS } from "../types";
import { WORKFLOW_FORMAT_VERSION, type Workflow, type WorkflowEdge, type WorkflowNode } from "./types";

/**
 * Three columns read top to bottom, with each loop's repair step set a little to the right of the check it repairs, so the straight
 * chains stay straight and only the change of column and the two loops go around. The graph is about 880 by 470 units, so it opens
 * fully visible on a laptop canvas at a zoom where text reads. A layered layout would be ten rows tall.
 */
const ROW = 130;
const at = (x: number, row: number) => ({ x, y: row * ROW });
const MAIN = 0;
const CHECK = 270;
const REPAIR = 390;
const LAST = 660;

const nodes: WorkflowNode[] = [
    { id: "trigger", type: "trigger", label: "Ticket arrives", position: at(MAIN, 0), config: { kinds: [...JOB_KINDS] } },
    { id: "plan", type: "plan", label: "Plan", position: at(MAIN, 1), config: {} },
    { id: "approval", type: "approval", label: "Ask when unclear", position: at(MAIN, 2), config: {} },
    { id: "build", type: "implement", label: "Implement", position: at(MAIN, 3), config: { mode: "build" } },
    { id: "ci", type: "ci", label: "Run CI", position: at(CHECK, 0), config: { maxAttempts: 3 } },
    { id: "ci-fix", type: "implement", label: "Fix CI", position: at(REPAIR, 1), config: { mode: "fix" } },
    { id: "review", type: "review", label: "Review", position: at(CHECK, 2), config: { maxRounds: 3 } },
    { id: "review-fix", type: "implement", label: "Address findings", position: at(REPAIR, 3), config: { mode: "fix" } },
    { id: "dependency", type: "wait-dependency", label: "Wait for base PR", position: at(LAST, 0), config: {} },
    { id: "ready", type: "mark-ready", label: "Mark ready", position: at(LAST, 1), config: {} },
    { id: "merge-guard", type: "guard", label: "Merge guard", position: at(LAST, 2), config: { action: "merge" } },
    { id: "done", type: "end", label: "Done", position: at(LAST, 3), config: { outcome: "done" } },
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
