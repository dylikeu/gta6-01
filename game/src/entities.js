// The things that live in the city: cars, pedestrians and enemies, and the
// circle-vs-building collision they all share. Pure factories — no game state,
// no drawing, no browser — so the police, the traffic and the world all build
// the same kinds of things the same way.

import { PALETTE } from './config.js';
import { buildingAt, nearestNode, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { pick, range } from './random.js';

const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33a', '#4caf6d', '#e8e8e8', '#2b2b2b', '#c77dff', '#f4a261', '#5ec8d8', '#8a6fb8'];
const CAR_KINDS = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sport', 'sedan', 'taxi'];

let nextCarId = 1;

export function makeCar(random, city, opts = {}) {
  const point = opts.x !== undefined ? { x: opts.x, y: opts.y } : randomRoadPoint(random, city);
  const kind = opts.kind ?? pick(random, CAR_KINDS);
  return {
    id: nextCarId,
    kind,
    x: point.x,
    y: point.y,
    angle: opts.angle ?? (random() * Math.PI * 2),
    speed: 0,
    color: opts.color ?? (kind === 'taxi' ? '#f2c230' : kind === 'police' ? '#ffffff' : pick(random, CAR_COLORS)),
    driver: opts.driver ?? 'traffic',
    health: 100,
    wrecked: false,
    node: opts.node ?? nearestNode(city, point.x, point.y),
    prevNode: -1,
    targetSpeed: 0,
    stuckTimer: 0,
    reverseTimer: 0,
    smokeTimer: 0,
  };
}

export function makePed(random, city, opts = {}) {
  const point = opts.x !== undefined ? { x: opts.x, y: opts.y } : randomSidewalkPoint(random, city);
  return {
    x: point.x,
    y: point.y,
    angle: random() * Math.PI * 2,
    speed: 0,
    shirt: pick(random, PALETTE.pedShirt),
    state: opts.state ?? 'walk',
    dest: opts.dest ?? null,
    fleeTimer: 0,
    dead: false,
    deadTimer: 0,
    kind: opts.kind ?? 'ped',
  };
}

export function makeEnemy(random, city, opts = {}) {
  const point = opts.x !== undefined ? { x: opts.x, y: opts.y } : randomSidewalkPoint(random, city);
  return {
    x: point.x,
    y: point.y,
    angle: 0,
    hp: opts.kind === 'cop' ? 120 : 100,
    kind: opts.kind ?? 'thug',
    shootTimer: range(random, 0.5, 1.5),
    moveTimer: 0,
    dead: false,
  };
}

/** Push a circle out of any building it overlaps; returns the fixed point. */
export function collideCircleBuildings(city, x, y, r) {
  const b = buildingAt(city, x, y, r);
  if (!b) return { x, y, hit: false };
  // Closest point on the building rect to the circle centre.
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  let dx = x - cx;
  let dy = y - cy;
  let d = Math.hypot(dx, dy);
  if (d === 0) {
    // Centre inside the building: push out along the smallest penetration axis.
    const left = x - b.x;
    const right = b.x + b.w - x;
    const top = y - b.y;
    const bottom = b.y + b.h - y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: b.x - r, y, hit: true };
    if (m === right) return { x: b.x + b.w + r, y, hit: true };
    if (m === top) return { x, y: b.y - r, hit: true };
    return { x, y: b.y + b.h + r, hit: true };
  }
  if (d < r) {
    dx /= d;
    dy /= d;
    return { x: cx + dx * r, y: cy + dy * r, hit: true };
  }
  return { x, y, hit: false };
}
