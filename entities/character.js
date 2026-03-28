import { bfs } from '../pathfinding/bfs.js';

export const TRAIL_LENGTH = 10;
export const CHARACTER_COLORS = [
  '#ff6b6b',
  '#6bffb8',
  '#ffd06b',
  '#6bb8ff',
  '#ff6bff',
  '#b8ff6b',
];

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

function createLocalRNG(seed) {
  let state = seed >>> 0;

  function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  return {
    random,
    int(min, max) {
      return Math.floor(random() * (max - min + 1)) + min;
    },
    float(min, max) {
      return random() * (max - min) + min;
    },
    chance(probability) {
      return random() < probability;
    },
  };
}

function getNode(intersections, nodeId, nodeIndexById = buildNodeIndex(intersections)) {
  const index = nodeIndexById.get(nodeId);
  return index === undefined ? null : intersections[index] ?? null;
}

function distanceBetweenNodes(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clampTrail(char) {
  while (char.trail.length > TRAIL_LENGTH) {
    char.trail.shift();
  }
}

function snapshotPosition(char) {
  return { x: char.pos.x, y: char.pos.y };
}

function pushTrail(char) {
  char.trail.push(snapshotPosition(char));
  clampTrail(char);
}

function shuffle(values, rng) {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function assignPath(char, intersections, path) {
  if (!path || path.length <= 1) {
    char.path = [];
    char.to = char.from;
    char.progress = 0;
    return false;
  }

  char.path = path.slice(1);
  char.from = path[0];
  char.to = char.path[0];
  char.progress = 0;

  const nodeIndexById = buildNodeIndex(intersections);
  const fromNode = getNode(intersections, char.from, nodeIndexById);
  if (fromNode) {
    char.pos.x = fromNode.x;
    char.pos.y = fromNode.y;
  }

  return true;
}

function pickRandomReachableTarget(char, intersections, rng) {
  if (intersections.length <= 1) {
    return null;
  }

  const candidateIds = intersections
    .map((node) => node?.id)
    .filter((nodeId) => typeof nodeId === 'number' && nodeId !== char.from);

  if (candidateIds.length === 0) {
    return null;
  }

  for (const targetId of shuffle(candidateIds, rng)) {
    const path = bfs(intersections, char.from, targetId);
    if (path && path.length > 1) {
      return path;
    }
  }

  return null;
}

function acquirePathFromDestination(char, intersections, characters = []) {
  if (char.destination?.type === 'node') {
    const path = bfs(intersections, char.from, char.destination.nodeId);
    char.destination = null;
    if (path && path.length > 1) {
      assignPath(char, intersections, path);
      return true;
    }
    return false;
  }

  if (char.destination?.type === 'character' && char.path.length === 0) {
    const target = characters.find((candidate) => candidate.id === char.destination.characterId);
    if (!target) {
      char.destination = null;
      return false;
    }

    const path = bfs(intersections, char.from, target.to);
    if (path && path.length > 1) {
      assignPath(char, intersections, path);
      return true;
    }

    char.destination = null;
  }

  return false;
}

function stepAlongPath(char, dt, intersections, characters) {
  const nodeIndexById = buildNodeIndex(intersections);
  let remainingDistance = Math.max(0, dt) * char.speed;

  while (remainingDistance > 0 && char.path.length > 0) {
    const fromNode = getNode(intersections, char.from, nodeIndexById);
    const toNode = getNode(intersections, char.to, nodeIndexById);

    if (!fromNode || !toNode) {
      char.path = [];
      break;
    }

    const segmentLength = distanceBetweenNodes(fromNode, toNode);

    if (segmentLength <= 0.0001) {
      char.from = char.to;
      char.path.shift();
      if (char.path.length > 0) {
        char.to = char.path[0];
      }
      continue;
    }

    const distanceToNextNode = (1 - char.progress) * segmentLength;

    if (remainingDistance < distanceToNextNode) {
      char.progress += remainingDistance / segmentLength;
      char.pos.x = fromNode.x + (toNode.x - fromNode.x) * char.progress;
      char.pos.y = fromNode.y + (toNode.y - fromNode.y) * char.progress;
      remainingDistance = 0;
      break;
    }

    remainingDistance -= distanceToNextNode;
    char.from = char.to;
    char.pos.x = toNode.x;
    char.pos.y = toNode.y;
    char.progress = 0;
    char.path.shift();

    if (char.path.length > 0) {
      char.to = char.path[0];
    }

    if (char.destination?.type === 'character') {
      const target = characters.find((candidate) => candidate.id === char.destination.characterId);
      if (!target) {
        char.destination = null;
        break;
      }

      if (char.from === target.to || char.from === target.from) {
        char.destination = null;
        char.path = [];
        break;
      }

      const chasePath = bfs(intersections, char.from, target.to);
      if (chasePath && chasePath.length > 1) {
        assignPath(char, intersections, chasePath);
      } else {
        char.destination = null;
        char.path = [];
      }
    }
  }
}

export function createCharacter(intersections, rng, colorIndex) {
  if (!Array.isArray(intersections) || intersections.length === 0) {
    throw new Error('Cannot create character: no intersections');
  }

  const startNode = intersections[rng.int(0, intersections.length - 1)];
  if (!startNode) {
    throw new Error('Cannot create character: invalid start node');
  }

  const color = CHARACTER_COLORS[colorIndex % CHARACTER_COLORS.length];
  const char = {
    id: colorIndex,
    pos: { x: startNode.x, y: startNode.y },
    from: startNode.id,
    to: startNode.id,
    path: [],
    progress: 0,
    speed: rng.float(3, 20),
    color,
    trail: [],
    destination: null,
    isPlayer: false,
    rng: createLocalRNG(rng.int(1, 0x7fffffff)),
  };

  const path = pickRandomReachableTarget(char, intersections, rng);
  if (path) {
    assignPath(char, intersections, path);
  }

  return char;
}

export function setCharacterDestination(char, destination) {
  char.destination = destination ?? null;

  if (destination?.type === 'character') {
    char.path = [];
    char.to = char.from;
    char.progress = 0;
  }
}

export function updateCharacter(char, dt, intersections, characters = []) {
  if (acquirePathFromDestination(char, intersections, characters)) {
    pushTrail(char);
    return;
  }

  if (char.path.length === 0) {
    const path = pickRandomReachableTarget(char, intersections, char.rng);

    if (path) {
      assignPath(char, intersections, path);
    } else {
      pushTrail(char);
      return;
    }
  }

  stepAlongPath(char, dt, intersections, characters);

  if (char.path.length === 0 && char.destination == null) {
    const path = pickRandomReachableTarget(char, intersections, char.rng);

    if (path) {
      assignPath(char, intersections, path);
    }
  }

  pushTrail(char);
}
