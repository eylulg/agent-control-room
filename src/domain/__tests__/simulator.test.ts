import { describe, expect, it } from "vitest";
import { chainOf, defaultWorkflow, without } from "@/test-utils/workflow";
import { DEFAULT_ROUTING } from "../routing";
import { pendingApprovals } from "../selectors";
import { Simulator, TEAMMATE_AFTER_TICKS } from "../simulator";
import type { AgentEvent, EventType } from "../types";
import { updateNode } from "../workflow/ops";

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

    it("keeps finishing jobs for 2000 ticks with nobody answering approvals", () => {
        const sim = new Simulator({ seed: "unattended" });

        sim.step(1500);
        const doneBefore = Object.values(sim.state.jobs).filter((job) => job.status === "done").length;
        const lastStretch = sim.step(500);

        expect(doneBefore).toBeGreaterThan(20);
        expect(lastStretch.some((event) => event.type === "job.done")).toBe(true);
        expect(lastStretch.some((event) => event.type === "job.created")).toBe(true);
    });

    it("answers a stale approval with the recommended option and says so", () => {
        const sim = new Simulator({ seed: "approvals" });
        sim.step(4);
        const approval = pendingApprovals(sim.state)[0];
        if (!approval) throw new Error("expected a pending approval");

        sim.step(TEAMMATE_AFTER_TICKS + 1);

        expect(sim.state.approvals[approval.id]).toMatchObject({
            status: "answered",
            answer: { option: approval.recommended, note: "answered by teammate" },
        });
    });

    describe("workflows", () => {
        it("publishes a valid workflow as the next version and ignores an invalid one", () => {
            const sim = new Simulator({ seed: "publish" });
            const edited = updateNode(defaultWorkflow(), "ci", { config: { maxAttempts: 5 } });

            sim.send({ type: "workflow.publish", workflow: without("plan") });
            sim.send({ type: "workflow.publish", workflow: edited });
            sim.send({ type: "workflow.publish", workflow: edited });

            expect(sim.state.workflows.map((published) => published.revision)).toEqual([1, 2]);
        });

        it("lets a job finish on the version it started with", () => {
            const sim = new Simulator({ seed: "versions" });
            sim.step(3);
            const started = Object.values(sim.state.runs).map((run) => run.revision);

            sim.send({ type: "workflow.publish", workflow: updateNode(defaultWorkflow(), "ci", { config: { maxAttempts: 5 } }) });
            sim.step(60);

            expect(started.length).toBeGreaterThan(0);
            for (const jobId of Object.keys(sim.state.runs).slice(0, started.length)) expect(sim.state.runs[jobId]?.revision).toBe(1);
            expect(Object.values(sim.state.runs).some((run) => run.revision === 2)).toBe(true);
        });

        it("fails a job whose kind no trigger accepts", () => {
            const base = defaultWorkflow();
            const bugsOnly = updateNode(base, "trigger", { config: { kinds: ["bug"] } });
            const sim = new Simulator({ seed: "kinds", workflow: bugsOnly, only: "feature" });

            sim.step(6);

            expect(Object.values(sim.state.jobs)[0]).toMatchObject({ status: "failed", failureReason: "No trigger accepts feature jobs" });
        });

        it("runs one job and nothing else for a dry run, ending at the end node", () => {
            const sim = new Simulator({ seed: "dry", workflow: defaultWorkflow(), only: "chore" });

            sim.step(200);

            const jobs = Object.values(sim.state.jobs);
            expect(jobs).toHaveLength(1);
            expect(sim.state.runs["job-1"]?.steps.at(-1)?.nodeId).toBe("done");
        });

        it("lets a long chain of instant steps rest between ticks instead of failing the job", () => {
            const sim = new Simulator({ seed: "chain", workflow: chainOf(60), only: "chore" });

            sim.step(30);

            expect(Object.values(sim.state.jobs)[0]?.status).toBe("done");
        });
    });
});
