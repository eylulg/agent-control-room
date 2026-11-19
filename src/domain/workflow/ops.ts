import { incomingEdges, nodeIndex, outgoingEdges } from "./graph";
import {
    DEFAULT_CONFIG,
    GRID_STEP,
    NODE_META,
    NODE_TYPES,
    type NodeConfigs,
    type NodeType,
    PORTS,
    type Position,
    type Workflow,
    type WorkflowEdge,
    type WorkflowNode,
} from "./types";

export const edgeId = (nodeId: string, portId: string): string => `${nodeId}:${portId}`;

/** The smallest unused `<type>-<n>` id. Deterministic, so a replayed command history gives the same ids. */
export const nextNodeId = (workflow: Pick<Workflow, "nodes">, type: NodeType): string => {
    const taken = new Set(workflow.nodes.map((node) => node.id));
    for (let n = 1; ; n++) if (!taken.has(`${type}-${n}`)) return `${type}-${n}`;
};

export const createNode = (workflow: Pick<Workflow, "nodes">, type: NodeType, position: Position): WorkflowNode =>
    // Safe: DEFAULT_CONFIG[type] returns the config that belongs to `type`, but TypeScript cannot correlate the two through a variable.
    ({ id: nextNodeId(workflow, type), type, label: NODE_META[type].label, position, config: DEFAULT_CONFIG[type]() }) as WorkflowNode;

export const addNode = (workflow: Workflow, node: WorkflowNode): Workflow => ({ ...workflow, nodes: [...workflow.nodes, node] });

/** Moves nodes by a delta. Nodes that are not in `ids` keep their identity, so memoised views skip them. */
export const moveNodes = (workflow: Workflow, ids: ReadonlySet<string>, dx: number, dy: number): Workflow => ({
    ...workflow,
    nodes: workflow.nodes.map((node) => (ids.has(node.id) ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } } : node)),
});

export const updateNode = (workflow: Workflow, id: string, patch: { label?: string; config?: Partial<NodeConfigs[NodeType]> }): Workflow => ({
    ...workflow,
    nodes: workflow.nodes.map((node) => {
        if (node.id !== id) return node;
        // Safe: the patch config comes from the inspector for this node's own type.
        return { ...node, label: patch.label ?? node.label, config: { ...node.config, ...patch.config } } as WorkflowNode;
    }),
});

/** Where a port may connect. Not the trigger, and a node may only loop to itself through a retry port. */
export const validTargets = (workflow: Workflow, nodeId: string, portId: string): WorkflowNode[] => {
    const source = workflow.nodes.find((node) => node.id === nodeId);
    const port = source && PORTS[source.type].find((p) => p.id === portId);
    if (!source || !port) return [];
    return workflow.nodes.filter((node) => node.type !== "trigger" && (node.id !== nodeId || port.retry));
};

/** Connects an output port to a node. A port has one connection, so this replaces the one it had. */
export const connect = (workflow: Workflow, nodeId: string, portId: string, targetId: string): Workflow => {
    if (!validTargets(workflow, nodeId, portId).some((node) => node.id === targetId)) return workflow;
    const id = edgeId(nodeId, portId);
    const edge: WorkflowEdge = { id, from: { node: nodeId, port: portId }, to: targetId };
    return { ...workflow, edges: [...workflow.edges.filter((existing) => existing.id !== id), edge] };
};

export const disconnect = (workflow: Workflow, edgeIds: ReadonlySet<string>): Workflow => ({
    ...workflow,
    edges: workflow.edges.filter((edge) => !edgeIds.has(edge.id)),
});

export const deleteNodes = (workflow: Workflow, ids: ReadonlySet<string>): Workflow => ({
    ...workflow,
    nodes: workflow.nodes.filter((node) => !ids.has(node.id)),
    edges: workflow.edges.filter((edge) => !ids.has(edge.from.node) && !ids.has(edge.to)),
});

/** Every connection into or out of a node. */
export const edgesOf = (workflow: Workflow, nodeId: string): WorkflowEdge[] => workflow.edges.filter((edge) => edge.from.node === nodeId || edge.to === nodeId);

/**
 * Copies nodes one grid step down and right, with the connections between them. A workflow has one trigger, so triggers are skipped.
 * Returns the new workflow and the ids of the copies.
 */
export const duplicateNodes = (workflow: Workflow, ids: ReadonlySet<string>): { workflow: Workflow; created: string[] } => {
    let next = workflow;
    const mapping = new Map<string, string>();
    for (const node of workflow.nodes) {
        if (!ids.has(node.id) || node.type === "trigger") continue;
        const position = { x: node.position.x + GRID_STEP * 2, y: node.position.y + GRID_STEP * 2 };
        // Safe: a copy keeps the type, so it keeps the matching config.
        const copy = { ...createNode(next, node.type, position), label: node.label, config: structuredClone(node.config) } as WorkflowNode;
        mapping.set(node.id, copy.id);
        next = addNode(next, copy);
    }
    for (const edge of workflow.edges) {
        const from = mapping.get(edge.from.node);
        const to = mapping.get(edge.to);
        if (from && to) next = connect(next, from, edge.from.port, to);
    }
    return { workflow: next, created: [...mapping.values()] };
};

const labelOf = (nodes: Map<string, WorkflowNode>, id: string): string => nodes.get(id)?.label ?? id;

/** The sentence a screen reader hears after a node's name: what it is, what feeds it and where each port goes. */
export const describeNode = (workflow: Workflow, nodeId: string): string => {
    const nodes = nodeIndex(workflow);
    const node = nodes.get(nodeId);
    if (!node) return "";
    const incoming = incomingEdges(workflow).get(nodeId) ?? [];
    const out = outgoingEdges(workflow);
    const feeds =
        incoming.length === 0
            ? node.type === "trigger"
                ? "Starts the workflow."
                : "Nothing connects in."
            : `Receives from ${incoming.map((edge) => labelOf(nodes, edge.from.node)).join(", ")}.`;
    const exits = PORTS[node.type].map((port) => {
        const edge = (out.get(nodeId) ?? []).find((candidate) => candidate.from.port === port.id);
        return edge ? `${port.label} goes to ${labelOf(nodes, edge.to)}.` : `${port.label} is not connected.`;
    });
    return [NODE_META[node.type].label + ".", feeds, ...(exits.length > 0 ? exits : ["Ends the workflow."])].join(" ");
};

export const isNodeType = (value: string): value is NodeType => NODE_TYPES.some((type) => type === value);
