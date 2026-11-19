# Performance

Notes on the workflow canvas. Numbers come from the measurement below, not from a guess.

## What keeps a drag cheap

- Pointer moves, wheel events and drags are coalesced to one update per animation frame (`track-pointer.ts` and the wheel handler in `canvas.tsx`).
- A drag does not write history. Each frame replaces the graph from the position at drag start, and one command is recorded when the pointer is released.
- Nodes and edges are `memo`ised components that read their own slice of the store (`byId.get(id)`). `moveNodes` keeps the identity of every node it does not move, so only the dragged nodes and the edges attached to them render.
- Validation, descriptions and focus order are computed on commit, not per frame.
- Pan and zoom change one CSS transform on one layer, not the nodes.

## How it was measured

Development only. The page has a "Load 200 steps" button that is not part of the production build. It loads a generated valid workflow of 198 nodes on a 20 column grid.

1. `npx vite --port 4810`, then Chromium (headless, Playwright, 1440 by 1100) opened `/workflows`.
2. The button loaded the 198 nodes. The mouse dragged node 25 by 200 by 120 pixels in 120 moves, panned empty space by 150 by 80 in 120 moves, then sent 60 wheel events (pan) and 40 Ctrl+wheel events (zoom), each 8 ms apart.
3. A `requestAnimationFrame` loop recorded frame gaps. The Chrome DevTools protocol `Performance.getMetrics` gave script and task time over the gesture, divided by the number of moves.
4. The same run was repeated with `memo` removed from the node and edge components, to check that the memoisation earns its place.

This is a React development build in headless Chromium with software rendering, so absolute times are pessimistic. The comparison is what matters.

## Results

| Gesture, 198 nodes            | Frames over 33 ms | Slowest frame | Script time per move | Task time per move |
| ----------------------------- | ----------------- | ------------- | -------------------- | ------------------ |
| Drag one node, with memo      | 1 of 254          | 33 ms         | 10.8 ms              | 13.9 ms            |
| Drag one node, without memo   | 7 of 365          | 100 ms        | 25.9 ms              | 29.3 ms            |
| Pan by dragging, with memo    | 1 of 201          | 33 ms         | 3.0 ms               | 7.9 ms             |
| Pan by dragging, without memo | 6 of 353          | 83 ms         | 17.7 ms              | 22.9 ms            |
| Wheel pan, with memo          | 0 of 120          | 17 ms         | not recorded         | not recorded       |
| Ctrl+wheel zoom, with memo    | 0 of 159          | 17 ms         | not recorded         | not recorded       |

Memoising cut script time per move by about 2.4 times for a drag and 6 times for a pan, and removed the long frames. With it, frames sit at the 60 Hz limit.

## Not done

- No virtualisation. At 198 nodes it is not needed. A graph of several thousand would need culling nodes and edges outside the viewport.
- Not measured on a phone or with a production build.
