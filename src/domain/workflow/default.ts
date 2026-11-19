import { JOB_KINDS } from "../types";
import { autoLayout } from "./layout";
import { WORKFLOW_FORMAT_VERSION, type Workflow, type WorkflowEdge, type WorkflowNode } from "./types";

const at = { x: 0, y: 0 };

const nodes: WorkflowNode[] = [
    { id: "trigger", type: "trigger", label: "Ticket arrives", position: at, config: { kinds: [...JOB_KINDS] } },
    { id: "plan", type: "plan", label: "Plan", position: at, config: {} },
    { id: "approval", type: "approval", label: "Ask when unclear", position: at, config: {} },
    { id: "build", type: "implement", label: "Implement", position: at, config: { mode: "build" } },
    { id: "ci", type: "ci", label: "Run CI", position: at, config: { maxAttempts: 3 } },
    { id: "ci-fix", type: "implement", label: "Fix CI", position: at, config: { mode: "fix" } },
    { id: "review", type: "review", label: "Review", position: at, config: { maxRounds: 3 } },
    { id: "review-fix", type: "implement", label: "Address findings", position: at, config: { mode: "fix" } },
    { id: "dependency", type: "wait-dependency", label: "Wait for base PR", position: at, config: {} },
    { id: "ready", type: "mark-ready", label: "Mark ready", position: at, config: {} },
    { id: "merge-guard", type: "guard", label: "Merge guard", position: at, config: { action: "merge" } },
    { id: "done", type: "end", label: "Done", position: at, config: { outcome: "done" } },
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
export const DEFAULT_WORKFLOW: Workflow = autoLayout({ version: WORKFLOW_FORMAT_VERSION, name: "Ticket to pull request", nodes, edges });
