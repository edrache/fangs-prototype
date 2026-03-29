# Player Characters — Design Spec

**Date:** 2026-03-28
**Stage:** 1 — Player character distinction and panel
**Tech:** Vanilla HTML/JavaScript, Canvas API, no external dependencies

---

## Overview

A configurable subset of characters is designated as player-controlled. Player characters are visually distinct on the map (diamond shape), respond to click interactions (action menu), and appear in a dedicated panel below the canvas. Non-player characters (NPCs) ignore click events. The `isPlayer` flag is mutable, so NPCs can be promoted to player characters at runtime.

---

## Configuration

```js
// main.js
const PLAYER_COUNT = 3;
```

Simple constant. Changing the number of player characters requires editing the file.

---

## Data Model

### New field on character object

```js
{
  // ...existing fields...
  isPlayer: false,  // true for player-controlled characters
}
```

### Initialization in `createCharacters()` (`main.js`)

```js
for (let index = 0; index < characterCount; index += 1) {
  const char = createCharacter(city.intersections, rng, index);
  char.isPlayer = index < PLAYER_COUNT;
  characters.push(char);
}
```

The first `PLAYER_COUNT` characters are player characters; the rest are NPCs.

### Runtime promotion

To promote an NPC to a player character:

```js
char.isPlayer = true;
```

No other changes required — the flag is checked at interaction and render time.

---

## Interaction Changes (`ui/interaction.js`)

### Click handling — idle mode

The action menu opens **only for player characters**:

```js
if (state.mode === 'idle') {
  if (clickedCharacter?.isPlayer) {
    openMenuForCharacter(clickedCharacter.id);
  }
  return;
}
```

Clicking an NPC is silently ignored.

### New export: `openMenuForCharacter(characterId)`

Made part of the public API so `ui/playerPanel.js` can trigger selection from the panel without a canvas click.

---

## Player Panel (`ui/playerPanel.js`)

New module. Exports:

```js
createPlayerPanel({ mount, getCharacters, onSelectCharacter })
```

Returns `{ update(interactionState) }`.

### Rendering

Called on every `render()` call (every animation frame) so that status lines — `w ruchu`, `bezczynna`, etc. — stay current as characters move. Also called on interaction state changes via `onChange`. Renders one card per character where `isPlayer === true`.

### Card contents

Each card shows:
- Color square (matching character color)
- Label: `Character N` (where N = character index + 1)
- Status line (derived from character state):
  - `bezczynna` — `path.length === 0 && destination === null`
  - `w ruchu` — `path.length > 0 && destination === null`
  - `target: node N` — `destination.type === 'node'`
  - `following: character N` — `destination.type === 'character'`

### Selection highlight

When `interactionState.selectedCharacterId === char.id`:
- Card border brightens (full character color opacity)
- Faint glow in character color

### Click behavior

Clicking a card calls `onSelectCharacter(char.id)`, which calls `interaction.openMenuForCharacter(id)`. This puts interaction into `menu_open` mode — same state as clicking the character on the canvas.

---

## HTML Structure (`index.html`)

New element added below `<canvas>`:

```html
<div id="player-panel"></div>
```

Styled as a horizontal bar, 900px wide, matching the visual style of `#controls` (dark background, subtle border).

---

## Renderer Changes (`renderer/canvas.js`)

### Character shape

```js
// Player character — diamond (square rotated 45°)
if (char.isPlayer) {
  ctx.save();
  ctx.translate(char.pos.x, char.pos.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
} else {
  // NPC — circle (existing behavior)
  ctx.arc(char.pos.x, char.pos.y, 4, 0, Math.PI * 2);
}
```

Trail, selection ring, and destination highlight are unchanged — they work for both shapes.

---

## Wiring in `main.js`

```js
const playerPanel = createPlayerPanel({
  mount: document.getElementById('player-panel'),
  getCharacters: () => state.characters,
  onSelectCharacter(characterId) {
    interaction.openMenuForCharacter(characterId);
    render();
  },
});
```

`playerPanel.update(interactionState)` is called inside `render()` (every frame) so character status lines stay live. It is also implicitly called on every interaction change since `onChange` already calls `render()`.

On `regenerate()`: panel updates automatically via the next `render()` call after `interaction.reset()`.

---

## File Change Summary

| File | Change |
|---|---|
| `main.js` | add `PLAYER_COUNT` constant; set `char.isPlayer` in `createCharacters()`; wire `playerPanel` |
| `entities/character.js` | add `isPlayer: false` field in `createCharacter()` |
| `ui/interaction.js` | gate menu on `isPlayer`; expose `openMenuForCharacter` in public API |
| `ui/playerPanel.js` | **new** — panel rendering and card click handling |
| `renderer/canvas.js` | diamond shape for `isPlayer === true` characters |
| `index.html` | add `#player-panel` element and its styles |

---

## Out of Scope

- Character statistics (future milestone)
- Custom names for player characters
- UI control for changing `PLAYER_COUNT` at runtime
- Demoting a player character back to NPC
- Multiple simultaneous selections across player panel and canvas
