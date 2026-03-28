# Day/Night Cycle & Calendar — Design Spec

**Date:** 2026-03-28
**Status:** Approved

## Summary

Add a game clock that tracks a full day/night cycle (5 real minutes = 1 game day at 1× speed). A UI panel shows the current phase of day, time, full calendar date, and day number since game start. The starting day is randomly picked from 1–365 using the map seed. No canvas visual changes in this milestone.

---

## 1. Time model

**Conversion:** 5 real minutes = 1 game day → 1 ms real = 4.8 game minutes.

`state.timeMs` in `main.js` already accumulates scaled game time (multiplied by `timeScale` before `stepSimulation`), so the clock needs no internal state. It is a pure function of `state.timeMs`.

**Reference year:** 2026. January 1, 2026 = Thursday. All weekdays are derived from this anchor.

**Starting day:** `state.startDayOfYear` (integer 1–365), randomised from `createRNG(seed ^ 0xDAD0C10C)` at each `regenerate()` call.

---

## 2. New module: `simulation/clock.js`

```js
createClock(startDayOfYear)
// returns { getState(timeMs) }
```

`getState(timeMs)` returns:

```js
{
  hour,          // 0–23
  minute,        // 0–59
  phase: {
    label,       // e.g. 'Przed świtem'
    isDangerous, // true for 'Przed świtem' and 'Świt'
  },
  dayNumber,     // 1-based, increments each midnight
  date: {
    day,          // 1–31
    month,        // 1–12
    monthName,    // e.g. 'lutego'
    dayOfWeek,    // 0=Mon … 6=Sun
    dayOfWeekName // e.g. 'Wtorek'
  }
}
```

No side effects. Same `timeMs` always returns the same result.

### Day phases

| Phase label | Start hour | `isDangerous` |
|-------------|-----------|---------------|
| Rano | 6 | false |
| Południe | 11 | false |
| Popołudnie | 14 | false |
| Zmierzch | 18 | false |
| Noc | 20 | false |
| Północ | 23 | false |
| Głęboka noc | 1 | false |
| Przed świtem | 3 | **true** |
| Świt | 5 | **true** |

Phase is determined by finding the last entry whose `startHour <= currentHour`, with midnight wrap-around.

### Calendar logic

- Months: Jan=31, Feb=28, Mar=31, Apr=30, May=31, Jun=30, Jul=31, Aug=31, Sep=30, Oct=31, Nov=30, Dec=31 (no leap year).
- `currentDayOfYear` (0-indexed) = `(startDayOfYear - 1 + dayNumber - 1) % 365`
- Day of week = `(3 + startDayOfYear - 1 + dayNumber - 1) % 7` where 0=Mon, 3=Thu (Jan 1 2026 anchor).

---

## 3. New module: `ui/dayDisplay.js`

```js
createDayDisplay({ mount })
// returns { update(clockState) }
```

Inserts a single `<div class="day-display">` into the provided `mount` element. The caller places it inside `#time-controls` between the toggle button and the speed buttons.

### Rendered output (two lines)

```
PRZED ŚWITEM  ⚠  03:47
16 lutego · Wtorek · Dzień 47
```

- Line 1: phase label (uppercase) + danger icon (`⚠` for `isDangerous`, `☠` specifically for Świt) + `HH:MM`.
- Line 2: `D monthName · DayOfWeek · Dzień N`.
- Dangerous phases use a warm amber/red colour (`#ffb347` or similar); all others use the standard muted `#9ca6c7` / `#f2f5ff` palette.

### CSS additions (`index.html`)

```css
.day-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.day-display__phase {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #f2f5ff;
}

.day-display__phase--dangerous {
  color: #ffb060;
}

.day-display__date {
  font-size: 10px;
  color: #9ca6c7;
}
```

---

## 4. Changes to `main.js`

1. Import `createClock` from `./simulation/clock.js`.
2. Import `createDayDisplay` from `./ui/dayDisplay.js`.
3. Add `startDayOfYear: 1` to `state` (overwritten in `regenerate()`).
4. After existing module setup, create `clock` and `dayDisplay`:
   ```js
   const clock = createClock(state.startDayOfYear);
   const dayDisplay = createDayDisplay({ mount: /* span inside #time-controls */ });
   ```
   Because `startDayOfYear` changes on regenerate, `clock` must be recreated in `regenerate()` or `createClock` must accept a mutable getter. **Decision: recreate `clock` in `regenerate()`** — simplest, no mutable references.
5. In `render()`, add:
   ```js
   dayDisplay.update(clock.getState(state.timeMs));
   ```

`state.startDayOfYear` is set in `regenerate()` by drawing from `createRNG(params.seed ^ 0xDAD0C10C)`.

---

## 5. Changes to `index.html`

Add a `<span id="day-display-mount"></span>` inside `#time-controls`, between `#panel-toggle` and the speed buttons rendered by `timeControls.js`. Mount is passed to `createDayDisplay`.

Add CSS from Section 3.

---

## Files changed

| File | Change |
|------|--------|
| `simulation/clock.js` | New — pure calendar + phase logic |
| `ui/dayDisplay.js` | New — renders date/phase into DOM |
| `main.js` | Wire clock and dayDisplay; randomise `startDayOfYear` |
| `index.html` | Mount element + CSS for `.day-display` |
