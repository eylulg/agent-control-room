import type { EditorStore } from "@/state/workflow-store";
import { nodeDomId, outlineDomId } from "./geometry";

/** Selects a step and moves focus to it, on the canvas or in the outline, whichever is showing. */
export const focusStep = (store: EditorStore, id: string): void => {
    store.getState().select(id, false);
    (document.getElementById(nodeDomId(id)) ?? document.getElementById(outlineDomId(id)))?.focus();
};
