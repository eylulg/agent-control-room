import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { renderApp } from "@/test-utils/render-app";

describe("App", () => {
    // jsdom computes no colours, so a dark mode run would repeat this one. Contrast in both themes is checked in a real browser.
    it.each(["/", "/queue", "/jobs/job-1", "/approvals", "/routing", "/guards", "/settings", "/nowhere"])("renders %s without axe violations", async (path) => {
        const { container } = await renderApp(path);

        expect(await axe(container)).toHaveNoViolations();
    });

    it("raises a toast and announces it when the agent asks for approval", async () => {
        const { store } = await renderApp("/", { warmup: 0 });

        act(() => {
            for (let i = 0; i < 10 && store.getState().toasts.length === 0; i++) store.getState().step();
        });

        expect(within(screen.getByRole("region", { name: "Notifications" })).getByText("Approval needed on ACME-101")).toBeInTheDocument();
        expect(screen.getByTestId("live-region")).toHaveTextContent("Approval requested on ACME-101");
    });

    it("moves focus to the content after navigating", async () => {
        const user = userEvent.setup();
        await renderApp("/");

        await user.click(screen.getAllByRole("link", { name: "Guards" })[0] ?? document.body);
        await screen.findByRole("heading", { level: 1, name: "Guards" });

        expect(screen.getByRole("main")).toHaveFocus();
    });

    it("moves focus to the content when a toast is dismissed", async () => {
        const user = userEvent.setup();
        const { store } = await renderApp("/", { warmup: 0 });
        act(() => {
            for (let i = 0; i < 10 && store.getState().toasts.length === 0; i++) store.getState().step();
        });

        await user.click(screen.getByRole("button", { name: /^Dismiss: Approval needed on ACME-101/ }));

        expect(screen.queryByText("Approval needed on ACME-101")).not.toBeInTheDocument();
        expect(screen.getByRole("main")).toHaveFocus();
    });
});
