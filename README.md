# Agent workflows

A workflow builder and control room (the builder plus the operator dashboard) for an autonomous engineering agent that takes tickets
to pull requests. The agent's steps are a graph you edit, check with a dry run and publish. It runs entirely in the browser against a deterministic
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

| Page       | What it shows                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview   | Health and heartbeat, active jobs, approvals waiting, guard blocks, throughput sparkline, jobs by status, events                                              |
| Queue      | Jobs grouped by status (Done collapsed) with a switch to a board, search and filters for kind and repository                                                  |
| Job detail | Plan, timeline with auto-follow and pause, commits, CI runs, review findings and replies, guard events, PR link, hold, resume, cancel, retry                  |
| Approvals  | A/B cards with the recommendation highlighted, optional note, answer with keys 1 and 2                                                                        |
| Routing    | Model per job kind with validation. Applies to new jobs and retries                                                                                           |
| Guards     | Rules with on and off switches and the blocked attempts log                                                                                                   |
| Workflows  | A canvas editor for the graph jobs walk: palette, inspector, problems, outline view, undo, import and export, publish, live job counts, job trace and dry run |
| Settings   | Simulation speed, run, pause, step, seed and reset                                                                                                            |

Approval requests raise a toast, and important events (approvals, guard blocks,
holds, failures, completions) are announced through an `aria-live` region.

## The simulated backend

`src/domain/simulator.ts` is a seeded, deterministic world. It uses a small
PRNG (mulberry32) whose state is one integer, so the same seed and the same
operator answers always replay the same day. On each tick it:

- picks up new tickets (fictional ids like `ACME-104`) with the model from the
  routing table,
- plans, and sometimes asks for approval, which blocks the job until answered
  (a simulated teammate answers with the recommended option after 30 ticks, so
  an unattended world keeps moving),
- pushes commits, opens a PR, sometimes fails CI and fixes it,
- gets review findings and replies to them,
- holds a job for a designer and resumes it later,
- tries a guarded action now and then (merge, `--no-verify`, ready while a
  dependency is open, posting as the owner) and gets blocked,
- emits a heartbeat every 5 ticks.

What a job does between those steps comes from the published workflow (see Decisions).

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

## Decisions

**A custom canvas, no canvas library.** The canvas is HTML nodes over one SVG edge layer inside a single transformed element. I did not use React Flow or similar. A library would have given pan, zoom and dragging for free, but the point of this project is the interaction model, and the part that matters most here, keyboard and screen reader parity, is the part such libraries leave to you or fight you on. Owning the nodes meant I could make them real listbox options with a roving tabindex, my own focus order and descriptions, and keep drag frames cheap with per node store selectors. What it costs: pan and zoom maths, hit testing for connections, and a coalescing layer for pointer events. There is no minimap and no edge routing, which a library would give.

**The graph is data and the simulator interprets it.** A workflow is a typed graph (`src/domain/workflow`) with a zod schema and a format `version`. The old phase machine became one executor per node type. Each tick a job runs its current node, which returns the port to leave through, or stays. Before changing the simulator I recorded event streams for three seeds and a fixed command script and committed them as a test. The default workflow reproduces them exactly, with the new node move events removed and sequence numbers renumbered, because those events did not exist then. Cycles are only valid through a bounded retry port (a CI check's Fail port or a review's Findings port), and the node holds the bound, so a published workflow always ends.

**Versions.** Publishing is an operator command that travels the same event stream as everything else (`workflow.publish`, then `workflow.published`). A job keeps the version that was latest when it was created, so a publish never changes a job halfway. A retry starts a new walk and takes the latest version. The cost is that several versions are alive at once. The execution view counts jobs of every version on the steps and connections that still exist, and says how many open jobs run an older one. Only the last 20 versions are kept, so tracing a job from an older one says the version is gone instead of drawing its path on a different graph.

**Keyboard and outline model.** Every pointer action has a keyboard path. The canvas is a listbox of steps. Tab enters it once, arrow keys move in topological order, Alt plus an arrow moves a step one grid step, and Enter opens a menu with Connect to, Disconnect, Edit settings, Duplicate and Delete. Each step's accessible description says what connects in and out. The Outline view shows the same graph as one flat list in the order a job meets the steps, with a select on every port to choose where it leads, so the whole graph can be built without the canvas, and it fits a phone. The list never nests, so it reads the same at any size. Moves, connections and deletions are announced in the editor's own live region, and when an action removes the step that had focus, focus moves to a neighbouring step. Reduced motion turns off the flowing edge animation.

**Undo.** Each edit is a labelled command that stores the graph before and after it, capped at 100. Graphs are immutable and share every node an edit did not touch, so keeping both sides is cheap and I did not have to write an inverse for each command. A drag is previewed without recording and committed as one command when the pointer is released. A new edit clears redo. The history is a pure reducer with its own tests, and the draft is saved to session storage with the other persistence helpers.

## Stack

Vite 7, React 19, TypeScript strict with `noUncheckedIndexedAccess`, Tailwind
CSS 4, the shared design system `@eylulg/ui` (theme variant `control-room`,
React Aria Components underneath, Lucide icons), Zustand, React Router 7 with one lazily loaded chunk per page, and zod
(mini) to validate every incoming event and the URL parameters.
Dark mode uses the `dark-mode` class, managed by the library's theme toggle and
set by the library's init script before first paint so there is no flash.

## Run

The design system is a local dependency (`"@eylulg/ui": "file:../ui"`), installed as a copy with `npm install ../ui --install-links`. Run `npm run relink` after rebuilding it. Clone
and build it next to this repo first:

```bash
git clone https://github.com/eylulg/ui ../ui && (cd ../ui && npm ci && npm run build)
npm install
npm run dev        # http://localhost:5173/agent-control-room/
```

Add `?seed=anything` to the URL to start a different world. Measurements of the canvas are in [docs/performance.md](docs/performance.md).

## Tests and checks

```bash
npm run typecheck
npm run lint           # zero warnings allowed
npm run format:check
npm run knip
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
  a note, holding a job, saving routing, switching a guard off
- focus: where it lands after navigation, after dismissing a toast, after
  answering an approval and after each job action
- the workflow graph logic (validation, cycles, reachability, order, layout), the undo history and the golden simulator streams
- editor flows: add, connect through the menu, delete, undo, publish, the outline, where focus lands after each removal, a draft typed for one step staying on it, drag and connect with the pointer, trace and dry run
- ambiguous graphs (repeated ids, two connections on a port) refused on import, and a page that throws leaving the shell usable
- axe on every page

jsdom computes no colours, so contrast in light and dark mode was checked
separately in a real browser with axe-core.

`npm run knip` reports unused files, exports and dependencies.

## Deploy

`.github/workflows/ci.yml` runs a gitleaks secret scan, typecheck, lint, format check, knip, test, build and a size budget for the first chunk on every push and
pull request. `.github/workflows/deploy.yml` builds with
`base: '/agent-control-room/'` and publishes `dist` to GitHub Pages.

Because the dependency is `file:../ui`, the workflows use
`.github/actions/install`, which checks out `eylulg/ui` next to the app, builds it
and installs it as a copy with `--install-links`. Once the library is
published to npm, change the dependency to `^1.0.0`, delete that action and use
`npm ci` again. Vercel deploys need that publish too.

Commit messages are plain sentences in the past tense. Dependabot opens one grouped update a month.

## License

[MIT](LICENSE) © Eylül Güneş
