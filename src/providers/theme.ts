import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const THEME_KEY = "acr-theme";
const DARK_CLASS = "dark-mode";

const readTheme = (): Theme => (document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light");

const listeners = new Set<() => void>();

const setTheme = (theme: Theme): void => {
    document.documentElement.classList.toggle(DARK_CLASS, theme === "dark");
    document.documentElement.style.colorScheme = theme;
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch {
        // Storage can be unavailable in private windows. The class still applies.
    }
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useTheme = (): [Theme, () => void] => {
    const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
    const toggle = () => setTheme(readTheme() === "dark" ? "light" : "dark");
    return [theme, toggle];
};
