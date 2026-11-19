import { CircleCheck, TriangleAlert } from 'lucide-react';
import { linkButton } from '@/components/app/styles';
import { useEditor, useEditorStore } from '@/state/workflow-context';
import { focusStep } from './focus-step';

/** Everything that blocks publishing. Choosing a problem moves focus to the step it is about. */
export const ProblemsPanel = () => {
  const store = useEditorStore();
  const problems = useEditor((s) => s.analysis.problems);

  function handleFocus(nodeId: string) {
    return () => focusStep(store, nodeId);
  }

  if (problems.length === 0) {
    return (
      <p className='flex items-center gap-2 text-sm text-secondary'>
        <CircleCheck aria-hidden='true' className='size-4 text-fg-success' />
        No problems. This workflow can be published.
      </p>
    );
  }

  return (
    <ul aria-label='Problems' className='flex flex-col gap-3'>
      {problems.map((problem) => (
        <li key={problem.id} className='flex items-start gap-2 text-sm'>
          <TriangleAlert aria-hidden='true' className='mt-0.5 size-4 shrink-0 text-fg-error' />
          {problem.nodeId ? (
            <button type='button' className={linkButton} onClick={handleFocus(problem.nodeId)}>
              {problem.message}
            </button>
          ) : (
            <span className='text-secondary'>{problem.message}</span>
          )}
        </li>
      ))}
    </ul>
  );
};
