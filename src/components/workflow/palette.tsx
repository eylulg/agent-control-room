import { type DragEvent } from "react";
import { Button } from "@eylulg/ui/button";
import { NODE_META, NODE_TYPES, type NodeType } from "@/domain/workflow/types";
import { useEditorStore } from "@/state/workflow-context";
import { PALETTE_MIME } from "./canvas";
import { NODE_ICON } from "./node-meta";

/** The step types. Pressing one adds it at the centre of the canvas, which is also the keyboard path. Dragging one drops it where you let go. */
export const Palette = () => {
    const store = useEditorStore();

    function handleDragStart(type: NodeType) {
        return (event: DragEvent<HTMLLIElement>) => {
            event.dataTransfer.setData(PALETTE_MIME, type);
            event.dataTransfer.effectAllowed = "copy";
        };
    }

    function handleAdd(type: NodeType) {
        return () => {
            store.getState().addNode(type);
        };
    }

    return (
        <ul aria-label="Step types" className="flex flex-col gap-1">
            {NODE_TYPES.map((type) => {
                const Icon = NODE_ICON[type];
                return (
                    <li key={type} draggable onDragStart={handleDragStart(type)}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full justify-start"
                            iconLeading={Icon}
                            onPress={handleAdd(type)}
                            aria-label={`Add ${NODE_META[type].label}`}
                        >
                            {NODE_META[type].label}
                        </Button>
                    </li>
                );
            })}
        </ul>
    );
};
