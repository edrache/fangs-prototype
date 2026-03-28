# Character Selection & Action Menu — Design Spec

**Date:** 2026-03-28
**Stage:** 1 — Player interaction with characters
**Tech:** Vanilla HTML/JavaScript, Canvas API, no external dependencies

---

## Overview

The player can click on any character dot on the canvas to select it. A popup action menu appears near the character. Initially one action is available: choose a travel destination. The destination can be a point on the map (nearest intersection) or another character (follow/chase). Characters continue moving while the menu is open.

---

## Interaction State Machine

Three modes managed by `ui/interaction.js`:

```
idle
  → click on character → menu_open { characterId }

menu_open { characterId }
  → click "Choose destination" → picking_destination { characterId }
  → click "Cancel"             → idle
  → click outside menu         → idle (dismiss)

picking_destination { characterId }
  → click on map (not a character)  → idle  (sets destination: nearest node)
  → click on another character      → idle  (sets destination: follow that character)
```

---

## Data Model Changes

### Character — new fields

```js
destination: {
  type: 'node',
  nodeId: number
} | {
  type: 'character',
  characterId: number
} | null
```

`destination: null` means autonomous movement (random target selection as before).

### InteractionState snapshot (passed to renderer each frame)

```js
{
  mode: 'idle' | 'menu_open' | 'picking_destination',
  selectedCharacterId: number | null,
  hoveredCharacterId: number | null,
  mousePos: { x, y } | null
}
```

---

## Module: `ui/interaction.js`

Exports `InteractionController` class. Owns interaction state and canvas event handlers. Does not modify characters directly — calls `onDestinationSet(characterId, destination)` callback registered by `main.js`.

### Hit-test

Radius: **12px** around character center (larger than rendered dot for easier clicking).

### `mousemove` handler

- Updates `mousePos` and `hoveredCharacterId`
- In `menu_open`: detects hover over menu items (for highlight)
- CSS cursor: `pointer` over character or menu item, `crosshair` in `picking_destination`, `default` otherwise

### `click` handler

**`idle`**: hit-test → if character hit → `menu_open`

**`menu_open`**:
- Click "Choose destination" → `picking_destination`
- Click "Cancel" → `idle`
- Click outside menu → `idle`

**`picking_destination`**:
- Hit-test on characters (excluding selected) → `destination = { type: 'character', characterId }`
- Otherwise → find nearest intersection node → `destination = { type: 'node', nodeId }`
- Both cases → `idle`, call `onDestinationSet`

---

## Rendering — new layer 6

Added to `renderer/canvas.js` as the topmost layer. Receives `InteractionState` parameter.

### Elements drawn

1. **Selection ring** (when `menu_open` or `picking_destination`): circle around selected character, character's color, opacity 0.7

2. **Destination highlight** (on hover or when selected character has `destination`):
   - `type: 'node'` → pulsing circle at target node position
   - `type: 'character'` → dashed ring around the followed character

3. **Action menu** (when `menu_open`): rounded rectangle on canvas near character
   - Background: `rgba(10, 14, 26, 0.80)`
   - Border: `rgba(160, 175, 218, 0.3)`
   - Items: `↗ Choose destination`, `✕ Cancel`
   - Hovered item: left accent bar in selected character's color

4. **Picking mode indicator** (when `picking_destination`):
   - Small `click destination` hint text at bottom of canvas
   - Circle cursor drawn under mouse in `#61dafb`

---

## Character Logic Changes (`entities/character.js`)

Each frame, before normal movement, checks `destination`:

**`destination === null`** — existing behavior (random target on arrival)

**`destination.type === 'node'`** — compute BFS to `nodeId` once, set as path, clear `destination` (character returns to random movement after reaching it)

**`destination.type === 'character'`** — on each node arrival: recompute BFS to the followed character's current `to` node. When distance ≤ 1 node, consider arrived, clear `destination`.

BFS is recomputed per node arrival (not per frame) to avoid performance cost while still tracking moving targets.

---

## File Change Summary

| File | Change |
|---|---|
| `ui/interaction.js` | **new** — interaction state machine, mouse event handlers |
| `renderer/canvas.js` | add layer 6: selection ring, action menu, destination highlight, cursor |
| `entities/character.js` | add `destination` field, follow/chase logic |
| `main.js` | instantiate `InteractionController`, pass `interactionState` to renderer, `onDestinationSet` callback |

---

## Reset on Regenerate

When the player clicks "Regenerate", `InteractionController.reset()` is called by `main.js` before generating a new city. This forces state back to `idle` and clears all selections.

---

## Out of Scope

- Multiple simultaneous selections
- Keyboard shortcuts
- Additional actions beyond "Choose destination"
- Path preview line before confirming destination
- Collision or interaction between characters at the same node
