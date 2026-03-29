# HP Trait Design

**Date:** 2026-03-29
**Branch:** codex/time-controls
**Status:** Approved

## Overview

A new trait `HP X` (health points) added to the existing Traits system. Player characters start with `HP 3` (3 maximum HP). HP is displayed as hearts in the player panel. A character whose HP reaches zero is marked dead and stops moving.

---

## HPTrait — `entities/traits/hp.js`

Factory function (not a singleton) because the trait carries data:

```js
export function createHpTrait(maxHp = 3) {
  return { id: 'hp', maxHp };
}
```

`maxHp` encodes the maximum HP for that character. The trait label "HP 3" derives from `trait.maxHp`.

---

## Character Model Changes

Two new fields added in `createCharacter`:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `hp` | `number` | `0` | Current HP |
| `dead` | `boolean` | `false` | Whether the character is dead |

`hp` is initialised to `0` at creation time. After trait assignment in `main.js`, `char.hp` is set to `trait.maxHp` — the same pattern used for `char.blood` with `VampireTrait`.

---

## Trait Registration — `entities/traits/index.js`

Add entry to `TRAIT_DEFINITIONS`:

```js
import { createHpTrait } from './hp.js';

{ id: 'hp', label: 'HP', trait: createHpTrait(3) }
```

`formatTraitLabel` in `playerPanel.js` renders the trait pill as "HP 3" using `trait.maxHp`.

---

## Death Mechanic — `simulation/hp.js`

New module, called from `main.js` alongside `updateBlood`:

```js
export function updateHp(characters) {
  for (const char of characters) {
    if (!char.traits?.some(t => t.id === 'hp')) continue;
    if (char.dead) continue;
    if (char.hp <= 0) {
      char.dead = true;
      char.frozen = true;
    }
  }
}
```

- Filters to characters with the `hp` trait
- Sets `char.dead = true` and `char.frozen = true` when HP reaches zero
- `frozen` ensures the existing `updateCharacter` guard stops all movement with no further changes

---

## Trait Assignment in `main.js`

After `createCharacters()`:

- **Player characters** (`char.isPlayer === true`): receive `createHpTrait(3)` and `char.hp = 3`
- `updateHp(characters)` called each tick in the game loop

---

## UI — Player Panel

A new HP row is added to `createCard` in `ui/playerPanel.js`, below the traits row. Visible only for characters that have the `hp` trait.

```
HP  ❤ ❤ ❤   3/3   ← full health
HP  ❤ ❤ ♡   2/3   ← 1 HP lost
HP  ♡ ♡ ♡   0/3   ← dead
```

- Filled heart `❤` for each current HP point
- Empty heart `♡` for each lost HP point
- Text counter `current/max` beside the hearts
- Dead characters: card receives class `player-card--dead` (greyed out via CSS)

`buildRenderSignature` extended to include `hp` and `dead` per character so diff-based re-renders work correctly.

`formatTraitLabel` renders trait `hp` as `"HP " + trait.maxHp` using `trait.maxHp`.

---

## File Summary

| File | Change |
|---|---|
| `entities/traits/hp.js` | New — `createHpTrait(maxHp)` factory |
| `entities/traits/index.js` | Add `hp` entry to `TRAIT_DEFINITIONS` |
| `entities/character.js` | Add `hp: 0`, `dead: false` to model |
| `simulation/hp.js` | New — `updateHp` function |
| `main.js` | Assign `createHpTrait(3)` to player characters; call `updateHp` each tick |
| `ui/playerPanel.js` | Add HP hearts row; extend render signature; update `formatTraitLabel` |

---

## Out of Scope for This Milestone

- Mechanism of HP loss (will come from other traits)
- HP loss animations or visual feedback beyond the hearts row
- HP restoration
- Non-player characters having HP
