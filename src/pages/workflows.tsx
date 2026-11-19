import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@eylulg/ui/button";
import { Kbd } from "@eylulg/ui/kbd";
import { Rocket, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { Canvas } from "@/components/workflow/canvas";
import { EditorLiveRegion } from "@/components/workflow/editor-live-region";
import { useFocusRequests } from "@/components/workflow/focus-step";
import { Inspector } from "@/components/workflow/inspector";
import { ExportButton, ImportButton } from "@/components/workflow/io-dialogs";
import { OutlineView } from "@/components/workflow/outline-view";
import { Palette } from "@/components/workflow/palette";
import { ProblemsPanel } from "@/components/workflow/problems-panel";
import { RunPanel } from "@/components/workflow/run-panel";
import { DraftBadge, EditToolbar, ZoomControls } from "@/components/workflow/toolbar";
import { type DryRun, useDryRun } from "@/components/workflow/use-dry-run";
import { generateWorkflow } from "@/domain/workflow/generate";
import { liveOverlay, runOverlay } from "@/domain/workflow/overlay";
import { useAppStore } from "@/state/store-context";
import { useCommand } from "@/state/use-command";
import { useEditor, useEditorStore } from "@/state/workflow-context";
import { WorkflowEditorProvider } from "@/state/workflow-provider";

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
    ["Cmd or Ctrl + wheel", "Zoom. The wheel alone scrolls the page. Drag the background to pan."],
];

const isEditable = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export const WorkflowsPage = () => (
    <WorkflowEditorProvider>
        <WorkflowsView />
    </WorkflowEditorProvider>
);

/**
 * Computes what the canvas shows for the simulator's jobs, a traced job or a dry run, and hands it to the editor. It renders nothing, and it is
 * the only thing here that follows the simulator, so an event re-renders this and the steps whose overlay changed, not the whole page.
 */
const OverlayBridge = ({ dry, showLive, traceJobId }: { dry: DryRun | null; showLive: boolean; traceJobId: string | null }) => {
    const editor = useEditorStore();
    const control = useAppStore((s) => s.control);

    const overlay = useMemo(() => {
        if (dry) return runOverlay(dry.workflow, dry.control.runs[dry.jobId], dry.control.jobs[dry.jobId]);
        const traced = traceJobId ? control.runs[traceJobId] : undefined;
        if (traced) {
            // Only the last versions are kept. Drawing the path on a different graph would light the wrong steps, so a missing one draws nothing.
            const workflow = control.workflows.find((candidate) => candidate.revision === traced.revision)?.workflow;
            return workflow ? runOverlay(workflow, traced, control.jobs[traceJobId ?? ""]) : null;
        }
        return showLive ? liveOverlay(control) : null;
    }, [dry, traceJobId, showLive, control]);

    useEffect(() => {
        editor.getState().setOverlay(overlay);
    }, [editor, overlay]);

    useEffect(() => () => editor.getState().setOverlay(null), [editor]);

    return null;
};

const WorkflowsView = () => {
    const editor = useEditorStore();
    const { run, error } = useCommand();
    const view = useEditor((s) => s.view);
    const dirty = useEditor((s) => s.dirty);
    const invalid = useEditor((s) => s.analysis.problems.length > 0);
    const [showLive, setShowLive] = useState(true);
    const [traceJobId, setTraceJobId] = useState<string | null>(null);
    const [status, setStatus] = useState("");
    const statusRef = useRef<HTMLParagraphElement>(null);
    const dry = useDryRun();
    useFocusRequests();

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
        if (!(await run({ type: "workflow.publish", workflow: editor.getState().history.present }))) return;
        setStatus("Published. Jobs created from now on use it. Running jobs keep their version.");
        statusRef.current?.focus();
    }

    function handleRevert() {
        editor.getState().replace(editor.getState().published, "Discard draft changes");
        editor.getState().requestFocus(true);
    }

    function handleLoadLarge() {
        editor.getState().replace(generateWorkflow(200), "Load generated workflow");
        editor.getState().fit();
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Workflows"
                description="What a job does, as a graph. Edit a draft, check it with a dry run, then publish it. A job keeps the version it started on."
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
            <OverlayBridge dry={dry.run} showLive={showLive} traceJobId={traceJobId} />
            <EditorLiveRegion />
            <p ref={statusRef} tabIndex={-1} role="status" className={status ? "text-sm font-medium text-secondary" : "sr-only"}>
                {status}
            </p>
            {error && (
                <p role="alert" className="text-sm font-medium text-error">
                    {error}
                </p>
            )}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex min-w-0 flex-col gap-4">
                    <section aria-labelledby="wf-palette-title" className="flex flex-col gap-2">
                        <h2 id="wf-palette-title" className="text-sm font-semibold text-primary">
                            Add a step
                        </h2>
                        <Palette />
                        <p className="text-xs text-tertiary">Press a step to add it at the centre of the canvas, or drag it onto the canvas.</p>
                        {import.meta.env.DEV && (
                            <Button className="self-start" size="sm" variant="secondary" onPress={handleLoadLarge}>
                                Load 200 steps
                            </Button>
                        )}
                    </section>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <EditToolbar />
                        <DraftBadge />
                    </div>
                    {view === "canvas" ? (
                        <div className="relative h-[30rem]">
                            <Canvas />
                            <div className="absolute right-3 bottom-3 rounded-lg bg-primary p-1 shadow-xs">
                                <ZoomControls />
                            </div>
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
