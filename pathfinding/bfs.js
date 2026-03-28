function buildNodeIndex(intersections) {
  const byId = new Map();

  for (let index = 0; index < intersections.length; index += 1) {
    const node = intersections[index];
    if (node && typeof node.id === 'number') {
      byId.set(node.id, index);
    }
  }

  return byId;
}

function reconstructPath(prevById, startId, targetId) {
  const path = [];
  let current = targetId;

  while (current !== undefined) {
    path.unshift(current);
    current = prevById.get(current);
  }

  return path[0] === startId ? path : null;
}

// Finds the shortest path between two intersection node IDs.
// Returns an array of node IDs, or null if no path exists.
export function bfs(intersections, startId, targetId) {
  if (startId === targetId) {
    return [startId];
  }

  const nodeIndexById = buildNodeIndex(intersections);
  if (!nodeIndexById.has(startId) || !nodeIndexById.has(targetId)) {
    return null;
  }

  const queue = [startId];
  const previousById = new Map([[startId, undefined]]);
  let head = 0;

  while (head < queue.length) {
    const currentId = queue[head];
    head += 1;

    const nodeIndex = nodeIndexById.get(currentId);
    const node = intersections[nodeIndex];
    if (!node) {
      continue;
    }

    for (const neighborId of node.neighbors ?? []) {
      if (previousById.has(neighborId) || !nodeIndexById.has(neighborId)) {
        continue;
      }

      previousById.set(neighborId, currentId);

      if (neighborId === targetId) {
        return reconstructPath(previousById, startId, targetId);
      }

      queue.push(neighborId);
    }
  }

  return null;
}
