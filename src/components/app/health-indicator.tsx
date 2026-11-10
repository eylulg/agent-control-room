import { cx } from "@eylulg/ui/cx";
import { type Health, useHealth } from "./use-health";

const DOT: Record<Health["state"], string> = {
    healthy: "bg-fg-success",
    idle: "bg-fg-warning",
    error: "bg-fg-error",
    stale: "bg-fg-error",
    paused: "bg-fg-warning",
    connecting: "bg-fg-tertiary",
};

export const HealthIndicator = () => {
    const health = useHealth();

    return (
        <p className="flex min-w-0 items-center gap-2 text-sm text-secondary">
            <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", DOT[health.state])} />
            <span className="truncate">{health.label}</span>
        </p>
    );
};
