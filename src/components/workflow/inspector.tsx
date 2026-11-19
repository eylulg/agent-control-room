import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@eylulg/ui/button";
import { Checkbox } from "@eylulg/ui/checkbox";
import { Input } from "@eylulg/ui/input";
import { Select, SelectItem } from "@eylulg/ui/select";
import { Copy, Trash2 } from "lucide-react";
import type { Key } from "react-aria-components";
import { JOB_KINDS, type JobKind } from "@/domain/types";
import {
    CONDITION_FIELDS,
    CONDITION_OPERATORS,
    GUARD_NODE_ACTIONS,
    NODE_META,
    type NodeConfigs,
    type NodeType,
    type WorkflowNode,
} from "@/domain/workflow/types";
import { configErrors } from "@/domain/workflow/validate";
import { useEditor, useEditorStore } from "@/state/workflow-context";
import { KIND_LABEL } from "@/utils/format";

type Patch = (config: Partial<NodeConfigs[NodeType]>) => void;

const FIELD_LABEL = { kind: "Job kind", repo: "Repository", attempt: "Attempt count" } as const;
const OPERATOR_LABEL = { equals: "Equals", "not-equals": "Does not equal", "at-least": "At least" } as const;
const GUARD_LABEL = { merge: "Merging", "skip-hooks": "Skipping git hooks", "post-as-owner": "Posting as the owner" } as const;

const whole = (text: string, min: number, max: number): boolean => /^\d+$/.test(text.trim()) && Number(text) >= min && Number(text) <= max;

/** Settings for the one selected step, or the actions for several. Every change is one undoable command. */
export const Inspector = () => {
    const store = useEditorStore();
    const selected = useEditor((s) => s.selected);
    const node = useEditor((s) => (s.selected.length === 1 ? s.byId.get(s.selected[0] ?? "") : undefined));

    if (selected.length === 0) return <p className="text-sm text-tertiary">Select a step to edit its settings. Press Enter on a step to open its actions.</p>;
    if (!node) {
        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-secondary">{selected.length} steps selected.</p>
                <Actions ids={selected} store={store} />
            </div>
        );
    }
    return <NodeForm node={node} />;
};

const Actions = ({ ids, store }: { ids: readonly string[]; store: ReturnType<typeof useEditorStore> }) => {
    function handleDuplicate() {
        store.getState().duplicate(ids);
    }
    function handleDelete() {
        store.getState().deleteIds(ids);
    }
    return (
        <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" iconLeading={Copy} onPress={handleDuplicate}>
                Duplicate
            </Button>
            <Button size="sm" variant="destructive-outline" iconLeading={Trash2} onPress={handleDelete}>
                Delete
            </Button>
        </div>
    );
};

const NodeForm = ({ node }: { node: WorkflowNode }) => {
    const store = useEditorStore();
    const request = useEditor((s) => s.inspectorRequest);
    const [label, setLabel] = useState<string | null>(null);
    const seen = useRef(request);
    const labelInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (request === seen.current) return;
        seen.current = request;
        labelInput.current?.focus();
    }, [request]);

    const shown = label ?? node.label;
    const errors = configErrors({ ...node, label: shown });

    function handleLabelBlur() {
        if (label === null) return;
        if (!configErrors({ ...node, label }).label) store.getState().updateNode(node.id, { label: label.trim() });
        setLabel(null);
    }

    const patch: Patch = (config) => store.getState().updateNode(node.id, { config });

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
    }

    return (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <p className="text-sm text-secondary">{NODE_META[node.type].description}</p>
            <Input ref={labelInput} label="Label" value={shown} onChange={setLabel} onBlur={handleLabelBlur} errorMessage={errors.label} size="sm" />
            <TypeFields node={node} errors={errors} patch={patch} />
            <Actions ids={[node.id]} store={store} />
        </form>
    );
};

const TypeFields = ({ node, errors, patch }: { node: WorkflowNode; errors: Record<string, string>; patch: Patch }) => {
    switch (node.type) {
        case "trigger":
            return <KindsField kinds={node.config.kinds} error={errors.kinds} patch={patch} />;
        case "implement":
            return <ModeField mode={node.config.mode} patch={patch} />;
        case "ci":
            return (
                <NumberField
                    label="Failures before the job fails"
                    value={node.config.maxAttempts}
                    error={errors.maxAttempts}
                    hint="Bounds the loop through the Fail port."
                    onCommit={(maxAttempts) => patch({ maxAttempts })}
                />
            );
        case "review":
            return (
                <NumberField
                    label="Finding rounds before moving on"
                    value={node.config.maxRounds}
                    error={errors.maxRounds}
                    hint="Bounds the loop through the Findings port."
                    onCommit={(maxRounds) => patch({ maxRounds })}
                />
            );
        case "condition":
            return <ConditionFields config={node.config} errors={errors} patch={patch} />;
        case "guard":
            return <GuardField action={node.config.action} patch={patch} />;
        case "end":
            return <OutcomeField outcome={node.config.outcome} patch={patch} />;
        default:
            return <p className="text-sm text-tertiary">This step has no settings besides its label.</p>;
    }
};

const ModeField = ({ mode, patch }: { mode: NodeConfigs["implement"]["mode"]; patch: Patch }) => {
    function handleChange(key: Key | null) {
        if (key !== null) patch({ mode: key === "fix" ? "fix" : "build" });
    }
    return (
        <Select label="What it does" selectedKey={mode} onSelectionChange={handleChange} hint="A fix step repairs a failed CI run or answers a review finding.">
            <SelectItem id="build">Build: push commits and open the pull request</SelectItem>
            <SelectItem id="fix">Fix: repair what failed</SelectItem>
        </Select>
    );
};

const GuardField = ({ action, patch }: { action: NodeConfigs["guard"]["action"]; patch: Patch }) => {
    function handleChange(key: Key | null) {
        const next = GUARD_NODE_ACTIONS.find((candidate) => candidate === key);
        if (next) patch({ action: next });
    }
    return (
        <Select label="Action to check" selectedKey={action} onSelectionChange={handleChange}>
            {GUARD_NODE_ACTIONS.map((item) => (
                <SelectItem key={item} id={item}>
                    {GUARD_LABEL[item]}
                </SelectItem>
            ))}
        </Select>
    );
};

const OutcomeField = ({ outcome, patch }: { outcome: NodeConfigs["end"]["outcome"]; patch: Patch }) => {
    function handleChange(key: Key | null) {
        if (key !== null) patch({ outcome: key === "failed" ? "failed" : "done" });
    }
    return (
        <Select label="Outcome" selectedKey={outcome} onSelectionChange={handleChange}>
            <SelectItem id="done">Job done</SelectItem>
            <SelectItem id="failed">Job failed</SelectItem>
        </Select>
    );
};

const KindsField = ({ kinds, error, patch }: { kinds: JobKind[]; error?: string; patch: Patch }) => {
    function handleChange(kind: JobKind) {
        return (checked: boolean) => patch({ kinds: JOB_KINDS.filter((candidate) => (candidate === kind ? checked : kinds.includes(candidate))) });
    }
    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-secondary">Job kinds it accepts</legend>
            {JOB_KINDS.map((kind) => (
                <Checkbox key={kind} isSelected={kinds.includes(kind)} onChange={handleChange(kind)}>
                    {KIND_LABEL[kind]}
                </Checkbox>
            ))}
            {error && (
                <p role="alert" className="text-sm text-error">
                    {error}
                </p>
            )}
        </fieldset>
    );
};

interface NumberFieldProps {
    label: string;
    value: number;
    error?: string;
    hint: string;
    onCommit: (value: number) => void;
}

const NumberField = ({ label, value, error, hint, onCommit }: NumberFieldProps) => {
    const [draft, setDraft] = useState<string | null>(null);
    const shown = draft ?? String(value);
    const invalid = draft !== null && !whole(draft, 1, 10);

    function handleBlur() {
        if (draft === null || invalid) return;
        onCommit(Number(draft));
        setDraft(null);
    }

    return (
        <Input
            label={label}
            size="sm"
            inputMode="numeric"
            value={shown}
            onChange={setDraft}
            onBlur={handleBlur}
            hint={hint}
            errorMessage={invalid ? "Enter a whole number from 1 to 10." : error}
        />
    );
};

const ConditionFields = ({ config, errors, patch }: { config: NodeConfigs["condition"]; errors: Record<string, string>; patch: Patch }) => {
    const [value, setValue] = useState<string | null>(null);
    const shown = value ?? config.value;

    function handleField(key: Key | null) {
        const field = CONDITION_FIELDS.find((candidate) => candidate === key);
        if (!field) return;
        // Each field has its own natural operator and a value that fits it.
        patch({ field, operator: field === "attempt" ? "at-least" : "equals", value: field === "kind" ? "feature" : field === "repo" ? "acme/web" : "2" });
    }
    function handleOperator(key: Key | null) {
        const operator = CONDITION_OPERATORS.find((candidate) => candidate === key);
        if (operator) patch({ operator });
    }
    function handleKind(key: Key | null) {
        if (key !== null) patch({ value: String(key) });
    }
    function handleValueBlur() {
        if (value === null) return;
        patch({ value: value.trim() });
        setValue(null);
    }

    return (
        <div className="flex flex-col gap-3">
            <Select label="Check" selectedKey={config.field} onSelectionChange={handleField}>
                {CONDITION_FIELDS.map((field) => (
                    <SelectItem key={field} id={field}>
                        {FIELD_LABEL[field]}
                    </SelectItem>
                ))}
            </Select>
            <Select label="Comparison" selectedKey={config.operator} onSelectionChange={handleOperator} errorMessage={errors.operator}>
                {CONDITION_OPERATORS.map((operator) => (
                    <SelectItem key={operator} id={operator}>
                        {OPERATOR_LABEL[operator]}
                    </SelectItem>
                ))}
            </Select>
            {config.field === "kind" ? (
                <Select label="Job kind" selectedKey={config.value} onSelectionChange={handleKind} errorMessage={errors.value}>
                    {JOB_KINDS.map((kind) => (
                        <SelectItem key={kind} id={kind}>
                            {KIND_LABEL[kind]}
                        </SelectItem>
                    ))}
                </Select>
            ) : (
                <Input
                    label={config.field === "repo" ? "Repository" : "Attempt number"}
                    size="sm"
                    value={shown}
                    onChange={setValue}
                    onBlur={handleValueBlur}
                    errorMessage={errors.value}
                    hint={config.field === "repo" ? "For example acme/web." : "The job's attempt, starting at 1."}
                />
            )}
        </div>
    );
};
