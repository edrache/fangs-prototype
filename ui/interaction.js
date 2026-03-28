const CHARACTER_HIT_RADIUS = 12;
const STREET_NODE_FALLBACK_RADIUS = 80;
const MENU_WIDTH = 176;
const MENU_ITEM_HEIGHT = 28;
const MENU_PADDING = 10;

export const MENU_ITEMS = [
  { id: 'choose_destination', label: 'Choose destination' },
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
    point.x >= street.x1 &&
    point.x <= street.x2 &&
    point.y >= street.y1 &&
    point.y <= street.y2
  );
}

function isNodeOnStreet(node, street) {
  const epsilon = Math.max(1, street.width * 0.2);
  return (
    node.x >= street.x1 - epsilon &&
    node.x <= street.x2 + epsilon &&
    node.y >= street.y1 - epsilon &&
    node.y <= street.y2 + epsilon
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

export function getMenuLayoutForCharacter(canvasWidth, canvasHeight, character) {
  if (!character) {
    return null;
  }

  const width = MENU_WIDTH;
  const height = MENU_ITEMS.length * MENU_ITEM_HEIGHT + MENU_PADDING * 2;
  const preferredX = character.pos.x + 18;
  const preferredY = character.pos.y - height - 12;

  return {
    x: clamp(preferredX, 12, canvasWidth - width - 12),
    y: clamp(preferredY, 12, canvasHeight - height - 12),
    width,
    height,
    itemHeight: MENU_ITEM_HEIGHT,
    padding: MENU_PADDING,
  };
}

function getMenuItemIndex(point, layout) {
  if (!layout) {
    return null;
  }

  const inside =
    point.x >= layout.x &&
    point.x <= layout.x + layout.width &&
    point.y >= layout.y &&
    point.y <= layout.y + layout.height;

  if (!inside) {
    return null;
  }

  const relativeY = point.y - layout.y - layout.padding;
  if (relativeY < 0) {
    return null;
  }

  const index = Math.floor(relativeY / layout.itemHeight);
  return index >= 0 && index < MENU_ITEMS.length ? index : null;
}

export function createInteractionController({
  canvas,
  getCity,
  getCharacters,
  onAssignDestination,
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

  function getMenuLayout() {
    return getMenuLayoutForCharacter(canvas.width, canvas.height, getSelectedCharacter());
  }

  function updateCursor() {
    if (state.mode === 'menu_open' && state.hoveredMenuItemIndex != null) {
      canvas.style.cursor = 'pointer';
      return;
    }

    if (state.hoveredCharacterId != null) {
      canvas.style.cursor = 'pointer';
      return;
    }

    if (state.mode === 'picking_destination') {
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
    emitChange();
    updateCursor();
  }

  function openMenuForCharacter(characterId) {
    state.mode = 'menu_open';
    state.selectedCharacterId = characterId;
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = null;
    emitChange();
    updateCursor();
  }

  function beginPickingDestination() {
    state.mode = 'picking_destination';
    state.hoveredMenuItemIndex = null;
    state.targetNodeId = null;
    state.targetCharacterId = null;
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

  function handlePointerMove(event) {
    const point = toCanvasPoint(canvas, event);
    const characters = getCharactersSafe();
    const hoveredCharacter = findCharacterAtPoint(characters, point);

    state.mousePos = point;
    state.hoveredCharacterId = hoveredCharacter?.id ?? null;
    state.hoveredMenuItemIndex =
      state.mode === 'menu_open' ? getMenuItemIndex(point, getMenuLayout()) : null;
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
    const menuItemIndex = getMenuItemIndex(point, getMenuLayout());

    if (menuItemIndex == null) {
      return false;
    }

    const menuItem = MENU_ITEMS[menuItemIndex];
    if (menuItem.id === 'choose_destination') {
      beginPickingDestination();
      return true;
    }

    clearSelection();
    return true;
  }

  function confirmNodeTarget(selectedCharacter, nodeId) {
    onAssignDestination(selectedCharacter, { type: 'node', nodeId });
    state.mode = 'menu_open';
    state.targetNodeId = nodeId;
    state.targetCharacterId = null;
    emitChange();
  }

  function confirmCharacterTarget(selectedCharacter, characterId) {
    onAssignDestination(selectedCharacter, { type: 'character', characterId });
    state.mode = 'menu_open';
    state.targetNodeId = null;
    state.targetCharacterId = characterId;
    emitChange();
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
      if (clickedCharacter) {
        openMenuForCharacter(clickedCharacter.id);
      }
      return;
    }

    if (clickedCharacter?.id === state.selectedCharacterId) {
      clearSelection();
      return;
    }

    if (state.mode === 'menu_open') {
      if (handleMenuClick(point)) {
        return;
      }

      if (clickedCharacter) {
        openMenuForCharacter(clickedCharacter.id);
      }

      return;
    }

    if (!selectedCharacter) {
      clearSelection();
      return;
    }

    handlePickingClick(point, selectedCharacter, characters, city);
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
    updateCursor();
    emitChange();
  }

  function getState() {
    return {
      mode: state.mode,
      selectedCharacterId: state.selectedCharacterId,
      hoveredCharacterId: state.hoveredCharacterId,
      hoveredMenuItemIndex: state.hoveredMenuItemIndex,
      targetNodeId: state.targetNodeId,
      targetCharacterId: state.targetCharacterId,
      menuLayout: getMenuLayout(),
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
