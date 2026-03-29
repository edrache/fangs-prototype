function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function findNodeById(intersections, nodeId) {
  return intersections.find((node) => node?.id === nodeId) ?? null;
}

function findCharacterById(characters, characterId) {
  return characters.find((character) => character?.id === characterId) ?? null;
}

function resolveTargetPoint(char, ctx = {}) {
  if (char?.hunt?.phase === 'moving') {
    const huntTarget = findCharacterById(ctx.characters ?? [], char.hunt.targetId);
    if (huntTarget?.pos) {
      return {
        x: huntTarget.pos.x,
        y: huntTarget.pos.y,
        persistent: true,
      };
    }
  }

  if (char?.destination?.type === 'character') {
    const targetCharacter = findCharacterById(ctx.characters ?? [], char.destination.characterId);
    if (targetCharacter?.pos) {
      return {
        x: targetCharacter.pos.x,
        y: targetCharacter.pos.y,
        persistent: true,
      };
    }
  }

  if (char?.destination?.type === 'node') {
    const targetNode = findNodeById(ctx.intersections ?? [], char.destination.nodeId);
    if (targetNode) {
      return {
        x: targetNode.x,
        y: targetNode.y,
        persistent: false,
      };
    }
  }

  return null;
}

function pickFlyTarget(char, mapWidth, mapHeight) {
  return {
    x: clamp(char.rng.float(0, mapWidth), 0, mapWidth),
    y: clamp(char.rng.float(0, mapHeight), 0, mapHeight),
  };
}

export const FlyingTrait = {
  id: 'flying',

  update(char, dt, ctx = {}) {
    const mapWidth = typeof ctx.mapWidth === 'number' ? ctx.mapWidth : 900;
    const mapHeight = typeof ctx.mapHeight === 'number' ? ctx.mapHeight : 700;
    const guidedTarget = resolveTargetPoint(char, ctx);

    if (guidedTarget) {
      char.flyTarget = {
        x: guidedTarget.x,
        y: guidedTarget.y,
      };
    } else if (!char.flyTarget) {
      char.flyTarget = pickFlyTarget(char, mapWidth, mapHeight);
    }

    const target = char.flyTarget;
    const dx = target.x - char.pos.x;
    const dy = target.y - char.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      char.pos.x = target.x;
      char.pos.y = target.y;
      char.flyTarget = null;
      if (char.destination?.type === 'node' && !guidedTarget?.persistent) {
        char.destination = null;
      }
      return true;
    }

    const step = Math.max(0, dt) * char.speed;

    if (step >= distance) {
      char.pos.x = target.x;
      char.pos.y = target.y;
      char.flyTarget = null;
      if (char.destination?.type === 'node' && !guidedTarget?.persistent) {
        char.destination = null;
      }
      return true;
    }

    const ratio = step / distance;
    char.pos.x += dx * ratio;
    char.pos.y += dy * ratio;
    char.pos.x = clamp(char.pos.x, 0, mapWidth);
    char.pos.y = clamp(char.pos.y, 0, mapHeight);

    return true;
  },
};
