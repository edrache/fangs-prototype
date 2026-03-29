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

function buildRenderSignature(
  characters,
  interactionState,
  notifications,
  openTraitMenuCharacterId,
  removingTraitsCharacterId,
) {
  return JSON.stringify({
    selectedCharacterId: interactionState?.selectedCharacterId ?? null,
    mode: interactionState?.mode ?? 'idle',
    openTraitMenuCharacterId,
    removingTraitsCharacterId,
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
      traits: (character.traits ?? []).map((trait) => trait?.id ?? String(trait)),
    })),
  });
}

function hasTrait(character, traitId) {
  return (character?.traits ?? []).some((trait) => trait?.id === traitId || trait === traitId);
}

function formatTraitLabel(trait) {
  if (!trait) {
    return 'Unknown';
  }

  const traitId = typeof trait === 'string' ? trait : trait.id;
  if (!traitId) {
    return 'Unknown';
  }

  return traitId.charAt(0).toUpperCase() + traitId.slice(1);
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

function createCard(
  character,
  isSelected,
  notifications,
  availableTraits,
  openTraitMenuCharacterId,
  removingTraitsCharacterId,
) {
  const card = document.createElement('div');
  card.className = 'player-card';
  card.dataset.characterId = String(character.id);
  card.dataset.selected = isSelected ? 'true' : 'false';
  card.style.color = character.color;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open map menu for Character ${character.id + 1}`);
  card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

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

  const traitsRow = document.createElement('div');
  traitsRow.className = 'player-card__traits';

  const traitsLabel = document.createElement('span');
  traitsLabel.className = 'player-card__traits-label';
  traitsLabel.textContent = 'Traits';

  const traitsList = document.createElement('div');
  traitsList.className = 'player-card__traits-list';

  const traits = Array.isArray(character?.traits) ? character.traits : [];
  if (traits.length > 0) {
    for (const trait of traits) {
      const pill = document.createElement('button');
      const traitId = trait?.id ?? String(trait);
      pill.className = 'trait-pill';
      pill.type = 'button';
      pill.dataset.characterId = String(character.id);
      pill.dataset.traitId = traitId;
      pill.dataset.removable = removingTraitsCharacterId === character.id ? 'true' : 'false';
      pill.disabled = removingTraitsCharacterId !== character.id;
      pill.textContent = formatTraitLabel(trait);
      traitsList.append(pill);
    }
  } else {
    const emptyState = document.createElement('span');
    emptyState.className = 'trait-pill trait-pill--empty';
    emptyState.textContent = 'None';
    traitsList.append(emptyState);
  }

  traitsRow.append(traitsLabel, traitsList);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'player-card__actions';

  const addTraitButton = document.createElement('button');
  addTraitButton.type = 'button';
  addTraitButton.className = 'player-card__trait-action';
  addTraitButton.dataset.characterId = String(character.id);
  addTraitButton.setAttribute('aria-expanded', openTraitMenuCharacterId === character.id ? 'true' : 'false');
  addTraitButton.textContent = '+ Trait';

  const removeTraitsButton = document.createElement('button');
  removeTraitsButton.type = 'button';
  removeTraitsButton.className = 'player-card__trait-action';
  removeTraitsButton.dataset.characterId = String(character.id);
  removeTraitsButton.dataset.mode = 'remove-traits';
  removeTraitsButton.dataset.active = removingTraitsCharacterId === character.id ? 'true' : 'false';
  removeTraitsButton.setAttribute('aria-pressed', removingTraitsCharacterId === character.id ? 'true' : 'false');
  removeTraitsButton.textContent = '- Traits';

  actionsRow.append(addTraitButton, removeTraitsButton);

  if (openTraitMenuCharacterId === character.id) {
    const menu = document.createElement('div');
    menu.className = 'trait-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Add trait to Character ${character.id + 1}`);

    for (const trait of availableTraits) {
      const menuItem = document.createElement('button');
      menuItem.type = 'button';
      menuItem.className = 'trait-menu__item';
      menuItem.dataset.characterId = String(character.id);
      menuItem.dataset.traitId = trait.id;
      menuItem.disabled = hasTrait(character, trait.id);
      menuItem.textContent = trait.label;
      if (menuItem.disabled) {
        menuItem.dataset.disabled = 'true';
      }
      menu.append(menuItem);
    }

    actionsRow.append(menu);
  }

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
    card.append(top, status, traitsRow, actionsRow, huntStatus, hungerNotice, bloodRow, hint);
    return card;
  }

  card.append(top, status, traitsRow, actionsRow, hungerNotice, bloodRow, hint);
  return card;
}

export function createPlayerPanel({
  mount,
  getCharacters,
  availableTraits = [],
  onSelectCharacter,
  onAddTrait,
  onRemoveTrait,
}) {
  if (!mount) {
    throw new Error('createPlayerPanel requires a mount element');
  }

  let latestInteractionState = null;
  let latestNotifications = [];
  let lastRenderSignature = null;
  let openTraitMenuCharacterId = null;
  let removingTraitsCharacterId = null;
  let isPointerInsidePanel = false;

  function closeTraitMenu() {
    if (openTraitMenuCharacterId == null) {
      return;
    }

    openTraitMenuCharacterId = null;
    render(true);
  }

  function toggleTraitMenu(characterId) {
    removingTraitsCharacterId = null;
    openTraitMenuCharacterId = openTraitMenuCharacterId === characterId ? null : characterId;
    render(true);
  }

  function closeRemoveTraitsMode() {
    if (removingTraitsCharacterId == null) {
      return;
    }

    removingTraitsCharacterId = null;
    render(true);
  }

  function toggleRemoveTraitsMode(characterId) {
    openTraitMenuCharacterId = null;
    removingTraitsCharacterId = removingTraitsCharacterId === characterId ? null : characterId;
    render(true);
  }

  function handleTraitControlPointer(event) {
    const removeTraitsButton = event.target.closest('[data-mode="remove-traits"]');
    if (removeTraitsButton && mount.contains(removeTraitsButton)) {
      event.preventDefault();
      event.stopPropagation();
      const characterId = Number(removeTraitsButton.dataset.characterId);
      if (Number.isFinite(characterId)) {
        toggleRemoveTraitsMode(characterId);
      }
      removeTraitsButton.blur();
      return true;
    }

    const traitButton = event.target.closest('.player-card__trait-action');
    if (traitButton && mount.contains(traitButton)) {
      event.preventDefault();
      event.stopPropagation();
      const characterId = Number(traitButton.dataset.characterId);
      if (Number.isFinite(characterId)) {
        toggleTraitMenu(characterId);
      }
      traitButton.blur();
      return true;
    }

    const traitMenuItem = event.target.closest('.trait-menu__item');
    if (traitMenuItem && mount.contains(traitMenuItem)) {
      event.preventDefault();
      event.stopPropagation();
      const characterId = Number(traitMenuItem.dataset.characterId);
      const traitId = traitMenuItem.dataset.traitId;

      if (Number.isFinite(characterId) && traitId && !traitMenuItem.disabled) {
        if (typeof onAddTrait === 'function') {
          onAddTrait(characterId, traitId);
        }
      }

      openTraitMenuCharacterId = null;
      render(true);
      traitMenuItem.blur();
      return true;
    }

    const traitPill = event.target.closest('.trait-pill[data-removable="true"]');
    if (traitPill && mount.contains(traitPill)) {
      event.preventDefault();
      event.stopPropagation();
      const characterId = Number(traitPill.dataset.characterId);
      const traitId = traitPill.dataset.traitId;

      if (Number.isFinite(characterId) && traitId && typeof onRemoveTrait === 'function') {
        onRemoveTrait(characterId, traitId);
      }

      render(true);
      traitPill.blur();
      return true;
    }

    if (event.target.closest('.trait-menu')) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return false;
  }

  mount.addEventListener('pointerdown', (event) => {
    handleTraitControlPointer(event);
  });

  mount.addEventListener('click', (event) => {
    if (handleTraitControlPointer(event)) {
      return;
    }

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

    openTraitMenuCharacterId = null;
    removingTraitsCharacterId = null;
    render(true);
    card.blur?.();
  });

  mount.addEventListener('keydown', (event) => {
    if (event.target.closest('.player-card__trait-action') || event.target.closest('.trait-menu')) {
      return;
    }

    const card = event.target.closest('.player-card');
    if (!card || !mount.contains(card)) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    const characterId = Number(card.dataset.characterId);
    if (!Number.isFinite(characterId)) {
      return;
    }

    if (typeof onSelectCharacter === 'function') {
      onSelectCharacter(characterId);
    }

    openTraitMenuCharacterId = null;
    removingTraitsCharacterId = null;
    render(true);
  });

  mount.addEventListener('pointerenter', () => {
    isPointerInsidePanel = true;
  });

  mount.addEventListener('pointerleave', () => {
    isPointerInsidePanel = false;
    render(true);
  });

  window.addEventListener('pointerdown', (event) => {
    if (mount.contains(event.target)) {
      return;
    }

    closeTraitMenu();
    closeRemoveTraitsMode();
  });

  function render(force = false) {
    const characters = (typeof getCharacters === 'function' ? getCharacters() : []) ?? [];
    const playerCharacters = characters.filter((character) => character?.isPlayer);
    const nextSignature = buildRenderSignature(
      playerCharacters,
      latestInteractionState,
      latestNotifications,
      openTraitMenuCharacterId,
      removingTraitsCharacterId,
    );

    if (!force && isPointerInsidePanel) {
      return;
    }

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
      fragment.append(
        createCard(
          character,
          isSelected,
          latestNotifications,
          availableTraits,
          openTraitMenuCharacterId,
          removingTraitsCharacterId,
        ),
      );
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
