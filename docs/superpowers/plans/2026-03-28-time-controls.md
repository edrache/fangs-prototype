# Time Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pause/speed controls (0×/1×/2×/4×/10×) to the city simulation via UI buttons and keyboard shortcuts (keys `0`–`4`), with a toggle to collapse the main control panel.

**Architecture:** A new `ui/timeControls.js` module (same pattern as `ui/controls.js`) renders the speed buttons and registers keyboard listeners. `main.js` gains a `timeScale` variable multiplied into `elapsed` inside `tick()`. The panel collapse is pure CSS — a `collapsed` class on `#controls` hides `.controls-left` and `.controls-right`.

**Tech Stack:** Vanilla JS ES modules, Canvas API, no bundler.

> **Note:** This project has no automated tests — verification is done visually by opening `index.html` in a browser (or `python3 -m http.server 8080`).

---

### Task 1: Create `ui/timeControls.js`

**Files:**
- Create: `ui/timeControls.js`

The module exports `createTimeControls({ mount, onSpeedChange })`. It renders five speed buttons and registers keyboard shortcuts.

- [ ] **Step 1: Create `ui/timeControls.js` with this content**

```js
const SPEEDS = [
  { label: '■', scale: 0, key: '0' },
  { label: '1×', scale: 1, key: '1' },
  { label: '2×', scale: 2, key: '2' },
  { label: '4×', scale: 4, key: '3' },
  { label: '10×', scale: 10, key: '4' },
];

export function createTimeControls({ mount, onSpeedChange }) {
  let activeScale = 1;
  const buttons = new Map();

  function setScale(scale) {
    activeScale = scale;
    for (const [s, btn] of buttons) {
      btn.dataset.active = s === activeScale ? 'true' : 'false';
    }
    onSpeedChange(scale);
  }

  for (const speed of SPEEDS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-btn';
    btn.textContent = speed.label;
    btn.dataset.active = speed.scale === activeScale ? 'true' : 'false';
    btn.addEventListener('click', () => setScale(speed.scale));
    buttons.set(speed.scale, btn);
    mount.append(btn);
  }

  document.addEventListener('keydown', (e) => {
    if (e.target !== document.body && e.target.tagName !== 'BODY') return;
    const speed = SPEEDS.find((s) => s.key === e.key);
    if (speed) setScale(speed.scale);
  });
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls ui/timeControls.js
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add ui/timeControls.js
git commit -m "feat: add ui/timeControls.js module"
```

---

### Task 2: Add `#time-controls` to `index.html` with CSS

**Files:**
- Modify: `index.html`

Add the `#time-controls` div (always visible), the toggle button, and all required CSS. Must be done before wiring `main.js` so the DOM element exists when JS runs.

- [ ] **Step 1: Add `#time-controls` div inside `#controls`**

In `index.html`, the `#controls` div currently looks like:

```html
  <div id="controls">
    <div class="controls-left">
      ...
    </div>

    <div class="controls-right">
      ...
    </div>
  </div>
```

Add `#time-controls` as the last child of `#controls`, so the full div becomes:

```html
  <div id="controls">
    <div class="controls-left">
      <div class="panel-copy">
        <strong>Fangs Prototype</strong>
        <span>Stage 1 milestone: seeded districts, streets, and district-aware building generation</span>
      </div>
      <div id="control-panel"></div>
    </div>

    <div class="controls-right">
      <div class="status-copy">
        <span id="seed-readout" aria-live="polite"></span>
      </div>
      <button id="regenerate-btn" type="button">In Sync</button>
    </div>

    <div id="time-controls">
      <button id="panel-toggle" type="button" aria-label="Toggle panel">▲</button>
    </div>
  </div>
```

Note: the five speed buttons are injected here by `createTimeControls` in JS — the HTML only needs the toggle button pre-declared inside `#time-controls`.

- [ ] **Step 2: Add CSS rules inside the existing `<style>` block**

Find the closing `</style>` tag and insert the following rules just before it:

```css
    #time-controls {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 4px;
      border-top: 1px solid rgba(160, 175, 218, 0.12);
    }

    #panel-toggle {
      border: 1px solid rgba(160, 175, 218, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      background: rgba(20, 27, 47, 0.52);
      color: #9ca6c7;
      font: inherit;
      font-size: 11px;
      cursor: pointer;
      transition: color 120ms ease;
    }

    #panel-toggle:hover {
      color: #f2f5ff;
    }

    .time-btn {
      border: 1px solid rgba(160, 175, 218, 0.2);
      border-radius: 6px;
      padding: 6px 12px;
      background: rgba(20, 27, 47, 0.52);
      color: #9ca6c7;
      font: inherit;
      font-size: 11px;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }

    .time-btn:hover {
      color: #f2f5ff;
    }

    .time-btn[data-active="true"] {
      background: linear-gradient(180deg, rgba(92, 111, 181, 0.9), rgba(63, 78, 134, 0.9));
      color: #f4f7ff;
      border-color: rgba(145, 164, 255, 0.4);
    }

    #controls.collapsed .controls-left,
    #controls.collapsed .controls-right {
      display: none;
    }

    #controls.collapsed {
      padding-bottom: 12px;
    }
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add #time-controls HTML and CSS"
```

---

### Task 3: Wire time controls into `main.js`

**Files:**
- Modify: `main.js`

Add import, `timeScale` variable, mount `createTimeControls`, multiply `elapsed` in `tick()`, and wire the panel toggle.

- [ ] **Step 1: Add import at the top of `main.js`**

After the existing imports, add:

```js
import { createTimeControls } from './ui/timeControls.js';
```

So the imports block looks like:

```js
import { createCharacter, updateCharacter } from './entities/character.js';
import { generateCity } from './generator/city.js';
import { createRNG } from './generator/rng.js';
import { renderCity } from './renderer/canvas.js';
import { createControls } from './ui/controls.js';
import { createTimeControls } from './ui/timeControls.js';
```

- [ ] **Step 2: Add `timeScale` variable and DOM references**

After the existing DOM constants (`canvas`, `ctx`, `seedReadout`, `controlPanel`, `regenerateButton`), add:

```js
const timeControlsPanel = document.getElementById('time-controls');
const panelToggle = document.getElementById('panel-toggle');
const controlsEl = document.getElementById('controls');
let timeScale = 1;
```

- [ ] **Step 3: Mount `createTimeControls` after the `createControls(...)` call**

After the existing `createControls(...)` block, add:

```js
createTimeControls({
  mount: timeControlsPanel,
  onSpeedChange(scale) {
    timeScale = scale;
  },
});
```

- [ ] **Step 4: Wire the panel toggle button**

After the `createTimeControls(...)` block, add:

```js
panelToggle.addEventListener('click', () => {
  const isCollapsed = controlsEl.classList.toggle('collapsed');
  panelToggle.textContent = isCollapsed ? '▼' : '▲';
});
```

- [ ] **Step 5: Multiply elapsed by `timeScale` in `tick()`**

Change `tick()` from:

```js
function tick(now) {
  const elapsed = Math.max(0, Math.min(100, now - state.lastTickMs));
  state.lastTickMs = now;
  stepSimulation(elapsed);
  window.requestAnimationFrame(tick);
}
```

To:

```js
function tick(now) {
  const elapsed = Math.max(0, Math.min(100, now - state.lastTickMs));
  state.lastTickMs = now;
  stepSimulation(elapsed * timeScale);
  window.requestAnimationFrame(tick);
}
```

- [ ] **Step 6: Open browser and verify all interactions**

Checklist to verify visually:
1. Speed buttons render in a row below the sliders.
2. `1×` is highlighted on load (active state).
3. Click `■` — characters freeze; button highlights.
4. Click `2×` — characters move visibly faster; button highlights.
5. Press key `0` — same as clicking `■` (characters freeze).
6. Press key `4` — characters move at 10× speed.
7. Click `▲` toggle — sliders panel disappears, speed buttons remain.
8. Click `▼` toggle — sliders panel reappears.

- [ ] **Step 7: Commit**

```bash
git add main.js
git commit -m "feat: wire time controls and panel toggle into main.js"
```
