import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { pendingApprovals } from '@/domain/selectors';
import { renderApp } from '@/test-utils/render-app';

const setup = async () => {
  const user = userEvent.setup();
  const { store } = await renderApp('/approvals', { warmup: 4 });
  const approval = pendingApprovals(store.getState().control)[0];
  if (!approval) throw new Error('expected a pending approval');
  return { user, store, approval };
};

describe('ApprovalsPage', () => {
  it('answers the first request with the 2 key and unblocks the job', async () => {
    const { user, store, approval } = await setup();

    await user.keyboard('2');

    expect(store.getState().control.jobs[approval.jobId]?.status).toBe('implementing');
    expect(screen.queryByRole('article', { name: approval.question })).not.toBeInTheDocument();
  });

  it('moves focus to the confirmation after answering', async () => {
    const { user } = await setup();

    await user.click(screen.getByRole('button', { name: /Option A/ }));

    expect(screen.getByText(/with option A, Toolbar action/)).toHaveFocus();
  });

  it('sends the note with the answer', async () => {
    const { user, store, approval } = await setup();

    await user.type(screen.getByRole('textbox', { name: /Note for the agent/ }), 'Keep it small');
    await user.click(screen.getByRole('button', { name: /Option B/ }));

    expect(store.getState().control.approvals[approval.id]?.answer).toMatchObject({
      option: 'B',
      note: 'Keep it small',
    });
  });

  it('does not answer when 1 is typed into the note', async () => {
    const { user, store, approval } = await setup();

    await user.type(screen.getByRole('textbox', { name: /Note for the agent/ }), '1');

    expect(store.getState().control.approvals[approval.id]?.status).toBe('pending');
  });
});
