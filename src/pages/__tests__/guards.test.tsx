import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test-utils/render-app";

describe("GuardsPage", () => {
    it("lists blocked attempts", async () => {
        await renderApp("/guards");

        expect(screen.getByRole("region", { name: "Blocked attempts table" })).toHaveTextContent("--no-verify");
    });

    it("switches a guard off", async () => {
        const user = userEvent.setup();
        await renderApp("/guards");
        const toggle = screen.getByRole("switch", { name: /Never merge/ });

        await user.click(toggle);

        expect(toggle).not.toBeChecked();
    });
});
