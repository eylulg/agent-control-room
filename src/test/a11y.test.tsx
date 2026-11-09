import { act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { renderApp } from "./render-app";

const PAGES = [
    ["Overview", "/"],
    ["Queue", "/queue"],
    ["Job detail", "/jobs/job-1"],
    ["Approvals", "/approvals"],
    ["Routing", "/routing"],
    ["Guards", "/guards"],
    ["Settings", "/settings"],
    ["Not found", "/nowhere"],
] as const;

describe.each(["light", "dark"] as const)("axe in %s mode", (mode) => {
    afterEach(() => document.documentElement.classList.remove("dark-mode"));

    it.each(PAGES)("%s page has no violations", async (_name, path) => {
        if (mode === "dark") document.documentElement.classList.add("dark-mode");
        const { container, store } = renderApp(path);
        // Trigger a toast so the notification region is checked as well.
        act(() => {
            for (let i = 0; i < 60 && store.getState().toasts.length === 0; i++) store.getState().step();
        });
        expect(await axe(container)).toHaveNoViolations();
    });
});
