import { useMemo } from "react";
import { Link } from "react-router";
import { EventRow } from "@/components/app/event-row";
import { Card, PageHeader } from "@/components/app/page-header";
import { Sparkline } from "@/components/app/sparkline";
import { StatTile } from "@/components/app/stat-tile";
import { StatusBadge } from "@/components/app/status-badge";
import { useHealth } from "@/components/app/use-health";
import { countByStatus, listJobs, pendingApprovals, throughput } from "@/domain/selectors";
import { SIM_EPOCH, TICK_MS } from "@/domain/simulator";
import { JOB_STATUSES } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { formatClock } from "@/utils/format";

const BUCKETS = 12;
const BUCKET_MS = 10 * TICK_MS;

export const OverviewPage = () => {
    const control = useAppStore((s) => s.control);
    const sim = useAppStore((s) => s.sim);
    const health = useHealth();

    const jobs = useMemo(() => listJobs(control), [control]);
    const counts = useMemo(() => countByStatus(jobs), [jobs]);
    const now = sim ? SIM_EPOCH + sim.tick * TICK_MS : (control.health.lastHeartbeat ?? SIM_EPOCH);
    const series = throughput(control.completions, now, BUCKET_MS, BUCKETS);
    const points = series.map((value, i) => ({ value, label: `10 minutes to ${formatClock(now - BUCKET_MS * (BUCKETS - 1 - i))}` }));
    const completedRecent = series.reduce((a, b) => a + b, 0);
    const active = jobs.length - counts.done - counts.failed;
    const approvals = pendingApprovals(control).length;
    const blocks = control.guards.reduce((sum, guard) => sum + guard.blocked.length, 0);
    const maxCount = Math.max(1, ...JOB_STATUSES.map((status) => counts[status]));
    const recent = control.events
        .filter((event) => event.type !== "health.heartbeat")
        .slice(-10)
        .reverse();

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Overview" description="What the agent is doing right now, and where it needs a human." />

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Active jobs" value={active} context={`${counts.queued} queued, ${counts["on-hold"]} on hold`} />
                <StatTile
                    label="Waiting on you"
                    value={approvals}
                    context={
                        <Link to="/approvals" className="rounded-xs font-medium text-brand-secondary underline-offset-2 hover:underline">
                            Open approvals inbox
                        </Link>
                    }
                />
                <StatTile label="Guard blocks" value={blocks} context="Forbidden actions stopped since start" />
                <StatTile
                    label="Completed in the last 2 hours"
                    value={completedRecent}
                    context="Jobs per 10 simulated minutes"
                    trend={<Sparkline points={points} label="Completed jobs per 10 minutes over the last 2 hours" unit="done" />}
                />
            </dl>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Card title="Agent health">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <dt className="text-tertiary">State</dt>
                        <dd className="font-medium text-primary">{health.label}</dd>
                        <dt className="text-tertiary">Last heartbeat</dt>
                        <dd className="font-medium text-primary">{control.health.lastHeartbeat ? formatClock(control.health.lastHeartbeat) : "None yet"}</dd>
                        <dt className="text-tertiary">Tick</dt>
                        <dd className="font-medium text-primary">{sim?.tick ?? control.health.tick}</dd>
                        <dt className="text-tertiary">Working on</dt>
                        <dd className="font-medium text-primary">{control.health.activeJobs} jobs</dd>
                    </dl>
                </Card>

                <Card title="Jobs by status" className="xl:col-span-2">
                    <table className="w-full text-sm">
                        <caption className="sr-only">Number of jobs in each status</caption>
                        <thead className="sr-only">
                            <tr>
                                <th scope="col">Status</th>
                                <th scope="col">Jobs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {JOB_STATUSES.map((status) => (
                                <tr key={status}>
                                    <th scope="row" className="w-40 py-1 pr-3 text-left font-normal sm:w-48">
                                        <StatusBadge status={status} />
                                    </th>
                                    <td className="py-1">
                                        <span className="flex items-center gap-2">
                                            {counts[status] > 0 && (
                                                <span
                                                    aria-hidden="true"
                                                    className="h-2 max-w-[calc(100%-2.5rem)] rounded-r bg-[var(--viz-series-1)]"
                                                    style={{ width: `${(counts[status] / maxCount) * 100}%` }}
                                                />
                                            )}
                                            <span className="font-medium text-secondary tabular-nums">{counts[status]}</span>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            </div>

            <Card title="Recent events">
                {recent.length === 0 ? (
                    <p className="text-sm text-tertiary">No events yet. Run the simulation to see the agent work.</p>
                ) : (
                    <ol className="divide-y divide-secondary">
                        {recent.map((event) => (
                            <EventRow key={event.seq} event={event} jobs={control.jobs} />
                        ))}
                    </ol>
                )}
            </Card>
        </div>
    );
};
