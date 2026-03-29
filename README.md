# Fangs — Prototype

Procedurally generated city map built in plain HTML/JavaScript (no bundler, no framework).

## Stage 1 — City Generator

- Orthogonal street grid divided into color-coded districts
- Top-left player-owned district highlighted with a dark red border
- Compound buildings (L/T/U shapes) filling city blocks
- Dead-end secondary streets
- Player and NPC characters navigating the street graph with BFS
- Seed-based deterministic city generation and initial character placement
- Player characters spawning inside the player-owned district
- Special buildings, starting with a `Nest` in the player-owned district, highlighted directly on the map and exposing an info popup
- Non-uniform real-time day/night cycle with a seeded 2026 calendar: night lasts 3 minutes, day lasts 43.75 seconds, and a full in-game day lasts 3 minutes 43.75 seconds
- Time bar showing named phases, full date, and a color-split day/night slider with phase dividers
- Hunt action for player characters: pick an NPC, close in, freeze both characters, and resolve the hunt with a timed action ring
- Blood stat for player characters: passive decay over game time, slower drain inside the player district, refill on successful hunt, and a persistent hunger warning below 20%
- Trait system with `Vampire` and `Flying`, including in-panel trait management for player characters
- Text/debug hooks for browser automation via `window.render_game_to_text()` and `window.advanceTime(ms)`

## Running

Install the only current dependency once:

```bash
npm install
```

Open `index.html` via a local server (ES modules require HTTP):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

For browser-based visual checks used during development:

```bash
node scripts/local_playwright_check.mjs http://127.0.0.1:8080/index.html output/web-game
```

## Time Semantics

This project uses both **real time** and **game time**, and they are not interchangeable.

- Use **game time** for simulation mechanics: blood decay, hunt duration, cooldowns, day/night progression, and any balancing logic.
- Use **real time** only for browser/frame plumbing such as `requestAnimationFrame`, `performance.now()`, and raw frame deltas entering the main loop.
- The game clock currently maps **3 minutes of real night** plus **43.75 seconds of real day** to **24 in-game hours**.
- If you are modifying a time-based system and it is not obvious which clock should drive it, the intended default is almost always **game time**.

## Controls

The app now exposes an in-browser control panel plus the same values in `main.js`.

### In-browser controls

The top panel contains sliders for:

| Control | Description |
|---|---|
| `Seed` | Deterministic seed for the whole city (`0..99999`) |
| `Districts` | Target number of districts used to derive the major grid (`2..12`) |
| `Street Density` | Density of secondary streets inside districts (`1..10`) |
| `Building Density` | Fraction of valid parcels that should be filled with buildings (`1..10`) |
| `Characters` | Number of walkers spawned onto the street graph (`1..50`) |

Changing sliders does not immediately regenerate the map. Click `Regenerate` to apply the pending values.

The same top panel now also includes time controls for the live simulation:

| Control | Description |
|---|---|
| `■` | Pause character movement completely (`0x`) |
| `1×` | Normal simulation speed |
| `2×` | Double-speed simulation |
| `4×` | Fast-forward simulation |
| `10×` | Maximum fast-forward mode |
| `▲ / ▼` | Collapse or expand the main control panel while leaving the time controls visible |

The panel starts collapsed by default after a fresh page load, so the time bar and simulation stay in focus until you expand the controls.

Keyboard shortcuts mirror the buttons:

| Key | Action |
|---|---|
| `0` | Pause (`■`) |
| `1` | Set `1×` speed |
| `2` | Set `2×` speed |
| `3` | Set `4×` speed |
| `4` | Set `10×` speed |

The day display in the time bar includes:

| Element | Description |
|---|---|
| Phase line | Current named phase plus `HH:MM` game time |
| Timeline slider | Visual 24-hour bar where the left edge is the start of night |
| Night/day split | Dark blue night segment and warm gold day segment |
| Phase dividers | Thin unlabeled lines marking phase boundaries across the day |
| Date line | Calendar date, weekday, and current game day number |

Below the canvas, the app also shows a dedicated player-character panel:

| Element | Description |
|---|---|
| `Character N` cards | One card per player-controlled character |
| Status line | Shows `idle`, `moving`, `target: node N`, or `following: character N` |
| Traits row | Shows every currently assigned trait on that character |
| Hunt line | Shows `HUNT: TRACKING TARGET`, `HUNT: IN PROGRESS X%`, or `HUNT SUCCESSFUL` when relevant |
| Blood row | Shows the current Blood bar and floored numeric value |
| Hunger notice | Shows `⚠ HUNGER!` while Blood is below the hunger threshold |
| Card click | Opens the same action menu as clicking that player character on the map |
| `+ Trait` | Opens a contextual menu listing all available traits for that character |
| `- Traits` | Toggles trait-removal mode; while active, clicking a trait pill removes it from that character |

The top-left district is reserved as the player district. It is outlined in dark red as a topmost overlay so the border stays visible, and the initial player-controlled walkers spawn on street nodes inside that district after every regeneration.

That same district now also contains the current special building:

| Building | Description |
|---|---|
| `Nest` | Largest building in the player-owned district. Rendered with a bright violet marker/outline, opens a small in-canvas action menu on click, and exposes an HTML info card with lore text. |

### Map interactions

| Interaction | Result |
|---|---|
| Click a player character | Opens that character's action menu |
| Click the `Nest` special building | Opens a building action menu titled `Nest` |
| Click `Info` in the Nest menu | Opens the floating top-right HTML info card |
| `Escape` | Closes open character/building menus and the building info card |
| Open a character menu while a building menu is open | Building menu closes automatically |
| Open the Nest menu while a character menu is open | Character menu closes automatically |

### Main runtime parameters (`main.js`)

These are still the default values loaded on page start:

| Variable | Description |
|---|---|
| `CANVAS_WIDTH` | Canvas width in pixels |
| `CANVAS_HEIGHT` | Canvas height in pixels |
| `PLAYER_COUNT` | Number of spawned characters treated as player-controlled |
| `params.seed` | Deterministic seed. Same seed + same params = same city |
| `params.districts` | Target number of districts used to derive the major grid |
| `params.streetDensity` | Density of secondary streets inside each district |
| `params.buildingDensity` | How many valid parcels receive buildings; low values leave more empty parcels, high values fill more of the city |
| `params.characters` | Number of moving dots spawned after each regeneration |

Example:

```js
const params = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  seed: 12345,
  districts: 9,
  streetDensity: 3,
  buildingDensity: 10,
  characters: 10,
};
```

After changing defaults in `main.js`, refresh the page.

## Debug Hooks

The browser exposes two helpers on `window`:

| Hook | Description |
|---|---|
| `window.render_game_to_text()` | Returns a JSON string describing the current visible/simulation state |
| `window.advanceTime(ms)` | Advances the simulation deterministically by the provided **real-time** milliseconds |

Typical console usage:

```js
JSON.parse(window.render_game_to_text())
window.advanceTime(60_000)
JSON.parse(window.render_game_to_text()).characters.filter((c) => c.isPlayer)
```

## Internal Tuning Variables

These constants shape generation behavior and visuals. Most day-to-day tweaking should happen in `main.js`; the constants below are lower-level rules.

### District generation (`generator/districts.js`)

| Variable | Description |
|---|---|
| `MAJOR_STREET_WIDTH` | Width of major streets separating districts |
| `DISTRICT_COLORS` | Base fill colors assigned per district |

### Secondary streets (`generator/streets.js`)

| Variable | Description |
|---|---|
| `SECONDARY_STREET_WIDTH` | Width of minor streets inside districts |
| `DEAD_END_RATIO` | Fraction of secondary streets that become dead ends |
| `MIN_STREET_GAP` | Minimum spacing between generated streets |
| `MIN_DEAD_END_LENGTH` | Minimum length for a dead-end street |

### Buildings (`generator/buildings.js`)

| Variable | Description |
|---|---|
| `BLOCK_PADDING` | Margin between a street corridor and the start of buildable land |
| `CELL_PADDING` | Inner padding inside a parcel before placing a building rect |
| `MIN_BLOCK_SPAN` | Minimum parcel size treated as a normal buildable block |
| `MIN_BASE_SIZE` | Minimum width/height of a building base rectangle |
| `STREET_CLEARANCE` | Extra safety distance so buildings never touch streets |
| `BUILDING_PLACEMENT_ATTEMPTS` | Number of placement retries before giving up on a parcel |
| `FALLBACK_SCAN_STEP` | Step size used when scanning a district for tiny fallback build spots |
| `FALLBACK_CELL_SIZE` | Size of the emergency fallback parcel used in tight districts |
| `getParcelSpan(buildingDensity)` | Controls how finely a block is subdivided into candidate parcels |
| `getMaxBuildingCells(block, buildingDensity)` | Caps how many candidate parcels a block can produce for a given density |

### Renderer (`renderer/canvas.js`)

| Variable | Description |
|---|---|
| `BACKGROUND_COLOR` | Canvas background color |
| `STREET_FILL` | Street fill color |
| `STREET_EDGE` | Subtle edge highlight drawn on streets |
| `INTERSECTION_FILL` | Small debug dots drawn at graph intersections |
| `CHARACTER_RADIUS` | Radius of each moving dot character |
| `CHARACTER_TRAIL_STEPS` | Maximum number of recent trail points rendered |
| `SELECTION_RING_RADIUS` | Radius of the selected-character ring |
| `HUNT_RING_RADIUS` | Radius of the hunt progress ring |
| `NOTIFICATION_LIFETIME_MS` | Lifetime of hunt-success notifications in real milliseconds |
| Special-building marker styles in `drawSpecialBuildings(...)` | Controls the glow, outline, and diamond marker used to highlight special buildings such as the Nest |

### Characters (`entities/character.js`)

| Variable | Description |
|---|---|
| `CHARACTER_COLORS` | Repeating palette used for spawned walkers |
| `TRAIL_LENGTH` | Maximum number of stored trail points per character |
| `speed: rng.float(3, 20)` | Default movement speed range in pixels per second |
| `blood` | Current Blood value assigned on character creation |
| `maxBlood` | Maximum Blood capacity for the character |
| `hungry` | Whether the character is currently below the hunger threshold |
| `traits` | Array of attached trait objects such as `VampireTrait` or `FlyingTrait` |
| `flyTarget` | Current straight-line destination used by `FlyingTrait` |

To change how fast characters move, edit the `speed` assignment inside `createCharacter(...)` in `entities/character.js`.
Examples:

```js
speed: rng.float(1, 8), // slower range
speed: rng.float(20, 45), // faster range
speed: 70, // same speed for every character
```

### Traits (`entities/traits/*.js`)

| Trait | Description |
|---|---|
| `VampireTrait` | Marker trait used by Blood simulation and assigned to player characters by default |
| `FlyingTrait` | Overrides street walking with straight-line movement and can pursue Hunt targets in the air |

Trait registry:

| Export | Description |
|---|---|
| `TRAIT_DEFINITIONS` | List of all traits exposed to the player-panel add-trait menu |
| `getTraitDefinitionById(traitId)` | Resolves a trait object from the registry for runtime assignment |

### Blood simulation (`simulation/blood.js`)

| Variable | Description |
|---|---|
| `HUNGER_THRESHOLD` | Hunger threshold as a fraction of `maxBlood` |
| `DECAY_PER_HOUR` | Blood decay per **game hour** as a fraction of `maxBlood` |
| `DISTRICT_DECAY_MULTIPLIER` | Blood decay multiplier while inside the player-owned district |
| `HUNT_BLOOD_GAIN` | Flat Blood refill applied on successful hunt |
| `updateBlood(characters, dt, playerDistricts)` | Applies Blood decay using **game-time milliseconds** |
| `applyHuntBloodGain(character)` | Refills Blood and re-evaluates hunger state |

### Clock (`simulation/clock.js`)

| Variable | Description |
|---|---|
| `NIGHT_REAL_MS` | Real-time duration of the full night segment |
| `DAY_PHASE_REAL_MS` | Real-time duration of the full day segment |
| `CYCLE_REAL_MS` | Total real-time duration of one in-game day |
| `gameHourToSliderPercent(hour)` | Maps an in-game hour to the shifted timeline slider position |
| `clock.getGameRate(realMs)` | Returns the current real-time to game-time multiplier for the active phase |

Current defaults:

```js
const HUNGER_THRESHOLD = 0.2;
const DECAY_PER_HOUR = 0.75 / 24; // 75% of maxBlood per full game day
const DISTRICT_DECAY_MULTIPLIER = 0.5;
const HUNT_BLOOD_GAIN = 45;
```

### Clock and day/night simulation (`simulation/clock.js`)

| Variable | Description |
|---|---|
| `DAY_REAL_MS` | Real-time duration of one full in-game day |
| `GAME_DAY_MS` | One in-game day in simulation milliseconds |
| `GAME_CLOCK_RATIO` | Multiplier converting real milliseconds into game milliseconds |
| `GAME_HOUR_SIM_MS` | Real-time duration of one in-game hour |
| `PHASES` | Named day/night phases and whether they are dangerous |
| `MONTHS` | 2026 month table used for the calendar readout |
| `DAYS_OF_WEEK` | Weekday labels used by the clock |
| `JAN1_2026_DOW` | Day-of-week anchor for the seeded 2026 calendar |

### Hunt simulation (`simulation/hunt.js`)

| Variable | Description |
|---|---|
| `HUNT_DURATION_MS` | Duration of the active hunt phase in **real milliseconds** |
| `startHunt(playerChar, npcChar)` | Locks an NPC, starts pursuit, and seeds hunt state |
| `updateHunts(characters, dt, onHuntComplete)` | Advances pursuit and active hunt countdown |
| `cancelHunt(playerChar, characters)` | Cancels the active hunt and releases the NPC |

### Slider controls (`ui/controls.js`)

| Variable | Description |
|---|---|
| `CONTROL_CONFIG` | Slider definitions, labels, and min/max/step ranges for the top panel |

### Time-speed controls (`ui/timeControls.js`)

| Variable | Description |
|---|---|
| `SPEEDS` | Available time-scale buttons and keyboard mappings |

### Day display (`ui/dayDisplay.js`)

| Variable | Description |
|---|---|
| `DAY_MINUTES` | Minutes in a full in-game day |
| `NIGHT_START_HOUR` | Hour used as the visual start of the timeline |
| `DAY_START_HOUR` | Hour where the day segment begins |
| `PHASE_DIVIDER_HOURS` | Hours rendered as divider lines on the slider |

### Interaction (`ui/interaction.js`)

| Variable | Description |
|---|---|
| `CHARACTER_HIT_RADIUS` | Hit radius for selecting a character on the canvas |
| `STREET_NODE_FALLBACK_RADIUS` | Max fallback search radius when no street node is directly under the cursor |
| `MENU_WIDTH` | Width of the popup action menu |
| `MENU_ITEM_HEIGHT` | Height of each popup menu row |
| `MENU_PADDING` | Internal popup menu padding |
| `NPC_MENU_ITEMS` | Menu items shown when targeting an NPC action menu |
| `HUNTING_MENU_ITEMS` | Menu items shown while a player character is already hunting |

## Character Interaction

Current MVP interaction on the canvas:

1. Click a player character to select it.
2. Use the popup menu to choose `Choose destination` or `Hunt`.
3. For `Choose destination`, click a street once to preview a node destination, then click the same street target again to confirm it.
4. Or click another character once to preview follow / chase, then click that same character again to confirm it.
5. For `Hunt`, click an NPC from the open player menu or enter hunt-picking and confirm the target NPC.
6. Once the hunter reaches the target, both characters stop in the same place and a hunt timer ring starts counting down.
7. The default hunt duration is `1` game hour, which equals `12.5` real seconds at `1×` speed because the game clock runs at `5` real minutes per full day.
8. Blood decays continuously in the background over **game time**; while a player character stays in the player district, decay is reduced.
9. A successful hunt restores Blood by a flat amount and can clear the hunger warning immediately.
10. Press `Esc` or click the selected player character again to clear the selection.

The interaction layer maps a street click to the nearest reachable street-graph node, keeps it as a preview target, and only commits the reroute on the second matching click. After a destination is confirmed, the selected player character returns to the popup-menu state so another action can be chosen immediately. NPCs remain visible and can still be used as follow targets, but they do not open the action menu.

## How City Generation Works

1. `generator/districts.js` builds the major district grid, assigns district colors, and marks the top-left district as player-owned.
2. `generator/streets.js` adds full-span secondary streets and dead ends inside each district.
3. `generator/graph.js` converts street crossings and endpoints into an intersection graph.
4. `generator/buildings.js` derives buildable parcels from the street layout, accounts for dead ends and street clearance, and fills a density-dependent share of those parcels with compound buildings.
5. `pathfinding/bfs.js` finds shortest routes across the intersection graph.
6. `entities/character.js` advances characters segment-by-segment, keeps a short visual trail, and uses the player / NPC split established in `main.js`.
7. `ui/controls.js` manages slider state and only applies it when `Regenerate` is clicked.
8. `simulation/clock.js` derives the 24-hour clock, named phases, and seeded 2026 calendar from elapsed simulation time.
9. `ui/timeControls.js` manages simulation speed buttons, keyboard shortcuts, and the active time-scale state.
10. `ui/dayDisplay.js` renders the current phase, date, and the visual day/night timeline slider.
11. `simulation/hunt.js` owns hunt state, target locking, countdown progress, cancellation, and completion.
12. `simulation/blood.js` applies Blood decay and hunt-based Blood restoration.
13. `ui/interaction.js` handles canvas hit testing, player-character selection, dynamic action menus, hunt targeting, and street-click rerouting.
14. `ui/playerPanel.js` keeps the player-character status cards in sync with the current selection, movement state, hunt progress, Blood, and hunger state.
15. `renderer/canvas.js` draws districts, streets, buildings, moving characters, interaction overlays, hunt timers, success notifications, the player-district border, and debug intersections.
16. `main.js` regenerates the city, spawns player characters inside the player-owned district, wires the clock, Blood, and hunt simulation into the UI, and exposes debug state through `render_game_to_text()`.

## Architecture

```
generator/     — Procedural city generation (districts, streets, buildings, graph)
pathfinding/   — BFS route finding on the street graph
entities/      — Character spawning and movement updates
renderer/      — Stateless Canvas renderer
ui/            — Control panel, time controls, player panel, and canvas interaction flow
simulation/    — Pure simulation helpers such as the day/night clock, Blood system, and hunt action state
scripts/       — Local development helpers (including Playwright screenshot checks)
main.js        — Game loop and high-level parameters
```

See `docs/superpowers/specs/` for the full design spec and `docs/superpowers/plans/` for the implementation plan.
