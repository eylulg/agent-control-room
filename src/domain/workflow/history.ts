import type { Workflow } from "./types";

/** One undoable command: its label for announcements and the graph on both sides of it. */
interface Command {
    label: string;
    before: Workflow;
    after: Workflow;
}

export interface History {
    present: Workflow;
    past: Command[];
    future: Command[];
}

/** Oldest commands fall off beyond this, so a long session cannot grow the history without bound. */
export const HISTORY_LIMIT = 100;

export const createHistory = (present: Workflow): History => ({ present, past: [], future: [] });

/**
 * Records a command and clears the redo stack. Graphs are immutable and share every node an
 * edit did not touch, so keeping both sides costs little and avoids writing an inverse for each command.
 * A drag passes `before` explicitly: it replaced `present` many times without recording, then commits once.
 */
export const commit = (history: History, label: string, after: Workflow, before: Workflow = history.present): History => {
    if (after === before) return { ...history, present: after };
    return { present: after, past: [...history.past, { label, before, after }].slice(-HISTORY_LIMIT), future: [] };
};

/** Replaces the graph without recording a command, for the frames of a drag that has not ended. */
export const preview = (history: History, present: Workflow): History => ({ ...history, present });

export const undo = (history: History): { history: History; label: string } | null => {
    const command = history.past.at(-1);
    if (!command) return null;
    return { label: command.label, history: { present: command.before, past: history.past.slice(0, -1), future: [command, ...history.future] } };
};

export const redo = (history: History): { history: History; label: string } | null => {
    const [command, ...future] = history.future;
    if (!command) return null;
    return { label: command.label, history: { present: command.after, past: [...history.past, command], future } };
};
