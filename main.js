import { createCharacter, setCharacterDestination, updateCharacter } from './entities/character.js';
import { generateCity } from './generator/city.js';
import { createRNG } from './generator/rng.js';
import { renderCity } from './renderer/canvas.js';
import { createControls } from './ui/controls.js';
import { createInteractionController } from './ui/interaction.js';
import { createPlayerPanel } from './ui/playerPanel.js';
import { createTimeControls } from './ui/timeControls.js';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;
const PLAYER_COUNT = 3;

const canvas = document.getElementById('city-canvas');
const ctx = canvas.getContext('2d');
const seedReadout = document.getElementById('seed-readout');
const controlPanel = document.getElementById('control-panel');
const regenerateButton = document.getElementById('regenerate-btn');
const playerPanelMount = document.getElementById('player-panel');
const timeControlsPanel = document.getElementById('time-controls');
const panelToggle = document.getElementById('panel-toggle');
const controlsEl = document.getElementById('controls');
let timeScale = 1;

const params = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  seed: 1245,
  districts: 9,
  streetDensity: 4,
  buildingDensity: 10,
  characters: 10,
};

const state = {
  city: null,
  characters: [],
  frame: 0,
  timeMs: 0,
  lastTickMs: performance.now(),
};

const interaction = createInteractionController({
  canvas,
  getCity: () => state.city,
  getCharacters: () => state.characters,
  onAssignDestination(character, destination) {
    setCharacterDestination(character, destination);
    render();
  },
  onChange() {
    render();
  },
});

const playerPanel = createPlayerPanel({
  mount: playerPanelMount,
  getCharacters: () => state.characters,
  onSelectCharacter(characterId) {
    interaction.openMenuForCharacter(characterId);
    render();
  },
});

const controls = createControls({
  mount: controlPanel,
  button: regenerateButton,
  initialValues: params,
  onApply(nextValues) {
    Object.assign(params, nextValues);
    regenerate();
  },
});

createTimeControls({
  mount: timeControlsPanel,
  onSpeedChange(scale) {
    timeScale = scale;
  },
});

panelToggle.addEventListener('click', () => {
  const isCollapsed = controlsEl.classList.toggle('collapsed');
  panelToggle.textContent = isCollapsed ? '▼' : '▲';
  panelToggle.blur();
});

function createCharacters(city, seed, count) {
  if (!city || city.intersections.length === 0) {
    return [];
  }

  const rng = createRNG(seed ^ 0x9e3779b9);
  const characterCount = Math.min(count, city.intersections.length);
  const characters = [];

  for (let index = 0; index < characterCount; index += 1) {
    const character = createCharacter(city.intersections, rng, index);
    character.isPlayer = index < PLAYER_COUNT;
    characters.push(character);
  }

  return characters;
}

function updateCharacters(dtSeconds) {
  if (!state.city || state.characters.length === 0) {
    return;
  }

  for (const character of state.characters) {
    updateCharacter(character, dtSeconds, state.city.intersections, state.characters);
  }
}

function render() {
  const interactionState = interaction.getState();
  renderCity(ctx, state.city, state.characters, interactionState);
  playerPanel.update(interactionState);
}

function stepSimulation(deltaMs) {
  const safeDeltaMs = Math.max(0, deltaMs);
  const stepMs = 1000 / 60;
  let remaining = safeDeltaMs;

  state.timeMs += safeDeltaMs;
  state.frame += Math.max(1, Math.round(safeDeltaMs / stepMs));

  while (remaining > 0) {
    const currentStep = Math.min(stepMs, remaining);
    updateCharacters(currentStep / 1000);
    remaining -= currentStep;
  }

  render();
}

function regenerate() {
  state.city = generateCity(params);
  state.characters = createCharacters(state.city, params.seed, params.characters);
  state.frame = 0;
  state.timeMs = 0;
  state.lastTickMs = performance.now();
  interaction.reset();
  seedReadout.textContent =
    `seed ${params.seed} · districts ${state.city.districts.length} · streets ${state.city.meta.totalStreetCount} · buildings ${state.city.meta.buildingCount} · nodes ${state.city.intersections.length} · chars ${state.characters.length}`;
  controls.setAppliedValues(params);
  render();
}

function tick(now) {
  const elapsed = Math.max(0, Math.min(100, now - state.lastTickMs));
  state.lastTickMs = now;
  stepSimulation(elapsed * timeScale);
  window.requestAnimationFrame(tick);
}

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'origin at top-left, +x right, +y down',
  seed: params.seed,
  requestedDistricts: params.districts,
  streetDensity: params.streetDensity,
  buildingDensity: params.buildingDensity,
  requestedCharacterCount: params.characters,
  generatedDistricts: state.city?.districts.length ?? 0,
  totalStreetCount: state.city?.streets.length ?? 0,
  buildingCount: state.city?.buildings.length ?? 0,
  intersectionCount: state.city?.intersections.length ?? 0,
  characterCount: state.characters.length,
  timeMs: state.timeMs,
  frame: state.frame,
  interaction: interaction.getState(),
  districts: (state.city?.districts ?? []).map((district) => ({
    id: district.id,
    color: district.color,
    bounds: district.bounds,
  })),
  buildingsSample: (state.city?.buildings ?? []).slice(0, 6),
  intersectionsSample: (state.city?.intersections ?? []).slice(0, 12),
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
});

window.advanceTime = (ms) => {
  stepSimulation(ms);
  state.lastTickMs = performance.now();
};

regenerate();
window.requestAnimationFrame(tick);
