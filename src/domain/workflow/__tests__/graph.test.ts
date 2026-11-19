import { describe, expect, it } from 'vitest';
import { defaultWorkflow, withNode, without } from '@/test-utils/workflow';
import { canReachEnd, findBackEdges, findCycles, reachableFrom, topologicalOrder } from '../graph';
import { connect, disconnect } from '../ops';

describe('reachability', () => {
  it('reaches every node of the default workflow from the trigger', () => {
    const workflow = defaultWorkflow();

    expect(reachableFrom(workflow, ['trigger']).size).toBe(workflow.nodes.length);
  });

  it('does not reach a step whose only connection was removed', () => {
    const workflow = disconnect(defaultWorkflow(), new Set(['plan:next']));

    expect(reachableFrom(workflow, ['trigger'])).toEqual(new Set(['trigger', 'plan']));
  });

  it('finds the nodes that lead to an end', () => {
    const workflow = without('done');

    expect(canReachEnd(workflow).size).toBe(0);
  });
});

describe('cycles', () => {
  it('finds the loops through the fail and findings ports, and none once those ports are ignored', () => {
    const workflow = defaultWorkflow();

    expect(findCycles(workflow).map((cycle) => [...cycle].sort())).toEqual(
      expect.arrayContaining([
        ['ci', 'ci-fix'],
        ['review', 'review-fix'],
      ]),
    );
    expect(findCycles(workflow, { ignoreRetry: true })).toEqual([]);
  });

  it('reports a loop on a plain port as unbounded', () => {
    const workflow = connect(defaultWorkflow(), 'ready', 'next', 'plan');
    const loops = findCycles(workflow, { ignoreRetry: true });

    expect(loops).toHaveLength(1);
    expect(loops[0]).toEqual(expect.arrayContaining(['plan', 'build', 'ci', 'review', 'ready']));
  });

  it('reports a node that connects to itself', () => {
    const { workflow, id } = withNode('plan');

    const looped = {
      ...workflow,
      edges: [...workflow.edges, { id: 'self', from: { node: id, port: 'next' }, to: id }],
    };

    expect(findCycles(looped, { ignoreRetry: true })).toEqual([[id]]);
  });

  it('marks the edges that return to an earlier step as back edges', () => {
    expect(findBackEdges(defaultWorkflow())).toEqual(new Set(['ci-fix:next', 'review-fix:next']));
  });
});

describe('topological order', () => {
  it('lists the trigger first and every step after the steps that feed it', () => {
    const order = topologicalOrder(defaultWorkflow());

    expect(order[0]).toBe('trigger');
    expect(order).toHaveLength(12);
    expect(order.indexOf('plan')).toBeLessThan(order.indexOf('approval'));
    expect(order.indexOf('ci')).toBeLessThan(order.indexOf('review'));
    expect(order.indexOf('ci')).toBeLessThan(order.indexOf('ci-fix'));
    expect(order.indexOf('review')).toBeLessThan(order.indexOf('done'));
  });

  it('still lists steps that are not connected', () => {
    const { workflow, id } = withNode('condition');

    expect(topologicalOrder(workflow)).toContain(id);
  });
});
