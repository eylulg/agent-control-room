import { Link } from 'react-router';
import type { Job } from '@/domain/types';
import { KindBadge } from './status-badge';
import { rowLink } from './styles';

interface JobRowProps {
  job: Job;
}

/** One line per job for the grouped list: ticket, title, then repository, model and kind. */
export const JobRow = ({ job }: JobRowProps) => (
  <Link to={`/jobs/${job.id}`} className={rowLink}>
    <span className='flex min-w-0 flex-1 items-baseline gap-2'>
      <span className='shrink-0 text-sm font-semibold text-primary'>{job.ticket.id}</span>
      <span className='truncate text-sm text-secondary'>{job.ticket.title}</span>
    </span>
    <span className='flex flex-wrap items-center gap-2 text-xs text-tertiary'>
      {job.holdReason && <span className='font-medium text-secondary'>{job.holdReason}</span>}
      <span>
        {job.ticket.repo} · {job.model}
        {job.attempts > 1 && ` · attempt ${job.attempts}`}
      </span>
      <KindBadge kind={job.kind} />
    </span>
  </Link>
);
