# Agent event protocol

The control room never talks to the simulator directly. It reads a stream of
events and sends operator commands. The in browser simulator and a real agent
backend implement the same contract, so swapping one for the other is a
configuration change, not a rewrite.

```
 agent backend                                   control room (browser)
 ─────────────                                   ──────────────────────
 GET  /events  ── text/event-stream ──────────▶  EventSource  ─▶ applyEvent() ─▶ UI
 POST /commands ◀── application/json ──────────  send(command)
```

Both sides fold events through the same pure reducer, `applyEvent` in
`src/domain/reducer.ts`. The simulator uses it to update its own state, and the
UI uses it to build its read model. A unit test folds the stream on the client
side and asserts it equals the simulator state.

## Connecting a real backend

Open the app with two query parameters:

```
https://<host>/agent-control-room/?stream=https://agent.example/events&commands=https://agent.example/commands
```

`src/main.tsx` then creates an `SseAgentSource` instead of the simulator. The
Settings page hides the simulation controls when a real source is connected.

## Stream: `GET /events`

A standard [server sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
stream. Every message uses the event name `agent-event`, carries the sequence
number as its `id`, and has a JSON encoded `AgentEvent` as `data`:

```
id: 42
event: agent-event
data: {"seq":42,"ts":1767605400000,"jobId":"job-3","type":"ci.failed","payload":{"runId":"ci-41","check":"unit tests","detail":"2 failing tests"}}

```

Rules:

1. **Snapshot first.** On every new connection the server sends one
   `world.snapshot` event whose payload is the full `ControlState`. The client
   replaces its state with it. This makes reconnects simple and keeps the
   client stateless.
2. **Resume.** Browsers resend the last seen `id` in the `Last-Event-ID`
   header. A server may replay missed events after that id instead of sending a
   snapshot, as long as order is preserved.
3. **Order.** `seq` is strictly increasing per stream. Clients may drop any
   event with a `seq` at or below the last applied one.
4. **Heartbeat.** The server sends `health.heartbeat` at a steady interval
   (the simulator does it every 5 ticks). The UI marks the agent stale after two
   missed heartbeats.
5. **Validation.** The client validates every message against a zod schema
   (`src/domain/schema.ts`). Malformed JSON, unknown types and payloads of the
   wrong shape are dropped before they reach the state, so the server can add
   new event types without breaking older clients.

### Event envelope

```ts
interface AgentEvent {
    seq: number; // monotonic, also the SSE id
    ts: number; // epoch milliseconds
    jobId: string | null; // null for global events
    type: EventType;
    payload: object; // shape depends on type, see below
}
```

### Event types

| Type                 | jobId | Payload                                     | Effect on state                                      |
| -------------------- | ----- | ------------------------------------------- | ---------------------------------------------------- |
| `world.snapshot`     | null  | `{ state: ControlState }`                   | Replaces the whole state                             |
| `job.created`        | yes   | `{ job: Job }`                              | Adds the job in status `queued`                      |
| `job.status`         | yes   | `{ status }`                                | Sets the status                                      |
| `plan.posted`        | yes   | `{ plan }`                                  | Replaces the plan text                               |
| `approval.requested` | yes   | `{ approval: ApprovalRequest }`             | Adds a pending approval, job is `awaiting-approval`  |
| `approval.answered`  | yes   | `{ approvalId, option: "A" \| "B", note? }` | Marks the approval answered                          |
| `commit.pushed`      | yes   | `{ sha, message }`                          | Appends a commit                                     |
| `pr.opened`          | yes   | `{ number, url }`                           | Sets the PR link                                     |
| `ci.passed`          | yes   | `{ runId, check }`                          | Appends a passing run                                |
| `ci.failed`          | yes   | `{ runId, check, detail }`                  | Appends a failed run, job is `fixing-ci`             |
| `ci.fixed`           | yes   | `{ runId, check, sha }`                     | Appends a fixed run                                  |
| `review.finding`     | yes   | `{ findingId, author, file, body }`         | Appends a finding, job is `answering-review`         |
| `review.replied`     | yes   | `{ findingId, body }`                       | Attaches the agent reply to the finding              |
| `guard.blocked`      | yes   | `{ guardId, action, detail }`               | Appends to that guard's blocked log                  |
| `guard.allowed`      | yes   | `{ guardId, action, detail }`               | Timeline only. The guard was off                     |
| `guard.toggled`      | null  | `{ guardId, enabled }`                      | Switches a guard                                     |
| `routing.updated`    | null  | `{ routing: RoutingTable }`                 | Replaces the routing table                           |
| `job.held`           | yes   | `{ reason, by: "agent" \| "operator" }`     | Job is `on-hold`, remembers the previous status      |
| `job.resumed`        | yes   | `{ by }`                                    | Restores the previous status                         |
| `job.retried`        | yes   | `{ attempt, model }`                        | Job is `queued` again with the current routing model |
| `job.done`           | yes   | `{ prNumber? }`                             | Job is `done`, counted for throughput                |
| `job.failed`         | yes   | `{ reason, cancelled? }`                    | Job is `failed`                                      |
| `health.heartbeat`   | null  | `{ tick, activeJobs, queueDepth }`          | Updates health                                       |

The exact TypeScript types live in `src/domain/types.ts` (`EventPayloads`).

## Commands: `POST /commands`

The browser sends one JSON `OperatorCommand` per request. The server answers
`202 Accepted` and reports the outcome through the stream, never in the
response body. That keeps one source of truth: if the command worked, an event
shows up.

| Command           | Body                                        | Resulting events                                 |
| ----------------- | ------------------------------------------- | ------------------------------------------------ |
| `approval.answer` | `{ approvalId, option: "A" \| "B", note? }` | `approval.answered`, `plan.posted`, `job.status` |
| `job.hold`        | `{ jobId, reason }`                         | `job.held` with `by: "operator"`                 |
| `job.resume`      | `{ jobId }`                                 | `job.resumed`                                    |
| `job.cancel`      | `{ jobId }`                                 | `job.failed` with `cancelled: true`              |
| `job.retry`       | `{ jobId }`                                 | `job.retried`                                    |
| `routing.set`     | `{ routing }`                               | `routing.updated` (invalid tables are ignored)   |
| `guard.toggle`    | `{ guardId, enabled }`                      | `guard.toggled`                                  |

A command that does not apply (answering an answered approval, resuming a job
that is not on hold) is a no-op. The server should not emit anything for it.

## Guards

Guards are enforced by the agent, not the UI. Before a guarded action the agent
checks the rule. If the guard is on it emits `guard.blocked` and does not act.
If it is off it emits `guard.allowed` and acts. The default guards are:

| id                 | action          | rule                                               |
| ------------------ | --------------- | -------------------------------------------------- |
| `never-merge`      | `merge`         | Never merge                                        |
| `dependency-first` | `mark-ready`    | Never mark ready while a dependency PR is unmerged |
| `keep-hooks`       | `skip-hooks`    | Never skip git hooks                               |
| `owner-voice`      | `post-as-owner` | Never post as the owner without approval           |

## The `AgentEventSource` interface

`src/domain/source.ts` defines the browser side. It is the `EventSource`
surface the app needs plus a `send` method:

```ts
interface AgentEventSource {
    readonly url: string;
    readonly readyState: 0 | 1 | 2;
    addEventListener(type: "agent-event", listener: (event: { data: string; lastEventId: string }) => void): void;
    removeEventListener(type: "agent-event", listener: (event: { data: string; lastEventId: string }) => void): void;
    close(): void;
    send(command: OperatorCommand, signal?: AbortSignal): Promise<void>;
}
```

`send` takes an `AbortSignal`. The UI aborts a command that is still in flight
when the view that sent it unmounts, and an aborted command never writes state.

`SimulatedAgentSource` wraps the simulator and serialises every event to JSON,
so the UI goes through exactly the same parse path as with a real stream.
`SseAgentSource` wraps a browser `EventSource` and `fetch`.
