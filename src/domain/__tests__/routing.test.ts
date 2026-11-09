import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTING, validateRouting } from "../routing";

describe("validateRouting", () => {
    it("accepts the default table", () => {
        expect(validateRouting(DEFAULT_ROUTING)).toEqual({});
    });

    it.each([
        ["", "Enter a model name."],
        ["   ", "Enter a model name."],
        ["Claude Opus", "Use lowercase letters, digits, dots and hyphens only."],
        ["-leading-hyphen", "Use lowercase letters, digits, dots and hyphens only."],
        ["a".repeat(41), "Use 40 characters or fewer."],
    ])("rejects %j", (model, message) => {
        expect(validateRouting({ ...DEFAULT_ROUTING, bug: model })).toEqual({ bug: message });
    });
});
