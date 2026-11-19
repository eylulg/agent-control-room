import { z } from "zod/mini";
import { JOB_KINDS } from "../types";
import { CONDITION_FIELDS, CONDITION_OPERATORS, GUARD_NODE_ACTIONS, WORKFLOW_FORMAT_VERSION, type Workflow } from "./types";

const position = z.object({ x: z.number(), y: z.number() });
const emptyConfig = z.object({});

const node = <T extends string, C extends z.ZodMiniType>(type: T, config: C) =>
    z.object({ id: z.string().check(z.minLength(1)), type: z.literal(type), label: z.string(), position, config });

const workflowNode = z.discriminatedUnion("type", [
    node("trigger", z.object({ kinds: z.array(z.enum(JOB_KINDS)) })),
    node("plan", emptyConfig),
    node("approval", emptyConfig),
    node("implement", z.object({ mode: z.enum(["build", "fix"]) })),
    node("ci", z.object({ maxAttempts: z.number() })),
    node("review", z.object({ maxRounds: z.number() })),
    node("condition", z.object({ field: z.enum(CONDITION_FIELDS), operator: z.enum(CONDITION_OPERATORS), value: z.string() })),
    node("wait-dependency", emptyConfig),
    node("guard", z.object({ action: z.enum(GUARD_NODE_ACTIONS) })),
    node("mark-ready", emptyConfig),
    node("end", z.object({ outcome: z.enum(["done", "failed"]) })),
]);

const edge = z.object({ id: z.string(), from: z.object({ node: z.string(), port: z.string() }), to: z.string() });

export const workflowSchema: z.ZodMiniType<Workflow> = z.object({
    version: z.literal(WORKFLOW_FORMAT_VERSION),
    name: z.string(),
    nodes: z.array(workflowNode),
    edges: z.array(edge),
});

export type ParseResult = { ok: true; workflow: Workflow } | { ok: false; error: string };

/** Reads exported JSON. Says what is wrong in words an operator can act on. */
export const parseWorkflow = (text: string): ParseResult => {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        return { ok: false, error: "This is not valid JSON. Check that the whole file was pasted." };
    }
    if (typeof json === "object" && json !== null && "version" in json && json.version !== WORKFLOW_FORMAT_VERSION) {
        return { ok: false, error: `This workflow uses format version ${String(json.version)}. This app reads version ${WORKFLOW_FORMAT_VERSION}.` };
    }
    const result = workflowSchema.safeParse(json);
    if (result.success) return { ok: true, workflow: result.data };
    const issue = result.error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
    return { ok: false, error: `The workflow does not match the expected shape${where}. Export one from this page to see the format.` };
};

export const serializeWorkflow = (workflow: Workflow): string => JSON.stringify(workflow, null, 2);
