# Hunt Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hunt action that lets player characters pathfind to an NPC, freeze both while a 1-game-hour ring timer fills, then remove the NPC and show a success notification.

**Architecture:** A new `simulation/hunt.js` module owns all hunt logic and serves as the foundation for future actions. Characters gain a `capabilities` array (controls available actions) and a nullable `hunt` state. The interaction layer gains two new modes (`hunt_picking`, `npc_menu_open`) and dynamic per-state menus. The renderer draws the ring timer and success animation driven by `state.notifications`.

**Tech Stack:** Vanilla JS (ES modules), Canvas API, no build step — verify visually in browser at `http://127.0.0.1:8080/index.html`

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `entities/character.js` | Modify | Add `capabilities`, `hunt`, `frozen` to character; skip update when frozen |
| `simulation/hunt.js` | **Create** | `startHunt`, `updateHunts`, `cancelHunt` |
| `main.js` | Modify | Import hunt module; `state.notifications`; `onHuntComplete`; pass notifications to render/panel |
| `ui/interaction.js` | Modify | Dynamic menus by state; `hunt_picking` + `npc_menu_open` modes; `onStartHunt`/`onCancelHunt` callbacks |
| `renderer/canvas.js` | Modify | Dynamic menu items from state; hunt ring; success flash + floating text |
| `ui/playerPanel.js` | Modify | Hunt status row in player card |
| `index.html` | Modify | CSS for `.hunt-status` |

---

### Task 1: Extend the character model

**Files:**
- Modify: `entities/character.js`
- Modify: `main.js`

- [ ] **Step 1: Add `capabilities`, `hunt`, `frozen` to `createCharacter`**

In `entities/character.js`, find the `char` object literal inside `createCharacter`. Add three fields after `isPlayer: false,`:

```js
isPlayer: false,
capabilities: [],
hunt: null,
frozen: false,
```

- [ ] **Step 2: Freeze characters during hunt**

At the very top of `updateCharacter` (before any other logic), add:

```js
export function updateCharacter(char, dt, intersections, characters = []) {
  if (char.frozen) return;
  // … rest unchanged
```

- [ ] **Step 3: Give player characters the `hunt` capability**

In `main.js`, inside `createCharacters`, find the line `character.isPlayer = index < PLAYER_COUNT;` and add the capability assignment right after:

```js
character.isPlayer = index < PLAYER_COUNT;
if (character.isPlayer) {
  character.capabilities = ['hunt'];
}
```

- [ ] **Step 4: Verify in browser**

Open browser console at `http://127.0.0.1:8080/index.html` and run:

```js
JSON.parse(window.render_game_to_text()).characters.slice(0, 4).map(c => ({id: c.id, caps: c.capabilities}))
```

Expected: first 3 show `capabilities: ['hunt']`, rest show `capabilities: []`. No console errors.

- [ ] **Step 5: Commit**

```bash
git add entities/character.js main.js
git commit -m "feat: add capabilities, hunt, frozen to character model"
```

---

### Task 2: Create `simulation/hunt.js`

**Files:**
- Create: `simulation/hunt.js`

- [ ] **Step 1: Create the module**

```js
import { setCharacterDestination } from '../entities/character.js';

const HUNT_DURATION_MS = 3_600_000;

export function startHunt(playerChar, npcChar) {
  playerChar.hunt = {
    phase: 'moving',
    targetId: npcChar.id,
    elapsed: 0,
    duration: HUNT_DURATION_MS,
  };
  setCharacterDestination(playerChar, { type: 'node', nodeId: npcChar.from });
}

export function updateHunts(characters, dt, onHuntComplete) {
  for (const char of characters) {
    if (!char.hunt) continue;

    const npc = characters.find((c) => c.id === char.hunt.targetId);

    if (char.hunt.phase === 'moving') {
      if (!npc) {
        char.hunt = null;
        continue;
      }
      if (char.from === npc.from && char.path.length === 0) {
        char.hunt.phase = 'hunting';
        char.destination = null;
        char.path = [];
        npc.frozen = true;
        npc.path = [];
        npc.destination = null;
      }
    } else if (char.hunt.phase === 'hunting') {
      char.hunt.elapsed += dt;
      if (char.hunt.elapsed >= char.hunt.duration) {
        const completedNpc = npc;
        char.hunt = null;
        onHuntComplete(char, completedNpc);
      }
    }
  }
}

export function cancelHunt(playerChar, characters) {
  if (!playerChar.hunt) return;
  const npc = characters.find((c) => c.id === playerChar.hunt.targetId);
  if (npc) {
    npc.frozen = false;
  }
  playerChar.hunt = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add simulation/hunt.js
git commit -m "feat: add simulation/hunt.js with startHunt, updateHunts, cancelHunt"
```

---

### Task 3: Wire hunt into `main.js`

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Import hunt functions**

At the top of `main.js`, alongside other simulation imports:

```js
import { startHunt, updateHunts, cancelHunt } from './simulation/hunt.js';
```

- [ ] **Step 2: Add `notifications` to `state`**

Find the `state` object and add:

```js
const state = {
  city: null,
  characters: [],
  frame: 0,
  timeMs: 0,
  lastTickMs: performance.now(),
  startDayOfYear: 1,
  notifications: [],
};
```

- [ ] **Step 3: Add `onHuntComplete`**

Add this function after the `state` object:

```js
function onHuntComplete(playerChar, npcChar) {
  if (npcChar) {
    state.characters = state.characters.filter((c) => c.id !== npcChar.id);
  }
  state.notifications.push({
    type: 'hunt_success',
    characterId: playerChar.id,
    createdAt: performance.now(),
  });
}
```

- [ ] **Step 4: Call `updateHunts` in the simulation step**

In `stepSimulation`, find the inner loop that calls `updateCharacters`. The loop is:

```js
while (remaining > 0) {
  const currentStep = Math.min(stepMs, remaining);
  updateCharacters(currentStep / 1000);
  remaining -= currentStep;
}
```

Add `updateHunts` call inside the loop, after `updateCharacters`:

```js
while (remaining > 0) {
  const currentStep = Math.min(stepMs, remaining);
  updateCharacters(currentStep / 1000);
  updateHunts(state.characters, currentStep, onHuntComplete);
  remaining -= currentStep;
}
```

Note: `updateHunts` receives `currentStep` in **milliseconds** (game time). `elapsed` accumulates ms and compares against `HUNT_DURATION_MS = 3_600_000`.

- [ ] **Step 5: Expire notifications in `tick`**

In the `tick` function, add before `stepSimulation`:

```js
function tick(now) {
  const elapsed = Math.max(0, Math.min(100, now - state.lastTickMs));
  state.lastTickMs = now;
  state.notifications = state.notifications.filter(
    (n) => performance.now() - n.createdAt < 2500,
  );
  stepSimulation(elapsed * timeScale);
  window.requestAnimationFrame(tick);
}
```

- [ ] **Step 6: Pass `onStartHunt` and `onCancelHunt` to interaction controller**

Find `createInteractionController({...})` and add two new callbacks alongside the existing ones:

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
  onChange() {
    render();
  },
});
```

- [ ] **Step 7: Pass notifications to `render`**

Update the `render` function to pass `state.notifications` to both `renderCity` and `playerPanel.update`:

```js
function render() {
  const interactionState = interaction.getState();
  renderCity(ctx, state.city, state.characters, interactionState, state.notifications);
  playerPanel.update(interactionState, state.notifications);
  dayDisplay.update(clock.getState(state.timeMs));
}
```

- [ ] **Step 8: Reset notifications on regenerate**

In `regenerate()`, add `state.notifications = [];`:

```js
function regenerate() {
  state.startDayOfYear = createRNG(params.seed ^ 0xDAD0C10C).int(1, 365);
  clock = createClock(state.startDayOfYear);
  state.city = generateCity(params);
  state.characters = createCharacters(state.city, params.seed, params.characters);
  state.frame = 0;
  state.timeMs = 0;
  state.lastTickMs = performance.now();
  state.notifications = [];
  interaction.reset();
  // … rest unchanged
```

- [ ] **Step 9: Verify — no errors, hunt starts**

Open browser console and run:

```js
// Grab a player and an NPC
const chars = JSON.parse(window.render_game_to_text()).characters;
chars.slice(0,4).map(c => ({id: c.id, isPlayer: c.isPlayer}))
```

No console errors. The page continues to animate. Hunt wiring will be testable after Task 4.

- [ ] **Step 10: Commit**

```bash
git add main.js
git commit -m "feat: wire hunt system into main loop and render pipeline"
```

---

### Task 4: Update interaction layer (`ui/interaction.js`)

**Files:**
- Modify: `ui/interaction.js`

- [ ] **Step 1: Replace static `MENU_ITEMS` with dynamic helpers**

Remove the existing `export const MENU_ITEMS = [...]` and replace with:

```js
export const NPC_MENU_ITEMS = [
  { id: 'hunt', label: 'Hunt' },
  { id: 'cancel', label: 'Cancel' },
];

const HUNTING_MENU_ITEMS = [
  { id: 'cancel_hunt', label: 'Cancel hunt' },
  { id: 'cancel', label: 'Cancel' },
];

function getPlayerMenuItems(character) {
  const items = [{ id: 'choose_destination', label: 'Choose destination' }];
  if (character?.capabilities?.includes('hunt')) {
    items.push({ id: 'hunt', label: 'Hunt' });
  }
  items.push({ id: 'cancel', label: 'Cancel' });
  return items;
}

function getCurrentMenuItems(character) {
  if (!character) return [];
  if (character.hunt != null) return HUNTING_MENU_ITEMS;
  return getPlayerMenuItems(character);
}
```

- [ ] **Step 2: Update `getMenuLayoutForCharacter` to accept `itemCount`**

The function is exported and used by the renderer via `interactionState.menuLayout`. Update its signature so the height derives from `itemCount`:

```js
export function getMenuLayoutForCharacter(canvasWidth, canvasHeight, character, itemCount) {
  if (!character) {
    return null;
  }

  const width = MENU_WIDTH;
  const height = itemCount * MENU_ITEM_HEIGHT + MENU_PADDING * 2;
  const preferredX = character.pos.x + 18;
  const preferredY = character.pos.y - height - 12;

  return {
    x: clamp(preferredX, 12, canvasWidth - width - 12),
    y: clamp(preferredY, 12, canvasHeight - height - 12),
    width,
    height,
    itemHeight: MENU_ITEM_HEIGHT,
    padding: MENU_PADDING,
  };
}
```

- [ ] **Step 3: Update `createInteractionController` signature**

Add `onStartHunt` and `onCancelHunt` to the destructured parameters:

```js
export function createInteractionController({
  canvas,
  getCity,
  getCharacters,
  onAssignDestination,
  onStartHunt,
  onCancelHunt,
  onChange,
}) {
```

- [ ] **Step 4: Add `npcTargetCharacterId` to state**

Inside `createInteractionController`, add the new field to the `state` object:

```js
const state = {
  mode: 'idle',
  selectedCharacterId: null,
  hoveredCharacterId: null,
  hoveredMenuItemIndex: null,
  targetNodeId: null,
  targetCharacterId: null,
  mousePos: null,
  npcTargetCharacterId: null,
};
```

- [ ] **Step 5: Add NPC target helper and replace `getMenuLayout()`**

Add these helpers after the existing helper functions:

```js
function getNpcTarget() {
  return getCharactersSafe().find((c) => c.id === state.npcTargetCharacterId) ?? null;
}

function getMenuLayoutForCurrentMode() {
  if (state.mode === 'npc_menu_open') {
    const npc = getNpcTarget();
    return getMenuLayoutForCharacter(
      canvas.width, canvas.height, npc, NPC_MENU_ITEMS.length,
    );
  }
  const selectedChar = getSelectedCharacter();
  const items = getCurrentMenuItems(selectedChar);
  return getMenuLayoutForCharacter(
    canvas.width, canvas.height, selectedChar, items.length,
  );
}
```

Find all existing calls to `getMenuLayout()` in the file and replace them with `getMenuLayoutForCurrentMode()`. Also delete the old `getMenuLayout()` function.

- [ ] **Step 6: Add `beginHuntPicking`**

```js
function beginHuntPicking() {
  state.mode = 'hunt_picking';
  state.hoveredMenuItemIndex = null;
  state.targetNodeId = null;
  state.targetCharacterId = null;
  emitChange();
  updateCursor();
}
```

- [ ] **Step 7: Replace `handleMenuClick` with a version that handles all menu items**

```js
function handleMenuClick(point) {
  if (state.mode === 'npc_menu_open') {
    const layout = getMenuLayoutForCurrentMode();
    const menuItemIndex = getMenuItemIndex(point, layout);
    if (menuItemIndex == null) return false;

    const menuItem = NPC_MENU_ITEMS[menuItemIndex];
    if (menuItem.id === 'hunt') {
      const selectedChar = getSelectedCharacter();
      const npc = getNpcTarget();
      if (selectedChar && npc) {
        onStartHunt(selectedChar, npc);
      }
    }
    state.npcTargetCharacterId = null;
    clearSelection();
    return true;
  }

  const layout = getMenuLayoutForCurrentMode();
  const menuItemIndex = getMenuItemIndex(point, layout);
  if (menuItemIndex == null) return false;

  const selectedChar = getSelectedCharacter();
  const items = getCurrentMenuItems(selectedChar);
  const menuItem = items[menuItemIndex];

  if (menuItem.id === 'choose_destination') {
    beginPickingDestination();
    return true;
  }
  if (menuItem.id === 'hunt') {
    beginHuntPicking();
    return true;
  }
  if (menuItem.id === 'cancel_hunt') {
    if (selectedChar) onCancelHunt(selectedChar);
    state.mode = 'menu_open';
    emitChange();
    return true;
  }

  clearSelection();
  return true;
}
```

- [ ] **Step 8: Update `handleClick` to handle new modes**

Replace the entire `handleClick` function:

```js
function handleClick(event) {
  const city = getCity();
  const characters = getCharactersSafe();
  if (!city || characters.length === 0) {
    return;
  }

  const point = toCanvasPoint(canvas, event);
  const clickedCharacter = findCharacterAtPoint(characters, point);
  const selectedCharacter = getSelectedCharacter();

  if (state.mode === 'idle') {
    if (isPlayerCharacter(clickedCharacter)) {
      openMenuForCharacter(clickedCharacter.id);
    }
    return;
  }

  if (clickedCharacter?.id === state.selectedCharacterId) {
    clearSelection();
    return;
  }

  if (state.mode === 'menu_open') {
    if (handleMenuClick(point)) {
      return;
    }
    // Click on NPC while player menu open → open NPC context menu
    if (clickedCharacter && !isPlayerCharacter(clickedCharacter)) {
      state.mode = 'npc_menu_open';
      state.npcTargetCharacterId = clickedCharacter.id;
      emitChange();
      return;
    }
    if (isPlayerCharacter(clickedCharacter)) {
      openMenuForCharacter(clickedCharacter.id);
    }
    return;
  }

  if (state.mode === 'npc_menu_open') {
    if (handleMenuClick(point)) return;
    state.npcTargetCharacterId = null;
    clearSelection();
    return;
  }

  if (state.mode === 'hunt_picking') {
    if (clickedCharacter && !isPlayerCharacter(clickedCharacter)) {
      const selected = getSelectedCharacter();
      if (selected) onStartHunt(selected, clickedCharacter);
      clearSelection();
    }
    return;
  }

  if (!selectedCharacter) {
    clearSelection();
    return;
  }

  handlePickingClick(point, selectedCharacter, characters, city);
}
```

- [ ] **Step 9: Update `handlePointerMove` for new modes**

Find the line that sets `hoveredMenuItemIndex` in `handlePointerMove` and update it:

```js
state.hoveredMenuItemIndex =
  state.mode === 'menu_open' || state.mode === 'npc_menu_open'
    ? getMenuItemIndex(point, getMenuLayoutForCurrentMode())
    : null;
```

- [ ] **Step 10: Update `updateCursor` for new modes**

```js
function updateCursor() {
  if (
    (state.mode === 'menu_open' || state.mode === 'npc_menu_open') &&
    state.hoveredMenuItemIndex != null
  ) {
    canvas.style.cursor = 'pointer';
    return;
  }

  if (state.hoveredCharacterId != null) {
    canvas.style.cursor = 'pointer';
    return;
  }

  if (state.mode === 'picking_destination' || state.mode === 'hunt_picking') {
    canvas.style.cursor = 'crosshair';
    return;
  }

  canvas.style.cursor = 'default';
}
```

- [ ] **Step 11: Update `clearSelection` and `reset` to clear new state field**

In `clearSelection`, add `state.npcTargetCharacterId = null;`:

```js
function clearSelection() {
  state.mode = 'idle';
  state.selectedCharacterId = null;
  state.hoveredMenuItemIndex = null;
  state.targetNodeId = null;
  state.targetCharacterId = null;
  state.npcTargetCharacterId = null;
  emitChange();
  updateCursor();
}
```

In `reset`, also add `state.npcTargetCharacterId = null;`:

```js
function reset() {
  state.mode = 'idle';
  state.selectedCharacterId = null;
  state.hoveredCharacterId = null;
  state.hoveredMenuItemIndex = null;
  state.targetNodeId = null;
  state.targetCharacterId = null;
  state.npcTargetCharacterId = null;
  state.mousePos = null;
  updateCursor();
  emitChange();
}
```

- [ ] **Step 12: Update `getState` to include `menuItems` and `npcTargetCharacterId`**

```js
function getState() {
  const selectedChar = getSelectedCharacter();
  const menuItems =
    state.mode === 'npc_menu_open' ? NPC_MENU_ITEMS : getCurrentMenuItems(selectedChar);
  return {
    mode: state.mode,
    selectedCharacterId: state.selectedCharacterId,
    hoveredCharacterId: state.hoveredCharacterId,
    hoveredMenuItemIndex: state.hoveredMenuItemIndex,
    targetNodeId: state.targetNodeId,
    targetCharacterId: state.targetCharacterId,
    npcTargetCharacterId: state.npcTargetCharacterId,
    menuItems,
    menuLayout: getMenuLayoutForCurrentMode(),
    mousePos: state.mousePos ? { ...state.mousePos } : null,
  };
}
```

- [ ] **Step 13: Verify both trigger paths in browser**

Open `http://127.0.0.1:8080/index.html`.

**Path 1:** Click player → menu shows `Choose destination`, `Hunt`, `Cancel` → click `Hunt` → cursor becomes crosshair → click NPC → both characters stop moving.

**Path 2:** Click player (menu opens) → click NPC directly → NPC menu shows `Hunt`, `Cancel` → click `Hunt` → both characters stop moving.

**Cancel:** Click hunting player → `Cancel hunt` appears → click it → player resumes movement, NPC unfreezes.

No console errors.

- [ ] **Step 14: Commit**

```bash
git add ui/interaction.js
git commit -m "feat: add hunt_picking and npc_menu_open interaction modes with dynamic menus"
```

---

### Task 5: Render hunt ring and update menu drawing (`renderer/canvas.js`)

**Files:**
- Modify: `renderer/canvas.js`

- [ ] **Step 1: Update import — remove `MENU_ITEMS`, keep nothing from interaction**

The renderer no longer needs to import from `interaction.js` — all menu data comes via `interactionState`. Remove the import line:

```js
// Remove this line entirely:
import { getMenuLayoutForCharacter, MENU_ITEMS } from '../ui/interaction.js';
```

- [ ] **Step 2: Update `drawActionMenu` to use data from `interactionState`**

Replace the existing `drawActionMenu` function signature and body:

```js
function drawActionMenu(ctx, layout, menuItems, hoveredMenuItemIndex, title) {
  if (!layout || !menuItems?.length) {
    return;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(12, 16, 28, 0.96)';
  ctx.strokeStyle = 'rgba(220, 228, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(layout.x, layout.y, layout.width, layout.height, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(240, 244, 255, 0.82)';
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillText(title ?? 'Action menu', layout.x + layout.padding, layout.y + 14);

  for (let index = 0; index < menuItems.length; index += 1) {
    const itemY = layout.y + layout.padding + 8 + index * layout.itemHeight;
    const isHovered = hoveredMenuItemIndex === index;

    if (isHovered) {
      ctx.fillStyle = 'rgba(133, 151, 224, 0.2)';
      ctx.beginPath();
      ctx.roundRect(
        layout.x + 6,
        itemY - 2,
        layout.width - 12,
        layout.itemHeight - 2,
        6,
      );
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(246, 248, 255, 0.95)';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText(menuItems[index].label, layout.x + layout.padding, itemY + 14);
  }

  ctx.restore();
}
```

- [ ] **Step 3: Update `drawInteractionOverlay` to call new `drawActionMenu`**

Find the call to `drawActionMenu` inside `drawInteractionOverlay` and replace with:

```js
if (interactionState.mode === 'menu_open' || interactionState.mode === 'npc_menu_open') {
  const menuTitle = interactionState.mode === 'npc_menu_open' ? 'NPC actions' : 'Action menu';
  drawActionMenu(
    ctx,
    interactionState.menuLayout,
    interactionState.menuItems,
    interactionState.hoveredMenuItemIndex,
    menuTitle,
  );
}
```

- [ ] **Step 4: Add hunt ring drawing function**

Add this function after `drawHoveredCharacter`:

```js
function drawHuntRing(ctx, character) {
  if (!character.hunt || character.hunt.phase !== 'hunting') return;

  const progress = Math.min(1, character.hunt.elapsed / character.hunt.duration);
  const cx = character.pos.x;
  const cy = character.pos.y;
  const radius = 20;

  ctx.save();
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(180, 0, 0, 0.3)';
  ctx.stroke();

  if (progress > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = '#ff2244';
    ctx.stroke();
  }

  ctx.restore();
}
```

- [ ] **Step 5: Call `drawHuntRing` for every character**

In `drawCharacters`, after the second loop (where characters are drawn as circles/diamonds), add a third pass for hunt rings:

```js
function drawCharacters(ctx, characters) {
  for (const character of characters) {
    drawCharacterTrail(ctx, character);
  }

  for (const character of characters) {
    // … existing shape drawing code unchanged …
  }

  for (const character of characters) {
    drawHuntRing(ctx, character);
  }
}
```

- [ ] **Step 6: Update `renderCity` signature to accept `notifications`**

```js
export function renderCity(ctx, city, characters = [], interactionState = null, notifications = []) {
```

- [ ] **Step 7: Verify ring in browser**

For quick visual verification, temporarily change `HUNT_DURATION_MS` to `60_000` in `simulation/hunt.js` (1 game minute instead of 1 hour). At `10×` speed the ring fills in ~6 real seconds. Restore to `3_600_000` after verification. No console errors.

- [ ] **Step 8: Commit**

```bash
git add renderer/canvas.js
git commit -m "feat: dynamic menu rendering and hunt timer ring"
```

---

### Task 6: Render success notification (`renderer/canvas.js`)

**Files:**
- Modify: `renderer/canvas.js`

- [ ] **Step 1: Add notification drawing function**

Add this function after `drawHuntRing`:

```js
function drawHuntSuccessNotifications(ctx, characters, notifications) {
  const DURATION = 2500;

  for (const notification of notifications) {
    if (notification.type !== 'hunt_success') continue;

    const character = characters.find((c) => c.id === notification.characterId);
    if (!character) continue;

    const age = performance.now() - notification.createdAt;
    const t = Math.min(1, age / DURATION);
    const alpha = 1 - t;
    const floatOffset = t * 18;
    const cx = character.pos.x;
    const cy = character.pos.y;

    ctx.save();

    // Expanding gold ring
    ctx.beginPath();
    ctx.arc(cx, cy, 24 + t * 14, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.85})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Floating text
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText('Hunt successful!', cx, cy - 30 - floatOffset);
    ctx.textAlign = 'left';

    ctx.restore();
  }
}
```

- [ ] **Step 2: Call it at the end of `renderCity` (topmost layer)**

At the very end of `renderCity`, after all other drawing calls:

```js
drawHuntSuccessNotifications(ctx, characters, notifications);
```

- [ ] **Step 3: Verify success animation in browser**

Complete a hunt at `10×` speed. Verify:
- NPC disappears from canvas
- Gold ring expands from player, fades out over ~2.5s
- `"Hunt successful!"` text floats upward and fades

No console errors.

- [ ] **Step 4: Commit**

```bash
git add renderer/canvas.js
git commit -m "feat: render hunt success notification (flash ring + floating text)"
```

---

### Task 7: Player panel hunt status (`ui/playerPanel.js` + `index.html`)

**Files:**
- Modify: `ui/playerPanel.js`
- Modify: `index.html`

- [ ] **Step 1: Add `getHuntStatusText` helper**

In `ui/playerPanel.js`, add after the existing `getStatusText` function:

```js
function getHuntStatusText(character, notifications) {
  const hasSuccess = notifications?.some(
    (n) => n.type === 'hunt_success' && n.characterId === character.id,
  );

  if (hasSuccess) return { text: '✓ Polowanie zakończone sukcesem', modifier: 'success' };
  if (!character.hunt) return null;
  if (character.hunt.phase === 'moving') return { text: '🏹 Zmierza do celu...', modifier: null };

  const percent = Math.floor((character.hunt.elapsed / character.hunt.duration) * 100);
  return { text: `🏹 Polowanie... ${percent}%`, modifier: null };
}
```

- [ ] **Step 2: Add hunt status element to `createCard`**

Update `createCard` to accept `notifications` and append the hunt status row:

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
  card.append(top, status, hint);

  const huntStatus = getHuntStatusText(character, notifications);
  if (huntStatus) {
    const huntEl = document.createElement('div');
    huntEl.className = huntStatus.modifier
      ? `hunt-status hunt-status--${huntStatus.modifier}`
      : 'hunt-status';
    huntEl.textContent = huntStatus.text;
    card.append(huntEl);
  }

  return card;
}
```

- [ ] **Step 3: Update `buildRenderSignature` to include hunt state**

Hunt progress changes every frame — include `hunt.elapsed` in the signature so the panel re-renders during active hunts:

```js
function buildRenderSignature(characters, interactionState, notifications) {
  return JSON.stringify({
    selectedCharacterId: interactionState?.selectedCharacterId ?? null,
    notificationCount: notifications?.length ?? 0,
    characters: characters.map((character) => ({
      id: character.id,
      isPlayer: character.isPlayer,
      pathLength: character.path?.length ?? 0,
      destination: character.destination,
      huntPhase: character.hunt?.phase ?? null,
      huntPercent: character.hunt
        ? Math.floor((character.hunt.elapsed / character.hunt.duration) * 100)
        : null,
    })),
  });
}
```

- [ ] **Step 4: Update `update` and `render` to accept and pass notifications**

Update the `render` function inside `createPlayerPanel`:

```js
let latestNotifications = [];

function render() {
  const characters = (typeof getCharacters === 'function' ? getCharacters() : []) ?? [];
  const playerCharacters = characters.filter((character) => character?.isPlayer);
  const nextSignature = buildRenderSignature(
    playerCharacters, latestInteractionState, latestNotifications,
  );

  if (nextSignature === lastRenderSignature) {
    return;
  }

  lastRenderSignature = nextSignature;
  mount.replaceChildren();

  if (playerCharacters.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'player-panel-empty';
    empty.textContent = EMPTY_LABEL;
    mount.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const character of playerCharacters) {
    const isSelected = latestInteractionState?.selectedCharacterId === character.id;
    fragment.append(createCard(character, isSelected, latestNotifications));
  }
  mount.append(fragment);
}
```

Update `update` to accept `notifications`:

```js
return {
  update(interactionState, notifications) {
    latestInteractionState = interactionState ?? null;
    latestNotifications = notifications ?? [];
    render();
  },
};
```

- [ ] **Step 5: Add CSS in `index.html`**

Find the `<style>` block in `index.html` and add:

```css
.hunt-status {
  font-size: 11px;
  color: #ff6688;
  margin-top: 4px;
}

.hunt-status--success {
  color: #ffd700;
}
```

- [ ] **Step 6: Verify player panel in browser**

Start a hunt at `1×` speed. Verify the player's card shows:
- `🏹 Zmierza do celu...` while moving to NPC
- `🏹 Polowanie... X%` (incrementing) during hunt phase
- `✓ Polowanie zakończone sukcesem` briefly after success

No console errors.

- [ ] **Step 7: Commit**

```bash
git add ui/playerPanel.js index.html
git commit -m "feat: show hunt status in player panel card"
```
