/// <reference types="vitest/config" />
import { themeInitScript } from "@eylulg/ui/theme-script";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
    base: "/agent-control-room/",
    plugins: [
        react(),
        tailwindcss(),
        {
            name: "theme-init",
            transformIndexHtml: () => [{ tag: "script", children: themeInitScript, injectTo: "head-prepend" }],
        },
    ],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
        },
    },
    test: {
        environment: "jsdom",
        globals: false,
        setupFiles: ["./src/test-utils/setup.ts"],
        css: false,
        server: { deps: { inline: [/@eylulg\/ui/] } },
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
