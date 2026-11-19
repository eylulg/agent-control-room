import { type DragEvent, type PointerEvent, useEffect, useRef } from 'react';
import { isNodeType } from '@/domain/workflow/ops';
import { GRID_STEP, NODE_HEIGHT, NODE_WIDTH } from '@/domain/workflow/types';
import { useEditor, useEditorStore } from '@/state/workflow-context';
import { EdgeLayer } from './edge-layer';
import { CANVAS_DOM_ID } from './geometry';
import { NodeMenu } from './node-menu';
import { NodeView } from './node-view';
import { trackPointer } from './track-pointer';

export const PALETTE_MIME = 'application/x-workflow-node';

const WHEEL_ZOOM_RATE = 0.0025;
const GRID_DOT = 24;
/** The first view opens on the whole workflow, but never smaller than this, where text is still readable. */
const OPENING_MIN_ZOOM = 0.55;

const snap = (value: number): number => Math.round(value / GRID_STEP) * GRID_STEP;

/**
 * The pan and zoom surface. Nodes are HTML elements and connections are one SVG, both inside a single transformed layer,
 * so panning and zooming change one transform instead of every node. The nodes are a listbox: Tab enters it once and the
 * arrow keys move between them in topological order.
 */
export const Canvas = () => {
  const store = useEditorStore();
  const nodeIds = useEditor((s) => s.nodeIds);
  const viewport = useEditor((s) => s.viewport);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const state = store.getState();
      state.setCanvasSize({ width: rect.width, height: rect.height });
      if (!state.fitted && rect.width > 0) state.fit(OPENING_MIN_ZOOM);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    // Zoom events can arrive several times per frame. They are summed and applied once per frame.
    let zoom = { factor: 1, x: 0, y: 0 };
    let frame = 0;
    const flush = () => {
      frame = 0;
      const state = store.getState();
      if (zoom.factor !== 1) state.zoomBy(zoom.factor, { x: zoom.x, y: zoom.y });
      zoom = { factor: 1, x: 0, y: 0 };
    };
    // Wheel and key handlers are native listeners. React attaches wheel listeners as passive, and zooming has to cancel the page scroll. The key handler
    // sits on the surface because the listbox of nodes is not itself focusable, its options are.
    // A plain wheel is left alone so the page scrolls past the canvas. Only a zoom gesture is taken.
    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoom = {
        factor: zoom.factor * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      if (frame === 0) frame = window.requestAnimationFrame(flush);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = store.getState();
      if (event.key === 'Escape') {
        if (state.connecting) state.stopConnecting();
        else state.clearSelection();
        return;
      }
      // The same rule as the step menu: the selection if the step in focus belongs to it, otherwise the step in focus alone.
      const focused =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
          : undefined;
      const targets = focused && !state.selected.includes(focused) ? [focused] : state.selected;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (state.selectedEdge && !focused) state.disconnectEdge(state.selectedEdge);
        else state.deleteIds(targets);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        state.duplicate(targets);
        state.requestFocus(true);
      }
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    element.addEventListener('keydown', handleKeyDown);
    return () => {
      observer.disconnect();
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('keydown', handleKeyDown);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [store]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const start = store.getState().viewport;
    trackPointer(event, {
      onMove: (dx, dy) => {
        const state = store.getState();
        state.panBy(start.x + dx - state.viewport.x, start.y + dy - state.viewport.y);
      },
      onEnd: (moved) => {
        if (!moved) store.getState().clearSelection();
      },
    });
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.types.includes(PALETTE_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const type = event.dataTransfer.getData(PALETTE_MIME);
    if (!isNodeType(type)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const { viewport: current } = store.getState();
    const x = snap((event.clientX - rect.left - current.x) / current.zoom - NODE_WIDTH / 2);
    const y = snap((event.clientY - rect.top - current.y) / current.zoom - NODE_HEIGHT / 2);
    store.getState().addNode(type, { x, y });
    store.getState().requestFocus(true);
  }

  const dot = GRID_DOT * viewport.zoom;

  return (
    <div
      ref={surface}
      id={CANVAS_DOM_ID}
      role='group'
      tabIndex={-1}
      aria-label='Workflow canvas'
      className='relative h-full min-h-[24rem] touch-pan-y overflow-hidden rounded-lg border border-default bg-secondary'
      style={{
        backgroundImage: 'radial-gradient(var(--ui-border-default) 1px, transparent 1px)',
        backgroundSize: `${dot}px ${dot}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={handlePointerDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className='absolute top-0 left-0 origin-top-left'
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
      >
        <EdgeLayer />
        <div
          role='listbox'
          aria-label='Workflow steps'
          aria-multiselectable='true'
          aria-orientation='horizontal'
        >
          {nodeIds.map((id) => (
            <NodeView key={id} id={id} />
          ))}
        </div>
      </div>
      <NodeMenu />
    </div>
  );
};
