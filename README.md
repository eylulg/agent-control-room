# Agent workflows

A control room and workflow builder for an autonomous agent that takes tickets to pull requests. You edit the agent's steps as a graph, check it with a dry run and publish it. It runs in the browser against a seeded, simulated agent. A real backend can replace the simulator over server sent events.

Live: https://eylulg.github.io/agent-control-room/

## Why I built it

An agent that writes code on its own is only useful if people can see and steer it. The hard part is the operating surface: approval gates that are impossible to miss, rules the agent cannot break (never merge, never skip git hooks, never post as the owner), a routing table that sends each kind of job to a model, and holds with a reason when work waits on a person.

## Run it

The design system `@eylulg/ui` is a local dependency (`file:../ui`), so build it next to this repo first.

```bash
git clone https://github.com/eylulg/ui ../ui && (cd ../ui && npm ci && npm run build)
npm install
npm run dev        # http://localhost:5173/agent-control-room/
```

Add `?seed=anything` to the address for a different simulated day. After rebuilding the library, run `npm run relink`.

To point the app at a real agent, pass its endpoints. The contract is in [docs/protocol.md](docs/protocol.md).

```
/agent-control-room/?stream=https://agent.example/events&commands=https://agent.example/commands
```

## What is in it

Overview, queue (list or board), job detail, approvals (answer with keys 1 and 2), routing, guards, a workflow editor and settings for the simulation.

The simulator in `src/domain/simulator.ts` is deterministic: the same seed and the same operator answers replay the same day. The UI never reads it directly. It folds a stream of events through one reducer (`applyEvent`) and sends commands back, which is the same path a real agent would use.

## Decisions

**A custom canvas instead of React Flow.** The canvas is HTML nodes over one SVG edge layer. A library gives pan, zoom and dragging for free, but it leaves keyboard and screen reader use to you. Owning the nodes let me make them listbox options with my own focus order. The cost is pan and zoom maths, hit testing and pointer handling. There is no minimap and no edge routing.

**The graph is data and the simulator runs it.** A workflow is a typed graph with a zod schema and a format version. Each tick a job runs its current node. Cycles are only valid through a bounded retry port, so a published workflow always ends. Before changing the simulator I recorded event streams for three seeds and committed them as a test. The default workflow reproduces them.

**Versions.** Publishing travels the same event stream as everything else. A job keeps the version that was latest when it started, so a publish never changes a job halfway. The cost is that several versions are alive at once, and only the last 20 are kept. Tracing a job from an older version says the version is gone.

**Keyboard and outline view.** Every pointer action has a keyboard path. The canvas is a listbox of steps, and an Outline view lists the same graph flat with a select on every port, so the whole graph can be built without the canvas, including on a phone.

**Undo.** Each edit stores the graph before and after, capped at 100. Graphs are immutable and share untouched nodes, so I did not write an inverse for each command. A drag is one command, recorded on release.

## Tests

Vitest with Testing Library and vitest-axe covers the simulator, the protocol boundary, user flows, focus, the graph logic, undo and the editor, with axe on every page. Contrast in light and dark mode was checked once in a real browser, because jsdom has no colours. Canvas measurements are in [docs/performance.md](docs/performance.md).

```bash
npm run typecheck && npm run lint && npm run format:check && npm run knip && npm test
npm run build && npm run size   # first load must stay under 160 kB gzip
```

## Deploy

CI runs a gitleaks scan, the checks above, the build and the size budget on every push and pull request. The deploy workflow builds with base `/agent-control-room/` and publishes `dist` to GitHub Pages. The build also writes `dist/404.html` so deep links work. Because the library is a local dependency, both workflows use `.github/actions/install`, which builds `eylulg/ui` next to the app first. No environment variables are needed.

## License

[MIT](LICENSE), Eylül Güneş
