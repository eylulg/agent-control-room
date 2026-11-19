import { type ReactNode, useContext } from "react";
import { loadDraft, sessionStorageOrNull } from "./persist";
import type { AppStore } from "./store";
import { StoreContext } from "./store-context";
import { EditorContext } from "./workflow-context";
import { type EditorStore, createEditorStore } from "./workflow-store";

const editors = new WeakMap<AppStore, EditorStore>();

/**
 * One editor per app store, made the first time the workflows page renders and kept after it, so a half edited draft is still there after
 * a visit to another page. It lives in the page's own chunk, so a visitor who never opens the editor never downloads it.
 */
const editorFor = (app: AppStore): EditorStore => {
    const existing = editors.get(app);
    if (existing) return existing;
    const storage = sessionStorageOrNull();
    const published = app.getState().control.workflows.at(-1)?.workflow;
    if (!published) throw new Error("The control state has no published workflow");
    const editor = createEditorStore({ published, draft: (storage && loadDraft(storage)) ?? published, storage: storage ?? undefined });
    app.subscribe((state, previous) => {
        const latest = state.control.workflows.at(-1)?.workflow;
        if (latest && latest !== previous.control.workflows.at(-1)?.workflow) editor.getState().setPublished(latest);
    });
    editors.set(app, editor);
    return editor;
};

export const WorkflowEditorProvider = ({ children }: { children: ReactNode }) => {
    const app = useContext(StoreContext);
    if (!app) throw new Error("WorkflowEditorProvider must be used inside AppStoreProvider");
    return <EditorContext.Provider value={editorFor(app)}>{children}</EditorContext.Provider>;
};
