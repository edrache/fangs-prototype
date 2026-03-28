const BACKGROUND_COLOR = '#1a1a2e';
const STREET_FILL = '#6d748f';
const STREET_EDGE = 'rgba(223, 230, 255, 0.06)';
const INTERSECTION_FILL = 'rgba(250, 252, 255, 0.45)';
const CHARACTER_TRAIL_STEPS = 10;
const CHARACTER_RADIUS = 4.8;

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

function fillDistrict(ctx, district) {
  ctx.fillStyle = district.color;
  ctx.globalAlpha = 0.34;
  ctx.fillRect(district.bounds.x, district.bounds.y, district.bounds.w, district.bounds.h);
  ctx.globalAlpha = 1;
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
    ctx.beginPath();
    ctx.arc(character.pos.x, character.pos.y, CHARACTER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.stroke();
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

export function renderCity(ctx, city, characters = []) {
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
  drawGridHint(ctx, city, characters);
}
