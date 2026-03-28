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

## Running

Open `index.html` via a local server (ES modules require HTTP):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

For browser-based visual checks used during development:

```bash
node scripts/local_playwright_check.mjs http://127.0.0.1:8080/index.html output/web-game
```

## Controls

The app now exposes an in-browser control panel plus the same values in `main.js`.

### In-browser controls

The top panel contains sliders for:

| Control | Description |
|---|---|
| `Seed` | Deterministic seed for the whole city |
| `Districts` | Target number of districts used to derive the major grid |
| `Street Density` | Density of secondary streets inside districts |
| `Building Density` | Fraction of valid parcels that should be filled with buildings |
| `Characters` | Number of walkers spawned onto the street graph |

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

Keyboard shortcuts mirror the buttons:

| Key | Action |
|---|---|
| `0` | Pause (`■`) |
| `1` | Set `1×` speed |
| `2` | Set `2×` speed |
| `3` | Set `4×` speed |
| `4` | Set `10×` speed |

Below the canvas, the app also shows a dedicated player-character panel:

| Element | Description |
|---|---|
| `Character N` cards | One card per player-controlled character |
| Status line | Shows `idle`, `moving`, `target: node N`, or `following: character N` |
| Card click | Opens the same action menu as clicking that player character on the map |

The top-left district is reserved as the player district. It is outlined in dark red as a topmost overlay so the border stays visible, and the initial player-controlled walkers spawn on street nodes inside that district after every regeneration.

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

### Characters (`entities/character.js`)

| Variable | Description |
|---|---|
| `CHARACTER_COLORS` | Repeating palette used for spawned walkers |
| `TRAIL_LENGTH` | Maximum number of stored trail points per character |
| `speed: rng.float(3, 20)` | Default movement speed range in pixels per second |

To change how fast characters move, edit the `speed` assignment inside `createCharacter(...)` in `entities/character.js`.
Examples:

```js
speed: rng.float(1, 8), // slower range
speed: rng.float(20, 45), // faster range
speed: 70, // same speed for every character
```

## Character Interaction

Current MVP interaction on the canvas:

1. Click a player character to select it.
2. Use the popup menu to choose `Choose destination`.
3. Click a street once to preview a node destination, then click the same street target again to confirm it.
4. Or click another character once to preview follow / chase, then click that same character again to confirm it.
5. Press `Esc` or click the selected player character again to clear the selection.

The interaction layer maps a street click to the nearest reachable street-graph node, keeps it as a preview target, and only commits the reroute on the second matching click. After a destination is confirmed, the selected player character returns to the popup-menu state so another action can be chosen immediately. NPCs remain visible and can still be used as follow targets, but they do not open the action menu.

## How City Generation Works

1. `generator/districts.js` builds the major district grid, assigns district colors, and marks the top-left district as player-owned.
2. `generator/streets.js` adds full-span secondary streets and dead ends inside each district.
3. `generator/graph.js` converts street crossings and endpoints into an intersection graph.
4. `generator/buildings.js` derives buildable parcels from the street layout, accounts for dead ends and street clearance, and fills a density-dependent share of those parcels with compound buildings.
5. `pathfinding/bfs.js` finds shortest routes across the intersection graph.
6. `entities/character.js` advances characters segment-by-segment, keeps a short visual trail, and uses the player / NPC split established in `main.js`.
7. `ui/controls.js` manages slider state and only applies it when `Regenerate` is clicked.
8. `ui/timeControls.js` manages simulation speed buttons, keyboard shortcuts, and the active time-scale state.
9. `ui/interaction.js` handles canvas hit testing, player-character selection, and street-click rerouting.
10. `ui/playerPanel.js` keeps the player-character status cards in sync with the current selection and movement state.
11. `renderer/canvas.js` draws districts, streets, buildings, moving characters, interaction overlays, the player-district border, and debug intersections.
12. `main.js` regenerates the city, spawns player characters inside the player-owned district, and exposes debug state through `render_game_to_text()`.

## Architecture

```
generator/     — Procedural city generation (districts, streets, buildings, graph)
pathfinding/   — BFS route finding on the street graph
entities/      — Character spawning and movement updates
renderer/      — Stateless Canvas renderer
ui/            — Control panel, time controls, and canvas interaction flow
scripts/       — Local development helpers (including Playwright screenshot checks)
main.js        — Game loop and high-level parameters
```

See `docs/superpowers/specs/` for the full design spec and `docs/superpowers/plans/` for the implementation plan.
