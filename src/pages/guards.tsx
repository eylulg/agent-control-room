import { Card } from '@eylulg/ui/card';
import { Switch } from '@eylulg/ui/switch';
import { Cell, Column, Row, Table, TableBody, TableHeader } from '@eylulg/ui/table';
import { Link } from 'react-router';
import { PageHeader } from '@/components/app/page-header';
import { Panel } from '@/components/app/panel';
import { inlineLink } from '@/components/app/styles';
import type { Guard } from '@/domain/types';
import { useAppStore } from '@/state/store-context';
import { useCommand } from '@/state/use-command';
import { formatClock } from '@/utils/format';

interface GuardRuleProps {
  guard: Guard;
}

const LOG_LIMIT = 50;

export const GuardsPage = () => {
  const guards = useAppStore((s) => s.control.guards);
  const jobs = useAppStore((s) => s.control.jobs);

  const log = guards
    .flatMap((guard) => guard.blocked.map((entry) => ({ ...entry, rule: guard.rule })))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, LOG_LIMIT);

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Guards'
        description='Hard rules the agent cannot break. Every blocked attempt is logged. Switching a guard off lets the action through, which is logged too.'
      />
      <ul className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {guards.map((guard) => (
          <GuardRule key={guard.id} guard={guard} />
        ))}
      </ul>
      <Panel title='Blocked attempts'>
        {log.length === 0 ? (
          <p className='text-sm text-tertiary'>No blocked attempts yet.</p>
        ) : (
          <Table aria-label='Blocked attempts' maxHeight='28rem'>
            <TableHeader>
              <Column isRowHeader>Time</Column>
              <Column>Job</Column>
              <Column>Rule</Column>
              <Column>Attempt</Column>
            </TableHeader>
            <TableBody items={log}>
              {(entry) => (
                <Row id={`${entry.ts}-${entry.jobId}-${entry.action}`}>
                  <Cell>{formatClock(entry.ts)}</Cell>
                  <Cell>
                    <Link to={`/jobs/${entry.jobId}`} className={inlineLink}>
                      {jobs[entry.jobId]?.ticket.id ?? entry.jobId}
                    </Link>
                  </Cell>
                  <Cell>{entry.rule}</Cell>
                  <Cell>{entry.detail}</Cell>
                </Row>
              )}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
};

const GuardRule = ({ guard }: GuardRuleProps) => {
  const { run, error } = useCommand();

  function handleChange(enabled: boolean) {
    return run({ type: 'guard.toggle', guardId: guard.id, enabled });
  }

  return (
    <li>
      <Card className='h-full'>
        <Switch
          className='w-full min-w-0'
          hint={guard.description}
          isSelected={guard.enabled}
          onChange={handleChange}
        >
          {guard.rule}
        </Switch>
        <p className='text-sm text-tertiary'>
          {guard.enabled ? 'On' : 'Off'}. Blocked {guard.blocked.length}{' '}
          {guard.blocked.length === 1 ? 'time' : 'times'}.
        </p>
        {error && (
          <p role='alert' className='text-sm font-medium text-error'>
            {error}
          </p>
        )}
      </Card>
    </li>
  );
};
