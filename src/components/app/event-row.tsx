import { AlertTriangle, CheckCircle, Circle, XCircle } from "@untitledui/icons";
import { Link } from "react-router";
import type { AgentEvent, ControlState } from "@/domain/types";
import { cx } from "@/utils/cx";
import { type Tone, describe, formatClock } from "@/utils/format";

const TONE_ICON: Record<Tone, { Icon: typeof Circle; className: string; label: string }> = {
    neutral: { Icon: Circle, className: "text-fg-quaternary", label: "Info" },
    good: { Icon: CheckCircle, className: "text-fg-success-primary", label: "Success" },
    warning: { Icon: AlertTriangle, className: "text-fg-warning-primary", label: "Attention" },
    critical: { Icon: XCircle, className: "text-fg-error-primary", label: "Problem" },
};

export const EventRow = ({ event, jobs, showJob = true }: { event: AgentEvent; jobs?: ControlState["jobs"]; showJob?: boolean }) => {
    const { text, tone } = describe(event);
    const { Icon, className, label } = TONE_ICON[tone];
    const job = event.jobId && jobs ? jobs[event.jobId] : undefined;
    return (
        <li className="flex min-w-0 gap-3 py-2">
            <Icon className={cx("mt-0.5 size-4 shrink-0", className)} aria-label={label} role="img" />
            <div className="min-w-0 flex-1">
                <p className="text-sm break-words text-secondary">{text}</p>
                <p className="text-xs text-tertiary">
                    <time dateTime={new Date(event.ts).toISOString()}>{formatClock(event.ts)}</time>
                    <span className="sr-only"> event type </span>
                    <span aria-hidden="true"> · </span>
                    <code>{event.type}</code>
                    {showJob && job && (
                        <>
                            <span aria-hidden="true"> · </span>
                            <Link to={`/jobs/${job.id}`} className="rounded-xs font-medium text-brand-secondary underline-offset-2 hover:underline">
                                {job.ticket.id}
                            </Link>
                        </>
                    )}
                </p>
            </div>
        </li>
    );
};
