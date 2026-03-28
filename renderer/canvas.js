const BACKGROUND_COLOR = '#1a1a2e';
const STREET_FILL = '#6d748f';
const STREET_EDGE = 'rgba(223, 230, 255, 0.06)';
const INTERSECTION_FILL = 'rgba(250, 252, 255, 0.45)';

function darkenColor(hex, factor) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const shaded = channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor))));
  return `rgb(${shaded[0]} ${shaded[1]} ${shaded[2]})`;
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

function drawGridHint(ctx, city) {
  ctx.save();
  ctx.fillStyle = 'rgba(232, 238, 255, 0.75)';
  ctx.font = '12px "IBM Plex Mono", monospace';
  ctx.fillText(
    `district grid ${city.meta.rows} x ${city.meta.cols} · streets ${city.meta.totalStreetCount} · buildings ${city.meta.buildingCount} · nodes ${city.intersections.length}`,
    16,
    city.height - 18,
  );
  ctx.restore();
}

export function renderCity(ctx, city) {
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
  drawGridHint(ctx, city);
}
