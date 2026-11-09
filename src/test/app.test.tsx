import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { pendingApprovals } from "@/domain/selectors";
import { renderApp } from "./render-app";

describe("Queue", () => {
    it("filters by search, kind and repository", async () => {
        const user = userEvent.setup();
        const { store } = renderApp("/queue");
        const total = store.getState().control.jobOrder.length;
        expect(screen.getByText(`Showing ${total} of ${total} jobs`)).toBeInTheDocument();

        await user.type(screen.getByRole("textbox", { name: "Search" }), "ACME-103");
        expect(screen.getByText(`Showing 1 of ${total} jobs`)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /ACME-103/ })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /ACME-101/ })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Clear filters" }));
        await user.click(screen.getByRole("button", { name: "Bug", pressed: false }));
        const bugs = Object.values(store.getState().control.jobs).filter((job) => job.kind === "bug");
        expect(screen.getByText(`Showing ${bugs.length} of ${total} jobs`)).toBeInTheDocument();

        await user.selectOptions(screen.getByRole("combobox", { name: "Repository" }), "acme/mobile");
        const expected = bugs.filter((job) => job.ticket.repo === "acme/mobile").length;
        expect(screen.getByText(`Showing ${expected} of ${total} jobs`)).toBeInTheDocument();
    });
});

describe("Approvals inbox", () => {
    it("answers the first request with the keyboard and unblocks the job", async () => {
        const user = userEvent.setup();
        const { store } = renderApp("/approvals", { warmup: 4 });
        const [approval] = pendingApprovals(store.getState().control);
        expect(approval).toBeDefined();
        const card = screen.getByRole("article", { name: approval.question });
        expect(within(card).getByText("Recommended")).toBeInTheDocument();

        await user.keyboard("2");

        const state = store.getState().control;
        expect(state.approvals[approval.id]).toMatchObject({ status: "answered", answer: { option: "B" } });
        expect(state.jobs[approval.jobId].status).toBe("implementing");
        expect(screen.getByText(/with option B/)).toBeInTheDocument();
    });

    it("sends the note with the answer and ignores digits typed into the note", async () => {
        const user = userEvent.setup();
        const { store } = renderApp("/approvals", { warmup: 4 });
        const [approval] = pendingApprovals(store.getState().control);
        await user.type(screen.getByRole("textbox", { name: /Note for the agent/ }), "Ship 1 PR");
        expect(store.getState().control.approvals[approval.id].status).toBe("pending");
        await user.click(screen.getByRole("button", { name: /Option A/ }));
        expect(store.getState().control.approvals[approval.id].answer).toMatchObject({ option: "A", note: "Ship 1 PR" });
    });
});

describe("Live feel", () => {
    it("shows a toast and announces when the agent asks for approval", async () => {
        const { store } = renderApp("/", { warmup: 0 });
        act(() => {
            for (let i = 0; i < 10 && store.getState().toasts.length === 0; i++) store.getState().step();
        });
        const notifications = screen.getByRole("region", { name: "Notifications" });
        expect(within(notifications).getByText(/Approval needed on ACME-101/)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId("live-region")).toHaveTextContent(/Approval requested on ACME-101/));
    });
});

describe("Job detail", () => {
    it("holds and resumes a job", async () => {
        const user = userEvent.setup();
        const { store } = renderApp("/jobs/job-3", { warmup: 2 });
        await user.type(screen.getByRole("textbox", { name: "Hold reason" }), "Waiting on a designer");
        await user.click(screen.getByRole("button", { name: "Hold" }));
        expect(store.getState().control.jobs["job-3"]).toMatchObject({ status: "on-hold", holdReason: "Waiting on a designer" });
        expect(screen.getByText("Waiting on a designer", { selector: "p" })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Resume" }));
        expect(store.getState().control.jobs["job-3"].status).not.toBe("on-hold");
    });

    it("pauses timeline auto-follow", async () => {
        const user = userEvent.setup();
        renderApp("/jobs/job-1");
        const button = screen.getByRole("button", { name: "Pause auto-follow" });
        await user.click(button);
        expect(screen.getByRole("button", { name: "Resume auto-follow" })).toHaveAttribute("aria-pressed", "true");
    });
});

describe("Routing editor", () => {
    it("validates rows and applies a saved change to the next job", async () => {
        const user = userEvent.setup();
        const { store } = renderApp("/routing", { warmup: 0 });
        const bug = screen.getByRole("textbox", { name: "Model for Bug jobs" });
        await user.clear(bug);
        await user.click(screen.getByRole("button", { name: "Save routing" }));
        expect(screen.getByText("Enter a model name.")).toBeInTheDocument();

        await user.type(bug, "bug-specialist-1");
        await user.click(screen.getByRole("button", { name: "Save routing" }));
        expect(store.getState().control.routing.bug).toBe("bug-specialist-1");

        let created: string | undefined;
        act(() => {
            for (let i = 0; i < 400 && !created; i++) {
                const before = store.getState().control.jobOrder.length;
                store.getState().step();
                const order = store.getState().control.jobOrder;
                const job = order.length > before ? store.getState().control.jobs[order[order.length - 1]] : undefined;
                if (job?.kind === "bug") created = job.id;
            }
        });
        expect(created).toBeDefined();
        expect(store.getState().control.jobs[created!].model).toBe("bug-specialist-1");
        expect(store.getState().control.jobs["job-3"].model).toBe("claude-sonnet-4-5");
    });
});

describe("Guards page", () => {
    it("shows blocked attempts and toggles a guard off", async () => {
        const user = userEvent.setup();
        const { store } = renderApp("/guards");
        expect(screen.getByRole("region", { name: "Blocked attempts table" })).toHaveTextContent(/--no-verify/);
        await user.click(screen.getByRole("switch", { name: /Never merge/ }));
        expect(store.getState().control.guards.find((g) => g.id === "never-merge")?.enabled).toBe(false);
    });
});

describe("Theme", () => {
    it("toggles dark mode with the dark-mode class", async () => {
        const user = userEvent.setup();
        renderApp("/");
        await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
        expect(document.documentElement).toHaveClass("dark-mode");
        expect(localStorage.getItem("acr-theme")).toBe("dark");
        await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
        expect(document.documentElement).not.toHaveClass("dark-mode");
    });
});
