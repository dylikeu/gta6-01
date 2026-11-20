// city/traffic.js — the city's moving life: traffic cars that follow the roads and
// pedestrians who stroll the sidewalks, scatter from danger, and go about their day.

import { S, WORLD } from '../core/state.js';
import { clamp, dist, pick, randInt, randRange, turnToward } from '../core/math.js';
import { ROADS, ROAD_W, collideWorld, randomRoadPoint, randomSidewalkPoint } from './map.js';

export const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8', '#636e72'];
export const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#fd79a8', '#00cec9', '#6c5ce7', '#d63031'];

let carId = 1;

export function makeCar(x, y, type, color) {
  const specs = {
    sedan: { w: 44, h: 22, max: 250, accel: 170 },
    taxi: { w: 44, h: 22, max: 260, accel: 180 },
    sport: { w: 46, h: 22, max: 380, accel: 300 },
    truck: { w: 56, h: 26, max: 190, accel: 120 },
    van: { w: 50, h: 24, max: 210, accel: 140 },
    cop: { w: 46, h: 22, max: 360, accel: 290 },
  };
  const s = specs[type] || specs.sedan;
  return {
    id: carId++, x, y, angle: 0, speed: 0,
    type, color: color || pick(S.rng, CAR_COLORS),
    w: s.w, h: s.h, maxSpeed: s.max, accel: s.accel,
    axis: 'h', dir: 1, lane: 0, driver: true, parked: false,
    mission: false, brake: false, siren: 0, honkCd: 0,
  };
}

export function spawnTraffic(count) {
  S.cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(S.rng);
    const horizontal = Math.abs(p.y - 200) < 1 || S.rng() < 0.5;
    const c = makeCar(p.x, p.y, pick(S.rng, ['sedan', 'sedan', 'taxi', 'truck', 'van', 'sport']));
    const road = horizontal ? p.y : p.x;
    c.axis = horizontal ? 'h' : 'v';
    c.dir = S.rng() < 0.5 ? 1 : -1;
    c.lane = (S.rng() < 0.5 ? -1 : 1) * 16;
    c.angle = horizontal ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    c.speed = randRange(S.rng, 90, 170);
    // Keep traffic off the player's start corner.
    if (dist(c.x, c.y, S.player.x, S.player.y) < 260) { i--; continue; }
    S.cars.push(c);
  }
  // A few parked cars along roadsides for the player to find.
  for (let i = 0; i < 8; i++) {
    const p = randomRoadPoint(S.rng);
    const c = makeCar(p.x + randRange(S.rng, -24, 24), p.y + randRange(S.rng, -24, 24), pick(S.rng, ['sedan', 'sport', 'van']), pick(S.rng, CAR_COLORS));
    c.parked = true;
    c.driver = false;
    c.angle = S.rng() * Math.PI * 2;
    S.cars.push(c);
  }
}

function nearestRoad(v) {
  let best = ROADS[0];
  let bd = Infinity;
  for (const r of ROADS) {
    const d = Math.abs(v - r);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

export function updateTraffic(dt) {
  const p = S.player;
  for (const c of S.cars) {
    if (c.parked || c.mission) continue;
    if (c === S.car) continue; // the player drives this one
    // Slow down for the car ahead on the same road.
    let target = randRange(S.rng, 110, 175);
    for (const o of S.cars) {
      if (o === c || o.parked) continue;
      if (o.axis !== c.axis) continue;
      const along = c.axis === 'h' ? (o.x - c.x) * c.dir : (o.y - c.y) * c.dir;
      const side = c.axis === 'h' ? Math.abs(o.y - c.y) : Math.abs(o.x - c.x);
      if (along > 0 && along < 90 && side < 30) { target = Math.min(target, 40); break; }
    }
    // Fleeing pedestrians make traffic brake too.
    if (p.onFoot && dist(c.x, c.y, p.x, p.y) < 70) target = 30;
    c.speed = clamp(c.speed + (target - c.speed) * dt * 1.5, 0, c.maxSpeed);
    const step = c.speed * dt;
    if (c.axis === 'h') c.x += step * c.dir;
    else c.y += step * c.dir;
    // At an intersection, sometimes turn onto the cross road.
    const along = c.axis === 'h' ? c.x : c.y;
    const cross = nearestRoad(along);
    if (Math.abs(along - cross) < 6 && S.rng() < 0.02) {
      const wasH = c.axis === 'h';
      c.axis = wasH ? 'v' : 'h';
      c.dir = S.rng() < 0.5 ? 1 : -1;
      c.lane = (S.rng() < 0.5 ? -1 : 1) * 16;
      if (wasH) { c.y = cross + c.lane; c.x = clamp(c.x, 60, WORLD - 60); }
      else { c.x = cross + c.lane; c.y = clamp(c.y, 60, WORLD - 60); }
      c.angle = c.axis === 'h' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    // Keep on the road lane and inside the world; bounce at the edge.
    if (c.axis === 'h') {
      c.y += (nearestRoad(c.y) + c.lane - c.y) * dt * 2;
      if (c.x < 80 || c.x > WORLD - 80) { c.dir *= -1; c.angle += Math.PI; c.x = clamp(c.x, 80, WORLD - 80); }
    } else {
      c.x += (nearestRoad(c.x) + c.lane - c.x) * dt * 2;
      if (c.y < 80 || c.y > WORLD - 80) { c.dir *= -1; c.angle += Math.PI; c.y = clamp(c.y, 80, WORLD - 80); }
    }
    // Gentle separation from other cars.
    for (const o of S.cars) {
      if (o === c) continue;
      const d = dist(c.x, c.y, o.x, o.y);
      if (d > 0 && d < 34) {
        const push = (34 - d) / d * 0.5;
        c.x += (c.x - o.x) * push * 0.3;
        c.y += (c.y - o.y) * push * 0.3;
      }
    }
  }
  // Traffic cars nudge out of buildings (they should never be inside one).
  for (const c of S.cars) {
    if (c === S.car) continue;
    const fixed = collideWorld(c.x, c.y, 20);
    c.x = fixed.x; c.y = fixed.y;
  }
}

// ---------- pedestrians ----------

export function spawnPedestrians(count) {
  S.peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPoint(S.rng);
    S.peds.push({
      x: p.x, y: p.y, angle: S.rng() * Math.PI * 2,
      speed: randRange(S.rng, 28, 52),
      color: pick(S.rng, PED_COLORS),
      state: 'walk', panic: 0, tx: p.x, ty: p.y,
      debtor: false, name: '',
    });
  }
}

export function updatePeds(dt) {
  const p = S.player;
  const dangerX = p.onFoot ? p.x : (S.car ? S.car.x : p.x);
  const dangerY = p.onFoot ? p.y : (S.car ? S.car.y : p.y);
  const dangerR = p.onFoot ? 60 : 130;
  for (const ped of S.peds) {
    if (ped.debtor) { ped.panic = 0; continue; } // debtors stand and wait
    const d = dist(ped.x, ped.y, dangerX, dangerY);
    if (d < dangerR || S.bullets.length > 0) {
      ped.state = 'flee';
      ped.panic = 2.5;
    }
    if (ped.panic > 0) ped.panic -= dt;
    if (ped.panic <= 0) ped.state = 'walk';
    const speed = ped.state === 'flee' ? 150 : ped.speed;
    if (ped.state === 'flee') {
      ped.angle = Math.atan2(ped.y - dangerY, ped.x - dangerX);
    } else if (dist(ped.x, ped.y, ped.tx, ped.ty) < 12 || S.rng() < 0.002) {
      const t = randomSidewalkPoint(S.rng);
      ped.tx = t.x; ped.ty = t.y;
      ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    }
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    const fixed = collideWorld(ped.x, ped.y, 10);
    ped.x = fixed.x; ped.y = fixed.y;
    ped.x = clamp(ped.x, 30, WORLD - 30);
    ped.y = clamp(ped.y, 30, WORLD - 30);
  }
}

// ---------- drawing ----------

export function drawCar(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 4, c.w, c.h);
  // Body.
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = '#22303c';
  ctx.beginPath();
  ctx.roundRect(-c.w / 2 + 10, -c.h / 2 + 3, c.w / 2 - 4, c.h - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.75)';
  ctx.fillRect(c.w / 2 - 12, -c.h / 2 + 4, 4, c.h - 8);
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(c.w / 2 - 2, -c.h / 2 + 2, 3, 5);
  ctx.fillRect(c.w / 2 - 2, c.h / 2 - 7, 3, 5);
  // Taxi checker / cop livery.
  if (c.type === 'taxi') {
    ctx.fillStyle = '#111';
    for (let i = 0; i < 5; i++) ctx.fillRect(-c.w / 2 + 6 + i * 7, -2, 4, 4);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-8, -c.h / 2 - 3, 16, 4);
  }
  if (c.type === 'cop') {
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(-c.w / 2 + 4, -c.h / 2, c.w - 8, c.h);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VPD', 0, 3);
    // Flashing light bar.
    const on = Math.floor(S.time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d6bff';
    ctx.beginPath(); ctx.arc(-4, -c.h / 2 - 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#2d6bff' : '#ff2d2d';
    ctx.beginPath(); ctx.arc(4, -c.h / 2 - 1, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(1, 2, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Body.
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(0, -1, 4, 0, Math.PI * 2); ctx.fill();
  // Facing tick.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ped.angle) * 9, Math.sin(ped.angle) * 9);
  ctx.stroke();
  if (ped.debtor) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, -16);
  }
  ctx.restore();
}
