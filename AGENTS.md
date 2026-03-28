# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Procedurally generated city map in plain HTML/JavaScript (no bundler, no framework). Built in stages:

- **Stage 1 (current):** Procedural map generation — streets, buildings, and symbolic characters moving through the city.

## Development

The project runs as a static HTML file — open `index.html` directly in a browser or use a simple local server:

```bash
# Quick local server (Python)
python3 -m http.server 8080

# Alternative (Node.js)
npx serve .
```

No build step, no linting, no automated tests — verification is done visually in the browser.

## Architecture

Vanilla JS with no external dependencies. Rendering via Canvas API (`<canvas>`).

### Planned module structure (ES modules or separate scripts)

- **generator/city.js** — core procedural generation logic: city block layout, street grid
- **generator/buildings.js** — building generation per block (size, shape, color)
- **entities/character.js** — symbolic characters, their state and pathfinding along streets
- **renderer/canvas.js** — drawing the map and characters onto the Canvas
- **main.js** — game loop (`requestAnimationFrame`), initialization, module orchestration

### Key architectural principles

- Deterministic generation (seed-based random) — same seed = same map
- Strict separation of generation logic from rendering
- Characters move only along streets (graph of intersection nodes)
- Streets form either a grid or organic layout — decision to be made in Stage 1
