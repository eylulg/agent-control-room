import { connect, createNode } from './ops';
import { NODE_HEIGHT, NODE_WIDTH, WORKFLOW_FORMAT_VERSION, type Workflow } from './types';

const COLUMNS = 20;

/**
 * A valid workflow of about `size` nodes for measuring the canvas: a chain of blocks, each a plan, an implement step and a CI check with a fix step.
 * Nodes sit on a grid so that most of them are on screen at once.
 */
export const generateWorkflow = (size: number): Workflow => {
  let workflow: Workflow = {
    version: WORKFLOW_FORMAT_VERSION,
    name: `Generated, ${size} nodes`,
    nodes: [],
    edges: [],
  };
  const add = (type: Parameters<typeof createNode>[1]) => {
    const node = createNode(workflow, type, { x: 0, y: 0 });
    workflow = { ...workflow, nodes: [...workflow.nodes, node] };
    return node.id;
  };

  let previous: { id: string; port: string } = { id: add('trigger'), port: 'next' };
  const blocks = Math.max(1, Math.floor((size - 2) / 4));
  for (let i = 0; i < blocks; i++) {
    const plan = add('plan');
    const build = add('implement');
    const ci = add('ci');
    const fix = add('implement');
    workflow = connect(workflow, previous.id, previous.port, plan);
    workflow = connect(workflow, plan, 'next', build);
    workflow = connect(workflow, build, 'next', ci);
    workflow = connect(workflow, ci, 'fail', fix);
    workflow = connect(workflow, fix, 'next', ci);
    previous = { id: ci, port: 'pass' };
  }
  const end = add('end');
  workflow = connect(workflow, previous.id, previous.port, end);

  return {
    ...workflow,
    nodes: workflow.nodes.map((node, i) => ({
      ...node,
      position: {
        x: (i % COLUMNS) * (NODE_WIDTH + 60),
        y: Math.floor(i / COLUMNS) * (NODE_HEIGHT + 60),
      },
    })),
  };
};
