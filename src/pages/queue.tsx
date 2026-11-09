import { useMemo, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { JobCard } from "@/components/app/job-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { EMPTY_FILTER, type QueueFilter, filterJobs, groupByStatus, listJobs, listRepos } from "@/domain/selectors";
import { JOB_KINDS, JOB_STATUSES, type JobKind } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { cx } from "@/utils/cx";
import { KIND_LABEL } from "@/utils/format";

export const QueuePage = () => {
    const control = useAppStore((s) => s.control);
    const [filter, setFilter] = useState<QueueFilter>(EMPTY_FILTER);

    const jobs = useMemo(() => listJobs(control), [control]);
    const repos = useMemo(() => listRepos(jobs), [jobs]);
    const visible = useMemo(() => filterJobs(jobs, filter), [jobs, filter]);
    const groups = useMemo(() => groupByStatus(visible), [visible]);
    const filtered = filter.kinds.length > 0 || filter.repo !== "all" || filter.search.trim() !== "";

    const toggleKind = (kind: JobKind) =>
        setFilter((current) => ({ ...current, kinds: current.kinds.includes(kind) ? current.kinds.filter((k) => k !== kind) : [...current.kinds, kind] }));

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Queue" description="Every job the agent holds, grouped by where it is in the ticket to PR flow." />

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end" role="search" aria-label="Filter jobs">
                <Input
                    className="lg:max-w-xs"
                    label="Search"
                    placeholder="Ticket, title, repo or model"
                    icon={SearchLg}
                    value={filter.search}
                    onChange={(search) => setFilter((current) => ({ ...current, search }))}
                />
                <NativeSelect
                    className="lg:max-w-56"
                    label="Repository"
                    value={filter.repo}
                    onChange={(event) => setFilter((current) => ({ ...current, repo: event.target.value }))}
                    options={[{ label: "All repositories", value: "all" }, ...repos.map((repo) => ({ label: repo, value: repo }))]}
                />
                <fieldset className="min-w-0">
                    <legend className="mb-1.5 text-sm font-medium text-secondary">Kind</legend>
                    <div className="flex flex-wrap gap-2">
                        {JOB_KINDS.map((kind) => {
                            const on = filter.kinds.includes(kind);
                            return (
                                <button
                                    key={kind}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleKind(kind)}
                                    className={cx(
                                        "rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ring-inset",
                                        on ? "bg-brand-solid text-white ring-transparent" : "bg-primary text-secondary ring-primary hover:bg-primary_hover",
                                    )}
                                >
                                    {KIND_LABEL[kind]}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
                {filtered && (
                    <Button color="link-gray" size="sm" onPress={() => setFilter(EMPTY_FILTER)}>
                        Clear filters
                    </Button>
                )}
            </div>

            <p className="text-sm text-tertiary" role="status" aria-live="polite">
                Showing {visible.length} of {jobs.length} jobs
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {JOB_STATUSES.map((status) => (
                    <section key={status} aria-labelledby={`col-${status}`} className="flex min-w-0 flex-col gap-2 rounded-xl bg-tertiary/60 p-3">
                        <h2 id={`col-${status}`} className="flex items-center justify-between gap-2">
                            <StatusBadge status={status} />
                            <span className="text-sm font-medium text-tertiary">
                                {groups[status].length}
                                <span className="sr-only"> jobs</span>
                            </span>
                        </h2>
                        {groups[status].length === 0 ? (
                            <p className="py-2 text-xs text-tertiary">No jobs</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {groups[status].map((job) => (
                                    <li key={job.id}>
                                        <JobCard job={job} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
};
