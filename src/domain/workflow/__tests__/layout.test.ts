import { describe, expect, it } from "vitest";
import { defaultWorkflow } from "@/test-utils/workflow";
import { DEFAULT_WORKFLOW } from "../default";
import { findBackEdges } from "../graph";
import { autoLayout } from "../layout";
import { NODE_HEIGHT, NODE_WIDTH } from "../types";

describe("autoLayout", () => {
    it("puts every step to the right of the steps that feed it and overlaps none", () => {
        const workflow = autoLayout(defaultWorkflow());
        const at = new Map(workflow.nodes.map((node) => [node.id, node.position]));
        const back = findBackEdges(workflow);

        for (const edge of workflow.edges.filter((e) => !back.has(e.id))) {
            expect(at.get(edge.to)?.x).toBeGreaterThan(at.get(edge.from.node)?.x ?? Infinity);
        }
        for (const a of workflow.nodes) {
            for (const b of workflow.nodes) {
                if (a.id >= b.id) continue;
                const apart = Math.abs(a.position.x - b.position.x) >= NODE_WIDTH || Math.abs(a.position.y - b.position.y) >= NODE_HEIGHT;
                expect(apart).toBe(true);
            }
        }
    });

    it("moves nothing else about the workflow and is stable when run twice", () => {
        const once = autoLayout(defaultWorkflow());

        expect(autoLayout(once)).toEqual(once);
        expect(once.edges).toEqual(defaultWorkflow().edges);
    });

    it("keeps the default workflow compact enough to open fully visible on a laptop canvas without overlaps", () => {
        const nodes = DEFAULT_WORKFLOW.nodes;
        const width = Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH)) - Math.min(...nodes.map((node) => node.position.x));
        const height = Math.max(...nodes.map((node) => node.position.y + NODE_HEIGHT)) - Math.min(...nodes.map((node) => node.position.y));

        expect(width).toBeLessThanOrEqual(800);
        expect(height).toBeLessThanOrEqual(480);
        for (const a of nodes) {
            for (const b of nodes) {
                if (a.id >= b.id) continue;
                expect(Math.abs(a.position.x - b.position.x) >= NODE_WIDTH || Math.abs(a.position.y - b.position.y) >= NODE_HEIGHT).toBe(true);
            }
        }
    });
});
