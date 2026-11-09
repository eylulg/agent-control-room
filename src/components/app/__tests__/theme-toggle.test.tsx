import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "../theme-toggle";

describe("ThemeToggle", () => {
    it("switches to dark mode and remembers it", async () => {
        const user = userEvent.setup();
        render(<ThemeToggle />);

        await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

        expect(document.documentElement).toHaveClass("dark-mode");
        expect(localStorage.getItem("acr-theme")).toBe("dark");
        expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
    });
});
