# Non-Uniform Day/Night Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the day phase (06:00–20:00) pass ~4× faster in real time than currently, extending the night to 3 real minutes, so the total game cycle is ≈3 min 44 sec.

**Architecture:** The non-uniform real→game time mapping lives entirely in `clock.js`. The clock exposes `sliderFraction` (real-time position in cycle) and `getGameRate()` (current game ms per real ms) so consumers don't need to know about the piecewise logic. `dayDisplay.js` uses `sliderFraction` for the thumb and imports `gameHourToSliderPercent` for static divider positions. `main.js` replaces the old `GAME_CLOCK_RATIO` constant with the dynamic `getGameRate()` call.

**Tech Stack:** Vanilla JS, Canvas API, ES modules, no build step. Test by opening `index.html` in a browser.

---

## File Map

| File | Change |
|---|---|
| `simulation/clock.js` | Full rewrite: new constants, piecewise `getState`, new `getGameRate`, new `gameHourToSliderPercent` |
| `simulation/hunt.js` | Remove `GAME_HOUR_SIM_MS` import → local constant |
| `main.js` | Remove `GAME_CLOCK_RATIO` import, use `clock.getGameRate()` in sub-step loop |
| `ui/dayDisplay.js` | Import `gameHourToSliderPercent`, use `sliderFraction` for thumb, recompute `--day-start-percent` |

---

## Task 1: Rewrite `clock.js` with non-uniform mapping

**Files:**
- Modify: `simulation/clock.js`

This task replaces the uniform `timeMs * GAME_CLOCK_RATIO` mapping with a piecewise function. One cycle = 3 min 43.75 sec real time (night: 3 min, day: 43.75 sec). Exports three new things: `CYCLE_REAL_MS`, `getGameRate()` method, `gameHourToSliderPercent()` function. Removes `DAY_REAL_MS`, `GAME_CLOCK_RATIO`, `GAME_HOUR_SIM_MS`.

- [ ] **Step 1: Replace the entire contents of `simulation/clock.js`**

```js
// Real-time durations per phase
export const NIGHT_REAL_MS = 180_000;       // 3 min real = 10 game hours (20:00–06:00)
export const DAY_PHASE_REAL_MS = 43_750;    // ~43.75 sec real = 14 game hours (06:00–20:00)
export const CYCLE_REAL_MS = NIGHT_REAL_MS + DAY_PHASE_REAL_MS; // 223_750 ms ≈ 3 min 44 sec

const GAME_DAY_MS = 24 * 60 * 60 * 1000;

// Within one cycle (starting at game time 00:00):
//   Segment 1 — night part 1: 00:00–06:00 (6 of 10 night hours)
//   Segment 2 — day:          06:00–20:00 (14 hours)
//   Segment 3 — night part 2: 20:00–24:00 (4 of 10 night hours)
const NIGHT1_REAL_MS = NIGHT_REAL_MS * 6 / 10; // 108_000
const NIGHT2_REAL_MS = NIGHT_REAL_MS * 4 / 10; // 72_000
const DAY_START_REAL_MS = NIGHT1_REAL_MS;                         // 108_000
const NIGHT2_START_REAL_MS = NIGHT1_REAL_MS + DAY_PHASE_REAL_MS; // 151_750

const NIGHT_RATE = (10 * 3_600_000) / NIGHT_REAL_MS;     // 200 game ms / real ms
const DAY_RATE = (14 * 3_600_000) / DAY_PHASE_REAL_MS;   // 1152 game ms / real ms

// Converts a position within one cycle (real ms, 0–CYCLE_REAL_MS) to game ms (0–GAME_DAY_MS)
function realToCycleGameMs(posInCycle) {
  if (posInCycle < DAY_START_REAL_MS) {
    return posInCycle * NIGHT_RATE;
  }
  if (posInCycle < NIGHT2_START_REAL_MS) {
    return 6 * 3_600_000 + (posInCycle - DAY_START_REAL_MS) * DAY_RATE;
  }
  return 20 * 3_600_000 + (posInCycle - NIGHT2_START_REAL_MS) * NIGHT_RATE;
}

const PHASES = [
  { label: 'Głęboka noc', startHour: 1, isDangerous: false },
  { label: 'Przed świtem', startHour: 3, isDangerous: true },
  { label: 'Świt', startHour: 5, isDangerous: true },
  { label: 'Rano', startHour: 6, isDangerous: false },
  { label: 'Południe', startHour: 11, isDangerous: false },
  { label: 'Popołudnie', startHour: 14, isDangerous: false },
  { label: 'Zmierzch', startHour: 18, isDangerous: false },
  { label: 'Noc', startHour: 20, isDangerous: false },
  { label: 'Północ', startHour: 23, isDangerous: false },
];

const MONTHS = [
  { name: 'stycznia', days: 31 },
  { name: 'lutego', days: 28 },
  { name: 'marca', days: 31 },
  { name: 'kwietnia', days: 30 },
  { name: 'maja', days: 31 },
  { name: 'czerwca', days: 30 },
  { name: 'lipca', days: 31 },
  { name: 'sierpnia', days: 31 },
  { name: 'września', days: 30 },
  { name: 'października', days: 31 },
  { name: 'listopada', days: 30 },
  { name: 'grudnia', days: 31 },
];

const DAYS_OF_WEEK = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

const JAN1_2026_DOW = 3;

function getPhase(hour) {
  let result = PHASES[PHASES.length - 1];
  for (const phase of PHASES) {
    if (phase.startHour <= hour) {
      result = phase;
    }
  }
  return result;
}

function getCalendarDate(dayOfYear0) {
  const dow = (JAN1_2026_DOW + dayOfYear0) % 7;
  let remaining = dayOfYear0;

  for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex += 1) {
    if (remaining < MONTHS[monthIndex].days) {
      return {
        day: remaining + 1,
        month: monthIndex + 1,
        monthName: MONTHS[monthIndex].name,
        dayOfWeek: dow,
        dayOfWeekName: DAYS_OF_WEEK[dow],
      };
    }
    remaining -= MONTHS[monthIndex].days;
  }

  return getCalendarDate(0);
}

// Converts a game hour (0–23) to its real-time position on the slider (0–100%).
// Slider origin is 20:00 (left edge = night start).
// Night section: 0–80.4%, Day section: 80.4–100%.
export function gameHourToSliderPercent(hour) {
  let realFromNightStart;
  if (hour >= 20 || hour < 6) {
    const nightHoursFromOrigin = (hour - 20 + 24) % 24;
    realFromNightStart = nightHoursFromOrigin * (NIGHT_REAL_MS / 10);
  } else {
    realFromNightStart = NIGHT_REAL_MS + (hour - 6) * (DAY_PHASE_REAL_MS / 14);
  }
  return (realFromNightStart / CYCLE_REAL_MS) * 100;
}

export function createClock(startDayOfYear) {
  return {
    // Returns current game state for a given real elapsed time (ms).
    // sliderFraction (0–1): real-time position in the visual cycle starting from 20:00.
    getState(timeMs) {
      const cycleIndex = Math.floor(timeMs / CYCLE_REAL_MS);
      const posInCycle = timeMs % CYCLE_REAL_MS;
      const cycleGameMs = realToCycleGameMs(posInCycle);
      const totalGameMs = cycleIndex * GAME_DAY_MS + cycleGameMs;

      const hour = Math.floor(totalGameMs / 3_600_000) % 24;
      const minute = Math.floor(totalGameMs / 60_000) % 60;
      const dayNumber = cycleIndex + 1;
      const dayOfYear0 = (startDayOfYear - 1 + cycleIndex) % 365;

      // Slider fraction: rotate cycle origin from 00:00 to 20:00
      const sliderFraction = (posInCycle + NIGHT2_REAL_MS) % CYCLE_REAL_MS / CYCLE_REAL_MS;

      return {
        hour,
        minute,
        phase: getPhase(hour),
        dayNumber,
        date: getCalendarDate(dayOfYear0),
        sliderFraction,
      };
    },

    // Returns the game ms that pass per real ms at the given real time.
    // Use this to convert real-time deltas to game-time deltas for simulation mechanics.
    getGameRate(realMs) {
      const posInCycle = realMs % CYCLE_REAL_MS;
      const isDaytime = posInCycle >= DAY_START_REAL_MS && posInCycle < NIGHT2_START_REAL_MS;
      return isDaytime ? DAY_RATE : NIGHT_RATE;
    },
  };
}
```

- [ ] **Step 2: Open `index.html` in a browser and verify the clock works**

Expected:
- Time display (e.g. "Rano  08:30") updates and hours advance correctly
- The game cycle completes (midnight to midnight) in roughly 3 min 44 sec at 1× speed
- No console errors

- [ ] **Step 3: Commit**

```bash
git add simulation/clock.js
git commit -m "feat: non-uniform day/night clock — day 4× faster, night 3 min"
```

---

## Task 2: Fix `hunt.js` — remove `GAME_HOUR_SIM_MS` import

**Files:**
- Modify: `simulation/hunt.js`

`GAME_HOUR_SIM_MS` is no longer exported from `clock.js`. Hunt duration should stay at the same real-time value (12,500 ms) to preserve existing behavior.

- [ ] **Step 1: Replace the import and constant at the top of `simulation/hunt.js`**

Remove:
```js
import { GAME_HOUR_SIM_MS } from './clock.js';

const HUNT_DURATION_MS = GAME_HOUR_SIM_MS;
```

Replace with:
```js
const HUNT_DURATION_MS = 12_500;
```

(12,500 ms = the previous value of `GAME_HOUR_SIM_MS = DAY_REAL_MS / 24 = 300_000 / 24`)

- [ ] **Step 2: Open `index.html` and verify hunts still complete normally**

Expected: hunt action completes in roughly the same time as before (~12.5 real seconds at 1× speed). No console errors.

- [ ] **Step 3: Commit**

```bash
git add simulation/hunt.js
git commit -m "fix: move HUNT_DURATION_MS to local constant in hunt.js"
```

---

## Task 3: Update `main.js` — replace `GAME_CLOCK_RATIO` with `getGameRate`

**Files:**
- Modify: `main.js`

Blood decay must use the correct game-time delta per sub-step. During day the game clock runs faster, so more game time (and thus more blood decay) occurs per real second.

- [ ] **Step 1: Update the import line at the top of `main.js`**

Remove `GAME_CLOCK_RATIO` from the clock import:

```js
import { createClock } from './simulation/clock.js';
```

- [ ] **Step 2: Update the `stepSimulation` sub-step loop in `main.js`**

Find the `while (remaining > 0)` loop (around line 228). Replace the `updateBlood` call to use `clock.getGameRate()`:

```js
  while (remaining > 0) {
    const currentStep = Math.min(stepMs, remaining);
    updateCharacters(currentStep / 1000);
    updateHunts(state.characters, currentStep, onHuntComplete);
    const stepStartRealMs = state.timeMs - remaining;
    updateBlood(
      state.characters,
      currentStep * clock.getGameRate(stepStartRealMs),
      state.city?.districts.filter((district) => district.isPlayerOwned),
    );
    remaining -= currentStep;
  }
```

- [ ] **Step 3: Open `index.html` and verify blood mechanics work**

Expected:
- Blood stat updates on the player panel as usual
- During daytime (06:00–20:00) blood drains noticeably faster than at night (the game clock runs ~5.76× faster during day)
- No console errors

- [ ] **Step 4: Commit**

```bash
git add main.js
git commit -m "fix: use clock.getGameRate() for game-time delta in blood updates"
```

---

## Task 4: Update `dayDisplay.js` — non-uniform slider

**Files:**
- Modify: `ui/dayDisplay.js`

The slider thumb must reflect real-time position (`sliderFraction` from clock state). The static dividers and the day/night boundary must be repositioned using `gameHourToSliderPercent`.

- [ ] **Step 1: Replace the entire contents of `ui/dayDisplay.js`**

```js
import { gameHourToSliderPercent } from '../simulation/clock.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

// Real-time position of 06:00 on the slider (~80.4%).
// Slider origin is 20:00 (left edge = night start).
const DAY_START_PERCENT = gameHourToSliderPercent(6);

const PHASE_DIVIDER_HOURS = [23, 1, 3, 5, 11, 14, 18];
const DAY_START_HOUR = 6;
const NIGHT_START_HOUR = 20;

export function createDayDisplay({ mount }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'day-display';
  wrapper.style.setProperty('--day-start-percent', `${DAY_START_PERCENT}%`);

  const phaseEl = document.createElement('div');
  phaseEl.className = 'day-display__phase';

  const timelineEl = document.createElement('div');
  timelineEl.className = 'day-display__timeline';
  timelineEl.setAttribute('aria-hidden', 'true');

  const timelineTrackEl = document.createElement('div');
  timelineTrackEl.className = 'day-display__track';

  const timelineBoundaryEl = document.createElement('div');
  timelineBoundaryEl.className = 'day-display__boundary';

  const timelineThumbEl = document.createElement('div');
  timelineThumbEl.className = 'day-display__thumb';

  for (const dividerHour of PHASE_DIVIDER_HOURS) {
    const dividerEl = document.createElement('div');
    const dividerPercent = gameHourToSliderPercent(dividerHour);
    const isDayDivider = dividerHour > DAY_START_HOUR && dividerHour < NIGHT_START_HOUR;
    dividerEl.className = `day-display__divider${isDayDivider ? ' day-display__divider--day' : ''}`;
    dividerEl.style.setProperty('--divider-percent', `${dividerPercent}%`);
    timelineTrackEl.append(dividerEl);
  }

  timelineTrackEl.append(timelineBoundaryEl, timelineThumbEl);

  const timelineLabelsEl = document.createElement('div');
  timelineLabelsEl.className = 'day-display__labels';

  const nightLabelEl = document.createElement('span');
  nightLabelEl.textContent = 'Noc';

  const dayLabelEl = document.createElement('span');
  dayLabelEl.textContent = 'Dzień';

  timelineLabelsEl.append(nightLabelEl, dayLabelEl);
  timelineEl.append(timelineTrackEl, timelineLabelsEl);

  const dateEl = document.createElement('div');
  dateEl.className = 'day-display__date';

  wrapper.append(phaseEl, timelineEl, dateEl);
  mount.append(wrapper);

  return {
    update({ hour, minute, phase, dayNumber, date, sliderFraction }) {
      const icon = phase.label === 'Świt' ? ' ☠' : phase.isDangerous ? ' ⚠' : '';

      phaseEl.textContent = `${phase.label}${icon}  ${pad(hour)}:${pad(minute)}`;
      phaseEl.className = `day-display__phase${phase.isDangerous ? ' day-display__phase--dangerous' : ''}`;
      timelineEl.style.setProperty('--time-percent', `${sliderFraction * 100}%`);
      timelineThumbEl.className = `day-display__thumb${phase.isDangerous ? ' day-display__thumb--dangerous' : ''}`;
      dateEl.textContent = `${date.day} ${date.monthName} · ${date.dayOfWeekName} · Dzień ${dayNumber}`;
    },
  };
}
```

- [ ] **Step 2: Open `index.html` and verify the slider visually**

Expected:
- Night section occupies ~80% of the slider width (left side)
- Day section occupies ~20% of the slider width (right side)
- The thumb moves through the night section slowly (3 min) and through the day section fast (~44 sec)
- The day/night boundary line is near the right end of the slider
- Phase dividers are positioned proportionally (night dividers spread over 80%, day dividers bunched on the right 20%)
- No console errors

- [ ] **Step 3: Commit**

```bash
git add ui/dayDisplay.js
git commit -m "feat: slider reflects real-time proportions — day section ~4× shorter"
```

---

## Verification Checklist

After all tasks are complete, do a full manual pass:

- [ ] Open `index.html`, set speed to 1×, watch one full cycle (~3 min 44 sec)
- [ ] Night (20:00–06:00): lasts ~3 min, thumb moves slowly through the wide night section
- [ ] Day (06:00–20:00): lasts ~44 sec, thumb zips through the narrow day section
- [ ] Hours displayed (e.g. "Popołudnie  14:23") advance correctly throughout
- [ ] Phase names change at the correct hours (Rano at 06:00, Zmierzch at 18:00, Noc at 20:00, etc.)
- [ ] Speed buttons (2×, 4×, 10×) still multiply both day and night equally
- [ ] Blood stat drains during day (check player panel — should drain fast during 06:00–20:00)
- [ ] Hunt action completes in ~12.5 sec real time regardless of day/night
- [ ] Date and day number advance correctly each cycle
