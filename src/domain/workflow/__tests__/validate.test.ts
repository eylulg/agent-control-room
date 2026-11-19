import { describe, expect, it } from "vitest";
import { defaultWorkflow, withNode, without } from "@/test-utils/workflow";
import { connect, disconnect, updateNode } from "../ops";
import { configErrors, validateWorkflow } from "../validate";

const messages = (workflow: Parameters<typeof validateWorkflow>[0]) => validateWorkflow(workflow).map((problem) => problem.message);

describe("validateWorkflow", () => {
    it("accepts the default workflow", () => {
        expect(validateWorkflow(defaultWorkflow())).toEqual([]);
    });

    it("asks for a trigger when there is none", () => {
        expect(messages(without("trigger"))).toContain("Add a trigger. A workflow needs exactly one.");
    });

    it("flags a second trigger", () => {
        const { workflow, id } = withNode("trigger");

        expect(validateWorkflow(workflow)).toContainEqual(expect.objectContaining({ nodeId: id, message: expect.stringContaining("second trigger") }));
    });

    it("flags a node nothing reaches, pointing at it", () => {
        const { workflow, id } = withNode("plan", undefined);

        const problems = validateWorkflow(connect(workflow, id, "next", "build"));

        expect(problems).toContainEqual(expect.objectContaining({ nodeId: id, message: expect.stringContaining("cannot be reached from the trigger") }));
    });

    it("flags an output port with no connection", () => {
        const problems = validateWorkflow(disconnect(defaultWorkflow(), new Set(["ci:fail"])));

        expect(problems).toContainEqual(expect.objectContaining({ nodeId: "ci", message: expect.stringContaining("Fail port") }));
    });

    it("flags every step on a path that never reaches an end", () => {
        const problems = validateWorkflow(without("done"));

        expect(problems.filter((problem) => problem.message.includes("never reaches an end")).length).toBeGreaterThan(5);
    });

    it("allows a loop through a bounded retry port and rejects one without", () => {
        const bounded = validateWorkflow(defaultWorkflow());
        const unbounded = messages(connect(defaultWorkflow(), "ready", "next", "plan"));

        expect(bounded).toEqual([]);
        expect(unbounded).toContainEqual(expect.stringContaining("loop with no limit"));
    });

    it("flags a connection twice in an imported file", () => {
        const workflow = defaultWorkflow();
        const duplicate = { ...workflow, edges: [...workflow.edges, { ...workflow.edges[0]!, id: "copy" }] };

        expect(messages(duplicate)).toContain("Two connections are identical. Delete one of them.");
    });

    it("flags an invalid config on the node", () => {
        const workflow = updateNode(defaultWorkflow(), "ci", { config: { maxAttempts: 0 } });

        expect(validateWorkflow(workflow)).toEqual([expect.objectContaining({ nodeId: "ci", message: expect.stringContaining("whole number from 1 to 10") })]);
    });
});

describe("configErrors", () => {
    it.each([
        [{ field: "attempt", operator: "equals", value: "2" }, "operator"],
        [{ field: "attempt", operator: "at-least", value: "x" }, "value"],
        [{ field: "kind", operator: "at-least", value: "bug" }, "operator"],
        [{ field: "kind", operator: "equals", value: "story" }, "value"],
        [{ field: "repo", operator: "equals", value: " " }, "value"],
    ] as const)("reports a bad condition %j on %s", (config, field) => {
        const { workflow, id } = withNode("condition");
        const node = updateNode(workflow, id, { config }).nodes.find((n) => n.id === id);

        expect(node && Object.keys(configErrors(node))).toEqual([field]);
    });

    it("rejects an empty label and a trigger that accepts nothing", () => {
        const workflow = updateNode(updateNode(defaultWorkflow(), "trigger", { label: " " }), "trigger", { config: { kinds: [] } });
        const trigger = workflow.nodes.find((node) => node.id === "trigger");

        expect(trigger && Object.keys(configErrors(trigger))).toEqual(["label", "kinds"]);
    });
});
