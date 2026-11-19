import { nodeIndex, outgoingEdges } from "./graph";
import { PORTS, type PortSpec, type Workflow, type WorkflowEdge, type WorkflowNode } from "./types";

export interface OutlinePort {
    port: PortSpec;
    edge?: WorkflowEdge;
    /** The step this port leads to. Its own connections are listed under it the first time it appears. */
    target?: OutlineStep;
}

export interface OutlineStep {
    node: WorkflowNode;
    ports: OutlinePort[];
    /** True when the step was already listed higher up, so only a reference is shown here. */
    repeat: boolean;
}

export interface Outline {
    /** The workflow read from the trigger, each step expanded where it first appears. */
    tree: OutlineStep[];
    /** Steps the trigger cannot reach. */
    loose: OutlineStep[];
}

/** The workflow as nested lists. Loops and joins appear as references to a step listed earlier, so the nesting always ends. */
export const buildOutline = (workflow: Workflow): Outline => {
    const nodes = nodeIndex(workflow);
    const out = outgoingEdges(workflow);
    const listed = new Set<string>();

    const step = (node: WorkflowNode): OutlineStep => {
        if (listed.has(node.id)) return { node, ports: [], repeat: true };
        listed.add(node.id);
        const ports = PORTS[node.type].map((port): OutlinePort => {
            const edge = (out.get(node.id) ?? []).find((candidate) => candidate.from.port === port.id);
            const target = edge && nodes.get(edge.to);
            return { port, edge, target: target && step(target) };
        });
        return { node, ports, repeat: false };
    };

    const trigger = workflow.nodes.find((node) => node.type === "trigger");
    const tree = trigger ? [step(trigger)] : [];
    const loose = workflow.nodes.filter((node) => !listed.has(node.id)).map(step);
    return { tree, loose };
};
