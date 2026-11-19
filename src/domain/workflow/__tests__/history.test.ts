import { describe, expect, it } from 'vitest';
import { defaultWorkflow } from '@/test-utils/workflow';
import { HISTORY_LIMIT, commit, createHistory, preview, redo, undo } from '../history';
import { moveNodes } from '../ops';

const move = (history: ReturnType<typeof createHistory>, dx: number) =>
  commit(history, `Move ${dx}`, moveNodes(history.present, new Set(['plan']), dx, 0));

describe('history', () => {
  it('undoes and redoes a command and reports its label', () => {
    const start = createHistory(defaultWorkflow());
    const moved = move(start, 20);

    const undone = undo(moved);
    const redone = undone && redo(undone.history);

    expect(undone?.label).toBe('Move 20');
    expect(undone?.history.present).toBe(start.present);
    expect(redone?.history.present).toBe(moved.present);
  });

  it('clears the redo stack when a new command is recorded', () => {
    const undone = undo(move(createHistory(defaultWorkflow()), 20));

    const next = undone && move(undone.history, 40);

    expect(next?.future).toEqual([]);
  });

  it('has nothing to undo or redo on a fresh history', () => {
    const history = createHistory(defaultWorkflow());

    expect(undo(history)).toBeNull();
    expect(redo(history)).toBeNull();
  });

  it('keeps only the newest commands beyond the cap', () => {
    let history = createHistory(defaultWorkflow());
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) history = move(history, i);

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]?.label).toBe('Move 6');
  });

  it('records a drag as one command however many frames it had', () => {
    const start = createHistory(defaultWorkflow());
    let dragging = start;
    for (let i = 1; i <= 10; i++)
      dragging = preview(dragging, moveNodes(dragging.present, new Set(['plan']), 5, 0));

    const done = commit(dragging, 'Move Plan', dragging.present, start.present);

    expect(done.past).toHaveLength(1);
    expect(undo(done)?.history.present).toBe(start.present);
  });

  it('records nothing when a command changes nothing', () => {
    const start = createHistory(defaultWorkflow());

    expect(commit(start, 'No change', start.present).past).toEqual([]);
  });
});
