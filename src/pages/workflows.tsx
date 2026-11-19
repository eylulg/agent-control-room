import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@eylulg/ui/button";
import { Kbd } from "@eylulg/ui/kbd";
import { Rocket, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { Canvas } from "@/components/workflow/canvas";
import { Inspector } from "@/components/workflow/inspector";
import { ExportButton, ImportButton } from "@/components/workflow/io-dialogs";
import { OutlineView } from "@/components/workflow/outline-view";
import { Palette } from "@/components/workflow/palette";
import { ProblemsPanel } from "@/components/workflow/problems-panel";
import { RunPanel } from "@/components/workflow/run-panel";
import { DraftBadge, EditToolbar, ZoomControls } from "@/components/workflow/toolbar";
import { useDryRun } from "@/components/workflow/use-dry-run";
import { generateWorkflow } from "@/domain/workflow/generate";
import { liveOverlay, runOverlay } from "@/domain/workflow/overlay";
import { useAppStore } from "@/state/store-context";
import { useCommand } from "@/state/use-command";
import { useEditor, useEditorStore } from "@/state/workflow-context";

const SHORTCUTS: [string, string][] = [
    ["Tab", "Enter the canvas. Tab again leaves it."],
    ["Arrow keys", "Move between steps in the order a job meets them."],
    ["Home, End", "First or last step."],
    ["Space", "Select or unselect the focused step."],
    ["Enter", "Open the step's actions: connect, disconnect, edit settings, duplicate, delete."],
    ["Alt + arrow keys", "Move the focused step one grid step. Add Shift for five."],
    ["Delete", "Delete the selected steps or connection."],
    ["Cmd or Ctrl + D", "Duplicate the selected steps."],
    ["Cmd or Ctrl + Z", "Undo. Add Shift to redo."],
    ["Cmd or Ctrl + wheel", "Zoom. The wheel alone pans."],
];

const isEditable = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export const WorkflowsPage = () => {
    const editor = useEditorStore();
    const { run, error } = useCommand();
    const control = useAppStore((s) => s.control);
    const view = useEditor((s) => s.view);
    const dirty = useEditor((s) => s.dirty);
    const invalid = useEditor((s) => s.analysis.problems.length > 0);
    const draft = useEditor((s) => s.history.present);
    const published = useEditor((s) => s.published);
    const [showLive, setShowLive] = useState(true);
    const [traceJobId, setTraceJobId] = useState<string | null>(null);
    const [status, setStatus] = useState("");
    const statusRef = useRef<HTMLParagraphElement>(null);
    const dry = useDryRun();

    const overlay = useMemo(() => {
        if (dry.run) return runOverlay(dry.run.workflow, dry.run.control.runs[dry.run.jobId], dry.run.control.jobs[dry.run.jobId]);
        const traced = traceJobId ? control.runs[traceJobId] : undefined;
        if (traced) {
            const workflow = control.workflows.find((candidate) => candidate.revision === traced.revision)?.workflow ?? published;
            return runOverlay(workflow, traced, control.jobs[traceJobId ?? ""]);
        }
        return showLive ? liveOverlay(control) : null;
    }, [dry.run, traceJobId, showLive, control, published]);

    useEffect(() => {
        editor.getState().setOverlay(overlay);
    }, [editor, overlay]);

    useEffect(() => () => editor.getState().setOverlay(null), [editor]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || isEditable(event.target)) return;
            const key = event.key.toLowerCase();
            if (key === "z") {
                event.preventDefault();
                if (event.shiftKey) editor.getState().redo();
                else editor.getState().undo();
            } else if (key === "y") {
                event.preventDefault();
                editor.getState().redo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [editor]);

    async function handlePublish() {
        if (!(await run({ type: "workflow.publish", workflow: draft }))) return;
        setStatus("Published. Jobs created from now on use it. Running jobs keep their version.");
        statusRef.current?.focus();
    }

    function handleRevert() {
        editor.getState().replace(published, "Discard draft changes");
    }

    function handleLoadLarge() {
        editor.getState().replace(generateWorkflow(200), "Load generated workflow");
        editor.getState().fit();
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Workflows"
                description="What a job does, as a graph. Jobs walk the version that was published when they started. Edit a draft, check it with a dry run, then publish it."
                actions={
                    <div className="flex flex-wrap gap-2">
                        <ImportButton />
                        <ExportButton />
                        <Button variant="secondary" size="sm" iconLeading={Undo2} onPress={handleRevert} isDisabled={!dirty}>
                            Discard draft changes
                        </Button>
                        <Button size="sm" iconLeading={Rocket} onPress={handlePublish} isDisabled={invalid || !dirty}>
                            Publish workflow
                        </Button>
                    </div>
                }
            />
            <p ref={statusRef} tabIndex={-1} role="status" className={status ? "text-sm font-medium text-secondary" : "sr-only"}>
                {status}
            </p>
            {error && (
                <p role="alert" className="text-sm font-medium text-error">
                    {error}
                </p>
            )}
            <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)_20rem]">
                <Panel title="Add a step">
                    <Palette />
                    <p className="mt-3 text-xs text-tertiary">Press a step to add it at the centre of the canvas, or drag it onto the canvas.</p>
                    {import.meta.env.DEV && (
                        <Button className="mt-3" size="sm" variant="secondary" onPress={handleLoadLarge}>
                            Load 200 steps
                        </Button>
                    )}
                </Panel>
                <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <EditToolbar />
                        <div className="flex items-center gap-3">
                            <DraftBadge />
                            {view === "canvas" && <ZoomControls />}
                        </div>
                    </div>
                    {view === "canvas" ? (
                        <div className="h-[34rem]">
                            <Canvas />
                        </div>
                    ) : (
                        <Panel>
                            <OutlineView />
                        </Panel>
                    )}
                    <details className="rounded-lg border border-default p-3 text-sm">
                        <summary className="cursor-pointer font-medium text-primary">Keyboard shortcuts</summary>
                        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
                            {SHORTCUTS.map(([keys, action]) => (
                                <div key={keys} className="contents">
                                    <dt>
                                        <Kbd>{keys}</Kbd>
                                    </dt>
                                    <dd className="text-secondary">{action}</dd>
                                </div>
                            ))}
                        </dl>
                    </details>
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                    <Panel title="Settings">
                        <Inspector />
                    </Panel>
                    <Panel title="Problems">
                        <ProblemsPanel />
                    </Panel>
                </div>
            </div>
            <Panel title="Execution">
                <RunPanel showLive={showLive} onShowLive={setShowLive} traceJobId={traceJobId} onTrace={setTraceJobId} dry={dry} />
            </Panel>
        </div>
    );
};
