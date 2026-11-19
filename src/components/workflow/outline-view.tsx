import { useMemo } from "react";
import { Button } from "@eylulg/ui/button";
import { IconButton } from "@eylulg/ui/icon-button";
import { Select, SelectItem } from "@eylulg/ui/select";
import { Copy, Trash2, TriangleAlert } from "lucide-react";
import type { Key } from "react-aria-components";
import { validTargets } from "@/domain/workflow/ops";
import { type OutlinePort, type OutlineStep, buildOutline } from "@/domain/workflow/outline";
import { NODE_META } from "@/domain/workflow/types";
import { useEditor, useEditorStore } from "@/state/workflow-context";
import { outlineDomId } from "./geometry";

const NONE = "none";

/**
 * The same graph as nested lists. A step lists its output ports, and each port has a select that chooses where it leads,
 * so everything the canvas does with a pointer can be done here with a keyboard or a screen reader.
 */
export const OutlineView = () => {
    const workflow = useEditor((s) => s.history.present);
    const outline = useMemo(() => buildOutline(workflow), [workflow]);

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-secondary">
                Each step lists where its ports lead. Choose a target in a port&apos;s list to connect it, or choose Not connected to remove the connection.
            </p>
            <ul aria-label="Workflow outline" className="flex flex-col gap-2">
                {outline.tree.map((step) => (
                    <StepItem key={step.node.id} step={step} />
                ))}
            </ul>
            {outline.loose.length > 0 && (
                <section aria-labelledby="outline-loose" className="flex flex-col gap-2">
                    <h3 id="outline-loose" className="text-sm font-semibold text-primary">
                        Not connected to the trigger
                    </h3>
                    <ul className="flex flex-col gap-2">
                        {outline.loose.map((step) => (
                            <StepItem key={step.node.id} step={step} />
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};

const StepItem = ({ step }: { step: OutlineStep }) => {
    const store = useEditorStore();
    const { node } = step;
    const selected = useEditor((s) => s.selected.includes(node.id));
    const problems = useEditor((s) => s.analysis.problemsByNode[node.id] ?? 0);
    const description = useEditor((s) => s.analysis.descriptions[node.id] ?? "");

    function handleSelect() {
        store.getState().select(node.id, false);
    }
    function handleDuplicate() {
        store.getState().duplicate([node.id]);
    }
    function handleDelete() {
        store.getState().deleteIds([node.id]);
    }

    if (step.repeat) {
        return (
            <li className="text-sm text-tertiary">
                <Button variant="tertiary" size="sm" onPress={handleSelect}>
                    {node.label}
                </Button>
                <span> (listed above)</span>
            </li>
        );
    }

    return (
        <li className="flex flex-col gap-1 rounded-md border border-default bg-primary p-2">
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    id={outlineDomId(node.id)}
                    variant={selected ? "primary" : "secondary"}
                    size="sm"
                    onPress={handleSelect}
                    aria-describedby={`${outlineDomId(node.id)}-description`}
                    aria-current={selected ? "true" : undefined}
                >
                    {node.label}
                </Button>
                <span className="text-xs text-tertiary">{NODE_META[node.type].label}</span>
                {problems > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-error">
                        <TriangleAlert aria-hidden="true" className="size-3.5" />
                        {problems} {problems === 1 ? "problem" : "problems"}
                    </span>
                )}
                <span className="ml-auto flex gap-1">
                    <IconButton
                        variant="tertiary"
                        size="sm"
                        icon={Copy}
                        aria-label={`Duplicate ${node.label}`}
                        isDisabled={node.type === "trigger"}
                        onPress={handleDuplicate}
                    />
                    <IconButton variant="tertiary" size="sm" icon={Trash2} aria-label={`Delete ${node.label}`} onPress={handleDelete} />
                </span>
            </div>
            <p id={`${outlineDomId(node.id)}-description`} className="sr-only">
                {description}
            </p>
            {step.ports.length > 0 && (
                <ul aria-label={`Connections of ${node.label}`} className="ml-3 flex flex-col gap-2 border-l border-default pl-3">
                    {step.ports.map((port) => (
                        <PortItem key={port.port.id} nodeId={node.id} nodeLabel={node.label} port={port} />
                    ))}
                </ul>
            )}
        </li>
    );
};

const PortItem = ({ nodeId, nodeLabel, port }: { nodeId: string; nodeLabel: string; port: OutlinePort }) => {
    const store = useEditorStore();
    const workflow = useEditor((s) => s.history.present);
    const targets = validTargets(workflow, nodeId, port.port.id);

    function handleChange(key: Key | null) {
        if (key === null) return;
        const state = store.getState();
        if (key === NONE) {
            if (port.edge) state.disconnectEdge(port.edge.id);
        } else {
            state.connect(nodeId, port.port.id, String(key));
        }
    }

    return (
        <li className="flex flex-col gap-1">
            <Select aria-label={`${nodeLabel}, ${port.port.label} goes to`} selectedKey={port.edge?.to ?? NONE} onSelectionChange={handleChange}>
                <SelectItem id={NONE}>Not connected</SelectItem>
                {targets.map((target) => (
                    <SelectItem key={target.id} id={target.id}>
                        {`${port.port.label}: ${target.label}`}
                    </SelectItem>
                ))}
            </Select>
            {port.target && (
                <ul className="ml-3 flex flex-col gap-2">
                    <StepItem step={port.target} />
                </ul>
            )}
        </li>
    );
};
