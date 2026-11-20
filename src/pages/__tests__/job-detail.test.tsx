import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test-utils/render-app';

describe('JobDetailPage', () => {
  it('holds a job with the reason shown on the page', async () => {
    const user = userEvent.setup();
    await renderApp('/jobs/job-3', { warmup: 2 });

    await user.type(screen.getByRole('textbox', { name: 'Hold reason' }), 'Waiting on a designer');
    await user.click(screen.getByRole('button', { name: 'Hold job' }));

    expect(screen.getByText('On hold.').parentElement).toHaveTextContent('Waiting on a designer');
  });

  it('keeps the job running until the cancel is confirmed', async () => {
    const user = userEvent.setup();
    const { store } = await renderApp('/jobs/job-3', { warmup: 2 });

    await user.click(screen.getByRole('button', { name: 'Cancel job' }));

    expect(store.getState().control.jobs['job-3']?.status).not.toBe('failed');
    expect(screen.getByText('Cancel MDW-103? It will be marked failed.')).toBeInTheDocument();
  });

  it.each([
    [['Hold job'], 'Resume job', 'button'],
    [['Hold job', 'Resume job'], 'Hold reason', 'textbox'],
    [['Cancel job', 'Yes, cancel job'], 'Retry job', 'button'],
    [['Cancel job', 'Yes, cancel job', 'Retry job'], 'Hold reason', 'textbox'],
    [['Cancel job', 'Keep job running'], 'Cancel job', 'button'],
  ] as const)('after %j moves focus to %s', async (actions, target, role) => {
    const user = userEvent.setup();
    await renderApp('/jobs/job-3', { warmup: 2 });

    for (const name of actions) await user.click(screen.getByRole('button', { name }));

    expect(screen.getByRole(role, { name: target })).toHaveFocus();
  });
});
