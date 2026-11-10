import { Sparkline } from "@eylulg/ui/stat";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@eylulg/ui/table";
import { Link } from "react-router";
import { EventRow } from "@/components/app/event-row";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { StatTile } from "@/components/app/stat-tile";
import { StatusBadge } from "@/components/app/status-badge";
import { inlineLink } from "@/components/app/styles";
import { useHealth } from "@/components/app/use-health";
import { countByStatus, listJobs, pendingApprovals, throughput } from "@/domain/selectors";
import { SIM_EPOCH, TICK_MS } from "@/domain/simulator";
import { JOB_STATUSES } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { formatClock } from "@/utils/format";

const BUCKETS = 12;
const BUCKET_MS = 10 * TICK_MS;
const RECENT_EVENTS = 10;

export const OverviewPage = () => {
    const control = useAppStore((s) => s.control);
    const sim = useAppStore((s) => s.sim);
    const health = useHealth();

    const jobs = listJobs(control);
    const counts = countByStatus(jobs);
    const now = sim ? SIM_EPOCH + sim.tick * TICK_MS : (control.health.lastHeartbeat ?? SIM_EPOCH);
    const series = throughput(control.completions, now, BUCKET_MS, BUCKETS);
    const sparklineLabel = `Completed jobs per 10 minutes over the last 2 hours. ${series
        .map((value, i) => `10 minutes to ${formatClock(now - BUCKET_MS * (BUCKETS - 1 - i))}: ${value}`)
        .join(", ")}.`;
    const completedRecent = series.reduce((a, b) => a + b, 0);
    const active = jobs.length - counts.done - counts.failed;
    const approvals = pendingApprovals(control).length;
    const blocks = control.guards.reduce((sum, guard) => sum + guard.blocked.length, 0);
    const maxCount = Math.max(1, ...JOB_STATUSES.map((status) => counts[status]));
    const recent = control.events
        .filter((event) => event.type !== "health.heartbeat")
        .slice(-RECENT_EVENTS)
        .reverse();

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Overview" description="What the agent is doing right now, and where it needs a human." />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Active jobs" value={active} context={`${counts.queued} queued, ${counts["on-hold"]} on hold`} />
                <StatTile
                    label="Waiting on you"
                    value={approvals}
                    context={
                        <Link to="/approvals" className={inlineLink}>
                            Open approvals inbox
                        </Link>
                    }
                />
                <StatTile label="Guard blocks" value={blocks} context="Forbidden actions stopped since start" />
                <StatTile
                    label="Completed in the last 2 hours"
                    value={completedRecent}
                    context="Jobs per 10 simulated minutes"
                    sparkline={
                        <span className="text-(--viz-series-1)">
                            <Sparkline values={series} width={120} height={40} aria-label={sparklineLabel} />
                        </span>
                    }
                />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Panel title="Agent health">
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
                </Panel>

                <Panel title="Jobs by status" className="xl:col-span-2">
                    <Table aria-label="Number of jobs in each status">
                        <TableHeader>
                            <Column isRowHeader>Status</Column>
                            <Column>Jobs</Column>
                        </TableHeader>
                        <TableBody items={JOB_STATUSES.map((status) => ({ status }))}>
                            {({ status }) => (
                                <Row id={status}>
                                    <Cell>
                                        <StatusBadge status={status} />
                                    </Cell>
                                    <Cell>
                                        <span className="flex items-center gap-2">
                                            {counts[status] > 0 && (
                                                <span
                                                    aria-hidden="true"
                                                    className="h-2 max-w-[calc(100%-2.5rem)] rounded-r bg-(--viz-series-1)"
                                                    style={{ width: `${(counts[status] / maxCount) * 100}%` }}
                                                />
                                            )}
                                            <span className="font-medium text-secondary tabular-nums">{counts[status]}</span>
                                        </span>
                                    </Cell>
                                </Row>
                            )}
                        </TableBody>
                    </Table>
                </Panel>
            </div>

            <Panel title="Recent events">
                {recent.length === 0 ? (
                    <p className="text-sm text-tertiary">No events yet. Run the simulation to see the agent work.</p>
                ) : (
                    <ol className="divide-y divide-subtle">
                        {recent.map((event) => (
                            <EventRow key={event.seq} event={event} jobs={control.jobs} />
                        ))}
                    </ol>
                )}
            </Panel>
        </div>
    );
};
