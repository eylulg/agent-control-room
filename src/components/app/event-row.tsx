import { cx } from "@eylulg/ui/cx";
import { Circle, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import type { AgentEvent, ControlState } from "@/domain/types";
import { type Tone, describe, formatClock } from "@/utils/format";
import { inlineLink } from "./styles";

interface EventRowProps {
    event: AgentEvent;
    jobs?: ControlState["jobs"];
}

const TONE_ICON: Record<Tone, { Icon: typeof Circle; className: string; label: string }> = {
    neutral: { Icon: Circle, className: "text-fg-tertiary", label: "Info" },
    good: { Icon: CircleCheck, className: "text-fg-success", label: "Success" },
    warning: { Icon: TriangleAlert, className: "text-fg-warning", label: "Attention" },
    critical: { Icon: CircleAlert, className: "text-fg-error", label: "Problem" },
};

/** One event in a feed. Pass `jobs` to link the event to its job. */
export const EventRow = ({ event, jobs }: EventRowProps) => {
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
                    <span aria-hidden="true"> · </span>
                    <code>{event.type}</code>
                    {job && (
                        <>
                            <span aria-hidden="true"> · </span>
                            <Link to={`/jobs/${job.id}`} className={inlineLink}>
                                {job.ticket.id}
                            </Link>
                        </>
                    )}
                </p>
            </div>
        </li>
    );
};
