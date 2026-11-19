import { INPUT_OFFSET, NODE_HEIGHT, NODE_WIDTH, type Position, type WorkflowNode, portOffset } from "@/domain/workflow/types";

export const nodeDomId = (id: string): string => `wf-node-${id}`;
export const outlineDomId = (id: string): string => `wf-outline-${id}`;
export const CANVAS_DOM_ID = "wf-canvas";

export const outputPoint = (node: WorkflowNode, portId: string): Position => {
    const offset = portOffset(node.type, portId);
    return { x: node.position.x + offset.x, y: node.position.y + offset.y };
};

export const inputPoint = (node: WorkflowNode): Position => ({ x: node.position.x + INPUT_OFFSET.x, y: node.position.y + INPUT_OFFSET.y });

/** A horizontal S curve. It bows further out the further apart the ends are, so back edges stay readable. */
export const edgePath = (from: Position, to: Position): string => {
    const reach = Math.max(48, Math.abs(to.x - from.x) / 2);
    return `M ${from.x} ${from.y} C ${from.x + reach} ${from.y}, ${to.x - reach} ${to.y}, ${to.x} ${to.y}`;
};

export const midpoint = (from: Position, to: Position): Position => ({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });

/** Moves the view the least it takes to bring a node fully on screen. Returns null when it already is. */
export const panToReveal = (
    node: WorkflowNode,
    viewport: { x: number; y: number; zoom: number },
    size: { width: number; height: number },
    margin = 24,
): Position | null => {
    if (size.width === 0) return null;
    const left = node.position.x * viewport.zoom + viewport.x;
    const top = node.position.y * viewport.zoom + viewport.y;
    const right = left + NODE_WIDTH * viewport.zoom;
    const bottom = top + NODE_HEIGHT * viewport.zoom;
    const dx = left < margin ? margin - left : right > size.width - margin ? size.width - margin - right : 0;
    const dy = top < margin ? margin - top : bottom > size.height - margin ? size.height - margin - bottom : 0;
    return dx === 0 && dy === 0 ? null : { x: dx, y: dy };
};
