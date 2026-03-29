import { setCharacterDestination } from '../entities/character.js';
import { GAME_HOUR_SIM_MS } from './clock.js';

const HUNT_DURATION_MS = GAME_HOUR_SIM_MS;
const HUNT_CONTACT_DISTANCE = 20;

function clearCharacterMovement(character) {
  if (!character) {
    return;
  }

  character.destination = null;
  character.path = [];
  character.to = character.from;
  character.progress = 0;
  character.flyTarget = null;
}

function findCharacterById(characters, characterId) {
  return characters.find((character) => character.id === characterId) ?? null;
}

function getDistance(a, b) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dy = (a?.y ?? 0) - (b?.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function startHunt(playerChar, npcChar) {
  if (!playerChar || !npcChar || playerChar.id === npcChar.id) {
    return;
  }

  clearCharacterMovement(playerChar);
  playerChar.frozen = false;
  npcChar.frozen = true;
  clearCharacterMovement(npcChar);
  playerChar.hunt = {
    phase: 'moving',
    targetId: npcChar.id,
    elapsed: 0,
    duration: HUNT_DURATION_MS,
  };

  setCharacterDestination(playerChar, {
    type: 'node',
    nodeId: npcChar.to,
  });
}

function isHunterAlignedWithNpcOnSegment(hunter, npc) {
  return (
    hunter.from === npc.from
    && hunter.to === npc.to
    && hunter.progress >= npc.progress
  );
}

export function updateHunts(characters, dt, onHuntComplete) {
  for (const character of characters) {
    if (!character.hunt) {
      continue;
    }

    const npc = findCharacterById(characters, character.hunt.targetId);

    if (!npc) {
      character.frozen = false;
      character.hunt = null;
      clearCharacterMovement(character);
      continue;
    }

    if (character.hunt.phase === 'moving') {
      const reachedTargetNode = character.path.length === 0 && character.from === npc.to;
      const reachedNpcOnSegment = isHunterAlignedWithNpcOnSegment(character, npc);
      const reachedNpcByPosition = getDistance(character.pos, npc.pos) <= HUNT_CONTACT_DISTANCE;

      if (reachedTargetNode || reachedNpcOnSegment || reachedNpcByPosition) {
        character.hunt.phase = 'hunting';
        character.hunt.elapsed = 0;
        character.frozen = true;
        npc.frozen = true;
        clearCharacterMovement(character);
        clearCharacterMovement(npc);
        npc.pos = { x: character.pos.x, y: character.pos.y };
        continue;
      }

      if (character.path.length === 0) {
        setCharacterDestination(character, {
          type: 'node',
          nodeId: npc.to,
        });
      }

      continue;
    }

    character.hunt.elapsed += dt;

    if (character.hunt.elapsed >= character.hunt.duration) {
      character.frozen = false;
      npc.frozen = false;
      const completedNpc = npc;
      character.hunt = null;

      if (typeof onHuntComplete === 'function') {
        onHuntComplete(character, completedNpc);
      }
    }
  }
}

export function cancelHunt(playerChar, characters) {
  if (!playerChar?.hunt) {
    return;
  }

  const npc = findCharacterById(characters, playerChar.hunt.targetId);
  if (npc) {
    npc.frozen = false;
  }

  playerChar.frozen = false;
  playerChar.hunt = null;
  clearCharacterMovement(playerChar);
}
