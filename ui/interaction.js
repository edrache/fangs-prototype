const CHARACTER_HIT_RADIUS = 12;
const STREET_NODE_FALLBACK_RADIUS = 80;
const MENU_WIDTH = 176;
const MENU_ITEM_HEIGHT = 28;
const MENU_PADDING = 10;

export const NPC_MENU_ITEMS = [
  { id: 'hunt', label: 'Hunt' },
  { id: 'cancel', label: 'Cancel' },
];

const HUNTING_MENU_ITEMS = [
  { id: 'cancel_hunt', label: 'Cancel hunt' },
  { id: 'cancel', label: 'Cancel' },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function toCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: clamp((event.clientX - rect.left) * scaleX, 0, canvas.width),
    y: clamp((event.clientY - rect.top) * scaleY, 0, canvas.height),
  };
}

function isPointInsideStreet(point, street) {
  return (
    point.x >= street.x1
    && point.x <= street.x2
    && point.y >= street.y1
    && point.y <= street.y2
  );
}

function isNodeOnStreet(node, street) {
  const epsilon = Math.max(1, street.width * 0.2);
  return (
    node.x >= street.x1 - epsilon
    && node.x <= street.x2 + epsilon
    && node.y >= street.y1 - epsilon
    && node.y <= street.y2 + epsilon
  );
}

function findCharacterAtPoint(characters, point) {
  let match = null;
  let bestDistance = CHARACTER_HIT_RADIUS * CHARACTER_HIT_RADIUS;

  for (const character of characters) {
    const candidateDistance = distanceSquared(character.pos, point);
    if (candidateDistance <= bestDistance) {
      match = character;
      bestDistance = candidateDistance;
    }
  }

  return match;
}

function isPlayerCharacter(character) {
  return character?.isPlayer === true;
}

function findDestinationNode(city, point) {
  if (!city) {
    return null;
  }

  const containingStreets = city.streets.filter((street) => isPointInsideStreet(point, street));
  let candidates = city.intersections;

  if (containingStreets.length > 0) {
    candidates = city.intersections.filter((node) =>
      containingStreets.some((street) => isNodeOnStreet(node, street))
    );
  }

  let bestNode = null;
  let bestDistance = Infinity;

  for (const node of candidates) {
    const candidateDistance = distanceSquared(node, point);
    if (candidateDistance < bestDistance) {
      bestNode = node;
      bestDistance = candidateDistance;
    }
  }

  if (bestNode) {
    return bestNode;
  }

  const fallbackLimit = STREET_NODE_FALLBACK_RADIUS * STREET_NODE_FALLBACK_RADIUS;
  for (const node of city.intersections) {
    const candidateDistance = distanceSquared(node, point);
    if (candidateDistance < bestDistance && candidateDistance <= fallbackLimit) {
      bestNode = node;
      bestDistance = candidateDistance;
    }
  }

  return bestNode;
}

function getPlayerMenuItems(character) {
  const items = [{ id: 'choose_destination', label: 'Choose destination' }];
  if (character?.capabilities?.includes('hunt')) {
    items.push({ id: 'hunt', label: 'Hunt' });
  }
  items.push({ id: 'cancel', label: 'Cancel' });
  return items;
}

function getCurrentMenuItems(character, mode) {
  if (mode === 'npc_menu_open') {
    return NPC_MENU_ITEMS;
  }

  if (!character) {
    return [];
  }

  if (character.hunt != null) {
    return HUNTING_MENU_ITEMS;
  }

  return getPlayerMenuItems(character);
}

export function getMenuLayoutForCharacter(canvasWidth, canvasHeight, character, itemCount) {
  if (!character) {
    return null;
  }

  const width = MENU_WIDTH;
  const height = itemCount * MENU_ITEM_HEIGHT + MENU_PADDING * 2;
  const preferredX = character.pos.x + 18;
  const preferredY = character.pos.y - height - 12;

  return {
    x: clamp(preferredX, 12, canvasWidth - width - 12),
    y: clamp(preferredY, 12, canvasHeight - height - 12),
    width,
    height,
    itemHeight: MENU_ITEM_HEIGHT,
    padding: MENU_PADDING,
    itemCount,
  };
}

function getMenuItemIndex(point, layout) {
  if (!layout) {
    return null;
  }

  const inside =
    point.x >= layout.x
    && point.x <= layout.x + layout.width
    && point.y >= layout.y
    && point.y <= layout.y + layout.height;

  if (!inside) {
    return null;
  }

  const relativeY = point.y - layout.y - layout.padding;
  if (relativeY < 0) {
    return null;
  }

  const index = Math.floor(relativeY / layout.itemHeight);
  return index >= 0 && index < layout.itemCount ? index : null;
}

export function createInteractionController({
  canvas,
  getCity,
  getCharacters,
  onAssignDestination,
  onStartHunt,
  onCancelHunt,
  onChange,
}) {
  const state = {
    mode: 'idle',
    selectedCharacterId: null,
    hoveredCharacterId: null,
    hoveredMenuItemIndex: null,
    targetNodeId: null,
    targetCharacterId: null,
    mousePos: null,
    npcTargetCharacterId: null,
  };

  function emitChange() {
    if (typeof onChange === 'function') {
      onChange(getState());
    }
  }

  function getCharactersSafe() {
    return getCharacters() ?? [];
  }

  function getSelectedCharacter() {
    return getCharactersSafe().find((character) => character.id === state.selectedCharacterId) ?? null;
  }

  function getNpcTarget() {
    return getCharactersSafe().find((character) => character.id === state.npcTargetCharacterId) ?? null;
  }

  function getMenuLayoutForCurrentMode() {
    if (state.mode === 'npc_menu_open') {
      const npc = getNpcTarget();
      return getMenuLayoutForCharacter(
        canvas.width,
        canvas.height,
        npc,
        NPC_MENU_ITEMS.length,
      );
    }

    const selectedCharacter = getSelectedCharacter();
    const items = getCurrentMenuItems(selectedCharacter, state.mode);
    return getMenuLayoutForCharacter(
      canvas.width,
      canvas.height,
      selectedCharacter,
      items.length,
    );
  }

  function updateCursor() {
    if (
      (state.mode === 'menu_open' || state.mode === 'npc_menu_open')
      && state.hoveredMenuItemIndex != null
    ) {
      canvas.style.cursor = 'pointer';
      return;
    }

    if (state.hoveredCharacterId != null) {
      canvas.style.cursor = 'pointer';
      return;
    }

    if (state.mode === 'picking_destination' || state.mode === 'hunt_picking') {
      canvas.style.cursor = 'crosshair';
      return;
    }

    canvas.style.cursor = 'default';
  }

  function clearSelection() {
    state.mode = 'idle';
    state.selectedCharacterId = null;
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = null;
    state.npcTargetCharacterId = null;
    emitChange();
    updateCursor();
  }

  function openMenuForCharacter(characterId) {
    const character = getCharactersSafe().find((candidate) => candidate.id === characterId);
    if (!isPlayerCharacter(character)) {
      return false;
    }

    state.mode = 'menu_open';
    state.selectedCharacterId = characterId;
    state.hoveredCharacterId = characterId;
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = null;
    state.npcTargetCharacterId = null;
    state.mousePos = null;
    emitChange();
    updateCursor();
    return true;
  }

  function openNpcMenu(characterId) {
    const character = getCharactersSafe().find((candidate) => candidate.id === characterId);
    if (!character || isPlayerCharacter(character)) {
      return;
    }

    state.mode = 'npc_menu_open';
    state.npcTargetCharacterId = characterId;
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = characterId;
    emitChange();
    updateCursor();
  }

  function beginPickingDestination() {
    state.mode = 'picking_destination';
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = null;
    state.npcTargetCharacterId = null;
    emitChange();
    updateCursor();
  }

  function beginHuntPicking() {
    state.mode = 'hunt_picking';
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = null;
    state.npcTargetCharacterId = null;
    emitChange();
    updateCursor();
  }

  function previewNodeTarget(nodeId) {
    state.targetNodeId = nodeId;
    state.targetCharacterId = null;
    emitChange();
  }

  function previewCharacterTarget(characterId) {
    state.targetCharacterId = characterId;
    state.targetNodeId = null;
    emitChange();
  }

  function clearPendingTarget() {
    state.targetNodeId = null;
    state.targetCharacterId = null;
    emitChange();
  }

  function getHoverableCharacterId(hoveredCharacter) {
    if (!hoveredCharacter) {
      return null;
    }

    if (state.mode === 'picking_destination' || state.mode === 'hunt_picking') {
      return hoveredCharacter.id;
    }

    return isPlayerCharacter(hoveredCharacter) ? hoveredCharacter.id : null;
  }

  function handlePointerMove(event) {
    const point = toCanvasPoint(canvas, event);
    const characters = getCharactersSafe();
    const hoveredCharacter = findCharacterAtPoint(characters, point);

    state.mousePos = point;
    state.hoveredCharacterId = getHoverableCharacterId(hoveredCharacter);
    state.hoveredMenuItemIndex =
      state.mode === 'menu_open' || state.mode === 'npc_menu_open'
        ? getMenuItemIndex(point, getMenuLayoutForCurrentMode())
        : null;
    updateCursor();
    emitChange();
  }

  function handlePointerLeave() {
    state.mousePos = null;
    state.hoveredCharacterId = null;
    state.hoveredMenuItemIndex = null;
    updateCursor();
    emitChange();
  }

  function handleMenuClick(point) {
    if (state.mode === 'npc_menu_open') {
      const layout = getMenuLayoutForCurrentMode();
      const menuItemIndex = getMenuItemIndex(point, layout);
      if (menuItemIndex == null) {
        return false;
      }

      const menuItem = NPC_MENU_ITEMS[menuItemIndex];
      if (menuItem.id === 'hunt') {
        const selectedCharacter = getSelectedCharacter();
        const npc = getNpcTarget();
        if (selectedCharacter && npc && typeof onStartHunt === 'function') {
          onStartHunt(selectedCharacter, npc);
        }
      }

      state.npcTargetCharacterId = null;
      clearSelection();
      return true;
    }

    const layout = getMenuLayoutForCurrentMode();
    const menuItemIndex = getMenuItemIndex(point, layout);
    if (menuItemIndex == null) {
      return false;
    }

    const selectedCharacter = getSelectedCharacter();
    const items = getCurrentMenuItems(selectedCharacter, state.mode);
    const menuItem = items[menuItemIndex];

    if (menuItem.id === 'choose_destination') {
      beginPickingDestination();
      return true;
    }

    if (menuItem.id === 'hunt') {
      beginHuntPicking();
      return true;
    }

    if (menuItem.id === 'cancel_hunt') {
      if (selectedCharacter && typeof onCancelHunt === 'function') {
        onCancelHunt(selectedCharacter);
      }
      state.mode = 'menu_open';
      state.targetNodeId = null;
      state.targetCharacterId = null;
      emitChange();
      updateCursor();
      return true;
    }

    clearSelection();
    return true;
  }

  function confirmNodeTarget(selectedCharacter, nodeId) {
    if (typeof onAssignDestination === 'function') {
      onAssignDestination(selectedCharacter, { type: 'node', nodeId });
    }
    state.mode = 'menu_open';
    state.targetNodeId = nodeId;
    state.targetCharacterId = null;
    emitChange();
  }

  function confirmCharacterTarget(selectedCharacter, characterId) {
    if (typeof onAssignDestination === 'function') {
      onAssignDestination(selectedCharacter, { type: 'character', characterId });
    }
    state.mode = 'menu_open';
    state.targetNodeId = null;
    state.targetCharacterId = characterId;
    emitChange();
  }

  function confirmHuntTarget(selectedCharacter, characterId) {
    const targetCharacter = getCharactersSafe().find((character) => character.id === characterId);
    if (selectedCharacter && targetCharacter && typeof onStartHunt === 'function') {
      onStartHunt(selectedCharacter, targetCharacter);
    }
    clearSelection();
  }

  function handlePickingClick(point, selectedCharacter, characters, city) {
    const clickedCharacter = findCharacterAtPoint(characters, point);

    if (clickedCharacter) {
      if (clickedCharacter.id === state.selectedCharacterId) {
        clearSelection();
        return;
      }

      if (state.targetCharacterId === clickedCharacter.id && state.targetNodeId == null) {
        confirmCharacterTarget(selectedCharacter, clickedCharacter.id);
        return;
      }

      previewCharacterTarget(clickedCharacter.id);
      return;
    }

    const targetNode = findDestinationNode(city, point);
    if (!targetNode) {
      clearPendingTarget();
      return;
    }

    if (state.targetNodeId === targetNode.id && state.targetCharacterId == null) {
      confirmNodeTarget(selectedCharacter, targetNode.id);
      return;
    }

    previewNodeTarget(targetNode.id);
  }

  function handleHuntPickingClick(point, selectedCharacter, characters) {
    const clickedCharacter = findCharacterAtPoint(characters, point);

    if (!clickedCharacter) {
      clearPendingTarget();
      return;
    }

    if (clickedCharacter.id === state.selectedCharacterId) {
      clearSelection();
      return;
    }

    if (isPlayerCharacter(clickedCharacter)) {
      openMenuForCharacter(clickedCharacter.id);
      return;
    }

    if (state.targetCharacterId === clickedCharacter.id) {
      confirmHuntTarget(selectedCharacter, clickedCharacter.id);
      return;
    }

    previewCharacterTarget(clickedCharacter.id);
  }

  function handleClick(event) {
    const city = getCity();
    const characters = getCharactersSafe();
    if (!city || characters.length === 0) {
      return;
    }

    const point = toCanvasPoint(canvas, event);
    const clickedCharacter = findCharacterAtPoint(characters, point);
    const selectedCharacter = getSelectedCharacter();

    if (state.mode === 'idle') {
      if (isPlayerCharacter(clickedCharacter)) {
        openMenuForCharacter(clickedCharacter.id);
      }
      return;
    }

    if (clickedCharacter?.id === state.selectedCharacterId) {
      clearSelection();
      return;
    }

    if (state.mode === 'menu_open' || state.mode === 'npc_menu_open') {
      if (handleMenuClick(point)) {
        return;
      }

      if (state.mode === 'menu_open' && clickedCharacter && !isPlayerCharacter(clickedCharacter)) {
        openNpcMenu(clickedCharacter.id);
        return;
      }

      if (isPlayerCharacter(clickedCharacter)) {
        openMenuForCharacter(clickedCharacter.id);
      }

      return;
    }

    if (!selectedCharacter) {
      clearSelection();
      return;
    }

    if (state.mode === 'picking_destination') {
      handlePickingClick(point, selectedCharacter, characters, city);
      return;
    }

    if (state.mode === 'hunt_picking') {
      handleHuntPickingClick(point, selectedCharacter, characters);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      clearSelection();
    }
  }

  function reset() {
    state.mode = 'idle';
    state.selectedCharacterId = null;
    state.hoveredCharacterId = null;
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = null;
    state.mousePos = null;
    state.npcTargetCharacterId = null;
    updateCursor();
    emitChange();
  }

  function getState() {
    const selectedCharacter = getSelectedCharacter();
    const menuItems = getCurrentMenuItems(selectedCharacter, state.mode);

    return {
      mode: state.mode,
      selectedCharacterId: state.selectedCharacterId,
      hoveredCharacterId: state.hoveredCharacterId,
      hoveredMenuItemIndex: state.hoveredMenuItemIndex,
      targetNodeId: state.targetNodeId,
      targetCharacterId: state.targetCharacterId,
      npcTargetCharacterId: state.npcTargetCharacterId,
      menuItems,
      menuLayout: getMenuLayoutForCurrentMode(),
      mousePos: state.mousePos ? { ...state.mousePos } : null,
    };
  }

  canvas.addEventListener('mousemove', handlePointerMove);
  canvas.addEventListener('mouseleave', handlePointerLeave);
  canvas.addEventListener('click', handleClick);
  window.addEventListener('keydown', handleKeyDown);
  updateCursor();

  return {
    clearSelection,
    openMenuForCharacter,
    getState,
    reset,
    destroy() {
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('mouseleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.style.cursor = 'default';
    },
  };
}
