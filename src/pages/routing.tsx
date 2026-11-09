import { type FormEvent, useState } from "react";
import { Card, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { DEFAULT_ROUTING, KNOWN_MODELS, validateRouting } from "@/domain/routing";
import { JOB_KINDS, type JobKind, type RoutingTable, recordFromKeys } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { useCommand } from "@/state/use-command";
import { KIND_LABEL } from "@/utils/format";

interface RoutingEditorProps {
    routing: RoutingTable;
    onSave: (routing: RoutingTable) => Promise<void>;
}

interface RoutingRowProps {
    kind: JobKind;
    value: string;
    error?: string;
    onChange: (kind: JobKind, value: string) => void;
}

export const RoutingPage = () => {
    const routing = useAppStore((s) => s.control.routing);
    const { run, error } = useCommand();
    const [status, setStatus] = useState("");

    // Lives here, not in the editor: a saved table remounts the keyed editor, which would abort its own request.
    async function handleSave(next: RoutingTable) {
        if (await run({ type: "routing.set", routing: next })) setStatus("Routing saved. New jobs and retries use it from now on.");
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Routing"
                description="Which model the agent uses for each kind of job. Changes apply to jobs created or retried after you save. Running jobs keep their model."
            />
            <Card title="Routing table">
                {/* Keyed by the saved table so the draft resets whenever routing changes, here or from the agent. */}
                <RoutingEditor key={JSON.stringify(routing)} routing={routing} onSave={handleSave} />
                <p role="status" className="mt-3 text-sm font-medium text-secondary empty:hidden">
                    {status}
                </p>
                {error && (
                    <p role="alert" className="mt-3 text-sm font-medium text-error-primary">
                        {error}
                    </p>
                )}
            </Card>
        </div>
    );
};

const RoutingEditor = ({ routing, onSave }: RoutingEditorProps) => {
    const [draft, setDraft] = useState<RoutingTable>(routing);

    const trimmed = recordFromKeys(JOB_KINDS, (kind) => draft[kind].trim());
    const errors = validateRouting(trimmed);
    const invalid = Object.keys(errors).length > 0;
    const dirty = JOB_KINDS.some((kind) => trimmed[kind] !== routing[kind]);

    function handleChange(kind: JobKind, value: string) {
        setDraft((current) => ({ ...current, [kind]: value }));
    }

    function handleRestore() {
        setDraft(DEFAULT_ROUTING);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (invalid) return;
        await onSave(trimmed);
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <p className="text-xs text-tertiary">
                Use lowercase letters, digits, dots and hyphens. Known models: {KNOWN_MODELS.join(", ")}. claude-fable-5-1 is the optional strongest tier.
            </p>
            <table className="w-full text-sm">
                <caption className="sr-only">Model per job kind</caption>
                <thead>
                    <tr className="text-left text-xs text-tertiary">
                        <th scope="col" className="w-32 pb-2 font-medium sm:w-48">
                            Job kind
                        </th>
                        <th scope="col" className="pb-2 font-medium">
                            Model
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {JOB_KINDS.map((kind) => (
                        <RoutingRow key={kind} kind={kind} value={draft[kind]} error={errors[kind]} onChange={handleChange} />
                    ))}
                </tbody>
            </table>
            <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" isDisabled={!dirty || invalid}>
                    Save routing
                </Button>
                <Button size="sm" color="secondary" onPress={handleRestore}>
                    Restore defaults
                </Button>
            </div>
        </form>
    );
};

const RoutingRow = ({ kind, value, error, onChange }: RoutingRowProps) => {
    function handleChange(next: string) {
        onChange(kind, next);
    }

    return (
        <tr className="align-top">
            <th scope="row" className="py-2 pr-3 text-left font-medium text-primary">
                <span className="inline-block pt-2">{KIND_LABEL[kind]}</span>
            </th>
            <td className="py-2">
                <Input
                    aria-label={`Model for ${KIND_LABEL[kind]} jobs`}
                    value={value}
                    onChange={handleChange}
                    isInvalid={Boolean(error)}
                    hint={error}
                    size="sm"
                />
            </td>
        </tr>
    );
};
