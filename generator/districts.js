const MAJOR_STREET_WIDTH = 8;

const DISTRICT_COLORS = [
  '#355c7d',
  '#6c5b7b',
  '#c06c84',
  '#f67280',
  '#99b898',
  '#52796f',
  '#d4a373',
  '#7f5539',
  '#457b9d',
  '#8d99ae',
  '#588157',
  '#bc6c25',
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createDividerPositions(total, segments, rng) {
  const positions = [0];

  if (segments <= 1) {
    positions.push(total);
    return positions;
  }

  const spacing = total / segments;
  const jitterRange = spacing * 0.2;

  for (let index = 1; index < segments; index += 1) {
    const ideal = spacing * index;
    const jitter = rng.float(-jitterRange, jitterRange);
    const min = positions[index - 1] + MAJOR_STREET_WIDTH * 2;
    const max = total - (segments - index) * MAJOR_STREET_WIDTH * 2;
    positions.push(clamp(ideal + jitter, min, max));
  }

  positions.push(total);
  return positions;
}

function createMajorStreetSegments(horizontalPositions, verticalPositions, width, height) {
  const streets = [];

  for (let row = 1; row < horizontalPositions.length - 1; row += 1) {
    streets.push({
      type: 'h',
      pos: horizontalPositions[row],
      start: 0,
      end: width,
      width: MAJOR_STREET_WIDTH,
      districtId: null,
      isDeadEnd: false,
      terminal: null,
    });
  }

  for (let col = 1; col < verticalPositions.length - 1; col += 1) {
    streets.push({
      type: 'v',
      pos: verticalPositions[col],
      start: 0,
      end: height,
      width: MAJOR_STREET_WIDTH,
      districtId: null,
      isDeadEnd: false,
      terminal: null,
    });
  }

  return streets;
}

export function generateDistricts({ width, height, districtCount, rng }) {
  const rows = Math.ceil(Math.sqrt(districtCount));
  const cols = Math.ceil(districtCount / rows);

  const horizontalPositions = createDividerPositions(height, rows, rng);
  const verticalPositions = createDividerPositions(width, cols, rng);

  const districts = [];
  let id = 0;

  for (let row = 0; row < rows; row += 1) {
    const top = horizontalPositions[row];
    const bottom = horizontalPositions[row + 1];

    for (let col = 0; col < cols; col += 1) {
      const left = verticalPositions[col];
      const right = verticalPositions[col + 1];

      districts.push({
        id,
        color: DISTRICT_COLORS[id % DISTRICT_COLORS.length],
        bounds: {
          x: left,
          y: top,
          w: right - left,
          h: bottom - top,
        },
      });

      id += 1;
    }
  }

  return {
    districts,
    streets: createMajorStreetSegments(horizontalPositions, verticalPositions, width, height),
    meta: {
      rows,
      cols,
      majorStreetWidth: MAJOR_STREET_WIDTH,
      horizontalPositions,
      verticalPositions,
    },
  };
}
