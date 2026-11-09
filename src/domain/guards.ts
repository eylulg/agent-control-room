import type { Guard, GuardAction } from "./types";

export const DEFAULT_GUARDS: Guard[] = [
    {
        id: "never-merge",
        action: "merge",
        rule: "Never merge",
        description: "The agent opens and updates pull requests. Merging is always a human decision.",
        enabled: true,
        blocked: [],
    },
    {
        id: "dependency-first",
        action: "mark-ready",
        rule: "Never mark ready while a dependency PR is unmerged",
        description: "Stacked work stays in draft until the PR it builds on has merged.",
        enabled: true,
        blocked: [],
    },
    {
        id: "keep-hooks",
        action: "skip-hooks",
        rule: "Never skip git hooks",
        description: "Commits and pushes must run the repository hooks. No --no-verify.",
        enabled: true,
        blocked: [],
    },
    {
        id: "owner-voice",
        action: "post-as-owner",
        rule: "Never post as the owner without approval",
        description: "Replies that would appear under the owner's name wait for an explicit yes.",
        enabled: true,
        blocked: [],
    },
];

/** Finds the guard responsible for an action. Returns it only when it is enabled. */
export const findBlockingGuard = (guards: readonly Guard[], action: GuardAction): Guard | undefined =>
    guards.find((guard) => guard.action === action && guard.enabled);

export const guardFor = (guards: readonly Guard[], action: GuardAction): Guard | undefined => guards.find((guard) => guard.action === action);
