import { type FormEvent, useRef, useState } from "react";
import { Button } from "@eylulg/ui/button";
import { cx } from "@eylulg/ui/cx";
import { Select, SelectItem } from "@eylulg/ui/select";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@eylulg/ui/table";
import type { Key } from "react-aria-components";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { DEFAULT_ROUTING, KNOWN_MODELS } from "@/domain/routing";
import { JOB_KINDS, type JobKind, type RoutingTable } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { useCommand } from "@/state/use-command";
import { KIND_LABEL } from "@/utils/format";

interface RoutingEditorProps {
    routing: RoutingTable;
    onSave: (routing: RoutingTable) => Promise<void>;
}

interface ModelSelectProps {
    kind: JobKind;
    value: string;
    onChange: (kind: JobKind, model: string) => void;
}

export const RoutingPage = () => {
    const routing = useAppStore((s) => s.control.routing);
    const { run, error } = useCommand();
    const [status, setStatus] = useState("");
    const statusRef = useRef<HTMLParagraphElement>(null);

    // Lives here, not in the editor: a saved table remounts the keyed editor, which would abort its own request.
    // Save disables itself once the table is clean, so focus moves to the status line.
    async function handleSave(next: RoutingTable) {
        if (!(await run({ type: "routing.set", routing: next }))) return;
        setStatus("Routing saved. New jobs and retries use it from now on.");
        statusRef.current?.focus();
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Routing"
                description="Which model the agent uses for each kind of job. Changes apply to jobs created or retried after you save. Running jobs keep their model."
            />
            <Panel title="Routing table">
                {/* Keyed by the saved table so the draft resets whenever routing changes, here or from the agent. */}
                <RoutingEditor key={JSON.stringify(routing)} routing={routing} onSave={handleSave} />
                <p ref={statusRef} tabIndex={-1} role="status" className={cx("text-sm font-medium text-secondary", status ? "mt-3" : "sr-only")}>
                    {status}
                </p>
                {error && (
                    <p role="alert" className="mt-3 text-sm font-medium text-error">
                        {error}
                    </p>
                )}
            </Panel>
        </div>
    );
};

const RoutingEditor = ({ routing, onSave }: RoutingEditorProps) => {
    const [draft, setDraft] = useState<RoutingTable>(routing);

    const dirty = JOB_KINDS.some((kind) => draft[kind] !== routing[kind]);

    function handleChange(kind: JobKind, model: string) {
        setDraft((current) => ({ ...current, [kind]: model }));
    }

    function handleRestore() {
        setDraft(DEFAULT_ROUTING);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await onSave(draft);
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-xs text-tertiary">claude-fable-5-1 is the optional strongest tier. No kind routes to it by default.</p>
            <Table aria-label="Model per job kind">
                <TableHeader>
                    <Column isRowHeader>Job kind</Column>
                    <Column>Model</Column>
                </TableHeader>
                <TableBody items={JOB_KINDS.map((kind) => ({ kind }))}>
                    {({ kind }) => (
                        <Row id={kind}>
                            <Cell>{KIND_LABEL[kind]}</Cell>
                            <Cell>
                                <ModelSelect kind={kind} value={draft[kind]} onChange={handleChange} />
                            </Cell>
                        </Row>
                    )}
                </TableBody>
            </Table>
            <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" isDisabled={!dirty}>
                    Save routing
                </Button>
                <Button size="sm" variant="secondary" onPress={handleRestore}>
                    Restore defaults
                </Button>
            </div>
        </form>
    );
};

const ModelSelect = ({ kind, value, onChange }: ModelSelectProps) => {
    // A model set by the agent that is not in the known list stays selectable.
    const models: string[] = KNOWN_MODELS.some((model) => model === value) ? [...KNOWN_MODELS] : [value, ...KNOWN_MODELS];

    function handleSelection(key: Key | null) {
        if (key !== null) onChange(kind, String(key));
    }

    return (
        <Select aria-label={`Model for ${KIND_LABEL[kind]} jobs`} selectedKey={value} onSelectionChange={handleSelection}>
            {models.map((model) => (
                <SelectItem key={model} id={model}>
                    {model}
                </SelectItem>
            ))}
        </Select>
    );
};
