import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist", "coverage", "node_modules"] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ["**/*.{ts,tsx}"],
        languageOptions: { ecmaVersion: 2022, globals: globals.browser },
        plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh, "jsx-a11y": jsxA11y },
        rules: {
            ...reactHooks.configs.recommended.rules,
            ...jsxA11y.flatConfigs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            // Scrollable regions and the sparkline group must be focusable for keyboard users.
            "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["region", "group"], tags: [] }],
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        },
    },
    {
        // Vendored Untitled UI components are kept as published.
        files: ["src/components/base/**", "src/components/foundations/**", "src/providers/**"],
        rules: {
            "react-refresh/only-export-components": "off",
            "jsx-a11y/no-autofocus": "off",
            "jsx-a11y/click-events-have-key-events": "off",
            "jsx-a11y/no-static-element-interactions": "off",
            "jsx-a11y/img-redundant-alt": "off",
            "@typescript-eslint/no-empty-object-type": "off",
        },
    },
    {
        files: ["scripts/**/*.mjs", "*.config.{js,ts}"],
        languageOptions: { globals: globals.node },
    },
);
