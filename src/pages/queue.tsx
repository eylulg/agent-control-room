import { useState } from "react";
import { Button } from "@eylulg/ui/button";
import { Input } from "@eylulg/ui/input";
import { Select, SelectItem } from "@eylulg/ui/select";
import { Search } from "lucide-react";
import type { Key } from "react-aria-components";
import { JobCard } from "@/components/app/job-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { EMPTY_FILTER, type QueueFilter, filterJobs, groupByStatus, listJobs, listRepos } from "@/domain/selectors";
import { JOB_KINDS, JOB_STATUSES, type JobKind } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { KIND_LABEL } from "@/utils/format";

interface KindFilterButtonProps {
    kind: JobKind;
    pressed: boolean;
    onToggle: (kind: JobKind) => void;
}

export const QueuePage = () => {
    const control = useAppStore((s) => s.control);
    const [filter, setFilter] = useState<QueueFilter>(EMPTY_FILTER);

    const jobs = listJobs(control);
    const repos = listRepos(jobs);
    const visible = filterJobs(jobs, filter);
    const groups = groupByStatus(visible);
    const filtered = filter.kinds.length > 0 || filter.repo !== "all" || filter.search.trim() !== "";

    function handleSearch(search: string) {
        setFilter((current) => ({ ...current, search }));
    }

    function handleRepo(key: Key | null) {
        if (key === null) return;
        const repo = String(key);
        setFilter((current) => ({ ...current, repo }));
    }

    function handleKindToggle(kind: JobKind) {
        setFilter((current) => ({ ...current, kinds: current.kinds.includes(kind) ? current.kinds.filter((k) => k !== kind) : [...current.kinds, kind] }));
    }

    function handleClear() {
        setFilter(EMPTY_FILTER);
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Queue" description="Every job the agent holds, grouped by where it is in the ticket to PR flow." />

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end" role="search" aria-label="Filter jobs">
                <Input
                    className="lg:max-w-xs"
                    label="Search"
                    placeholder="ACME-104"
                    hint="Ticket, title, repository or model"
                    iconLeading={Search}
                    value={filter.search}
                    onChange={handleSearch}
                />
                <Select className="lg:w-56" label="Repository" selectedKey={filter.repo} onSelectionChange={handleRepo}>
                    <SelectItem id="all">All repositories</SelectItem>
                    {repos.map((repo) => (
                        <SelectItem key={repo} id={repo}>
                            {repo}
                        </SelectItem>
                    ))}
                </Select>
                <fieldset className="min-w-0">
                    <legend className="mb-1.5 text-sm font-medium text-secondary">Kind</legend>
                    <div className="flex flex-wrap gap-2">
                        {JOB_KINDS.map((kind) => (
                            <KindFilterButton key={kind} kind={kind} pressed={filter.kinds.includes(kind)} onToggle={handleKindToggle} />
                        ))}
                    </div>
                </fieldset>
                {filtered && (
                    <Button variant="tertiary" size="sm" onPress={handleClear}>
                        Clear filters
                    </Button>
                )}
            </div>

            <p className="text-sm text-tertiary" role="status">
                Showing {visible.length} of {jobs.length} jobs
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {JOB_STATUSES.map((status) => (
                    <section key={status} aria-labelledby={`col-${status}`} className="flex min-w-0 flex-col gap-2 rounded-xl bg-secondary p-3">
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

const KindFilterButton = ({ kind, pressed, onToggle }: KindFilterButtonProps) => {
    function handleClick() {
        onToggle(kind);
    }

    return (
        <Button size="sm" variant={pressed ? "primary" : "secondary"} aria-pressed={pressed} onPress={handleClick}>
            {KIND_LABEL[kind]}
        </Button>
    );
};
