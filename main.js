import { createCharacter, setCharacterDestination, updateCharacter } from './entities/character.js';
import { TRAIT_DEFINITIONS, getTraitDefinitionById, VampireTrait } from './entities/traits/index.js';
import { generateCity } from './generator/city.js';
import { createRNG } from './generator/rng.js';
import { renderCity } from './renderer/canvas.js';
import { createControls } from './ui/controls.js';
import { createClock, GAME_CLOCK_RATIO } from './simulation/clock.js';
import { updateBlood, applyHuntBloodGain } from './simulation/blood.js';
import { startHunt, updateHunts, cancelHunt } from './simulation/hunt.js';
import { createDayDisplay } from './ui/dayDisplay.js';
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
  startDayOfYear: 1,
  notifications: [],
};

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

const playerPanel = createPlayerPanel({
  mount: playerPanelMount,
  getCharacters: () => state.characters,
  availableTraits: TRAIT_DEFINITIONS.map(({ id, label }) => ({ id, label })),
  onSelectCharacter(characterId) {
    if (interaction.openMenuForCharacter(characterId)) {
      canvas.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      render();
    }
  },
  onAddTrait(characterId, traitId) {
    const character = state.characters.find((candidate) => candidate.id === characterId);
    const definition = getTraitDefinitionById(traitId);

    if (!character || !definition) {
      return;
    }

    if ((character.traits ?? []).some((trait) => trait?.id === traitId || trait === traitId)) {
      return;
    }

    character.traits.push(definition.trait);
    render();
  },
  onRemoveTrait(characterId, traitId) {
    const character = state.characters.find((candidate) => candidate.id === characterId);
    if (!character) {
      return;
    }

    const nextTraits = (character.traits ?? []).filter(
      (trait) => trait?.id !== traitId && trait !== traitId,
    );

    if (nextTraits.length === character.traits.length) {
      return;
    }

    character.traits = nextTraits;
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

let clock = createClock(1);
const dayDisplay = createDayDisplay({ mount: timeControlsPanel });

createTimeControls({
  mount: timeControlsPanel,
  onSpeedChange(scale) {
    timeScale = scale;
  },
});

panelToggle.addEventListener('click', () => {
  const isCollapsed = controlsEl.classList.toggle('collapsed');
  panelToggle.textContent = isCollapsed ? '▼' : '▲';
  panelToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  panelToggle.blur();
});

function createCharacters(city, seed, count) {
  if (!city || city.intersections.length === 0) {
    return [];
  }

  const rng = createRNG(seed ^ 0x9e3779b9);
  const characterCount = Math.min(count, city.intersections.length);
  const characters = [];
  const playerDistrict = city.districts.find((district) => district.isPlayerOwned);
  const playerNodes = playerDistrict
    ? city.intersections.filter(
        (node) =>
          node.x >= playerDistrict.bounds.x &&
          node.x <= playerDistrict.bounds.x + playerDistrict.bounds.w &&
          node.y >= playerDistrict.bounds.y &&
          node.y <= playerDistrict.bounds.y + playerDistrict.bounds.h,
      )
    : [];

  for (let index = 0; index < characterCount; index += 1) {
    const character = createCharacter(city.intersections, rng, index);
    character.isPlayer = index < PLAYER_COUNT;
    if (character.isPlayer) {
      character.capabilities = ['hunt'];
      character.traits.push(VampireTrait);
    }

    if (character.isPlayer && playerNodes.length > 0) {
      const startNode = playerNodes[rng.int(0, playerNodes.length - 1)];
      character.pos = { x: startNode.x, y: startNode.y };
      character.from = startNode.id;
      character.to = startNode.id;
      character.path = [];
      character.progress = 0;
    }

    characters.push(character);
  }

  return characters;
}

function updateCharacters(dtSeconds) {
  if (!state.city || state.characters.length === 0) {
    return;
  }

  const ctx = {
    mapWidth: state.city.width,
    mapHeight: state.city.height,
  };

  for (const character of state.characters) {
    updateCharacter(character, dtSeconds, state.city.intersections, state.characters, ctx);
  }
}

function render() {
  const interactionState = interaction.getState();
  renderCity(ctx, state.city, state.characters, interactionState, state.notifications);
  playerPanel.update(interactionState, state.notifications);
  dayDisplay.update(clock.getState(state.timeMs));
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
    updateHunts(state.characters, currentStep, onHuntComplete);
    updateBlood(
      state.characters,
      currentStep * GAME_CLOCK_RATIO,
      state.city?.districts.filter((district) => district.isPlayerOwned),
    );
    remaining -= currentStep;
  }

  render();
}

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
  seedReadout.textContent =
    `seed ${params.seed} · districts ${state.city.districts.length} · streets ${state.city.meta.totalStreetCount} · buildings ${state.city.meta.buildingCount} · nodes ${state.city.intersections.length} · chars ${state.characters.length}`;
  controls.setAppliedValues(params);
  render();
}

function tick(now) {
  const elapsed = Math.max(0, Math.min(100, now - state.lastTickMs));
  state.lastTickMs = now;
  state.notifications = state.notifications.filter(
    (notification) => performance.now() - notification.createdAt < 2500,
  );
  stepSimulation(elapsed * timeScale);
  window.requestAnimationFrame(tick);
}

window.render_game_to_text = () => {
  const clockState = clock.getState(state.timeMs);

  return JSON.stringify({
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
    startDayOfYear: state.startDayOfYear,
    notifications: state.notifications.map((notification) => ({
      type: notification.type,
      characterId: notification.characterId,
    })),
    clock: {
      hour: clockState.hour,
      minute: clockState.minute,
      dayNumber: clockState.dayNumber,
      phase: clockState.phase,
      date: clockState.date,
    },
    interaction: interaction.getState(),
    districts: (state.city?.districts ?? []).map((district) => ({
      id: district.id,
      color: district.color,
      isPlayerOwned: district.isPlayerOwned,
      bounds: district.bounds,
    })),
    buildingsSample: (state.city?.buildings ?? []).slice(0, 6),
    intersectionsSample: (state.city?.intersections ?? []).slice(0, 12),
    characters: state.characters.map((character) => ({
      id: character.id,
      isPlayer: character.isPlayer,
      capabilities: [...(character.capabilities ?? [])],
      traits: (character.traits ?? []).map((trait) => trait.id),
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
  });
};

window.advanceTime = (ms) => {
  stepSimulation(ms);
  state.lastTickMs = performance.now();
};

regenerate();
window.requestAnimationFrame(tick);
