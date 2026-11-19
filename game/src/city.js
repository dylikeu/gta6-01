// The city of Solmar, generated once from a seed: the road grid, the blocks between the
// roads with their buildings, the park, the beach, the marina, and the landmarks the story
// uses. It also answers the questions the simulation asks: is this point on a road, inside
// a building, on the sand, and where can a car drive to next.

import { BEACH, CITY, PALETTE, ROADS, WORLD } from './config.js';
import { pick, range, rangeInt, shuffle } from './random.js';

const BLOCK_NAMES = [
  'Calle Verde', 'Avenida Palma', 'Calle Luna', 'Avenida Mar', 'Calle Sol', 'Avenida Norte',
  'Calle Coral', 'Avenida Sur', 'Calle Brisa', 'Avenida Central', 'Calle Arena', 'Calle Faro',
];

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const roadsX = ROADS.lines;
  const roadsY = ROADS.lines;
  const half = ROADS.width / 2;
  const sidewalk = 26;

  // Landmark blocks, keyed by block column/row so the story can find them.
  // The park sits at the city centre; the garage near the west edge; the hospital north;
  // the police HQ east; the pier on the south-east shore.
  const parkBlock = { col: 3, row: 3 };
  const landmarks = {};

  function blockRect(col, row) {
    return {
      x: roadsX[col] + half + sidewalk,
      y: roadsY[row] + half + sidewalk,
      w: roadsX[col + 1] - roadsX[col] - ROADS.width - sidewalk * 2,
      h: roadsY[row + 1] - roadsY[row] - ROADS.width - sidewalk * 2,
    };
  }

  function addBuilding(x, y, w, h, opts = {}) {
    const b = {
      x, y, w, h,
      roof: opts.roof ?? pick(random, PALETTE.buildingRoof),
      height: opts.height ?? rangeInt(random, 1, 4),
      label: opts.label ?? null,
      color: opts.color ?? null,
    };
    buildings.push(b);
    return b;
  }

  for (let col = 0; col < roadsX.length - 1; col += 1) {
    for (let row = 0; row < roadsY.length - 1; row += 1) {
      const rect = blockRect(col, row);
      // The last row is the beach strip: sand, no buildings.
      if (rect.y + rect.h > BEACH.sandY) continue;
      if (col === parkBlock.col && row === parkBlock.row) {
        // Palma Park: lawn, a pond and trees, no buildings.
        for (let i = 0; i < 26; i += 1) {
          trees.push({
            x: range(random, rect.x + 16, rect.x + rect.w - 16),
            y: range(random, rect.y + 16, rect.y + rect.h - 16),
            r: range(random, 9, 15),
          });
        }
        continue;
      }
      const kind = random();
      if (kind < 0.55) {
        // One big building filling most of the block.
        addBuilding(rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16);
      } else if (kind < 0.85) {
        // Two buildings side by side.
        const gap = 14;
        const w2 = (rect.w - gap) / 2;
        addBuilding(rect.x, rect.y, w2, rect.h - 8);
        addBuilding(rect.x + w2 + gap, rect.y + 6, w2, rect.h - 14);
      } else {
        // A row of three shops with a little plaza.
        const w3 = (rect.w - 28) / 3;
        for (let i = 0; i < 3; i += 1) {
          addBuilding(rect.x + i * (w3 + 14), rect.y + 10, w3, rect.h * 0.55);
        }
        for (let i = 0; i < 3; i += 1) {
          trees.push({
            x: rect.x + 24 + i * 90 + range(random, -8, 8),
            y: rect.y + rect.h - 26,
            r: range(random, 8, 12),
          });
        }
      }
    }
  }

  // Landmark buildings, placed on named blocks so missions can point at them.
  function landmark(col, row, label, color) {
    const rect = blockRect(col, row);
    const b = addBuilding(rect.x + 30, rect.y + 30, rect.w - 60, rect.h - 60, { label, color, height: 3 });
    landmarks[label] = { x: b.x + b.w / 2, y: b.y + b.h / 2, building: b };
    return b;
  }
  landmark(0, 3, CITY.garage, '#3f7a5a');
  landmark(3, 0, CITY.hospital, '#e8e8e8');
  landmark(6, 2, CITY.policeHQ, '#3a6fd8');
  landmark(5, 5, CITY.mall, '#d9a441');
  landmark(6, 6, CITY.pier, '#8a6fb8');

  // Palm trees along the beach and a few on the avenues.
  for (let x = 120; x < WORLD.width - 120; x += 90) {
    trees.push({ x: x + range(random, -20, 20), y: BEACH.sandY + 40 + range(random, -8, 8), r: range(random, 10, 14), palm: true });
  }
  for (let i = 0; i < 40; i += 1) {
    trees.push({
      x: pick(random, roadsX) + range(random, -140, 140),
      y: pick(random, roadsY) + half + sidewalk + 6,
      r: range(random, 8, 12),
    });
  }

  // The road graph: intersections are nodes; traffic drives node to node.
  const nodes = [];
  const nodeIndex = new Map();
  for (let xi = 0; xi < roadsX.length; xi += 1) {
    for (let yi = 0; yi < roadsY.length; yi += 1) {
      const key = `${xi},${yi}`;
      nodeIndex.set(key, nodes.length);
      nodes.push({ x: roadsX[xi], y: roadsY[yi], xi, yi });
    }
  }
  function neighbours(node) {
    const out = [];
    if (node.xi > 0) out.push(nodeIndex.get(`${node.xi - 1},${node.yi}`));
    if (node.xi < roadsX.length - 1) out.push(nodeIndex.get(`${node.xi + 1},${node.yi}`));
    if (node.yi > 0) out.push(nodeIndex.get(`${node.xi},${node.yi - 1}`));
    if (node.yi < roadsY.length - 1) out.push(nodeIndex.get(`${node.xi},${node.yi + 1}`));
    return out;
  }

  const streetNames = shuffle(random, [...BLOCK_NAMES]);

  const city = {
    roadsX, roadsY, buildings, trees, landmarks, nodes, nodeIndex,
    park: { ...blockRect(parkBlock.col, parkBlock.row), name: CITY.parkName },
    streetNames,
  };

  return city;
}

/** True when the point is on asphalt (within half a road width of a road line). */
export function isOnRoad(city, x, y) {
  const half = ROADS.width / 2;
  for (const rx of city.roadsX) if (Math.abs(x - rx) <= half) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) <= half) return true;
  return false;
}

/** True when the point is on a sidewalk band beside a road. */
export function isOnSidewalk(city, x, y) {
  const half = ROADS.width / 2;
  const band = half + 26;
  for (const rx of city.roadsX) {
    if (Math.abs(x - rx) <= band && Math.abs(x - rx) > half) return true;
  }
  for (const ry of city.roadsY) {
    if (Math.abs(y - ry) <= band && Math.abs(y - ry) > half) return true;
  }
  return false;
}

/** The building containing the point (with radius margin), or null. */
export function buildingAt(city, x, y, margin = 0) {
  for (const b of city.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

/** A random point on a road, for spawning traffic and parked cars. */
export function randomRoadPoint(random, city) {
  if (random() < 0.5) {
    return { x: pick(random, city.roadsX) + (random() < 0.5 ? -ROADS.lane : ROADS.lane), y: range(random, 120, WORLD.height - 320) };
  }
  return { x: range(random, 120, WORLD.width - 120), y: pick(random, city.roadsY) + (random() < 0.5 ? -ROADS.lane : ROADS.lane) };
}

/** A random point on a sidewalk, for pedestrians. */
export function randomSidewalkPoint(random, city) {
  const vertical = random() < 0.5;
  if (vertical) {
    return {
      x: pick(random, city.roadsX) + (random() < 0.5 ? -1 : 1) * (ROADS.width / 2 + 13),
      y: range(random, 120, BEACH.sandY - 40),
    };
  }
  return {
    x: range(random, 120, WORLD.width - 120),
    y: pick(random, city.roadsY) + (random() < 0.5 ? -1 : 1) * (ROADS.width / 2 + 13),
  };
}

/** The nearest intersection node to a point. */
export function nearestNode(city, x, y) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < city.nodes.length; i += 1) {
    const n = city.nodes[i];
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
