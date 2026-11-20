// city/map.js — the layout of Velmara: roads, blocks, buildings, beach and docks.
// Owns the world geometry, building collision, and drawing the ground layer.

import { S, WORLD } from '../core/state.js';
import { clamp, mulberry32, pick, randInt, randRange } from '../core/math.js';

export const ROAD_W = 72; // road width in pixels
export const BLOCK = 400; // road spacing
export const ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];

// Districts by block column/row, for colour and building style.
export function districtAt(bx, by) {
  if (by >= 6) return 'beach'; // southern strip
  if (bx <= 1) return 'docks'; // western strip
  if (bx >= 3 && bx <= 4 && by >= 2 && by <= 4) return 'downtown';
  if (by <= 1) return 'hills';
  return 'residential';
}

const PALETTES = {
  downtown: ['#e8b64c', '#c96f4a', '#7fa8c9', '#9db98a', '#d9a0a0', '#8fa3bf'],
  residential: ['#f2c14e', '#e07a5f', '#81b29a', '#f4a261', '#a8dadc', '#e9c46a'],
  docks: ['#b08968', '#8d99ae', '#6c757d', '#a98467'],
  hills: ['#f4d35e', '#ee964b', '#90be6d', '#f9c74f'],
  beach: ['#f7ede2', '#f2d5a0', '#e8c39e'],
};

export const buildings = []; // {x,y,w,h,color,roof,windows,district,park}
export const trees = []; // {x,y,r}
export const containers = []; // dock crates {x,y,w,h,color}

function blockRect(bx, by) {
  const x0 = ROADS[bx] + ROAD_W / 2 + 14;
  const y0 = ROADS[by] + ROAD_W / 2 + 14;
  const x1 = ROADS[bx + 1] - ROAD_W / 2 - 14;
  const y1 = ROADS[by + 1] - ROAD_W / 2 - 14;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function buildCity(seed) {
  buildings.length = 0;
  trees.length = 0;
  containers.length = 0;
  const rng = mulberry32(seed * 7919 + 13);
  // 7x7 blocks between the 8 roads; the last row/col is the beach strip.
  for (let by = 0; by < 7; by++) {
    for (let bx = 0; bx < 7; bx++) {
      const d = districtAt(bx, by);
      const r = blockRect(bx, by);
      if (d === 'beach') {
        // Sand strip with palms, no buildings.
        for (let i = 0; i < 5; i++) {
          trees.push({ x: r.x + rng() * r.w, y: r.y + rng() * r.h * 0.6, r: 13 + rng() * 5 });
        }
        continue;
      }
      if (d === 'docks' && by >= 3) {
        // Container yard: crates instead of buildings.
        for (let i = 0; i < 6; i++) {
          containers.push({
            x: r.x + rng() * (r.w - 90), y: r.y + rng() * (r.h - 50),
            w: 70 + rng() * 40, h: 34 + rng() * 16,
            color: pick(rng, ['#e07a5f', '#2a9d8f', '#e9c46a', '#457b9d', '#f4a261']),
          });
        }
        continue;
      }
      // Park blocks: every 5th-ish block is green.
      if ((bx * 7 + by) % 11 === 4) {
        for (let i = 0; i < 7; i++) {
          trees.push({ x: r.x + rng() * r.w, y: r.y + rng() * r.h, r: 12 + rng() * 6 });
        }
        buildings.push({ x: r.x, y: r.y, w: r.w, h: r.h, park: true, district: d, color: '#8fce7a', roof: '', windows: 0 });
        continue;
      }
      const n = d === 'downtown' ? 1 : randInt(rng, 1, 2);
      const pal = PALETTES[d];
      for (let i = 0; i < n; i++) {
        const bw = n === 1 ? r.w * randRange(rng, 0.55, 0.85) : r.w * 0.42;
        const bh = n === 1 ? r.h * randRange(rng, 0.55, 0.85) : r.h * 0.42;
        const bx0 = r.x + (n === 1 ? (r.w - bw) / 2 : (i === 0 ? 6 : r.w - bw - 6));
        const by0 = r.y + (n === 1 ? (r.h - bh) / 2 : (i === 0 ? 6 : r.h - bh - 6));
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          color: pick(rng, pal),
          roof: pick(rng, ['#5a4a3a', '#3d5a80', '#6d6875', '#7f4f24']),
          windows: d === 'downtown' ? 5 : 3,
          district: d, park: false,
        });
      }
      // Street trees on residential/hills blocks.
      if (d === 'residential' || d === 'hills') {
        for (let i = 0; i < 3; i++) {
          trees.push({ x: r.x + rng() * r.w, y: r.y + rng() * r.h, r: 11 + rng() * 4 });
        }
      }
    }
  }
}

export function isRoad(x, y) {
  for (const r of ROADS) {
    if (Math.abs(x - r) < ROAD_W / 2 + 6) return true;
    if (Math.abs(y - r) < ROAD_W / 2 + 6) return true;
  }
  return false;
}

export function nearestRoadCoord(v) {
  let best = ROADS[0];
  let bd = Infinity;
  for (const r of ROADS) {
    const d = Math.abs(v - r);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

// Push a circle out of every solid it overlaps (buildings + containers).
export function collideWorld(x, y, r) {
  for (const b of buildings) {
    if (b.park) continue;
    if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 === 0) { y = b.y - r; continue; }
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    x += dx * push; y += dy * push;
  }
  for (const c of containers) {
    if (x + r < c.x || x - r > c.x + c.w || y + r < c.y || y - r > c.y + c.h) continue;
    const cx = clamp(x, c.x, c.x + c.w);
    const cy = clamp(y, c.y, c.y + c.h);
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 === 0) { y = c.y - r; continue; }
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    x += dx * push; y += dy * push;
  }
  x = clamp(x, 24, WORLD - 24);
  y = clamp(y, 24, WORLD - 24);
  return { x, y };
}

export function randomRoadPoint(rng) {
  const road = pick(rng, ROADS);
  const along = randRange(rng, 120, WORLD - 120);
  return Math.random() < 0.5 && rng ? { x: along, y: road } : { x: road, y: along };
}

export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  return { x: clamp(p.x + randRange(rng, -70, 70), 40, WORLD - 40), y: clamp(p.y + randRange(rng, -70, 70), 40, WORLD - 40) };
}

// ---------- drawing ----------

export function drawCity(ctx, cam, vw, vh) {
  const vx0 = cam.x - vw / 2 / cam.zoom - 100;
  const vy0 = cam.y - vh / 2 / cam.zoom - 100;
  const vx1 = cam.x + vw / 2 / cam.zoom + 100;
  const vy1 = cam.y + vh / 2 / cam.zoom + 100;
  // Beyond the city's edge there is only the sea.
  ctx.fillStyle = '#2e86c1';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  const x0 = Math.max(0, cam.x - vw / 2 / cam.zoom - 80);
  const y0 = Math.max(0, cam.y - vh / 2 / cam.zoom - 80);
  const x1 = Math.min(WORLD, cam.x + vw / 2 / cam.zoom + 80);
  const y1 = Math.min(WORLD, cam.y + vh / 2 / cam.zoom + 80);

  // Ground: warm sunlit grass base.
  ctx.fillStyle = '#a8c686';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Beach sand along the south, then the sea.
  ctx.fillStyle = '#f2d5a0';
  ctx.fillRect(x0, 2900, x1 - x0, 300);
  ctx.fillStyle = '#2e86c1';
  ctx.fillRect(x0, 3060, x1 - x0, WORLD - 3060);
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const wy = 3068 + i * 26 + Math.sin(S.time * 1.2 + i * 2.1) * 4;
    ctx.beginPath();
    ctx.moveTo(x0, wy);
    for (let x = x0; x <= x1; x += 60) ctx.lineTo(x, wy + Math.sin(x * 0.02 + S.time + i) * 3);
    ctx.stroke();
  }
  // Marina pier on the west beach.
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(120, 2920, 220, 16);

  // Roads: dark asphalt with pale sidewalks.
  for (const r of ROADS) {
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(x0, r - ROAD_W / 2 - 8, x1 - x0, ROAD_W + 16);
    ctx.fillRect(r - ROAD_W / 2 - 8, y0, ROAD_W + 16, y1 - y0);
    ctx.fillStyle = '#5d6d7e';
    ctx.fillRect(x0, r - ROAD_W / 2, x1 - x0, ROAD_W);
    ctx.fillRect(r - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  }
  // Dashed centre lines.
  ctx.fillStyle = '#f7dc6f';
  for (const r of ROADS) {
    for (let x = 0; x < WORLD; x += 64) {
      if (x > x0 - 64 && x < x1) ctx.fillRect(x, r - 2, 30, 4);
      if (x > y0 - 64 && x < y1) ctx.fillRect(r - 2, x, 4, 30);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of ROADS) {
    for (const ry of ROADS) {
      if (rx < x0 - 80 || rx > x1 + 80 || ry < y0 - 80 || ry > y1 + 80) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rx + i * 10 - 3, ry - ROAD_W / 2 + 4, 6, 12);
        ctx.fillRect(rx + i * 10 - 3, ry + ROAD_W / 2 - 16, 6, 12);
      }
    }
  }

  // Buildings with a soft drop shadow, roof colour and window grid.
  for (const b of buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    if (b.park) {
      ctx.fillStyle = '#7cc46a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 10 + i * ((b.w - 20) / cols), b.y + 10 + j * ((b.h - 20) / rows), 9, 9);
      }
    }
  }
  // Dock containers.
  for (const c of containers) {
    if (c.x + c.w < x0 || c.x > x1 || c.y + c.h < y0 || c.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 4; i++) ctx.fillRect(c.x + 6 + i * (c.w - 12) / 4, c.y + 4, 2, c.h - 8);
  }
  // Trees: canopy + trunk shadow.
  for (const t of trees) {
    if (t.x < x0 - 30 || t.x > x1 + 30 || t.y < y0 - 30 || t.y > y1 + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e8b57';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7ee081';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  // District labels painted on the ground.
  ctx.fillStyle = 'rgba(60,60,60,0.5)';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOWNTOWN', 1600, 1240);
  ctx.fillText('THE DOCKS', 420, 1700);
  ctx.fillText('SUNSET BEACH', 1600, 2980);
  ctx.fillText('PALM HILLS', 1600, 420);
}
