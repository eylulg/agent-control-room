import { describe, expect, it } from "vitest";
import { defaultWorkflow, withNode } from "@/test-utils/workflow";
import { connect, deleteNodes, describeNode, duplicateNodes, validTargets } from "../ops";

describe("workflow operations", () => {
    it("offers every step except the trigger as a target, and the node itself only for a retry port", () => {
        const workflow = defaultWorkflow();

        const plain = validTargets(workflow, "plan", "next").map((node) => node.id);
        const retry = validTargets(workflow, "ci", "fail").map((node) => node.id);

        expect(plain).not.toContain("trigger");
        expect(plain).not.toContain("plan");
        expect(retry).toContain("ci");
    });

    it("replaces the connection a port already had", () => {
        const workflow = connect(defaultWorkflow(), "plan", "next", "build");

        expect(workflow.edges.filter((edge) => edge.from.node === "plan")).toEqual([{ id: "plan:next", from: { node: "plan", port: "next" }, to: "build" }]);
    });

    it("removes the connections of a deleted node", () => {
        const workflow = deleteNodes(defaultWorkflow(), new Set(["ci"]));

        expect(workflow.edges.some((edge) => edge.from.node === "ci" || edge.to === "ci")).toBe(false);
    });

    it("copies a node with the connections between copies and never copies the trigger", () => {
        const { workflow, created } = duplicateNodes(defaultWorkflow(), new Set(["trigger", "ci", "ci-fix"]));

        expect(created).toHaveLength(2);
        expect(workflow.edges.filter((edge) => created.includes(edge.from.node) && created.includes(edge.to))).toHaveLength(2);
    });

    it("describes what connects in and out of a node", () => {
        expect(describeNode(defaultWorkflow(), "ci")).toBe("CI check. Receives from Implement, Fix CI. Pass goes to Review. Fail goes to Fix CI.");
    });

    it("says when a node has no connections", () => {
        const { workflow, id } = withNode("condition");

        expect(describeNode(workflow, id)).toBe("Condition. Nothing connects in. True is not connected. False is not connected.");
    });
});
