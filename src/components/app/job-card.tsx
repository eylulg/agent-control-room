import { Card, CardBody, CardHeader } from "@eylulg/ui/card";
import type { Job } from "@/domain/types";
import { KindBadge } from "./status-badge";

interface JobCardProps {
    job: Job;
}

export const JobCard = ({ job }: JobCardProps) => (
    <Card href={`/jobs/${job.id}`} className="gap-2 p-3">
        <CardHeader
            title={`${job.ticket.id}: ${job.ticket.title}`}
            description={`${job.ticket.repo} · ${job.model}${job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}`}
            actions={<KindBadge kind={job.kind} />}
        />
        {job.holdReason && <CardBody className="font-medium">{job.holdReason}</CardBody>}
    </Card>
);
