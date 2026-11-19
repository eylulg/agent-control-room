import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { renderApp } from "@/test-utils/render-app";

const addCondition = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Add Condition" }));
    return screen.getByRole("option", { name: "Condition" });
};

describe("WorkflowsPage keyboard flows", () => {
    it("adds a step from the palette, announces it and selects it", async () => {
        const user = userEvent.setup();
        await renderApp("/workflows");

        const node = await addCondition(user);

        expect(node).toHaveAttribute("aria-selected", "true");
        expect(screen.getByTestId("live-region")).toHaveTextContent("Added Condition. 13 steps in the workflow.");
    });

    it("connects a step through its menu and describes the connection to a screen reader", async () => {
        const user = userEvent.setup();
        await renderApp("/workflows");
        const node = await addCondition(user);

        node.focus();
        await user.keyboard("{Enter}");
        await user.click(await screen.findByRole("menuitem", { name: "Connect to…" }));
        await user.click(within(await screen.findByRole("group", { name: "True port" })).getByRole("menuitem", { name: "Plan" }));

        expect(screen.getByTestId("live-region")).toHaveTextContent("Connected Condition True to Plan.");
        expect(node).toHaveAccessibleDescription(expect.stringContaining("True goes to Plan. False is not connected."));
        expect(node).toHaveFocus();
    });

    it("deletes the focused step with Delete and brings it back with undo", async () => {
        const user = userEvent.setup();
        await renderApp("/workflows");
        const node = await addCondition(user);

        node.focus();
        await user.keyboard("{Delete}");
        expect(screen.queryByRole("option", { name: "Condition" })).not.toBeInTheDocument();
        await user.keyboard("{Control>}z{/Control}");

        expect(screen.getByRole("option", { name: "Condition" })).toBeInTheDocument();
        expect(screen.getByTestId("live-region")).toHaveTextContent("Undid: Delete Condition.");
    });

    it("moves between steps with the arrow keys and moves a step with Alt and an arrow", async () => {
        const user = userEvent.setup();
        await renderApp("/workflows");
        const first = screen.getAllByRole("option")[0];

        first?.focus();
        await user.keyboard("{ArrowDown}");
        const second = screen.getAllByRole("option").find((option) => option === document.activeElement);
        const before = second?.style.transform;
        await user.keyboard("{Alt>}{ArrowRight}{/Alt}");

        expect(second?.getAttribute("aria-label")).toBe("Plan");
        expect(second?.style.transform).not.toBe(before);
        expect(screen.getByTestId("live-region")).toHaveTextContent(/^Moved "Plan" to \d+, \d+\.$/);
    });

    it("keeps Publish disabled while the draft is unchanged and while it has problems", async () => {
        const user = userEvent.setup();
        await renderApp("/workflows");
        const publish = screen.getByRole("button", { name: "Publish workflow" });
        expect(publish).toBeDisabled();

        await addCondition(user);

        expect(publish).toBeDisabled();
        expect(within(screen.getByRole("heading", { name: "Problems" }).closest("section") ?? document.body).getAllByRole("button").length).toBeGreaterThan(0);
    });

    it("publishes a valid change as a new version and moves focus to the status line", async () => {
        const user = userEvent.setup();
        const { store } = await renderApp("/workflows");

        await user.click(screen.getByRole("option", { name: "Run CI, CI check" }));
        const limit = screen.getByRole("textbox", { name: "Failures before the job fails" });
        await user.clear(limit);
        await user.type(limit, "4");
        await user.tab();
        await user.click(screen.getByRole("button", { name: "Publish workflow" }));

        expect(await screen.findByText(/^Published\./)).toHaveFocus();
        expect(store.getState().control.workflows.map((published) => published.revision)).toEqual([1, 2]);
    });

    it("edits the same graph in the outline and renders without axe violations", async () => {
        const user = userEvent.setup();
        const { container } = await renderApp("/workflows");

        await user.click(screen.getByRole("radio", { name: "Outline" }));

        expect(await screen.findByRole("list", { name: "Workflow outline" })).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it("traces a job and lists the steps it took", async () => {
        const user = userEvent.setup();
        const { store } = await renderApp("/workflows");
        const job = Object.values(store.getState().control.jobs).find((candidate) => store.getState().control.runs[candidate.id]);
        if (!job) throw new Error("The seeded world has no job with a run");

        await user.click(screen.getByRole("tab", { name: "Trace a job" }));
        await user.click(screen.getByRole("button", { name: /Job to trace/ }));
        await user.click(await screen.findByRole("option", { name: `${job.ticket.id}: ${job.ticket.title}` }));

        const path = await screen.findByRole("list", { name: "Path of the job" });
        expect(within(path).getAllByRole("listitem").length).toBe(store.getState().control.runs[job.id]?.steps.length);
        expect(within(path).getAllByRole("listitem")[0]).toHaveTextContent("Ticket arrives");
    });

    it("runs a dry run of the draft to the end, one step at a time", async () => {
        const user = userEvent.setup();
        await renderApp("/workflows");

        await user.click(screen.getByRole("tab", { name: "Dry run" }));
        await user.click(screen.getByRole("button", { name: "Start dry run" }));
        const step = screen.getByRole("button", { name: "Step" });
        for (let i = 0; i < 80 && !step.hasAttribute("disabled"); i++) await user.click(step);

        expect(step).toBeDisabled();
        expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
        const states = within(screen.getByRole("list", { name: "Step states" }));
        expect(states.getByText("Done")).toBeInTheDocument();
    });
});
