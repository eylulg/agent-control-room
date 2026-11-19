import { pendingApprovals } from "@/domain/selectors";
import { Simulator } from "@/domain/simulator";
import type { AgentEvent } from "@/domain/types";

export const GOLDEN_SEEDS = ["control-room", "alpha", "golden-3"] as const;
const GOLDEN_TICKS = 120;

type Step = (sim: Simulator) => void;

const answerAll: Step = (sim) => {
    for (const approval of pendingApprovals(sim.state)) sim.send({ type: "approval.answer", approvalId: approval.id, option: "B", note: "Keep it small" });
};

/** Operator commands by tick. They cover approvals, holds, cancel and retry, a guard switched off and on, and routing. */
const SCRIPT: Record<number, Step> = {
    6: answerAll,
    8: (sim) => sim.send({ type: "guard.toggle", guardId: "keep-hooks", enabled: false }),
    12: (sim) => sim.send({ type: "job.hold", jobId: "job-3", reason: "Operator check" }),
    20: (sim) => sim.send({ type: "job.resume", jobId: "job-3" }),
    25: (sim) => sim.send({ type: "job.cancel", jobId: "job-5" }),
    30: (sim) => sim.send({ type: "job.retry", jobId: "job-5" }),
    40: (sim) => sim.send({ type: "guard.toggle", guardId: "keep-hooks", enabled: true }),
    45: (sim) =>
        sim.send({
            type: "routing.set",
            routing: {
                feature: "claude-opus-5-5",
                bug: "claude-fable-5-1",
                chore: "claude-haiku-5-5",
                "review-fix": "claude-sonnet-5-5",
                release: "claude-haiku-5-5",
            },
        }),
    60: (sim) => sim.send({ type: "guard.toggle", guardId: "never-merge", enabled: false }),
    80: answerAll,
};

/** Runs a seeded simulator through the fixed command script and returns every event it emitted. */
export const runGoldenScript = (seed: string): AgentEvent[] => {
    const sim = new Simulator({ seed });
    const events: AgentEvent[] = [];
    sim.subscribe((event) => events.push(event));
    for (let tick = 1; tick <= GOLDEN_TICKS; tick++) {
        sim.step();
        SCRIPT[tick]?.(sim);
    }
    return events;
};
