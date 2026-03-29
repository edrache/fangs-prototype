# Blood Stat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Blood statistic to player characters that decays over game time, refills on Hunt, and shows a hunger warning in the player panel.

**Architecture:** Blood logic lives in a new `simulation/blood.js` module (same pattern as `simulation/hunt.js`). The character model gains three fields (`blood`, `maxBlood`, `hungry`). The player panel reads these fields directly every render frame — no events or callbacks needed.

**Tech Stack:** Vanilla JS ES modules, Canvas API, no external dependencies. No automated tests — verification is visual in the browser via `python3 -m http.server 8080`.

---

## File Map

| File | Change |
|------|--------|
| `entities/character.js` | Add `blood`, `maxBlood`, `hungry` fields in `createCharacter()` |
| `simulation/blood.js` | **New** — `updateBlood`, `applyHuntBloodGain` |
| `ui/playerPanel.js` | Add Blood bar row and `⚠ HUNGER!` box to each player card |
| `index.html` | Add CSS for `.blood-bar`, `.blood-bar__fill`, `.hunger-notice` |
| `main.js` | Import blood module; call `updateBlood` in `stepSimulation`; call `applyHuntBloodGain` in `onHuntComplete`; expose `blood` in `render_game_to_text` |

---

## Task 1: Add Blood fields to character model

**Files:**
- Modify: `entities/character.js:243-259`

- [ ] **Step 1: Add three fields to `createCharacter()`**

In `entities/character.js`, find the object literal inside `createCharacter()` (around line 243). Add `blood`, `maxBlood`, and `hungry` after `frozen`:

```js
  const char = {
    id: colorIndex,
    pos: { x: startNode.x, y: startNode.y },
    from: startNode.id,
    to: startNode.id,
    path: [],
    progress: 0,
    speed: rng.float(3, 20),
    color,
    trail: [],
    destination: null,
    isPlayer: false,
    capabilities: [],
    hunt: null,
    frozen: false,
    blood: 100,
    maxBlood: 100,
    hungry: false,
    rng: createLocalRNG(rng.int(1, 0x7fffffff)),
  };
```

- [ ] **Step 2: Verify in browser**

Open `index.html` in the browser (or refresh). Open DevTools console and run:

```js
window.render_game_to_text()
```

The JSON output for each character should now include `blood`, `maxBlood`, `hungry` — they won't appear yet since `render_game_to_text` in `main.js` doesn't expose them, but the fields exist on the objects. Confirm no console errors.

- [ ] **Step 3: Commit**

```bash
git add entities/character.js
git commit -m "feat: add blood, maxBlood, hungry fields to character model"
```

---

## Task 2: Create `simulation/blood.js`

**Files:**
- Create: `simulation/blood.js`

- [ ] **Step 1: Create the module**

Create `simulation/blood.js` with this content:

```js
const HUNGER_THRESHOLD = 0.2;
const DECAY_PER_HOUR = 0.35 / 24;
const DISTRICT_DECAY_MULTIPLIER = 0.5;
const HUNT_BLOOD_GAIN = 45;

function isInPlayerDistrict(character, playerDistricts) {
  if (!playerDistricts || playerDistricts.length === 0) {
    return false;
  }

  const { x, y } = character.pos;

  for (const district of playerDistricts) {
    const { bounds } = district;
    if (
      x >= bounds.x &&
      x <= bounds.x + bounds.w &&
      y >= bounds.y &&
      y <= bounds.y + bounds.h
    ) {
      return true;
    }
  }

  return false;
}

export function updateBlood(characters, dt, playerDistricts) {
  for (const character of characters) {
    if (!character.isPlayer) {
      continue;
    }

    const multiplier = isInPlayerDistrict(character, playerDistricts)
      ? DISTRICT_DECAY_MULTIPLIER
      : 1;

    character.blood -= (dt / 3_600_000) * DECAY_PER_HOUR * character.maxBlood * multiplier;
    character.blood = Math.max(0, character.blood);
    character.hungry = character.blood < HUNGER_THRESHOLD * character.maxBlood;
  }
}

export function applyHuntBloodGain(character) {
  character.blood = Math.min(character.maxBlood, character.blood + HUNT_BLOOD_GAIN);
  character.hungry = character.blood < HUNGER_THRESHOLD * character.maxBlood;
}
```

- [ ] **Step 2: Wire into `main.js` — import**

At the top of `main.js`, add the import after the existing simulation imports:

```js
import { updateBlood, applyHuntBloodGain } from './simulation/blood.js';
```

- [ ] **Step 3: Wire into `main.js` — stepSimulation**

Inside `stepSimulation`, in the `while` loop, add `updateBlood` after `updateHunts`:

```js
  while (remaining > 0) {
    const currentStep = Math.min(stepMs, remaining);
    updateCharacters(currentStep / 1000);
    updateHunts(state.characters, currentStep, onHuntComplete);
    updateBlood(state.characters, currentStep, state.city?.districts.filter((d) => d.isPlayerOwned));
    remaining -= currentStep;
  }
```

- [ ] **Step 4: Wire into `main.js` — onHuntComplete**

In `onHuntComplete`, call `applyHuntBloodGain` before pushing the notification:

```js
function onHuntComplete(playerChar, npcChar) {
  if (npcChar) {
    state.characters = state.characters.filter((character) => character.id !== npcChar.id);
  }

  applyHuntBloodGain(playerChar);

  state.notifications.push({
    type: 'hunt_success',
    characterId: playerChar.id,
    createdAt: performance.now(),
  });
}
```

- [ ] **Step 5: Expose blood in `render_game_to_text`**

In `main.js`, find the `characters` array in `render_game_to_text` (around line 257). Add `blood`, `maxBlood`, `hungry` to each character entry:

```js
    characters: state.characters.map((character) => ({
      id: character.id,
      isPlayer: character.isPlayer,
      capabilities: [...(character.capabilities ?? [])],
      color: character.color,
      blood: Number(character.blood.toFixed(2)),
      maxBlood: character.maxBlood,
      hungry: character.hungry,
      pos: {
        x: Number(character.pos.x.toFixed(2)),
        y: Number(character.pos.y.toFixed(2)),
      },
      from: character.from,
      to: character.to,
      progress: Number(character.progress.toFixed(3)),
      pathLength: character.path.length,
      destination: character.destination,
      hunt: character.hunt
        ? {
            phase: character.hunt.phase,
            targetId: character.hunt.targetId,
            elapsed: character.hunt.elapsed,
            duration: character.hunt.duration,
          }
        : null,
      frozen: character.frozen,
      trail: character.trail.slice(0, 10).map((point) => ({
        x: Number(point.x.toFixed(2)),
        y: Number(point.y.toFixed(2)),
      })),
    })),
```

- [ ] **Step 6: Verify Blood decay in browser**

Refresh the browser. In the console run:

```js
// Check initial state
JSON.parse(window.render_game_to_text()).characters.filter(c => c.isPlayer).map(c => ({ id: c.id, blood: c.blood, hungry: c.hungry }))
// Expected: [{id:0, blood:100, hungry:false}, {id:1, blood:100, hungry:false}, {id:2, blood:100, hungry:false}]

// Advance 8 game-hours (28_800_000 ms)
window.advanceTime(28_800_000)
JSON.parse(window.render_game_to_text()).characters.filter(c => c.isPlayer).map(c => ({ id: c.id, blood: c.blood, hungry: c.hungry }))
// Expected: blood ~91 (dropped ~9 units — 35%/day × maxBlood=100 × (8/24) hours)

// Advance to force hunger (blood below 20)
window.advanceTime(200_000_000)
JSON.parse(window.render_game_to_text()).characters.filter(c => c.isPlayer).map(c => ({ id: c.id, blood: c.blood, hungry: c.hungry }))
// Expected: blood=0, hungry=true
```

- [ ] **Step 7: Commit**

```bash
git add simulation/blood.js main.js
git commit -m "feat: add blood decay and hunt gain simulation"
```

---

## Task 3: Blood bar and hunger notice in player panel

**Files:**
- Modify: `ui/playerPanel.js`
- Modify: `index.html` (CSS only)

- [ ] **Step 1: Add CSS to `index.html`**

In `index.html`, find the `.hunt-status` rule (around line 408). Add these new rules after it:

```css
    .blood-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      color: #aab4d8;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .blood-bar__track {
      flex: 1;
      height: 5px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }

    .blood-bar__fill {
      height: 100%;
      border-radius: 3px;
      background: #8b0000;
      transition: width 200ms ease, background 200ms ease;
    }

    .blood-bar__fill--hungry {
      background: #ff2244;
    }

    .blood-bar__value {
      min-width: 24px;
      text-align: right;
    }

    .hunger-notice {
      padding: 5px 8px;
      border: 1px solid rgba(255, 34, 68, 0.45);
      border-radius: 8px;
      background: rgba(90, 10, 20, 0.38);
      color: #ff8099;
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
```

- [ ] **Step 2: Add `buildRenderSignature` fields for blood**

In `ui/playerPanel.js`, find `buildRenderSignature` (around line 44). Add `blood` and `hungry` to the character entries so the panel re-renders when these change:

```js
function buildRenderSignature(characters, interactionState, notifications) {
  return JSON.stringify({
    selectedCharacterId: interactionState?.selectedCharacterId ?? null,
    notifications: notifications
      .filter((notification) => notification?.type === 'hunt_success')
      .map((notification) => ({
        type: notification.type,
        characterId: notification.characterId,
      })),
    characters: characters.map((character) => ({
      id: character.id,
      isPlayer: character.isPlayer,
      pathLength: character.path?.length ?? 0,
      destination: character.destination,
      hunt: character.hunt,
      blood: Math.floor(character.blood ?? 100),
      hungry: character.hungry ?? false,
    })),
  });
}
```

- [ ] **Step 3: Add `createBloodBar` helper**

In `ui/playerPanel.js`, add this function before `createCard`:

```js
function createBloodBar(character) {
  const blood = character.blood ?? character.maxBlood ?? 100;
  const maxBlood = character.maxBlood ?? 100;
  const hungry = character.hungry ?? false;
  const ratio = Math.min(1, Math.max(0, blood / maxBlood));

  const wrapper = document.createElement('div');
  wrapper.className = 'blood-bar';

  const label = document.createElement('span');
  label.textContent = 'Blood';

  const track = document.createElement('div');
  track.className = 'blood-bar__track';

  const fill = document.createElement('div');
  fill.className = hungry ? 'blood-bar__fill blood-bar__fill--hungry' : 'blood-bar__fill';
  fill.style.width = `${Math.round(ratio * 100)}%`;

  const value = document.createElement('span');
  value.className = 'blood-bar__value';
  value.textContent = String(Math.floor(blood));

  track.append(fill);
  wrapper.append(label, track, value);
  return wrapper;
}
```

- [ ] **Step 4: Update `createCard` to render blood bar and hunger notice**

In `ui/playerPanel.js`, find the `createCard` function (around line 63). Replace it with:

```js
function createCard(character, isSelected, notifications) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'player-card';
  card.dataset.characterId = String(character.id);
  card.dataset.selected = isSelected ? 'true' : 'false';
  card.style.color = character.color;

  const top = document.createElement('div');
  top.className = 'player-card__top';

  const swatch = document.createElement('span');
  swatch.className = 'player-card__swatch';
  swatch.style.background = character.color;
  swatch.style.color = character.color;

  const title = document.createElement('div');
  title.className = 'player-card__title';
  title.textContent = `Character ${character.id + 1}`;

  const status = document.createElement('div');
  status.className = 'player-card__status';
  status.textContent = getStatusText(character);

  const hint = document.createElement('div');
  hint.className = 'player-card__hint';
  hint.textContent = isSelected ? 'Selected on map' : 'Click to open menu';

  top.append(swatch, title);

  const huntStatusText = getHuntStatusText(character, notifications);
  const elements = [top, status];

  if (huntStatusText) {
    const huntStatus = document.createElement('div');
    huntStatus.className = 'hunt-status';
    huntStatus.textContent = huntStatusText;
    elements.push(huntStatus);
  }

  if (character.hungry) {
    const hungerNotice = document.createElement('div');
    hungerNotice.className = 'hunger-notice';
    hungerNotice.textContent = '⚠ HUNGER!';
    elements.push(hungerNotice);
  }

  elements.push(createBloodBar(character));
  elements.push(hint);
  card.append(...elements);
  return card;
}
```

- [ ] **Step 5: Verify in browser**

Refresh the browser. Each player card should now show a dark-red Blood bar at the bottom with a numeric value.

Run in console to force hunger state:
```js
window.advanceTime(300_000_000)
```

All three player cards should now show:
- `⚠ HUNGER!` notice (red-bordered box)
- Blood bar in bright red `#ff2244`
- Value near `0`

- [ ] **Step 6: Commit**

```bash
git add ui/playerPanel.js index.html
git commit -m "feat: add blood bar and hunger notice to player panel"
```

---

## Self-Review Against Spec

**Spec coverage:**
- ✓ `blood`, `maxBlood`, `hungry` fields on character — Task 1
- ✓ `updateBlood` with decay ~35%/day, district multiplier 0.5 — Task 2
- ✓ `applyHuntBloodGain` +45 blood — Task 2
- ✓ Hunger threshold 20% — Task 2 (`HUNGER_THRESHOLD = 0.2`)
- ✓ Called from `stepSimulation` — Task 2
- ✓ Called from `onHuntComplete` — Task 2
- ✓ Blood bar in player panel, dark-red / bright-red — Task 3
- ✓ `⚠ HUNGER!` notice when `hungry === true`, disappears when cleared — Task 3

**Placeholder scan:** None found.

**Type consistency:** `character.blood`, `character.maxBlood`, `character.hungry` — used consistently across Tasks 1–3. `updateBlood(characters, dt, playerDistricts)` signature matches call in `main.js`. `applyHuntBloodGain(character)` matches call in `onHuntComplete`.
