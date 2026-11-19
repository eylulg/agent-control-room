import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { Badge } from '@eylulg/ui/badge';
import { Button } from '@eylulg/ui/button';
import { Input } from '@eylulg/ui/input';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EventRow } from '@/components/app/event-row';
import { PageHeader } from '@/components/app/page-header';
import { Panel } from '@/components/app/panel';
import { KindBadge, StatusBadge } from '@/components/app/status-badge';
import { inlineLink } from '@/components/app/styles';
import type { Job } from '@/domain/types';
import { useAppStore } from '@/state/store-context';
import { useCommand } from '@/state/use-command';
import { formatClock } from '@/utils/format';

interface JobProps {
  job: Job;
}

const focusRef = (ref: RefObject<HTMLElement | null>) => ref.current?.focus();

export const JobDetailPage = () => {
  const { jobId = '' } = useParams();
  const job = useAppStore((s) => s.control.jobs[jobId]);
  const dependency = useAppStore((s) =>
    job?.dependsOn ? s.control.jobs[job.dependsOn] : undefined,
  );
  const simulated = useAppStore((s) => s.sim !== null);

  if (!job) {
    return (
      <div className='flex flex-col gap-4'>
        <PageHeader
          title='Job not found'
          description='It may belong to a different seed. Reset the simulation or pick a job from the queue.'
        />
        <Link to='/queue' className={inlineLink}>
          Back to the queue
        </Link>
      </div>
    );
  }

  const guardEvents = job.timeline.filter(
    (event) => event.type === 'guard.blocked' || event.type === 'guard.allowed',
  );

  return (
    <div className='flex flex-col gap-6'>
      <Link
        to='/queue'
        className='flex w-max items-center gap-1 rounded-xs text-sm font-semibold text-tertiary hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
      >
        <ArrowLeft aria-hidden='true' className='size-4' /> Queue
      </Link>
      <PageHeader
        title={`${job.ticket.id}: ${job.ticket.title}`}
        description={
          <span className='flex flex-wrap items-center gap-2'>
            <StatusBadge status={job.status} size='md' />
            <KindBadge kind={job.kind} />
            <Badge size='sm' color='gray'>
              {job.ticket.repo}
            </Badge>
            <Badge size='sm' color='gray'>
              Model {job.model}
            </Badge>
            <Badge size='sm' color='gray'>
              Attempt {job.attempts}
            </Badge>
          </span>
        }
        actions={
          job.pr &&
          (simulated ? (
            <Button size='sm' variant='secondary' isDisabled>
              PR #{job.pr.number} (simulated)
            </Button>
          ) : (
            <Button
              href={job.pr.url}
              target='_blank'
              rel='noreferrer'
              size='sm'
              variant='secondary'
              iconTrailing={ExternalLink}
            >
              Open PR #{job.pr.number}
            </Button>
          ))
        }
      />

      {job.status === 'awaiting-approval' && (
        <p className='rounded-lg border border-brand bg-primary p-3 text-sm text-primary'>
          <strong className='font-semibold'>Blocked on a decision.</strong> The agent will not write
          code until someone answers.{' '}
          <Link to='/approvals' className={inlineLink}>
            Answer in the approvals inbox
          </Link>
        </p>
      )}
      {job.holdReason && (
        <p className='rounded-lg border border-subtle bg-warning-subtle p-3 text-sm text-primary'>
          <strong className='font-semibold'>On hold.</strong> {job.holdReason}
        </p>
      )}
      {job.failureReason && (
        <p className='rounded-lg border border-subtle bg-error-subtle p-3 text-sm text-primary'>
          <strong className='font-semibold'>Failed.</strong> {job.failureReason}
        </p>
      )}
      {dependency && (
        <p className='text-sm text-tertiary'>
          Stacked on{' '}
          <Link className={inlineLink} to={`/jobs/${dependency.id}`}>
            {dependency.ticket.id}
          </Link>{' '}
          ({dependency.status === 'done' ? 'merged' : 'not merged yet'}).
        </p>
      )}

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-3'>
        <div className='flex min-w-0 flex-col gap-6 xl:col-span-2'>
          <Panel title='Plan'>
            {job.plan ? (
              <p className='text-sm whitespace-pre-wrap text-secondary'>{job.plan}</p>
            ) : (
              <p className='text-sm text-tertiary'>No plan posted yet.</p>
            )}
          </Panel>
          <Timeline job={job} />
        </div>
        <div className='flex min-w-0 flex-col gap-6'>
          <Actions job={job} />
          <Panel title='Commits'>
            {job.commits.length === 0 ? (
              <p className='text-sm text-tertiary'>No commits yet.</p>
            ) : (
              <ul className='flex flex-col gap-2 text-sm'>
                {job.commits.map((commit) => (
                  <li key={commit.sha + commit.ts} className='min-w-0'>
                    <code className='mr-2 text-xs text-tertiary'>{commit.sha}</code>
                    <span className='break-words text-secondary'>{commit.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title='CI runs'>
            {job.ciRuns.length === 0 ? (
              <p className='text-sm text-tertiary'>No CI runs yet.</p>
            ) : (
              <ul className='flex flex-col gap-2 text-sm'>
                {job.ciRuns.map((run) => (
                  <li key={run.id} className='flex flex-col gap-1'>
                    <span className='flex items-center gap-2'>
                      <Badge size='sm' color={run.status === 'failed' ? 'error' : 'success'}>
                        {run.status === 'failed'
                          ? 'Failed'
                          : run.status === 'fixed'
                            ? 'Fixed'
                            : 'Passed'}
                      </Badge>
                      <span className='text-secondary'>{run.check}</span>
                      <span className='ml-auto text-xs text-tertiary'>{formatClock(run.ts)}</span>
                    </span>
                    <span className='text-xs break-words text-tertiary'>{run.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title='Review findings'>
            {job.findings.length === 0 ? (
              <p className='text-sm text-tertiary'>No review findings.</p>
            ) : (
              <ul className='flex flex-col gap-3 text-sm'>
                {job.findings.map((finding) => (
                  <li key={finding.id} className='flex flex-col gap-1'>
                    <span className='text-xs text-tertiary'>
                      {finding.author} on <code>{finding.file}</code>
                    </span>
                    <span className='text-secondary'>{finding.body}</span>
                    <span className='border-l-2 border-default pl-2 text-tertiary'>
                      {finding.reply ? `Agent: ${finding.reply}` : 'Reply pending'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title='Guard events'>
            {guardEvents.length === 0 ? (
              <p className='text-sm text-tertiary'>No guard events for this job.</p>
            ) : (
              <ol className='divide-y divide-subtle'>
                {guardEvents.map((event) => (
                  <EventRow key={event.seq} event={event} />
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

const Timeline = ({ job }: JobProps) => {
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const count = job.timeline.length;

  useEffect(() => {
    const element = listRef.current;
    if (follow && element) element.scrollTop = element.scrollHeight;
  }, [count, follow]);

  function handleFollowToggle() {
    setFollow((current) => !current);
  }

  return (
    <Panel
      title='Timeline'
      actions={
        <Button size='sm' variant='secondary' aria-pressed={!follow} onPress={handleFollowToggle}>
          {follow ? 'Pause auto-follow' : 'Resume auto-follow'}
        </Button>
      }
    >
      <div
        ref={listRef}
        tabIndex={0}
        role='region'
        aria-label={`Timeline for ${job.ticket.id}, ${count} events`}
        className='max-h-96 overflow-y-auto rounded-md pr-1'
      >
        <ol className='divide-y divide-subtle'>
          {job.timeline.map((event) => (
            <EventRow key={event.seq} event={event} />
          ))}
        </ol>
      </div>
      <p className='mt-2 text-xs text-tertiary'>
        {follow
          ? 'Following new events as they arrive.'
          : 'Auto-follow paused. New events still arrive below.'}
      </p>
    </Panel>
  );
};

/**
 * Each action disables the control that triggered it, so focus moves to the
 * control that undoes or follows it: Hold to Resume, Resume and Retry to the
 * hold reason, Cancel to Retry.
 */
const Actions = ({ job }: JobProps) => {
  const { run, error } = useCommand();
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const finished = job.status === 'done' || job.status === 'failed';
  const held = job.status === 'on-hold';

  async function handleHold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await run({ type: 'job.hold', jobId: job.id, reason })) {
      setReason('');
      focusRef(resumeRef);
    }
  }

  async function handleResume() {
    if (await run({ type: 'job.resume', jobId: job.id })) focusRef(reasonRef);
  }

  useEffect(() => {
    if (confirmingCancel) keepRef.current?.focus();
  }, [confirmingCancel]);

  function handleCancel() {
    setConfirmingCancel(true);
  }

  function handleKeep() {
    setConfirmingCancel(false);
    focusRef(cancelRef);
  }

  async function handleConfirmCancel() {
    const accepted = await run({ type: 'job.cancel', jobId: job.id });
    setConfirmingCancel(false);
    if (accepted) focusRef(retryRef);
  }

  async function handleRetry() {
    if (await run({ type: 'job.retry', jobId: job.id })) focusRef(reasonRef);
  }

  return (
    <Panel title='Actions'>
      <form className='flex flex-col gap-3' onSubmit={handleHold}>
        <Input
          ref={reasonRef}
          label='Hold reason'
          placeholder='Waiting on a designer'
          value={reason}
          onChange={setReason}
          isDisabled={finished || held}
        />
        <div className='flex flex-wrap gap-2'>
          <Button type='submit' size='sm' variant='secondary' isDisabled={finished || held}>
            Hold job
          </Button>
          <Button
            ref={resumeRef}
            size='sm'
            variant='secondary'
            isDisabled={!held}
            onPress={handleResume}
          >
            Resume job
          </Button>
          <Button
            ref={cancelRef}
            size='sm'
            variant='destructive'
            isDisabled={finished}
            onPress={handleCancel}
          >
            Cancel job
          </Button>
          <Button
            ref={retryRef}
            size='sm'
            variant='secondary'
            isDisabled={job.status !== 'failed'}
            onPress={handleRetry}
          >
            Retry job
          </Button>
        </div>
        {confirmingCancel && (
          <div
            role='group'
            aria-label='Confirm cancel'
            className='flex flex-col gap-2 rounded-lg border border-subtle bg-error-subtle p-3 text-sm'
          >
            <p className='text-primary'>Cancel {job.ticket.id}? It will be marked failed.</p>
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' variant='destructive' onPress={handleConfirmCancel}>
                Yes, cancel job
              </Button>
              <Button ref={keepRef} size='sm' variant='secondary' onPress={handleKeep}>
                Keep job running
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role='alert' className='text-sm font-medium text-error'>
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
};
