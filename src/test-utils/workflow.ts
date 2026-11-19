import { DEFAULT_WORKFLOW } from '@/domain/workflow/default';
import { connect, createNode, deleteNodes } from '@/domain/workflow/ops';
import type { NodeType, Workflow, WorkflowNode } from '@/domain/workflow/types';

export const defaultWorkflow = (): Workflow => structuredClone(DEFAULT_WORKFLOW);

/** The default workflow with one node removed. */
export const without = (id: string): Workflow => deleteNodes(defaultWorkflow(), new Set([id]));

/** The default workflow plus an extra node, optionally connected from an existing port. */
export const withNode = (
  type: NodeType,
  from?: { node: string; port: string },
): { workflow: Workflow; id: string } => {
  const base = defaultWorkflow();
  const node = createNode(base, type, { x: 0, y: 0 });
  const workflow = { ...base, nodes: [...base.nodes, node] };
  return {
    id: node.id,
    workflow: from ? connect(workflow, from.node, from.port, node.id) : workflow,
  };
};

/** A trigger, `length` plan steps in a row, and an end. Every step is connected, so it validates. */
export const chainOf = (length: number): Workflow => {
  const base = defaultWorkflow();
  const trigger = base.nodes.find((node) => node.type === 'trigger');
  const end = base.nodes.find((node) => node.type === 'end');
  if (!trigger || !end) throw new Error('The default workflow lost its trigger or end');
  const plans = Array.from({ length }, (_, i): WorkflowNode => ({
    id: `chain-${i}`,
    type: 'plan',
    label: `Plan ${i + 1}`,
    position: { x: i * 20, y: 0 },
    config: {},
  }));
  const ids = [trigger.id, ...plans.map((node) => node.id), end.id];
  const edges = ids
    .slice(1)
    .map((to, i) => ({ id: `link-${i}`, from: { node: ids[i] ?? '', port: 'next' }, to }));
  return { ...base, nodes: [trigger, ...plans, end], edges };
};
