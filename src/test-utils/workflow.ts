import { DEFAULT_WORKFLOW } from "@/domain/workflow/default";
import { connect, createNode, deleteNodes } from "@/domain/workflow/ops";
import type { NodeType, Workflow } from "@/domain/workflow/types";

export const defaultWorkflow = (): Workflow => structuredClone(DEFAULT_WORKFLOW);

/** The default workflow with one node removed. */
export const without = (id: string): Workflow => deleteNodes(defaultWorkflow(), new Set([id]));

/** The default workflow plus an extra node, optionally connected from an existing port. */
export const withNode = (type: NodeType, from?: { node: string; port: string }): { workflow: Workflow; id: string } => {
    const base = defaultWorkflow();
    const node = createNode(base, type, { x: 0, y: 0 });
    const workflow = { ...base, nodes: [...base.nodes, node] };
    return { id: node.id, workflow: from ? connect(workflow, from.node, from.port, node.id) : workflow };
};
