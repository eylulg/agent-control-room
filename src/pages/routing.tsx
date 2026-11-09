import { type FormEvent, useState } from "react";
import { Card, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { DEFAULT_ROUTING, KNOWN_MODELS, validateRouting } from "@/domain/routing";
import { JOB_KINDS, type RoutingTable } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { KIND_LABEL } from "@/utils/format";

export const RoutingPage = () => {
    const routing = useAppStore((s) => s.control.routing);
    const send = useAppStore((s) => s.send);
    const [draft, setDraft] = useState<RoutingTable>(routing);
    const [status, setStatus] = useState("");

    const errors = validateRouting(draft);
    const invalid = Object.keys(errors).length > 0;
    const dirty = JOB_KINDS.some((kind) => draft[kind].trim() !== routing[kind]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (invalid) {
            setStatus("Fix the highlighted rows before saving.");
            return;
        }
        const next = Object.fromEntries(JOB_KINDS.map((kind) => [kind, draft[kind].trim()])) as RoutingTable;
        await send({ type: "routing.set", routing: next });
        setDraft(next);
        setStatus("Routing saved. New jobs and retries use it from now on.");
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Routing"
                description="Which model the agent uses for each kind of job. Changes apply to jobs created or retried after you save. Running jobs keep their model."
            />
            <Card title="Routing table">
                <form onSubmit={save} noValidate className="flex flex-col gap-4">
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
                                <tr key={kind} className="align-top">
                                    <th scope="row" className="py-2 pr-3 text-left font-medium text-primary">
                                        <span className="inline-block pt-2.5">{KIND_LABEL[kind]}</span>
                                    </th>
                                    <td className="py-2">
                                        <Input
                                            aria-label={`Model for ${KIND_LABEL[kind]} jobs`}
                                            value={draft[kind]}
                                            onChange={(value) => setDraft((current) => ({ ...current, [kind]: value }))}
                                            isInvalid={Boolean(errors[kind])}
                                            hint={errors[kind]}
                                            size="sm"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="text-xs text-tertiary">
                        Known models: {KNOWN_MODELS.join(", ")}. Any lowercase name works, so a real backend can route to its own models.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" size="sm" isDisabled={!dirty}>
                            Save routing
                        </Button>
                        <Button size="sm" color="secondary" onPress={() => setDraft(DEFAULT_ROUTING)}>
                            Restore defaults
                        </Button>
                    </div>
                    <p role="status" className="text-sm font-medium text-secondary empty:hidden">
                        {status}
                    </p>
                </form>
            </Card>
        </div>
    );
};
