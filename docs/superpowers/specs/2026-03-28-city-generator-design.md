# City Generator — Design Spec

**Date:** 2026-03-28
**Stage:** 1 — Procedural city map
**Tech:** Vanilla HTML/JavaScript, Canvas API, no external dependencies

---

## Overview

A procedurally generated top-down city map rendered on a `<canvas>`. The city is divided into color-coded districts by major streets. Secondary streets subdivide each district into blocks, some ending as dead ends. Buildings fill the blocks. Colored dot characters move along streets using BFS pathfinding.

Parameters are controlled via sliders (temporary UI); later they will be set from code.

---

## Visual Style

- **Look:** Top-down, clean flat geometry. Dark background (`#1a1a2e`), colored districts, gray streets.
- **Districts:** Each district has a unique base color applied to its background fill and buildings (darker shade).
- **Characters:** Colored dots with a fading trail (last 10 positions, decreasing opacity).
- **Canvas size:** Fixed 900×700px.

---

## File Structure

```
index.html
├── generator/
│   ├── rng.js          — Seeded RNG (mulberry32 algorithm)
│   ├── city.js         — generateCity(params) → CityData
│   ├── districts.js    — Major street layout, district bounds
│   ├── streets.js      — Secondary streets + dead ends per district
│   └── buildings.js    — Compound building generation per block
├── pathfinding/
│   └── bfs.js          — BFS on intersection graph
├── entities/
│   └── character.js    — Character state, target selection, path following
├── renderer/
│   └── canvas.js       — Stateless renderer: draw(CityData, Character[])
├── ui/
│   └── controls.js     — Sliders + Regenerate button
└── main.js             — requestAnimationFrame loop, initialization
```

---

## Data Model

### CityData

```js
{
  width: number,
  height: number,

  districts: [{
    id: number,
    color: string,           // base color hex, e.g. "#2d5a2d"
    bounds: { x, y, w, h }  // rectangle between major streets
  }],

  streets: [{
    x1, y1, x2, y2,
    width: number,           // major streets wider than secondary
    districtId: number | null // null = major street (district border)
  }],

  buildings: [{
    rects: [{ x, y, w, h }], // 1–3 rectangles forming one compound building
    districtId: number
  }],

  intersections: [{
    id: number,
    x, y,
    neighbors: [id, ...]     // adjacency list (graph edges)
  }]
}
```

### Character

```js
{
  pos: { x, y },        // current interpolated position
  from: intersectionId,
  to: intersectionId,
  path: [intersectionId], // BFS-computed route to target
  progress: 0..1,        // interpolation between from → to
  speed: number,
  color: string,
  trail: [{ x, y }]     // last 10 positions
}
```

---

## Generation Algorithm

### Step 1 — Major streets (district borders)

Compute grid dimensions: `rows = ceil(sqrt(numDistricts))`, `cols = ceil(numDistricts / rows)`. Place `rows-1` horizontal and `cols-1` vertical major streets. Each street position is offset by ±20% of the even spacing for visual variety (seeded RNG). This creates `rows × cols` grid cells — the actual number of districts is `rows × cols` (may differ slightly from the slider value, which only drives the grid shape).

### Step 2 — Secondary streets (inside districts)

For each district, generate additional horizontal and vertical lines based on `streetDensity`. Approximately 30% of secondary streets are dead ends — they terminate at a random point within the district instead of crossing it fully. Dead-end nodes have degree 1 in the intersection graph.

### Step 3 — Intersection graph

All street crossings (major × major, major × secondary, secondary × secondary) become graph nodes. Two nodes share an edge if they are on the same street segment with no intervening node between them. Dead-end street terminations also produce nodes.

### Step 4 — Buildings

For each rectangular block (area enclosed by streets), generate buildings based on `buildingDensity`. Each building:
1. Start with a base rectangle (random size, with margin from block edges)
2. With ~40% probability: add one annex rectangle attached to a random side of the base
3. With ~15% probability: add a second annex attached to a different side of the base (L, T, or U shape)

No component rectangle may extend outside the block boundary. All rectangles of a building share the district color (darkened).

### Step 5 — Characters

Each character is assigned a random start intersection. A random target intersection is selected; BFS computes the shortest path. When the character reaches its target, a new random target is chosen.

### Determinism

All randomness uses mulberry32 seeded RNG. Same seed + same parameters = identical map and identical initial character positions.

---

## Rendering Order

Each frame, `canvas.js` clears and redraws in order:

1. Canvas background (`#1a1a2e`)
2. District background fills (base color, slightly transparent)
3. Streets (gray rectangles; major streets wider)
4. Buildings (per-district darkened color; all component rects filled)
5. Characters (colored dot + fading trail)

The renderer is stateless — it receives `CityData` and `Character[]` and produces output with no side effects.

---

## UI

Temporary slider panel (to be replaced by code configuration later):

| Control | Range | Default |
|---|---|---|
| Seed | 0–99999 | 12345 |
| Districts | 2–12 | 4 |
| Street density | 1–10 | 5 |
| Building density | 1–10 | 5 |
| Characters | 1–50 | 10 |

**Regenerate** button: calls `generateCity(params)` and resets all characters. Changing any slider does not auto-regenerate — requires explicit button press.

---

## Pathfinding

BFS on the intersection graph. Each character stores its full computed path as an array of intersection IDs. Movement is interpolated between the current `from` and `to` nodes at a constant pixel-per-second speed. On arrival at `to`, the next node in `path` becomes the new `to`. On arrival at the final target, a new random target is chosen and BFS runs again.

Characters can enter dead-end streets (and must backtrack out via the same path).

---

## Out of Scope (Stage 1)

- Zoom / pan
- Named districts or character roles
- Collision between characters
- Responsive canvas sizing
- Audio
