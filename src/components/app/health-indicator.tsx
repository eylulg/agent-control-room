import { cx } from "@/utils/cx";
import { type Health, useHealth } from "./use-health";

const DOT: Record<Health["state"], string> = {
    healthy: "bg-[#0ca30c]",
    stale: "bg-[#d03b3b]",
    paused: "bg-[#fab219]",
    connecting: "bg-fg-quaternary",
};

export const HealthIndicator = ({ compact = false }: { compact?: boolean }) => {
    const health = useHealth();
    return (
        <p className="flex min-w-0 items-center gap-2 text-sm text-secondary">
            <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", DOT[health.state])} />
            <span className={cx(compact && "sr-only sm:not-sr-only", "truncate")}>{health.label}</span>
        </p>
    );
};
