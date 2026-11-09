import type { ApprovalOption, ApprovalOptionKey, JobKind } from "./types";

export interface TicketTemplate {
    kind: JobKind;
    title: string;
    repo: string;
}

export const TICKET_TEMPLATES: TicketTemplate[] = [
    { kind: "bug", title: "Date picker loses focus after month change", repo: "acme/design-system" },
    { kind: "feature", title: "Bulk archive from the inbox list", repo: "acme/web" },
    { kind: "chore", title: "Upgrade test runner and drop legacy config", repo: "acme/api" },
    { kind: "review-fix", title: "Address review notes on the export endpoint", repo: "acme/api" },
    { kind: "bug", title: "Offline banner never clears on reconnect", repo: "acme/mobile" },
    { kind: "release", title: "Cut release 2.14 and update the changelog", repo: "acme/web" },
    { kind: "feature", title: "Keyboard shortcuts help dialog", repo: "acme/web" },
    { kind: "chore", title: "Remove unused feature flags", repo: "acme/mobile" },
    { kind: "bug", title: "Pagination resets when sorting a column", repo: "acme/web" },
    { kind: "feature", title: "Token based spacing scale for cards", repo: "acme/design-system" },
    { kind: "review-fix", title: "Follow up on accessibility review of tabs", repo: "acme/design-system" },
    { kind: "bug", title: "Rate limiter counts retries twice", repo: "acme/api" },
    { kind: "chore", title: "Split the settings bundle into lazy routes", repo: "acme/web" },
    { kind: "feature", title: "Push notification preferences screen", repo: "acme/mobile" },
    { kind: "release", title: "Publish design tokens 4.2.0", repo: "acme/design-system" },
    { kind: "bug", title: "CSV export drops the last row", repo: "acme/api" },
];

export interface ApprovalTemplate {
    question: string;
    options: Record<ApprovalOptionKey, ApprovalOption>;
    recommended: ApprovalOptionKey;
    reason: string;
}

export const APPROVAL_TEMPLATES: Record<JobKind, ApprovalTemplate> = {
    feature: {
        question: "The ticket does not say where the new control lives. Which placement should I build?",
        options: {
            A: { label: "Toolbar action", description: "Add it to the existing toolbar next to the filters. Small diff, reuses current layout." },
            B: { label: "New side panel", description: "Introduce a dedicated panel with room for future settings. Larger diff, needs design input." },
        },
        recommended: "A",
        reason: "Smaller change that matches the current pattern and ships without new design work.",
    },
    bug: {
        question: "I can fix the symptom in the component or the root cause in the shared hook. Which scope?",
        options: {
            A: { label: "Patch the component", description: "Local fix, one file, no risk to other screens." },
            B: { label: "Fix the shared hook", description: "Fixes four other call sites with the same bug, touches more tests." },
        },
        recommended: "B",
        reason: "The same bug exists in four places and the hook already has good test coverage.",
    },
    chore: {
        question: "The upgrade has a breaking config change. Migrate in this PR or split it?",
        options: {
            A: { label: "One PR", description: "Upgrade and migrate together so main never sees a half state." },
            B: { label: "Two PRs", description: "Land the config migration first, then the upgrade. Easier to review." },
        },
        recommended: "B",
        reason: "Two small PRs are faster to review and each one can be reverted on its own.",
    },
    "review-fix": {
        question: "A reviewer asked for a rename that touches the public API. How should I handle it?",
        options: {
            A: { label: "Rename now", description: "Apply the rename and update every caller in this PR." },
            B: { label: "Deprecate first", description: "Keep the old name as a deprecated alias and rename callers later." },
        },
        recommended: "B",
        reason: "Other packages import the old name, so a deprecation window avoids breaking them.",
    },
    release: {
        question: "Two merged PRs are missing changelog entries. What should I do?",
        options: {
            A: { label: "Write them", description: "Draft entries from the PR descriptions and include them in the release." },
            B: { label: "Hold the release", description: "Ask the PR authors for entries before cutting the tag." },
        },
        recommended: "A",
        reason: "Both PR descriptions are detailed enough to draft accurate entries.",
    },
};

export const PLAN_STEPS: Record<JobKind, string[]> = {
    feature: [
        "Read the ticket and linked designs",
        "Add the component and wire it to the store",
        "Cover the new flow with tests",
        "Open a draft PR and run CI",
    ],
    bug: ["Reproduce with a failing test", "Fix the root cause", "Confirm the test passes and nothing else regresses", "Open a PR with the reproduction steps"],
    chore: ["Check what the change touches", "Apply the change in small commits", "Run the full test suite", "Open a PR with a short migration note"],
    "review-fix": ["Read every open review thread", "Apply or answer each finding", "Push fixes and reply in the threads", "Request a fresh review"],
    release: ["Collect merged PRs since the last tag", "Write the changelog", "Bump versions", "Open the release PR"],
};

export const CI_CHECKS = ["typecheck", "unit tests", "lint", "e2e smoke"] as const;

export const CI_FAILURES = [
    "2 failing tests in filters.test.ts: expected 3 items, received 2",
    "Type error: property 'archivedAt' does not exist on type 'Message'",
    "Lint: react-hooks/exhaustive-deps in use-toolbar.ts",
    "Snapshot mismatch in date-picker.stories",
];

export const REVIEW_FINDINGS = [
    {
        file: "src/features/list/use-selection.ts",
        body: "This effect re-subscribes on every render. Can the handler be stable?",
        reply: "Good catch. Moved the handler into a ref so the subscription is stable. Fixed in the latest commit.",
    },
    {
        file: "src/api/export.ts",
        body: "Please add a test for the empty result case.",
        reply: "Added a test that covers the empty case and asserts the header row is still written.",
    },
    {
        file: "src/components/panel.tsx",
        body: "The close button has no accessible name.",
        reply: "Added an aria-label and a test that queries the button by its name.",
    },
    {
        file: "src/lib/format.ts",
        body: "This duplicates formatDate from the shared utils.",
        reply: "Replaced it with the shared helper and removed the local copy.",
    },
];

export const COMMIT_MESSAGES = {
    feature: ["feat: add the new control behind a flag", "feat: wire state and persistence", "test: cover the main flow"],
    bug: ["test: reproduce the bug", "fix: handle the edge case at the source"],
    chore: ["chore: apply the upgrade", "chore: migrate config"],
    "review-fix": ["refactor: apply review suggestions", "test: cover review cases"],
    release: ["chore(release): update changelog", "chore(release): bump versions"],
} satisfies Record<JobKind, string[]>;
