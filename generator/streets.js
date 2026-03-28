const SECONDARY_STREET_WIDTH = 5;
const DEAD_END_RATIO = 0.3;
const MIN_STREET_GAP = 42;
const MIN_DEAD_END_LENGTH = 40;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createInternalPositions(start, end, count, rng) {
  if (count <= 0) {
    return [];
  }

  const span = end - start;
  const spacing = span / (count + 1);
  const jitterRange = spacing * 0.2;
  const positions = [];

  for (let index = 1; index <= count; index += 1) {
    const ideal = start + spacing * index;
    const min = positions[index - 2] ?? start + MIN_STREET_GAP;
    const max = end - MIN_STREET_GAP * (count - index + 1);
    const jittered = ideal + rng.float(-jitterRange, jitterRange);
    positions.push(clamp(jittered, min, Math.max(min, max)));
  }

  return positions;
}

function getStreetCount(span, density, rng) {
  const maxBySize = Math.max(0, Math.floor(span / MIN_STREET_GAP) - 1);
  if (maxBySize === 0) {
    return 0;
  }

  const desired = Math.max(1, density);
  const low = Math.max(1, desired - 1);
  const high = desired + 1;
  return clamp(rng.int(low, high), 1, maxBySize);
}

function pickDeadEndOrientation(rng) {
  return rng.chance(0.5) ? 'h' : 'v';
}

function pickUnusedPosition(start, end, usedPositions, rng) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = rng.float(start + MIN_STREET_GAP, end - MIN_STREET_GAP);
    const isFarEnough = usedPositions.every((used) => Math.abs(used - candidate) >= MIN_STREET_GAP * 0.7);
    if (isFarEnough) {
      return candidate;
    }
  }

  return null;
}

function buildHorizontalDeadEnd(district, pos, verticalConnectors, rng) {
  const xMin = district.bounds.x;
  const xMax = district.bounds.x + district.bounds.w;
  const anchor = verticalConnectors[rng.int(0, verticalConnectors.length - 1)];

  const canGoLeft = anchor - xMin >= MIN_DEAD_END_LENGTH;
  const canGoRight = xMax - anchor >= MIN_DEAD_END_LENGTH;

  if (!canGoLeft && !canGoRight) {
    return null;
  }

  const goesRight = canGoRight && (!canGoLeft || rng.chance(0.5));
  const maxLength = goesRight ? xMax - anchor : anchor - xMin;
  const length = rng.float(MIN_DEAD_END_LENGTH, Math.max(MIN_DEAD_END_LENGTH, maxLength * 0.85));
  const terminalX = goesRight ? anchor + length : anchor - length;

  return {
    type: 'h',
    pos,
    start: Math.min(anchor, terminalX),
    end: Math.max(anchor, terminalX),
    width: SECONDARY_STREET_WIDTH,
    districtId: district.id,
    isDeadEnd: true,
    terminal: goesRight ? 'end' : 'start',
  };
}

function buildVerticalDeadEnd(district, pos, horizontalConnectors, rng) {
  const yMin = district.bounds.y;
  const yMax = district.bounds.y + district.bounds.h;
  const anchor = horizontalConnectors[rng.int(0, horizontalConnectors.length - 1)];

  const canGoUp = anchor - yMin >= MIN_DEAD_END_LENGTH;
  const canGoDown = yMax - anchor >= MIN_DEAD_END_LENGTH;

  if (!canGoUp && !canGoDown) {
    return null;
  }

  const goesDown = canGoDown && (!canGoUp || rng.chance(0.5));
  const maxLength = goesDown ? yMax - anchor : anchor - yMin;
  const length = rng.float(MIN_DEAD_END_LENGTH, Math.max(MIN_DEAD_END_LENGTH, maxLength * 0.85));
  const terminalY = goesDown ? anchor + length : anchor - length;

  return {
    type: 'v',
    pos,
    start: Math.min(anchor, terminalY),
    end: Math.max(anchor, terminalY),
    width: SECONDARY_STREET_WIDTH,
    districtId: district.id,
    isDeadEnd: true,
    terminal: goesDown ? 'end' : 'start',
  };
}

function createDistrictSecondaryStreets(district, density, rng) {
  const xMin = district.bounds.x;
  const xMax = district.bounds.x + district.bounds.w;
  const yMin = district.bounds.y;
  const yMax = district.bounds.y + district.bounds.h;

  const fullHorizontalCount = getStreetCount(district.bounds.h, density, rng);
  const fullVerticalCount = getStreetCount(district.bounds.w, density, rng);

  const horizontalPositions = createInternalPositions(yMin, yMax, fullHorizontalCount, rng);
  const verticalPositions = createInternalPositions(xMin, xMax, fullVerticalCount, rng);

  const streets = [];

  for (const pos of horizontalPositions) {
    streets.push({
      type: 'h',
      pos,
      start: xMin,
      end: xMax,
      width: SECONDARY_STREET_WIDTH,
      districtId: district.id,
      isDeadEnd: false,
      terminal: null,
    });
  }

  for (const pos of verticalPositions) {
    streets.push({
      type: 'v',
      pos,
      start: yMin,
      end: yMax,
      width: SECONDARY_STREET_WIDTH,
      districtId: district.id,
      isDeadEnd: false,
      terminal: null,
    });
  }

  const desiredDeadEnds = Math.round((horizontalPositions.length + verticalPositions.length) * DEAD_END_RATIO);
  const usedHorizontal = [...horizontalPositions];
  const usedVertical = [...verticalPositions];
  const verticalConnectors = [xMin, xMax, ...verticalPositions];
  const horizontalConnectors = [yMin, yMax, ...horizontalPositions];

  for (let index = 0; index < desiredDeadEnds; index += 1) {
    const orientation = pickDeadEndOrientation(rng);

    if (orientation === 'h') {
      const pos = pickUnusedPosition(yMin, yMax, usedHorizontal, rng);
      if (pos === null) {
        continue;
      }

      const deadEnd = buildHorizontalDeadEnd(district, pos, verticalConnectors, rng);
      if (deadEnd) {
        streets.push(deadEnd);
        usedHorizontal.push(pos);
      }
      continue;
    }

    const pos = pickUnusedPosition(xMin, xMax, usedVertical, rng);
    if (pos === null) {
      continue;
    }

    const deadEnd = buildVerticalDeadEnd(district, pos, horizontalConnectors, rng);
    if (deadEnd) {
      streets.push(deadEnd);
      usedVertical.push(pos);
    }
  }

  return streets;
}

export function generateSecondaryStreets({ districts, streetDensity, rng }) {
  return districts.flatMap((district) => createDistrictSecondaryStreets(district, streetDensity, rng));
}
