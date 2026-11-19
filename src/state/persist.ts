import { z } from "zod/mini";
import { operatorCommand } from "@/domain/schema";
import type { OperatorCommand } from "@/domain/types";
import { workflowSchema } from "@/domain/workflow/schema";
import type { Workflow } from "@/domain/workflow/types";

export interface LoggedCommand {
    tick: number;
    command: OperatorCommand;
}

export interface PersistedWorld {
    seed: string;
    speed: number;
    tick: number;
    commands: LoggedCommand[];
}

const STORAGE_KEY = "agent-control-room:world";
const DRAFT_KEY = "agent-control-room:workflow-draft";

const persistedWorld = z.object({
    seed: z.string(),
    speed: z.number(),
    tick: z.int(),
    commands: z.array(z.object({ tick: z.int(), command: operatorCommand })),
});

/** The simulator is deterministic, so a seed and the commands with their ticks are enough to rebuild a world. */
export const loadWorld = (storage: Storage): PersistedWorld | null => {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const result = persistedWorld.safeParse(JSON.parse(raw));
        return result.success ? result.data : null;
    } catch {
        return null;
    }
};

export const saveWorld = (storage: Storage, world: PersistedWorld): void => {
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(world));
    } catch {
        // Storage can be full or blocked. The world then simply starts over on reload.
    }
};

/** Reading `sessionStorage` itself throws when site data is blocked. */
export const sessionStorageOrNull = (): Storage | null => {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
};

/** The workflow draft survives a reload. A draft that no longer matches the schema is dropped. */
export const loadDraft = (storage: Storage): Workflow | null => {
    try {
        const raw = storage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const result = workflowSchema.safeParse(JSON.parse(raw));
        return result.success ? result.data : null;
    } catch {
        return null;
    }
};

export const saveDraft = (storage: Storage, draft: Workflow): void => {
    try {
        storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
        // Storage can be full or blocked. The draft then lives until the tab closes.
    }
};
