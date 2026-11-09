import { Moon01, Sun } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useTheme } from "@/providers/theme";

export const ThemeToggle = () => {
    const [theme, toggle] = useTheme();
    const dark = theme === "dark";
    return (
        <Button
            size="sm"
            color="tertiary"
            iconLeading={dark ? Sun : Moon01}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onPress={toggle}
        />
    );
};
