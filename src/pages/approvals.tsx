import { useEffect, useRef, useState } from "react";
import { Badge } from "@eylulg/ui/badge";
import { Card, CardBody, CardHeader } from "@eylulg/ui/card";
import { Kbd } from "@eylulg/ui/kbd";
import { Textarea } from "@eylulg/ui/textarea";
import { Link } from "react-router";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { inlineLink } from "@/components/app/styles";
import { pendingApprovals } from "@/domain/selectors";
import type { ApprovalOptionKey, ApprovalRequest } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { useCommand } from "@/state/use-command";
import { formatClock } from "@/utils/format";

interface ApprovalCardProps {
    approval: ApprovalRequest;
    note: string;
    onNote: (approvalId: string, note: string) => void;
    onAnswer: (approval: ApprovalRequest, option: ApprovalOptionKey) => Promise<void>;
}

interface OptionButtonProps {
    approval: ApprovalRequest;
    optionKey: ApprovalOptionKey;
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
                        Jobs that wait for a decision. Press <Kbd>1</Kbd> or <Kbd>2</Kbd> to answer the first request, or the one you are focused in.
                    </>
                }
            />
            <p ref={confirmationRef} tabIndex={-1} role="status" className="text-sm font-medium text-secondary empty:hidden">
                {confirmation}
            </p>
            {error && (
                <p role="alert" className="text-sm font-medium text-error">
                    {error}
                </p>
            )}
            {pending.length === 0 ? (
                <Panel>
                    <p className="text-tertiary">Nothing waiting on you. New requests show up here and as a notification.</p>
                </Panel>
            ) : (
                <div className="flex flex-col gap-4">
                    {pending.map((approval) => (
                        <ApprovalCard key={approval.id} approval={approval} note={notes[approval.id] ?? ""} onNote={handleNote} onAnswer={handleAnswer} />
                    ))}
                </div>
            )}
            {answered.length > 0 && (
                <Panel title="Answered">
                    <ul className="divide-y divide-subtle text-sm">
                        {answered.map((approval) => (
                            <li key={approval.id} className="py-2 text-secondary">
                                <span className="font-semibold">{jobs[approval.jobId]?.ticket.id}</span>
                                {approval.answer && `: option ${approval.answer.option}, ${approval.options[approval.answer.option].label}`}
                                {approval.answer?.option === approval.recommended && " (recommended)"}
                                {approval.answer?.note && `. Note: ${approval.answer.note}`}
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
        </div>
    );
};

const ApprovalCard = ({ approval, note, onNote, onAnswer }: ApprovalCardProps) => {
    const job = useAppStore((s) => s.control.jobs[approval.jobId]);

    const headingId = `approval-${approval.id}`;

    function handleNote(value: string) {
        onNote(approval.id, value);
    }

    return (
        <Card role="article" aria-labelledby={headingId} data-approval-id={approval.id}>
            <div className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
                {job && (
                    <Link to={`/jobs/${job.id}`} className={inlineLink}>
                        {job.ticket.id}
                    </Link>
                )}
                <span>{job?.ticket.title}</span>
                <span className="ml-auto text-xs">Asked at {formatClock(approval.createdAt)}</span>
            </div>
            <h2 id={headingId} className="font-display text-lg font-semibold text-primary">
                {approval.question}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {OPTION_KEYS.map((key) => (
                    <OptionButton key={key} approval={approval} optionKey={key} onAnswer={onAnswer} />
                ))}
            </div>
            <Textarea label="Note for the agent (optional)" rows={2} value={note} onChange={handleNote} placeholder="Keep the diff small" />
        </Card>
    );
};

const OptionButton = ({ approval, optionKey, onAnswer }: OptionButtonProps) => {
    const option = approval.options[optionKey];
    const recommended = approval.recommended === optionKey;

    function handleClick() {
        return onAnswer(approval, optionKey);
    }

    return (
        <Card onPress={handleClick} aria-keyshortcuts={optionKey === "A" ? "1" : "2"} className="gap-2">
            <CardHeader
                title={`Option ${optionKey}: ${option.label}`}
                headingLevel={3}
                actions={<Kbd>{optionKey === "A" ? 1 : 2}</Kbd>}
                description={option.description}
            />
            {recommended && (
                <CardBody className="flex flex-col items-start gap-2">
                    <Badge color="brand" size="sm">
                        Recommended
                    </Badge>
                    <span className="font-medium text-primary">Why: {approval.reason}</span>
                </CardBody>
            )}
        </Card>
    );
};
