# Traits System Design

**Date:** 2026-03-29
**Branch:** codex/time-controls
**Status:** Approved

## Overview

A trait is a composable behaviour object attached to a character. Traits can override movement, mark stat eligibility, or do both. The first two traits are **Flying** (straight-line movement ignoring streets) and **Vampire** (marker that activates the Blood stat).

---

## Trait Object Interface

```js
// Minimal contract every trait must satisfy
{
  id: string,                          // unique identifier, e.g. 'flying', 'vampire'
  update?(char, dt, ctx): boolean,     // optional; return true to claim the movement tick
}
```

`ctx` shape passed to every `update` hook:

```js
{ mapWidth, mapHeight, intersections, characters }
```

If any trait's `update` returns `true`, `updateCharacter` skips its default `stepAlongPath` logic and calls `pushTrail` before returning.

---

## Character Model Changes

Two new fields added in `createCharacter`:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `traits` | `TraitObject[]` | `[]` | Traits attached to this character |
| `flyTarget` | `{x,y}\|null` | `null` | Current fly destination (used by FlyingTrait) |

Fields `blood`, `maxBlood`, `hungry` already exist on all characters; they become meaningful only for characters with the Vampire trait.

---

## FlyingTrait — `entities/traits/flying.js`

Exported singleton: `FlyingTrait`.

### Behaviour

1. If `char.flyTarget === null`: pick a random target `{x: rng(0, mapWidth), y: rng(0, mapHeight)}` using `char.rng`.
2. Move `char.pos` toward `flyTarget` by `char.speed * dt` pixels in a straight line.
3. When remaining distance < 1 px: set `char.flyTarget = null` (new target picked next tick).
4. Return `true` to suppress default street movement.

Pola `path`, `from`, `to`, `progress` remain on the character object but are unused by flying characters.

---

## VampireTrait — `entities/traits/vampire.js`

Exported singleton: `VampireTrait`.

```js
export const VampireTrait = { id: 'vampire' };
```

No `update` hook — pure marker. Presence in `char.traits` means the character participates in Blood simulation.

---

## Blood Simulation — `simulation/blood.js`

Separate module, called from `main.js` alongside `updateHunts`.

```js
export function updateBlood(characters, dt, { clock, districts }) { ... }
```

- Filters: `char.traits.some(t => t.id === 'vampire')`
- Decay: ~35 % of `maxBlood` per in-game day, halved while character is in the player-owned district
- Hunt gain: +45 `blood` on `hunt_success` for the hunting character
- Sets `char.hungry = true` when `blood` falls below threshold (e.g. 30 % of `maxBlood`)
- Clamps `blood` to `[0, maxBlood]`

---

## Wiring in `updateCharacter`

Added block after the `frozen` guard, before `acquirePathFromDestination`:

```js
for (const trait of char.traits) {
  if (trait.update?.(char, dt, ctx)) {
    pushTrail(char);
    return;
  }
}
```

`ctx` is constructed once per call from function arguments passed down from `main.js`.

---

## Trait Assignment in `main.js`

After `createCharacters()`:

- **Player characters** (`char.isPlayer === true`): automatically receive `VampireTrait`.
- No character receives `FlyingTrait` by default in this milestone — it is available for future assignment.

---

## File Summary

| File | Change |
|---|---|
| `entities/character.js` | Add `traits: []`, `flyTarget: null` to model; add trait-hook loop in `updateCharacter`; thread `ctx` through |
| `entities/traits/flying.js` | New — `FlyingTrait` singleton |
| `entities/traits/vampire.js` | New — `VampireTrait` singleton |
| `simulation/blood.js` | New — `updateBlood` function |
| `main.js` | Apply `VampireTrait` to player characters; call `updateBlood` each tick |

---

## Out of Scope for This Milestone

- UI rendering for Blood stat (player panel bar, hunger warning) — separate task
- Any additional traits beyond Flying and Vampire
- Trait removal at runtime
