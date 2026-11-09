import { Link } from "react-router";
import type { Job } from "@/domain/types";
import { KindBadge } from "./status-badge";

export const JobCard = ({ job }: { job: Job }) => (
    <Link
        to={`/jobs/${job.id}`}
        className="block rounded-lg bg-primary p-3 shadow-xs ring-1 ring-secondary transition hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
        <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-brand-secondary">{job.ticket.id}</span>
            <KindBadge kind={job.kind} />
        </span>
        <span className="mt-1 block text-sm font-medium break-words text-primary">{job.ticket.title}</span>
        <span className="mt-1 block truncate text-xs text-tertiary">
            {job.ticket.repo} · {job.model}
            {job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}
        </span>
        {job.holdReason && <span className="mt-1 block text-xs font-medium text-secondary">{job.holdReason}</span>}
    </Link>
);
