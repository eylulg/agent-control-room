import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test-utils/render-app";

describe("JobDetailPage", () => {
    it("holds a job with the reason shown on the page", async () => {
        const user = userEvent.setup();
        await renderApp("/jobs/job-3", { warmup: 2 });

        await user.type(screen.getByRole("textbox", { name: "Hold reason" }), "Waiting on a designer");
        await user.click(screen.getByRole("button", { name: "Hold job" }));

        expect(screen.getByText("On hold.").parentElement).toHaveTextContent("Waiting on a designer");
    });

    it.each([
        [["Hold job"], "Resume job", "button"],
        [["Hold job", "Resume job"], "Hold reason", "textbox"],
        [["Cancel job"], "Retry job", "button"],
        [["Cancel job", "Retry job"], "Hold reason", "textbox"],
    ] as const)("after %j moves focus to %s", async (actions, target, role) => {
        const user = userEvent.setup();
        await renderApp("/jobs/job-3", { warmup: 2 });

        for (const name of actions) await user.click(screen.getByRole("button", { name }));

        expect(screen.getByRole(role, { name: target })).toHaveFocus();
    });
});
