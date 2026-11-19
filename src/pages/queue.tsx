import { useState } from 'react';
import { Button } from '@eylulg/ui/button';
import { Input } from '@eylulg/ui/input';
import { SegmentedControl, SegmentedControlItem } from '@eylulg/ui/segmented-control';
import { Select, SelectItem } from '@eylulg/ui/select';
import { Search } from 'lucide-react';
import type { Key } from 'react-aria-components';
import { JobCard } from '@/components/app/job-card';
import { JobRow } from '@/components/app/job-row';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import {
  EMPTY_FILTER,
  type QueueFilter,
  filterJobs,
  groupByStatus,
  listJobs,
  listRepos,
} from '@/domain/selectors';
import { JOB_KINDS, JOB_STATUSES, type Job, type JobKind, type JobStatus } from '@/domain/types';
import { useAppStore } from '@/state/store-context';
import { KIND_LABEL } from '@/utils/format';

type View = 'list' | 'board';

interface StatusGroupProps {
  status: JobStatus;
  jobs: Job[];
  view: View;
  showDone: boolean;
  onToggleDone: () => void;
}

interface KindFilterButtonProps {
  kind: JobKind;
  pressed: boolean;
  onToggle: (kind: JobKind) => void;
}

/** Finished work goes last and starts collapsed, so a long run does not bury what is still moving. */
const STATUS_ORDER: JobStatus[] = [...JOB_STATUSES.filter((status) => status !== 'done'), 'done'];
const DONE_LIMIT = 50;

export const QueuePage = () => {
  const control = useAppStore((s) => s.control);
  const [filter, setFilter] = useState<QueueFilter>(EMPTY_FILTER);
  const [view, setView] = useState<View>('list');
  const [showDone, setShowDone] = useState(false);

  const jobs = listJobs(control);
  const repos = listRepos(jobs);
  const visible = filterJobs(jobs, filter);
  const groups = groupByStatus(visible);
  const filtered = filter.kinds.length > 0 || filter.repo !== 'all' || filter.search.trim() !== '';

  function handleSearch(search: string) {
    setFilter((current) => ({ ...current, search }));
  }

  function handleRepo(key: Key | null) {
    if (key === null) return;
    const repo = String(key);
    setFilter((current) => ({ ...current, repo }));
  }

  function handleKindToggle(kind: JobKind) {
    setFilter((current) => ({
      ...current,
      kinds: current.kinds.includes(kind)
        ? current.kinds.filter((k) => k !== kind)
        : [...current.kinds, kind],
    }));
  }

  function handleView(key: Key) {
    setView(key === 'board' ? 'board' : 'list');
  }

  function handleToggleDone() {
    setShowDone((current) => !current);
  }

  function handleClear() {
    setFilter(EMPTY_FILTER);
  }

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Queue'
        description='Every job the agent holds, grouped by where it is in the ticket to PR flow.'
      />

      <div
        className='flex flex-col gap-4 lg:flex-row lg:items-end'
        role='search'
        aria-label='Filter jobs'
      >
        <Input
          className='lg:max-w-xs'
          label='Search'
          placeholder='ACME-104'
          hint='Ticket, title, repository or model'
          iconLeading={Search}
          value={filter.search}
          onChange={handleSearch}
        />
        <Select
          className='lg:w-56'
          label='Repository'
          selectedKey={filter.repo}
          onSelectionChange={handleRepo}
        >
          <SelectItem id='all'>All repositories</SelectItem>
          {repos.map((repo) => (
            <SelectItem key={repo} id={repo}>
              {repo}
            </SelectItem>
          ))}
        </Select>
        <fieldset className='min-w-0'>
          <legend className='mb-1.5 text-sm font-medium text-secondary'>Kind</legend>
          <div className='flex flex-wrap gap-2'>
            {JOB_KINDS.map((kind) => (
              <KindFilterButton
                key={kind}
                kind={kind}
                pressed={filter.kinds.includes(kind)}
                onToggle={handleKindToggle}
              />
            ))}
          </div>
        </fieldset>
        {filtered && (
          <Button variant='tertiary' size='sm' onPress={handleClear}>
            Clear filters
          </Button>
        )}
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-tertiary' role='status'>
          Showing {visible.length} of {jobs.length} jobs
        </p>
        <SegmentedControl
          aria-label='View'
          size='sm'
          selectedKey={view}
          onSelectionChange={handleView}
        >
          <SegmentedControlItem id='list'>List</SegmentedControlItem>
          <SegmentedControlItem id='board'>Board</SegmentedControlItem>
        </SegmentedControl>
      </div>

      {view === 'list' ? (
        <div className='flex flex-col gap-4'>
          {STATUS_ORDER.filter((status) => groups[status].length > 0).map((status) => (
            <StatusGroup
              key={status}
              status={status}
              jobs={groups[status]}
              view={view}
              showDone={showDone}
              onToggleDone={handleToggleDone}
            />
          ))}
          {visible.length === 0 && (
            <p className='text-sm text-tertiary'>No jobs match these filters.</p>
          )}
        </div>
      ) : (
        <div
          role='region'
          tabIndex={0}
          aria-label='Job board'
          className='relative flex items-start gap-4 overflow-x-auto rounded-md pb-2'
        >
          {STATUS_ORDER.map((status) => (
            <StatusGroup
              key={status}
              status={status}
              jobs={groups[status]}
              view={view}
              showDone={showDone}
              onToggleDone={handleToggleDone}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const StatusGroup = ({ status, jobs, view, showDone, onToggleDone }: StatusGroupProps) => {
  const collapsed = status === 'done' && !showDone;
  const shown = status === 'done' ? jobs.toReversed().slice(0, DONE_LIMIT) : jobs;
  const board = view === 'board';

  return (
    <section
      aria-labelledby={`group-${status}`}
      className={
        board
          ? 'flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-secondary p-3'
          : 'flex flex-col gap-2 rounded-xl bg-secondary p-3'
      }
    >
      <h2 id={`group-${status}`} className='flex items-center justify-between gap-2'>
        <StatusBadge status={status} />
        <span className='text-sm font-medium text-tertiary'>
          {jobs.length}
          <span className='sr-only'> jobs</span>
        </span>
      </h2>
      {status === 'done' && jobs.length > 0 && (
        <div>
          <Button variant='tertiary' size='sm' aria-expanded={showDone} onPress={onToggleDone}>
            {showDone ? 'Hide done jobs' : `Show ${jobs.length} done jobs`}
          </Button>
        </div>
      )}
      {!collapsed && shown.length === 0 && <p className='py-2 text-xs text-tertiary'>No jobs</p>}
      {!collapsed && shown.length > 0 && (
        <ul className={board ? 'flex flex-col gap-2' : 'flex flex-col divide-y divide-subtle'}>
          {shown.map((job) => (
            <li key={job.id}>{board ? <JobCard job={job} /> : <JobRow job={job} />}</li>
          ))}
        </ul>
      )}
      {!collapsed && jobs.length > shown.length && (
        <p className='text-xs text-tertiary'>
          Showing the latest {shown.length} of {jobs.length}.
        </p>
      )}
    </section>
  );
};

const KindFilterButton = ({ kind, pressed, onToggle }: KindFilterButtonProps) => {
  function handleClick() {
    onToggle(kind);
  }

  return (
    <Button
      size='sm'
      variant={pressed ? 'primary' : 'secondary'}
      aria-pressed={pressed}
      onPress={handleClick}
    >
      {KIND_LABEL[kind]}
    </Button>
  );
};
