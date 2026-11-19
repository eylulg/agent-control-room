import { useLayoutEffect, useState } from "react";
import { Badge } from "@eylulg/ui/badge";
import { Button } from "@eylulg/ui/button";
import { Input } from "@eylulg/ui/input";
import { Select, SelectItem } from "@eylulg/ui/select";
import { Switch } from "@eylulg/ui/switch";
import { Tab, TabList, TabPanel, Tabs } from "@eylulg/ui/tabs";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type { Key } from "react-aria-components";
import { listJobs } from "@/domain/selectors";
import { JOB_KINDS, type JobKind } from "@/domain/types";
import { nodeStates } from "@/domain/workflow/overlay";
import type { Workflow } from "@/domain/workflow/types";
import { useAppStore } from "@/state/store-context";
import { useEditor } from "@/state/workflow-context";
import { KIND_LABEL, STATUS_META, formatClock } from "@/utils/format";
import { moveFocusFrom } from "./focus-step";
import { RUN_STATE } from "./node-meta";
import type { useDryRun } from "./use-dry-run";

type DryRunApi = ReturnType<typeof useDryRun>;

interface RunPanelProps {
    showLive: boolean;
    onShowLive: (value: boolean) => void;
    traceJobId: string | null;
    onTrace: (jobId: string | null) => void;
    dry: DryRunApi;
}

const NO_TRACE = "none";
const DRY_PLAY_ID = "wf-dry-play";
const DRY_STEP_ID = "wf-dry-step";
const DRY_RESTART_ID = "wf-dry-restart";

/** What the workflow is doing: the live world, one job's path, or a dry run of the draft. */
export const RunPanel = ({ showLive, onShowLive, traceJobId, onTrace, dry }: RunPanelProps) => (
    <Tabs defaultSelectedKey={dry.run ? "dry" : "live"}>
        <TabList aria-label="Execution views">
            <Tab id="live">Live jobs</Tab>
            <Tab id="trace">Trace a job</Tab>
            <Tab id="dry">Dry run</Tab>
        </TabList>
        <TabPanel id="live" className="pt-4">
            <LivePanel showLive={showLive} onShowLive={onShowLive} />
        </TabPanel>
        <TabPanel id="trace" className="pt-4">
            <TracePanel jobId={traceJobId} onTrace={onTrace} />
        </TabPanel>
        <TabPanel id="dry" className="pt-4">
            <DryRunPanel dry={dry} />
        </TabPanel>
    </Tabs>
);

const LivePanel = ({ showLive, onShowLive }: Pick<RunPanelProps, "showLive" | "onShowLive">) => {
    const control = useAppStore((s) => s.control);
    const latest = control.workflows.at(-1)?.revision ?? 1;
    const olderJobs = Object.values(control.jobs).filter(
        (job) => job.status !== "done" && job.status !== "failed" && (control.runs[job.id]?.revision ?? latest) !== latest,
    ).length;
    const dirty = useEditor((s) => s.dirty);

    return (
        <div className="flex flex-col gap-3">
            <Switch
                isSelected={showLive}
                onChange={onShowLive}
                hint="Counts the jobs on each step, with the connections they took. Numbers on a connection are how many jobs took it."
            >
                Show live jobs on the canvas
            </Switch>
            {olderJobs > 0 && (
                <p className="text-sm text-tertiary">
                    {olderJobs} open {olderJobs === 1 ? "job runs" : "jobs run"} an older version. {olderJobs === 1 ? "It is" : "They are"} counted on steps
                    that still exist in version {latest}.
                </p>
            )}
            {dirty && <p className="text-sm text-tertiary">The canvas shows a draft. Counts appear on steps that exist in version {latest} too.</p>}
        </div>
    );
};

const TracePanel = ({ jobId, onTrace }: Pick<RunPanelProps, "onTrace"> & { jobId: string | null }) => {
    const control = useAppStore((s) => s.control);
    const jobs = listJobs(control).filter((job) => control.runs[job.id]);
    const run = jobId ? control.runs[jobId] : undefined;
    const workflow = run ? control.workflows.find((published) => published.revision === run.revision)?.workflow : undefined;

    function handleChange(key: Key | null) {
        onTrace(key === null || key === NO_TRACE ? null : String(key));
    }

    return (
        <div className="flex flex-col gap-3">
            <Select
                label="Job to trace"
                selectedKey={jobId ?? NO_TRACE}
                onSelectionChange={handleChange}
                hint="Highlights the steps and connections the job took, with the time it entered each step."
            >
                <SelectItem id={NO_TRACE}>No job</SelectItem>
                {jobs.map((job) => (
                    <SelectItem key={job.id} id={job.id}>{`${job.ticket.id}: ${job.ticket.title}`}</SelectItem>
                ))}
            </Select>
            {run && !workflow && (
                <p role="status" className="text-sm text-tertiary">
                    Version {run.revision} is no longer kept, so this job&apos;s path cannot be shown.
                </p>
            )}
            {run && workflow && (
                <>
                    <p className="text-sm text-secondary">
                        Version {run.revision}, {run.steps.length} steps.
                    </p>
                    <ol aria-label="Path of the job" className="flex flex-col gap-1 text-sm">
                        {run.steps.map((step, index) => (
                            <li key={`${step.nodeId}-${step.ts}-${index}`} className="flex gap-2">
                                <time className="font-data text-tertiary" dateTime={new Date(step.ts).toISOString()}>
                                    {formatClock(step.ts)}
                                </time>
                                <span className="text-primary">{workflow.nodes.find((node) => node.id === step.nodeId)?.label ?? step.nodeId}</span>
                            </li>
                        ))}
                    </ol>
                </>
            )}
        </div>
    );
};

const DryRunPanel = ({ dry }: { dry: DryRunApi }) => {
    const draft = useEditor((s) => s.history.present);
    const blocked = useEditor((s) => s.analysis.problems.length > 0);
    const [kind, setKind] = useState<JobKind>("feature");
    const [seed, setSeed] = useState("dry-run");
    const { run } = dry;
    const finished = run?.finished ?? false;

    useLayoutEffect(() => {
        if (!finished) return;
        moveFocusFrom(DRY_PLAY_ID, DRY_RESTART_ID);
        moveFocusFrom(DRY_STEP_ID, DRY_RESTART_ID);
    }, [finished]);

    function handleKind(key: Key | null) {
        const next = JOB_KINDS.find((candidate) => candidate === key);
        if (next) setKind(next);
    }

    function handleStart() {
        dry.start(draft, kind, seed);
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start gap-3">
                <Select label="Job kind" selectedKey={kind} onSelectionChange={handleKind} isDisabled={run?.playing}>
                    {JOB_KINDS.map((item) => (
                        <SelectItem key={item} id={item}>
                            {KIND_LABEL[item]}
                        </SelectItem>
                    ))}
                </Select>
                <Input label="Seed" value={seed} onChange={setSeed} isDisabled={run?.playing} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button id={DRY_RESTART_ID} size="sm" onPress={handleStart} isDisabled={blocked || run?.playing} iconLeading={RotateCcw}>
                    {run ? "Restart dry run" : "Start dry run"}
                </Button>
                {run &&
                    (run.playing ? (
                        <Button size="sm" variant="secondary" iconLeading={Pause} onPress={dry.pause}>
                            Pause
                        </Button>
                    ) : (
                        <Button id={DRY_PLAY_ID} size="sm" variant="secondary" iconLeading={Play} onPress={dry.play} isDisabled={run.finished}>
                            Play
                        </Button>
                    ))}
                {run && (
                    <Button
                        id={DRY_STEP_ID}
                        size="sm"
                        variant="secondary"
                        iconLeading={SkipForward}
                        onPress={dry.step}
                        isDisabled={run.finished || run.playing}
                    >
                        Step
                    </Button>
                )}
                {run && (
                    <Button size="sm" variant="tertiary" onPress={dry.stop}>
                        Clear dry run
                    </Button>
                )}
            </div>
            {blocked && <p className="text-sm text-tertiary">Fix the problems listed for this workflow before a dry run.</p>}
            {run && <DryRunStatus workflow={run.workflow} run={run} />}
        </div>
    );
};

const DryRunStatus = ({ workflow, run }: { workflow: Workflow; run: NonNullable<DryRunApi["run"]> }) => {
    const job = run.control.jobs[run.jobId];
    const states = nodeStates(workflow, run.control.runs[run.jobId], job);

    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm text-secondary">
                {job ? `${job.ticket.id} is ${STATUS_META[job.status].label.toLowerCase()}. Step ${run.steps}.` : "Waiting for the job."}
            </p>
            <p role="status" className="sr-only">
                {run.finished && job ? `Dry run finished after ${run.steps} steps. ${job.ticket.id} is ${STATUS_META[job.status].label.toLowerCase()}.` : ""}
            </p>
            <ul aria-label="Step states" className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                {workflow.nodes.map((node) => {
                    const state = states[node.id] ?? "idle";
                    return (
                        <li key={node.id} className="flex items-center justify-between gap-2">
                            <span className="truncate text-primary">{node.label}</span>
                            <Badge size="sm" color={RUN_STATE[state].color}>
                                {RUN_STATE[state].label}
                            </Badge>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
