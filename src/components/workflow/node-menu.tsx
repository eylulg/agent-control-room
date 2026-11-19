import { DropdownMenuItem, DropdownMenuSection, DropdownMenuSeparator } from "@eylulg/ui/dropdown-menu";
import { Popover } from "@eylulg/ui/popover";
import { ArrowLeft, Copy, Link2, Settings2, Trash2, Unlink } from "lucide-react";
import { Menu } from "react-aria-components";
import { validTargets } from "@/domain/workflow/ops";
import { PORTS } from "@/domain/workflow/types";
import { useEditor, useEditorStore } from "@/state/workflow-context";

// A menu opened from the keyboard starts on its first item. The rule against autoFocus is about pages that grab focus on load.
const OPEN_ON_FIRST = { autoFocus: "first" } as const;

/**
 * The keyboard and screen reader path for everything a pointer does to a node: connect, disconnect, duplicate, delete.
 * It opens on Enter, the context menu key or Shift+F10 on a node, and returns focus to the node when it closes.
 */
export const NodeMenu = () => {
    const store = useEditorStore();
    const menu = useEditor((s) => s.menu);
    const workflow = useEditor((s) => s.history.present);
    const selected = useEditor((s) => s.selected);
    const node = menu ? workflow.nodes.find((candidate) => candidate.id === menu.nodeId) : undefined;
    if (!menu || !node) return null;

    // Actions apply to the whole selection when the menu was opened on a selected node.
    const targets = selected.includes(node.id) ? selected : [node.id];
    const outgoing = workflow.edges.filter((edge) => edge.from.node === node.id);
    const nameOf = (id: string) => workflow.nodes.find((candidate) => candidate.id === id)?.label ?? id;
    const many = targets.length > 1;

    function handleOpenChange(open: boolean) {
        if (!open) store.getState().closeMenu();
    }

    function act(run: () => void) {
        store.getState().closeMenu();
        run();
    }

    function handleRootAction(key: string | number) {
        const state = store.getState();
        if (key === "connect") return state.setMenuView("connect");
        if (key === "disconnect") return state.setMenuView("disconnect");
        if (key === "settings") return act(() => state.requestInspector());
        if (key === "duplicate") return act(() => state.duplicate(targets));
        if (key === "delete") return act(() => state.deleteIds(targets));
    }

    function handleConnectAction(key: string | number) {
        const state = store.getState();
        if (key === "back") return state.setMenuView("root");
        const [portId, targetId] = String(key).split("|");
        if (portId && targetId) act(() => state.connect(node?.id ?? "", portId, targetId));
    }

    function handleDisconnectAction(key: string | number) {
        const state = store.getState();
        if (key === "back") return state.setMenuView("root");
        act(() => state.disconnectEdge(String(key)));
    }

    return (
        <Popover isOpen onOpenChange={handleOpenChange} triggerRef={{ current: menu.anchor }} placement="bottom start" aria-label={`Actions for ${node.label}`}>
            {menu.view === "root" && (
                <Menu aria-label={`Actions for ${node.label}`} {...OPEN_ON_FIRST} onAction={handleRootAction} className="flex flex-col outline-none">
                    <DropdownMenuItem id="connect" icon={Link2} textValue="Connect to">
                        Connect to…
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        id="disconnect"
                        icon={Unlink}
                        isDisabled={workflow.edges.every((edge) => edge.from.node !== node.id && edge.to !== node.id)}
                        textValue="Disconnect"
                    >
                        Disconnect…
                    </DropdownMenuItem>
                    <DropdownMenuItem id="settings" icon={Settings2} textValue="Edit settings">
                        Edit settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        id="duplicate"
                        icon={Copy}
                        isDisabled={targets.every((id) => workflow.nodes.find((n) => n.id === id)?.type === "trigger")}
                        textValue="Duplicate"
                    >
                        {many ? `Duplicate ${targets.length} steps` : "Duplicate"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem id="delete" icon={Trash2} isDanger textValue="Delete">
                        {many ? `Delete ${targets.length} steps` : "Delete"}
                    </DropdownMenuItem>
                </Menu>
            )}
            {menu.view === "connect" && (
                <Menu aria-label={`Connect ${node.label} to`} {...OPEN_ON_FIRST} onAction={handleConnectAction} className="flex max-h-72 flex-col outline-none">
                    <DropdownMenuItem id="back" icon={ArrowLeft} textValue="Back">
                        Back
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {PORTS[node.type].length === 0 && (
                        <DropdownMenuItem isDisabled textValue="No output ports">
                            This step has no output to connect
                        </DropdownMenuItem>
                    )}
                    {PORTS[node.type].map((port) => (
                        <DropdownMenuSection key={port.id} title={PORTS[node.type].length > 1 ? `${port.label} port` : "Next step"}>
                            {validTargets(workflow, node.id, port.id).map((target) => (
                                <DropdownMenuItem key={target.id} id={`${port.id}|${target.id}`} textValue={`${port.label} to ${target.label}`}>
                                    {target.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSection>
                    ))}
                </Menu>
            )}
            {menu.view === "disconnect" && (
                <Menu aria-label={`Disconnect ${node.label}`} {...OPEN_ON_FIRST} onAction={handleDisconnectAction} className="flex flex-col outline-none">
                    <DropdownMenuItem id="back" icon={ArrowLeft} textValue="Back">
                        Back
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {workflow.edges
                        .filter((edge) => edge.from.node === node.id || edge.to === node.id)
                        .map((edge) => {
                            const port = PORTS[workflow.nodes.find((n) => n.id === edge.from.node)?.type ?? "end"].find((p) => p.id === edge.from.port);
                            const text = `${nameOf(edge.from.node)} ${port?.label ?? edge.from.port} to ${nameOf(edge.to)}`;
                            return (
                                <DropdownMenuItem key={edge.id} id={edge.id} textValue={text}>
                                    {text}
                                </DropdownMenuItem>
                            );
                        })}
                    {outgoing.length === 0 && workflow.edges.every((edge) => edge.to !== node.id) && (
                        <DropdownMenuItem isDisabled textValue="Nothing connected">
                            Nothing is connected
                        </DropdownMenuItem>
                    )}
                </Menu>
            )}
        </Popover>
    );
};
