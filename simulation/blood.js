const HUNGER_THRESHOLD = 0.2;
const DECAY_PER_HOUR = 0.75 / 24;
const DISTRICT_DECAY_MULTIPLIER = 0.5;
const HUNT_BLOOD_GAIN = 45;

function isInPlayerDistrict(character, playerDistricts) {
  if (!character || !Array.isArray(playerDistricts) || playerDistricts.length === 0) {
    return false;
  }

  const { x, y } = character.pos ?? {};
  if (typeof x !== 'number' || typeof y !== 'number') {
    return false;
  }

  for (const district of playerDistricts) {
    const bounds = district?.bounds;
    if (!bounds) {
      continue;
    }

    if (
      x >= bounds.x
      && x <= bounds.x + bounds.w
      && y >= bounds.y
      && y <= bounds.y + bounds.h
    ) {
      return true;
    }
  }

  return false;
}

function updateHungryFlag(character) {
  character.hungry = character.blood < HUNGER_THRESHOLD * character.maxBlood;
}

export function updateBlood(characters, dt, playerDistricts) {
  if (!Array.isArray(characters) || characters.length === 0) {
    return;
  }

  const deltaMs = Math.max(0, dt);

  for (const character of characters) {
    if (!character?.isPlayer) {
      continue;
    }

    const maxBlood = typeof character.maxBlood === 'number' && character.maxBlood > 0
      ? character.maxBlood
      : 100;
    const multiplier = isInPlayerDistrict(character, playerDistricts)
      ? DISTRICT_DECAY_MULTIPLIER
      : 1;
    const decay = (deltaMs / 3_600_000) * DECAY_PER_HOUR * maxBlood * multiplier;

    character.blood = Math.max(0, (character.blood ?? maxBlood) - decay);
    character.maxBlood = maxBlood;
    updateHungryFlag(character);
  }
}

export function applyHuntBloodGain(character) {
  if (!character) {
    return;
  }

  const maxBlood = typeof character.maxBlood === 'number' && character.maxBlood > 0
    ? character.maxBlood
    : 100;

  character.maxBlood = maxBlood;
  character.blood = Math.min(maxBlood, (character.blood ?? maxBlood) + HUNT_BLOOD_GAIN);
  updateHungryFlag(character);
}
