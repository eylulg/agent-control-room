import { describe, expect, it } from "vitest";
import { defaultWorkflow, withNode } from "@/test-utils/workflow";
import { type OutlineStep, buildOutline } from "../outline";

const listedIds = (steps: OutlineStep[]): string[] =>
    steps.flatMap((step) => (step.repeat ? [] : [step.node.id, ...listedIds(step.ports.flatMap((port) => port.target ?? []))]));

describe("buildOutline", () => {
    it("lists every step once from the trigger and refers back to loops", () => {
        const outline = buildOutline(defaultWorkflow());

        const ids = listedIds(outline.tree);
        const ci = outline.tree[0]?.ports[0]?.target?.ports[0]?.target?.ports[0]?.target?.ports[0]?.target;
        const fail = ci?.ports.find((port) => port.port.id === "fail")?.target;

        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(12);
        expect(fail?.ports[0]?.target).toMatchObject({ node: { id: "ci" }, repeat: true });
        expect(outline.loose).toEqual([]);
    });

    it("lists a step the trigger cannot reach on its own", () => {
        const { workflow, id } = withNode("condition");

        expect(buildOutline(workflow).loose.map((step) => step.node.id)).toEqual([id]);
    });
});
