import { generateBuildings } from './buildings.js';
import { generateDistricts } from './districts.js';
import { buildIntersectionGraph } from './graph.js';
import { createRNG } from './rng.js';
import { generateSecondaryStreets } from './streets.js';

function toRenderStreet(street) {
  if (street.type === 'h') {
    return {
      x1: street.start,
      y1: street.pos - street.width / 2,
      x2: street.end,
      y2: street.pos + street.width / 2,
      width: street.width,
      districtId: street.districtId,
      isDeadEnd: street.isDeadEnd,
    };
  }

  return {
    x1: street.pos - street.width / 2,
    y1: street.start,
    x2: street.pos + street.width / 2,
    y2: street.end,
    width: street.width,
    districtId: street.districtId,
    isDeadEnd: street.isDeadEnd,
  };
}

export function generateCity(params) {
  const rng = createRNG(params.seed);
  const districtData = generateDistricts({
    width: params.width,
    height: params.height,
    districtCount: params.districts,
    rng,
  });
  const secondaryStreets = generateSecondaryStreets({
    districts: districtData.districts,
    streetDensity: params.streetDensity,
    rng,
  });
  const internalStreets = [...districtData.streets, ...secondaryStreets];
  const intersections = buildIntersectionGraph(internalStreets);
  const buildings = generateBuildings({
    districts: districtData.districts,
    streets: internalStreets,
    buildingDensity: params.buildingDensity,
    width: params.width,
    height: params.height,
    majorStreetWidth: districtData.meta.majorStreetWidth,
    rng,
  });

  return {
    width: params.width,
    height: params.height,
    districts: districtData.districts,
    streets: internalStreets.map(toRenderStreet),
    buildings,
    intersections,
    meta: {
      ...districtData.meta,
      streetDensity: params.streetDensity,
      buildingDensity: params.buildingDensity,
      totalStreetCount: internalStreets.length,
      secondaryStreetCount: secondaryStreets.length,
      buildingCount: buildings.length,
    },
  };
}
