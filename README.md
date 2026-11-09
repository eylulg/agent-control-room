# Agent control room

The operator dashboard for an autonomous engineering agent that takes tickets
to pull requests. It runs entirely in the browser against a deterministic
simulated agent, and it is built so a real agent backend can replace the
simulator over server sent events.

Live demo: `https://eylulg.github.io/agent-control-room/` (after Pages is enabled)

## Why

An agent that writes code on its own is only useful if the people around it can
see and steer it. Running one taught me that the hard part is not the model, it
is the operating surface:

- **Approval gates.** When a ticket is ambiguous the agent should stop and ask,
  with two concrete options, a recommendation and the reason for it. A job
  waiting on a human must be impossible to miss, and answering must take one
  key press.
- **Guards.** Some actions are never the agent's call: merging, skipping git
  hooks, marking stacked work ready before its base has merged, or posting
  under the owner's name. Those rules belong in code, and every blocked attempt
  should be visible so you can trust the rule is doing its job.
- **Routing.** Different kinds of work deserve different models. The routing
  table is the cost and quality dial, so it has to be visible and editable.
  The defaults send features to `claude-opus-5-5`, bugs and review fixes to
  `claude-sonnet-5-5`, chores and releases to `claude-haiku-5-5`, with
  `claude-fable-5-1` available as the strongest tier.
- **Holds.** Real work waits on people (a designer, a dependency PR). A hold
  with a reason is better than a silent stall.

This project is that operating surface, with a simulated agent so anyone can
click through it.

## What is in it

| Page       | What it shows                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview   | Health and heartbeat, active jobs, approvals waiting, guard blocks, throughput sparkline, jobs by status, events                             |
| Queue      | Kanban by status with search and filters for kind and repository                                                                             |
| Job detail | Plan, timeline with auto-follow and pause, commits, CI runs, review findings and replies, guard events, PR link, hold, resume, cancel, retry |
| Approvals  | A/B cards with the recommendation highlighted, optional note, answer with keys 1 and 2                                                       |
| Routing    | Model per job kind with validation. Applies to new jobs and retries                                                                          |
| Guards     | Rules with on and off switches and the blocked attempts log                                                                                  |
| Settings   | Simulation speed, run, pause, step, seed and reset                                                                                           |

Approval requests raise a toast, and important events (approvals, guard blocks,
holds, failures, completions) are announced through an `aria-live` region.

## The simulated backend

`src/domain/simulator.ts` is a seeded, deterministic world. It uses a small
PRNG (mulberry32) whose state is one integer, so the same seed and the same
operator answers always replay the same day. On each tick it:

- picks up new tickets (fictional ids like `ACME-104`) with the model from the
  routing table,
- plans, and sometimes asks for approval, which blocks the job until answered,
- pushes commits, opens a PR, sometimes fails CI and fixes it,
- gets review findings and replies to them,
- holds a job for a designer and resumes it later,
- tries a guarded action now and then (merge, `--no-verify`, ready while a
  dependency is open, posting as the owner) and gets blocked,
- emits a heartbeat every 5 ticks.

The opening is scripted so every mechanic shows up early: a stacked pair of PRs,
a CI failure, a designer hold and a hook skip attempt. Everything after that
comes from the seed.

Controls: `start()`, `pause()`, `step(n)`, `reset(seed)` and the `speed`
property (ticks per second).

## The protocol

The UI never reads simulator state directly. It consumes a stream of
`{ seq, ts, jobId, type, payload }` events and folds them through one pure
reducer (`applyEvent`) that the simulator also uses. Operator actions go back as
commands. `SimulatedAgentSource` and `SseAgentSource` both implement the same
`EventSource` shaped interface, so pointing the app at a real agent is:

```
/agent-control-room/?stream=https://agent.example/events&commands=https://agent.example/commands
```

The full contract (snapshot on connect, resume with `Last-Event-ID`, every
event type and command) is in [docs/protocol.md](docs/protocol.md).

## Stack

Vite 7, React 19, TypeScript strict with `noUncheckedIndexedAccess`, Tailwind
CSS 4, Untitled UI React (free components, copied in and trimmed to the ones
used), Zustand, React Router 7 with one lazily loaded chunk per page, and zod
(mini) to validate every incoming event and the URL parameters.
Dark mode uses the `dark-mode` class, set by an inline script before first
paint so there is no flash.

## Run

```bash
npm ci
npm run dev        # http://localhost:5173/agent-control-room/
```

Add `?seed=anything` to the URL to start a different world.

## Tests and checks

```bash
npm run typecheck
npm run lint           # zero warnings allowed
npm run format:check
npm test
npm run build      # also writes dist/404.html for SPA deep links on Pages
```

Tests sit in `__tests__/` next to the module they cover, one behaviour per
test, with shared helpers in `src/test-utils/`. Vitest with Testing Library and
vitest-axe covers:

- the simulator: determinism for a seed, reset, an approval blocking and
  unblocking a job, a guard blocking an action and letting it through when off,
  the dependency guard holding a stacked PR, routing changes reaching the next
  job only, operator and agent holds, retry after cancel
- the protocol: folding the event stream rebuilds the simulator state, and
  malformed or unknown events are rejected at the boundary
- user flows: queue filtering, answering an approval with the keyboard and with
  a note, holding a job, saving routing, switching a guard off, the theme toggle
- focus: where it lands after navigation, after dismissing a toast, after
  answering an approval and after each job action
- axe on every page

jsdom computes no colours, so contrast in light and dark mode was checked
separately in a real browser with axe-core.

`npm run knip` reports unused files, exports and dependencies.

## Deploy

`.github/workflows/ci.yml` runs typecheck, lint, format check, test, build and
knip on every push and pull request. `.github/workflows/deploy.yml` builds with
`base: '/agent-control-room/'` and publishes `dist` to GitHub Pages.

## License

[MIT](LICENSE) © Eylül Güneş
