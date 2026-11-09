import type { ReactNode } from "react";

/** Stat tile: sentence case label, proportional figure value, optional context and trend. */
export const StatTile = ({ label, value, context, trend }: { label: string; value: number | string; context?: ReactNode; trend?: ReactNode }) => (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
        <dt className="text-sm font-medium text-tertiary">{label}</dt>
        <dd className="text-display-xs font-semibold text-primary">{typeof value === "number" ? value.toLocaleString("en-US") : value}</dd>
        {context && <dd className="text-xs text-tertiary">{context}</dd>}
        {trend && <dd className="mt-auto pt-2">{trend}</dd>}
    </div>
);
