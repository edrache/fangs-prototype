# Special Buildings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add special buildings (starting with Nest in the player's district) that show a double-ring outline, respond to click with a canvas context menu, and display an HTML Info overlay on demand.

**Architecture:** A new `ui/buildingInteraction.js` controller handles canvas hit-testing and menu state for special buildings, mirroring the existing character interaction pattern. A new `ui/buildingInfoOverlay.js` renders the HTML Info panel. `main.js` coordinates mutual exclusion between the two interaction controllers.

**Tech Stack:** Vanilla JS, Canvas API, HTML/CSS (no frameworks, no bundler)

---

### Task 1: Mark Nest building in generator

**Files:**
- Modify: `generator/city.js`

- [ ] **Step 1: Add `assignNestBuilding` function above `generateCity`**

```js
function getBuildingArea(building) {
  return building.rects.reduce((sum, rect) => sum + rect.w * rect.h, 0);
}

function assignNestBuilding(buildings, districts) {
  const playerDistrict = districts.find((district) => district.isPlayerOwned);
  if (!playerDistrict) {
    return;
  }

  const playerBuildings = buildings.filter(
    (building) => building.districtId === playerDistrict.id,
  );
  if (playerBuildings.length === 0) {
    return;
  }

  const nest = playerBuildings.reduce((best, building) =>
    getBuildingArea(building) > getBuildingArea(best) ? building : best,
  );

  nest.special = 'nest';
  nest.description = 'Vampire refuge. They sleep here during the day.';
}
```

- [ ] **Step 2: Call `assignNestBuilding` at the end of `generateCity`, before the return**

In `generateCity`, after the `generateBuildings(...)` call that assigns `buildings`, add:

```js
  assignNestBuilding(buildings, districtData.districts);
```

The return statement stays unchanged.

- [ ] **Step 3: Verify in browser**

Open `index.html`. Open DevTools console and run:
```js
JSON.parse(window.render_game_to_text()).buildingsSample
```
Scroll through `buildingsSample` — you won't necessarily see the Nest there (sample is first 6). Instead run:
```js
JSON.parse(window.render_game_to_text()).buildingsSample.filter(b => b.special)
```
If the Nest is not in the first 6, run:
```js
const data = JSON.parse(window.render_game_to_text());
// Find Nest:
// (city.buildings is not exposed directly, but we can check via districts)
// Check the player district id first:
data.districts.find(d => d.isPlayerOwned)
```
Then reload and verify there are no JS errors.

- [ ] **Step 4: Commit**

```bash
git add generator/city.js
git commit -m "feat: mark Nest building in player district during city generation"
```

---

### Task 2: Draw special building outlines

**Files:**
- Modify: `renderer/canvas.js`

- [ ] **Step 1: Add `drawSpecialBuildings` function after `drawBuildings`**

```js
function drawSpecialBuildings(ctx, city) {
  for (const building of city.buildings) {
    if (!building.special) {
      continue;
    }

    ctx.save();
    for (const rect of building.rects) {
      ctx.strokeStyle = 'rgba(155,127,255,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6);

      ctx.strokeStyle = '#9b7fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2);
    }
    ctx.restore();
  }
}
```

- [ ] **Step 2: Update `drawActionMenu` to support an optional title override**

Find this line inside `drawActionMenu`:

```js
  ctx.fillText(
    interactionState.mode === 'npc_menu_open' ? 'Target action' : 'Action menu',
    layout.x + layout.padding,
    layout.y + 14,
  );
```

Replace it with:

```js
  ctx.fillText(
    interactionState.menuTitle ?? (interactionState.mode === 'npc_menu_open' ? 'Target action' : 'Action menu'),
    layout.x + layout.padding,
    layout.y + 14,
  );
```

- [ ] **Step 3: Update `renderCity` signature and body**

Change the function signature from:

```js
export function renderCity(
  ctx,
  city,
  characters = [],
  interactionState = null,
  notifications = [],
) {
```

to:

```js
export function renderCity(
  ctx,
  city,
  characters = [],
  interactionState = null,
  buildingInteractionState = null,
  notifications = [],
) {
```

- [ ] **Step 4: Call `drawSpecialBuildings` and the building menu inside `renderCity`**

Find this line in the `renderCity` body:

```js
  drawBuildings(ctx, city);
```

Replace it with:

```js
  drawBuildings(ctx, city);
  drawSpecialBuildings(ctx, city);
```

Then find this block near the end of `renderCity`:

```js
  drawInteractionOverlay(ctx, city, characters, interactionState);
```

After that line, add:

```js
  if (buildingInteractionState?.mode === 'building_menu_open') {
    drawActionMenu(ctx, buildingInteractionState);
  }
```

- [ ] **Step 5: Verify in browser**

Open `index.html`. One building in the player's district (top-left area, red border) should have a double purple ring outline. No JS errors in console.

- [ ] **Step 6: Commit**

```bash
git add renderer/canvas.js
git commit -m "feat: draw double-ring outline for special buildings and support building menu rendering"
```

---

### Task 3: Building interaction controller

**Files:**
- Create: `ui/buildingInteraction.js`

- [ ] **Step 1: Create `ui/buildingInteraction.js`**

```js
const MENU_WIDTH = 160;
const MENU_ITEM_HEIGHT = 28;
const MENU_PADDING = 10;
const MENU_ITEMS = [{ id: 'info', label: 'Info' }];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: clamp((event.clientX - rect.left) * scaleX, 0, canvas.width),
    y: clamp((event.clientY - rect.top) * scaleY, 0, canvas.height),
  };
}

function isPointInRect(point, rect) {
  return (
    point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h
  );
}

function findSpecialBuildingAtPoint(buildings, point) {
  for (let index = 0; index < buildings.length; index += 1) {
    const building = buildings[index];
    if (!building.special) {
      continue;
    }
    for (const rect of building.rects) {
      if (isPointInRect(point, rect)) {
        return index;
      }
    }
  }
  return null;
}

function getBuildingCenter(building) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rect of building.rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function computeMenuLayout(canvasWidth, canvasHeight, building) {
  const center = getBuildingCenter(building);
  const width = MENU_WIDTH;
  const height = MENU_ITEMS.length * MENU_ITEM_HEIGHT + MENU_PADDING * 2;
  const preferredX = center.x + 18;
  const preferredY = center.y - height - 12;

  return {
    x: clamp(preferredX, 12, canvasWidth - width - 12),
    y: clamp(preferredY, 12, canvasHeight - height - 12),
    width,
    height,
    itemHeight: MENU_ITEM_HEIGHT,
    padding: MENU_PADDING,
    itemCount: MENU_ITEMS.length,
  };
}

function getMenuItemIndex(point, layout) {
  if (!layout) {
    return null;
  }

  const inside =
    point.x >= layout.x
    && point.x <= layout.x + layout.width
    && point.y >= layout.y
    && point.y <= layout.y + layout.height;

  if (!inside) {
    return null;
  }

  const relativeY = point.y - layout.y - layout.padding;
  if (relativeY < 0) {
    return null;
  }

  const index = Math.floor(relativeY / layout.itemHeight);
  return index >= 0 && index < layout.itemCount ? index : null;
}

export function createBuildingInteractionController({
  canvas,
  getCity,
  onMenuOpen,
  onInfoRequested,
  onChange,
}) {
  const state = {
    mode: 'idle',                 // 'idle' | 'building_menu_open'
    hoveredBuildingId: null,
    selectedBuildingId: null,
    hoveredMenuItemIndex: null,
  };

  function emitChange() {
    if (typeof onChange === 'function') {
      onChange(getState());
    }
  }

  function getBuildings() {
    return getCity()?.buildings ?? [];
  }

  function getSelectedBuilding() {
    if (state.selectedBuildingId === null) {
      return null;
    }
    return getBuildings()[state.selectedBuildingId] ?? null;
  }

  function getMenuLayoutForSelected() {
    const building = getSelectedBuilding();
    if (!building) {
      return null;
    }
    return computeMenuLayout(canvas.width, canvas.height, building);
  }

  function updateCursor() {
    // Only set pointer — never set default (character interaction handles default)
    if (state.mode === 'building_menu_open' && state.hoveredMenuItemIndex != null) {
      canvas.style.cursor = 'pointer';
      return;
    }
    if (state.hoveredBuildingId != null) {
      canvas.style.cursor = 'pointer';
    }
  }

  function clearSelection() {
    state.mode = 'idle';
    state.selectedBuildingId = null;
    state.hoveredMenuItemIndex = null;
    emitChange();
  }

  function getState() {
    const building = getSelectedBuilding();
    const layout = getMenuLayoutForSelected();

    return {
      mode: state.mode,
      hoveredBuildingId: state.hoveredBuildingId,
      selectedBuildingId: state.selectedBuildingId,
      hoveredMenuItemIndex: state.hoveredMenuItemIndex,
      menuItems: state.mode === 'building_menu_open' ? MENU_ITEMS : [],
      menuLayout: layout,
      menuTitle: building ? building.special.charAt(0).toUpperCase() + building.special.slice(1) : null,
    };
  }

  function handlePointerMove(event) {
    const point = toCanvasPoint(canvas, event);
    const buildings = getBuildings();

    state.hoveredBuildingId = findSpecialBuildingAtPoint(buildings, point);
    state.hoveredMenuItemIndex =
      state.mode === 'building_menu_open'
        ? getMenuItemIndex(point, getMenuLayoutForSelected())
        : null;

    updateCursor();
    emitChange();
  }

  function handlePointerLeave() {
    state.hoveredBuildingId = null;
    state.hoveredMenuItemIndex = null;
    emitChange();
  }

  function handleClick(event) {
    const city = getCity();
    if (!city) {
      return;
    }

    const point = toCanvasPoint(canvas, event);

    if (state.mode === 'building_menu_open') {
      const layout = getMenuLayoutForSelected();
      const itemIndex = getMenuItemIndex(point, layout);

      if (itemIndex != null) {
        const item = MENU_ITEMS[itemIndex];
        if (item.id === 'info') {
          const building = getSelectedBuilding();
          if (building && typeof onInfoRequested === 'function') {
            onInfoRequested(building);
          }
        }
        clearSelection();
        return;
      }

      clearSelection();
      return;
    }

    const clickedId = findSpecialBuildingAtPoint(city.buildings, point);
    if (clickedId !== null) {
      state.mode = 'building_menu_open';
      state.selectedBuildingId = clickedId;
      state.hoveredMenuItemIndex = null;
      if (typeof onMenuOpen === 'function') {
        onMenuOpen();
      }
      emitChange();
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && state.mode === 'building_menu_open') {
      clearSelection();
    }
  }

  function reset() {
    state.mode = 'idle';
    state.hoveredBuildingId = null;
    state.selectedBuildingId = null;
    state.hoveredMenuItemIndex = null;
    emitChange();
  }

  canvas.addEventListener('mousemove', handlePointerMove);
  canvas.addEventListener('mouseleave', handlePointerLeave);
  canvas.addEventListener('click', handleClick);
  window.addEventListener('keydown', handleKeyDown);

  return {
    clearSelection,
    getState,
    reset,
    destroy() {
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('mouseleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    },
  };
}
```

- [ ] **Step 2: Temporarily wire into `main.js` without info overlay (to test menu)**

Add this import at the top of `main.js`:

```js
import { createBuildingInteractionController } from './ui/buildingInteraction.js';
```

Add this block after the `interaction` constant is created (around line 83):

```js
const buildingInteraction = createBuildingInteractionController({
  canvas,
  getCity: () => state.city,
  onMenuOpen() { interaction.clearSelection(); },
  onInfoRequested(building) {
    // placeholder — wired properly in Task 5
    console.log('Info requested:', building.special, building.description);
  },
  onChange() { render(); },
});
```

- [ ] **Step 3: Update `render()` to pass `buildingInteractionState`**

Find the `render()` function in `main.js`:

```js
function render() {
  const interactionState = interaction.getState();
  renderCity(ctx, state.city, state.characters, interactionState, state.notifications);
  playerPanel.update(interactionState, state.notifications);
  dayDisplay.update(clock.getState(state.timeMs));
}
```

Replace with:

```js
function render() {
  const interactionState = interaction.getState();
  const buildingState = buildingInteraction.getState();
  renderCity(ctx, state.city, state.characters, interactionState, buildingState, state.notifications);
  playerPanel.update(interactionState, state.notifications);
  dayDisplay.update(clock.getState(state.timeMs));
}
```

- [ ] **Step 4: Add `buildingInteraction.reset()` to `regenerate()`**

Find `interaction.reset();` in `regenerate()` and add the line after it:

```js
  interaction.reset();
  buildingInteraction.reset();
```

- [ ] **Step 5: Add mutual exclusion to character interaction**

`createInteractionController` is called in `main.js` with a config object. Find that block (starts with `const interaction = createInteractionController({`) and add an `onMenuOpen` callback. The existing call ends at the closing `});` around line 83.

The call already has `onChange() { render(); }`. Add `onMenuOpen` before it:

```js
const interaction = createInteractionController({
  canvas,
  getCity: () => state.city,
  getCharacters: () => state.characters,
  onAssignDestination(character, destination) {
    setCharacterDestination(character, destination);
    render();
  },
  onStartHunt(playerChar, npcChar) {
    startHunt(playerChar, npcChar);
    render();
  },
  onCancelHunt(playerChar) {
    cancelHunt(playerChar, state.characters);
    render();
  },
  onMenuOpen() { buildingInteraction.clearSelection(); },
  onChange() {
    render();
  },
});
```

Note: `buildingInteraction` must be declared before `interaction` uses `onMenuOpen`, but `interaction` is currently declared first. Fix the order: move `buildingInteraction` declaration above `interaction`, and swap the `onMenuOpen` references so each calls `clearSelection` on the other. Since JS closures capture by reference, both can be declared before either `onMenuOpen` fires (they only fire at runtime, not at declaration time). So just declare `buildingInteraction` first, then `interaction` — and add `onMenuOpen() { buildingInteraction.clearSelection(); }` to `interaction` config.

The final order in `main.js` should be:

```js
const buildingInteraction = createBuildingInteractionController({
  canvas,
  getCity: () => state.city,
  onMenuOpen() { interaction.clearSelection(); },
  onInfoRequested(building) {
    console.log('Info requested:', building.special, building.description);
  },
  onChange() { render(); },
});

const interaction = createInteractionController({
  canvas,
  getCity: () => state.city,
  getCharacters: () => state.characters,
  onAssignDestination(character, destination) {
    setCharacterDestination(character, destination);
    render();
  },
  onStartHunt(playerChar, npcChar) {
    startHunt(playerChar, npcChar);
    render();
  },
  onCancelHunt(playerChar) {
    cancelHunt(playerChar, state.characters);
    render();
  },
  onMenuOpen() { buildingInteraction.clearSelection(); },
  onChange() {
    render();
  },
});
```

`createInteractionController` does not have an `onMenuOpen` parameter yet — add it in `ui/interaction.js`. Find `export function createInteractionController({` and add `onMenuOpen` to the destructured parameter:

```js
export function createInteractionController({
  canvas,
  getCity,
  getCharacters,
  onAssignDestination,
  onStartHunt,
  onCancelHunt,
  onMenuOpen,
  onChange,
}) {
```

Then find `openMenuForCharacter` and call `onMenuOpen` when the menu opens. Find this block inside it:

```js
    state.mode = 'menu_open';
    state.selectedCharacterId = characterId;
    state.hoveredCharacterId = characterId;
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = null;
    state.npcTargetCharacterId = null;
    state.mousePos = null;
    emitChange();
    updateCursor();
    return true;
```

After `emitChange();` and before `updateCursor();`, add:

```js
    if (typeof onMenuOpen === 'function') {
      onMenuOpen();
    }
```

- [ ] **Step 6: Verify in browser**

Open `index.html`. Click the outlined Nest building in the player's district:
- A menu titled "Nest" appears near the building with "Info" option
- Opening character menu while building menu is open: building menu should close (and vice versa)
- Console should log `"Info requested: nest Vampire refuge..."` when Info is clicked
- Escape key closes building menu

- [ ] **Step 7: Commit**

```bash
git add ui/buildingInteraction.js ui/interaction.js main.js
git commit -m "feat: add building interaction controller with context menu for special buildings"
```

---

### Task 4: HTML canvas wrapper + Info overlay

**Files:**
- Modify: `index.html`
- Create: `ui/buildingInfoOverlay.js`

- [ ] **Step 1: Wrap canvas in a relative container in `index.html`**

Find:
```html
  <canvas id="city-canvas" width="900" height="700"></canvas>
```

Replace with:
```html
  <div id="canvas-container" style="position:relative;width:900px;max-width:100%">
    <canvas id="city-canvas" width="900" height="700"></canvas>
  </div>
```

- [ ] **Step 2: Create `ui/buildingInfoOverlay.js`**

```js
const OVERLAY_STYLES = `
  position: absolute;
  top: 48px;
  right: 16px;
  width: 220px;
  padding: 14px 16px;
  background: rgba(12, 16, 28, 0.97);
  border: 1px solid rgba(139, 111, 255, 0.4);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
  color: rgba(240, 244, 255, 0.92);
  display: none;
  z-index: 10;
`;

const CLOSE_BTN_STYLES = `
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: none;
  color: rgba(200, 200, 255, 0.5);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
  padding: 2px 4px;
`;

export function createBuildingInfoOverlay({ mount }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = OVERLAY_STYLES;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = CLOSE_BTN_STYLES;
  closeBtn.addEventListener('click', hide);

  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #9b7fff;
    margin-bottom: 8px;
  `;

  const body = document.createElement('div');
  body.style.cssText = `
    font-size: 11px;
    line-height: 1.6;
    color: rgba(220, 228, 255, 0.85);
  `;

  overlay.append(closeBtn, title, body);
  mount.appendChild(overlay);

  function show(building) {
    title.textContent = building.special.charAt(0).toUpperCase() + building.special.slice(1);
    body.textContent = building.description;
    overlay.style.display = 'block';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  function update(buildingState) {
    if (buildingState?.mode === 'idle') {
      // Don't auto-hide when menu closes — overlay stays until × or Escape
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hide();
    }
  });

  return { show, hide, update };
}
```

- [ ] **Step 3: Verify structure in browser**

Open `index.html`. Check DevTools — canvas should be inside `#canvas-container`. No layout changes should be visible.

- [ ] **Step 4: Commit**

```bash
git add index.html ui/buildingInfoOverlay.js
git commit -m "feat: add canvas wrapper and building info HTML overlay"
```

---

### Task 5: Wire info overlay in main.js

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Import `createBuildingInfoOverlay` and get the mount element**

Add this import at the top of `main.js` alongside the other UI imports:

```js
import { createBuildingInfoOverlay } from './ui/buildingInfoOverlay.js';
```

Add this line alongside the other `document.getElementById` calls at the top of `main.js`:

```js
const canvasContainer = document.getElementById('canvas-container');
```

- [ ] **Step 2: Create the overlay instance**

Add this line after the `dayDisplay` and `timeControls` creation blocks:

```js
const buildingInfoOverlay = createBuildingInfoOverlay({ mount: canvasContainer });
```

- [ ] **Step 3: Replace the placeholder `onInfoRequested` in `buildingInteraction` config**

Find in `main.js`:

```js
  onInfoRequested(building) {
    console.log('Info requested:', building.special, building.description);
  },
```

Replace with:

```js
  onInfoRequested(building) {
    buildingInfoOverlay.show(building);
  },
```

Note: `buildingInfoOverlay` is referenced here but declared after `buildingInteraction`. Since `onInfoRequested` is only called at runtime (never at declaration), this forward reference is safe — JS closures capture the variable binding, not the value at declaration time. Both declarations are in the same scope.

- [ ] **Step 4: Call `buildingInfoOverlay.update` from `render()`**

Find the `render()` function and add the update call:

```js
function render() {
  const interactionState = interaction.getState();
  const buildingState = buildingInteraction.getState();
  renderCity(ctx, state.city, state.characters, interactionState, buildingState, state.notifications);
  playerPanel.update(interactionState, state.notifications);
  dayDisplay.update(clock.getState(state.timeMs));
  buildingInfoOverlay.update(buildingState);
}
```

- [ ] **Step 5: Final end-to-end verification**

Open `index.html`. Test the full flow:

1. **Outline visible** — player's district has one building with a double purple ring
2. **Click building** — canvas menu titled "Nest" appears with "Info" item
3. **Click Info** — HTML overlay appears top-right with title "Nest" and description text
4. **× button** — closes overlay
5. **Escape** — closes both canvas menu and overlay
6. **Click character while building menu open** — building menu closes, character menu opens
7. **Click building while character menu open** — character menu closes, building menu opens
8. **Regenerate** — new map generates, Nest building correctly identified again

- [ ] **Step 6: Commit**

```bash
git add main.js
git commit -m "feat: wire building info overlay — complete special buildings feature"
```
