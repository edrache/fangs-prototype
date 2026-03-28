# Player District — Design Spec

**Date:** 2026-03-28
**Stage:** 1 — Player district ownership and player character spawning
**Tech:** Vanilla HTML/JavaScript, Canvas API, no external dependencies
**Depends on:** `2026-03-28-player-characters-design.md` (must be implemented first)

---

## Overview

One district belongs to the player — always the top-left district (`id=0`). It is visually marked with a dark red border. Player characters spawn within this district on every (re)generation.

---

## 1. Data model (`generator/districts.js`)

Add `isPlayerOwned` to every district object. The district at `id=0` (first in the loop, `row=0, col=0`) always gets `true`; all others get `false`.

```js
districts.push({
  id,
  color: DISTRICT_COLORS[id % DISTRICT_COLORS.length],
  isPlayerOwned: id === 0,
  bounds: { x: left, y: top, w: right - left, h: bottom - top },
});
```

No changes to `generateCity()` — the field flows through `city.districts` automatically.

---

## 2. Rendering (`renderer/canvas.js`)

After filling each district, draw a dark red inset border (`#8b0000`, 3px) for every district where `isPlayerOwned === true`. The border is inset by half its width so it does not overlap streets.

```js
if (district.isPlayerOwned) {
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

The border is drawn in the same phase as district fills — before streets and buildings — so streets naturally cover the edges.

---

## 3. Player character spawning (`main.js`)

In `createCharacters()`, characters with `isPlayer === true` (the first `PLAYER_COUNT`) get a start node sampled from intersections that fall within the player district's bounds.

```js
const playerDistrict = city.districts.find(d => d.isPlayerOwned);
const playerNodes = playerDistrict
  ? city.intersections.filter(node =>
      node.x >= playerDistrict.bounds.x &&
      node.x <= playerDistrict.bounds.x + playerDistrict.bounds.w &&
      node.y >= playerDistrict.bounds.y &&
      node.y <= playerDistrict.bounds.y + playerDistrict.bounds.h
    )
  : city.intersections;

// inside the character creation loop:
if (char.isPlayer && playerNodes.length > 0) {
  const startNode = playerNodes[rng.int(0, playerNodes.length - 1)];
  char.pos = { x: startNode.x, y: startNode.y };
  char.from = startNode.id;
  char.to = startNode.id;
  char.path = [];
  char.progress = 0;
}
```

Fallback: if `playerNodes` is empty (not possible under normal generation), player characters spawn randomly like NPCs.

Player characters are free to move anywhere in the city after spawning — they are not restricted to the player district.

---

## File change summary

| File | Change |
|---|---|
| `generator/districts.js` | Add `isPlayerOwned: id === 0` to each district object |
| `renderer/canvas.js` | Draw dark red border (`#8b0000`) for `isPlayerOwned === true` districts |
| `main.js` | In `createCharacters()`: find player district nodes, assign them as start positions for player characters |

---

## Out of scope

- Transferring district ownership during gameplay
- Visual distinction of player district in the player panel
- Multiple player-owned districts
