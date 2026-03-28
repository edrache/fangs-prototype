# Player District Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark the top-left district as the player-owned district, render it with a dark red border, and spawn player characters inside it.

**Architecture:** Add `isPlayerOwned` flag to district objects in the generator; draw the border in the renderer between the district fill pass and the street pass; override the start node for player characters in `createCharacters()` in `main.js`.

**Tech Stack:** Vanilla JS, Canvas API, no build step, no test runner — verification is done visually in the browser and via `window.render_game_to_text()` in the browser console.

**Prerequisite:** The `player-characters-design.md` spec must already be implemented before Task 3. Specifically, `main.js` must have a `PLAYER_COUNT` constant and `createCharacters()` must set `char.isPlayer = index < PLAYER_COUNT`. Verify this before starting Task 3: open the browser console and run `render_game_to_text()` — the character objects must have an `isPlayer` field.

---

## File map

| File | Change |
|---|---|
| `generator/districts.js` | Add `isPlayerOwned: id === 0` to district objects |
| `renderer/canvas.js` | Add `drawPlayerDistrictBorder()` function; call it after district fills |
| `main.js` | Update `createCharacters()` to pick start nodes from the player district |

---

## Task 1: Add `isPlayerOwned` flag to the district model

**Files:**
- Modify: `generator/districts.js`

- [ ] **Step 1: Add the flag**

In `generator/districts.js`, find the `districts.push({...})` call inside the `for` loops (around line 95). Add `isPlayerOwned: id === 0` as a new field:

```js
districts.push({
  id,
  color: DISTRICT_COLORS[id % DISTRICT_COLORS.length],
  isPlayerOwned: id === 0,
  bounds: {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  },
});
```

- [ ] **Step 2: Verify in browser console**

Open `index.html` in a browser (e.g. `python3 -m http.server 8080`, then `http://localhost:8080`).

Open the browser console and run:

```js
JSON.parse(render_game_to_text()).districts
```

Expected: an array where the first entry has `isPlayerOwned: true` and all others have `isPlayerOwned: false`. Example:

```json
[
  { "id": 0, "color": "#355c7d", "isPlayerOwned": true, "bounds": { ... } },
  { "id": 1, "color": "#6c5b7b", "isPlayerOwned": false, "bounds": { ... } },
  ...
]
```

- [ ] **Step 3: Commit**

```bash
git add generator/districts.js
git commit -m "feat: add isPlayerOwned flag to district model"
```

---

## Task 2: Draw dark red border around the player district

**Files:**
- Modify: `renderer/canvas.js`

- [ ] **Step 1: Add the border drawing function**

In `renderer/canvas.js`, add a new function after `fillDistrict` (around line 31):

```js
function drawPlayerDistrictBorder(ctx, district) {
  const inset = 1.5;
  ctx.strokeStyle = '#8b0000';
  ctx.lineWidth = 3;
  ctx.strokeRect(
    district.bounds.x + inset,
    district.bounds.y + inset,
    district.bounds.w - inset * 2,
    district.bounds.h - inset * 2,
  );
}
```

- [ ] **Step 2: Call it in the render loop**

In `renderCity()` (around line 333), add a second pass over districts right after the fill pass — before streets so streets draw on top of the border edges:

```js
  for (const district of city.districts) {
    fillDistrict(ctx, district);
  }

  for (const district of city.districts) {
    if (district.isPlayerOwned) {
      drawPlayerDistrictBorder(ctx, district);
    }
  }

  for (const street of city.streets) {
    drawStreet(ctx, street);
  }
```

- [ ] **Step 3: Verify visually**

Reload `http://localhost:8080`. The top-left district should have a clearly visible dark red border along its edges. Streets that cross the district border should render on top of the border, looking natural.

Try clicking "Regenerate" a few times — the border must always appear on the top-left district regardless of district count or seed.

- [ ] **Step 4: Commit**

```bash
git add renderer/canvas.js
git commit -m "feat: draw player district border in renderer"
```

---

## Task 3: Spawn player characters inside the player district

**Prerequisite check:** Before starting this task, open the browser console and run:

```js
JSON.parse(render_game_to_text()).characters.map(c => c.isPlayer)
```

Expected: an array where the first `PLAYER_COUNT` entries are `true` and the rest are `false`. If all entries are `false` or the field is missing, the player-characters spec is not yet implemented — stop and implement that spec first.

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Find player district nodes and use them as start positions**

In `main.js`, replace `createCharacters()` with the version below. The only changes are: (a) filter `playerNodes` from the player district's bounds, (b) override `pos`, `from`, `to`, `path`, and `progress` for player characters after `createCharacter()` returns.

```js
function createCharacters(city, seed, count) {
  if (!city || city.intersections.length === 0) {
    return [];
  }

  const rng = createRNG(seed ^ 0x9e3779b9);
  const characterCount = Math.min(count, city.intersections.length);
  const characters = [];

  const playerDistrict = city.districts.find((d) => d.isPlayerOwned);
  const playerNodes = playerDistrict
    ? city.intersections.filter(
        (node) =>
          node.x >= playerDistrict.bounds.x &&
          node.x <= playerDistrict.bounds.x + playerDistrict.bounds.w &&
          node.y >= playerDistrict.bounds.y &&
          node.y <= playerDistrict.bounds.y + playerDistrict.bounds.h,
      )
    : [];

  for (let index = 0; index < characterCount; index += 1) {
    const char = createCharacter(city.intersections, rng, index);
    char.isPlayer = index < PLAYER_COUNT;

    if (char.isPlayer && playerNodes.length > 0) {
      const startNode = playerNodes[rng.int(0, playerNodes.length - 1)];
      char.pos = { x: startNode.x, y: startNode.y };
      char.from = startNode.id;
      char.to = startNode.id;
      char.path = [];
      char.progress = 0;
    }

    characters.push(char);
  }

  return characters;
}
```

- [ ] **Step 2: Verify player characters start in the player district**

Reload `http://localhost:8080` and run in the browser console:

```js
const state = JSON.parse(render_game_to_text());
const pd = state.districts.find(d => d.isPlayerOwned);
state.characters
  .filter(c => c.isPlayer)
  .map(c => ({
    id: c.id,
    x: c.pos.x,
    y: c.pos.y,
    inDistrict:
      c.pos.x >= pd.bounds.x &&
      c.pos.x <= pd.bounds.x + pd.bounds.w &&
      c.pos.y >= pd.bounds.y &&
      c.pos.y <= pd.bounds.y + pd.bounds.h,
  }));
```

Expected: all entries have `inDistrict: true`.

Also verify visually — at simulation start (or after pressing pause then regenerate), all diamond-shaped player characters should appear in the top-left district.

- [ ] **Step 3: Verify NPCs are unaffected**

Run in the console:

```js
JSON.parse(render_game_to_text()).characters.filter(c => !c.isPlayer).length
```

Expected: the same count as before (`characters - PLAYER_COUNT`). NPC positions should be spread across the entire map, not concentrated in the player district.

- [ ] **Step 4: Commit**

```bash
git add main.js
git commit -m "feat: spawn player characters in player district"
```
