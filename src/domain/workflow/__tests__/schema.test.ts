import { describe, expect, it } from "vitest";
import { defaultWorkflow } from "@/test-utils/workflow";
import { parseWorkflow, serializeWorkflow } from "../schema";

describe("parseWorkflow", () => {
    it("reads what serializeWorkflow wrote", () => {
        const workflow = defaultWorkflow();

        expect(parseWorkflow(serializeWorkflow(workflow))).toEqual({ ok: true, workflow });
    });

    it.each([
        ["not json", "{", "not valid JSON"],
        ["a newer format", JSON.stringify({ ...defaultWorkflow(), version: 2 }), "format version 2"],
        [
            "a node of an unknown type",
            JSON.stringify({ ...defaultWorkflow(), nodes: [{ id: "x", type: "teleport", label: "x", position: { x: 0, y: 0 }, config: {} }] }),
            "expected shape",
        ],
        [
            "a node with the wrong config",
            JSON.stringify({ ...defaultWorkflow(), nodes: [{ id: "x", type: "ci", label: "x", position: { x: 0, y: 0 }, config: { maxAttempts: "3" } }] }),
            "expected shape",
        ],
    ])("rejects %s with a message that says what to do", (_name, text, expected) => {
        const result = parseWorkflow(text);

        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toContain(expected);
    });
});
