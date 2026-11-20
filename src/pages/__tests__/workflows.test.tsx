import { screen, within } from '@testing-library/react';
import { act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { updateNode } from '@/domain/workflow/ops';
import { renderApp } from '@/test-utils/render-app';
import { defaultWorkflow } from '@/test-utils/workflow';

const addCondition = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Add Condition' }));
  return screen.getByRole('option', { name: 'Condition' });
};

describe('WorkflowsPage keyboard flows', () => {
  it('adds a step from the palette, announces it and selects it', async () => {
    const user = userEvent.setup();
    await renderApp('/workflows');

    const node = await addCondition(user);

    expect(node).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('status', { name: 'Editor announcements' })).toHaveTextContent(
      'Added Condition. 13 steps in the workflow.',
    );
  });

  it('connects a step through its menu and describes the connection to a screen reader', async () => {
    const user = userEvent.setup();
    await renderApp('/workflows');
    const node = await addCondition(user);

    node.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Connect to…' }));
    await user.click(
      within(await screen.findByRole('group', { name: 'True port' })).getByRole('menuitem', {
        name: 'Plan',
      }),
    );

    expect(screen.getByRole('status', { name: 'Editor announcements' })).toHaveTextContent(
      'Connected Condition True to Plan.',
    );
    expect(node).toHaveAccessibleDescription(
      expect.stringContaining('True goes to Plan. False is not connected.'),
    );
    await waitFor(() => expect(node).toHaveFocus());
  });

  it('deletes the focused step with Delete and brings it back with undo', async () => {
    const user = userEvent.setup();
    await renderApp('/workflows');
    const node = await addCondition(user);

    node.focus();
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('option', { name: 'Condition' })).not.toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute('role', 'option');
    await user.keyboard('{Control>}z{/Control}');

    expect(screen.getByRole('option', { name: 'Condition' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Editor announcements' })).toHaveTextContent(
      'Undid: Delete Condition.',
    );
  });

  it('moves between steps with the arrow keys and moves a step with Alt and an arrow', async () => {
    const user = userEvent.setup();
    await renderApp('/workflows');
    const first = screen.getAllByRole('option')[0];

    first?.focus();
    await user.keyboard('{ArrowDown}');
    const second = screen
      .getAllByRole('option')
      .find((option) => option === document.activeElement);
    const before = second?.style.transform;
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');

    expect(second?.getAttribute('aria-label')).toBe('Plan');
    expect(second?.style.transform).not.toBe(before);
    expect(screen.getByRole('status', { name: 'Editor announcements' })).toHaveTextContent(
      /^Moved "Plan" to \d+, \d+\.$/,
    );
  });

  it('keeps Publish disabled while the draft is unchanged and while it has problems', async () => {
    const user = userEvent.setup();
    await renderApp('/workflows');
    const publish = screen.getByRole('button', { name: 'Publish workflow' });
    expect(publish).toBeDisabled();

    await addCondition(user);

    expect(publish).toBeDisabled();
    expect(
      within(screen.getByRole('list', { name: 'Problems' })).getAllByRole('button').length,
    ).toBeGreaterThan(0);
  });

  it('publishes a valid change as a new version and moves focus to the status line', async () => {
    const user = userEvent.setup();
    const { store } = await renderApp('/workflows');

    await user.click(screen.getByRole('option', { name: 'Run CI, CI check' }));
    const limit = screen.getByRole('textbox', { name: 'Failures before the job fails' });
    await user.clear(limit);
    await user.type(limit, '4');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Publish workflow' }));

    expect(await screen.findByText(/^Published\./)).toHaveFocus();
    expect(store.getState().control.workflows.map((published) => published.revision)).toEqual([
      1, 2,
    ]);
  });

  it('edits the same graph in the outline and renders without axe violations', async () => {
    const user = userEvent.setup();
    const { container } = await renderApp('/workflows');

    await user.click(screen.getByRole('radio', { name: 'Outline' }));

    expect(await screen.findByRole('list', { name: 'Workflow outline' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('traces a job and lists the steps it took', async () => {
    const user = userEvent.setup();
    const { store } = await renderApp('/workflows');
    const job = Object.values(store.getState().control.jobs).find(
      (candidate) => store.getState().control.runs[candidate.id],
    );
    if (!job) throw new Error('The seeded world has no job with a run');

    await user.click(screen.getByRole('tab', { name: 'Trace a job' }));
    await user.click(screen.getByRole('button', { name: /Job to trace/ }));
    await user.click(
      await screen.findByRole('option', { name: `${job.ticket.id}: ${job.ticket.title}` }),
    );

    const path = await screen.findByRole('list', { name: 'Path of the job' });
    expect(within(path).getAllByRole('listitem').length).toBe(
      store.getState().control.runs[job.id]?.steps.length,
    );
    expect(within(path).getAllByRole('listitem')[0]).toHaveTextContent('Ticket arrives');
  });

  it('says so when the version a traced job ran on is no longer kept', async () => {
    const user = userEvent.setup();
    const { store } = await renderApp('/workflows');
    const job = Object.values(store.getState().control.jobs).find(
      (candidate) => store.getState().control.runs[candidate.id],
    );
    if (!job) throw new Error('The seeded world has no job with a run');
    await user.click(screen.getByRole('tab', { name: 'Trace a job' }));
    await user.click(screen.getByRole('button', { name: /Job to trace/ }));
    await user.click(
      await screen.findByRole('option', { name: `${job.ticket.id}: ${job.ticket.title}` }),
    );

    for (let i = 0; i < 21; i++) {
      await act(() =>
        store.getState().send({
          type: 'workflow.publish',
          workflow: updateNode(defaultWorkflow(), 'ci', { config: { maxAttempts: 4 + (i % 2) } }),
        }),
      );
    }

    expect(await screen.findByText(/Version 1 is no longer kept/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Path of the job' })).not.toBeInTheDocument();
  });

  it('runs a dry run of the draft to the end, one step at a time', async () => {
    const user = userEvent.setup();
    await renderApp('/workflows');

    await user.click(screen.getByRole('tab', { name: 'Dry run' }));
    await user.click(screen.getByRole('button', { name: 'Start dry run' }));
    const step = screen.getByRole('button', { name: 'Step' });
    await user.click(step);
    expect(screen.getAllByRole('status').map((region) => region.textContent)).not.toContainEqual(
      expect.stringMatching(/^MDW-\d+ is/),
    );
    for (let i = 0; i < 80 && !step.hasAttribute('disabled'); i++) await user.click(step);

    expect(step).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    const states = within(screen.getByRole('list', { name: 'Step states' }));
    expect(states.getByText('Done')).toBeInTheDocument();
    expect(screen.getAllByRole('status').map((region) => region.textContent)).toContainEqual(
      expect.stringMatching(/^Dry run finished after \d+ steps\./),
    );
  });

  it('keeps a label typed for one step on that step when another is selected before the field blurs', async () => {
    const user = userEvent.setup();
    await renderApp('/workflows');

    await user.click(screen.getByRole('option', { name: 'Plan' }));
    await user.type(screen.getByRole('textbox', { name: 'Label' }), ' the work');
    await user.click(screen.getByRole('option', { name: 'Review' }));

    expect(screen.getByRole('option', { name: 'Plan the work, Plan' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Review');
  });

  it('keeps a limit typed for one step on that step when another is selected', async () => {
    const user = userEvent.setup();
    await renderApp('/workflows');

    await user.click(screen.getByRole('option', { name: 'Run CI, CI check' }));
    const limit = screen.getByRole('textbox', { name: 'Failures before the job fails' });
    await user.clear(limit);
    await user.type(limit, '7');
    await user.click(screen.getByRole('option', { name: 'Review' }));

    expect(screen.getByRole('textbox', { name: 'Finding rounds before moving on' })).toHaveValue(
      '3',
    );
    await user.click(screen.getByRole('option', { name: 'Run CI, CI check' }));
    expect(screen.getByRole('textbox', { name: 'Failures before the job fails' })).toHaveValue('7');
  });

  describe('focus', () => {
    const focusedOption = () => expect(document.activeElement).toHaveAttribute('role', 'option');

    it('goes to a remaining step after Delete from the step menu', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      const node = await addCondition(user);

      node.focus();
      await user.keyboard('{Enter}');
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

      expect(screen.queryByRole('option', { name: 'Condition' })).not.toBeInTheDocument();
      focusedOption();
    });

    it('goes to a remaining step after Delete in the settings panel', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      await addCondition(user);

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(screen.queryByRole('option', { name: 'Condition' })).not.toBeInTheDocument();
      focusedOption();
    });

    it('goes to a remaining step when undo removes the step that had focus', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      const node = await addCondition(user);

      node.focus();
      await user.keyboard('{Control>}z{/Control}');

      expect(screen.queryByRole('option', { name: 'Condition' })).not.toBeInTheDocument();
      focusedOption();
    });

    it('goes to a step after Discard draft changes, which disables itself', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      await addCondition(user);

      await user.click(screen.getByRole('button', { name: 'Discard draft changes' }));

      expect(screen.getByRole('button', { name: 'Discard draft changes' })).toBeDisabled();
      focusedOption();
    });

    it('goes to Redo when Undo runs out of history', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      await addCondition(user);

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Redo' })).toHaveFocus();
    });

    it('goes to Restart dry run when a played dry run finishes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        await renderApp('/workflows');

        await user.click(screen.getByRole('tab', { name: 'Dry run' }));
        await user.click(screen.getByRole('button', { name: 'Start dry run' }));
        await user.click(screen.getByRole('button', { name: 'Play' }));
        await act(() => vi.advanceTimersByTimeAsync(450 * 80));

        expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Restart dry run' })).toHaveFocus();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('step menu', () => {
    it('opens the settings of the step it belongs to, not of the selected one', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');

      await user.click(screen.getByRole('option', { name: 'Run CI, CI check' }));
      screen.getByRole('option', { name: 'Plan' }).focus();
      await user.keyboard('{Enter}');
      await user.click(await screen.findByRole('menuitem', { name: 'Edit settings' }));

      expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Plan');
      expect(screen.getByRole('textbox', { name: 'Label' })).toHaveFocus();
    });

    it('opens settings for a step reached with the arrow keys and never selected', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');

      screen.getAllByRole('option')[0]?.focus();
      await user.keyboard('{ArrowDown}{Enter}');
      await user.click(await screen.findByRole('menuitem', { name: 'Edit settings' }));

      expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Plan');
    });

    it('deletes the step in focus with Delete, not a different selected step', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');

      await user.click(screen.getByRole('option', { name: 'Run CI, CI check' }));
      screen.getByRole('option', { name: 'Plan' }).focus();
      await user.keyboard('{Delete}');

      expect(screen.queryByRole('option', { name: 'Plan' })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Run CI, CI check' })).toBeInTheDocument();
    });
  });

  describe('outline', () => {
    it('connects a port by choosing its target and announces it', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      await addCondition(user);
      await user.click(screen.getByRole('radio', { name: 'Outline' }));

      await user.click(screen.getByRole('button', { name: /Condition, True goes to/ }));
      await user.click(await screen.findByRole('option', { name: 'Plan' }));

      expect(screen.getByRole('status', { name: 'Editor announcements' })).toHaveTextContent(
        'Connected Condition True to Plan.',
      );
      expect(screen.getByRole('button', { name: /Condition, True goes to/ })).toHaveTextContent(
        'Plan',
      );
    });

    it('lists the steps in one flat list and tells steps with the same label apart', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      await user.click(screen.getByRole('button', { name: 'Add Plan' }));
      await user.click(screen.getByRole('radio', { name: 'Outline' }));

      const list = screen.getByRole('list', { name: 'Workflow outline' });

      expect(within(list).getAllByRole('listitem')).toHaveLength(13);
      expect(within(list).queryAllByRole('list')).toHaveLength(0);
      expect(within(list).getByRole('button', { name: 'Delete Plan' })).toBeInTheDocument();
      expect(within(list).getByRole('button', { name: 'Delete Plan 2' })).toBeInTheDocument();
    });

    it('moves focus to another step after Delete', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      await addCondition(user);
      await user.click(screen.getByRole('radio', { name: 'Outline' }));

      await user.click(screen.getByRole('button', { name: 'Delete Condition' }));

      expect(screen.queryByRole('button', { name: 'Delete Condition' })).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('list', { name: 'Workflow outline' })).getAllByRole('button'),
      ).toContain(document.activeElement);
    });
  });

  describe('pointer', () => {
    const at = (clientX: number, clientY: number) => ({ clientX, clientY });

    it('drags a step and records one move', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      const plan = screen.getByRole('option', { name: 'Plan' });
      const before = plan.style.transform;

      await user.pointer([
        { keys: '[MouseLeft>]', target: plan, coords: at(100, 100) },
        { coords: at(130, 120) },
        { coords: at(160, 140) },
        { keys: '[/MouseLeft]' },
      ]);

      expect(plan.style.transform).not.toBe(before);
      expect(screen.getByRole('status', { name: 'Editor announcements' })).toHaveTextContent(
        'Moved "Plan".',
      );
      await user.click(screen.getByRole('button', { name: 'Undo' }));
      expect(plan.style.transform).toBe(before);
    });

    it('connects a port to a step by dragging from the port onto the step', async () => {
      const user = userEvent.setup();
      await renderApp('/workflows');
      const condition = await addCondition(user);
      const plan = screen.getByRole('option', { name: 'Plan' });
      // jsdom has no layout, so hit testing is the one thing stubbed: the pointer is released over the Plan step.
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: () => plan,
      });
      // The port handles are decorative for assistive technology, so they have no role to query by.
      const port = condition.querySelector<HTMLElement>('[data-port="true"]');
      if (!port) throw new Error('The Condition step has no True port');

      try {
        await user.pointer([
          { keys: '[MouseLeft>]', target: port, coords: at(10, 10) },
          { coords: at(50, 50) },
          { keys: '[/MouseLeft]' },
        ]);
      } finally {
        Reflect.deleteProperty(document, 'elementFromPoint');
      }

      expect(screen.getByRole('status', { name: 'Editor announcements' })).toHaveTextContent(
        'Connected Condition True to Plan.',
      );
    });
  });
});
