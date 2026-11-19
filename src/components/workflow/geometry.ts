import { INPUT_OFFSET, NODE_HEIGHT, NODE_WIDTH, type Position, type WorkflowNode, portOffset } from "@/domain/workflow/types";

export const nodeDomId = (id: string): string => `wf-node-${id}`;
export const outlineDomId = (id: string): string => `wf-outline-${id}`;
export const CANVAS_DOM_ID = "wf-canvas";

export const outputPoint = (node: WorkflowNode, portId: string): Position => {
    const offset = portOffset(node.type, portId);
    return { x: node.position.x + offset.x, y: node.position.y + offset.y };
};

export const inputPoint = (node: WorkflowNode): Position => ({ x: node.position.x + INPUT_OFFSET.x, y: node.position.y + INPUT_OFFSET.y });

/** Radius of the input port, so a connection ends at its edge and the arrowhead does not sit on top of the circle. */
const INPUT_RADIUS = 6;
/** How far a routed connection runs straight out of a port and into one before it turns. */
const TURN = 28;
/** Space kept between a routed connection and a step beside it. */
const CHANNEL_MARGIN = 10;
const CORNER = 10;

export interface Route {
    /** The SVG path. */
    d: string;
    /** The same line as points, for placing labels along it. */
    points: Position[];
}

const rectOf = (node: WorkflowNode) => ({
    left: node.position.x,
    right: node.position.x + NODE_WIDTH,
    top: node.position.y,
    bottom: node.position.y + NODE_HEIGHT,
});

/** Whether a connection has to go around: the target is not clearly below the port it leaves from. */
export const needsRouting = (start: Position, end: Position, isBack: boolean): boolean => isBack || end.y - start.y < TURN;

const roundedPath = (points: Position[]): string => {
    const first = points[0];
    if (!first) return "";
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < points.length - 1; i++) {
        const before = points[i - 1];
        const corner = points[i];
        const after = points[i + 1];
        if (!before || !corner || !after) continue;
        const inLength = Math.hypot(corner.x - before.x, corner.y - before.y);
        const outLength = Math.hypot(after.x - corner.x, after.y - corner.y);
        const r = Math.min(CORNER, inLength / 2, outLength / 2);
        if (r === 0) continue;
        const enter = { x: corner.x - ((corner.x - before.x) / inLength) * r, y: corner.y - ((corner.y - before.y) / inLength) * r };
        const leave = { x: corner.x + ((after.x - corner.x) / outLength) * r, y: corner.y + ((after.y - corner.y) / outLength) * r };
        d += ` L ${enter.x} ${enter.y} Q ${corner.x} ${corner.y} ${leave.x} ${leave.y}`;
    }
    const last = points[points.length - 1];
    return last ? `${d} L ${last.x} ${last.y}` : d;
};

/** The x of a vertical run that clears every step it would pass, as near to `preferred` as it can get. */
const freeColumn = (preferred: number, top: number, bottom: number, nodes: Iterable<WorkflowNode>): number => {
    const blocked = [...nodes]
        .map(rectOf)
        .filter((rect) => rect.bottom > top && rect.top < bottom)
        .map((rect) => [rect.left - CHANNEL_MARGIN, rect.right + CHANNEL_MARGIN] as const);
    const isFree = (x: number) => blocked.every(([lo, hi]) => x <= lo || x >= hi);
    if (isFree(preferred)) return preferred;
    const candidates = blocked.flatMap(([lo, hi]) => [lo, hi]).filter(isFree);
    return candidates.reduce((best, x) => (Math.abs(x - preferred) < Math.abs(best - preferred) ? x : best), candidates[0] ?? preferred);
};

/**
 * A connection leaves the bottom of a step and arrives at the top of the next, ending at the edge of the input port. When the target is below,
 * it is one smooth S. When it is beside or above, which is a loop or a change of column, it runs down out of the port, along a clear
 * column between the steps and down into the target, so it never cuts across a step.
 */
export const routeEdge = (from: WorkflowNode, portId: string, to: WorkflowNode, nodes: Iterable<WorkflowNode>, isBack: boolean): Route => {
    const start = outputPoint(from, portId);
    const target = inputPoint(to);
    const end = { x: target.x, y: target.y - INPUT_RADIUS };
    if (!needsRouting(start, target, isBack)) {
        const reach = Math.max(20, (end.y - start.y) / 2);
        const d = `M ${start.x} ${start.y} C ${start.x} ${start.y + reach}, ${end.x} ${end.y - reach}, ${end.x} ${end.y}`;
        const points = Array.from({ length: 25 }, (_, i) => {
            const t = i / 24;
            const u = 1 - t;
            const y = u ** 3 * start.y + 3 * u * u * t * (start.y + reach) + 3 * u * t * t * (end.y - reach) + t ** 3 * end.y;
            const x = u ** 3 * start.x + 3 * u * u * t * start.x + 3 * u * t * t * end.x + t ** 3 * end.x;
            return { x, y };
        });
        return { d, points };
    }
    const top = Math.min(start.y, end.y) - TURN;
    const bottom = Math.max(start.y, end.y) + TURN;
    const preferred = isBack ? rectOf(from).right + 14 : rectOf(to).left - 14;
    const column = freeColumn(preferred, top, bottom, nodes);
    const points = [
        start,
        { x: start.x, y: start.y + TURN },
        { x: column, y: start.y + TURN },
        { x: column, y: end.y - TURN },
        { x: end.x, y: end.y - TURN },
        end,
    ];
    return { d: roundedPath(points), points };
};

/** The point a fraction of the way along a line made of points. */
const pointAlong = (points: Position[], fraction: number): Position => {
    const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - (points[i]?.x ?? 0), point.y - (points[i]?.y ?? 0)));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) * fraction;
    for (let i = 0; i < lengths.length; i++) {
        const length = lengths[i] ?? 0;
        const a = points[i];
        const b = points[i + 1];
        if (!a || !b) break;
        if (remaining <= length || i === lengths.length - 1) {
            const t = length === 0 ? 0 : Math.min(1, remaining / length);
            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
        remaining -= length;
    }
    return points[0] ?? { x: 0, y: 0 };
};

export interface LabelBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

const LABEL_HEIGHT = 14;
const CHAR_WIDTH = 7;
const FRACTIONS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];

const overlaps = (a: LabelBox, b: LabelBox, pad = 0): boolean =>
    a.x < b.x + b.width + pad && a.x + a.width + pad > b.x && a.y < b.y + b.height + pad && a.y + a.height + pad > b.y;

/**
 * Where each connection's count goes. A label sits beside its line, at the first spot along it that touches neither a step nor a label
 * already placed. A connection with no such spot gets no label, so a label never lies on top of anything.
 */
export const placeLabels = (items: { id: string; text: string; points: Position[] }[], nodes: Iterable<WorkflowNode>): Map<string, LabelBox> => {
    const obstacles: LabelBox[] = [...nodes].map((node) => ({ x: node.position.x, y: node.position.y, width: NODE_WIDTH, height: NODE_HEIGHT }));
    const placed = new Map<string, LabelBox>();
    for (const { id, text, points } of items) {
        const width = text.length * CHAR_WIDTH + 6;
        for (const fraction of FRACTIONS) {
            const at = pointAlong(points, fraction);
            const box = { x: at.x + 5, y: at.y - LABEL_HEIGHT / 2, width, height: LABEL_HEIGHT };
            if (obstacles.some((obstacle) => overlaps(box, obstacle, 2))) continue;
            placed.set(id, box);
            obstacles.push(box);
            break;
        }
    }
    return placed;
};

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
