function createPointKey(x, y) {
  return `${x.toFixed(3)}:${y.toFixed(3)}`;
}

function getStreetEndpoint(street, label) {
  if (street.type === 'h') {
    return label === 'start'
      ? { x: street.start, y: street.pos }
      : { x: street.end, y: street.pos };
  }

  return label === 'start'
    ? { x: street.pos, y: street.start }
    : { x: street.pos, y: street.end };
}

function ensurePoint(x, y, points, pointIdsByKey) {
  const key = createPointKey(x, y);
  const existing = pointIdsByKey.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const id = points.length;
  points.push({ id, x, y, neighbors: [] });
  pointIdsByKey.set(key, id);
  return id;
}

function connectNodes(adjacency, from, to) {
  if (from === to) {
    return;
  }

  adjacency[from].add(to);
  adjacency[to].add(from);
}

export function buildIntersectionGraph(streets) {
  const points = [];
  const pointIdsByKey = new Map();
  const streetPointIds = streets.map(() => new Set());

  streets.forEach((street, streetIndex) => {
    const startId = ensurePoint(
      getStreetEndpoint(street, 'start').x,
      getStreetEndpoint(street, 'start').y,
      points,
      pointIdsByKey,
    );
    const endId = ensurePoint(
      getStreetEndpoint(street, 'end').x,
      getStreetEndpoint(street, 'end').y,
      points,
      pointIdsByKey,
    );

    streetPointIds[streetIndex].add(startId);
    streetPointIds[streetIndex].add(endId);
  });

  for (let index = 0; index < streets.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < streets.length; otherIndex += 1) {
      const street = streets[index];
      const otherStreet = streets[otherIndex];

      if (street.type === otherStreet.type) {
        continue;
      }

      const horizontal = street.type === 'h' ? street : otherStreet;
      const vertical = street.type === 'v' ? street : otherStreet;

      const crosses =
        vertical.pos >= horizontal.start &&
        vertical.pos <= horizontal.end &&
        horizontal.pos >= vertical.start &&
        horizontal.pos <= vertical.end;

      if (!crosses) {
        continue;
      }

      const pointId = ensurePoint(vertical.pos, horizontal.pos, points, pointIdsByKey);
      streetPointIds[index].add(pointId);
      streetPointIds[otherIndex].add(pointId);
    }
  }

  const adjacency = points.map(() => new Set());

  streets.forEach((street, streetIndex) => {
    const sortedPointIds = [...streetPointIds[streetIndex]].sort((left, right) => {
      if (street.type === 'h') {
        return points[left].x - points[right].x;
      }

      return points[left].y - points[right].y;
    });

    for (let index = 1; index < sortedPointIds.length; index += 1) {
      connectNodes(adjacency, sortedPointIds[index - 1], sortedPointIds[index]);
    }
  });

  return points.map((point, pointId) => ({
    id: pointId,
    x: point.x,
    y: point.y,
    neighbors: [...adjacency[pointId]].sort((left, right) => left - right),
  }));
}
