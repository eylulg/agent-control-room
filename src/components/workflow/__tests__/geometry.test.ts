import { describe, expect, it } from "vitest";
import { findBackEdges } from "@/domain/workflow/graph";
import { NODE_HEIGHT, NODE_WIDTH } from "@/domain/workflow/types";
import { defaultWorkflow } from "@/test-utils/workflow";
import { inputPoint, placeLabels, routeEdge } from "../geometry";

const workflow = defaultWorkflow();
const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
const back = findBackEdges(workflow);
const routes = workflow.edges.map((edge) => {
    const from = nodes.get(edge.from.node);
    const to = nodes.get(edge.to);
    if (!from || !to) throw new Error("The default workflow has a dangling connection");
    return { edge, to, route: routeEdge(from, edge.from.port, to, nodes.values(), back.has(edge.id)) };
});

describe("connection geometry", () => {
    it("ends every connection at the edge of the input port, above the step", () => {
        for (const { route, to } of routes) {
            const end = route.points.at(-1);

            expect(end?.x).toBe(inputPoint(to).x);
            expect(end?.y).toBeLessThan(inputPoint(to).y);
        }
    });

    it("never puts a label on a step or on another label, hiding one instead", () => {
        const items = routes.map(({ edge, route }) => ({ id: edge.id, text: "18", points: route.points }));

        const boxes = [...placeLabels(items, nodes.values()).values()];

        expect(boxes.length).toBeGreaterThan(0);
        for (const [i, box] of boxes.entries()) {
            for (const node of workflow.nodes) {
                const apart =
                    box.x + box.width <= node.position.x ||
                    box.x >= node.position.x + NODE_WIDTH ||
                    box.y + box.height <= node.position.y ||
                    box.y >= node.position.y + NODE_HEIGHT;
                expect(apart).toBe(true);
            }
            for (const other of boxes.slice(i + 1)) {
                const apart =
                    box.x + box.width <= other.x || box.x >= other.x + other.width || box.y + box.height <= other.y || box.y >= other.y + other.height;
                expect(apart).toBe(true);
            }
        }
    });
});
