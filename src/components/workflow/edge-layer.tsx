import { type MouseEvent, memo } from 'react';
import { cx } from '@eylulg/ui/cx';
import { useEditor } from '@/state/workflow-context';
import {
  CANVAS_DOM_ID,
  inputPoint,
  needsRouting,
  outputPoint,
  placeLabels,
  routeEdge,
} from './geometry';

interface EdgeViewProps {
  id: string;
}

const stroke = (selected: boolean, traced: boolean, recent: boolean) =>
  cx(
    'fill-none stroke-current',
    selected || traced ? 'text-fg-brand' : recent ? 'text-fg-warning' : 'text-fg-tertiary',
    recent && 'wf-edge-active',
  );

/** One connection. It re-renders only when its own ends move or its own state changes. A routed one also follows the other steps it has to go around. */
const EdgeView = memo(function EdgeView({ id }: EdgeViewProps) {
  const edge = useEditor((s) => s.edgeById.get(id));
  const from = useEditor((s) => (edge ? s.byId.get(edge.from.node) : undefined));
  const to = useEditor((s) => (edge ? s.byId.get(edge.to) : undefined));
  const isBack = useEditor((s) => s.analysis.backEdges.has(id));
  const routed =
    from && to && edge
      ? needsRouting(outputPoint(from, edge.from.port), inputPoint(to), isBack)
      : false;
  const nodes = useEditor((s) => (routed ? s.byId : undefined));
  const selected = useEditor((s) => s.selectedEdge === id);
  const overlay = useEditor((s) => s.overlay?.edges[id]);
  const select = useEditor((s) => s.selectEdge);
  if (!edge || !from || !to) return null;

  const { d } = routeEdge(from, edge.from.port, to, nodes?.values() ?? [], isBack);
  const traced = overlay?.traced ?? false;

  function handlePointerDown(event: MouseEvent) {
    event.stopPropagation();
    select(id);
    document.getElementById(CANVAS_DOM_ID)?.focus({ preventScroll: true });
  }

  return (
    <g>
      <path
        d={d}
        className='cursor-pointer fill-none stroke-transparent'
        strokeWidth={16}
        onPointerDown={handlePointerDown}
      />
      <path
        d={d}
        className={stroke(selected, traced, overlay?.recent ?? false)}
        strokeWidth={selected || traced ? 3 : 2}
        markerEnd='url(#wf-arrow)'
        pointerEvents='none'
      />
    </g>
  );
});

/** The counts on connections. They follow every step, so they live apart from the connections, which do not. */
const EdgeLabels = () => {
  const edgeById = useEditor((s) => s.edgeById);
  const byId = useEditor((s) => s.byId);
  const backEdges = useEditor((s) => s.analysis.backEdges);
  const counts = useEditor((s) => s.overlay?.edges);
  if (!counts) return null;

  const items = [...edgeById.values()].flatMap((edge) => {
    const count = counts[edge.id]?.count ?? 0;
    const from = byId.get(edge.from.node);
    const to = byId.get(edge.to);
    if (count === 0 || !from || !to) return [];
    return [
      {
        id: edge.id,
        text: String(count),
        points: routeEdge(from, edge.from.port, to, byId.values(), backEdges.has(edge.id)).points,
      },
    ];
  });
  const boxes = placeLabels(items, byId.values());

  return (
    <g>
      {items.map((item) => {
        const box = boxes.get(item.id);
        return (
          box && (
            <text
              key={item.id}
              x={box.x + 1}
              y={box.y + box.height - 3}
              className='fill-current text-[11px] font-semibold text-secondary'
              pointerEvents='none'
            >
              {item.text}
            </text>
          )
        );
      })}
    </g>
  );
};

const PendingEdge = () => {
  const connecting = useEditor((s) => s.connecting);
  const from = useEditor((s) => (s.connecting ? s.byId.get(s.connecting.nodeId) : undefined));
  if (!connecting || !from) return null;
  return (
    <path
      d={`M ${outputPoint(from, connecting.portId).x} ${outputPoint(from, connecting.portId).y} L ${connecting.x} ${connecting.y}`}
      className='fill-none stroke-current text-fg-brand'
      strokeWidth={2}
      strokeDasharray='6 4'
      pointerEvents='none'
    />
  );
};

/** All connections, drawn under the nodes in one SVG that shares the canvas transform. */
export const EdgeLayer = () => {
  const edgeIds = useEditor((s) => s.edgeIds);

  return (
    <svg
      aria-hidden='true'
      className='pointer-events-none absolute top-0 left-0 size-px overflow-visible'
    >
      <defs>
        <marker
          id='wf-arrow'
          viewBox='0 0 10 10'
          refX='10'
          refY='5'
          markerWidth='8'
          markerHeight='8'
          orient='auto-start-reverse'
        >
          <path d='M 0 0 L 10 5 L 0 10 z' fill='context-stroke' />
        </marker>
      </defs>
      <g className='pointer-events-auto'>
        {edgeIds.map((id) => (
          <EdgeView key={id} id={id} />
        ))}
      </g>
      <EdgeLabels />
      <PendingEdge />
    </svg>
  );
};
