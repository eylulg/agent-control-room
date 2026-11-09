import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTING } from "../routing";
import { pendingApprovals } from "../selectors";
import { Simulator } from "../simulator";
import type { AgentEvent, EventType } from "../types";

const serialise = (events: AgentEvent[]) => events.map((event) => JSON.stringify(event));

const firstJobCreated = (sim: Simulator) => {
    for (let i = 0; i < 200; i++) {
        const created = sim.step().find((event) => event.type === "job.created");
        if (created?.jobId) return sim.state.jobs[created.jobId];
    }
    return undefined;
};

describe("Simulator", () => {
    it("emits the same events for the same seed", () => {
        const a = new Simulator({ seed: "alpha" });
        const b = new Simulator({ seed: "alpha" });

        const events = serialise(a.step(80));

        expect(serialise(b.step(80))).toEqual(events);
    });

    it("emits different events for a different seed", () => {
        const a = new Simulator({ seed: "alpha" });
        const b = new Simulator({ seed: "beta" });

        const events = serialise(a.step(80));

        expect(serialise(b.step(80))).not.toEqual(events);
    });

    it("replays the same run after reset with the same seed", () => {
        const sim = new Simulator({ seed: "alpha" });
        const first = serialise(sim.step(40));

        sim.reset("alpha");

        expect(serialise(sim.step(40))).toEqual(first);
    });

    it.each<EventType>(["health.heartbeat", "pr.opened", "ci.failed", "ci.fixed", "review.finding", "review.replied", "job.done"])(
        "emits %s within the first hour",
        (type) => {
            const sim = new Simulator();

            const events = sim.step(60);

            expect(events.map((event) => event.type)).toContain(type);
        },
    );

    it("blocks a job on an approval until it is answered", () => {
        const sim = new Simulator({ seed: "approvals" });
        sim.step(4);
        const approval = pendingApprovals(sim.state)[0];
        if (!approval) throw new Error("expected a pending approval");
        sim.step(15);
        expect(sim.state.jobs[approval.jobId]).toMatchObject({ status: "awaiting-approval", commits: [] });

        sim.send({ type: "approval.answer", approvalId: approval.id, option: "B", note: "Keep it small" });
        sim.step(4);

        expect(sim.state.jobs[approval.jobId]?.plan).toContain("Decision: option B");
        expect(sim.state.jobs[approval.jobId]?.commits.length).toBeGreaterThan(0);
    });

    it("blocks a guarded action and logs the attempt", () => {
        const sim = new Simulator({ seed: "guards" });

        const events = sim.step(10);

        expect(events.some((event) => event.type === "guard.blocked" && event.payload.action === "skip-hooks")).toBe(true);
        expect(sim.state.guards.find((guard) => guard.id === "keep-hooks")?.blocked[0]?.detail).toMatch(/--no-verify/);
    });

    it("lets the action through when its guard is switched off", () => {
        const sim = new Simulator({ seed: "guards" });

        sim.send({ type: "guard.toggle", guardId: "keep-hooks", enabled: false });
        const events = sim.step(10);

        expect(events.some((event) => event.type === "guard.blocked" && event.payload.action === "skip-hooks")).toBe(false);
        expect(events.some((event) => event.type === "guard.allowed" && event.payload.action === "skip-hooks")).toBe(true);
    });

    it("holds a stacked PR instead of marking it ready while its dependency is unmerged", () => {
        const sim = new Simulator({ seed: "stack" });

        sim.step(30);

        const dependent = Object.values(sim.state.jobs).find((job) => job.dependsOn);
        expect(dependent).toMatchObject({ status: "on-hold", holdReason: expect.stringMatching(/to merge first/) });
    });

    it("routes the next job with a changed table and leaves existing jobs alone", () => {
        const sim = new Simulator({ seed: "routing" });
        const existing = Object.values(sim.state.jobs);
        const routing = { feature: "custom-1", bug: "custom-1", chore: "custom-1", "review-fix": "custom-1", release: "custom-1" };

        sim.send({ type: "routing.set", routing });

        expect(firstJobCreated(sim)?.model).toBe("custom-1");
        for (const job of existing) expect(sim.state.jobs[job.id]?.model).not.toBe("custom-1");
    });

    it("ignores an invalid routing table", () => {
        const sim = new Simulator();

        sim.send({ type: "routing.set", routing: { ...DEFAULT_ROUTING, bug: "" } });

        expect(sim.state.routing).toEqual(DEFAULT_ROUTING);
    });

    it("freezes a job on an operator hold until it is resumed", () => {
        const sim = new Simulator({ seed: "hold" });
        sim.step(3);
        const job = Object.values(sim.state.jobs).find((j) => j.status === "implementing" || j.status === "planning");
        if (!job) throw new Error("expected a working job");

        sim.send({ type: "job.hold", jobId: job.id, reason: "Waiting on a designer" });
        sim.step(20);
        const frozenCommits = sim.state.jobs[job.id]?.commits.length;
        sim.send({ type: "job.resume", jobId: job.id });

        expect(frozenCommits).toBe(job.commits.length);
        expect(sim.state.jobs[job.id]).toMatchObject({ status: job.status, holdReason: undefined });
    });

    it("resumes an agent hold for a designer on its own", () => {
        const sim = new Simulator({ seed: "designer" });

        const events = sim.step(40);

        const held = events.find((event) => event.type === "job.held" && event.payload.reason.includes("designer"));
        expect(held).toBeDefined();
        expect(events.some((event) => event.type === "job.resumed" && event.jobId === held?.jobId && event.seq > (held?.seq ?? 0))).toBe(true);
    });

    it("retries a cancelled job on the current routing model", () => {
        const sim = new Simulator({ seed: "retry" });
        const job = sim.state.jobs["job-3"];
        if (!job) throw new Error("expected job-3");

        sim.send({ type: "job.cancel", jobId: job.id });
        sim.send({ type: "routing.set", routing: { ...DEFAULT_ROUTING, [job.kind]: "claude-fable-5-1" } });
        sim.send({ type: "job.retry", jobId: job.id });

        expect(sim.state.jobs[job.id]).toMatchObject({ status: "queued", attempts: 2, model: "claude-fable-5-1" });
    });
});
