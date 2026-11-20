// City map for VELMARA: five districts, a road grid, buildings, parks,
// the marina, and the props the renderer draws. Generated once per seed.
import { WORLD_W, WORLD_H } from '../core/state.js';
import { makeRng, pick, range, irange } from '../core/math.js';

export const DISTRICTS = [
  { name: 'Sunport Marina', x: 2100, y: 0, w: 1300, h: 700, ground: '#c9b183', accent: '#2e7f9e', label: '#1d5a73' },
  { name: 'Downtown', x: 1100, y: 500, w: 1300, h: 900, ground: '#b8a888', accent: '#8a6fd6', label: '#5a3fa0' },
  { name: 'Coral Row', x: 2100, y: 1300, w: 1300, h: 1300, ground: '#cfa98e', accent: '#e07a5f', label: '#8a3a26' },
  { name: 'Palm Yards', x: 0, y: 0, w: 1100, h: 1100, ground: '#a89a6a', accent: '#5f8a4f', label: '#33511f' },
  { name: 'Old Harbour', x: 0, y: 1100, w: 1100, h: 1500, ground: '#9fb2b8', accent: '#2e6f8e', label: '#174a63' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[1];
}

// Roads run on a 340px grid; avenues are the wider 60px roads.
export const ROAD_STEP = 340;
export const ROAD_W = 56;
export const AVENUE_W = 84;

export function isOnRoad(x, y) {
  const mx = x % ROAD_STEP, my = y % ROAD_STEP;
  return mx < ROAD_W || mx > ROAD_STEP - ROAD_W || my < ROAD_W || my > ROAD_STEP - ROAD_W;
}

export function nearestRoadPoint(x, y) {
  const gx = Math.round(x / ROAD_STEP) * ROAD_STEP;
  const gy = Math.round(y / ROAD_STEP) * ROAD_STEP;
  return { x: gx, y: gy };
}

const BUILDING_COLORS = ['#d8c9a3', '#c9b48a', '#e0d3b2', '#b7a06e', '#d9c49a', '#c2ab7d', '#e6dcc0'];
const ROOF_COLORS = ['#8a5a3b', '#5f7d8a', '#a06a4f', '#6e8a5f', '#7d6a9e', '#b0703f'];

export function buildCity(seed) {
  const rng = makeRng(seed * 31 + 5);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const docks = [];

  // Parks: one per district, green rectangles with trees.
  const parkSpots = [
    { x: 1250, y: 180, w: 320, h: 220 },
    { x: 1500, y: 1000, w: 360, h: 260 },
    { x: 2450, y: 1750, w: 340, h: 260 },
    { x: 250, y: 1350, w: 300, h: 240 },
    { x: 2300, y: 350, w: 380, h: 200 },
  ];
  for (const p of parkSpots) {
    parks.push(p);
    for (let i = 0; i < 14; i++) trees.push({ x: p.x + 20 + rng() * (p.w - 40), y: p.y + 20 + rng() * (p.h - 40), r: 10 + rng() * 8 });
  }

  // Buildings: fill each block between roads, skipping parks and the marina water.
  for (let gx = 0; gx < WORLD_W; gx += ROAD_STEP) {
    for (let gy = 0; gy < WORLD_H; gy += ROAD_STEP) {
      const bx = gx + ROAD_W + 14, by = gy + ROAD_W + 14;
      const bw = ROAD_STEP - ROAD_W * 2 - 28, bh = ROAD_STEP - ROAD_W * 2 - 28;
      if (bw <= 40 || bh <= 40) continue;
      const cx = bx + bw / 2, cy = by + bh / 2;
      if (parks.some(p => cx > p.x - 40 && cx < p.x + p.w + 40 && cy > p.y - 40 && cy < p.y + p.h + 40)) continue;
      if (cx > 2950 && cy < 420) continue; // marina water
      if (rng() < 0.12) { // plaza instead of a building
        for (let i = 0; i < 5; i++) trees.push({ x: bx + rng() * bw, y: by + rng() * bh, r: 9 + rng() * 7 });
        continue;
      }
      const tall = districtAt(cx, cy).name === 'Downtown' && rng() < 0.55;
      buildings.push({
        x: bx + rng() * 20, y: by + rng() * 20,
        w: bw - rng() * 30, h: bh - rng() * 30,
        color: pick(rng, BUILDING_COLORS), roof: pick(rng, ROOF_COLORS),
        tall, floors: tall ? irange(rng, 6, 14) : irange(rng, 1, 3),
        name: tall ? 'Tower' : 'Block',
      });
    }
  }

  // Street trees + lamps along avenues.
  for (let gx = 0; gx <= WORLD_W; gx += ROAD_STEP) {
    for (let gy = 0; gy <= WORLD_H; gy += ROAD_STEP) {
      if (rng() < 0.6) trees.push({ x: gx + 70 + rng() * 30, y: gy + 70, r: 9 + rng() * 6 });
      lamps.push({ x: gx + 8, y: gy + 8 });
    }
  }
  // Marina docks + boats on the north-east water.
  for (let i = 0; i < 6; i++) {
    docks.push({ x: 2980 + i * 52, y: 90 + (i % 2) * 130, w: 34, h: 110, boat: i % 2 === 0 });
  }

  // Landmarks the missions + HUD point at.
  const landmarks = {
    maraSpot: { x: 1700, y: 1190, label: 'Mara — fixer' },
    marinaCasino: { x: 3050, y: 300, label: 'Casino boat' },
    chopShop: { x: 420, y: 420, label: 'Chop shop' },
    harbourDock: { x: 300, y: 1750, label: 'Smugglers dock' },
    dealership: { x: 1500, y: 1700, label: 'Sun Motors' },
    yards: { x: 500, y: 700, label: 'Palm Yards' },
    policeHQ: { x: 1700, y: 850, label: 'VPD HQ' },
  };

  return { buildings, trees, lamps, parks, docks, landmarks, rng };
}

// Simple circle-vs-building collision: push the circle out.
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.001) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r; y = ny + (dy / d) * r;
    } else if (d2 <= 0.001) {
      // Centre inside the building: push out along the smallest axis.
      const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
      const m = Math.min(left, right, top, bot);
      if (m === left) x = b.x - r; else if (m === right) x = b.x + b.w + r;
      else if (m === top) y = b.y - r; else y = b.y + b.h + r;
    }
  }
  return { x: Math.max(20, Math.min(WORLD_W - 20, x)), y: Math.max(20, Math.min(WORLD_H - 20, y)) };
}

export function randomRoadSpot(rng) {
  const gx = irange(rng, 1, 9) * ROAD_STEP;
  const gy = irange(rng, 1, 7) * ROAD_STEP;
  return { x: gx + range(rng, -20, 20), y: gy + range(rng, -20, 20) };
}
