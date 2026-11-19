import { findBackEdges, incomingEdges, nodeIndex, topologicalOrder } from "./graph";
import { GRID_STEP, NODE_HEIGHT, NODE_WIDTH, type Workflow } from "./types";

const COLUMN_GAP = 40;
const ROW_GAP = 60;
const MARGIN = 40;
const SWEEPS = 3;

const snap = (value: number): number => Math.round(value / GRID_STEP) * GRID_STEP;

/**
 * A layered layout, top to bottom, the way connections leave the bottom of a step and enter the top of the next. A node sits one row
 * below its furthest predecessor (back edges ignored), and steps inside a row are ordered by the average position of the
 * predecessors so edges cross as little as a few sweeps can manage. Rows are centred.
 */
export const autoLayout = (workflow: Workflow): Workflow => {
    const back = findBackEdges(workflow);
    const nodes = nodeIndex(workflow);
    const incoming = incomingEdges(workflow);
    const order = topologicalOrder(workflow);

    const layer = new Map<string, number>();
    for (const id of order) {
        const parents = (incoming.get(id) ?? []).filter((edge) => !back.has(edge.id) && nodes.has(edge.from.node));
        layer.set(
            id,
            parents.reduce((deepest, edge) => Math.max(deepest, (layer.get(edge.from.node) ?? 0) + 1), 0),
        );
    }

    const columns: string[][] = [];
    for (const id of order) {
        const column = layer.get(id) ?? 0;
        columns[column] = [...(columns[column] ?? []), id];
    }

    const row = new Map<string, number>();
    const place = () => columns.forEach((ids) => ids.forEach((id, i) => row.set(id, i)));
    place();
    for (let sweep = 0; sweep < SWEEPS; sweep++) {
        for (const ids of columns) {
            const barycentre = (id: string) => {
                const parents = (incoming.get(id) ?? []).filter((edge) => !back.has(edge.id));
                if (parents.length === 0) return row.get(id) ?? 0;
                return parents.reduce((sum, edge) => sum + (row.get(edge.from.node) ?? 0), 0) / parents.length;
            };
            ids.sort((a, b) => barycentre(a) - barycentre(b));
        }
        place();
    }

    const widest = Math.max(0, ...columns.map((ids) => ids.length));
    const positions = new Map<string, { x: number; y: number }>();
    columns.forEach((ids, layerIndex) => {
        const offset = ((widest - ids.length) * (NODE_WIDTH + COLUMN_GAP)) / 2;
        ids.forEach((id, i) => {
            positions.set(id, { x: snap(MARGIN + offset + i * (NODE_WIDTH + COLUMN_GAP)), y: snap(MARGIN + layerIndex * (NODE_HEIGHT + ROW_GAP)) });
        });
    });

    return { ...workflow, nodes: workflow.nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })) };
};
