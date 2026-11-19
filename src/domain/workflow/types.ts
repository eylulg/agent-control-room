import { type GuardAction, JOB_KINDS, type JobKind } from "../types";

export const WORKFLOW_FORMAT_VERSION = 1;

export const NODE_TYPES = ["trigger", "plan", "approval", "implement", "ci", "review", "condition", "wait-dependency", "guard", "mark-ready", "end"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export interface Position {
    x: number;
    y: number;
}

export const CONDITION_FIELDS = ["kind", "repo", "attempt"] as const;
type ConditionField = (typeof CONDITION_FIELDS)[number];
export const CONDITION_OPERATORS = ["equals", "not-equals", "at-least"] as const;
type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const GUARD_NODE_ACTIONS = ["merge", "skip-hooks", "post-as-owner"] as const satisfies readonly GuardAction[];

export interface NodeConfigs {
    trigger: { kinds: JobKind[] };
    plan: Record<string, never>;
    approval: Record<string, never>;
    implement: { mode: "build" | "fix" };
    /** Failures the job may take before it is marked failed. Bounds the fail loop. */
    ci: { maxAttempts: number };
    /** Finding rounds the job may take before it moves on. Bounds the findings loop. */
    review: { maxRounds: number };
    condition: { field: ConditionField; operator: ConditionOperator; value: string };
    "wait-dependency": Record<string, never>;
    guard: { action: (typeof GUARD_NODE_ACTIONS)[number] };
    "mark-ready": Record<string, never>;
    end: { outcome: "done" | "failed" };
}

type NodeOf<T extends NodeType> = { id: string; type: T; label: string; position: Position; config: NodeConfigs[T] };
export type WorkflowNode = { [T in NodeType]: NodeOf<T> }[NodeType];

export interface WorkflowEdge {
    id: string;
    from: { node: string; port: string };
    to: string;
}

export interface Workflow {
    /** Version of the file format, not of a published workflow. */
    version: typeof WORKFLOW_FORMAT_VERSION;
    name: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

export interface PortSpec {
    id: string;
    label: string;
    /** A port whose connection may point back up the graph. Its owner node must bound the loop in its config. */
    retry?: boolean;
}

const NEXT: PortSpec[] = [{ id: "next", label: "Next" }];

export const PORTS: Record<NodeType, readonly PortSpec[]> = {
    trigger: NEXT,
    plan: NEXT,
    approval: NEXT,
    implement: NEXT,
    ci: [
        { id: "pass", label: "Pass" },
        { id: "fail", label: "Fail", retry: true },
    ],
    review: [
        { id: "clean", label: "No findings" },
        { id: "findings", label: "Findings", retry: true },
    ],
    condition: [
        { id: "true", label: "True" },
        { id: "false", label: "False" },
    ],
    "wait-dependency": NEXT,
    guard: NEXT,
    "mark-ready": NEXT,
    end: [],
};

export const NODE_META: Record<NodeType, { label: string; description: string }> = {
    trigger: { label: "Trigger", description: "Starts the workflow for the job kinds it accepts." },
    plan: { label: "Plan", description: "Posts a plan for the ticket." },
    approval: { label: "Approval gate", description: "Stops and asks an operator when the plan is ambiguous." },
    implement: { label: "Implement", description: "Pushes commits and opens the pull request, or fixes what failed." },
    ci: { label: "CI check", description: "Runs checks. A failure leaves through the fail port." },
    review: { label: "Review", description: "Collects review findings. Findings leave through the findings port." },
    condition: { label: "Condition", description: "Branches on job kind, repository or attempt count." },
    "wait-dependency": { label: "Wait for dependency", description: "Holds the job until the pull request it builds on has merged." },
    guard: { label: "Guard check", description: "Runs a guard before an action that needs one." },
    "mark-ready": { label: "Mark ready", description: "Marks the pull request ready for review." },
    end: { label: "End", description: "Finishes the job as done or failed." },
};

export const DEFAULT_CONFIG: { [T in NodeType]: () => NodeConfigs[T] } = {
    trigger: () => ({ kinds: [...JOB_KINDS] }),
    plan: () => ({}),
    approval: () => ({}),
    implement: () => ({ mode: "build" }),
    ci: () => ({ maxAttempts: 3 }),
    review: () => ({ maxRounds: 3 }),
    condition: () => ({ field: "kind", operator: "equals", value: "feature" }),
    "wait-dependency": () => ({}),
    guard: () => ({ action: "merge" }),
    "mark-ready": () => ({}),
    end: () => ({ outcome: "done" }),
};

export const NODE_WIDTH = 224;
export const NODE_HEIGHT = 80;
export const GRID_STEP = 20;

/** Where an output port sits relative to the node's top left corner. Ports are spread along the bottom edge. */
export const portOffset = (type: NodeType, portId: string): Position => {
    const ports = PORTS[type];
    const index = Math.max(
        0,
        ports.findIndex((port) => port.id === portId),
    );
    return { x: (NODE_WIDTH * (index + 1)) / (ports.length + 1), y: NODE_HEIGHT };
};

/** The input sits at the middle of the top edge. */
export const INPUT_OFFSET: Position = { x: NODE_WIDTH / 2, y: 0 };
