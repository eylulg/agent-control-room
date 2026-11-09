import { describe, expect, it } from "vitest";
import { DEFAULT_GUARDS, findBlockingGuard } from "./guards";
import { createRng } from "./rng";
import { DEFAULT_ROUTING, validateRouting } from "./routing";
import { EMPTY_FILTER, countByStatus, filterJobs, throughput } from "./selectors";
import type { Job } from "./types";

const job = (id: string, kind: Job["kind"], repo: string, title: string, status: Job["status"] = "queued"): Job => ({
    id,
    ticket: { id: `ACME-${id}`, title, repo },
    kind,
    status,
    model: "m",
    attempts: 1,
    createdAt: 0,
    timeline: [],
    commits: [],
    ciRuns: [],
    findings: [],
});

const jobs = [
    job("1", "feature", "acme/web", "Saved filters"),
    job("2", "bug", "acme/api", "Rate limiter"),
    job("3", "bug", "acme/web", "Pagination reset", "done"),
];

describe("rng", () => {
    it("is deterministic per seed", () => {
        const a = createRng("x");
        const b = createRng("x");
        expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
    });
});

describe("queue filtering", () => {
    it("filters by kind, repo and search", () => {
        expect(filterJobs(jobs, EMPTY_FILTER)).toHaveLength(3);
        expect(filterJobs(jobs, { ...EMPTY_FILTER, kinds: ["bug"] }).map((j) => j.id)).toEqual(["2", "3"]);
        expect(filterJobs(jobs, { ...EMPTY_FILTER, kinds: ["bug"], repo: "acme/web" }).map((j) => j.id)).toEqual(["3"]);
        expect(filterJobs(jobs, { ...EMPTY_FILTER, search: "acme-1" }).map((j) => j.id)).toEqual(["1"]);
        expect(filterJobs(jobs, { ...EMPTY_FILTER, search: "LIMITER" }).map((j) => j.id)).toEqual(["2"]);
    });

    it("counts by status", () => {
        expect(countByStatus(jobs)).toMatchObject({ queued: 2, done: 1, failed: 0 });
    });
});

describe("routing validation", () => {
    it("accepts the default table and rejects bad names", () => {
        expect(validateRouting(DEFAULT_ROUTING)).toEqual({});
        expect(validateRouting({ ...DEFAULT_ROUTING, bug: "", chore: "Bad Name" })).toEqual({
            bug: "Enter a model name.",
            chore: expect.stringMatching(/lowercase/),
        });
    });
});

describe("guards", () => {
    it("only enabled guards block", () => {
        expect(findBlockingGuard(DEFAULT_GUARDS, "merge")?.id).toBe("never-merge");
        expect(
            findBlockingGuard(
                DEFAULT_GUARDS.map((g) => ({ ...g, enabled: false })),
                "merge",
            ),
        ).toBeUndefined();
    });
});

describe("throughput", () => {
    it("buckets completions", () => {
        expect(throughput([5, 15, 16, 35], 40, 10, 4)).toEqual([1, 2, 0, 1]);
    });
});
