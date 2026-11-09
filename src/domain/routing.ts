import { JOB_KINDS, type JobKind, type RoutingTable } from "./types";

export const KNOWN_MODELS = ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"] as const;

export const DEFAULT_ROUTING: RoutingTable = {
    feature: "claude-opus-4-5",
    bug: "claude-sonnet-4-5",
    chore: "claude-haiku-4-5",
    "review-fix": "claude-sonnet-4-5",
    release: "claude-haiku-4-5",
};

const MODEL_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;

export type RoutingErrors = Partial<Record<JobKind, string>>;

/** Returns a message per invalid row. An empty object means the table is valid. */
export const validateRouting = (routing: Record<string, string>): RoutingErrors => {
    const errors: RoutingErrors = {};
    for (const kind of JOB_KINDS) {
        const value = (routing[kind] ?? "").trim();
        if (!value) errors[kind] = "Enter a model name.";
        else if (value.length > 40) errors[kind] = "Use 40 characters or fewer.";
        else if (!MODEL_PATTERN.test(value)) errors[kind] = "Use lowercase letters, digits, dots and hyphens only.";
    }
    return errors;
};

export const modelFor = (routing: RoutingTable, kind: JobKind): string => routing[kind];
