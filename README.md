# Fangs — Prototype

Procedurally generated city map built in plain HTML/JavaScript (no bundler, no framework).

## Stage 1 — City Generator

- Orthogonal street grid divided into color-coded districts
- Compound buildings (L/T/U shapes) filling city blocks
- Dead-end secondary streets
- Intersection graph prepared for BFS pathfinding
- Seed-based deterministic generation

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

Changing sliders does not immediately regenerate the map. Click `Regenerate` to apply the pending values.

### Main runtime parameters (`main.js`)

These are still the default values loaded on page start:

| Variable | Description |
|---|---|
| `CANVAS_WIDTH` | Canvas width in pixels |
| `CANVAS_HEIGHT` | Canvas height in pixels |
| `params.seed` | Deterministic seed. Same seed + same params = same city |
| `params.districts` | Target number of districts used to derive the major grid |
| `params.streetDensity` | Density of secondary streets inside each district |
| `params.buildingDensity` | How many valid parcels receive buildings; low values leave more empty parcels, high values fill more of the city |

Example:

```js
const params = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  seed: 12345,
  districts: 9,
  streetDensity: 3,
  buildingDensity: 10,
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

## How City Generation Works

1. `generator/districts.js` builds the major district grid and assigns district colors.
2. `generator/streets.js` adds full-span secondary streets and dead ends inside each district.
3. `generator/graph.js` converts street crossings and endpoints into an intersection graph.
4. `generator/buildings.js` derives buildable parcels from the street layout, accounts for dead ends and street clearance, and fills a density-dependent share of those parcels with compound buildings.
5. `ui/controls.js` manages slider state and only applies it when `Regenerate` is clicked.
6. `renderer/canvas.js` draws districts, streets, buildings, and debug intersections.

## Architecture

```
generator/     — Procedural city generation (districts, streets, buildings, graph)
renderer/      — Stateless Canvas renderer
ui/            — Control panel and parameter application flow
scripts/       — Local development helpers (including Playwright screenshot checks)
main.js        — Game loop and high-level parameters
```

See `docs/superpowers/specs/` for the full design spec and `docs/superpowers/plans/` for the implementation plan.
