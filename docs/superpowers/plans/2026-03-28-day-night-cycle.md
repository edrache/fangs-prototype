# Day/Night Cycle & Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a game clock with a 5-minute real-time day cycle, 9 named phases (night heavily subdivided for the vampire theme), and a UI strip showing current phase, time, and full calendar date.

**Architecture:** A pure `simulation/clock.js` module derives all state from `state.timeMs` (no internal state). A `ui/dayDisplay.js` component renders two text lines into the existing `#time-controls` flex row. `main.js` recreates the clock on each `regenerate()` so the random start day changes with the seed.

**Tech Stack:** Vanilla ES modules, Canvas API (no changes), DOM manipulation.

---

## File map

| File | Action | Responsibility |
|------|--------|---------------|
| `simulation/clock.js` | Create | Pure phase + calendar logic |
| `ui/dayDisplay.js` | Create | DOM rendering of clock state |
| `index.html` | Modify | CSS for `.day-display` |
| `main.js` | Modify | Wire clock + dayDisplay, random start day |

---

### Task 1: `simulation/clock.js` — phase and calendar logic

**Files:**
- Create: `simulation/clock.js`

- [ ] **Step 1: Create `simulation/clock.js` with full implementation**

```js
const DAY_REAL_MS = 5 * 60 * 1000;       // 300 000 real ms = 1 game day
const GAME_DAY_MS = 24 * 60 * 60 * 1000; // 86 400 000 game ms
const RATIO = GAME_DAY_MS / DAY_REAL_MS;  // 288 — game ms per real ms

// Sorted ascending by startHour. Entries before midnight (1, 3, 5) come first.
// getPhase() scans linearly; last match wins. Hour 0 matches nothing → falls
// back to the final entry (Północ), which is correct: 0:00 is still "Północ".
const PHASES = [
  { label: 'Głęboka noc',  startHour: 1,  isDangerous: false },
  { label: 'Przed świtem', startHour: 3,  isDangerous: true  },
  { label: 'Świt',         startHour: 5,  isDangerous: true  },
  { label: 'Rano',         startHour: 6,  isDangerous: false },
  { label: 'Południe',     startHour: 11, isDangerous: false },
  { label: 'Popołudnie',   startHour: 14, isDangerous: false },
  { label: 'Zmierzch',     startHour: 18, isDangerous: false },
  { label: 'Noc',          startHour: 20, isDangerous: false },
  { label: 'Północ',       startHour: 23, isDangerous: false },
];

const MONTHS = [
  { name: 'stycznia',    days: 31 },
  { name: 'lutego',      days: 28 },
  { name: 'marca',       days: 31 },
  { name: 'kwietnia',    days: 30 },
  { name: 'maja',        days: 31 },
  { name: 'czerwca',     days: 30 },
  { name: 'lipca',       days: 31 },
  { name: 'sierpnia',    days: 31 },
  { name: 'września',    days: 30 },
  { name: 'października', days: 31 },
  { name: 'listopada',   days: 30 },
  { name: 'grudnia',     days: 31 },
];

const DAYS_OF_WEEK = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

// Jan 1 2026 = Thursday = index 3 (0=Mon … 6=Sun)
const JAN1_2026_DOW = 3;

function getPhase(hour) {
  let result = PHASES[PHASES.length - 1]; // Północ — default for hour 0
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
  for (let m = 0; m < MONTHS.length; m++) {
    if (remaining < MONTHS[m].days) {
      return {
        day: remaining + 1,
        month: m + 1,
        monthName: MONTHS[m].name,
        dayOfWeek: dow,
        dayOfWeekName: DAYS_OF_WEEK[dow],
      };
    }
    remaining -= MONTHS[m].days;
  }
  // Fallback — unreachable with valid 0–364 input
  return getCalendarDate(0);
}

export function createClock(startDayOfYear) {
  return {
    getState(timeMs) {
      const totalGameMs = timeMs * RATIO;
      const hour      = Math.floor(totalGameMs / 3_600_000) % 24;
      const minute    = Math.floor(totalGameMs / 60_000) % 60;
      const dayNumber = Math.floor(totalGameMs / GAME_DAY_MS) + 1;
      const dayOfYear0 = (startDayOfYear - 1 + dayNumber - 1) % 365;

      return {
        hour,
        minute,
        phase: getPhase(hour),
        dayNumber,
        date: getCalendarDate(dayOfYear0),
      };
    },
  };
}
```

- [ ] **Step 2: Verify logic in browser console**

Load `http://127.0.0.1:8080/index.html`, open DevTools console and paste:

```js
const { createClock } = await import('./simulation/clock.js');
const c = createClock(1); // Jan 1 2026

// Hour 0 → Północ (wraps from previous day)
const t0 = c.getState(0);
console.assert(t0.hour === 0, 'hour');
console.assert(t0.phase.label === 'Północ', `phase at 0h: ${t0.phase.label}`);

// 37 500 real ms → 3:00 game time → Przed świtem
const t3 = c.getState(37_500);
console.assert(t3.hour === 3, `hour at 3h: ${t3.hour}`);
console.assert(t3.phase.label === 'Przed świtem', `phase: ${t3.phase.label}`);
console.assert(t3.phase.isDangerous === true, 'dangerous');

// 62 500 real ms → 5:00 → Świt
const t5 = c.getState(62_500);
console.assert(t5.phase.label === 'Świt', `phase: ${t5.phase.label}`);

// 75 000 real ms → 6:00 → Rano
const t6 = c.getState(75_000);
console.assert(t6.phase.label === 'Rano', `phase: ${t6.phase.label}`);

// 300 000 real ms → day 2
const tDay2 = c.getState(300_000);
console.assert(tDay2.dayNumber === 2, `dayNumber: ${tDay2.dayNumber}`);
console.assert(tDay2.date.day === 2, `calendar day: ${tDay2.date.day}`);
console.assert(tDay2.date.monthName === 'stycznia', `month: ${tDay2.date.monthName}`);
console.assert(tDay2.date.dayOfWeekName === 'Piątek', `weekday: ${tDay2.date.dayOfWeekName}`);

// startDayOfYear=31 → Jan 31 → Feb 1 on day 2
const cFeb = createClock(31);
const tFeb = cFeb.getState(300_000);
console.assert(tFeb.date.monthName === 'lutego', `Feb: ${tFeb.date.monthName}`);

console.log('All clock assertions passed');
```

Expected output: `All clock assertions passed` with no assertion errors.

- [ ] **Step 3: Commit**

```bash
git add simulation/clock.js
git commit -m "feat: add simulation/clock.js — pure game clock and calendar"
```

---

### Task 2: `ui/dayDisplay.js` — DOM rendering component

**Files:**
- Create: `ui/dayDisplay.js`

- [ ] **Step 1: Create `ui/dayDisplay.js`**

```js
function pad(n) {
  return String(n).padStart(2, '0');
}

export function createDayDisplay({ mount }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'day-display';

  const phaseEl = document.createElement('div');
  phaseEl.className = 'day-display__phase';

  const dateEl = document.createElement('div');
  dateEl.className = 'day-display__date';

  wrapper.append(phaseEl, dateEl);
  mount.append(wrapper);

  return {
    update({ hour, minute, phase, dayNumber, date }) {
      const icon = phase.label === 'Świt' ? ' ☠' : phase.isDangerous ? ' ⚠' : '';
      phaseEl.textContent = `${phase.label}${icon}  ${pad(hour)}:${pad(minute)}`;
      phaseEl.className = `day-display__phase${phase.isDangerous ? ' day-display__phase--dangerous' : ''}`;
      dateEl.textContent = `${date.day} ${date.monthName} · ${date.dayOfWeekName} · Dzień ${dayNumber}`;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/dayDisplay.js
git commit -m "feat: add ui/dayDisplay.js — day/phase display component"
```

---

### Task 3: CSS in `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add `.day-display` CSS before the `@media` block**

Find this line in `index.html`:
```css
    @media (max-width: 760px) {
```

Insert the following block immediately before it:

```css
    .day-display {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0 8px;
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

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "style: add day-display CSS to index.html"
```

---

### Task 4: Wire everything in `main.js`

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Add imports at the top of `main.js`**

After the existing import block, add:

```js
import { createClock } from './simulation/clock.js';
import { createDayDisplay } from './ui/dayDisplay.js';
```

- [ ] **Step 2: Add `startDayOfYear` to `state`**

Find:
```js
const state = {
  city: null,
  characters: [],
  frame: 0,
  timeMs: 0,
  lastTickMs: performance.now(),
};
```

Replace with:
```js
const state = {
  city: null,
  characters: [],
  frame: 0,
  timeMs: 0,
  lastTickMs: performance.now(),
  startDayOfYear: 1,
};
```

- [ ] **Step 3: Create `clock` and `dayDisplay` before `createTimeControls`**

Find:
```js
createTimeControls({
  mount: timeControlsPanel,
  onSpeedChange(scale) {
    timeScale = scale;
  },
});
```

Insert immediately before it:
```js
let clock = createClock(1);
const dayDisplay = createDayDisplay({ mount: timeControlsPanel });

```

The `dayDisplay` div is appended to `#time-controls` before the speed buttons, so it sits between the toggle button and the speed row.

- [ ] **Step 4: Update `render()` to call `dayDisplay.update()`**

Find:
```js
function render() {
  const interactionState = interaction.getState();
  renderCity(ctx, state.city, state.characters, interactionState);
  playerPanel.update(interactionState);
}
```

Replace with:
```js
function render() {
  const interactionState = interaction.getState();
  renderCity(ctx, state.city, state.characters, interactionState);
  playerPanel.update(interactionState);
  dayDisplay.update(clock.getState(state.timeMs));
}
```

- [ ] **Step 5: Randomise `startDayOfYear` and recreate `clock` in `regenerate()`**

Find the beginning of `regenerate()`:
```js
function regenerate() {
  state.city = generateCity(params);
  state.characters = createCharacters(state.city, params.seed, params.characters);
  state.frame = 0;
  state.timeMs = 0;
  state.lastTickMs = performance.now();
```

Replace with:
```js
function regenerate() {
  state.startDayOfYear = createRNG(params.seed ^ 0xDAD0C10C).int(1, 365);
  clock = createClock(state.startDayOfYear);
  state.city = generateCity(params);
  state.characters = createCharacters(state.city, params.seed, params.characters);
  state.frame = 0;
  state.timeMs = 0;
  state.lastTickMs = performance.now();
```

- [ ] **Step 6: Verify visually in browser**

Load `http://127.0.0.1:8080/index.html`.

Check 1 — initial display:
- The `#time-controls` bar should show two lines of text between the `▲` toggle and the speed buttons.
- Line 1: phase name (uppercase) + time `HH:MM`.
- Line 2: date, weekday, day number.

Check 2 — time advances:
- Pause simulation (press `0`), then in console run:
  ```js
  window.advanceTime(37_500); // → 3:00 → Przed świtem
  ```
  Line 1 should turn amber and read `PRZED ŚWITEM ⚠  03:00`.

- Then:
  ```js
  window.advanceTime(25_000); // → 5:00 → Świt
  ```
  Line 1 should read `ŚWIT ☠  05:00`.

- Then:
  ```js
  window.advanceTime(12_500); // → 6:00 → Rano
  ```
  Colour returns to white: `RANO  06:00`.

Check 3 — day advances:
```js
window.advanceTime(300_000); // full extra day
```
Day number in line 2 increments by 1.

Check 4 — regenerate changes date:
- Click "In Sync" button. The date and day number reset and the start day may change (different seed produces different calendar start).

- [ ] **Step 7: Commit**

```bash
git add main.js
git commit -m "feat: wire day/night cycle clock and day display into main loop"
```
