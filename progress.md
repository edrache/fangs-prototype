Original prompt: od czego zaczniej implementacje? zrób to

2026-03-28
- Added first milestone scaffold: `index.html`, `main.js`, seeded RNG, district generator, city orchestrator, and canvas renderer.
- Exposed `window.render_game_to_text` and `window.advanceTime(ms)` for deterministic browser testing.
- Current output renders only district fills and major streets; there are no secondary streets, buildings, characters, or controls yet.
- Added a local Playwright fallback script in `scripts/local_playwright_check.mjs` because the shared skill client resolves dependencies outside this workspace.
- Verified `http://127.0.0.1:8080/index.html` in Chromium: screenshot saved to `output/web-game/shot-0.png`, state saved to `output/web-game/state-0.json`, no console errors recorded.
- Added `generator/streets.js` for full-span and dead-end secondary streets, and `generator/graph.js` for building an adjacency graph from street crossings and street endpoints.
- Verified updated output at `http://127.0.0.1:8081/index.html`: `state-0.json` now reports 80 streets and 263 graph nodes, with no console errors.
- Added `generator/buildings.js` to derive blocks from the street grid and populate them with compound buildings composed of 1 to 3 rectangles.
- Replaced random annex-side sorting with deterministic seeded shuffling so building compounds remain stable for the same seed.
- Verified updated output at `http://127.0.0.1:8081/index.html`: `state-0.json` now reports 59 buildings and 164 graph nodes for the current seed, with no console errors.
- Tightened building placement so every building rect is rejected if it overlaps any street corridor, including dead-end secondary streets.
- Removed building outlines in the renderer so connected building parts read as a single mass.
- Darkened building fills further relative to district colors for stronger separation.
- Changed building generation so `buildingDensity` controls target occupancy per block much more directly instead of relying mostly on per-cell randomness.
- Fixed a high-density regression where tiny subcells could eliminate all candidates and produce `0` buildings; target cell count is now capped by real block size and falls back to the whole block when needed.
- Reworked district parceling so dead-end streets contribute to lot splitting instead of only consuming build space.
- Fixed empty-district cases by adding a smaller emergency parcel scan when normal rectangular lots disappear after street clearance is applied; verified problematic seed `1245` now gives at least one building in every district.
- Reworked `buildingDensity` so it controls the percentage of available parcels that receive buildings rather than barely nudging per-block randomness.
- Verified through the UI that, for the same seed and street layout, `buildingDensity: 1` yields 101 buildings and `buildingDensity: 10` yields 192 buildings.
- Added `pathfinding/bfs.js` and `entities/character.js` so moving dot characters can pick reachable street-graph targets and travel node-to-node with deterministic trails.
- Wired character simulation into `main.js`, exposed requested/active character counts in `render_game_to_text`, and added a `Characters` slider to the UI.
- Updated `renderer/canvas.js` to draw glowing walkers and their recent movement trail above the city.
- Added a data-URL favicon to `index.html` to avoid browser 404 noise during local checks.
- Verified a clean browser run at `http://127.0.0.1:8082/index.html` with `node scripts/local_playwright_check.mjs http://127.0.0.1:8082/index.html output/web-game-characters`: screenshot saved to `output/web-game-characters/shot-0.png`, state saved to `output/web-game-characters/state-0.json`, and no console errors were recorded in the fresh output directory.

TODO
- Next likely milestone: character selection and click-to-set destination / follow behavior.
- Consider adding lightweight browser tests for BFS and deterministic character stepping so future interaction work is safer.
