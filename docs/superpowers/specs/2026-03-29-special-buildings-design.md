# Special Buildings Design

**Date:** 2026-03-29
**Branch:** codex/time-controls
**Status:** Approved

## Overview

Some buildings on the map are "special" — they have a visual outline and respond to player interaction. The first special building type is **Nest**: one building in the player's district where vampires will eventually sleep during the day. For now, special buildings show a double-ring outline and respond to click with a context menu. The only action in the menu is **Info**, which opens an HTML overlay with the building's description.

---

## Data Model

Special buildings extend the existing building object with two new fields:

```js
{
  districtId: 0,
  rects: [...],          // unchanged
  special: 'nest',       // string type identifier; absent/null = regular building
  description: 'Vampire refuge. They sleep here during the day.',
}
```

**Nest assignment** happens in `generator/city.js` after `generateBuildings`. The building with the largest total rect area (`sum of rects w*h`) in the player-owned district (`isPlayerOwned === true`) is assigned `special: 'nest'` and a fixed `description` string. Selection is deterministic — no RNG involved.

Only buildings with a `special` field are interactive.

---

## Building Interaction Controller — `ui/buildingInteraction.js`

New module exporting `createBuildingInteractionController`.

### Internal state

```js
{
  hoveredBuildingId: null,    // index in city.buildings, or null
  selectedBuildingId: null,   // building with open menu
  mode: 'idle',               // 'idle' | 'menu_open'
  hoveredMenuItemIndex: null,
}
```

### Hit testing

On every `mousemove`, iterate over all buildings with `special` set and test the cursor point against each of their `rects` (point-in-rect). Only the first match is returned.

### Events handled

| Event | Behaviour |
|---|---|
| `mousemove` | Updates `hoveredBuildingId`; sets cursor to `pointer` when over a special building or a hovered menu item |
| `click` | Opens menu (`mode = 'menu_open'`) when a special building is clicked; dispatches menu item actions |
| `keydown Escape` | Closes menu, resets to `idle` |

### Menu items

```js
[{ id: 'info', label: 'Info' }]
```

Clicking **Info** calls `onInfoRequested(building)` callback — the caller is responsible for showing the overlay.

### Public API

```js
{
  getState(),        // snapshot of current state (mirrors pattern in interaction.js)
  clearSelection(),  // close menu, return to idle
  reset(),           // called on map regeneration
  destroy(),         // removes event listeners
}
```

---

## Coordination in `main.js`

Both interaction controllers are created with mutual-exclusion callbacks:

```js
const buildingInteraction = createBuildingInteractionController({
  canvas,
  getCity: () => state.city,
  onMenuOpen() { interaction.clearSelection(); },   // close character menu
  onInfoRequested(building) { buildingInfoOverlay.show(building); },
  onChange() { render(); },
});

// character interaction controller also gets:
onMenuOpen() { buildingInteraction.clearSelection(); }
```

`regenerate()` calls `buildingInteraction.reset()`.

---

## Info Overlay — `ui/buildingInfoOverlay.js`

New module exporting `createBuildingInfoOverlay({ mount })`.

- Creates a `position: absolute` div layered over the canvas
- Hidden by default (`display: none`)
- `show(building)` — populates and reveals the overlay with `building.special` (as title, capitalised) and `building.description`
- `hide()` — hides the overlay; also triggered by Escape keydown and an × close button
- `update(buildingInteractionState)` — called from `render()` to sync visibility; hides if `mode` returns to `idle`

---

## Rendering — `renderer/canvas.js`

### `drawSpecialBuildings(ctx, city)`

New function called immediately after `drawBuildings`. For each building where `building.special` is set, draws a double-ring outline on every `rect`:

```js
// thin outer ring
ctx.strokeStyle = 'rgba(155,127,255,0.45)';
ctx.lineWidth = 1;
ctx.strokeRect(rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6);
// solid inner ring
ctx.strokeStyle = '#9b7fff';
ctx.lineWidth = 2;
ctx.strokeRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2);
```

### Building context menu

`renderCity` receives `buildingInteractionState` as a new argument. When `buildingInteractionState.mode === 'menu_open'`, the existing `drawActionMenu` function is reused. Menu position is derived from the bounding box center of all rects in the selected building.

### `renderCity` signature change

```js
export function renderCity(ctx, city, characters, interactionState, buildingInteractionState, notifications)
```

---

## File Summary

| File | Change |
|---|---|
| `generator/city.js` | After `generateBuildings`, find and mark the Nest building |
| `ui/buildingInteraction.js` | New — building interaction controller |
| `ui/buildingInfoOverlay.js` | New — Info HTML overlay |
| `renderer/canvas.js` | Add `drawSpecialBuildings`; extend `renderCity` signature |
| `main.js` | Wire up both controllers; coordinate mutual exclusion; call `buildingInfoOverlay.update` from `render()` |

---

## Out of Scope for This Milestone

- Sleep mechanic (vampires sleeping in Nest at night)
- Multiple special buildings per district
- Animated outline (pulse, shimmer)
- Hover tooltip before click (tooltip on mouseover)
- Any building actions beyond Info
