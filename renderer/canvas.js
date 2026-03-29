const BACKGROUND_COLOR = '#1a1a2e';
const STREET_FILL = '#6d748f';
const STREET_EDGE = 'rgba(223, 230, 255, 0.06)';
const INTERSECTION_FILL = 'rgba(250, 252, 255, 0.45)';
const CHARACTER_TRAIL_STEPS = 10;
const CHARACTER_RADIUS = 4.8;
const SELECTION_RING_RADIUS = CHARACTER_RADIUS + 5;
const HUNT_RING_RADIUS = 20;
const NOTIFICATION_LIFETIME_MS = 2500;

function darkenColor(hex, factor) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const shaded = channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor))));
  return `rgb(${shaded[0]} ${shaded[1]} ${shaded[2]})`;
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function findCharacterById(characters, characterId) {
  return characters.find((character) => character.id === characterId) ?? null;
}

function fillDistrict(ctx, district) {
  ctx.fillStyle = district.color;
  ctx.globalAlpha = 0.34;
  ctx.fillRect(district.bounds.x, district.bounds.y, district.bounds.w, district.bounds.h);
  ctx.globalAlpha = 1;
}

function drawPlayerDistrictBorder(ctx, district) {
  const inset = 1.5;
  ctx.save();
  ctx.strokeStyle = '#8b0000';
  ctx.lineWidth = 3;
  ctx.strokeRect(
    district.bounds.x + inset,
    district.bounds.y + inset,
    district.bounds.w - inset * 2,
    district.bounds.h - inset * 2,
  );
  ctx.restore();
}

function drawStreet(ctx, street) {
  ctx.fillStyle = STREET_FILL;
  ctx.fillRect(street.x1, street.y1, street.x2 - street.x1, street.y2 - street.y1);

  ctx.strokeStyle = STREET_EDGE;
  ctx.lineWidth = 1;
  ctx.strokeRect(street.x1, street.y1, street.x2 - street.x1, street.y2 - street.y1);
}

function drawBuildings(ctx, city) {
  const districtColors = new Map(city.districts.map((district) => [district.id, district.color]));

  for (const building of city.buildings) {
    const color = districtColors.get(building.districtId) ?? '#546179';
    ctx.fillStyle = darkenColor(color, 0.3);

    for (const rect of building.rects) {
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  }
}

function drawIntersections(ctx, intersections) {
  ctx.fillStyle = INTERSECTION_FILL;

  for (const node of intersections) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCharacterTrail(ctx, character) {
  const points = [character.pos, ...(character.trail ?? [])].slice(0, CHARACTER_TRAIL_STEPS);

  if (points.length < 2) {
    return;
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let index = points.length - 1; index > 0; index -= 1) {
    const alpha = index / points.length;
    const start = points[index];
    const end = points[index - 1];

    ctx.strokeStyle = hexToRgba(character.color, alpha * 0.28);
    ctx.lineWidth = 3.2 - alpha * 0.8;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const alpha = index / points.length;
    const point = points[index];

    ctx.fillStyle = hexToRgba(character.color, alpha * 0.22);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.4 + alpha * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCharacters(ctx, characters) {
  for (const character of characters) {
    drawCharacterTrail(ctx, character);
  }

  for (const character of characters) {
    ctx.save();
    ctx.shadowColor = character.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = character.color;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;

    if (character.isPlayer) {
      ctx.translate(character.pos.x, character.pos.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-CHARACTER_RADIUS, -CHARACTER_RADIUS, CHARACTER_RADIUS * 2, CHARACTER_RADIUS * 2);
      ctx.strokeRect(-CHARACTER_RADIUS, -CHARACTER_RADIUS, CHARACTER_RADIUS * 2, CHARACTER_RADIUS * 2);
    } else {
      ctx.beginPath();
      ctx.arc(character.pos.x, character.pos.y, CHARACTER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHuntRings(ctx, characters) {
  for (const character of characters) {
    if (character?.hunt?.phase !== 'hunting') {
      continue;
    }

    const duration = Math.max(1, character.hunt.duration ?? 1);
    const progress = Math.min(1, Math.max(0, (character.hunt.elapsed ?? 0) / duration));

    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(180, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(character.pos.x, character.pos.y, HUNT_RING_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ff2244';
    ctx.beginPath();
    ctx.arc(
      character.pos.x,
      character.pos.y,
      HUNT_RING_RADIUS,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * progress,
    );
    ctx.stroke();
    ctx.restore();
  }
}

function drawSelectedCharacter(ctx, character) {
  if (!character) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 244, 166, 0.95)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(character.pos.x, character.pos.y, SELECTION_RING_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 244, 166, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(character.pos.x, character.pos.y, SELECTION_RING_RADIUS + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHoveredCharacter(ctx, character) {
  if (!character) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(character.pos.x, character.pos.y, SELECTION_RING_RADIUS - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTargetNode(ctx, node) {
  if (!node) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 244, 166, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(node.x - 11, node.y);
  ctx.lineTo(node.x + 11, node.y);
  ctx.moveTo(node.x, node.y - 11);
  ctx.lineTo(node.x, node.y + 11);
  ctx.stroke();
  ctx.restore();
}

function drawTargetCharacter(ctx, selectedCharacter, targetCharacter) {
  if (!targetCharacter) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(137, 247, 255, 0.92)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(targetCharacter.pos.x, targetCharacter.pos.y, SELECTION_RING_RADIUS + 3, 0, Math.PI * 2);
  ctx.stroke();

  if (selectedCharacter) {
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(137, 247, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(selectedCharacter.pos.x, selectedCharacter.pos.y);
    ctx.lineTo(targetCharacter.pos.x, targetCharacter.pos.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawActionMenu(ctx, interactionState) {
  const layout = interactionState?.menuLayout;
  const menuItems = interactionState?.menuItems ?? [];

  if (!layout || menuItems.length === 0) {
    return;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(12, 16, 28, 0.96)';
  ctx.strokeStyle = 'rgba(220, 228, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(layout.x, layout.y, layout.width, layout.height, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(240, 244, 255, 0.82)';
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillText(
    interactionState.mode === 'npc_menu_open' ? 'Target action' : 'Action menu',
    layout.x + layout.padding,
    layout.y + 14,
  );

  for (let index = 0; index < menuItems.length; index += 1) {
    const itemY = layout.y + layout.padding + 8 + index * layout.itemHeight;
    const isHovered = interactionState.hoveredMenuItemIndex === index;

    if (isHovered) {
      ctx.fillStyle = 'rgba(133, 151, 224, 0.2)';
      ctx.beginPath();
      ctx.roundRect(
        layout.x + 6,
        itemY - 2,
        layout.width - 12,
        layout.itemHeight - 2,
        6,
      );
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(246, 248, 255, 0.95)';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText(menuItems[index].label, layout.x + layout.padding, itemY + 14);
  }

  ctx.restore();
}

function drawInteractionHint(ctx, interactionState) {
  const mode = interactionState?.mode ?? 'idle';
  const messageByMode = {
    idle: 'Click a player character to open its action menu.',
    menu_open: 'Choose an action, or click an NPC to open the target menu.',
    npc_menu_open: 'Target selected: confirm Hunt or cancel.',
    picking_destination: interactionState?.targetCharacterId != null
      ? 'Follow preview active: click the same walker again to confirm.'
      : interactionState?.targetNodeId != null
        ? 'Destination preview active: click the same street spot again to confirm.'
        : 'Pick a street node or another walker as the destination target.',
    hunt_picking: interactionState?.targetCharacterId != null
      ? 'Hunt preview active: click the same NPC again to confirm.'
      : 'Pick an NPC target to begin the hunt.',
  };
  const message = messageByMode[mode] ?? messageByMode.idle;

  ctx.save();
  ctx.fillStyle = 'rgba(12, 16, 28, 0.72)';
  ctx.fillRect(16, 16, 560, 30);
  ctx.fillStyle = 'rgba(240, 244, 255, 0.92)';
  ctx.font = '12px "IBM Plex Mono", monospace';
  ctx.fillText(message, 26, 35);
  ctx.restore();
}

function drawInteractionOverlay(ctx, city, characters, interactionState) {
  if (!interactionState) {
    drawInteractionHint(ctx, null);
    return;
  }

  const selectedCharacter = findCharacterById(characters, interactionState.selectedCharacterId);
  const hoveredCharacter = findCharacterById(characters, interactionState.hoveredCharacterId);
  const targetNode = city.intersections.find((node) => node.id === interactionState.targetNodeId);
  const targetCharacter = findCharacterById(characters, interactionState.targetCharacterId);

  drawHoveredCharacter(ctx, hoveredCharacter);
  drawSelectedCharacter(ctx, selectedCharacter);
  drawTargetNode(ctx, targetNode);
  drawTargetCharacter(ctx, selectedCharacter, targetCharacter);

  if (interactionState.mode === 'menu_open' || interactionState.mode === 'npc_menu_open') {
    drawActionMenu(ctx, interactionState);
  }

  drawInteractionHint(ctx, interactionState);
}

function drawNotifications(ctx, characters, notifications = [], now = performance.now()) {
  for (const notification of notifications) {
    if (notification?.type !== 'hunt_success') {
      continue;
    }

    const character = findCharacterById(characters, notification.characterId);
    if (!character) {
      continue;
    }

    const progress = Math.min(
      1,
      Math.max(0, (now - notification.createdAt) / NOTIFICATION_LIFETIME_MS),
    );
    const fade = 1 - progress;
    const offsetY = progress * 8;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 225, 170, ${0.9 * fade})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(character.pos.x, character.pos.y, HUNT_RING_RADIUS + 6 + progress * 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 245, 214, ${fade})`;
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText('Hunt successful!', character.pos.x - 50, character.pos.y - 24 - offsetY);
    ctx.restore();
  }
}

function drawGridHint(ctx, city, characters) {
  ctx.save();
  ctx.fillStyle = 'rgba(232, 238, 255, 0.75)';
  ctx.font = '12px "IBM Plex Mono", monospace';
  ctx.fillText(
    `district grid ${city.meta.rows} x ${city.meta.cols} · streets ${city.meta.totalStreetCount} · buildings ${city.meta.buildingCount} · nodes ${city.intersections.length} · chars ${characters.length}`,
    16,
    city.height - 18,
  );
  ctx.restore();
}

export function renderCity(
  ctx,
  city,
  characters = [],
  interactionState = null,
  notifications = [],
) {
  if (!city) {
    return;
  }

  ctx.clearRect(0, 0, city.width, city.height);

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, city.width, city.height);

  for (const district of city.districts) {
    fillDistrict(ctx, district);
  }

  for (const street of city.streets) {
    drawStreet(ctx, street);
  }

  drawBuildings(ctx, city);
  drawIntersections(ctx, city.intersections);
  drawCharacters(ctx, characters);
  drawHuntRings(ctx, characters);
  drawInteractionOverlay(ctx, city, characters, interactionState);
  for (const district of city.districts) {
    if (district.isPlayerOwned) {
      drawPlayerDistrictBorder(ctx, district);
    }
  }
  drawNotifications(ctx, characters, notifications);
  drawGridHint(ctx, city, characters);
}
