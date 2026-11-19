import { useEffect, useRef, useState } from 'react';

/**
 * Text being typed into a field that commits when the field loses focus. `commit` returns false to keep the draft on screen,
 * for a value that is not allowed yet. The draft is also committed when the field goes away, which happens when another step is selected
 * before the blur event arrives, so what was typed always lands on the step it was typed for.
 */
export const useDraft = (value: string, commit: (text: string) => boolean) => {
  const [draft, setDraft] = useState<string | null>(null);
  const latest = useRef({ draft, commit });

  useEffect(() => {
    latest.current = { draft, commit };
  });

  useEffect(
    () => () => {
      const { draft: pending, commit: save } = latest.current;
      if (pending !== null) save(pending);
    },
    [],
  );

  function handleBlur() {
    if (draft !== null && commit(draft)) setDraft(null);
  }

  return { shown: draft ?? value, editing: draft !== null, onChange: setDraft, onBlur: handleBlur };
};
