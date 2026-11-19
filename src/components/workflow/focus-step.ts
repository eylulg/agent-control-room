import { type FocusEvent, useCallback, useLayoutEffect, useRef } from 'react';
import { useEditor, useEditorStore } from '@/state/workflow-context';
import type { EditorStore } from '@/state/workflow-store';
import { nodeDomId, outlineDomId } from './geometry';

const stepElement = (id: string): HTMLElement | null =>
  document.getElementById(nodeDomId(id)) ?? document.getElementById(outlineDomId(id));

/** Selects a step and moves focus to it, on the canvas or in the outline, whichever is showing. */
export const focusStep = (store: EditorStore, id: string): void => {
  store.getState().select(id, false);
  stepElement(id)?.focus();
};

/**
 * Carries out requests to put focus on the current step, after the render that removed or replaced what had it.
 * A request without `force` is ignored unless focus was lost to the page, so it never takes focus from a control the person is using.
 */
export const useFocusRequests = (): void => {
  const store = useEditorStore();
  const request = useEditor((s) => s.focusRequest);
  const handled = useRef(request);

  useLayoutEffect(() => {
    if (!request || request === handled.current) return;
    handled.current = request;
    const active = document.activeElement;
    if (!request.force && active && active !== document.body) return;
    const id = store.getState().focusId;
    if (id) stepElement(id)?.focus();
  }, [request, store]);
};

/**
 * A button that disables itself while it has focus loses it, and browsers drop focus to the page at that moment. This remembers which control
 * of a group was focused last, so the group can hand focus to another control when that one goes away.
 */
export const useFocusHandoff = () => {
  const last = useRef('');

  function handleFocus(event: FocusEvent<HTMLElement>) {
    last.current = event.target.id;
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (event.relatedTarget) last.current = '';
  }

  // Stable, because the groups call it from an effect.
  const handoff = useCallback((fromId: string, toId: string) => {
    const active = document.activeElement;
    if (last.current !== fromId || (active && active !== document.body && active.id !== fromId))
      return;
    document.getElementById(toId)?.focus();
  }, []);

  return { groupProps: { onFocus: handleFocus, onBlur: handleBlur }, handoff };
};
