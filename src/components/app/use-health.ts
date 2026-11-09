import { HEARTBEAT_EVERY } from "@/domain/simulator";
import { useAppStore } from "@/state/store-context";
import { formatClock } from "@/utils/format";

export type Health = { state: "healthy" | "stale" | "paused" | "connecting"; label: string };

export const useHealth = (): Health => {
    const health = useAppStore((s) => s.control.health);
    const sim = useAppStore((s) => s.sim);
    const connected = useAppStore((s) => s.connected);
    if (!connected) return { state: "connecting", label: "Connecting" };
    if (sim && !sim.running) return { state: "paused", label: "Simulation paused" };
    if (health.lastHeartbeat === null) return { state: "stale", label: "Waiting for heartbeat" };
    const behind = sim ? sim.tick - health.tick : 0;
    if (behind > HEARTBEAT_EVERY * 2) return { state: "stale", label: `No heartbeat since ${formatClock(health.lastHeartbeat)}` };
    return { state: "healthy", label: `Healthy, last heartbeat ${formatClock(health.lastHeartbeat)}` };
};
