import { generateCity } from './generator/city.js';
import { renderCity } from './renderer/canvas.js';
import { createControls } from './ui/controls.js';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;

const canvas = document.getElementById('city-canvas');
const ctx = canvas.getContext('2d');
const seedReadout = document.getElementById('seed-readout');
const controlPanel = document.getElementById('control-panel');
const regenerateButton = document.getElementById('regenerate-btn');

const params = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  seed: 1245,
  districts: 9,
  streetDensity: 4,
  buildingDensity: 10
};

const state = {
  city: null,
  frame: 0,
  timeMs: 0,
};

const controls = createControls({
  mount: controlPanel,
  button: regenerateButton,
  initialValues: params,
  onApply(nextValues) {
    Object.assign(params, nextValues);
    regenerate();
  },
});

function regenerate() {
  state.city = generateCity(params);
  seedReadout.textContent =
    `seed ${params.seed} · districts ${state.city.districts.length} · streets ${state.city.meta.totalStreetCount} · buildings ${state.city.meta.buildingCount} · nodes ${state.city.intersections.length}`;
  controls.setAppliedValues(params);
  render();
}

function render() {
  renderCity(ctx, state.city);
}

function tick() {
  state.frame += 1;
  render();
  window.requestAnimationFrame(tick);
}

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'origin at top-left, +x right, +y down',
  seed: params.seed,
  requestedDistricts: params.districts,
  streetDensity: params.streetDensity,
  buildingDensity: params.buildingDensity,
  generatedDistricts: state.city?.districts.length ?? 0,
  totalStreetCount: state.city?.streets.length ?? 0,
  buildingCount: state.city?.buildings.length ?? 0,
  intersectionCount: state.city?.intersections.length ?? 0,
  timeMs: state.timeMs,
  frame: state.frame,
  districts: (state.city?.districts ?? []).map((district) => ({
    id: district.id,
    color: district.color,
    bounds: district.bounds,
  })),
  buildingsSample: (state.city?.buildings ?? []).slice(0, 6),
  intersectionsSample: (state.city?.intersections ?? []).slice(0, 12),
});

window.advanceTime = (ms) => {
  state.timeMs += ms;
  state.frame += Math.max(1, Math.round(ms / (1000 / 60)));
  render();
};

regenerate();
window.requestAnimationFrame(tick);
