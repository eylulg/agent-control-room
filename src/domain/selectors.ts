import { type ApprovalRequest, type ControlState, JOB_STATUSES, type Job, type JobKind, type JobStatus, recordFromKeys } from "./types";

export interface QueueFilter {
    kinds: JobKind[];
    repo: string | "all";
    search: string;
}

export const EMPTY_FILTER: QueueFilter = { kinds: [], repo: "all", search: "" };

export const listJobs = (state: Pick<ControlState, "jobOrder" | "jobs">): Job[] => state.jobOrder.flatMap((id) => state.jobs[id] ?? []);

export const filterJobs = (jobs: readonly Job[], filter: QueueFilter): Job[] => {
    const query = filter.search.trim().toLowerCase();
    return jobs.filter((job) => {
        if (filter.kinds.length > 0 && !filter.kinds.includes(job.kind)) return false;
        if (filter.repo !== "all" && job.ticket.repo !== filter.repo) return false;
        if (!query) return true;
        return [job.ticket.id, job.ticket.title, job.ticket.repo, job.model].some((field) => field.toLowerCase().includes(query));
    });
};

export const groupByStatus = (jobs: readonly Job[]): Record<JobStatus, Job[]> => {
    const groups = recordFromKeys(JOB_STATUSES, (): Job[] => []);
    for (const job of jobs) groups[job.status].push(job);
    return groups;
};

export const countByStatus = (jobs: readonly Job[]): Record<JobStatus, number> => {
    const groups = groupByStatus(jobs);
    return recordFromKeys(JOB_STATUSES, (status) => groups[status].length);
};

export const listRepos = (jobs: readonly Job[]): string[] => [...new Set(jobs.map((job) => job.ticket.repo))].sort();

export const pendingApprovals = (state: Pick<ControlState, "approvals" | "jobs">): ApprovalRequest[] =>
    Object.values(state.approvals)
        .filter((approval) => {
            const job = state.jobs[approval.jobId];
            return approval.status === "pending" && job !== undefined && job.status !== "done" && job.status !== "failed";
        })
        .sort((a, b) => a.createdAt - b.createdAt);

/** True when the agent has open jobs and every one of them is parked on an approval only the operator can answer. */
export const isIdleWaitingOnOperator = (state: Pick<ControlState, "jobs">): boolean => {
    const open = Object.values(state.jobs).filter((job) => job.status !== "done" && job.status !== "failed");
    return open.length > 0 && open.every((job) => job.status === "awaiting-approval");
};

/** Completed jobs per time bucket, oldest first. */
export const throughput = (completions: readonly number[], now: number, bucketMs: number, buckets: number): number[] => {
    const counts = new Array<number>(buckets).fill(0);
    const start = now - bucketMs * buckets;
    for (const ts of completions) {
        if (ts <= start || ts > now) continue;
        const index = Math.min(buckets - 1, Math.floor((ts - start - 1) / bucketMs));
        counts[index] = (counts[index] ?? 0) + 1;
    }
    return counts;
};
