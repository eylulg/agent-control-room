import { Button } from "@eylulg/ui/button";
import { IconButton } from "@eylulg/ui/icon-button";
import { Select, SelectItem } from "@eylulg/ui/select";
import { Copy, Trash2, TriangleAlert } from "lucide-react";
import type { Key } from "react-aria-components";
import { validTargets } from "@/domain/workflow/ops";
import { NODE_META, PORTS, type PortSpec } from "@/domain/workflow/types";
import { useEditor, useEditorStore } from "@/state/workflow-context";
import { outlineDomId } from "./geometry";

const NONE = "none";

/**
 * The same graph as one flat list, in the order a job meets the steps. Each step lists its ports, and each port has a select that
 * chooses where it leads, so everything the canvas does with a pointer can be done here with a keyboard or a screen reader.
 * The list never nests, so it reads the same with ten steps or two hundred, and it fits a phone.
 */
export const OutlineView = () => {
    const order = useEditor((s) => s.analysis.order);

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-secondary">
                Steps are listed in the order a job meets them. Choose where each port leads to connect it, or choose Not connected to remove the connection.
            </p>
            <ol aria-label="Workflow outline" className="flex flex-col gap-3">
                {order.map((id) => (
                    <StepItem key={id} id={id} />
                ))}
            </ol>
        </div>
    );
};

const StepItem = ({ id }: { id: string }) => {
    const store = useEditorStore();
    const node = useEditor((s) => s.byId.get(id));
    const name = useEditor((s) => s.analysis.names[id] ?? id);
    const selected = useEditor((s) => s.selected.includes(id));
    const problems = useEditor((s) => s.analysis.problemsByNode[id] ?? 0);
    const description = useEditor((s) => s.analysis.descriptions[id] ?? "");

    function handleSelect() {
        store.getState().select(id, false);
    }
    function handleDuplicate() {
        store.getState().duplicate([id]);
    }
    function handleDelete() {
        store.getState().deleteIds([id]);
    }

    if (!node) return null;
    const ports = PORTS[node.type];

    return (
        <li className="flex flex-col gap-2 rounded-md border border-default bg-primary p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Button
                    id={outlineDomId(id)}
                    variant={selected ? "primary" : "secondary"}
                    size="sm"
                    onPress={handleSelect}
                    aria-describedby={`${outlineDomId(id)}-description`}
                    aria-current={selected ? "true" : undefined}
                >
                    {name}
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
                        aria-label={`Duplicate ${name}`}
                        isDisabled={node.type === "trigger"}
                        onPress={handleDuplicate}
                    />
                    <IconButton variant="tertiary" size="sm" icon={Trash2} aria-label={`Delete ${name}`} onPress={handleDelete} />
                </span>
            </div>
            <p id={`${outlineDomId(id)}-description`} className="sr-only">
                {description}
            </p>
            {ports.map((port) => (
                <PortRow key={port.id} nodeId={id} stepName={name} port={port} />
            ))}
        </li>
    );
};

const PortRow = ({ nodeId, stepName, port }: { nodeId: string; stepName: string; port: PortSpec }) => {
    const store = useEditorStore();
    const workflow = useEditor((s) => s.history.present);
    const names = useEditor((s) => s.analysis.names);
    const edge = workflow.edges.find((candidate) => candidate.from.node === nodeId && candidate.from.port === port.id);
    const targets = validTargets(workflow, nodeId, port.id);

    function handleChange(key: Key | null) {
        if (key === null) return;
        const state = store.getState();
        if (key === NONE) {
            if (edge) state.disconnectEdge(edge.id);
        } else {
            state.connect(nodeId, port.id, String(key));
        }
    }

    return (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span aria-hidden="true" className="text-sm text-secondary sm:w-36 sm:shrink-0">
                {port.label} goes to
            </span>
            <Select
                aria-label={`${stepName}, ${port.label} goes to`}
                selectedKey={edge?.to ?? NONE}
                onSelectionChange={handleChange}
                className="min-w-0 flex-1"
            >
                <SelectItem id={NONE}>Not connected</SelectItem>
                {targets.map((target) => (
                    <SelectItem key={target.id} id={target.id}>
                        {names[target.id] ?? target.label}
                    </SelectItem>
                ))}
            </Select>
        </div>
    );
};
