import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test-utils/render-app";

describe("RoutingPage", () => {
    it("keeps Save disabled until a model changes", async () => {
        await renderApp("/routing");

        expect(screen.getByRole("button", { name: "Save routing" })).toBeDisabled();
    });

    it("saves a new model for a job kind", async () => {
        const user = userEvent.setup();
        const { store } = await renderApp("/routing");

        await user.click(screen.getByRole("button", { name: /Model for Bug jobs/ }));
        await user.click(await screen.findByRole("option", { name: "claude-fable-5-1" }));
        await user.click(screen.getByRole("button", { name: "Save routing" }));

        expect(store.getState().control.routing.bug).toBe("claude-fable-5-1");
        expect(screen.getByText("Routing saved. New jobs and retries use it from now on.")).toHaveFocus();
    });
});
