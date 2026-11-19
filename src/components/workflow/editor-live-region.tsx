import { useEditor } from '@/state/workflow-context';

/** Announces what the editor did to a step. It is separate from the app's live region, so a simulator event cannot replace the confirmation of an edit. */
export const EditorLiveRegion = () => {
  const announcement = useEditor((s) => s.announcement);

  return (
    <div
      role='status'
      aria-live='polite'
      aria-atomic='true'
      aria-label='Editor announcements'
      className='sr-only'
    >
      {announcement}
    </div>
  );
};
