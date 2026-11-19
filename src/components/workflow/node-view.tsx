import { type KeyboardEvent, type PointerEvent, memo } from "react";
import { Badge } from "@eylulg/ui/badge";
import { cx } from "@eylulg/ui/cx";
import { TriangleAlert } from "lucide-react";
import { type NodeOverlay } from "@/domain/workflow/overlay";
import { GRID_STEP, NODE_HEIGHT, NODE_META, NODE_WIDTH, PORTS } from "@/domain/workflow/types";
import { useEditor, useEditorStore } from "@/state/workflow-context";
import { formatClock } from "@/utils/format";
import { CANVAS_DOM_ID, nodeDomId, panToReveal } from "./geometry";
import { NODE_ICON, RUN_STATE } from "./node-meta";
import { trackPointer } from "./track-pointer";

interface NodeViewProps {
    id: string;
}

const BIG_STEP = GRID_STEP * 5;

const nodeClass = (selected: boolean, hasProblems: boolean) =>
    cx(
        "absolute top-0 left-0 flex cursor-grab touch-none flex-col justify-center gap-1 rounded-lg border bg-elevated px-3 shadow-xs outline-none select-none active:cursor-grabbing",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        selected ? "border-brand ring-4 ring-focus/25" : hasProblems ? "border-error" : "border-default",
    );

const describeOverlay = (overlay: NodeOverlay | undefined): string => {
    if (!overlay) return "";
    const parts: string[] = [];
    if (overlay.count > 0) parts.push(`${overlay.count} ${overlay.count === 1 ? "job is" : "jobs are"} here, ${RUN_STATE[overlay.state].label.toLowerCase()}.`);
    else if (overlay.state !== "idle") parts.push(`${RUN_STATE[overlay.state].label}.`);
    if (overlay.visits.length > 0) parts.push(`Entered at ${overlay.visits.map(formatClock).join(", ")}.`);
    return parts.join(" ");
};

/** One node on the canvas. It reads only its own slice of the store, so moving another node does not render it. */
export const NodeView = memo(function NodeView({ id }: NodeViewProps) {
    const store = useEditorStore();
    const node = useEditor((s) => s.byId.get(id));
    const selected = useEditor((s) => s.selected.includes(id));
    const tabbable = useEditor((s) => (s.focusId ?? s.analysis.order[0]) === id);
    const description = useEditor((s) => s.analysis.descriptions[id] ?? "");
    const problems = useEditor((s) => s.analysis.problemsByNode[id] ?? 0);
    const overlay = useEditor((s) => s.overlay?.nodes[id]);
    const connectedPorts = useEditor((s) => s.analysis.connectedPorts[id]);
    const unique = useEditor((s) => s.analysis.names[id]);
    if (!node) return null;

    const Icon = NODE_ICON[node.type];
    const typeLabel = NODE_META[node.type].label;
    const shared = unique ?? node.label;
    const name = shared === typeLabel ? shared : `${shared}, ${typeLabel}`;
    const status = [description, problems > 0 ? `${problems} ${problems === 1 ? "problem" : "problems"}.` : "", describeOverlay(overlay)]
        .filter(Boolean)
        .join(" ");
    const ports = PORTS[node.type];

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || !node) return;
        event.stopPropagation();
        const state = store.getState();
        if (event.shiftKey) {
            state.select(id, true);
            return;
        }
        const ids = state.selected.includes(id) ? state.selected : [id];
        if (!state.selected.includes(id)) state.select(id, false);
        trackPointer(event, {
            onStart: () => state.beginDrag(ids),
            onMove: (dx, dy) => state.dragTo(dx / store.getState().viewport.zoom, dy / store.getState().viewport.zoom),
            onEnd: () => state.endDrag(),
        });
    }

    function handleFocus() {
        const state = store.getState();
        state.setFocus(id);
        const move = node ? panToReveal(node, state.viewport, state.canvasSize) : null;
        if (move) state.panBy(move.x, move.y);
    }

    function focusNeighbour(offset: number | "first" | "last") {
        const order = store.getState().analysis.order;
        const at = order.indexOf(id);
        const next = offset === "first" ? 0 : offset === "last" ? order.length - 1 : Math.min(order.length - 1, Math.max(0, at + offset));
        const target = order[next];
        if (target) document.getElementById(nodeDomId(target))?.focus();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const state = store.getState();
        if (event.altKey && event.key.startsWith("Arrow")) {
            event.preventDefault();
            const step = event.shiftKey ? BIG_STEP : GRID_STEP;
            const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
            const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
            state.nudge(state.selected.includes(id) ? state.selected : [id], dx, dy);
            return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        switch (event.key) {
            case "ArrowDown":
            case "ArrowRight":
                event.preventDefault();
                return focusNeighbour(1);
            case "ArrowUp":
            case "ArrowLeft":
                event.preventDefault();
                return focusNeighbour(-1);
            case "Home":
                event.preventDefault();
                return focusNeighbour("first");
            case "End":
                event.preventDefault();
                return focusNeighbour("last");
            case " ":
                event.preventDefault();
                return state.select(id, true);
            case "Enter":
                event.preventDefault();
                return state.openMenu(id);
            case "ContextMenu":
                event.preventDefault();
                return state.openMenu(id);
            case "F10":
                if (!event.shiftKey) return;
                event.preventDefault();
                return state.openMenu(id);
        }
    }

    function handlePortDown(portId: string) {
        return (event: PointerEvent<HTMLSpanElement>) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();
            const toCanvas = (clientX: number, clientY: number) => {
                const rect = document.getElementById(CANVAS_DOM_ID)?.getBoundingClientRect();
                const { viewport } = store.getState();
                return { x: (clientX - (rect?.left ?? 0) - viewport.x) / viewport.zoom, y: (clientY - (rect?.top ?? 0) - viewport.y) / viewport.zoom };
            };
            const at = toCanvas(event.clientX, event.clientY);
            store.getState().startConnecting(id, portId, at.x, at.y);
            trackPointer(event, {
                threshold: 0,
                onMove: (_dx, _dy, pointer) => {
                    const point = toCanvas(pointer.clientX, pointer.clientY);
                    store.getState().moveConnecting(point.x, point.y);
                },
                onEnd: (_moved, pointer) => {
                    const target = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
                    store.getState().stopConnecting();
                    if (target) store.getState().connect(id, portId, target);
                },
            });
        };
    }

    return (
        <div
            id={nodeDomId(id)}
            role="option"
            aria-selected={selected}
            aria-label={name}
            aria-describedby={`${nodeDomId(id)}-description`}
            tabIndex={tabbable ? 0 : -1}
            data-node-id={id}
            className={nodeClass(selected, problems > 0)}
            style={{ width: NODE_WIDTH, height: NODE_HEIGHT, transform: `translate(${node.position.x}px, ${node.position.y}px)` }}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
        >
            <span id={`${nodeDomId(id)}-description`} className="sr-only">
                {status}
            </span>
            <span aria-hidden="true" className="flex min-w-0 items-center gap-2">
                <Icon className="size-4 shrink-0 text-fg-brand" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{node.label}</span>
                {problems > 0 && <TriangleAlert className="size-4 shrink-0 text-fg-error" />}
            </span>
            <span aria-hidden="true" className="flex items-center gap-2 text-xs text-tertiary">
                <span className="truncate">{typeLabel}</span>
                {overlay && <OverlayBadge overlay={overlay} />}
            </span>
            {node.type !== "trigger" && (
                <span
                    aria-hidden="true"
                    data-port="in"
                    className="absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rounded-full border-2 border-strong bg-primary"
                />
            )}
            {ports.map((port, index) => (
                <span
                    key={port.id}
                    aria-hidden="true"
                    data-port={port.id}
                    onPointerDown={handlePortDown(port.id)}
                    className={cx(
                        "absolute -right-2 flex size-4 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-strong hover:border-brand",
                        connectedPorts?.includes(port.id) ? "bg-fg-tertiary" : "bg-primary",
                    )}
                    style={{ top: `${((index + 1) / (ports.length + 1)) * 100}%` }}
                >
                    {ports.length > 1 && (
                        <span className="pointer-events-none absolute right-5 text-[10px] leading-none whitespace-nowrap text-tertiary">{port.label}</span>
                    )}
                </span>
            ))}
        </div>
    );
});

const OverlayBadge = ({ overlay }: { overlay: NodeOverlay }) => {
    const { label, color } = RUN_STATE[overlay.state];
    if (overlay.count > 0) {
        return (
            <Badge size="sm" color={color} dot>
                {overlay.count} {overlay.count === 1 ? "job" : "jobs"}
            </Badge>
        );
    }
    if (overlay.state === "idle") return null;
    return (
        <Badge size="sm" color={color} dot>
            {label}
            {overlay.visits.length > 0 && ` ${formatClock(overlay.visits[0] ?? 0)}`}
        </Badge>
    );
};
