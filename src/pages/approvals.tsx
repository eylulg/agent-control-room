import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Card, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/base/badges/badges";
import { TextArea } from "@/components/base/textarea/textarea";
import { pendingApprovals } from "@/domain/selectors";
import type { ApprovalOptionKey, ApprovalRequest } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { cx } from "@/utils/cx";
import { formatClock } from "@/utils/format";

const KEYS: Record<string, ApprovalOptionKey> = { "1": "A", "2": "B" };

const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const ApprovalCard = ({
    approval,
    note,
    onNote,
    onAnswer,
    primary,
}: {
    approval: ApprovalRequest;
    note: string;
    onNote: (value: string) => void;
    onAnswer: (option: ApprovalOptionKey) => void;
    primary: boolean;
}) => {
    const job = useAppStore((s) => s.control.jobs[approval.jobId]);
    const headingId = `approval-${approval.id}`;
    return (
        <article aria-labelledby={headingId} data-approval-id={approval.id} className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
                {job && (
                    <Link to={`/jobs/${job.id}`} className="rounded-xs font-semibold text-brand-secondary underline-offset-2 hover:underline">
                        {job.ticket.id}
                    </Link>
                )}
                <span>{job?.ticket.title}</span>
                <span className="ml-auto text-xs">Asked at {formatClock(approval.createdAt)}</span>
            </div>
            <h2 id={headingId} className="mt-2 text-lg font-semibold text-primary">
                {approval.question}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(["A", "B"] as const).map((key, index) => {
                    const option = approval.options[key];
                    const recommended = approval.recommended === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onAnswer(key)}
                            aria-keyshortcuts={primary ? String(index + 1) : undefined}
                            className={cx(
                                "flex flex-col gap-2 rounded-lg p-4 text-left transition",
                                recommended ? "bg-primary ring-2 ring-brand hover:bg-primary_hover" : "bg-primary ring-1 ring-primary hover:bg-primary_hover",
                            )}
                        >
                            <span className="flex flex-wrap items-center gap-2">
                                <kbd className="rounded-md bg-tertiary px-1.5 py-0.5 font-mono text-xs font-semibold text-secondary">{index + 1}</kbd>
                                <span className="text-md font-semibold text-primary">
                                    Option {key}: {option.label}
                                </span>
                                {recommended && (
                                    <Badge type="pill-color" color="brand" size="sm">
                                        Recommended
                                    </Badge>
                                )}
                            </span>
                            <span className="text-sm text-secondary">{option.description}</span>
                            {recommended && <span className="text-sm font-medium text-primary">Why: {approval.reason}</span>}
                        </button>
                    );
                })}
            </div>
            <TextArea
                className="mt-4"
                label="Note for the agent (optional)"
                rows={2}
                value={note}
                onChange={onNote}
                placeholder="Context the agent should keep in mind"
            />
        </article>
    );
};

export const ApprovalsPage = () => {
    const approvals = useAppStore((s) => s.control.approvals);
    const jobs = useAppStore((s) => s.control.jobs);
    const pending = useMemo(() => pendingApprovals({ approvals, jobs }), [approvals, jobs]);
    const answered = useMemo(() => Object.values(approvals).filter((a) => a.status === "answered"), [approvals]);
    const send = useAppStore((s) => s.send);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [confirmation, setConfirmation] = useState("");

    const answer = (approval: ApprovalRequest, option: ApprovalOptionKey) => {
        void send({ type: "approval.answer", approvalId: approval.id, option, note: notes[approval.id] });
        setConfirmation(`Answered ${jobs[approval.jobId]?.ticket.id ?? "request"} with option ${option}, ${approval.options[option].label}.`);
    };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const option = KEYS[event.key];
            if (!option || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
            const focusedCard = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-approval-id]");
            const target = pending.find((a) => a.id === focusedCard?.dataset.approvalId) ?? pending[0];
            if (!target) return;
            event.preventDefault();
            answer(target, option);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Approvals"
                description={
                    <>
                        Jobs that wait for a decision. Press <kbd className="font-semibold">1</kbd> or <kbd className="font-semibold">2</kbd> to answer the
                        first request, or the one you are focused in.
                    </>
                }
            />
            <p role="status" className="text-sm font-medium text-secondary empty:hidden">
                {confirmation}
            </p>
            {pending.length === 0 ? (
                <Card>
                    <p className="text-sm text-tertiary">Nothing waiting on you. New requests show up here and as a notification.</p>
                </Card>
            ) : (
                <div className="flex flex-col gap-4">
                    {pending.map((approval, index) => (
                        <ApprovalCard
                            key={approval.id}
                            approval={approval}
                            primary={index === 0}
                            note={notes[approval.id] ?? ""}
                            onNote={(value) => setNotes((current) => ({ ...current, [approval.id]: value }))}
                            onAnswer={(option) => answer(approval, option)}
                        />
                    ))}
                </div>
            )}
            {answered.length > 0 && (
                <Card title="Answered">
                    <ul className="divide-y divide-secondary text-sm">
                        {answered
                            .slice(-10)
                            .reverse()
                            .map((approval) => (
                                <li key={approval.id} className="py-2 text-secondary">
                                    <span className="font-semibold">{jobs[approval.jobId]?.ticket.id}</span>: option {approval.answer?.option},{" "}
                                    {approval.answer ? approval.options[approval.answer.option].label : ""}
                                    {approval.answer?.option === approval.recommended ? " (recommended)" : ""}
                                    {approval.answer?.note ? `. Note: ${approval.answer.note}` : ""}
                                </li>
                            ))}
                    </ul>
                </Card>
            )}
        </div>
    );
};
