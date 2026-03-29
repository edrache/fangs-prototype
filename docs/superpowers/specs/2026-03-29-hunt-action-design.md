# Hunt Action — Design Spec

**Date:** 2026-03-29
**Status:** Approved

## Summary

Add a Hunt action that allows a player character to pursue and eliminate an NPC. The player character pathfinds to the NPC, then both characters freeze while a visible timer counts down 1 hour of game time. On completion the NPC is removed and a success notification is shown. The feature is built as a standalone simulation module (`simulation/hunt.js`) to serve as the foundation for future actions (Seduce, Bribe, etc.).

---

## 1. Character model changes (`entities/character.js`)

### Capabilities

Every character gets a `capabilities` array:

```js
capabilities: [],        // NPC default
capabilities: ['hunt'],  // player characters
```

Menu items and action availability are derived from this array. Future actions are added by pushing strings — no structural changes needed.

### Hunt state

Every character gets an optional `hunt` field (null when inactive):

```js
hunt: null,

// shape when active:
hunt: {
  phase: 'moving' | 'hunting',
  targetId: number,    // id of the NPC being hunted
  elapsed: number,     // ms of game time elapsed in 'hunting' phase
  duration: number,    // ms of game time required to complete (1h = 3_600_000)
}
```

- `'moving'` — player is pathfinding toward the NPC
- `'hunting'` — both characters are frozen; timer is counting down

---

## 2. New module: `simulation/hunt.js`

Exports three functions:

```js
startHunt(playerChar, npcChar, intersections)
updateHunts(characters, dt, onHuntComplete)
cancelHunt(playerChar, characters)
```

### `startHunt(playerChar, npcChar, intersections)`

- Sets `playerChar.hunt = { phase: 'moving', targetId: npcChar.id, elapsed: 0, duration: 3_600_000 }`
- Calls `setCharacterDestination(playerChar, { type: 'node', nodeId: npcChar.from })` — player moves to NPC using existing pathfinding

### `updateHunts(characters, dt, onHuntComplete)`

Called from `stepSimulation` in `main.js` with the current game-time delta.

For each character with `hunt.phase === 'moving'`:
- Find NPC by `hunt.targetId`
- If player has reached NPC's node (`playerChar.from === npcChar.from` and `playerChar.path.length === 0`):
  - Transition to `'hunting'`
  - Clear paths of both characters (freeze movement)

For each character with `hunt.phase === 'hunting'`:
- `hunt.elapsed += dt`
- If `hunt.elapsed >= hunt.duration`: call `onHuntComplete(playerChar, npcChar)`, clear `playerChar.hunt`

### `cancelHunt(playerChar, characters)`

- Sets `playerChar.hunt = null`
- Finds NPC by `hunt.targetId` and restores normal movement (NPC resumes random pathfinding on next `updateCharacter` tick)

---

## 3. Interaction changes (`ui/interaction.js`)

### New modes

| Mode | Description |
|------|-------------|
| `'hunt_picking'` | Player chose "Hunt" from their menu; waiting for NPC click |
| `'npc_menu_open'` | NPC was clicked while player menu was open; shows NPC context menu |

### Player menu items (context-dependent)

When player is **not hunting** (`hunt == null`):
```
Choose destination | Hunt | Cancel
```
`Hunt` is only shown when `playerChar.capabilities.includes('hunt')`.

When player **is hunting** (`hunt != null`):
```
Cancel hunt | Cancel
```

### NPC context menu (`npc_menu_open`)

Rendered above the NPC using the same layout as the player menu:
```
Hunt | Cancel
```

Clicking `Hunt` in either the NPC context menu or confirming an NPC in `hunt_picking` mode calls `onStartHunt(playerChar, npcChar)` and closes all menus.

### NPC hit detection

In `hunt_picking` mode and when player menu is open, `findCharacterAtPoint` searches all characters (not only players). The existing player-only filter is extracted so NPC search can be done separately.

### New callback

`createInteractionController` receives a new `onStartHunt(playerChar, npcChar)` callback alongside the existing `onAssignDestination`.

---

## 4. Renderer changes (`renderer/canvas.js`)

### Hunt timer ring

Drawn above a player character when `hunt.phase === 'hunting'`:

- Radius: 20px (larger than the selection ring at ~10px)
- Background arc: `rgba(180, 0, 0, 0.3)`, full circle
- Fill arc: `#ff2244`, grows clockwise from top (–π/2)
- Progress: `hunt.elapsed / hunt.duration` (0 → 1)
- Line width: 3px

### Success animation

Driven by `state.notifications` in `main.js`. Each notification lives for 2500ms of real time.

For each active `hunt_success` notification:
- **Flash**: white/gold circle around the player character; alpha fades linearly to 0
- **Floating text**: `"Hunt successful!"` above the character; drifts upward ~8px and fades out

---

## 5. Player panel (`ui/playerPanel.js`)

Each player card shows a status row when `hunt != null`:

| Phase | Display |
|-------|---------|
| `'moving'` | `🏹 Zmierza do celu...` |
| `'hunting'` | `🏹 Polowanie... 47%` (percent from `elapsed / duration`) |
| Success (from notification, ~3s) | `✓ Polowanie zakończone sukcesem` |

The status row replaces/supplements the existing destination info row in the card.

---

## 6. `main.js` wiring

```js
import { startHunt, updateHunts, cancelHunt } from './simulation/hunt.js';
```

`state` gains a `notifications` array:
```js
notifications: [],  // { type: 'hunt_success', characterId, createdAt }
```

Inside `stepSimulation(dt)`:
```js
updateHunts(state.characters, dt, onHuntComplete);
```

`onHuntComplete(playerChar, npcChar)`:
```js
state.characters = state.characters.filter(c => c.id !== npcChar.id);
playerChar.hunt = null;
state.notifications.push({
  type: 'hunt_success',
  characterId: playerChar.id,
  createdAt: performance.now(),
});
```

Inside `tick()`, expire old notifications:
```js
state.notifications = state.notifications.filter(
  n => performance.now() - n.createdAt < 2500
);
```

---

## Files changed

| File | Change |
|------|--------|
| `entities/character.js` | Add `capabilities: []` and `hunt: null` to character model |
| `simulation/hunt.js` | **New** — `startHunt`, `updateHunts`, `cancelHunt` |
| `ui/interaction.js` | New modes `hunt_picking`, `npc_menu_open`; context-dependent menus; `onStartHunt` callback |
| `renderer/canvas.js` | Hunt timer ring; success flash + floating text |
| `ui/playerPanel.js` | Hunt status row in player card |
| `main.js` | Import hunt module; `state.notifications`; `onHuntComplete`; notification expiry |
