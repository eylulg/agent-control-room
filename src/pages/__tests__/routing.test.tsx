import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test-utils/render-app";

describe("RoutingPage", () => {
    it("disables Save while a model name is blank", async () => {
        const user = userEvent.setup();
        await renderApp("/routing");

        await user.clear(screen.getByRole("textbox", { name: "Model for Bug jobs" }));

        expect(screen.getByText("Enter a model name.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save routing" })).toBeDisabled();
    });

    it("saves a new model for a job kind", async () => {
        const user = userEvent.setup();
        const { store } = await renderApp("/routing");
        const bug = screen.getByRole("textbox", { name: "Model for Bug jobs" });

        await user.clear(bug);
        await user.type(bug, "claude-fable-5-1");
        await user.click(screen.getByRole("button", { name: "Save routing" }));

        expect(store.getState().control.routing.bug).toBe("claude-fable-5-1");
        expect(screen.getByText("Routing saved. New jobs and retries use it from now on.")).toBeInTheDocument();
    });
});
