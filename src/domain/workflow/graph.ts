import { PORTS, type Workflow, type WorkflowEdge, type WorkflowNode } from "./types";

type Graph = Pick<Workflow, "nodes" | "edges">;

const portIndex = (node: WorkflowNode | undefined, portId: string): number => (node ? PORTS[node.type].findIndex((port) => port.id === portId) : -1);

const byPosition = (a: WorkflowNode, b: WorkflowNode): number => a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id);

export const nodeIndex = (workflow: Graph): Map<string, WorkflowNode> => new Map(workflow.nodes.map((node) => [node.id, node]));

/** Edges grouped by source node, in port order. */
export const outgoingEdges = (workflow: Graph): Map<string, WorkflowEdge[]> => {
    const nodes = nodeIndex(workflow);
    const out = new Map<string, WorkflowEdge[]>();
    for (const edge of workflow.edges) out.set(edge.from.node, [...(out.get(edge.from.node) ?? []), edge]);
    for (const edges of out.values()) edges.sort((a, b) => portIndex(nodes.get(a.from.node), a.from.port) - portIndex(nodes.get(b.from.node), b.from.port));
    return out;
};

export const incomingEdges = (workflow: Graph): Map<string, WorkflowEdge[]> => {
    const incoming = new Map<string, WorkflowEdge[]>();
    for (const edge of workflow.edges) incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
    return incoming;
};

const isRetryEdge = (edge: WorkflowEdge, nodes: Map<string, WorkflowNode>): boolean => {
    const node = nodes.get(edge.from.node);
    return node ? (PORTS[node.type].find((port) => port.id === edge.from.port)?.retry ?? false) : false;
};

/** Ids of every node reachable by following edges from the start nodes, start nodes included. */
export const reachableFrom = (workflow: Graph, startIds: readonly string[]): Set<string> => {
    const out = outgoingEdges(workflow);
    const seen = new Set<string>();
    const stack = [...startIds];
    for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
        if (seen.has(id)) continue;
        seen.add(id);
        for (const edge of out.get(id) ?? []) stack.push(edge.to);
    }
    return seen;
};

/** Ids of every node with at least one path to an end node, end nodes included. */
export const canReachEnd = (workflow: Graph): Set<string> => {
    const incoming = incomingEdges(workflow);
    const seen = new Set<string>();
    const stack = workflow.nodes.filter((node) => node.type === "end").map((node) => node.id);
    for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
        if (seen.has(id)) continue;
        seen.add(id);
        for (const edge of incoming.get(id) ?? []) stack.push(edge.from.node);
    }
    return seen;
};

/**
 * Edges that point back up the graph: the ones a depth first walk from the trigger
 * (then from any other node, top left first) meets while their target is still open.
 * Removing them leaves an acyclic graph, which layout and focus order rely on.
 */
export const findBackEdges = (workflow: Graph): Set<string> => {
    const out = outgoingEdges(workflow);
    const roots = [...workflow.nodes].sort((a, b) => Number(b.type === "trigger") - Number(a.type === "trigger") || byPosition(a, b));
    const state = new Map<string, "open" | "closed">();
    const back = new Set<string>();

    const visit = (start: string) => {
        const stack: { id: string; rest: WorkflowEdge[] }[] = [{ id: start, rest: [...(out.get(start) ?? [])] }];
        state.set(start, "open");
        for (let frame = stack.at(-1); frame; frame = stack.at(-1)) {
            const edge = frame.rest.shift();
            if (!edge) {
                state.set(frame.id, "closed");
                stack.pop();
                continue;
            }
            const status = state.get(edge.to);
            if (status === "open") back.add(edge.id);
            else if (status === undefined) {
                state.set(edge.to, "open");
                stack.push({ id: edge.to, rest: [...(out.get(edge.to) ?? [])] });
            }
        }
    };

    for (const root of roots) if (!state.has(root.id)) visit(root.id);
    return back;
};

/**
 * Groups of nodes that loop back on themselves. With `ignoreRetry`, edges leaving a retry port
 * are skipped, so what is left is a loop nothing bounds. Uses Tarjan's strongly connected components.
 */
export const findCycles = (workflow: Graph, { ignoreRetry = false }: { ignoreRetry?: boolean } = {}): string[][] => {
    const nodes = nodeIndex(workflow);
    const edges = workflow.edges.filter((edge) => nodes.has(edge.to) && nodes.has(edge.from.node) && !(ignoreRetry && isRetryEdge(edge, nodes)));
    const out = new Map<string, string[]>();
    for (const edge of edges) out.set(edge.from.node, [...(out.get(edge.from.node) ?? []), edge.to]);

    let counter = 0;
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];

    const connect = (id: string) => {
        index.set(id, counter);
        low.set(id, counter);
        counter += 1;
        stack.push(id);
        onStack.add(id);
        for (const next of out.get(id) ?? []) {
            if (!index.has(next)) {
                connect(next);
                low.set(id, Math.min(low.get(id) ?? 0, low.get(next) ?? 0));
            } else if (onStack.has(next)) {
                low.set(id, Math.min(low.get(id) ?? 0, index.get(next) ?? 0));
            }
        }
        if (low.get(id) !== index.get(id)) return;
        const group: string[] = [];
        for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
            onStack.delete(top);
            group.push(top);
            if (top === id) break;
        }
        if (group.length > 1 || (out.get(id) ?? []).includes(id)) cycles.push(group.reverse());
    };

    for (const node of workflow.nodes) if (!index.has(node.id)) connect(node.id);
    return cycles;
};

/**
 * Node ids in the order a job would meet them: the trigger first, then every node after the
 * nodes that feed it, ignoring back edges. Ties go to the node higher and further left.
 * Nodes that are not connected to anything still appear, so keyboard users can reach them.
 */
export const topologicalOrder = (workflow: Graph): string[] => {
    const back = findBackEdges(workflow);
    const nodes = nodeIndex(workflow);
    const forward = workflow.edges.filter((edge) => !back.has(edge.id) && nodes.has(edge.to) && nodes.has(edge.from.node));
    const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
    const next = new Map<string, string[]>();
    for (const edge of forward) {
        indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
        next.set(edge.from.node, [...(next.get(edge.from.node) ?? []), edge.to]);
    }

    const ready = workflow.nodes.filter((node) => indegree.get(node.id) === 0).sort(byPosition);
    const rank = (node: WorkflowNode) => Number(node.type !== "trigger");
    const order: string[] = [];
    while (ready.length > 0) {
        ready.sort((a, b) => rank(a) - rank(b) || byPosition(a, b));
        const node = ready.shift();
        if (!node) break;
        order.push(node.id);
        for (const id of next.get(node.id) ?? []) {
            const left = (indegree.get(id) ?? 0) - 1;
            indegree.set(id, left);
            const target = nodes.get(id);
            if (left === 0 && target) ready.push(target);
        }
    }
    return order;
};
