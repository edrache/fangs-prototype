const EMPTY_LABEL = 'No player characters';

function getNotificationForCharacter(notifications, characterId) {
  return notifications.find(
    (notification) =>
      notification?.type === 'hunt_success' && notification.characterId === characterId,
  ) ?? null;
}

function getHuntStatusText(character, notifications = []) {
  if (character?.hunt?.phase === 'moving') {
    return 'Hunt: tracking target';
  }

  if (character?.hunt?.phase === 'hunting') {
    const duration = Math.max(1, character.hunt.duration ?? 1);
    const progress = Math.min(1, Math.max(0, (character.hunt.elapsed ?? 0) / duration));
    return `Hunt: in progress ${Math.round(progress * 100)}%`;
  }

  if (getNotificationForCharacter(notifications, character?.id)) {
    return 'Hunt successful';
  }

  return null;
}

function getStatusText(character) {
  if (character?.destination?.type === 'node') {
    return `target: node ${character.destination.nodeId}`;
  }

  if (character?.destination?.type === 'character') {
    return `following: character ${character.destination.characterId + 1}`;
  }

  if ((character?.path?.length ?? 0) > 0) {
    return 'moving';
  }

  return 'idle';
}

function buildRenderSignature(characters, interactionState, notifications) {
  return JSON.stringify({
    selectedCharacterId: interactionState?.selectedCharacterId ?? null,
    notifications: notifications
      .filter((notification) => notification?.type === 'hunt_success')
      .map((notification) => ({
        type: notification.type,
        characterId: notification.characterId,
      })),
    characters: characters.map((character) => ({
      id: character.id,
      isPlayer: character.isPlayer,
      pathLength: character.path?.length ?? 0,
      destination: character.destination,
      hunt: character.hunt,
      blood: character.blood,
      maxBlood: character.maxBlood,
      hungry: character.hungry,
    })),
  });
}

function getBloodValue(character) {
  if (Number.isFinite(character?.blood)) {
    return character.blood;
  }

  return 100;
}

function getMaxBloodValue(character) {
  if (Number.isFinite(character?.maxBlood) && character.maxBlood > 0) {
    return character.maxBlood;
  }

  return 100;
}

function getBloodFillPercent(character) {
  const maxBlood = getMaxBloodValue(character);
  const blood = getBloodValue(character);
  return Math.max(0, Math.min(100, (blood / maxBlood) * 100));
}

function createCard(character, isSelected, notifications) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'player-card';
  card.dataset.characterId = String(character.id);
  card.dataset.selected = isSelected ? 'true' : 'false';
  card.style.color = character.color;

  const top = document.createElement('div');
  top.className = 'player-card__top';

  const swatch = document.createElement('span');
  swatch.className = 'player-card__swatch';
  swatch.style.background = character.color;
  swatch.style.color = character.color;

  const title = document.createElement('div');
  title.className = 'player-card__title';
  title.textContent = `Character ${character.id + 1}`;

  const status = document.createElement('div');
  status.className = 'player-card__status';
  status.textContent = getStatusText(character);

  const huntStatusText = getHuntStatusText(character, notifications);
  const hint = document.createElement('div');
  hint.className = 'player-card__hint';
  hint.textContent = isSelected ? 'Selected on map' : 'Click to open menu';

  const bloodRow = document.createElement('div');
  bloodRow.className = 'player-card__blood';

  const bloodLabel = document.createElement('span');
  bloodLabel.className = 'player-card__blood-label';
  bloodLabel.textContent = 'Blood';

  const bloodTrack = document.createElement('div');
  bloodTrack.className = 'blood-bar';
  bloodTrack.setAttribute('role', 'progressbar');
  bloodTrack.setAttribute('aria-valuemin', '0');
  bloodTrack.setAttribute('aria-valuemax', String(getMaxBloodValue(character)));
  bloodTrack.setAttribute('aria-valuenow', String(Math.round(getBloodValue(character))));
  bloodTrack.style.setProperty('--blood-fill-percent', `${getBloodFillPercent(character)}%`);
  bloodTrack.dataset.hungry = character?.hungry ? 'true' : 'false';

  const bloodFill = document.createElement('span');
  bloodFill.className = 'blood-bar__fill';
  bloodTrack.append(bloodFill);

  const bloodValue = document.createElement('span');
  bloodValue.className = 'player-card__blood-value';
  bloodValue.textContent = String(Math.floor(getBloodValue(character)));

  bloodRow.append(bloodLabel, bloodTrack, bloodValue);

  const hungerNotice = document.createElement('div');
  hungerNotice.className = 'hunger-notice';
  hungerNotice.textContent = '⚠ HUNGER!';
  hungerNotice.hidden = !character?.hungry;

  top.append(swatch, title);

  if (huntStatusText) {
    const huntStatus = document.createElement('div');
    huntStatus.className = 'hunt-status';
    huntStatus.textContent = huntStatusText;
    card.append(top, status, huntStatus, hungerNotice, bloodRow, hint);
    return card;
  }

  card.append(top, status, hungerNotice, bloodRow, hint);
  return card;
}

export function createPlayerPanel({ mount, getCharacters, onSelectCharacter }) {
  if (!mount) {
    throw new Error('createPlayerPanel requires a mount element');
  }

  let latestInteractionState = null;
  let latestNotifications = [];
  let lastRenderSignature = null;

  mount.addEventListener('click', (event) => {
    const card = event.target.closest('.player-card');
    if (!card || !mount.contains(card)) {
      return;
    }

    const characterId = Number(card.dataset.characterId);
    if (!Number.isFinite(characterId)) {
      return;
    }

    if (typeof onSelectCharacter === 'function') {
      onSelectCharacter(characterId);
    }
  });

  function render() {
    const characters = (typeof getCharacters === 'function' ? getCharacters() : []) ?? [];
    const playerCharacters = characters.filter((character) => character?.isPlayer);
    const nextSignature = buildRenderSignature(
      playerCharacters,
      latestInteractionState,
      latestNotifications,
    );

    if (nextSignature === lastRenderSignature) {
      return;
    }

    lastRenderSignature = nextSignature;
    mount.replaceChildren();

    if (playerCharacters.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'player-panel-empty';
      empty.textContent = EMPTY_LABEL;
      mount.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const character of playerCharacters) {
      const isSelected = latestInteractionState?.selectedCharacterId === character.id;
      fragment.append(createCard(character, isSelected, latestNotifications));
    }

    mount.append(fragment);
  }

  return {
    update(interactionState, notifications = []) {
      latestInteractionState = interactionState ?? null;
      latestNotifications = notifications;
      render();
    },
  };
}
