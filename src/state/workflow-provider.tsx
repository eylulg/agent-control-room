import { type ReactNode, useContext, useEffect, useState } from "react";
import { loadDraft, sessionStorageOrNull } from "./persist";
import { StoreContext } from "./store-context";
import { EditorContext } from "./workflow-context";
import { createEditorStore } from "./workflow-store";

/**
 * Keeps one editor per app, above the router, so a half edited draft is still there after a visit to another page.
 * The editor announces through the same live region as the rest of the app.
 */
export const WorkflowEditorProvider = ({ children }: { children: ReactNode }) => {
    const app = useContext(StoreContext);
    if (!app) throw new Error("WorkflowEditorProvider must be used inside AppStoreProvider");

    const [editor] = useState(() => {
        const storage = sessionStorageOrNull();
        const published = app.getState().control.workflows.at(-1)?.workflow;
        if (!published) throw new Error("The control state has no published workflow");
        return createEditorStore({
            published,
            draft: (storage && loadDraft(storage)) ?? published,
            storage: storage ?? undefined,
            // The same text twice in a row is not announced again, so alternate a trailing space.
            announce: (text) => app.setState((state) => ({ announcement: state.announcement === text ? `${text}\u00a0` : text })),
        });
    });

    useEffect(
        () =>
            app.subscribe((state, previous) => {
                const latest = state.control.workflows.at(-1)?.workflow;
                if (latest && latest !== previous.control.workflows.at(-1)?.workflow) editor.getState().setPublished(latest);
            }),
        [app, editor],
    );

    return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
};
