import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GOLDEN_SEEDS, runGoldenScript } from "@/test-utils/golden-script";

const readGolden = (seed: string): unknown[] =>
    readFileSync(path.join(import.meta.dirname, "../../test-utils/golden", `${seed}.jsonl`), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line): unknown => JSON.parse(line));

describe("Simulator golden streams", () => {
    // The streams were captured from the phase machine simulator before workflows existed.
    it.each(GOLDEN_SEEDS)("replays the recorded event stream for seed %s", (seed) => {
        const events = runGoldenScript(seed).map((event) => JSON.parse(JSON.stringify(event)) as unknown);

        expect(events).toEqual(readGolden(seed));
    });
});
