import { cx } from "@/utils/cx";
import { type Health, useHealth } from "./use-health";

interface HealthIndicatorProps {
    compact?: boolean;
}

const DOT: Record<Health["state"], string> = {
    healthy: "bg-fg-success-primary",
    stale: "bg-fg-error-primary",
    paused: "bg-fg-warning-primary",
    connecting: "bg-fg-quaternary",
};

export const HealthIndicator = ({ compact = false }: HealthIndicatorProps) => {
    const health = useHealth();

    return (
        <p className="flex min-w-0 items-center gap-2 text-sm text-secondary">
            <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", DOT[health.state])} />
            <span className={cx("truncate", compact && "sr-only sm:not-sr-only")}>{health.label}</span>
        </p>
    );
};
