import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { listJobs } from '@/domain/selectors';
import type { Job } from '@/domain/types';
import { renderApp } from '@/test-utils/render-app';

type Case = [string, (user: UserEvent) => Promise<void>, (job: Job) => boolean];

describe('QueuePage', () => {
  it.each<Case>([
    [
      'search',
      (user) => user.type(screen.getByRole('textbox', { name: 'Search' }), 'ACME-103'),
      (job) => job.ticket.id === 'ACME-103',
    ],
    [
      'kind',
      (user) => user.click(screen.getByRole('button', { name: 'Bug', pressed: false })),
      (job) => job.kind === 'bug',
    ],
    [
      'repository',
      async (user) => {
        await user.click(screen.getByRole('button', { name: /Repository/ }));
        await user.click(await screen.findByRole('option', { name: 'acme/mobile' }));
      },
      (job) => job.ticket.repo === 'acme/mobile',
    ],
  ])('filters the list by %s', async (_name, act, matches) => {
    const user = userEvent.setup();
    const { store } = await renderApp('/queue');
    const jobs = listJobs(store.getState().control);

    await act(user);

    const expected = jobs.filter(matches);
    expect(
      screen.getByText(`Showing ${expected.length} of ${jobs.length} jobs`),
    ).toBeInTheDocument();
    for (const job of jobs.filter((j) => j.status !== 'done')) {
      const card = screen.queryByRole('link', { name: new RegExp(`^${job.ticket.id}(?!\\d)`) });
      if (matches(job)) expect(card).toBeInTheDocument();
      else expect(card).not.toBeInTheDocument();
    }
  });
});
