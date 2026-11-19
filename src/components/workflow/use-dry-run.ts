import { useEffect, useRef, useState } from "react";
import { pendingApprovals } from "@/domain/selectors";
import { Simulator } from "@/domain/simulator";
import type { ControlState, JobKind } from "@/domain/types";
import type { Workflow } from "@/domain/workflow/types";

const STEP_MS = 450;

export interface DryRun {
    /** The workflow the run walks. It is the draft as it was when the run started. */
    workflow: Workflow;
    control: ControlState;
    jobId: string;
    playing: boolean;
    finished: boolean;
    /** Steps taken so far. The simulator's own tick only moves on heartbeats, which is not what a person watching counts. */
    steps: number;
}

const snapshotOf = (sim: Simulator, workflow: Workflow, playing: boolean, steps: number): DryRun => {
    const jobId = sim.state.jobOrder[0] ?? "";
    const status = sim.state.jobs[jobId]?.status;
    const finished = status === "done" || status === "failed";
    return { workflow, control: sim.state, jobId, playing: playing && !finished, finished, steps };
};

/**
 * The sandbox has no operator, so an approval is answered the way a teammate would, with the recommendation. It is answered at the start of the
 * next step, which leaves one step in between where the job shows as waiting.
 */
const advanceSim = (sim: Simulator): void => {
    for (const approval of pendingApprovals(sim.state))
        sim.send({ type: "approval.answer", approvalId: approval.id, option: approval.recommended, note: "answered by the dry run" });
    sim.step();
};

const refreshed = (sim: Simulator) => (current: DryRun | null) => (current ? snapshotOf(sim, current.workflow, current.playing, current.steps + 1) : current);

/**
 * A sandboxed simulator that sends one job of a chosen kind through a draft. It shares nothing with the live world:
 * its own seed, its own event stream and no operator but the run itself.
 */
export const useDryRun = () => {
    const simulator = useRef<Simulator | null>(null);
    const [run, setRun] = useState<DryRun | null>(null);
    const playing = run?.playing ?? false;

    useEffect(() => {
        const sim = simulator.current;
        if (!playing || !sim) return;
        const timer = window.setInterval(() => {
            advanceSim(sim);
            setRun(refreshed(sim));
        }, STEP_MS);
        return () => window.clearInterval(timer);
    }, [playing]);

    function start(workflow: Workflow, kind: JobKind, seed: string) {
        const sim = new Simulator({ seed: seed.trim() || "dry-run", workflow, only: kind });
        simulator.current = sim;
        setRun(snapshotOf(sim, workflow, false, 0));
    }

    function step() {
        const sim = simulator.current;
        if (!sim) return;
        advanceSim(sim);
        setRun(refreshed(sim));
    }

    function play() {
        setRun((current) => (current && !current.finished ? { ...current, playing: true } : current));
    }

    function pause() {
        setRun((current) => (current ? { ...current, playing: false } : current));
    }

    function stop() {
        simulator.current = null;
        setRun(null);
    }

    return { run, start, play, pause, step, stop };
};
