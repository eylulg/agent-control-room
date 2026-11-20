# Performance

Measurements of the workflow canvas.

## What keeps a drag cheap

- Pointer moves and zoom wheel events are coalesced to one update per animation frame (`track-pointer.ts` and the wheel handler in `canvas.tsx`). A plain wheel is not handled at all, so it scrolls the page.
- A drag does not write history. Each frame replaces the graph from the position at drag start, and one command is recorded when the pointer is released.
- Nodes and edges are `memo`ised components that read their own slice of the store (`byId.get(id)`). `moveNodes` keeps the identity of every node it does not move, so only the dragged nodes and the edges attached to them render.
- The page does not subscribe to the draft or to the simulator. The overlay is computed in a small component that renders nothing, and the export dialog serialises the graph only while it is open. Publishing and the dry run read the draft when the button is pressed.
- Validation, descriptions and focus order are computed on commit, not per frame.
- Pan and zoom change one CSS transform on one layer, not the nodes.

## How it was measured

Development only. The page has a "Load 200 steps" button that is not part of the production build. It loads a generated valid workflow of 198 nodes on a 20 column grid.

1. `npx vite --port 4810`, then Chromium (headless, Playwright, 1440 by 1100) opened `/workflows`.
2. The button loaded the 198 nodes. The mouse dragged node 25 by 200 by 120 pixels in 120 moves, panned empty space by 150 by 80 in 120 moves, then sent 40 Ctrl+wheel events (zoom), 8 ms apart.
3. A `requestAnimationFrame` loop recorded frame gaps. The Chrome DevTools protocol `Performance.getMetrics` gave script and task time over the gesture, divided by the number of moves. The wheel pan row was measured before the plain wheel was handed back to the page and is gone.
4. The same run was repeated with `memo` removed from the node and edge components, to check that the memoisation earns its place.

This is a React development build in headless Chromium with software rendering, so absolute times are pessimistic. The comparison is what matters.

## What re-renders

Counted on the default workflow of 12 steps, in the same dev build, with the React devtools hook, walking each commit the way the devtools do and counting components that performed work. One 30 move drag of a step, then 5 seconds with the simulator running and the editor idle.

| Component                            | Drag, before | Drag, after | Idle 5 s, before | Idle 5 s, after |
| ------------------------------------ | ------------ | ----------- | ---------------- | --------------- |
| Page, palette, toolbar, problems     | 32 each      | 1 each      | 5 each           | 0               |
| Export button (serialised the graph) | 32           | 1           | 5                | 0               |
| Settings panel of the dragged step   | 33           | 32          | 5                | 0               |
| Node views, whole canvas             | 47           | 51          | 13               | 11              |
| Edge views, whole canvas             | 63           | 66          | 12               | 10              |

Before, the page subscribed to the whole simulator state and to the draft, so every drag frame and every simulator event rendered everything below it. After, only the overlay component follows the simulator, and node and edge views render when their own slice changes. The Settings panel of a step that is being dragged still renders each frame, because the step's object changes with its position. The node and edge counts include the live overlay updates that arrive during the gesture.

## Results

| Gesture, 198 nodes            | Frames over 33 ms | Slowest frame | Script time per move | Task time per move |
| ----------------------------- | ----------------- | ------------- | -------------------- | ------------------ |
| Drag one node, with memo      | 1 of 254          | 33 ms         | 10.8 ms              | 13.9 ms            |
| Drag one node, without memo   | 7 of 365          | 100 ms        | 25.9 ms              | 29.3 ms            |
| Pan by dragging, with memo    | 1 of 201          | 33 ms         | 3.0 ms               | 7.9 ms             |
| Pan by dragging, without memo | 6 of 353          | 83 ms         | 17.7 ms              | 22.9 ms            |
| Ctrl+wheel zoom, with memo    | 0 of 159          | 17 ms         | not recorded         | not recorded       |

The timings in this table were taken before the page stopped re-rendering on every frame and were not repeated, so they are the slower of the two. Memoising cut script time per move by about 2.4 times for a drag and 6 times for a pan, and removed the long frames. With it, frames sit at the 60 Hz limit.

## First load

The first chunk is what every visitor downloads. The editor store and the editor's popover code are not in it.

| Build                                          | First chunk, raw | First chunk, gzip |
| ---------------------------------------------- | ---------------- | ----------------- |
| `main`                                         | 469 kB           | 150.4 kB          |
| Workflow branch, editor store above the router | 602 kB           | 194.1 kB          |
| After the fix                                  | 486 kB           | 156.3 kB          |

Two things had moved in. The editor store and its history, layout and validation code sat in a provider above the router. And the router link in the app shell read a React Aria context that lives in the dialog module, so the dialog, menu and popover code came into the first chunk with it; now only the mobile drawer's link does, and it loads with the drawer. What is left over `main` is the workflow graph code the simulator now interprets. `npm run size` fails the build above 160 kB gzip.

## Not done

- No virtualisation. At 198 nodes it is not needed. A graph of several thousand would need culling nodes and edges outside the viewport.
- Not measured on a phone or with a production build.
