# Non-Uniform Day/Night Time Design

**Date:** 2026-03-29
**Branch:** codex/time-controls
**Status:** Approved

## Goal

Day phase passes 4× faster in real time than it currently does. Night is extended to 3 real minutes. Total game cycle ≈ 3 min 44 sec. The slider reflects real-time proportions, so the day section is visually ~4× shorter than before. Displayed hours (06:00–20:00) remain correct.

## Parameters

| Constant | Value | Notes |
|---|---|---|
| `NIGHT_REAL_MS` | `180_000` | 3 min real time for night (10 game hours: 20:00–06:00) |
| `DAY_PHASE_REAL_MS` | `43_750` | ~43.75 sec real time for day (14 game hours: 06:00–20:00) |
| `CYCLE_REAL_MS` | `223_750` | full cycle = 3 min 43.75 sec |

Conversion rates:
- Night: `200` game ms per real ms (= 10 × 3 600 000 / 180 000)
- Day: `1 152` game ms per real ms (= 14 × 3 600 000 / 43 750)
- Day runs ~5.76× faster than night.

Old `DAY_REAL_MS` (5 min uniform cycle) and `GAME_CLOCK_RATIO` are removed.

## clock.js

### Cycle structure

One cycle starts at game time 00:00 and contains three segments:

| Segment | Game hours | Real ms |
|---|---|---|
| Night part 1 (00:00–06:00) | 6 h | 108 000 |
| Day (06:00–20:00) | 14 h | 43 750 |
| Night part 2 (20:00–24:00) | 4 h | 72 000 |

`NIGHT1_REAL_MS = 108_000`, `NIGHT2_REAL_MS = 72_000`.

### `getState(timeMs)` — piecewise mapping

```
cycleIndex = floor(timeMs / CYCLE_REAL_MS)
posInCycle = timeMs % CYCLE_REAL_MS

if posInCycle < NIGHT1_REAL_MS:
    gameMs = posInCycle * NIGHT_RATE                         // 00:00–06:00
elif posInCycle < NIGHT1_REAL_MS + DAY_PHASE_REAL_MS:
    gameMs = 6h_in_ms + (posInCycle - NIGHT1_REAL_MS) * DAY_RATE  // 06:00–20:00
else:
    gameMs = 20h_in_ms + (posInCycle - NIGHT1_REAL_MS - DAY_PHASE_REAL_MS) * NIGHT_RATE  // 20:00–24:00

totalGameMs = cycleIndex * GAME_DAY_MS + gameMs
hour = floor(totalGameMs / 3_600_000) % 24
minute = floor(totalGameMs / 60_000) % 60
```

Returns same shape as before: `{ hour, minute, phase, dayNumber, date, sliderFraction }`.

### `sliderFraction`

Real-time position within the current visual cycle (starting from 20:00, the left edge of the slider):

```
posInCycle = timeMs % CYCLE_REAL_MS
sliderFraction = (posInCycle + NIGHT2_REAL_MS) % CYCLE_REAL_MS / CYCLE_REAL_MS
```

where `NIGHT2_REAL_MS = 72_000` (real ms for the 20:00–24:00 night segment).

Derivation: the visual cycle starts at 20:00, which corresponds to `posInCycle = NIGHT1_REAL_MS + DAY_PHASE_REAL_MS = 151_750`. Shifting by `NIGHT2_REAL_MS = CYCLE_REAL_MS - 151_750` rotates that point to 0.

Range: 0 = 20:00 (start of night), ~0.804 = 06:00 (start of day), 1.0 = back to 20:00.

### `getGameRate(realMs)`

Returns the current game-ms-per-real-ms rate for the given real time:

```
posInCycle = realMs % CYCLE_REAL_MS
if NIGHT1_REAL_MS <= posInCycle < NIGHT1_REAL_MS + DAY_PHASE_REAL_MS:
    return DAY_RATE
else:
    return NIGHT_RATE
```

Used by `main.js` to compute game-time deltas for simulation mechanics (blood decay etc.).

### `gameHourToSliderPercent(hour)`

Converts a game hour to its real-time position on the slider (percent, 0–100), starting from 20:00:

- Night hours (20–24, 0–6): `nightGameHoursFromOrigin * (NIGHT_REAL_MS / 10) / CYCLE_REAL_MS * 100`
- Day hours (6–20): `(NIGHT_REAL_MS + (hour - 6) * (DAY_PHASE_REAL_MS / 14)) / CYCLE_REAL_MS * 100`

Exported from `clock.js`. Used by `dayDisplay.js` for divider positioning.

## dayDisplay.js

### Slider thumb position

`getTimelinePercent(hour, minute)` is removed. Instead, uses `sliderFraction * 100` from clock state.

### Day/night background boundary

`--day-start-percent` CSS variable:

- Current: ~41.7% (uniform 6h from 20:00 out of 24h)
- New: **80.4%** (`NIGHT_REAL_MS / CYCLE_REAL_MS * 100`)

Hardcoded as a constant in `dayDisplay.js` (imported or computed once at module load using `gameHourToSliderPercent(6)`).

### Phase dividers

`PHASE_DIVIDER_HOURS = [23, 1, 3, 5, 11, 14, 18]` positions are computed via `gameHourToSliderPercent(hour)` imported from `clock.js`, instead of the current `getTimelinePercentFromMinutes`.

### Day/night label positions

The `Night` / `Day` label layout is driven by `--day-start-percent`, so it updates automatically.

## main.js

### Blood decay game delta

Replace:
```js
updateBlood(state.characters, currentStep * GAME_CLOCK_RATIO, ...)
```

With:
```js
const stepStartRealMs = state.timeMs - remaining;
updateBlood(state.characters, currentStep * clock.getGameRate(stepStartRealMs), ...)
```

`GAME_CLOCK_RATIO` import is removed.

## What does NOT change

- `PHASES` array (hour thresholds): unchanged — hours still go 0–23 as before.
- `MONTHS`, `DAYS_OF_WEEK`, calendar logic: unchanged.
- Speed controls (1×, 2×, 4×, 10×): still multiply `elapsed` before passing to `stepSimulation`. The non-uniform mapping applies on top.
- Hunt and character movement: use real-time deltas (`dtSeconds`), unaffected.
- Blood decay semantics: still game-time based — during day, game time advances faster, so blood drains faster. This is intentional.

## Affected files

- `simulation/clock.js` — main change
- `ui/dayDisplay.js` — slider display
- `main.js` — remove `GAME_CLOCK_RATIO`, update `updateBlood` call
