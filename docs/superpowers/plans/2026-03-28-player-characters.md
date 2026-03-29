# Player Characters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguish the first N characters as player-controlled — diamond shape on map, action menu on click, dedicated panel below the canvas with status cards synced to canvas selection.

**Architecture:** A single `isPlayer` boolean flag on each character object gates menu access in the interaction controller and drives both the diamond renderer and the new HTML panel. The panel module reads characters and interaction state each frame to stay live.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D API, DOM

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `entities/character.js` | Modify | Add `isPlayer: false` default field |
| `main.js` | Modify | `PLAYER_COUNT` constant, assign flag, wire panel |
| `ui/interaction.js` | Modify | Gate menu on `isPlayer`, expose `openMenuForCharacter` publicly |
| `renderer/canvas.js` | Modify | Diamond shape for player characters |
| `ui/playerPanel.js` | Create | Panel HTML rendering, card click → selection |
| `index.html` | Modify | Add `#player-panel` element and its CSS |

---

## Task 1: Add `isPlayer` field to character data model

**Files:**
- Modify: `entities/character.js:243`
- Modify: `main.js:9,84-87`

- [ ] **Step 1: Add `isPlayer: false` to `createCharacter()` in `entities/character.js`**

  Find the `char` object literal (line 243, inside `createCharacter`). Add `isPlayer` after `destination`:

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
    rng: createLocalRNG(rng.int(1, 0x7fffffff)),
  };
  ```

- [ ] **Step 2: Add `PLAYER_COUNT` constant to `main.js`**

  After `const CANVAS_HEIGHT = 700;` (line 10), add:

  ```js
  const PLAYER_COUNT = 3;
  ```

- [ ] **Step 3: Assign `isPlayer` flag in `createCharacters()` in `main.js`**

  Replace the current loop body (lines 84–87):

  ```js
  // Before:
  for (let index = 0; index < characterCount; index += 1) {
    characters.push(createCharacter(city.intersections, rng, index));
  }
  ```

  With:

  ```js
  for (let index = 0; index < characterCount; index += 1) {
    const char = createCharacter(city.intersections, rng, index);
    char.isPlayer = index < PLAYER_COUNT;
    characters.push(char);
  }
  ```

- [ ] **Step 4: Expose `isPlayer` in `render_game_to_text` in `main.js`**

  In the `characters` mapping inside `window.render_game_to_text` (around line 165), add `isPlayer`:

  ```js
  characters: state.characters.map((character) => ({
    id: character.id,
    isPlayer: character.isPlayer,
    color: character.color,
    pos: {
      x: Number(character.pos.x.toFixed(2)),
      y: Number(character.pos.y.toFixed(2)),
    },
    from: character.from,
    to: character.to,
    progress: Number(character.progress.toFixed(3)),
    pathLength: character.path.length,
    destination: character.destination,
    trail: character.trail.slice(0, 10).map((point) => ({
      x: Number(point.x.toFixed(2)),
      y: Number(point.y.toFixed(2)),
    })),
  })),
  ```

- [ ] **Step 5: Verify in browser**

  Open `http://127.0.0.1:8080/index.html`, open DevTools console, run:

  ```js
  JSON.parse(window.render_game_to_text()).characters.slice(0, 4).map(c => ({ id: c.id, isPlayer: c.isPlayer }))
  ```

  Expected: first 3 have `isPlayer: true`, index 3 has `isPlayer: false`.

- [ ] **Step 6: Commit**

  ```bash
  git add entities/character.js main.js
  git commit -m "feat: add isPlayer flag to character data model"
  ```

---

## Task 2: Gate interaction on `isPlayer`, expose `openMenuForCharacter`

**Files:**
- Modify: `ui/interaction.js:253-264,350-356,362-371,419-430`

- [ ] **Step 1: Gate hover highlight on `isPlayer` in `handlePointerMove`**

  In `handlePointerMove` (around line 258–259), change:

  ```js
  // Before:
  state.hoveredCharacterId = hoveredCharacter?.id ?? null;
  ```

  To:

  ```js
  state.hoveredCharacterId = hoveredCharacter?.isPlayer ? hoveredCharacter.id : null;
  ```

  This prevents pointer cursor and hover ring from appearing on NPCs.

- [ ] **Step 2: Gate menu open on `isPlayer` in idle click handler**

  In `handleClick`, the `idle` branch (around line 350–355):

  ```js
  // Before:
  if (state.mode === 'idle') {
    if (clickedCharacter) {
      openMenuForCharacter(clickedCharacter.id);
    }
    return;
  }
  ```

  Change to:

  ```js
  if (state.mode === 'idle') {
    if (clickedCharacter?.isPlayer) {
      openMenuForCharacter(clickedCharacter.id);
    }
    return;
  }
  ```

- [ ] **Step 3: Gate menu switch on `isPlayer` in `menu_open` click handler**

  In `handleClick`, the `menu_open` branch (around lines 362–371), after `handleMenuClick`:

  ```js
  // Before:
  if (clickedCharacter) {
    openMenuForCharacter(clickedCharacter.id);
  }
  ```

  Change to:

  ```js
  if (clickedCharacter?.isPlayer) {
    openMenuForCharacter(clickedCharacter.id);
  }
  ```

- [ ] **Step 4: Expose `openMenuForCharacter` in the return object**

  The `return` statement at the bottom of `createInteractionController` (around line 419):

  ```js
  // Before:
  return {
    clearSelection,
    getState,
    reset,
    destroy() {
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('mouseleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.style.cursor = 'default';
    },
  };
  ```

  Change to:

  ```js
  return {
    clearSelection,
    openMenuForCharacter,
    getState,
    reset,
    destroy() {
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('mouseleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.style.cursor = 'default';
    },
  };
  ```

- [ ] **Step 5: Verify in browser**

  Open `http://127.0.0.1:8080/index.html`. Click on NPC characters (index 3+, which are circles without the diamond shape from Task 3). Confirm: no menu opens, cursor stays default. Click on character 0/1/2 — menu still opens normally.

  Also run in console:
  ```js
  typeof window.interaction  // should be 'object' if you expose it — but it isn't yet. Just test visually.
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add ui/interaction.js
  git commit -m "feat: gate action menu on isPlayer, expose openMenuForCharacter"
  ```

---

## Task 3: Render player characters as diamonds

**Files:**
- Modify: `renderer/canvas.js:102-121`

- [ ] **Step 1: Split `drawCharacters` to render diamonds for players**

  Replace the second loop in `drawCharacters` (lines 107–120) — the one that draws the character body:

  ```js
  // Before:
  for (const character of characters) {
    ctx.save();
    ctx.shadowColor = character.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = character.color;
    ctx.beginPath();
    ctx.arc(character.pos.x, character.pos.y, CHARACTER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.stroke();
    ctx.restore();
  }
  ```

  Replace with:

  ```js
  for (const character of characters) {
    ctx.save();
    ctx.shadowColor = character.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = character.color;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';

    if (character.isPlayer) {
      ctx.translate(character.pos.x, character.pos.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.strokeRect(-4, -4, 8, 8);
    } else {
      ctx.beginPath();
      ctx.arc(character.pos.x, character.pos.y, CHARACTER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
  ```

- [ ] **Step 2: Verify in browser**

  Open `http://127.0.0.1:8080/index.html`. Confirm: first 3 characters appear as glowing diamonds, remaining characters are still circles. Trails and selection rings still work on player characters.

- [ ] **Step 3: Commit**

  ```bash
  git add renderer/canvas.js
  git commit -m "feat: render player characters as diamonds"
  ```

---

## Task 4: Create `ui/playerPanel.js`

**Files:**
- Create: `ui/playerPanel.js`

- [ ] **Step 1: Write `ui/playerPanel.js`**

  ```js
  const LABEL_PREFIX = 'Character';

  function getStatus(char) {
    if (char.destination?.type === 'character') {
      return `following: character ${char.destination.characterId + 1}`;
    }
    if (char.path.length > 0) {
      return 'w ruchu';
    }
    return 'bezczynna';
  }

  function buildCard(char, isSelected, onSelectCharacter) {
    const card = document.createElement('div');
    card.className = 'player-card' + (isSelected ? ' player-card--selected' : '');
    card.style.setProperty('--char-color', char.color);

    const swatch = document.createElement('div');
    swatch.className = 'player-card-swatch';

    const info = document.createElement('div');
    info.className = 'player-card-info';

    const name = document.createElement('span');
    name.className = 'player-card-name';
    name.textContent = `${LABEL_PREFIX} ${char.id + 1}`;

    const status = document.createElement('span');
    status.className = 'player-card-status';
    status.textContent = getStatus(char);

    info.appendChild(name);
    info.appendChild(status);
    card.appendChild(swatch);
    card.appendChild(info);

    card.addEventListener('click', () => onSelectCharacter(char.id));
    return card;
  }

  export function createPlayerPanel({ mount, getCharacters, onSelectCharacter }) {
    function update(interactionState) {
      const characters = getCharacters() ?? [];
      const playerCharacters = characters.filter((c) => c.isPlayer);

      mount.innerHTML = '';

      if (playerCharacters.length === 0) {
        return;
      }

      const bar = document.createElement('div');
      bar.className = 'player-panel-bar';

      for (const char of playerCharacters) {
        const isSelected = interactionState?.selectedCharacterId === char.id;
        bar.appendChild(buildCard(char, isSelected, onSelectCharacter));
      }

      mount.appendChild(bar);
    }

    return { update };
  }
  ```

- [ ] **Step 2: Verify module syntax**

  No browser test yet (not wired). Quick check — open `http://127.0.0.1:8080/index.html`, open DevTools Network tab, confirm `ui/playerPanel.js` is not yet loaded (it will 404 or not appear — that's expected since it's not imported yet).

- [ ] **Step 3: Commit**

  ```bash
  git add ui/playerPanel.js
  git commit -m "feat: add player panel module"
  ```

---

## Task 5: Wire panel into `index.html` and `main.js`

**Files:**
- Modify: `index.html:229,248-276`
- Modify: `main.js:1-8,102-104`

- [ ] **Step 1: Add `#player-panel` element and CSS to `index.html`**

  In the `<style>` block, before the closing `</style>` tag (after the `@media` block, line ~247), add:

  ```css
  #player-panel {
    width: 900px;
    max-width: 100%;
  }

  .player-panel-bar {
    display: flex;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid rgba(160, 175, 218, 0.2);
    border-radius: 10px;
    background: rgba(12, 18, 32, 0.78);
    backdrop-filter: blur(8px);
  }

  .player-card {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid rgba(160, 175, 218, 0.14);
    border-radius: 8px;
    background: rgba(20, 27, 47, 0.52);
    cursor: pointer;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  .player-card:hover {
    border-color: color-mix(in srgb, var(--char-color) 55%, transparent);
  }

  .player-card--selected {
    border-color: var(--char-color);
    box-shadow: 0 0 10px color-mix(in srgb, var(--char-color) 30%, transparent);
  }

  .player-card-swatch {
    width: 12px;
    height: 12px;
    background: var(--char-color);
    transform: rotate(45deg);
    flex-shrink: 0;
  }

  .player-card-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .player-card-name {
    font-size: 11px;
    color: #d9e1ff;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .player-card-status {
    font-size: 10px;
    color: #9ca6c7;
  }

  .player-card--selected .player-card-status {
    color: var(--char-color);
  }
  ```

  In the `<body>`, after `<canvas id="city-canvas" ...>` (line ~272), add:

  ```html
  <div id="player-panel"></div>
  ```

- [ ] **Step 2: Import `createPlayerPanel` and wire it in `main.js`**

  Add import at the top of `main.js` (after existing imports):

  ```js
  import { createPlayerPanel } from './ui/playerPanel.js';
  ```

  After `const timeControlsPanel = document.getElementById('time-controls');` (line ~18), add:

  ```js
  const playerPanelEl = document.getElementById('player-panel');
  ```

  After the `interaction` controller is created (after line ~51), add:

  ```js
  const playerPanel = createPlayerPanel({
    mount: playerPanelEl,
    getCharacters: () => state.characters,
    onSelectCharacter(characterId) {
      interaction.openMenuForCharacter(characterId);
      render();
    },
  });
  ```

- [ ] **Step 3: Call `playerPanel.update()` inside `render()`**

  Replace the `render` function (lines 102–104):

  ```js
  // Before:
  function render() {
    renderCity(ctx, state.city, state.characters, interaction.getState());
  }
  ```

  With:

  ```js
  function render() {
    const interactionState = interaction.getState();
    renderCity(ctx, state.city, state.characters, interactionState);
    playerPanel.update(interactionState);
  }
  ```

- [ ] **Step 4: Verify full flow in browser**

  Open `http://127.0.0.1:8080/index.html`. Check:

  1. Panel with 3 cards appears below the canvas.
  2. Status lines update as characters move (`bezczynna` / `w ruchu`).
  3. Clicking a card opens the action menu on that character and highlights the card.
  4. Clicking the character on the canvas opens the menu and highlights the matching card.
  5. Pressing Escape dismisses the menu and unhighlights the card.
  6. Clicking Regenerate — panel refreshes with new characters.
  7. Clicking an NPC on the canvas — nothing happens.

- [ ] **Step 5: Commit**

  ```bash
  git add index.html main.js
  git commit -m "feat: wire player panel into UI"
  ```
