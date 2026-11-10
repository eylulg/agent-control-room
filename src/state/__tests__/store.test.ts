import { describe, expect, it } from "vitest";
import { pendingApprovals } from "@/domain/selectors";
import { loadWorld } from "../persist";
import { createAppStore } from "../store";

describe("createAppStore", () => {
    it("rebuilds the same world from what it saved", async () => {
        const first = createAppStore({ seed: "reload", warmup: 4, storage: sessionStorage });
        const approval = pendingApprovals(first.getState().control)[0];
        if (!approval) throw new Error("expected a pending approval");
        first.getState().step();
        await first.getState().send({ type: "approval.answer", approvalId: approval.id, option: "B", note: "Keep it small" });
        first.getState().step();
        await first.getState().send({ type: "guard.toggle", guardId: "keep-hooks", enabled: false });
        for (let i = 0; i < 12; i++) first.getState().step();
        window.dispatchEvent(new Event("pagehide"));
        const saved = loadWorld(sessionStorage);
        if (!saved) throw new Error("expected a saved world");

        const second = createAppStore({ warmup: 4, restore: saved });

        expect(second.getState().control).toEqual(first.getState().control);
    });
});
