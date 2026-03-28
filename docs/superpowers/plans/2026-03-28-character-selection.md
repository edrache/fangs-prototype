# Character Selection & Action Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the player to click a character on the canvas, choose "Choose destination" from a popup menu, then click a point on the map or another character to set a travel target (one-shot or follow/chase).

**Architecture:** New `ui/interaction.js` module owns the three-state interaction machine (`idle | menu_open | picking_destination`) and canvas event handlers. `renderer/canvas.js` gains a new topmost layer for selection ring, menu, destination highlights, and cursor. `entities/character.js` gets `id` and `destination` fields plus follow logic. `main.js` wires them together.

**Tech Stack:** Vanilla HTML/JavaScript (ES modules), Canvas API, no external dependencies.

**Prerequisite:** Stage 1 implementation complete (all files from `docs/superpowers/plans/2026-03-28-city-generator.md` implemented and working).

---

## File Map

| File | Change |
|---|---|
| `entities/character.js` | Add `id`, `destination` fields; follow/node logic in `updateCharacter` |
| `ui/interaction.js` | **new** — `InteractionController`, pure helpers, menu constants |
| `renderer/canvas.js` | Add layer 6: ring, menu, destination highlights, cursor |
| `main.js` | Wire `InteractionController`, pass `interactionState` + `timestamp` to `render` |
| `tests/test-character-destination.js` | **new** — destination logic tests |
| `tests/test-interaction.js` | **new** — helper function tests |
| `tests/index.html` | Add imports for new test files |

---

## Internal data formats

**Destination field on Character:**
```js
destination: {
  type: 'node',
  nodeId: number          // id of intersection to travel to (one-shot)
} | {
  type: 'character',
  characterId: number     // id of character to chase
} | null                  // autonomous random movement (default)
```

**InteractionState snapshot (returned by `getState()`, passed to renderer):**
```js
{
  mode: 'idle' | 'menu_open' | 'picking_destination',
  selectedCharacterId: number | null,
  hoveredCharacterId: number | null,
  hoveredMenuItemIndex: number | null,  // index into MENU_ITEMS, or null
  mousePos: { x, y } | null,
}
```

---

## Task 1: Add `id` and `destination` to Character

**Files:**
- Modify: `entities/character.js`

- [ ] **Step 1: Add `id` and `destination` to the character object in `createCharacter`**

The `colorIndex` parameter already equals the character's index in the array (main.js uses `(_, i) => createCharacter(..., i)`), so use it as a stable id.

```js
export function createCharacter(intersections, rng, colorIndex) {
  if (intersections.length === 0) throw new Error('Cannot create character: no intersections');
  const startId = rng.int(0, intersections.length - 1);
  const char = {
    id: colorIndex,
    pos: { x: intersections[startId].x, y: intersections[startId].y },
    from: startId,
    to: startId,
    path: [],
    progress: 0,
    speed: rng.float(40, 100),
    color: CHARACTER_COLORS[colorIndex % CHARACTER_COLORS.length],
    trail: [],
    destination: null,
  };
  pickNewTarget(char, intersections);
  return char;
}
```

- [ ] **Step 2: Add `characters` parameter (default `[]`) to `updateCharacter`**

Change the function signature only — body is unchanged in this task:

```js
export function updateCharacter(char, dt, intersections, characters = []) {
```

- [ ] **Step 3: Commit**

```bash
git add entities/character.js
git commit -m "feat: add id and destination fields to Character"
```

---

## Task 2: Node destination logic

**Files:**
- Modify: `entities/character.js`
- Create: `tests/test-character-destination.js`
- Modify: `tests/index.html`

- [ ] **Step 1: Create test file**

```js
// tests/test-character-destination.js
import { assert } from './runner.js';
import { updateCharacter } from '../entities/character.js';

// Simple 3-node linear graph: 0 — 1 — 2
const nodes = [
  { id: 0, x: 0,   y: 0, neighbors: [1] },
  { id: 1, x: 50,  y: 0, neighbors: [0, 2] },
  { id: 2, x: 100, y: 0, neighbors: [1] },
];

function makeChar(fromId) {
  return {
    id: 0,
    pos: { x: nodes[fromId].x, y: nodes[fromId].y },
    from: fromId, to: fromId, path: [], progress: 0,
    speed: 1000, color: '#ff0000', trail: [],
    destination: null,
  };
}

// --- node destination ---
const charA = makeChar(0);
charA.destination = { type: 'node', nodeId: 2 };
updateCharacter(charA, 0, nodes);

assert('node dest: path set toward nodeId 2', charA.path.length > 0);
assert('node dest: destination cleared immediately', charA.destination === null);
assert('node dest: next hop is node 1', charA.to === 1);

// With dt > 0 character should move
const charB = makeChar(0);
charB.destination = { type: 'node', nodeId: 2 };
updateCharacter(charB, 0.01, nodes);
assert('node dest: character starts moving toward node 1', charB.pos.x > 0);

// Destination at current location — no crash, destination cleared
const charC = makeChar(0);
charC.destination = { type: 'node', nodeId: 0 };
updateCharacter(charC, 0, nodes);
assert('node dest: destination to self — cleared without error', charC.destination === null);
```

- [ ] **Step 2: Add import to `tests/index.html`**

In `tests/index.html`, add inside the module script (after existing imports):

```html
import './test-character-destination.js';
```

- [ ] **Step 3: Open `tests/index.html` in browser, verify new tests FAIL (not implemented yet)**

Expected console output: red `✗` for the three new assertions.

- [ ] **Step 4: Implement node destination handling at the top of `updateCharacter`**

Add this block as the very first thing inside `updateCharacter`, before the existing `if (char.path.length === 0)` check:

```js
export function updateCharacter(char, dt, intersections, characters = []) {
  // Handle newly-set node destination: compute BFS and reroute immediately.
  if (char.destination?.type === 'node') {
    const path = bfs(intersections, char.from, char.destination.nodeId);
    char.destination = null;
    if (path && path.length > 1) {
      char.path = path.slice(1);
      char.to = char.path[0];
      char.progress = 0;
    }
    // If path.length <= 1 (already there or no path), fall through to normal movement.
  }

  if (char.path.length === 0) {
    pickNewTarget(char, intersections);
    return;
  }
  // ... rest of function unchanged
```

- [ ] **Step 5: Open `tests/index.html`, verify all node destination tests PASS**

- [ ] **Step 6: Commit**

```bash
git add entities/character.js tests/test-character-destination.js tests/index.html
git commit -m "feat: character node destination — immediate BFS rerouting"
```

---

## Task 3: Follow (character destination) logic

**Files:**
- Modify: `entities/character.js`
- Modify: `tests/test-character-destination.js`

- [ ] **Step 1: Append follow tests to `tests/test-character-destination.js`**

```js
// --- character (follow) destination ---

function makeCharAt(id, charId) {
  return {
    id: charId,
    pos: { x: nodes[id].x, y: nodes[id].y },
    from: id, to: id, path: [], progress: 0,
    speed: 1000, color: '#6bffb8', trail: [],
    destination: null,
  };
}

const follower = makeCharAt(0, 0);
const target   = makeCharAt(2, 1);
const allChars = [follower, target];

follower.destination = { type: 'character', characterId: 1 };

// First update: sets initial path toward target (dt=0, no movement)
updateCharacter(follower, 0, nodes, allChars);
assert('follow: path set toward target on first update', follower.path.length > 0);
assert('follow: destination kept while chasing', follower.destination !== null);
assert('follow: next hop toward target is node 1', follower.to === 1);

// Simulate arrival at node 1
follower.from = 1;
follower.to = 1;
follower.path = [];
follower.progress = 0;
follower.pos = { x: nodes[1].x, y: nodes[1].y };

updateCharacter(follower, 0, nodes, allChars);
assert('follow: path recomputed at intermediate node', follower.path.length > 0);
assert('follow: still chasing after intermediate arrival', follower.destination !== null);

// Simulate arrival at node 2 (same as target)
follower.from = 2;
follower.to = 2;
follower.path = [];
follower.progress = 0;
follower.pos = { x: nodes[2].x, y: nodes[2].y };

updateCharacter(follower, 0, nodes, allChars);
assert('follow: destination cleared on reaching target', follower.destination === null);

// Target not found (e.g. after regenerate) — destination cleared gracefully
const lostFollower = makeCharAt(0, 0);
lostFollower.destination = { type: 'character', characterId: 99 };
updateCharacter(lostFollower, 0, nodes, [lostFollower]);
assert('follow: destination cleared when target missing', lostFollower.destination === null);
```

- [ ] **Step 2: Open `tests/index.html`, verify follow tests FAIL**

- [ ] **Step 3: Implement follow logic**

Add a second block after the node destination block at the top of `updateCharacter` (for initial path computation):

```js
  // Handle newly-set character destination: compute initial path if we have none.
  if (char.destination?.type === 'character' && char.path.length === 0) {
    const target = characters.find(c => c.id === char.destination.characterId);
    if (!target) {
      char.destination = null;
    } else {
      const path = bfs(intersections, char.from, target.to);
      if (path && path.length > 1) {
        char.path = path.slice(1);
        char.to = char.path[0];
        char.progress = 0;
      } else {
        char.destination = null; // already there or no path
      }
    }
  }
```

Then, inside the `if (char.progress >= 1)` block, replace the final `else { pickNewTarget(...) }` with:

```js
  if (char.progress >= 1) {
    char.from = char.to;
    char.path.shift();
    char.pos.x = intersections[char.from].x;
    char.pos.y = intersections[char.from].y;
    char.progress = 0;

    if (char.destination?.type === 'character') {
      const target = characters.find(c => c.id === char.destination.characterId);
      if (!target || char.from === target.from || char.from === target.to) {
        // Reached target or target gone — back to autonomous movement
        char.destination = null;
        char.path = [];
        pickNewTarget(char, intersections);
      } else {
        // Recompute path to target's current position
        const path = bfs(intersections, char.from, target.to);
        if (path && path.length > 1) {
          char.path = path.slice(1);
          char.to = char.path[0];
        } else {
          char.destination = null;
          pickNewTarget(char, intersections);
        }
      }
    } else if (char.path.length > 0) {
      char.to = char.path[0];
    } else {
      pickNewTarget(char, intersections);
    }
  }
```

- [ ] **Step 4: Open `tests/index.html`, verify all character destination tests PASS**

- [ ] **Step 5: Commit**

```bash
git add entities/character.js tests/test-character-destination.js
git commit -m "feat: character follow destination — recompute BFS on node arrival"
```

---

## Task 4: Pure helpers in `ui/interaction.js`

**Files:**
- Create: `ui/interaction.js`
- Create: `tests/test-interaction.js`
- Modify: `tests/index.html`

- [ ] **Step 1: Create test file**

```js
// tests/test-interaction.js
import { assert } from './runner.js';
import { hitTestCharacters, findNearestNode } from '../ui/interaction.js';

// --- hitTestCharacters ---
const chars = [
  { id: 0, pos: { x: 100, y: 100 } },
  { id: 1, pos: { x: 200, y: 200 } },
];

assert('hit: returns id 0 within 12px radius', hitTestCharacters({ x: 105, y: 103 }, chars) === 0);
assert('hit: returns null just outside 12px', hitTestCharacters({ x: 113, y: 100 }, chars) === null);
assert('hit: returns id 1 close to char 1', hitTestCharacters({ x: 194, y: 206 }, chars) === 1);
assert('hit: returns null far from all chars', hitTestCharacters({ x: 300, y: 300 }, chars) === null);
assert('hit: excludeId skips that character', hitTestCharacters({ x: 105, y: 103 }, chars, 12, 0) === null);
assert('hit: custom radius respected', hitTestCharacters({ x: 125, y: 100 }, chars, 30) === 0);

// --- findNearestNode ---
const nodes = [
  { id: 10, x: 50,  y: 50 },
  { id: 20, x: 150, y: 150 },
  { id: 30, x: 300, y: 300 },
];

assert('nearest: closest to node 10', findNearestNode({ x: 60, y: 55 }, nodes) === 10);
assert('nearest: closest to node 20', findNearestNode({ x: 160, y: 140 }, nodes) === 20);
assert('nearest: closest to node 30', findNearestNode({ x: 280, y: 290 }, nodes) === 30);
assert('nearest: exactly on node returns that node', findNearestNode({ x: 150, y: 150 }, nodes) === 20);
```

- [ ] **Step 2: Add import to `tests/index.html`**

```html
import './test-interaction.js';
```

- [ ] **Step 3: Open `tests/index.html`, verify tests FAIL (module not found)**

- [ ] **Step 4: Create `ui/interaction.js` with helpers and menu constants**

```js
// ui/interaction.js

// ─── Menu layout constants ────────────────────────────────────────────────────

export const MENU_ITEMS = ['↗ Choose destination', '✕ Cancel'];
export const MENU_WIDTH = 158;
export const MENU_ITEM_HEIGHT = 26;
export const MENU_PADDING_Y = 6;
export const MENU_PADDING_X = 10;
export const MENU_OFFSET_X = 16;

/**
 * Returns the bounding rect of the action menu for a character at charPos.
 * Shifts left if the menu would overflow the right canvas edge.
 */
export function getMenuRect(charPos, canvasWidth) {
  const totalHeight = MENU_ITEMS.length * MENU_ITEM_HEIGHT + MENU_PADDING_Y * 2;
  let x = charPos.x + MENU_OFFSET_X;
  if (x + MENU_WIDTH > canvasWidth - 8) {
    x = charPos.x - MENU_OFFSET_X - MENU_WIDTH;
  }
  const y = charPos.y - totalHeight / 2;
  return { x, y, width: MENU_WIDTH, height: totalHeight };
}

/**
 * Returns the id of the first character whose center is within `radius` px of
 * `pos`. Pass `excludeId` to skip a character (e.g. the currently selected one).
 */
export function hitTestCharacters(pos, characters, radius = 12, excludeId = -1) {
  for (const char of characters) {
    if (char.id === excludeId) continue;
    const dx = char.pos.x - pos.x;
    const dy = char.pos.y - pos.y;
    if (dx * dx + dy * dy <= radius * radius) return char.id;
  }
  return null;
}

/** Returns the id of the intersection node closest to `pos`. */
export function findNearestNode(pos, intersections) {
  let bestId = null;
  let bestDist = Infinity;
  for (const node of intersections) {
    const dx = node.x - pos.x;
    const dy = node.y - pos.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = node.id;
    }
  }
  return bestId;
}
```

- [ ] **Step 5: Open `tests/index.html`, verify all helper tests PASS**

- [ ] **Step 6: Commit**

```bash
git add ui/interaction.js tests/test-interaction.js tests/index.html
git commit -m "feat: interaction helpers — hitTestCharacters, findNearestNode, getMenuRect"
```

---

## Task 5: `InteractionController` — state machine and canvas events

**Files:**
- Modify: `ui/interaction.js`

- [ ] **Step 1: Append `InteractionController` class to `ui/interaction.js`**

```js
// ─── InteractionController ────────────────────────────────────────────────────

export class InteractionController {
  #mode = 'idle';
  #selectedCharacterId = null;
  #hoveredCharacterId = null;
  #hoveredMenuItemIndex = null;
  #mousePos = null;

  #canvas;
  #getCharacters;
  #getCityData;
  #onDestinationSet;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => Character[]} getCharacters  - called on every event
   * @param {() => CityData}    getCityData    - called on click in picking mode
   * @param {(charId: number, destination: object) => void} onDestinationSet
   */
  constructor(canvas, getCharacters, getCityData, onDestinationSet) {
    this.#canvas = canvas;
    this.#getCharacters = getCharacters;
    this.#getCityData = getCityData;
    this.#onDestinationSet = onDestinationSet;

    canvas.addEventListener('mousemove', this.#onMouseMove);
    canvas.addEventListener('click', this.#onClick);
  }

  getState() {
    return {
      mode: this.#mode,
      selectedCharacterId: this.#selectedCharacterId,
      hoveredCharacterId: this.#hoveredCharacterId,
      hoveredMenuItemIndex: this.#hoveredMenuItemIndex,
      mousePos: this.#mousePos,
    };
  }

  reset() {
    this.#mode = 'idle';
    this.#selectedCharacterId = null;
    this.#hoveredCharacterId = null;
    this.#hoveredMenuItemIndex = null;
    this.#mousePos = null;
    this.#canvas.style.cursor = 'default';
  }

  // Converts a MouseEvent position to canvas-space coordinates,
  // accounting for CSS scaling (canvas may be smaller on screen than its pixel size).
  #canvasPos(e) {
    const rect = this.#canvas.getBoundingClientRect();
    const scaleX = this.#canvas.width / rect.width;
    const scaleY = this.#canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  #onMouseMove = (e) => {
    const pos = this.#canvasPos(e);
    this.#mousePos = pos;
    const characters = this.#getCharacters();

    if (this.#mode === 'idle') {
      const hit = hitTestCharacters(pos, characters);
      this.#hoveredCharacterId = hit;
      this.#canvas.style.cursor = hit !== null ? 'pointer' : 'default';

    } else if (this.#mode === 'menu_open') {
      const selChar = characters.find(c => c.id === this.#selectedCharacterId);
      if (selChar) {
        const menuRect = getMenuRect(selChar.pos, this.#canvas.width);
        let hovered = null;
        for (let i = 0; i < MENU_ITEMS.length; i++) {
          const itemY = menuRect.y + MENU_PADDING_Y + i * MENU_ITEM_HEIGHT;
          if (
            pos.x >= menuRect.x &&
            pos.x <= menuRect.x + menuRect.width &&
            pos.y >= itemY &&
            pos.y <= itemY + MENU_ITEM_HEIGHT
          ) {
            hovered = i;
            break;
          }
        }
        this.#hoveredMenuItemIndex = hovered;
        this.#canvas.style.cursor = hovered !== null ? 'pointer' : 'default';
      }

    } else if (this.#mode === 'picking_destination') {
      this.#hoveredCharacterId = hitTestCharacters(pos, characters, 12, this.#selectedCharacterId);
      this.#canvas.style.cursor = 'crosshair';
    }
  };

  #onClick = (e) => {
    const pos = this.#canvasPos(e);
    const characters = this.#getCharacters();

    if (this.#mode === 'idle') {
      const hit = hitTestCharacters(pos, characters);
      if (hit !== null) {
        this.#mode = 'menu_open';
        this.#selectedCharacterId = hit;
        this.#hoveredMenuItemIndex = null;
      }

    } else if (this.#mode === 'menu_open') {
      const selChar = characters.find(c => c.id === this.#selectedCharacterId);
      if (selChar) {
        const menuRect = getMenuRect(selChar.pos, this.#canvas.width);
        for (let i = 0; i < MENU_ITEMS.length; i++) {
          const itemY = menuRect.y + MENU_PADDING_Y + i * MENU_ITEM_HEIGHT;
          if (
            pos.x >= menuRect.x &&
            pos.x <= menuRect.x + menuRect.width &&
            pos.y >= itemY &&
            pos.y <= itemY + MENU_ITEM_HEIGHT
          ) {
            if (i === 0) {
              // "Choose destination"
              this.#mode = 'picking_destination';
            } else {
              // "Cancel"
              this.#mode = 'idle';
              this.#selectedCharacterId = null;
            }
            this.#hoveredMenuItemIndex = null;
            return;
          }
        }
      }
      // Clicked outside menu — dismiss
      this.#mode = 'idle';
      this.#selectedCharacterId = null;
      this.#hoveredMenuItemIndex = null;

    } else if (this.#mode === 'picking_destination') {
      const cityData = this.#getCityData();
      const charId = this.#selectedCharacterId;
      const hit = hitTestCharacters(pos, characters, 12, charId);
      const destination = hit !== null
        ? { type: 'character', characterId: hit }
        : { type: 'node', nodeId: findNearestNode(pos, cityData.intersections) };

      this.#mode = 'idle';
      this.#selectedCharacterId = null;
      this.#canvas.style.cursor = 'default';
      this.#onDestinationSet(charId, destination);
    }
  };
}
```

- [ ] **Step 2: Open `index.html` in browser, verify no console errors**

The module loads; no visible behavior change yet (renderer not updated).

- [ ] **Step 3: Commit**

```bash
git add ui/interaction.js
git commit -m "feat: InteractionController — state machine and canvas event handlers"
```

---

## Task 6: Renderer — selection ring and destination highlights

**Files:**
- Modify: `renderer/canvas.js`

- [ ] **Step 1: Add import at the top of `renderer/canvas.js`**

```js
import {
  MENU_ITEMS, MENU_WIDTH, MENU_ITEM_HEIGHT, MENU_PADDING_Y, MENU_PADDING_X,
  getMenuRect,
} from '../ui/interaction.js';
```

- [ ] **Step 2: Update `render` signature**

```js
// Before:
export function render(ctx, cityData, characters) {

// After:
export function render(ctx, cityData, characters, interactionState = null, timestamp = 0) {
```

- [ ] **Step 3: Add layer 6 at the end of `render`, after the characters loop**

```js
  // 6. Interaction layer — destination highlights, selection ring, menu, cursor
  if (!interactionState) return;

  const { mode, selectedCharacterId, hoveredCharacterId, hoveredMenuItemIndex, mousePos } = interactionState;

  // Destination highlights — visible in ALL modes (including idle on hover).
  // In non-idle modes show the selected character's destination; in idle show hovered.
  const highlightCharId = mode !== 'idle' ? selectedCharacterId : hoveredCharacterId;
  const highlightChar = highlightCharId !== null
    ? characters.find(c => c.id === highlightCharId)
    : null;

  if (highlightChar?.destination) {
    if (highlightChar.destination.type === 'node') {
      const node = cityData.intersections.find(n => n.id === highlightChar.destination.nodeId);
      if (node) {
        const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.004);
        ctx.save();
        ctx.strokeStyle = highlightChar.color;
        ctx.globalAlpha = 0.4 + 0.4 * pulse;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (highlightChar.destination.type === 'character') {
      const targetChar = characters.find(c => c.id === highlightChar.destination.characterId);
      if (targetChar) {
        ctx.save();
        ctx.strokeStyle = highlightChar.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(targetChar.pos.x, targetChar.pos.y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore(); // also clears setLineDash
      }
    }
  }

  // Everything below requires a non-idle mode
  if (mode === 'idle') return;

  const selChar = selectedCharacterId !== null
    ? characters.find(c => c.id === selectedCharacterId)
    : null;

  // Selection ring around the selected character
  if (selChar) {
    ctx.save();
    ctx.strokeStyle = selChar.color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(selChar.pos.x, selChar.pos.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
```

- [ ] **Step 4: Open `index.html`, click a character, verify selection ring appears around it**

The menu is not drawn yet — that comes in Task 7.

- [ ] **Step 5: Commit**

```bash
git add renderer/canvas.js
git commit -m "feat: renderer — selection ring and destination highlights"
```

---

## Task 7: Renderer — action menu

**Files:**
- Modify: `renderer/canvas.js`

- [ ] **Step 1: Add menu rendering inside layer 6, after the destination highlights block**

```js
  // Action menu (mode === 'menu_open')
  if (mode === 'menu_open' && selChar) {
    const menuRect = getMenuRect(selChar.pos, cityData.width);

    // Background + border
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,26,0.80)';
    ctx.strokeStyle = 'rgba(160,175,218,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(menuRect.x, menuRect.y, menuRect.width, menuRect.height, 5);
    ctx.fill();
    ctx.stroke();

    // Items
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const itemX = menuRect.x;
      const itemY = menuRect.y + MENU_PADDING_Y + i * MENU_ITEM_HEIGHT;
      const isHovered = hoveredMenuItemIndex === i;

      if (isHovered) {
        // Subtle hover background
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(itemX, itemY, menuRect.width, MENU_ITEM_HEIGHT);
        // Accent bar in selected character's color
        ctx.fillStyle = selChar.color;
        ctx.fillRect(itemX, itemY, 3, MENU_ITEM_HEIGHT);
      }

      ctx.fillStyle = isHovered ? '#f2f5ff' : '#9ca6c7';
      ctx.fillText(
        MENU_ITEMS[i],
        itemX + MENU_PADDING_X,
        itemY + MENU_ITEM_HEIGHT / 2,
      );
    }

    ctx.restore();
  }
```

- [ ] **Step 2: Open `index.html`, click a character, verify:**

- Menu popup appears near the character
- Two items: "↗ Choose destination" and "✕ Cancel"
- Hovering an item shows left accent bar in the character's color
- Menu shifts to left of character when character is near the right canvas edge
- "✕ Cancel" closes the menu

- [ ] **Step 3: Commit**

```bash
git add renderer/canvas.js
git commit -m "feat: renderer — action menu popup on canvas"
```

---

## Task 8: Renderer — picking_destination overlay

**Files:**
- Modify: `renderer/canvas.js`

- [ ] **Step 1: Add picking_destination visuals inside layer 6, after the menu block**

```js
  // Picking destination: circle cursor under mouse + hint text
  if (mode === 'picking_destination' && mousePos) {
    // Circle cursor
    ctx.save();
    ctx.strokeStyle = '#61dafb';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = '#61dafb';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Hint text at bottom center
    ctx.save();
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#61dafb';
    ctx.globalAlpha = 0.65;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('click destination', cityData.width / 2, cityData.height - 10);
    ctx.restore();
  }
```

- [ ] **Step 2: Open `index.html`, test picking_destination mode:**

1. Click character → menu appears
2. Click "↗ Choose destination" → menu closes, circle cursor follows mouse
3. "click destination" hint visible at bottom of canvas
4. Click a point on map → cursor disappears (Task 9 will make character move)
5. Click another character while in picking mode → cursor disappears

- [ ] **Step 3: Commit**

```bash
git add renderer/canvas.js
git commit -m "feat: renderer — picking_destination cursor circle and hint"
```

---

## Task 9: Wire into `main.js`

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Replace `main.js` with the updated version**

```js
// main.js
import { generateCity } from './generator/city.js';
import { createRNG } from './generator/rng.js';
import { createCharacter, updateCharacter } from './entities/character.js';
import { render } from './renderer/canvas.js';
import { initControls } from './ui/controls.js';
import { InteractionController } from './ui/interaction.js';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;

const canvas = document.getElementById('city-canvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let cityData = null;
let characters = [];
let lastTimestamp = null;

const interaction = new InteractionController(
  canvas,
  () => characters,
  () => cityData,
  (charId, destination) => {
    const char = characters.find(c => c.id === charId);
    if (char) char.destination = destination;
  },
);

function regenerate(params) {
  interaction.reset();

  cityData = generateCity({
    seed: params.seed,
    numDistricts: params.numDistricts,
    streetDensity: params.streetDensity,
    buildingDensity: params.buildingDensity,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });

  const charRng = createRNG(params.seed + 999999);
  characters = Array.from(
    { length: params.numCharacters },
    (_, i) => createCharacter(cityData.intersections, charRng, i),
  );
}

function loop(timestamp) {
  const dt = lastTimestamp !== null
    ? Math.min((timestamp - lastTimestamp) / 1000, 0.1)
    : 0;
  lastTimestamp = timestamp;

  if (cityData) {
    for (const char of characters) {
      updateCharacter(char, dt, cityData.intersections, characters);
    }
    render(ctx, cityData, characters, interaction.getState(), timestamp);
  }

  requestAnimationFrame(loop);
}

const initialParams = initControls(regenerate);
regenerate(initialParams);
requestAnimationFrame(loop);
```

- [ ] **Step 2: Open `index.html` in browser, verify the full interaction flow:**

1. Click a character → selection ring appears + menu popup
2. Hover menu items → left accent bar highlights in character's color
3. Click "↗ Choose destination" → menu closes, circle cursor appears on canvas
4. Click a point on the map → character reroutes toward nearest intersection and starts moving there
5. Click "↗ Choose destination" again → click on a different character → first character chases second
6. Hover over a character that has a destination → destination highlight visible (node ring or dashed chase ring)
7. Click a character → "✕ Cancel" → menu dismisses, back to idle
8. Click "Regenerate" → all interaction state resets, new city and characters generated

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: wire InteractionController into main loop"
```

---
