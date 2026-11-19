import { type StoreApi, createStore } from "zustand/vanilla";
import { nodeIndex, topologicalOrder } from "@/domain/workflow/graph";
import { type History, commit, createHistory, preview, redo, undo } from "@/domain/workflow/history";
import { autoLayout } from "@/domain/workflow/layout";
import { addNode, connect, createNode, deleteNodes, describeNode, disconnect, duplicateNodes, moveNodes, uniqueNames, updateNode } from "@/domain/workflow/ops";
import type { Overlay } from "@/domain/workflow/overlay";
import {
    GRID_STEP,
    NODE_HEIGHT,
    NODE_WIDTH,
    type NodeConfigs,
    type NodeType,
    PORTS,
    type Position,
    type Workflow,
    type WorkflowEdge,
    type WorkflowNode,
} from "@/domain/workflow/types";
import { type Problem, validateWorkflow } from "@/domain/workflow/validate";
import { saveDraft } from "./persist";

interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

interface CanvasSize {
    width: number;
    height: number;
}

interface Analysis {
    problems: Problem[];
    problemsByNode: Record<string, number>;
    descriptions: Record<string, string>;
    /** Output ports that have a connection, per node. */
    connectedPorts: Record<string, string[]>;
    /** Node ids in the order the roving tabindex and the outline visit them. */
    order: string[];
    /** A name per step that no other step shares, for controls that must be told apart. */
    names: Record<string, string>;
}

interface Connecting {
    nodeId: string;
    portId: string;
    /** Pointer position in canvas coordinates. */
    x: number;
    y: number;
}

interface NodeMenuState {
    nodeId: string;
    view: "root" | "connect" | "disconnect";
}

type EditorView = "canvas" | "outline";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const FIT_PADDING = 48;

export interface EditorState {
    history: History;
    byId: ReadonlyMap<string, WorkflowNode>;
    edgeById: ReadonlyMap<string, WorkflowEdge>;
    /** Changes only when nodes are added or removed, so the node list does not re-render while one is dragged. */
    nodeIds: readonly string[];
    edgeIds: readonly string[];
    analysis: Analysis;
    published: Workflow;
    dirty: boolean;
    selected: readonly string[];
    selectedEdge: string | null;
    focusId: string | null;
    viewport: Viewport;
    canvasSize: CanvasSize;
    view: EditorView;
    /** True once the view has been fitted to the graph, so the first visit opens on the whole workflow and later ones keep the user's view. */
    fitted: boolean;
    connecting: Connecting | null;
    menu: NodeMenuState | null;
    overlay: Overlay | null;
    /** True until the inspector has moved focus to its first field, as asked by "Edit settings". */
    inspectorPending: boolean;
    /** A new object each time something asks for focus to go to the current step. Without `force`, focus only moves when it was lost. */
    focusRequest: { force: boolean } | null;
    addNode: (type: NodeType, position?: Position) => void;
    select: (id: string, additive: boolean) => void;
    selectEdge: (id: string) => void;
    clearSelection: () => void;
    setFocus: (id: string) => void;
    beginDrag: (ids: readonly string[]) => void;
    dragTo: (dx: number, dy: number) => void;
    endDrag: () => void;
    nudge: (ids: readonly string[], dx: number, dy: number) => void;
    connect: (nodeId: string, portId: string, targetId: string) => void;
    disconnectEdge: (edgeId: string) => void;
    deleteIds: (ids: readonly string[]) => void;
    deleteSelection: () => void;
    duplicate: (ids: readonly string[]) => void;
    updateNode: (id: string, patch: { label?: string; config?: Partial<NodeConfigs[NodeType]> }) => void;
    tidy: () => void;
    replace: (workflow: Workflow, label: string) => void;
    undo: () => void;
    redo: () => void;
    setPublished: (workflow: Workflow) => void;
    setView: (view: EditorView) => void;
    setOverlay: (overlay: Overlay | null) => void;
    setCanvasSize: (size: CanvasSize) => void;
    panBy: (dx: number, dy: number) => void;
    zoomBy: (factor: number, anchor?: Position) => void;
    fit: (minZoom?: number) => void;
    startConnecting: (nodeId: string, portId: string, x: number, y: number) => void;
    moveConnecting: (x: number, y: number) => void;
    stopConnecting: () => void;
    openMenu: (nodeId: string) => void;
    setMenuView: (view: NodeMenuState["view"]) => void;
    closeMenu: () => void;
    requestInspector: (nodeId: string) => void;
    consumeInspectorRequest: () => void;
    requestFocus: (force?: boolean) => void;
}

export interface EditorStoreOptions {
    /** The draft to start from. Usually the saved draft, otherwise the published workflow. */
    draft: Workflow;
    published: Workflow;
    storage?: Storage;
    announce?: (text: string) => void;
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const snap = (value: number): number => Math.round(value / GRID_STEP) * GRID_STEP;

const analyse = (workflow: Workflow): Analysis => {
    const problems = validateWorkflow(workflow);
    const problemsByNode: Record<string, number> = {};
    for (const problem of problems) if (problem.nodeId) problemsByNode[problem.nodeId] = (problemsByNode[problem.nodeId] ?? 0) + 1;
    const descriptions = Object.fromEntries(workflow.nodes.map((node) => [node.id, describeNode(workflow, node.id)]));
    const connectedPorts: Record<string, string[]> = {};
    for (const edge of workflow.edges) connectedPorts[edge.from.node] = [...(connectedPorts[edge.from.node] ?? []), edge.from.port];
    const order = topologicalOrder(workflow);
    return { problems, problemsByNode, descriptions, connectedPorts, order, names: uniqueNames(workflow, order) };
};

/** Keeps the previous object for every node and connection whose overlay did not change, so only the ones that did re-render. */
const reuseOverlay = (previous: Overlay | null, next: Overlay | null): Overlay | null => {
    if (!previous || !next) return next;
    const reuse = <T>(before: Record<string, T>, after: Record<string, T>): Record<string, T> => {
        const merged: Record<string, T> = {};
        for (const [id, entry] of Object.entries(after)) {
            const old = before[id];
            merged[id] = old !== undefined && sameJson(old, entry) ? old : entry;
        }
        return merged;
    };
    const nodes = reuse(previous.nodes, next.nodes);
    const edges = reuse(previous.edges, next.edges);
    return sameJson(previous, { nodes, edges }) ? previous : { nodes, edges };
};

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

export type EditorStore = StoreApi<EditorState>;

export const createEditorStore = ({ draft, published, storage, announce = () => {} }: EditorStoreOptions): EditorStore => {
    /** The graph as it was when the current drag began. Each frame is computed from it, so frames never add up errors. */
    let dragStart: { workflow: Workflow; ids: ReadonlySet<string> } | null = null;

    const store = createStore<EditorState>()((set, get) => {
        const nodesOf = (ids: readonly string[]): WorkflowNode[] => ids.flatMap((id) => get().byId.get(id) ?? []);
        const nameOf = (id: string): string => get().byId.get(id)?.label ?? id;
        const describeSet = (ids: readonly string[]): string => (ids.length === 1 ? `"${nameOf(ids[0] ?? "")}"` : plural(ids.length, "step", "steps"));

        /** Puts a new history in place. Layout only changes during a drag, so analysis is skipped for previews. */
        const place = (history: History, { analysed }: { analysed: boolean }): Partial<EditorState> => {
            const workflow = history.present;
            const previous = get();
            const ids = workflow.nodes.map((node) => node.id);
            const sameIds = ids.length === previous.nodeIds.length && ids.every((id, i) => id === previous.nodeIds[i]);
            const byId = nodeIndex(workflow);
            const patch: Partial<EditorState> = {
                history,
                byId,
                ...(workflow.edges === previous.history.present.edges
                    ? {}
                    : { edgeById: new Map(workflow.edges.map((edge) => [edge.id, edge])), edgeIds: workflow.edges.map((edge) => edge.id) }),
                nodeIds: sameIds ? previous.nodeIds : ids,
                selected: previous.selected.filter((id) => byId.has(id)),
                selectedEdge: previous.selectedEdge && workflow.edges.some((edge) => edge.id === previous.selectedEdge) ? previous.selectedEdge : null,
            };
            if (analysed) {
                const analysis = analyse(workflow);
                patch.analysis = analysis;
                patch.dirty = !sameJson(workflow, previous.published);
                if (!previous.focusId || !byId.has(previous.focusId)) patch.focusId = analysis.order[0] ?? null;
                if (storage) saveDraft(storage, workflow);
            }
            return patch;
        };

        const run = (label: string, next: Workflow, message: string, extra: Partial<EditorState> = {}) => {
            if (next === get().history.present) return;
            set({ ...place(commit(get().history, label, next), { analysed: true }), ...extra });
            announce(message);
        };

        const initial = createHistory(draft);
        const analysis = analyse(draft);

        return {
            history: initial,
            byId: nodeIndex(draft),
            edgeById: new Map(draft.edges.map((edge) => [edge.id, edge])),
            nodeIds: draft.nodes.map((node) => node.id),
            edgeIds: draft.edges.map((edge) => edge.id),
            analysis,
            published,
            dirty: !sameJson(draft, published),
            selected: [],
            selectedEdge: null,
            focusId: analysis.order[0] ?? null,
            viewport: { x: 40, y: 40, zoom: 1 },
            canvasSize: { width: 0, height: 0 },
            view: "canvas",
            fitted: false,
            connecting: null,
            menu: null,
            overlay: null,
            inspectorPending: false,
            focusRequest: null,

            addNode: (type, position) => {
                const { viewport, canvasSize, history } = get();
                const centre = {
                    x: snap((canvasSize.width / 2 - viewport.x) / viewport.zoom - NODE_WIDTH / 2),
                    y: snap((canvasSize.height / 2 - viewport.y) / viewport.zoom - NODE_HEIGHT / 2),
                };
                const at = { ...(position ?? centre) };
                // Never drop a node exactly on another one: step down and right until the spot is free.
                while (history.present.nodes.some((node) => node.position.x === at.x && node.position.y === at.y)) {
                    at.x += GRID_STEP;
                    at.y += GRID_STEP;
                }
                const node = createNode(history.present, type, at);
                run(
                    `Add ${node.label}`,
                    addNode(history.present, node),
                    `Added ${node.label}. ${plural(history.present.nodes.length + 1, "step", "steps")} in the workflow.`,
                    {
                        selected: [node.id],
                        selectedEdge: null,
                        focusId: node.id,
                    },
                );
            },

            select: (id, additive) => {
                const { selected } = get();
                const next = additive ? (selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]) : [id];
                set({ selected: next, selectedEdge: null, focusId: id });
            },
            selectEdge: (id) => set({ selectedEdge: id, selected: [] }),
            clearSelection: () => set({ selected: [], selectedEdge: null }),
            setFocus: (id) => {
                if (get().focusId !== id) set({ focusId: id });
            },

            beginDrag: (ids) => {
                dragStart = { workflow: get().history.present, ids: new Set(ids) };
            },
            dragTo: (dx, dy) => {
                if (!dragStart) return;
                set(place(preview(get().history, moveNodes(dragStart.workflow, dragStart.ids, dx, dy)), { analysed: false }));
            },
            endDrag: () => {
                if (!dragStart) return;
                const { workflow, ids } = dragStart;
                dragStart = null;
                const present = get().history.present;
                if (present === workflow) return;
                const names = describeSet([...ids]);
                const label = ids.size === 1 ? `Move ${nameOf([...ids][0] ?? "")}` : `Move ${plural(ids.size, "step", "steps")}`;
                set(place(commit(get().history, label, present, workflow), { analysed: true }));
                announce(`Moved ${names}.`);
            },
            nudge: (ids, dx, dy) => {
                const { history } = get();
                const next = moveNodes(history.present, new Set(ids), dx, dy);
                const first = next.nodes.find((node) => node.id === ids[0]);
                const where = first ? ` to ${first.position.x}, ${first.position.y}` : "";
                run(
                    ids.length === 1 ? `Move ${nameOf(ids[0] ?? "")}` : `Move ${plural(ids.length, "step", "steps")}`,
                    next,
                    `Moved ${describeSet(ids)}${where}.`,
                );
            },

            connect: (nodeId, portId, targetId) => {
                const { history } = get();
                const port = PORTS[get().byId.get(nodeId)?.type ?? "end"].find((candidate) => candidate.id === portId);
                run(
                    `Connect ${nameOf(nodeId)} to ${nameOf(targetId)}`,
                    connect(history.present, nodeId, portId, targetId),
                    `Connected ${nameOf(nodeId)} ${port?.label ?? portId} to ${nameOf(targetId)}.`,
                    { selected: [nodeId], selectedEdge: null },
                );
            },
            disconnectEdge: (edgeId) => {
                const edge = get().edgeById.get(edgeId);
                if (!edge) return;
                run(
                    `Disconnect ${nameOf(edge.from.node)}`,
                    disconnect(get().history.present, new Set([edgeId])),
                    `Deleted the connection from ${nameOf(edge.from.node)} to ${nameOf(edge.to)}.`,
                    {
                        selectedEdge: null,
                    },
                );
            },

            deleteIds: (ids) => {
                if (ids.length === 0) return;
                const names = describeSet(ids);
                const order = get().analysis.order;
                const survivors = order.filter((id) => !ids.includes(id));
                const next = order.findIndex((id) => ids.includes(id));
                run(`Delete ${names.replaceAll('"', "")}`, deleteNodes(get().history.present, new Set(ids)), `Deleted ${names}.`, {
                    selected: [],
                    focusId: survivors[Math.min(Math.max(next - 1, 0), survivors.length - 1)] ?? null,
                    focusRequest: { force: false },
                });
            },
            deleteSelection: () => {
                const { selected, selectedEdge, deleteIds, disconnectEdge } = get();
                if (selected.length > 0) deleteIds(selected);
                else if (selectedEdge) disconnectEdge(selectedEdge);
            },
            duplicate: (ids) => {
                const { workflow, created } = duplicateNodes(get().history.present, new Set(ids));
                if (created.length === 0) return;
                const source = nodesOf(ids).filter((node) => node.type !== "trigger");
                run(
                    `Duplicate ${created.length === 1 ? (source[0]?.label ?? "step") : plural(created.length, "step", "steps")}`,
                    workflow,
                    `Duplicated ${plural(created.length, "step", "steps")}.`,
                    {
                        selected: created,
                        focusId: created[0] ?? get().focusId,
                    },
                );
            },
            updateNode: (id, patch) => {
                if (!get().byId.has(id)) return;
                run(`Edit ${nameOf(id)}`, updateNode(get().history.present, id, patch), `Updated ${patch.label ?? nameOf(id)}.`);
            },
            tidy: () => run("Tidy up", autoLayout(get().history.present), "Tidied up the layout."),
            replace: (workflow, label) =>
                run(label, workflow, `${label}. ${plural(workflow.nodes.length, "step", "steps")}.`, { selected: [], selectedEdge: null }),

            undo: () => {
                const result = undo(get().history);
                if (!result) return;
                set({ ...place(result.history, { analysed: true }), focusRequest: { force: false } });
                announce(`Undid: ${result.label}.`);
            },
            redo: () => {
                const result = redo(get().history);
                if (!result) return;
                set({ ...place(result.history, { analysed: true }), focusRequest: { force: false } });
                announce(`Redid: ${result.label}.`);
            },

            setPublished: (workflow) => set({ published: workflow, dirty: !sameJson(get().history.present, workflow) }),
            setView: (view) => set({ view }),
            setOverlay: (overlay) => set({ overlay: reuseOverlay(get().overlay, overlay) }),
            setCanvasSize: (size) => {
                const { canvasSize } = get();
                if (size.width !== canvasSize.width || size.height !== canvasSize.height) set({ canvasSize: size });
            },
            panBy: (dx, dy) => set({ viewport: { ...get().viewport, x: get().viewport.x + dx, y: get().viewport.y + dy } }),
            zoomBy: (factor, anchor) => {
                const { viewport, canvasSize } = get();
                const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor));
                const at = anchor ?? { x: canvasSize.width / 2, y: canvasSize.height / 2 };
                const ratio = zoom / viewport.zoom;
                set({ viewport: { zoom, x: at.x - (at.x - viewport.x) * ratio, y: at.y - (at.y - viewport.y) * ratio } });
            },
            fit: (minZoom = MIN_ZOOM) => {
                const { history, canvasSize } = get();
                const nodes = history.present.nodes;
                if (nodes.length === 0 || canvasSize.width === 0) return set({ viewport: { x: FIT_PADDING, y: FIT_PADDING, zoom: 1 } });
                set({ fitted: true });
                const left = Math.min(...nodes.map((node) => node.position.x));
                const top = Math.min(...nodes.map((node) => node.position.y));
                const width = Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH)) - left;
                const height = Math.max(...nodes.map((node) => node.position.y + NODE_HEIGHT)) - top;
                const zoom = Math.min(
                    1,
                    Math.max(minZoom, Math.min((canvasSize.width - FIT_PADDING * 2) / width, (canvasSize.height - FIT_PADDING * 2) / height)),
                );
                set({
                    viewport: {
                        zoom,
                        x: (canvasSize.width - width * zoom) / 2 - left * zoom,
                        y: (canvasSize.height - height * zoom) / 2 - top * zoom,
                    },
                });
            },

            startConnecting: (nodeId, portId, x, y) => set({ connecting: { nodeId, portId, x, y } }),
            moveConnecting: (x, y) => {
                const { connecting } = get();
                if (connecting) set({ connecting: { ...connecting, x, y } });
            },
            stopConnecting: () => set({ connecting: null }),

            openMenu: (nodeId) => set({ menu: { nodeId, view: "root" } }),
            setMenuView: (view) => {
                const { menu } = get();
                if (menu) set({ menu: { ...menu, view } });
            },
            closeMenu: () => set({ menu: null }),
            requestInspector: (nodeId) => {
                const { selected } = get();
                const alone = selected.length === 1 && selected[0] === nodeId;
                set({ ...(alone ? {} : { selected: [nodeId], selectedEdge: null, focusId: nodeId }), inspectorPending: true });
            },
            consumeInspectorRequest: () => set({ inspectorPending: false }),
            requestFocus: (force = false) => set({ focusRequest: { force } }),
        };
    });

    return store;
};
