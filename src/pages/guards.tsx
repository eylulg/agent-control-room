import { Link } from "react-router";
import { Card, PageHeader } from "@/components/app/page-header";
import { inlineLink, surface } from "@/components/app/styles";
import { Toggle } from "@/components/base/toggle/toggle";
import type { Guard } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { useCommand } from "@/state/use-command";
import { formatClock } from "@/utils/format";

interface GuardRuleProps {
    guard: Guard;
}

const LOG_LIMIT = 50;

export const GuardsPage = () => {
    const guards = useAppStore((s) => s.control.guards);
    const jobs = useAppStore((s) => s.control.jobs);

    const log = guards
        .flatMap((guard) => guard.blocked.map((entry) => ({ ...entry, rule: guard.rule })))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, LOG_LIMIT);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Guards"
                description="Hard rules the agent cannot break. Every blocked attempt is logged. Switching a guard off lets the action through, which is logged too."
            />
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {guards.map((guard) => (
                    <GuardRule key={guard.id} guard={guard} />
                ))}
            </ul>
            <Card title="Blocked attempts">
                {log.length === 0 ? (
                    <p className="text-sm text-tertiary">No blocked attempts yet.</p>
                ) : (
                    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Blocked attempts table">
                        <table className="w-full min-w-[36rem] text-left text-sm">
                            <thead className="text-xs text-tertiary">
                                <tr>
                                    <th scope="col" className="py-2 pr-3 font-medium">
                                        Time
                                    </th>
                                    <th scope="col" className="py-2 pr-3 font-medium">
                                        Job
                                    </th>
                                    <th scope="col" className="py-2 pr-3 font-medium">
                                        Rule
                                    </th>
                                    <th scope="col" className="py-2 font-medium">
                                        Attempt
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary">
                                {log.map((entry) => (
                                    <tr key={`${entry.ts}-${entry.jobId}-${entry.action}`}>
                                        <td className="py-2 pr-3 text-tertiary tabular-nums">{formatClock(entry.ts)}</td>
                                        <td className="py-2 pr-3">
                                            <Link to={`/jobs/${entry.jobId}`} className={inlineLink}>
                                                {jobs[entry.jobId]?.ticket.id ?? entry.jobId}
                                            </Link>
                                        </td>
                                        <td className="py-2 pr-3 text-secondary">{entry.rule}</td>
                                        <td className="py-2 text-secondary">{entry.detail}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

const GuardRule = ({ guard }: GuardRuleProps) => {
    const { run, error } = useCommand();

    function handleChange(enabled: boolean) {
        return run({ type: "guard.toggle", guardId: guard.id, enabled });
    }

    return (
        <li className={surface}>
            <Toggle className="w-full min-w-0" size="md" label={guard.rule} hint={guard.description} isSelected={guard.enabled} onChange={handleChange} />
            <p className="mt-3 text-sm text-tertiary">
                {guard.enabled ? "On" : "Off"}. Blocked {guard.blocked.length} {guard.blocked.length === 1 ? "time" : "times"}.
            </p>
            {error && (
                <p role="alert" className="mt-2 text-sm font-medium text-error-primary">
                    {error}
                </p>
            )}
        </li>
    );
};
