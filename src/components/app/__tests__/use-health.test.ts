import { describe, expect, it } from "vitest";
import { type Health, deriveHealth } from "../use-health";

const T0 = Date.UTC(2026, 0, 5, 9, 30);

type Input = Parameters<typeof deriveHealth>[0];

const live: Input = {
    connected: true,
    connection: "open",
    lastEventAt: T0,
    heartbeat: { at: T0, gapMs: 10_000 },
    sim: null,
    lastHeartbeat: T0,
    heartbeatTick: 5,
    idle: false,
    now: T0 + 1000,
};

describe("deriveHealth", () => {
    it.each<[string, Partial<Input>, Health["state"], string]>([
        ["an unreachable stream", { connected: false, connection: "error" }, "error", "Cannot reach the agent, retrying"],
        ["a stream that has not answered yet", { connected: false, connection: "connecting" }, "connecting", "Connecting"],
        ["a stream that dropped after connecting", { connection: "error" }, "stale", "Reconnecting, last event 09:30"],
        ["a real agent that missed two heartbeats", { now: T0 + 21_000 }, "stale", "No heartbeat since 09:30"],
        ["a real agent still inside two heartbeats", { now: T0 + 19_000 }, "healthy", "Healthy, last heartbeat 09:30"],
        ["every open job waiting on the operator", { idle: true }, "idle", "Idle, waiting on you"],
    ])("reports %s", (_name, override, state, label) => {
        expect(deriveHealth({ ...live, ...override })).toEqual({ state, label });
    });
});
