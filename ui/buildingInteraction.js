const MENU_WIDTH = 160;
const MENU_ITEM_HEIGHT = 28;
const MENU_PADDING = 10;
const MENU_ITEMS = [{ id: 'info', label: 'Info' }];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function isPointInRect(point, rect) {
  return (
    point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h
  );
}

function findSpecialBuildingAtPoint(buildings, point) {
  for (let index = 0; index < buildings.length; index += 1) {
    const building = buildings[index];
    if (!building?.special) {
      continue;
    }

    for (const rect of building.rects ?? []) {
      if (isPointInRect(point, rect)) {
        return index;
      }
    }
  }

  return null;
}

function getBuildingCenter(building) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of building.rects ?? []) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

function computeMenuLayout(canvasWidth, canvasHeight, building) {
  const center = getBuildingCenter(building);
  const width = MENU_WIDTH;
  const height = MENU_ITEMS.length * MENU_ITEM_HEIGHT + MENU_PADDING * 2;
  const preferredX = center.x + 18;
  const preferredY = center.y - height - 12;

  return {
    x: clamp(preferredX, 12, canvasWidth - width - 12),
    y: clamp(preferredY, 12, canvasHeight - height - 12),
    width,
    height,
    itemHeight: MENU_ITEM_HEIGHT,
    padding: MENU_PADDING,
    itemCount: MENU_ITEMS.length,
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

function capitalize(value) {
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function createBuildingInteractionController({
  canvas,
  getCity,
  onMenuOpen,
  onInfoRequested,
  onChange,
}) {
  const state = {
    mode: 'idle',
    hoveredBuildingId: null,
    selectedBuildingId: null,
    hoveredMenuItemIndex: null,
  };

  function emitChange() {
    if (typeof onChange === 'function') {
      onChange(getState());
    }
  }

  function getBuildings() {
    return getCity()?.buildings ?? [];
  }

  function getSelectedBuilding() {
    if (state.selectedBuildingId === null) {
      return null;
    }

    return getBuildings()[state.selectedBuildingId] ?? null;
  }

  function getMenuLayoutForSelected() {
    const building = getSelectedBuilding();
    if (!building) {
      return null;
    }

    return computeMenuLayout(canvas.width, canvas.height, building);
  }

  function updateCursor() {
    if (state.mode === 'building_menu_open' && state.hoveredMenuItemIndex != null) {
      canvas.style.cursor = 'pointer';
      return;
    }

    if (state.hoveredBuildingId != null) {
      canvas.style.cursor = 'pointer';
    }
  }

  function clearSelection() {
    state.mode = 'idle';
    state.selectedBuildingId = null;
    state.hoveredMenuItemIndex = null;
    emitChange();
    updateCursor();
  }

  function openBuildingMenu(buildingId) {
    const building = getBuildings()[buildingId];
    if (!building?.special) {
      return false;
    }

    state.mode = 'building_menu_open';
    state.selectedBuildingId = buildingId;
    state.hoveredMenuItemIndex = null;
    emitChange();

    if (typeof onMenuOpen === 'function') {
      onMenuOpen();
    }

    updateCursor();
    return true;
  }

  function getState() {
    const building = getSelectedBuilding();
    const layout = getMenuLayoutForSelected();

    return {
      mode: state.mode,
      hoveredBuildingId: state.hoveredBuildingId,
      selectedBuildingId: state.selectedBuildingId,
      hoveredMenuItemIndex: state.hoveredMenuItemIndex,
      menuItems: state.mode === 'building_menu_open' ? MENU_ITEMS : [],
      menuLayout: layout,
      menuTitle: building ? capitalize(building.special) : null,
    };
  }

  function handlePointerMove(event) {
    const point = toCanvasPoint(canvas, event);
    const buildings = getBuildings();

    state.hoveredBuildingId = findSpecialBuildingAtPoint(buildings, point);
    state.hoveredMenuItemIndex =
      state.mode === 'building_menu_open'
        ? getMenuItemIndex(point, getMenuLayoutForSelected())
        : null;

    updateCursor();
    emitChange();
  }

  function handlePointerLeave() {
    state.hoveredBuildingId = null;
    state.hoveredMenuItemIndex = null;
    updateCursor();
    emitChange();
  }

  function handleMenuClick(point) {
    const layout = getMenuLayoutForSelected();
    const menuItemIndex = getMenuItemIndex(point, layout);

    if (menuItemIndex == null) {
      return false;
    }

    const item = MENU_ITEMS[menuItemIndex];
    if (item?.id === 'info') {
      const building = getSelectedBuilding();
      if (building && typeof onInfoRequested === 'function') {
        onInfoRequested(building);
      }
    }

    clearSelection();
    return true;
  }

  function handleClick(event) {
    const city = getCity();
    if (!city) {
      return;
    }

    const point = toCanvasPoint(canvas, event);
    const buildings = city.buildings ?? [];
    const clickedBuildingId = findSpecialBuildingAtPoint(buildings, point);

    if (state.mode === 'building_menu_open') {
      if (handleMenuClick(point)) {
        return;
      }

      if (clickedBuildingId !== null) {
        openBuildingMenu(clickedBuildingId);
        return;
      }

      clearSelection();
      return;
    }

    if (clickedBuildingId !== null) {
      openBuildingMenu(clickedBuildingId);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && state.mode === 'building_menu_open') {
      clearSelection();
    }
  }

  function reset() {
    state.mode = 'idle';
    state.hoveredBuildingId = null;
    state.selectedBuildingId = null;
    state.hoveredMenuItemIndex = null;
    updateCursor();
    emitChange();
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
