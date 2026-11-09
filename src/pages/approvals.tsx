import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Card, PageHeader } from "@/components/app/page-header";
import { inlineLink, surface } from "@/components/app/styles";
import { Badge } from "@/components/base/badges/badges";
import { TextArea } from "@/components/base/textarea/textarea";
import { pendingApprovals } from "@/domain/selectors";
import type { ApprovalOptionKey, ApprovalRequest } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { useCommand } from "@/state/use-command";
import { cx } from "@/utils/cx";
import { formatClock } from "@/utils/format";

interface ApprovalCardProps {
    approval: ApprovalRequest;
    note: string;
    shortcuts: boolean;
    onNote: (approvalId: string, note: string) => void;
    onAnswer: (approval: ApprovalRequest, option: ApprovalOptionKey) => Promise<void>;
}

interface OptionButtonProps {
    approval: ApprovalRequest;
    optionKey: ApprovalOptionKey;
    shortcut?: string;
    onAnswer: (approval: ApprovalRequest, option: ApprovalOptionKey) => Promise<void>;
}

const SHORTCUTS: Record<string, ApprovalOptionKey> = { "1": "A", "2": "B" };
const OPTION_KEYS: ApprovalOptionKey[] = ["A", "B"];
const RECENT_ANSWERS = 10;

const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export const ApprovalsPage = () => {
    const approvals = useAppStore((s) => s.control.approvals);
    const jobs = useAppStore((s) => s.control.jobs);
    const { run, error } = useCommand();
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [confirmation, setConfirmation] = useState("");
    const confirmationRef = useRef<HTMLParagraphElement>(null);

    const pending = pendingApprovals({ approvals, jobs });
    const answered = Object.values(approvals)
        .filter((approval) => approval.status === "answered")
        .slice(-RECENT_ANSWERS)
        .reverse();

    // Answering removes the focused card, so focus moves to the confirmation that replaces it.
    async function handleAnswer(approval: ApprovalRequest, option: ApprovalOptionKey) {
        const accepted = await run({ type: "approval.answer", approvalId: approval.id, option, note: notes[approval.id] });
        if (!accepted) return;
        setConfirmation(`Answered ${jobs[approval.jobId]?.ticket.id ?? "the request"} with option ${option}, ${approval.options[option].label}.`);
        confirmationRef.current?.focus();
    }

    function handleNote(approvalId: string, note: string) {
        setNotes((current) => ({ ...current, [approvalId]: note }));
    }

    useEffect(() => {
        function handleShortcut(event: KeyboardEvent): Promise<void> | undefined {
            const option = SHORTCUTS[event.key];
            if (!option || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return undefined;
            const focusedCard = document.activeElement?.closest<HTMLElement>("[data-approval-id]");
            const target = pending.find((approval) => approval.id === focusedCard?.dataset.approvalId) ?? pending[0];
            if (!target) return undefined;
            event.preventDefault();
            return handleAnswer(target, option);
        }
        document.addEventListener("keydown", handleShortcut);
        return () => document.removeEventListener("keydown", handleShortcut);
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
            <p ref={confirmationRef} tabIndex={-1} role="status" className="text-sm font-medium text-secondary empty:hidden">
                {confirmation}
            </p>
            {error && (
                <p role="alert" className="text-sm font-medium text-error-primary">
                    {error}
                </p>
            )}
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
                            shortcuts={index === 0}
                            note={notes[approval.id] ?? ""}
                            onNote={handleNote}
                            onAnswer={handleAnswer}
                        />
                    ))}
                </div>
            )}
            {answered.length > 0 && (
                <Card title="Answered">
                    <ul className="divide-y divide-secondary text-sm">
                        {answered.map((approval) => (
                            <li key={approval.id} className="py-2 text-secondary">
                                <span className="font-semibold">{jobs[approval.jobId]?.ticket.id}</span>
                                {approval.answer && `: option ${approval.answer.option}, ${approval.options[approval.answer.option].label}`}
                                {approval.answer?.option === approval.recommended && " (recommended)"}
                                {approval.answer?.note && `. Note: ${approval.answer.note}`}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
};

const ApprovalCard = ({ approval, note, shortcuts, onNote, onAnswer }: ApprovalCardProps) => {
    const job = useAppStore((s) => s.control.jobs[approval.jobId]);

    const headingId = `approval-${approval.id}`;

    function handleNote(value: string) {
        onNote(approval.id, value);
    }

    return (
        <article aria-labelledby={headingId} data-approval-id={approval.id} className={surface}>
            <div className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
                {job && (
                    <Link to={`/jobs/${job.id}`} className={inlineLink}>
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
                {OPTION_KEYS.map((key, index) => (
                    <OptionButton key={key} approval={approval} optionKey={key} shortcut={shortcuts ? String(index + 1) : undefined} onAnswer={onAnswer} />
                ))}
            </div>
            <TextArea className="mt-4" label="Note for the agent (optional)" rows={2} value={note} onChange={handleNote} placeholder="Keep the diff small" />
        </article>
    );
};

const OptionButton = ({ approval, optionKey, shortcut, onAnswer }: OptionButtonProps) => {
    const option = approval.options[optionKey];
    const recommended = approval.recommended === optionKey;

    function handleClick() {
        return onAnswer(approval, optionKey);
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-keyshortcuts={shortcut}
            className={cx(
                "flex flex-col gap-2 rounded-lg bg-primary p-4 text-left transition hover:bg-primary_hover",
                recommended ? "ring-2 ring-brand" : "ring-1 ring-primary",
            )}
        >
            <span className="flex flex-wrap items-center gap-2">
                <kbd className="rounded-md bg-tertiary px-1.5 py-0.5 font-mono text-xs font-semibold text-secondary">{optionKey === "A" ? 1 : 2}</kbd>
                <span className="text-md font-semibold text-primary">
                    Option {optionKey}: {option.label}
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
};
