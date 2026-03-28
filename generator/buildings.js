const BLOCK_PADDING = 8;
const CELL_PADDING = 5;
const MIN_BLOCK_SPAN = 34;
const MIN_BASE_SIZE = 14;
const STREET_CLEARANCE = 2;
const BUILDING_PLACEMENT_ATTEMPTS = 18;
const FALLBACK_SCAN_STEP = 12;
const FALLBACK_CELL_SIZE = MIN_BASE_SIZE + CELL_PADDING * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getParcelSpan(buildingDensity) {
  return Math.round(clamp(64 - buildingDensity * 4, 22, 64));
}

function getMaxBuildingCells(block, buildingDensity) {
  const parcelSpan = getParcelSpan(buildingDensity);
  const cols = Math.max(1, Math.floor(block.w / parcelSpan));
  const rows = Math.max(1, Math.floor(block.h / parcelSpan));
  return cols * rows;
}

function createAxisCuts(start, end) {
  return [start, end];
}

function uniqueSortedCuts(values) {
  return [...values]
    .sort((left, right) => left - right)
    .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > 0.001);
}

function randomRange(min, max, rng) {
  if (max <= min) {
    return min;
  }

  return rng.float(min, max);
}

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function streetToRect(street) {
  const halfWidth = street.width / 2 + STREET_CLEARANCE;

  if (street.type === 'h') {
    return {
      x: street.start,
      y: street.pos - halfWidth,
      w: street.end - street.start,
      h: halfWidth * 2,
    };
  }

  return {
    x: street.pos - halfWidth,
    y: street.start,
    w: halfWidth * 2,
    h: street.end - street.start,
  };
}

function rectHitsStreet(rect, streetRects) {
  return streetRects.some((streetRect) => rectsIntersect(rect, streetRect));
}

function blockIntersectsStreet(block, streetRect) {
  return rectsIntersect(block, streetRect);
}

function getDistrictBuildBounds(district, cityWidth, cityHeight, majorStreetWidth) {
  const leftInset = district.bounds.x <= 0 ? 0 : majorStreetWidth / 2;
  const rightInset = district.bounds.x + district.bounds.w >= cityWidth ? 0 : majorStreetWidth / 2;
  const topInset = district.bounds.y <= 0 ? 0 : majorStreetWidth / 2;
  const bottomInset = district.bounds.y + district.bounds.h >= cityHeight ? 0 : majorStreetWidth / 2;
  const x = district.bounds.x + leftInset + BLOCK_PADDING;
  const y = district.bounds.y + topInset + BLOCK_PADDING;
  const w = district.bounds.w - leftInset - rightInset - BLOCK_PADDING * 2;
  const h = district.bounds.h - topInset - bottomInset - BLOCK_PADDING * 2;

  return { x, y, w, h };
}

function createFallbackCells(district, districtBounds, streetRects) {
  const cells = [];
  const maxX = districtBounds.x + districtBounds.w - FALLBACK_CELL_SIZE;
  const maxY = districtBounds.y + districtBounds.h - FALLBACK_CELL_SIZE;

  if (maxX < districtBounds.x || maxY < districtBounds.y) {
    return cells;
  }

  for (let y = districtBounds.y; y <= maxY; y += FALLBACK_SCAN_STEP) {
    for (let x = districtBounds.x; x <= maxX; x += FALLBACK_SCAN_STEP) {
      const cell = {
        districtId: district.id,
        x,
        y,
        w: FALLBACK_CELL_SIZE,
        h: FALLBACK_CELL_SIZE,
      };

      if (streetRects.some((streetRect) => blockIntersectsStreet(cell, streetRect))) {
        continue;
      }

      cells.push(cell);
    }
  }

  return cells;
}

function createBlocksForDistrict(district, districtBounds, streetRects) {
  if (districtBounds.w < MIN_BLOCK_SPAN || districtBounds.h < MIN_BLOCK_SPAN) {
    return [];
  }

  const xCuts = createAxisCuts(districtBounds.x, districtBounds.x + districtBounds.w);
  const yCuts = createAxisCuts(districtBounds.y, districtBounds.y + districtBounds.h);

  for (const streetRect of streetRects) {
    const overlapX1 = Math.max(districtBounds.x, streetRect.x);
    const overlapX2 = Math.min(districtBounds.x + districtBounds.w, streetRect.x + streetRect.w);
    const overlapY1 = Math.max(districtBounds.y, streetRect.y);
    const overlapY2 = Math.min(districtBounds.y + districtBounds.h, streetRect.y + streetRect.h);

    if (overlapX2 > overlapX1) {
      xCuts.push(overlapX1, overlapX2);
    }

    if (overlapY2 > overlapY1) {
      yCuts.push(overlapY1, overlapY2);
    }
  }

  const sortedXCuts = uniqueSortedCuts(xCuts);
  const sortedYCuts = uniqueSortedCuts(yCuts);
  const blocks = [];

  for (let row = 1; row < sortedYCuts.length; row += 1) {
    for (let col = 1; col < sortedXCuts.length; col += 1) {
      const block = {
        districtId: district.id,
        x: sortedXCuts[col - 1],
        y: sortedYCuts[row - 1],
        w: sortedXCuts[col] - sortedXCuts[col - 1],
        h: sortedYCuts[row] - sortedYCuts[row - 1],
      };

      if (block.w < MIN_BLOCK_SPAN || block.h < MIN_BLOCK_SPAN) {
        continue;
      }

      if (streetRects.some((streetRect) => blockIntersectsStreet(block, streetRect))) {
        continue;
      }

      blocks.push(block);
    }
  }

  return blocks;
}

function shuffle(values, rng) {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function createBaseRectForDensity(cell, buildingDensity, rng) {
  const densityScale = clamp(buildingDensity / 10, 0.1, 1);
  const minCoverage = 0.38 - densityScale * 0.1;
  const maxCoverage = 0.82 - densityScale * 0.16;
  const maxWidth = Math.max(MIN_BASE_SIZE, cell.w - CELL_PADDING * 2);
  const maxHeight = Math.max(MIN_BASE_SIZE, cell.h - CELL_PADDING * 2);
  const width = randomRange(Math.max(MIN_BASE_SIZE, maxWidth * minCoverage), Math.max(MIN_BASE_SIZE, maxWidth * maxCoverage), rng);
  const height = randomRange(Math.max(MIN_BASE_SIZE, maxHeight * minCoverage), Math.max(MIN_BASE_SIZE, maxHeight * maxCoverage), rng);
  const x = randomRange(cell.x + CELL_PADDING, cell.x + cell.w - CELL_PADDING - width, rng);
  const y = randomRange(cell.y + CELL_PADDING, cell.y + cell.h - CELL_PADDING - height, rng);

  return { x, y, w: width, h: height };
}

function createAnnex(base, cell, side, rng) {
  if (side === 'left') {
    const available = base.x - (cell.x + CELL_PADDING);
    if (available < MIN_BASE_SIZE) {
      return null;
    }

    const w = randomRange(MIN_BASE_SIZE, Math.min(available, base.w * 0.7), rng);
    const h = randomRange(Math.max(MIN_BASE_SIZE, base.h * 0.35), Math.max(MIN_BASE_SIZE, base.h * 0.85), rng);
    const y = randomRange(base.y, base.y + base.h - h, rng);
    return { x: base.x - w, y, w, h };
  }

  if (side === 'right') {
    const available = cell.x + cell.w - CELL_PADDING - (base.x + base.w);
    if (available < MIN_BASE_SIZE) {
      return null;
    }

    const w = randomRange(MIN_BASE_SIZE, Math.min(available, base.w * 0.7), rng);
    const h = randomRange(Math.max(MIN_BASE_SIZE, base.h * 0.35), Math.max(MIN_BASE_SIZE, base.h * 0.85), rng);
    const y = randomRange(base.y, base.y + base.h - h, rng);
    return { x: base.x + base.w, y, w, h };
  }

  if (side === 'top') {
    const available = base.y - (cell.y + CELL_PADDING);
    if (available < MIN_BASE_SIZE) {
      return null;
    }

    const h = randomRange(MIN_BASE_SIZE, Math.min(available, base.h * 0.7), rng);
    const w = randomRange(Math.max(MIN_BASE_SIZE, base.w * 0.35), Math.max(MIN_BASE_SIZE, base.w * 0.85), rng);
    const x = randomRange(base.x, base.x + base.w - w, rng);
    return { x, y: base.y - h, w, h };
  }

  const available = cell.y + cell.h - CELL_PADDING - (base.y + base.h);
  if (available < MIN_BASE_SIZE) {
    return null;
  }

  const h = randomRange(MIN_BASE_SIZE, Math.min(available, base.h * 0.7), rng);
  const w = randomRange(Math.max(MIN_BASE_SIZE, base.w * 0.35), Math.max(MIN_BASE_SIZE, base.w * 0.85), rng);
  const x = randomRange(base.x, base.x + base.w - w, rng);
  return { x, y: base.y + base.h, w, h };
}

function createCompoundBuilding(cell, districtId, buildingDensity, rng, streetRects) {
  for (let attempt = 0; attempt < BUILDING_PLACEMENT_ATTEMPTS; attempt += 1) {
    const base = createBaseRectForDensity(cell, buildingDensity, rng);
    if (rectHitsStreet(base, streetRects)) {
      continue;
    }

    const rects = [base];
    const sides = shuffle(['left', 'right', 'top', 'bottom'], rng);

    if (rng.chance(0.4)) {
      const annex = createAnnex(base, cell, sides[0], rng);
      if (annex && !rectHitsStreet(annex, streetRects)) {
        rects.push(annex);
      }
    }

    if (rng.chance(0.15)) {
      const annex = createAnnex(base, cell, sides[1], rng);
      if (annex && !rectHitsStreet(annex, streetRects)) {
        rects.push(annex);
      }
    }

    return {
      districtId,
      rects,
    };
  }

  return null;
}

function createBuildingCells(block, targetCount) {
  const cols = Math.ceil(Math.sqrt(targetCount));
  const rows = Math.ceil(targetCount / cols);
  const cellWidth = block.w / cols;
  const cellHeight = block.h / rows;
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({
        x: block.x + col * cellWidth,
        y: block.y + row * cellHeight,
        w: cellWidth,
        h: cellHeight,
      });
    }
  }

  return cells;
}

function generateBuildingsForBlock(block, buildingDensity, rng, streetRects) {
  const targetCount = getMaxBuildingCells(block, 10);
  const cells = createBuildingCells(block, targetCount);
  const candidateCells = shuffle(
    cells.filter((cell) => cell.w >= FALLBACK_CELL_SIZE && cell.h >= FALLBACK_CELL_SIZE),
    rng,
  );
  const effectiveCells = candidateCells.length > 0 ? candidateCells : [block];
  const desiredBuildings = clamp(
    Math.ceil(effectiveCells.length * clamp(buildingDensity / 10, 0.1, 1)),
    0,
    effectiveCells.length,
  );
  const buildings = [];

  for (const cell of effectiveCells) {
    const building = createCompoundBuilding(cell, block.districtId, buildingDensity, rng, streetRects);
    if (building) {
      buildings.push(building);
    }

    if (buildings.length >= desiredBuildings) {
      break;
    }
  }

  return buildings;
}

export function generateBuildings({
  districts,
  streets,
  buildingDensity,
  width,
  height,
  majorStreetWidth,
  rng,
}) {
  const streetRects = streets.map(streetToRect);
  const buildings = [];

  for (const district of districts) {
    const districtBounds = getDistrictBuildBounds(district, width, height, majorStreetWidth);
    const districtStreetRects = streetRects.filter((streetRect) => blockIntersectsStreet(districtBounds, streetRect));
    const blocks = createBlocksForDistrict(district, districtBounds, districtStreetRects);
    const districtBuildings = blocks.flatMap((block) =>
      generateBuildingsForBlock(
        block,
        buildingDensity,
        rng,
        districtStreetRects.filter((streetRect) => blockIntersectsStreet(block, streetRect)),
      )
    );

    if (districtBuildings.length === 0) {
      const fallbackCells = blocks.length > 0
        ? [...blocks].sort((left, right) => right.w * right.h - left.w * left.h)
        : createFallbackCells(district, districtBounds, districtStreetRects);

      for (const fallbackCell of fallbackCells) {
        const fallbackBuilding = createCompoundBuilding(fallbackCell, district.id, buildingDensity, rng, districtStreetRects);
        if (fallbackBuilding) {
          districtBuildings.push(fallbackBuilding);
          break;
        }
      }
    }

    buildings.push(...districtBuildings);
  }

  return buildings;
}
