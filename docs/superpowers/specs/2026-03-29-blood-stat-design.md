# Blood Stat — Design Spec

**Date:** 2026-03-29
**Status:** Approved

## Summary

Add a Blood statistic to player characters. Blood decays over game time, increases on a successful Hunt, and triggers a visible hunger warning when it falls below a threshold. Decay is slower when the character is in a player-owned district. The mechanic is implemented in a new `simulation/blood.js` module; the Info action is represented as a `hungry` flag read directly by the player panel.

---

## 1. Character model changes (`entities/character.js`)

Three new fields added to every character:

```js
blood: 100,       // current value (number)
maxBlood: 100,    // per-character maximum (default 100, can be up to 300 for special characters)
hungry: false,    // true when blood < HUNGER_THRESHOLD * maxBlood
```

`blood` and `maxBlood` are numeric so that future characters with different capacities can be supported without structural changes.

---

## 2. New module: `simulation/blood.js`

### Constants

```js
const HUNGER_THRESHOLD = 0.2;           // hunger below 20% of maxBlood
const DECAY_PER_HOUR = 0.35 / 24;       // ~35% of maxBlood per game-day
const DISTRICT_DECAY_MULTIPLIER = 0.5;  // slower decay when in player's district
const HUNT_BLOOD_GAIN = 45;             // +45 Blood on successful hunt
```

### Exports

```js
updateBlood(characters, dt, playerDistricts)
applyHuntBloodGain(char)
```

### `updateBlood(characters, dt, playerDistricts)`

Called from `stepSimulation` in `main.js` with game-time delta in milliseconds.

For each character where `isPlayer === true`:
1. Determine decay multiplier: if the character's current node belongs to a player-owned district → `DISTRICT_DECAY_MULTIPLIER`, otherwise `1`
2. `char.blood -= (dt / 3_600_000) * DECAY_PER_HOUR * char.maxBlood * multiplier`
3. Clamp: `char.blood = Math.max(0, char.blood)`
4. Update hunger flag:
   - `char.hungry = char.blood < HUNGER_THRESHOLD * char.maxBlood`

### `applyHuntBloodGain(char)`

Called from `onHuntComplete` in `main.js`:

```js
char.blood = Math.min(char.maxBlood, char.blood + HUNT_BLOOD_GAIN);
```

If the gain pushes `blood` back above the hunger threshold, `updateBlood` will clear `hungry` on the next tick automatically.

---

## 3. Player Panel (`ui/playerPanel.js`)

### Blood bar

Each player card gains a Blood row below existing status lines:

```
Blood  [████████░░]  80
```

- Bar filled proportionally to `blood / maxBlood`
- Numeric value: `Math.floor(char.blood)` shown to the right
- Bar color:
  - Normal: dark red `#8b0000`
  - Hungry (`char.hungry === true`): bright red `#ff2244`

### Info notification — hunger

When `char.hungry === true`, a separate box appears above the Blood bar inside the card:

```
⚠ HUNGER!
```

- Dark background, red border, white text
- Visible for as long as `char.hungry === true`; disappears automatically when hunger clears
- No timeout — this is a persistent state indicator, not a transient toast

---

## 4. Wiring in `main.js`

```js
import { updateBlood, applyHuntBloodGain } from './simulation/blood.js';
```

Inside `stepSimulation(dt)`:

```js
updateBlood(state.characters, dt, state.city.playerDistricts);
```

Inside `onHuntComplete(playerChar, npcChar)`:

```js
applyHuntBloodGain(playerChar);
// ...existing logic (remove NPC, push hunt_success notification)
```

The player panel reads `char.blood` and `char.hungry` directly on every render frame — no new callbacks or events required.

---

## Files changed

| File | Change |
|------|--------|
| `entities/character.js` | Add `blood`, `maxBlood`, `hungry` fields in `createCharacter()` |
| `simulation/blood.js` | **New** — `updateBlood`, `applyHuntBloodGain` |
| `ui/playerPanel.js` | Blood bar and `⚠ HUNGER!` info box in player card |
| `main.js` | Import blood module; call `updateBlood` in `stepSimulation`; call `applyHuntBloodGain` in `onHuntComplete` |

---

## Out of Scope

- Blood effects on NPC characters
- Visual changes on the map canvas driven by Blood level
- Multiple simultaneous Info notifications per character
- Configurable `HUNT_BLOOD_GAIN` per NPC type
