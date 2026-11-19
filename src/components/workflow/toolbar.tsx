import { useLayoutEffect } from 'react';
import { Badge } from '@eylulg/ui/badge';
import { Button } from '@eylulg/ui/button';
import { IconButton } from '@eylulg/ui/icon-button';
import { SegmentedControl, SegmentedControlItem } from '@eylulg/ui/segmented-control';
import {
  LayoutDashboard,
  List,
  Maximize,
  Redo2,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Key } from 'react-aria-components';
import { useEditor, useEditorStore } from '@/state/workflow-context';
import { useFocusHandoff } from './focus-step';

const ZOOM_STEP = 1.2;
const UNDO_ID = 'wf-undo';
const REDO_ID = 'wf-redo';
const TIDY_ID = 'wf-tidy';

export const EditToolbar = () => {
  const store = useEditorStore();
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const view = useEditor((s) => s.view);

  const { groupProps, handoff } = useFocusHandoff();

  useLayoutEffect(() => {
    if (!canUndo) handoff(UNDO_ID, canRedo ? REDO_ID : TIDY_ID);
    if (!canRedo) handoff(REDO_ID, canUndo ? UNDO_ID : TIDY_ID);
  }, [canUndo, canRedo, handoff]);

  function handleUndo() {
    store.getState().undo();
  }
  function handleRedo() {
    store.getState().redo();
  }
  function handleTidy() {
    store.getState().tidy();
  }
  function handleView(key: Key) {
    store.getState().setView(key === 'outline' ? 'outline' : 'canvas');
  }

  return (
    <div
      role='toolbar'
      aria-label='Edit workflow'
      className='flex flex-wrap items-center gap-2'
      {...groupProps}
    >
      <Button
        id={UNDO_ID}
        variant='secondary'
        size='sm'
        iconLeading={Undo2}
        onPress={handleUndo}
        isDisabled={!canUndo}
      >
        Undo
      </Button>
      <Button
        id={REDO_ID}
        variant='secondary'
        size='sm'
        iconLeading={Redo2}
        onPress={handleRedo}
        isDisabled={!canRedo}
      >
        Redo
      </Button>
      <Button id={TIDY_ID} variant='secondary' size='sm' iconLeading={Wand2} onPress={handleTidy}>
        Tidy up
      </Button>
      <SegmentedControl
        aria-label='Workflow view'
        size='sm'
        selectedKey={view}
        onSelectionChange={handleView}
      >
        <SegmentedControlItem id='canvas' icon={LayoutDashboard}>
          Canvas
        </SegmentedControlItem>
        <SegmentedControlItem id='outline' icon={List}>
          Outline
        </SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
};

export const ZoomControls = () => {
  const store = useEditorStore();
  const zoom = useEditor((s) => s.viewport.zoom);

  function handleZoomIn() {
    store.getState().zoomBy(ZOOM_STEP);
  }
  function handleZoomOut() {
    store.getState().zoomBy(1 / ZOOM_STEP);
  }
  function handleFit() {
    store.getState().fit();
  }

  return (
    <div role='group' aria-label='Zoom' className='flex items-center gap-1'>
      <IconButton
        variant='secondary'
        size='sm'
        icon={ZoomOut}
        aria-label='Zoom out'
        onPress={handleZoomOut}
      />
      <span className='w-12 text-center text-sm text-secondary' aria-live='off'>
        {Math.round(zoom * 100)}%
      </span>
      <IconButton
        variant='secondary'
        size='sm'
        icon={ZoomIn}
        aria-label='Zoom in'
        onPress={handleZoomIn}
      />
      <IconButton
        variant='secondary'
        size='sm'
        icon={Maximize}
        aria-label='Fit to view'
        onPress={handleFit}
      />
    </div>
  );
};

export const DraftBadge = () => {
  const dirty = useEditor((s) => s.dirty);
  const problems = useEditor((s) => s.analysis.problems.length);
  if (problems > 0)
    return (
      <Badge color='error'>
        {problems} {problems === 1 ? 'problem' : 'problems'}
      </Badge>
    );
  return dirty ? (
    <Badge color='warning'>Draft with unpublished changes</Badge>
  ) : (
    <Badge color='success'>Matches the published version</Badge>
  );
};
