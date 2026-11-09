import { describe, expect, it } from "vitest";
import { applyEvent, createInitialState } from "./reducer";
import { DEFAULT_ROUTING } from "./routing";
import { pendingApprovals } from "./selectors";
import { Simulator } from "./simulator";
import { SimulatedAgentSource, parseAgentEvent } from "./source";
import type { AgentEvent } from "./types";

const strip = (events: AgentEvent[]) => events.map(({ seq, ts, jobId, type, payload }) => JSON.stringify({ seq, ts, jobId, type, payload }));

describe("Simulator determinism", () => {
    it("emits the same events for the same seed", () => {
        const a = new Simulator({ seed: "alpha" });
        const b = new Simulator({ seed: "alpha" });
        expect(strip(a.step(80))).toEqual(strip(b.step(80)));
        expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
    });

    it("diverges for a different seed", () => {
        const a = new Simulator({ seed: "alpha" });
        const b = new Simulator({ seed: "beta" });
        expect(strip(a.step(80))).not.toEqual(strip(b.step(80)));
    });

    it("reset(seed) replays the run from the start", () => {
        const sim = new Simulator({ seed: "alpha" });
        const first = strip(sim.step(40));
        sim.reset("alpha");
        expect(strip(sim.step(40))).toEqual(first);
        expect(sim.tick).toBe(40);
    });

    it("emits heartbeats and exercises every mechanic within a short run", () => {
        const sim = new Simulator({ seed: "control-room" });
        const types = new Set(sim.step(60).map((event) => event.type));
        for (const type of [
            "health.heartbeat",
            "plan.posted",
            "approval.requested",
            "commit.pushed",
            "pr.opened",
            "ci.failed",
            "ci.fixed",
            "guard.blocked",
            "job.held",
            "job.resumed",
            "job.done",
        ]) {
            expect(types, type).toContain(type);
        }
    });

    it("folding the event stream rebuilds the simulator state", () => {
        const sim = new Simulator({ seed: "fold" });
        const source = new SimulatedAgentSource(sim);
        let client = createInitialState();
        source.addEventListener("agent-event", (message) => {
            client = applyEvent(client, parseAgentEvent(message));
        });
        sim.step(50);
        expect(client).toEqual(sim.state);
        source.close();
    });
});

describe("Approvals", () => {
    it("blocks the job until answered and then unblocks it", () => {
        const sim = new Simulator({ seed: "approvals" });
        sim.step(4);
        const [approval] = pendingApprovals(sim.state);
        expect(approval).toBeDefined();
        const jobId = approval.jobId;
        expect(sim.state.jobs[jobId].status).toBe("awaiting-approval");

        sim.step(15);
        expect(sim.state.jobs[jobId].status).toBe("awaiting-approval");
        expect(sim.state.jobs[jobId].commits).toHaveLength(0);

        sim.send({ type: "approval.answer", approvalId: approval.id, option: "B", note: "Keep it small" });
        expect(sim.state.approvals[approval.id]).toMatchObject({ status: "answered", answer: { option: "B", note: "Keep it small" } });
        expect(sim.state.jobs[jobId].status).toBe("implementing");
        expect(sim.state.jobs[jobId].plan).toContain("Decision: option B");

        sim.step(4);
        expect(sim.state.jobs[jobId].commits.length).toBeGreaterThan(0);
    });
});

describe("Guards", () => {
    it("blocks a forbidden action and logs it", () => {
        const sim = new Simulator({ seed: "guards" });
        const events = sim.step(10);
        const blocked = events.find((event) => event.type === "guard.blocked" && event.payload.action === "skip-hooks");
        expect(blocked).toBeDefined();
        const guard = sim.state.guards.find((g) => g.id === "keep-hooks")!;
        expect(guard.blocked).toHaveLength(1);
        expect(guard.blocked[0].detail).toMatch(/--no-verify/);
    });

    it("lets the action through when the guard is switched off", () => {
        const sim = new Simulator({ seed: "guards" });
        sim.send({ type: "guard.toggle", guardId: "keep-hooks", enabled: false });
        const events = sim.step(10);
        expect(events.some((event) => event.type === "guard.blocked" && event.payload.action === "skip-hooks")).toBe(false);
        expect(events.some((event) => event.type === "guard.allowed" && event.payload.action === "skip-hooks")).toBe(true);
    });

    it("holds a stacked PR instead of marking it ready while its dependency is unmerged", () => {
        const sim = new Simulator({ seed: "stack" });
        sim.step(30);
        const dependent = Object.values(sim.state.jobs).find((job) => job.dependsOn)!;
        const guard = sim.state.guards.find((g) => g.id === "dependency-first")!;
        expect(guard.blocked.some((entry) => entry.jobId === dependent.id)).toBe(true);
        expect(dependent.status).toBe("on-hold");
        expect(dependent.holdReason).toMatch(/to merge first/);
    });
});

describe("Routing", () => {
    it("applies a routing change to the next job but not existing ones", () => {
        const sim = new Simulator({ seed: "routing" });
        const existing = Object.values(sim.state.jobs);
        sim.send({
            type: "routing.set",
            routing: {
                ...DEFAULT_ROUTING,
                feature: "custom-model-1",
                bug: "custom-model-1",
                chore: "custom-model-1",
                "review-fix": "custom-model-1",
                release: "custom-model-1",
            },
        });
        let created: AgentEvent | undefined;
        for (let i = 0; i < 200 && !created; i++) created = sim.step().find((event) => event.type === "job.created");
        expect(created).toBeDefined();
        expect(sim.state.jobs[created!.jobId!].model).toBe("custom-model-1");
        for (const job of existing) expect(sim.state.jobs[job.id].model).not.toBe("custom-model-1");
    });

    it("ignores an invalid routing table", () => {
        const sim = new Simulator();
        sim.send({ type: "routing.set", routing: { ...DEFAULT_ROUTING, bug: "" } });
        expect(sim.state.routing).toEqual(DEFAULT_ROUTING);
    });
});

describe("Hold and resume", () => {
    it("operator hold freezes the job until resumed", () => {
        const sim = new Simulator({ seed: "hold" });
        sim.step(3);
        const job = Object.values(sim.state.jobs).find((j) => j.status === "implementing" || j.status === "planning")!;
        const before = job.status;
        sim.send({ type: "job.hold", jobId: job.id, reason: "Waiting on a designer" });
        expect(sim.state.jobs[job.id]).toMatchObject({ status: "on-hold", holdReason: "Waiting on a designer" });
        const commits = sim.state.jobs[job.id].commits.length;
        sim.step(20);
        expect(sim.state.jobs[job.id].status).toBe("on-hold");
        expect(sim.state.jobs[job.id].commits).toHaveLength(commits);
        sim.send({ type: "job.resume", jobId: job.id });
        expect(sim.state.jobs[job.id].status).toBe(before);
        expect(sim.state.jobs[job.id].holdReason).toBeUndefined();
    });

    it("the agent holds for a designer and resumes on its own", () => {
        const sim = new Simulator({ seed: "designer" });
        const events = sim.step(40);
        const held = events.find((event) => event.type === "job.held" && event.payload.reason.includes("designer"));
        expect(held).toBeDefined();
        expect(events.some((event) => event.type === "job.resumed" && event.jobId === held!.jobId && event.seq > held!.seq)).toBe(true);
    });
});

describe("Cancel and retry", () => {
    it("cancels a job and retries it with the current routing", () => {
        const sim = new Simulator({ seed: "retry" });
        const job = Object.values(sim.state.jobs)[2];
        sim.send({ type: "job.cancel", jobId: job.id });
        expect(sim.state.jobs[job.id]).toMatchObject({ status: "failed", failureReason: "Cancelled by operator" });
        sim.send({ type: "routing.set", routing: { ...DEFAULT_ROUTING, [job.kind]: "claude-opus-4-5" } });
        sim.send({ type: "job.retry", jobId: job.id });
        expect(sim.state.jobs[job.id]).toMatchObject({ status: "queued", attempts: 2, model: "claude-opus-4-5" });
    });
});
