import { type MouseEvent, memo } from "react";
import { cx } from "@eylulg/ui/cx";
import { useEditor } from "@/state/workflow-context";
import { edgePath, inputPoint, midpoint, outputPoint } from "./geometry";

interface EdgeViewProps {
    id: string;
}

const stroke = (selected: boolean, traced: boolean, recent: boolean) =>
    cx("fill-none stroke-current", selected || traced ? "text-fg-brand" : recent ? "text-fg-warning" : "text-fg-tertiary", recent && "wf-edge-active");

/** One connection. It re-renders only when its own ends move or its own state changes. */
const EdgeView = memo(function EdgeView({ id }: EdgeViewProps) {
    const edge = useEditor((s) => s.edgeById.get(id));
    const from = useEditor((s) => (edge ? s.byId.get(edge.from.node) : undefined));
    const to = useEditor((s) => (edge ? s.byId.get(edge.to) : undefined));
    const selected = useEditor((s) => s.selectedEdge === id);
    const overlay = useEditor((s) => s.overlay?.edges[id]);
    const select = useEditor((s) => s.selectEdge);
    if (!edge || !from || !to) return null;

    const start = outputPoint(from, edge.from.port);
    const end = inputPoint(to);
    const d = edgePath(start, end);
    const middle = midpoint(start, end);
    const traced = overlay?.traced ?? false;

    function handlePointerDown(event: MouseEvent) {
        event.stopPropagation();
        select(id);
    }

    return (
        <g>
            <path d={d} className="cursor-pointer fill-none stroke-transparent" strokeWidth={16} onPointerDown={handlePointerDown} />
            <path
                d={d}
                className={stroke(selected, traced, overlay?.recent ?? false)}
                strokeWidth={selected || traced ? 3 : 2}
                markerEnd="url(#wf-arrow)"
                pointerEvents="none"
            />
            {overlay && overlay.count > 0 && (
                <text x={middle.x} y={middle.y - 6} textAnchor="middle" className="fill-current text-[11px] font-semibold text-secondary" pointerEvents="none">
                    {overlay.count}
                </text>
            )}
        </g>
    );
});

const PendingEdge = () => {
    const connecting = useEditor((s) => s.connecting);
    const from = useEditor((s) => (s.connecting ? s.byId.get(s.connecting.nodeId) : undefined));
    if (!connecting || !from) return null;
    return (
        <path
            d={edgePath(outputPoint(from, connecting.portId), { x: connecting.x, y: connecting.y })}
            className="fill-none stroke-current text-fg-brand"
            strokeWidth={2}
            strokeDasharray="6 4"
            pointerEvents="none"
        />
    );
};

/** All connections, drawn under the nodes in one SVG that shares the canvas transform. */
export const EdgeLayer = () => {
    const edgeIds = useEditor((s) => s.edgeIds);

    return (
        <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0 size-px overflow-visible">
            <defs>
                <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
                </marker>
            </defs>
            <g className="pointer-events-auto">
                {edgeIds.map((id) => (
                    <EdgeView key={id} id={id} />
                ))}
            </g>
            <PendingEdge />
        </svg>
    );
};
