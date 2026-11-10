import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import type { AppStore } from "@/state/store";
import { renderApp } from "@/test-utils/render-app";

const stepUntilApproval = (store: AppStore) => {
    for (let i = 0; i < 10 && Object.keys(store.getState().control.approvals).length === 0; i++) store.getState().step();
};

describe("App", () => {
    // jsdom computes no colours, so a dark mode run would repeat this one. Contrast in both themes is checked in a real browser.
    it.each(["/", "/queue", "/jobs/job-1", "/approvals", "/routing", "/guards", "/settings", "/nowhere"])("renders %s without axe violations", async (path) => {
        const { container } = await renderApp(path);

        expect(await axe(container)).toHaveNoViolations();
    });

    it("raises a toast and announces it when the agent asks for approval", async () => {
        const { store } = await renderApp("/", { warmup: 0 });

        act(() => stepUntilApproval(store));

        expect(await within(screen.getByRole("region", { name: "Notifications" })).findByText("Approval needed on ACME-101")).toBeInTheDocument();
        expect(screen.getByTestId("live-region")).toHaveTextContent("Approval requested on ACME-101");
    });

    it("moves focus to the content after navigating", async () => {
        const user = userEvent.setup();
        await renderApp("/");

        await user.click(screen.getAllByRole("link", { name: "Guards" })[0] ?? document.body);
        await screen.findByRole("heading", { level: 1, name: "Guards" });

        expect(screen.getByRole("main")).toHaveFocus();
    });

    it("opens the approvals page from the toast", async () => {
        const user = userEvent.setup();
        const { store } = await renderApp("/", { warmup: 0 });
        act(() => stepUntilApproval(store));

        await user.click(await screen.findByRole("button", { name: "Open approvals" }));

        expect(await screen.findByRole("heading", { level: 1, name: "Approvals" })).toBeInTheDocument();
    });
});
