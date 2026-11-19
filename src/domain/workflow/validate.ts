import { JOB_KINDS } from "../types";
import { canReachEnd, findCycles, findDuplicates, nodeIndex, reachableFrom } from "./graph";
import { NODE_META, PORTS, type Workflow, type WorkflowNode } from "./types";

export interface Problem {
    id: string;
    message: string;
    nodeId?: string;
    edgeId?: string;
}

export type ConfigErrors = Record<string, string>;

const MAX_LABEL = 40;
const MAX_ATTEMPTS = 10;

const wholeNumber = (value: number, min: number, max: number): boolean => Number.isInteger(value) && value >= min && value <= max;

/** Field level errors for one node, keyed by field name. The inspector shows them next to the field. */
export const configErrors = (node: WorkflowNode): ConfigErrors => {
    const errors: ConfigErrors = {};
    if (!node.label.trim()) errors.label = "Enter a label.";
    else if (node.label.length > MAX_LABEL) errors.label = `Use ${MAX_LABEL} characters or fewer.`;

    switch (node.type) {
        case "trigger":
            if (node.config.kinds.length === 0) errors.kinds = "Choose at least one job kind.";
            break;
        case "ci":
            if (!wholeNumber(node.config.maxAttempts, 1, MAX_ATTEMPTS)) errors.maxAttempts = `Enter a whole number from 1 to ${MAX_ATTEMPTS}.`;
            break;
        case "review":
            if (!wholeNumber(node.config.maxRounds, 1, MAX_ATTEMPTS)) errors.maxRounds = `Enter a whole number from 1 to ${MAX_ATTEMPTS}.`;
            break;
        case "condition": {
            const { field, operator, value } = node.config;
            if (field === "attempt") {
                if (operator !== "at-least") errors.operator = "Attempt count can only be compared with at least.";
                if (!wholeNumber(Number(value), 1, 99)) errors.value = "Enter a whole number from 1 to 99.";
            } else if (operator === "at-least") {
                errors.operator = "At least only works with the attempt count.";
            } else if (field === "kind" && !JOB_KINDS.some((kind) => kind === value)) {
                errors.value = "Choose a job kind.";
            } else if (field === "repo" && !value.trim()) {
                errors.value = "Enter a repository, such as acme/web.";
            }
            break;
        }
        default:
            break;
    }
    return errors;
};

const name = (node: WorkflowNode): string => `"${node.label.trim() || NODE_META[node.type].label}"`;

/** Everything that stops a workflow from being published. An empty list means it can run. */
export const validateWorkflow = (workflow: Workflow): Problem[] => {
    const problems: Problem[] = [];
    const nodes = nodeIndex(workflow);
    const add = (problem: Omit<Problem, "id">) => problems.push({ ...problem, id: `${problems.length}` });

    const duplicates = findDuplicates(workflow);
    for (const id of duplicates.nodeIds) add({ nodeId: id, message: `Two steps share the id ${id}. Delete one of them.` });
    for (const id of duplicates.edgeIds) add({ edgeId: id, message: `Two connections share the id ${id}. Delete one of them.` });

    const triggers = workflow.nodes.filter((node) => node.type === "trigger");
    if (triggers.length === 0) add({ message: "Add a trigger. A workflow needs exactly one." });
    for (const extra of triggers.slice(1)) add({ nodeId: extra.id, message: `${name(extra)} is a second trigger. Delete it, a workflow has exactly one.` });

    const seen = new Set<string>();
    const usedPorts = new Set<string>();
    for (const edge of workflow.edges) {
        const source = nodes.get(edge.from.node);
        const key = `${edge.from.node}/${edge.from.port}/${edge.to}`;
        if (!source || !nodes.has(edge.to)) add({ edgeId: edge.id, message: "A connection points at a step that no longer exists. Delete it." });
        else if (!PORTS[source.type].some((port) => port.id === edge.from.port))
            add({ edgeId: edge.id, nodeId: source.id, message: `${name(source)} has no port called ${edge.from.port}.` });
        else if (edge.to === triggers[0]?.id)
            add({ edgeId: edge.id, nodeId: source.id, message: `Nothing may connect into the trigger. Disconnect ${name(source)}.` });
        const port = `${edge.from.node}/${edge.from.port}`;
        if (seen.has(key)) add({ edgeId: edge.id, message: "Two connections are identical. Delete one of them." });
        else if (usedPorts.has(port) && source) {
            const label = PORTS[source.type].find((candidate) => candidate.id === edge.from.port)?.label ?? edge.from.port;
            add({
                edgeId: edge.id,
                nodeId: source.id,
                message: `${name(source)} has two connections on its ${label} port. A port leads to one step. Delete one.`,
            });
        }
        seen.add(key);
        usedPorts.add(port);
    }

    const connected = new Set(workflow.edges.map((edge) => `${edge.from.node}/${edge.from.port}`));
    for (const node of workflow.nodes) {
        for (const port of PORTS[node.type]) {
            if (!connected.has(`${node.id}/${port.id}`))
                add({ nodeId: node.id, message: `${name(node)} has nothing connected to its ${port.label} port. Connect it to a step.` });
        }
        for (const message of Object.values(configErrors(node))) add({ nodeId: node.id, message: `${name(node)}: ${message}` });
    }

    const trigger = triggers[0];
    if (trigger) {
        const reachable = reachableFrom(workflow, [trigger.id]);
        for (const node of workflow.nodes) {
            if (!reachable.has(node.id)) add({ nodeId: node.id, message: `${name(node)} cannot be reached from the trigger. Connect it, or delete it.` });
        }
    }

    const reachesEnd = canReachEnd(workflow);
    for (const node of workflow.nodes) {
        if (node.type !== "end" && !reachesEnd.has(node.id))
            add({ nodeId: node.id, message: `A job at ${name(node)} never reaches an end. Connect a path to an End step.` });
    }

    for (const cycle of findCycles(workflow, { ignoreRetry: true })) {
        const first = cycle[0];
        const labels = cycle
            .flatMap((id) => nodes.get(id) ?? [])
            .map(name)
            .join(", ");
        add({
            nodeId: first,
            message: `These steps loop with no limit: ${labels}. A loop must pass through a CI check's Fail port or a review's Findings port.`,
        });
    }

    return problems;
};
