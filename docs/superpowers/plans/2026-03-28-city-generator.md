# City Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a procedurally generated top-down city map with colored districts, orthogonal streets (including dead ends), compound buildings, and dot characters that navigate via BFS pathfinding.

**Architecture:** Two-tier street grid — major streets divide the canvas into districts, secondary streets subdivide each district into blocks. All street crossings form an intersection graph; characters use BFS to find shortest paths between random targets.

**Tech Stack:** Vanilla HTML/JavaScript (ES modules), Canvas API, no external dependencies.

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | Canvas element, controls div, CSS layout |
| `generator/rng.js` | Seeded RNG (mulberry32) |
| `generator/districts.js` | Major streets + district bounds |
| `generator/streets.js` | Secondary streets + dead ends |
| `generator/graph.js` | Intersection graph from street list |
| `generator/buildings.js` | Compound building generation per block |
| `generator/city.js` | `generateCity(params)` orchestrator → CityData |
| `pathfinding/bfs.js` | BFS on intersection graph |
| `entities/character.js` | Character state, path following, target selection |
| `renderer/canvas.js` | Stateless frame renderer |
| `ui/controls.js` | Sliders + Regenerate button |
| `main.js` | Game loop, init, wiring |
| `tests/runner.js` | Minimal browser-based assert helpers |
| `tests/index.html` | Test page (open in browser, check console) |

---

## Internal data formats

**Street (internal, used by generator and graph builder):**
```js
{ type: 'h'|'v', pos, start, end, width, districtId: number|null, isDeadEnd: boolean }
// 'h': horizontal line at y=pos, spanning x=[start, end]
// 'v': vertical line at x=pos, spanning y=[start, end]
```

**Street (CityData, used by renderer):**
```js
{ x1, y1, x2, y2, width, districtId: number|null }
```

**Intersection node:**
```js
{ id: number, x, y, neighbors: number[] }  // neighbors = adjacency list of IDs
```

---

## Task 1: Project scaffold

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fangs — City Generator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a1a;
      color: #aaa;
      font-family: monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      gap: 12px;
      min-height: 100vh;
    }
    #controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      background: #111;
      padding: 12px 16px;
      border-radius: 4px;
      width: 900px;
    }
    .control-row { display: flex; align-items: center; gap: 8px; }
    .control-row label { font-size: 12px; white-space: nowrap; }
    .control-row input[type=range] { width: 100px; }
    #regenerate-btn {
      background: #3a3a6a;
      color: #aaa;
      border: 1px solid #4a4a8a;
      padding: 6px 14px;
      cursor: pointer;
      border-radius: 3px;
      font-family: monospace;
    }
    #regenerate-btn:hover { background: #4a4a8a; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="controls"></div>
  <canvas id="city-canvas"></canvas>
  <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Open in browser, verify empty page with dark background loads without console errors**

---

## Task 2: Seeded RNG

**Files:**
- Create: `generator/rng.js`
- Create: `tests/runner.js`
- Create: `tests/index.html`

- [ ] **Step 1: Create test runner**

```js
// tests/runner.js
let passed = 0;
let failed = 0;

export function assert(description, condition) {
  if (condition) {
    console.log(`✓ ${description}`);
    passed++;
  } else {
    console.error(`✗ ${description}`);
    failed++;
  }
}

export function summary() {
  console.log(`\n${passed} passed, ${failed} failed`);
}
```

- [ ] **Step 2: Create test page skeleton**

```html
<!-- tests/index.html -->
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Tests</title></head>
<body>
  <p style="font-family:monospace;padding:16px">Open browser console to see test results.</p>
  <script type="module">
    import { summary } from './runner.js';
    // RNG tests
    import './test-rng.js';
    // BFS tests added in Task 8
    // Graph tests added in Task 5
    setTimeout(summary, 100);
  </script>
</body>
</html>
```

- [ ] **Step 3: Write failing RNG tests**

```js
// tests/test-rng.js
import { assert } from './runner.js';
import { createRNG } from '../generator/rng.js';

const rng = createRNG(42);
const values = Array.from({ length: 1000 }, () => rng.random());

assert('all values in [0, 1)', values.every(v => v >= 0 && v < 1));
assert('not all the same', new Set(values).size > 900);

// Same seed = same sequence
const a = createRNG(99);
const b = createRNG(99);
assert('same seed produces same sequence', a.random() === b.random() && a.random() === b.random());

// Different seeds differ
const c = createRNG(1);
const d = createRNG(2);
assert('different seeds produce different values', c.random() !== d.random());

// int stays in range
const rng2 = createRNG(7);
const ints = Array.from({ length: 100 }, () => rng2.int(3, 7));
assert('int() stays within [min, max]', ints.every(v => v >= 3 && v <= 7));

// chance() returns boolean
const rng3 = createRNG(13);
assert('chance(0) always false', !rng3.chance(0));
assert('chance(1) always true', rng3.chance(1));
```

- [ ] **Step 4: Open tests/index.html, verify all tests FAIL (module not found)**

- [ ] **Step 5: Implement generator/rng.js**

```js
// generator/rng.js
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export function createRNG(seed) {
  const rand = mulberry32(seed);
  return {
    random() { return rand(); },
    int(min, max) { return Math.floor(rand() * (max - min + 1)) + min; },
    float(min, max) { return rand() * (max - min) + min; },
    chance(p) { return rand() < p; },
  };
}
```

- [ ] **Step 6: Reload tests/index.html, verify all RNG tests pass**

- [ ] **Step 7: Commit**

```bash
git init
git add index.html generator/rng.js tests/runner.js tests/index.html tests/test-rng.js
git commit -m "feat: project scaffold, seeded RNG, test runner"
```

---

## Task 3: District generation

**Files:**
- Create: `generator/districts.js`

- [ ] **Step 1: Implement generator/districts.js**

```js
// generator/districts.js
const MAJOR_STREET_WIDTH = 8;

const DISTRICT_COLORS = [
  '#2d5a27', '#5a2727', '#27455a', '#5a4a27',
  '#4a275a', '#275a4a', '#5a5a27', '#27275a',
  '#5a2745', '#275a27', '#45275a', '#5a3727',
];

// Returns evenly-spaced divider positions with ±20% jitter.
// positions[0] = 0, positions[count] = total.
function dividers(rng, count, total) {
  const positions = [0];
  const step = total / count;
  for (let i = 1; i < count; i++) {
    const base = step * i;
    const jitter = step * 0.2;
    positions.push(base + rng.float(-jitter, jitter));
  }
  positions.push(total);
  return positions;
}

// Returns { districts, majorStreets }
// districts: [{ id, color, bounds: { x, y, w, h } }]
// majorStreets: internal street format [{ type, pos, start, end, width, districtId, isDeadEnd }]
export function generateDistricts(rng, width, height, numDistricts) {
  const rows = Math.ceil(Math.sqrt(numDistricts));
  const cols = Math.ceil(numDistricts / rows);

  const xs = dividers(rng, cols, width);
  const ys = dividers(rng, rows, height);

  const districts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      districts.push({
        id: r * cols + c,
        color: DISTRICT_COLORS[(r * cols + c) % DISTRICT_COLORS.length],
        bounds: {
          x: xs[c],
          y: ys[r],
          w: xs[c + 1] - xs[c],
          h: ys[r + 1] - ys[r],
        },
      });
    }
  }

  // Border streets along all four canvas edges.
  // These ensure every district boundary has a street, so dead-end secondary
  // streets that start at a canvas-edge boundary always connect to the graph.
  const majorStreets = [
    { type: 'h', pos: 0,      start: 0, end: width,  width: MAJOR_STREET_WIDTH, districtId: null, isDeadEnd: false },
    { type: 'h', pos: height, start: 0, end: width,  width: MAJOR_STREET_WIDTH, districtId: null, isDeadEnd: false },
    { type: 'v', pos: 0,      start: 0, end: height, width: MAJOR_STREET_WIDTH, districtId: null, isDeadEnd: false },
    { type: 'v', pos: width,  start: 0, end: height, width: MAJOR_STREET_WIDTH, districtId: null, isDeadEnd: false },
  ];
  for (let c = 1; c < cols; c++) {
    majorStreets.push({
      type: 'v', pos: xs[c], start: 0, end: height,
      width: MAJOR_STREET_WIDTH, districtId: null, isDeadEnd: false,
    });
  }
  for (let r = 1; r < rows; r++) {
    majorStreets.push({
      type: 'h', pos: ys[r], start: 0, end: width,
      width: MAJOR_STREET_WIDTH, districtId: null, isDeadEnd: false,
    });
  }

  return { districts, majorStreets };
}
```

- [ ] **Step 2: Add a quick smoke test in tests/index.html (add after the RNG import)**

```js
// tests/test-districts.js
import { assert } from './runner.js';
import { createRNG } from '../generator/rng.js';
import { generateDistricts } from '../generator/districts.js';

const rng = createRNG(42);
const { districts, majorStreets } = generateDistricts(rng, 900, 700, 4);

assert('generates 4 districts for numDistricts=4', districts.length === 4);
assert('all districts have valid bounds', districts.every(d =>
  d.bounds.w > 0 && d.bounds.h > 0
));
assert('majorStreets exist (at least 4 border streets)', majorStreets.length >= 4);
assert('all major streets span canvas', majorStreets.every(s =>
  s.start === 0 && (s.end === 900 || s.end === 700)
));
```

Add to tests/index.html:
```js
import './test-districts.js';
```

- [ ] **Step 3: Reload tests/index.html, verify district tests pass**

- [ ] **Step 4: Commit**

```bash
git add generator/districts.js tests/test-districts.js tests/index.html
git commit -m "feat: district generation with major streets"
```

---

## Task 4: Secondary streets with dead ends

**Files:**
- Create: `generator/streets.js`

- [ ] **Step 1: Implement generator/streets.js**

```js
// generator/streets.js
const SECONDARY_STREET_WIDTH = 4;
const DEAD_END_CHANCE = 0.3;

// Returns internal street format array for secondary streets.
// streetDensity = number of secondary streets per axis per district.
export function generateSecondaryStreets(rng, districts, streetDensity) {
  const streets = [];

  for (const district of districts) {
    const { x, y, w, h } = district.bounds;

    for (let i = 0; i < streetDensity; i++) {
      // Horizontal secondary street
      const posY = y + rng.float(0.1, 0.9) * h;
      if (rng.chance(DEAD_END_CHANCE)) {
        const endX = x + rng.float(0.3, 0.8) * w;
        streets.push({
          type: 'h', pos: posY, start: x, end: endX,
          width: SECONDARY_STREET_WIDTH, districtId: district.id, isDeadEnd: true,
        });
      } else {
        streets.push({
          type: 'h', pos: posY, start: x, end: x + w,
          width: SECONDARY_STREET_WIDTH, districtId: district.id, isDeadEnd: false,
        });
      }

      // Vertical secondary street
      const posX = x + rng.float(0.1, 0.9) * w;
      if (rng.chance(DEAD_END_CHANCE)) {
        const endY = y + rng.float(0.3, 0.8) * h;
        streets.push({
          type: 'v', pos: posX, start: y, end: endY,
          width: SECONDARY_STREET_WIDTH, districtId: district.id, isDeadEnd: true,
        });
      } else {
        streets.push({
          type: 'v', pos: posX, start: y, end: y + h,
          width: SECONDARY_STREET_WIDTH, districtId: district.id, isDeadEnd: false,
        });
      }
    }
  }

  return streets;
}
```

- [ ] **Step 2: Commit**

```bash
git add generator/streets.js
git commit -m "feat: secondary streets with dead-end generation"
```

---

## Task 5: Intersection graph

**Files:**
- Create: `generator/graph.js`

- [ ] **Step 1: Write failing graph tests**

```js
// tests/test-graph.js
import { assert } from './runner.js';
import { createRNG } from '../generator/rng.js';
import { generateDistricts } from '../generator/districts.js';
import { generateSecondaryStreets } from '../generator/streets.js';
import { buildGraph } from '../generator/graph.js';

const rng = createRNG(42);
const { districts, majorStreets } = generateDistricts(rng, 900, 700, 4);
const secondary = generateSecondaryStreets(rng, districts, 2);
const allStreets = [...majorStreets, ...secondary];
const intersections = buildGraph(allStreets);

assert('graph has nodes', intersections.length > 0);
assert('all node IDs match their array index', intersections.every((n, i) => n.id === i));
assert('all neighbors reference valid node IDs', intersections.every(n =>
  n.neighbors.every(nid => nid >= 0 && nid < intersections.length)
));
assert('neighbor relationships are symmetric', intersections.every(n =>
  n.neighbors.every(nid => intersections[nid].neighbors.includes(n.id))
));

// Dead-end nodes have exactly 1 neighbor
const deadEndNodes = intersections.filter(n => n.neighbors.length === 1);
assert('dead-end nodes exist when dead ends are generated', deadEndNodes.length > 0);
```

Add to tests/index.html:
```js
import './test-graph.js';
```

- [ ] **Step 2: Open tests/index.html, verify graph tests FAIL**

- [ ] **Step 3: Implement generator/graph.js**

```js
// generator/graph.js

// Accepts allStreets in internal format ({ type, pos, start, end, ... }).
// Returns intersections array: [{ id, x, y, neighbors: [id,...] }]
// Nodes are indexed by ID: intersections[id].id === id always.
export function buildGraph(allStreets) {
  const hStreets = allStreets.filter(s => s.type === 'h');
  const vStreets = allStreets.filter(s => s.type === 'v');

  const pointMap = new Map();
  const nodes = [];
  let nextId = 0;

  function key(x, y) {
    return `${Math.round(x)},${Math.round(y)}`;
  }

  function getOrCreate(x, y) {
    const k = key(x, y);
    if (!pointMap.has(k)) {
      const node = { id: nextId++, x, y, neighbors: [] };
      pointMap.set(k, node);
      nodes.push(node);
    }
    return pointMap.get(k);
  }

  // Create nodes at every crossing of a horizontal and a vertical street
  for (const h of hStreets) {
    for (const v of vStreets) {
      const crossX = v.pos;
      const crossY = h.pos;
      const onH = crossX >= h.start - 0.5 && crossX <= h.end + 0.5;
      const onV = crossY >= v.start - 0.5 && crossY <= v.end + 0.5;
      if (onH && onV) {
        getOrCreate(crossX, crossY);
      }
    }
    // Dead-end termination node
    if (h.isDeadEnd) {
      getOrCreate(h.end, h.pos);
    }
  }
  for (const v of vStreets) {
    if (v.isDeadEnd) {
      getOrCreate(v.pos, v.end);
    }
  }

  // Build edges: for each street find all nodes lying on it,
  // sort by position, connect adjacent pairs.
  function connectNodesOnStreet(street) {
    let onStreet;
    if (street.type === 'h') {
      onStreet = nodes
        .filter(n => Math.abs(n.y - street.pos) < 0.5
                  && n.x >= street.start - 0.5
                  && n.x <= street.end + 0.5)
        .sort((a, b) => a.x - b.x);
    } else {
      onStreet = nodes
        .filter(n => Math.abs(n.x - street.pos) < 0.5
                  && n.y >= street.start - 0.5
                  && n.y <= street.end + 0.5)
        .sort((a, b) => a.y - b.y);
    }
    for (let i = 0; i < onStreet.length - 1; i++) {
      const a = onStreet[i];
      const b = onStreet[i + 1];
      if (!a.neighbors.includes(b.id)) {
        a.neighbors.push(b.id);
        b.neighbors.push(a.id);
      }
    }
  }

  for (const s of allStreets) {
    connectNodesOnStreet(s);
  }

  return nodes;
}
```

- [ ] **Step 4: Reload tests/index.html, verify all graph tests pass**

- [ ] **Step 5: Commit**

```bash
git add generator/graph.js tests/test-graph.js tests/index.html
git commit -m "feat: intersection graph builder from street network"
```

---

## Task 6: Building generation

**Files:**
- Create: `generator/buildings.js`

- [ ] **Step 1: Implement generator/buildings.js**

```js
// generator/buildings.js
const BLOCK_MARGIN = 6;
const MIN_BUILDING_SIZE = 10;

// Darkens a hex color by multiplying RGB by factor.
function darken(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = v => Math.max(0, Math.round(v * factor)).toString(16).padStart(2, '0');
  return `#${d(r)}${d(g)}${d(b)}`;
}

// Attempts to create one annex rectangle attached to base, within block bounds.
// Returns null if annex would fall outside bounds.
function makeAnnex(rng, base, blockX, blockY, blockW, blockH, excludeSide) {
  const sides = ['top', 'bottom', 'left', 'right'].filter(s => s !== excludeSide);
  const side = sides[rng.int(0, sides.length - 1)];
  const aw = rng.float(base.w * 0.2, base.w * 0.6);
  const ah = rng.float(base.h * 0.2, base.h * 0.6);

  let ax, ay;
  if (side === 'top')    { ax = base.x + rng.float(0, Math.max(0, base.w - aw)); ay = base.y - ah; }
  if (side === 'bottom') { ax = base.x + rng.float(0, Math.max(0, base.w - aw)); ay = base.y + base.h; }
  if (side === 'left')   { ax = base.x - aw; ay = base.y + rng.float(0, Math.max(0, base.h - ah)); }
  if (side === 'right')  { ax = base.x + base.w; ay = base.y + rng.float(0, Math.max(0, base.h - ah)); }

  const m = BLOCK_MARGIN;
  if (ax < blockX + m || ay < blockY + m ||
      ax + aw > blockX + blockW - m || ay + ah > blockY + blockH - m) {
    return null;
  }
  return { x: ax, y: ay, w: aw, h: ah, _side: side };
}

// Tries to place one compound building in a block.
// Returns { rects, color, districtId } or null if block is too small.
function tryPlaceBuilding(rng, blockX, blockY, blockW, blockH, color, districtId) {
  const m = BLOCK_MARGIN;
  const innerW = blockW - 2 * m;
  const innerH = blockH - 2 * m;
  if (innerW < MIN_BUILDING_SIZE * 2 || innerH < MIN_BUILDING_SIZE * 2) return null;

  const maxW = Math.min(innerW * 0.65, innerW);
  const maxH = Math.min(innerH * 0.65, innerH);
  const bw = rng.float(MIN_BUILDING_SIZE, maxW);
  const bh = rng.float(MIN_BUILDING_SIZE, maxH);
  const bx = blockX + m + rng.float(0, innerW - bw);
  const by = blockY + m + rng.float(0, innerH - bh);
  const base = { x: bx, y: by, w: bw, h: bh };

  const rects = [base];

  if (rng.chance(0.4)) {
    const annex1 = makeAnnex(rng, base, blockX, blockY, blockW, blockH, null);
    if (annex1) {
      rects.push(annex1);
      if (rng.chance(0.375)) { // 0.4 * 0.375 ≈ 0.15 of all buildings
        const annex2 = makeAnnex(rng, base, blockX, blockY, blockW, blockH, annex1._side);
        if (annex2) rects.push(annex2);
      }
    }
  }

  return { rects: rects.map(({ x, y, w, h }) => ({ x, y, w, h })), color, districtId };
}

// Generates buildings for all districts.
// allStreets: internal format (used to find block boundaries).
// buildingDensity: number of building placement attempts per block.
export function generateBuildings(rng, districts, allStreets, buildingDensity) {
  const buildings = [];

  for (const district of districts) {
    const { x, y, w, h } = district.bounds;
    const color = darken(district.color, 0.7);

    // X dividers inside this district from through-going vertical secondary streets
    const xDivs = [
      x,
      ...allStreets
        .filter(s => s.type === 'v' && s.districtId === district.id && !s.isDeadEnd)
        .map(s => s.pos)
        .sort((a, b) => a - b),
      x + w,
    ];

    // Y dividers inside this district from through-going horizontal secondary streets
    const yDivs = [
      y,
      ...allStreets
        .filter(s => s.type === 'h' && s.districtId === district.id && !s.isDeadEnd)
        .map(s => s.pos)
        .sort((a, b) => a - b),
      y + h,
    ];

    for (let ri = 0; ri < yDivs.length - 1; ri++) {
      for (let ci = 0; ci < xDivs.length - 1; ci++) {
        const bx = xDivs[ci];
        const by = yDivs[ri];
        const bw = xDivs[ci + 1] - bx;
        const bh = yDivs[ri + 1] - by;

        for (let attempt = 0; attempt < buildingDensity; attempt++) {
          const building = tryPlaceBuilding(rng, bx, by, bw, bh, color, district.id);
          if (building) buildings.push(building);
        }
      }
    }
  }

  return buildings;
}
```

- [ ] **Step 2: Commit**

```bash
git add generator/buildings.js
git commit -m "feat: compound building generation"
```

---

## Task 7: City generator orchestrator

**Files:**
- Create: `generator/city.js`

- [ ] **Step 1: Implement generator/city.js**

```js
// generator/city.js
import { createRNG } from './rng.js';
import { generateDistricts } from './districts.js';
import { generateSecondaryStreets } from './streets.js';
import { generateBuildings } from './buildings.js';
import { buildGraph } from './graph.js';

// Converts internal street format to renderer format.
function toRendererStreet(s) {
  return s.type === 'h'
    ? { x1: s.start, y1: s.pos, x2: s.end,   y2: s.pos, width: s.width, districtId: s.districtId }
    : { x1: s.pos,   y1: s.start, x2: s.pos, y2: s.end,  width: s.width, districtId: s.districtId };
}

// params: { seed, numDistricts, streetDensity, buildingDensity, width, height }
// Returns CityData: { width, height, districts, streets, buildings, intersections }
export function generateCity(params) {
  const { seed, numDistricts, streetDensity, buildingDensity, width, height } = params;
  const rng = createRNG(seed);

  const { districts, majorStreets } = generateDistricts(rng, width, height, numDistricts);
  const secondaryStreets = generateSecondaryStreets(rng, districts, streetDensity);
  const allStreets = [...majorStreets, ...secondaryStreets];

  const intersections = buildGraph(allStreets);
  const buildings = generateBuildings(rng, districts, allStreets, buildingDensity);

  return {
    width,
    height,
    districts,
    streets: allStreets.map(toRendererStreet),
    buildings,
    intersections,
  };
}
```

- [ ] **Step 2: Add smoke test for generateCity**

```js
// tests/test-city.js
import { assert } from './runner.js';
import { generateCity } from '../generator/city.js';

const city = generateCity({
  seed: 42, numDistricts: 4, streetDensity: 2,
  buildingDensity: 2, width: 900, height: 700,
});

assert('city has districts', city.districts.length > 0);
assert('city has streets', city.streets.length > 0);
assert('city has buildings', city.buildings.length > 0);
assert('city has intersections', city.intersections.length > 0);
assert('streets have x1/y1/x2/y2', city.streets.every(s =>
  'x1' in s && 'y1' in s && 'x2' in s && 'y2' in s
));
assert('same seed = same district count', (() => {
  const c2 = generateCity({ seed: 42, numDistricts: 4, streetDensity: 2, buildingDensity: 2, width: 900, height: 700 });
  return city.districts.length === c2.districts.length && city.intersections.length === c2.intersections.length;
})());
```

Add to tests/index.html:
```js
import './test-city.js';
```

- [ ] **Step 3: Reload tests/index.html, verify city tests pass**

- [ ] **Step 4: Commit**

```bash
git add generator/city.js tests/test-city.js tests/index.html
git commit -m "feat: city generator orchestrator"
```

---

## Task 8: BFS pathfinding

**Files:**
- Create: `pathfinding/bfs.js`

- [ ] **Step 1: Write failing BFS tests**

```js
// tests/test-bfs.js
import { assert } from './runner.js';
import { bfs } from '../pathfinding/bfs.js';

// Simple test graph: 0 -- 1 -- 2 -- 3, with dead end 4 off node 1
//
//  0 - 1 - 2 - 3
//      |
//      4
const graph = [
  { id: 0, x: 0,   y: 0, neighbors: [1] },
  { id: 1, x: 100, y: 0, neighbors: [0, 2, 4] },
  { id: 2, x: 200, y: 0, neighbors: [1, 3] },
  { id: 3, x: 300, y: 0, neighbors: [2] },
  { id: 4, x: 100, y: 100, neighbors: [1] },
];

const path03 = bfs(graph, 0, 3);
assert('finds path from 0 to 3', path03 !== null);
assert('path from 0 to 3 is [0,1,2,3]', JSON.stringify(path03) === JSON.stringify([0, 1, 2, 3]));

const path30 = bfs(graph, 3, 0);
assert('finds path from 3 to 0', path30 !== null);
assert('path from 3 to 0 is [3,2,1,0]', JSON.stringify(path30) === JSON.stringify([3, 2, 1, 0]));

const pathSelf = bfs(graph, 2, 2);
assert('path to self is [2]', JSON.stringify(pathSelf) === JSON.stringify([2]));

const path04 = bfs(graph, 0, 4);
assert('finds path to dead-end node 4: [0,1,4]', JSON.stringify(path04) === JSON.stringify([0, 1, 4]));

// Disconnected graph
const disconnected = [
  { id: 0, x: 0, y: 0, neighbors: [1] },
  { id: 1, x: 1, y: 0, neighbors: [0] },
  { id: 2, x: 2, y: 0, neighbors: [] }, // isolated
];
assert('returns null for disconnected nodes', bfs(disconnected, 0, 2) === null);
```

Add to tests/index.html:
```js
import './test-bfs.js';
```

- [ ] **Step 2: Reload tests/index.html, verify BFS tests FAIL**

- [ ] **Step 3: Implement pathfinding/bfs.js**

```js
// pathfinding/bfs.js

// Finds the shortest path from startId to targetId in the intersection graph.
// intersections: array where intersections[id] is the node with that ID.
// Returns array of node IDs forming the path, or null if no path exists.
export function bfs(intersections, startId, targetId) {
  if (startId === targetId) return [startId];

  const prev = new Map([[startId, undefined]]);
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighborId of intersections[current].neighbors) {
      if (!prev.has(neighborId)) {
        prev.set(neighborId, current);
        if (neighborId === targetId) {
          // Reconstruct path by walking prev chain back to start
          const path = [];
          let cur = targetId;
          while (cur !== undefined) {
            path.unshift(cur);
            cur = prev.get(cur);
          }
          return path;
        }
        queue.push(neighborId);
      }
    }
  }

  return null;
}
```

- [ ] **Step 4: Reload tests/index.html, verify all BFS tests pass**

- [ ] **Step 5: Commit**

```bash
git add pathfinding/bfs.js tests/test-bfs.js tests/index.html
git commit -m "feat: BFS pathfinding on intersection graph"
```

---

## Task 9: Character entity

**Files:**
- Create: `entities/character.js`

- [ ] **Step 1: Implement entities/character.js**

```js
// entities/character.js
import { bfs } from '../pathfinding/bfs.js';

const TRAIL_LENGTH = 10;
const CHARACTER_COLORS = [
  '#ff6b6b', '#6bffb8', '#ffd06b',
  '#6bb8ff', '#ff6bff', '#b8ff6b',
];

function pickNewTarget(char, intersections) {
  let targetId;
  let attempts = 0;
  do {
    targetId = Math.floor(Math.random() * intersections.length);
    attempts++;
  } while (targetId === char.from && attempts < 20);

  const path = bfs(intersections, char.from, targetId);
  if (path && path.length > 1) {
    char.path = path.slice(1); // first element is current node, already there
    char.to = char.path[0];
    char.progress = 0;
  }
}

// rng: seeded RNG used only for initial placement (speed, color, start node).
// colorIndex: integer to pick from CHARACTER_COLORS cyclically.
export function createCharacter(intersections, rng, colorIndex) {
  if (intersections.length === 0) throw new Error('Cannot create character: no intersections');
  const startId = rng.int(0, intersections.length - 1);
  const char = {
    pos: { x: intersections[startId].x, y: intersections[startId].y },
    from: startId,
    to: startId,
    path: [],
    progress: 0,
    speed: rng.float(40, 100), // pixels per second
    color: CHARACTER_COLORS[colorIndex % CHARACTER_COLORS.length],
    trail: [],
  };
  pickNewTarget(char, intersections);
  return char;
}

// dt: seconds elapsed since last frame (capped externally to avoid large jumps).
export function updateCharacter(char, dt, intersections) {
  if (char.path.length === 0) {
    pickNewTarget(char, intersections);
    return;
  }

  const fromNode = intersections[char.from];
  const toNode = intersections[char.to];
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const segmentLength = Math.sqrt(dx * dx + dy * dy);

  if (segmentLength < 0.1) {
    // Zero-length segment (duplicate nodes): skip immediately
    char.from = char.to;
    char.path.shift();
    char.to = char.path.length > 0 ? char.path[0] : char.from;
    return;
  }

  // Record current position to trail before moving
  char.trail.push({ x: char.pos.x, y: char.pos.y });
  if (char.trail.length > TRAIL_LENGTH) char.trail.shift();

  char.progress += (char.speed * dt) / segmentLength;

  if (char.progress >= 1) {
    // Arrived at next node
    char.from = char.to;
    char.path.shift();
    char.pos.x = intersections[char.from].x;
    char.pos.y = intersections[char.from].y;
    char.progress = 0;

    if (char.path.length > 0) {
      char.to = char.path[0];
    } else {
      pickNewTarget(char, intersections);
    }
  } else {
    char.pos.x = fromNode.x + dx * char.progress;
    char.pos.y = fromNode.y + dy * char.progress;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add entities/character.js
git commit -m "feat: character entity with BFS path following"
```

---

## Task 10: Canvas renderer

**Files:**
- Create: `renderer/canvas.js`

- [ ] **Step 1: Implement renderer/canvas.js**

```js
// renderer/canvas.js

// Converts a hex string + 0-255 alpha integer to rgba string.
function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${(alpha / 255).toFixed(2)})`;
}

// Stateless renderer. Call once per frame.
// cityData: CityData from generateCity()
// characters: Character[] from createCharacter()
export function render(ctx, cityData, characters) {
  const { width, height, districts, streets, buildings } = cityData;

  // 1. Canvas background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // 2. District background fills (base color at low opacity)
  for (const district of districts) {
    const { x, y, w, h } = district.bounds;
    ctx.fillStyle = hexAlpha(district.color, 40);
    ctx.fillRect(x, y, w, h);
  }

  // 3. Streets
  ctx.lineCap = 'square';
  for (const street of streets) {
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = street.width;
    ctx.beginPath();
    ctx.moveTo(street.x1, street.y1);
    ctx.lineTo(street.x2, street.y2);
    ctx.stroke();
  }

  // 4. Buildings
  for (const building of buildings) {
    ctx.fillStyle = building.color;
    for (const rect of building.rects) {
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  // 5. Characters: fading trail then solid dot
  for (const char of characters) {
    for (let i = 0; i < char.trail.length; i++) {
      const t = i / char.trail.length; // 0 = oldest, 1 = newest
      const alpha = Math.round(t * 100); // max ~40% opacity
      const radius = 2 + t * 2;
      ctx.fillStyle = hexAlpha(char.color, alpha);
      ctx.beginPath();
      ctx.arc(char.trail[i].x, char.trail[i].y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Main dot
    ctx.fillStyle = char.color;
    ctx.beginPath();
    ctx.arc(char.pos.x, char.pos.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add renderer/canvas.js
git commit -m "feat: stateless Canvas renderer"
```

---

## Task 11: UI controls

**Files:**
- Create: `ui/controls.js`

- [ ] **Step 1: Implement ui/controls.js**

```js
// ui/controls.js

const SLIDER_DEFS = [
  { key: 'seed',           label: 'Seed',             min: 0,  max: 99999, step: 1,  default: 12345 },
  { key: 'numDistricts',   label: 'Districts',         min: 2,  max: 12,    step: 1,  default: 4 },
  { key: 'streetDensity',  label: 'Street density',    min: 1,  max: 10,    step: 1,  default: 3 },
  { key: 'buildingDensity',label: 'Building density',  min: 1,  max: 10,    step: 1,  default: 3 },
  { key: 'numCharacters',  label: 'Characters',        min: 1,  max: 50,    step: 1,  default: 10 },
];

// Appends sliders and a Regenerate button to #controls.
// onRegenerate(params) is called with current slider values on button click.
// Returns the initial params object.
export function initControls(onRegenerate) {
  const container = document.getElementById('controls');
  const params = Object.fromEntries(SLIDER_DEFS.map(d => [d.key, d.default]));

  for (const def of SLIDER_DEFS) {
    const row = document.createElement('div');
    row.className = 'control-row';

    const valueSpan = document.createElement('span');
    valueSpan.textContent = params[def.key];

    const label = document.createElement('label');
    label.append(`${def.label}: `, valueSpan);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = def.min;
    input.max = def.max;
    input.step = def.step;
    input.value = params[def.key];
    input.addEventListener('input', () => {
      params[def.key] = Number(input.value);
      valueSpan.textContent = input.value;
    });

    row.append(label, input);
    container.appendChild(row);
  }

  const btn = document.createElement('button');
  btn.id = 'regenerate-btn';
  btn.textContent = 'Regenerate';
  btn.addEventListener('click', () => onRegenerate({ ...params }));
  container.appendChild(btn);

  return { ...params };
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/controls.js
git commit -m "feat: slider UI controls"
```

---

## Task 12: Main game loop — wire everything

**Files:**
- Create: `main.js`

- [ ] **Step 1: Implement main.js**

```js
// main.js
import { generateCity } from './generator/city.js';
import { createRNG } from './generator/rng.js';
import { createCharacter, updateCharacter } from './entities/character.js';
import { render } from './renderer/canvas.js';
import { initControls } from './ui/controls.js';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;

const canvas = document.getElementById('city-canvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let cityData = null;
let characters = [];
let lastTimestamp = null;

function regenerate(params) {
  cityData = generateCity({
    seed: params.seed,
    numDistricts: params.numDistricts,
    streetDensity: params.streetDensity,
    buildingDensity: params.buildingDensity,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });

  // Use a separate seed for character placement so it is independent of map params.
  const charRng = createRNG(params.seed + 999999);
  characters = Array.from(
    { length: params.numCharacters },
    (_, i) => createCharacter(cityData.intersections, charRng, i),
  );
}

function loop(timestamp) {
  const dt = lastTimestamp !== null
    ? Math.min((timestamp - lastTimestamp) / 1000, 0.1) // cap dt at 100ms
    : 0;
  lastTimestamp = timestamp;

  if (cityData) {
    for (const char of characters) {
      updateCharacter(char, dt, cityData.intersections);
    }
    render(ctx, cityData, characters);
  }

  requestAnimationFrame(loop);
}

const initialParams = initControls(regenerate);
regenerate(initialParams);
requestAnimationFrame(loop);
```

- [ ] **Step 2: Open index.html in browser (via local server), verify:**
  - Dark page loads with slider panel and canvas
  - City map is visible with colored districts, streets, and buildings
  - Colored dots move along streets
  - Changing sliders + clicking Regenerate produces a new map
  - Same seed always produces the same initial map

- [ ] **Step 3: Verify dead ends are visible** — zoom into the map and confirm some streets terminate mid-block rather than crossing the full district.

- [ ] **Step 4: Verify compound buildings** — some buildings should have visible L or T shapes composed of multiple rectangles.

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat: main game loop, complete Stage 1 city generator"
```

---

## Known limitations (acceptable for Stage 1)

- Buildings within the same block may overlap each other
- Characters on isolated graph components (if any) will not move
- No zoom or pan
- Canvas is fixed at 900×700px
