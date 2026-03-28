# Fangs — Prototype

Procedurally generated city map built in plain HTML/JavaScript (no bundler, no framework).

## Stage 1 — City Generator

- Orthogonal street grid divided into color-coded districts
- Compound buildings (L/T/U shapes) filling city blocks
- Dead-end secondary streets
- Colored dot characters navigating via BFS pathfinding
- Seed-based deterministic generation

## Running

Open `index.html` via a local server (ES modules require HTTP):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Controls

| Slider | Description |
|---|---|
| Seed | Map seed — same value always produces the same city |
| Districts | Number of city districts |
| Street density | Secondary streets per district |
| Building density | Buildings per city block |
| Characters | Number of moving characters |

Click **Regenerate** to apply changes.

## Architecture

```
generator/     — Procedural city generation (districts, streets, buildings, graph)
pathfinding/   — BFS on intersection graph
entities/      — Character state and movement
renderer/      — Stateless Canvas renderer
ui/            — Slider controls
main.js        — Game loop
tests/         — Browser-based tests (open tests/index.html)
```

See `docs/superpowers/specs/` for the full design spec and `docs/superpowers/plans/` for the implementation plan.
