import { type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, LinkExternal01 } from "@untitledui/icons";
import { Link, useParams } from "react-router";
import { EventRow } from "@/components/app/event-row";
import { Card, PageHeader } from "@/components/app/page-header";
import { KindBadge, StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import type { Job } from "@/domain/types";
import { useAppStore } from "@/state/store-context";
import { formatClock } from "@/utils/format";

const Timeline = ({ job }: { job: Job }) => {
    const jobs = useAppStore((s) => s.control.jobs);
    const [follow, setFollow] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);
    const count = job.timeline.length;

    useEffect(() => {
        const el = listRef.current;
        if (follow && el) el.scrollTop = el.scrollHeight;
    }, [count, follow]);

    return (
        <Card
            title="Timeline"
            actions={
                <Button size="sm" color="secondary" aria-pressed={!follow} onPress={() => setFollow((f) => !f)}>
                    {follow ? "Pause auto-follow" : "Resume auto-follow"}
                </Button>
            }
        >
            <div
                ref={listRef}
                tabIndex={0}
                role="region"
                aria-label={`Timeline for ${job.ticket.id}, ${count} events`}
                className="max-h-96 overflow-y-auto rounded-md pr-1"
            >
                <ol className="divide-y divide-secondary">
                    {job.timeline.map((event) => (
                        <EventRow key={event.seq} event={event} jobs={jobs} showJob={false} />
                    ))}
                </ol>
            </div>
            <p className="mt-2 text-xs text-tertiary">
                {follow ? "Following new events as they arrive." : "Auto-follow paused. New events still arrive below."}
            </p>
        </Card>
    );
};

const Actions = ({ job }: { job: Job }) => {
    const send = useAppStore((s) => s.send);
    const [reason, setReason] = useState("");
    const finished = job.status === "done" || job.status === "failed";
    const held = job.status === "on-hold";

    const hold = (event: FormEvent) => {
        event.preventDefault();
        void send({ type: "job.hold", jobId: job.id, reason: reason || "Held by operator" });
        setReason("");
    };

    return (
        <Card title="Actions">
            <form className="flex flex-col gap-3" onSubmit={hold}>
                <Input label="Hold reason" placeholder="For example: waiting on a designer" value={reason} onChange={setReason} isDisabled={finished || held} />
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" color="secondary" isDisabled={finished || held}>
                        Hold
                    </Button>
                    <Button size="sm" color="secondary" isDisabled={!held} onPress={() => void send({ type: "job.resume", jobId: job.id })}>
                        Resume
                    </Button>
                    <Button size="sm" color="primary-destructive" isDisabled={finished} onPress={() => void send({ type: "job.cancel", jobId: job.id })}>
                        Cancel job
                    </Button>
                    <Button size="sm" color="secondary" isDisabled={job.status !== "failed"} onPress={() => void send({ type: "job.retry", jobId: job.id })}>
                        Retry
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export const JobDetailPage = () => {
    const { jobId = "" } = useParams();
    const job = useAppStore((s) => s.control.jobs[jobId]);
    const dependency = useAppStore((s) => (job?.dependsOn ? s.control.jobs[job.dependsOn] : undefined));

    if (!job) {
        return (
            <div className="flex flex-col gap-4">
                <PageHeader title="Job not found" description="It may belong to a different seed. Reset the simulation or pick a job from the queue." />
                <Link to="/queue" className="text-sm font-semibold text-brand-secondary underline">
                    Back to the queue
                </Link>
            </div>
        );
    }

    const guardEvents = job.timeline.filter((event) => event.type === "guard.blocked" || event.type === "guard.allowed");

    return (
        <div className="flex flex-col gap-6">
            <Link to="/queue" className="flex w-max items-center gap-1 rounded-xs text-sm font-semibold text-tertiary hover:text-secondary">
                <ArrowLeft aria-hidden="true" className="size-4" /> Queue
            </Link>
            <PageHeader
                title={`${job.ticket.id}: ${job.ticket.title}`}
                description={
                    <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={job.status} size="md" />
                        <KindBadge kind={job.kind} />
                        <Badge type="color" size="sm" color="gray">
                            {job.ticket.repo}
                        </Badge>
                        <Badge type="color" size="sm" color="gray">
                            Model {job.model}
                        </Badge>
                        <Badge type="color" size="sm" color="gray">
                            Attempt {job.attempts}
                        </Badge>
                    </span>
                }
                actions={
                    job.pr ? (
                        <Button size="sm" color="secondary" href={job.pr.url} target="_blank" rel="noreferrer" iconTrailing={LinkExternal01}>
                            PR #{job.pr.number}
                        </Button>
                    ) : undefined
                }
            />

            {job.status === "awaiting-approval" && (
                <p className="rounded-lg bg-primary p-3 text-sm text-primary ring-1 ring-brand">
                    <strong className="font-semibold">Blocked on a decision.</strong> The agent will not write code until someone answers.{" "}
                    <Link to="/approvals" className="font-semibold text-brand-secondary underline">
                        Answer in the approvals inbox
                    </Link>
                </p>
            )}
            {job.holdReason && (
                <p className="rounded-lg bg-warning-primary p-3 text-sm text-primary ring-1 ring-secondary">
                    <strong className="font-semibold">On hold.</strong> {job.holdReason}
                </p>
            )}
            {job.failureReason && (
                <p className="rounded-lg bg-error-primary p-3 text-sm text-primary ring-1 ring-secondary">
                    <strong className="font-semibold">Failed.</strong> {job.failureReason}
                </p>
            )}
            {dependency && (
                <p className="text-sm text-tertiary">
                    Stacked on{" "}
                    <Link className="font-semibold text-brand-secondary underline" to={`/jobs/${dependency.id}`}>
                        {dependency.ticket.id}
                    </Link>{" "}
                    ({dependency.status === "done" ? "merged" : "not merged yet"}).
                </p>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
                    <Card title="Plan">
                        {job.plan ? (
                            <p className="text-sm whitespace-pre-wrap text-secondary">{job.plan}</p>
                        ) : (
                            <p className="text-sm text-tertiary">No plan posted yet.</p>
                        )}
                    </Card>
                    <Timeline job={job} />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    <Actions job={job} />
                    <Card title="Commits">
                        {job.commits.length === 0 ? (
                            <p className="text-sm text-tertiary">No commits yet.</p>
                        ) : (
                            <ul className="flex flex-col gap-2 text-sm">
                                {job.commits.map((commit) => (
                                    <li key={commit.sha + commit.ts} className="min-w-0">
                                        <code className="mr-2 text-xs text-tertiary">{commit.sha}</code>
                                        <span className="break-words text-secondary">{commit.message}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card title="CI runs">
                        {job.ciRuns.length === 0 ? (
                            <p className="text-sm text-tertiary">No CI runs yet.</p>
                        ) : (
                            <ul className="flex flex-col gap-2 text-sm">
                                {job.ciRuns.map((run) => (
                                    <li key={run.id} className="flex flex-col gap-1">
                                        <span className="flex items-center gap-2">
                                            <Badge type="pill-color" size="sm" color={run.status === "failed" ? "error" : "success"}>
                                                {run.status === "failed" ? "Failed" : run.status === "fixed" ? "Fixed" : "Passed"}
                                            </Badge>
                                            <span className="text-secondary">{run.check}</span>
                                            <span className="ml-auto text-xs text-tertiary">{formatClock(run.ts)}</span>
                                        </span>
                                        <span className="text-xs break-words text-tertiary">{run.detail}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card title="Review findings">
                        {job.findings.length === 0 ? (
                            <p className="text-sm text-tertiary">No review findings.</p>
                        ) : (
                            <ul className="flex flex-col gap-3 text-sm">
                                {job.findings.map((finding) => (
                                    <li key={finding.id} className="flex flex-col gap-1">
                                        <span className="text-xs text-tertiary">
                                            {finding.author} on <code>{finding.file}</code>
                                        </span>
                                        <span className="text-secondary">{finding.body}</span>
                                        <span className="border-l-2 border-secondary pl-2 text-tertiary">
                                            {finding.reply ? `Agent: ${finding.reply}` : "Reply pending"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card title="Guard events">
                        {guardEvents.length === 0 ? (
                            <p className="text-sm text-tertiary">No guard events for this job.</p>
                        ) : (
                            <ol className="divide-y divide-secondary">
                                {guardEvents.map((event) => (
                                    <EventRow key={event.seq} event={event} showJob={false} />
                                ))}
                            </ol>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};
