// Traffic cars + pedestrians for VELMARA.
// Cars follow the road grid (right-hand lanes), peds wander the sidewalks.
// Everything here is pure state + update/draw, driven from main.js.
import { ROAD_STEP, ROAD_W, isOnRoad, randomRoadSpot, districtAt } from './map.js';
import { WORLD_W, WORLD_H } from '../core/state.js';
import { clamp, dist, angleDiff, turnToward, pick, range, irange } from '../core/math.js';

export const CAR_MODELS = [
  { name: 'Sunbird', color: '#e8b93c', top: 150, accel: 210, len: 46, w: 22, price: 0 },
  { name: 'Coral GT', color: '#d84a4a', top: 205, accel: 300, len: 48, w: 22, price: 900 },
  { name: 'Harbour Van', color: '#7fa8c9', top: 120, accel: 160, len: 54, w: 24, price: 500 },
  { name: 'Palm Taxi', color: '#f2c230', top: 165, accel: 230, len: 46, w: 22, price: 350 },
  { name: 'Dune Buggy', color: '#7ac74f', top: 175, accel: 260, len: 44, w: 24, price: 650 },
  { name: 'Night Coupe', color: '#5a4fd6', top: 220, accel: 320, len: 47, w: 21, price: 1400 },
  { name: 'Rust Pickup', color: '#a06a3f', top: 140, accel: 190, len: 50, w: 23, price: 250 },
];

const PED_COLORS = ['#e8e0d0', '#d9a06a', '#8a6f5a', '#c9b8e0', '#7fa8c9', '#e07a5f', '#a8d8a0'];

export function makeCar(state, x, y, angle, model, kind) {
  return {
    id: state.cars.length + 1, x, y, angle, speed: 0,
    model: model || pick(state.rng, CAR_MODELS),
    kind: kind || 'traffic', // traffic | parked | player | police | mission
    driver: kind === 'traffic',
    targetAngle: angle, lane: 0, stuck: 0, honk: 0,
    health: 100, siren: false, brakeLight: false,
  };
}

export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i++) {
    const spot = randomRoadSpot(state.rng);
    const horizontal = state.rng() < 0.5;
    const angle = horizontal ? (state.rng() < 0.5 ? 0 : Math.PI) : (state.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(state, spot.x, spot.y, angle, null, 'traffic');
    car.speed = range(state.rng, 55, 95);
    state.cars.push(car);
  }
  // Parked cars along roads for stealing.
  for (let i = 0; i < 14; i++) {
    const spot = randomRoadSpot(state.rng);
    const angle = pick(state.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const car = makeCar(state, spot.x + 34, spot.y + 34, angle, null, 'parked');
    car.driver = false;
    state.cars.push(car);
  }
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i++) {
    const x = range(state.rng, 60, WORLD_W - 60), y = range(state.rng, 60, WORLD_H - 60);
    state.peds.push({
      x, y, angle: state.rng() * Math.PI * 2, speed: range(state.rng, 18, 42),
      color: pick(state.rng, PED_COLORS), panic: 0, wait: range(state.rng, 0, 3),
      tx: x, ty: y, scared: false,
    });
  }
}

function roadAngleAt(x, y) {
  // Snap to the nearest grid line's direction.
  const mx = x % ROAD_STEP, my = y % ROAD_STEP;
  const onV = mx < ROAD_W || mx > ROAD_STEP - ROAD_W;
  const onH = my < ROAD_W || my > ROAD_STEP - ROAD_W;
  if (onV && !onH) return Math.PI / 2;
  if (onH && !onV) return 0;
  if (onV && onH) return Math.PI / 4;
  return null;
}

export function updateTraffic(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.kind === 'player' || car.kind === 'police') continue;
    if (car.kind === 'parked') continue;
    // Traffic: keep to roads, turn at intersections, slow for cars ahead.
    const dir = roadAngleAt(car.x, car.y);
    if (dir === null) {
      // Drifted off road: steer back toward the nearest grid line.
      const gx = Math.round(car.x / ROAD_STEP) * ROAD_STEP;
      const gy = Math.round(car.y / ROAD_STEP) * ROAD_STEP;
      car.targetAngle = Math.atan2(gy - car.y, gx - car.x);
    } else {
      // At an intersection, sometimes turn.
      const atX = Math.abs(car.x % ROAD_STEP) < 30 || Math.abs(car.x % ROAD_STEP - ROAD_STEP) < 30;
      const atY = Math.abs(car.y % ROAD_STEP) < 30 || Math.abs(car.y % ROAD_STEP - ROAD_STEP) < 30;
      if (atX && atY && state.rng() < dt * 0.5) car.targetAngle = pick(state.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      else car.targetAngle = dir;
      // Keep the current heading if it matches the road direction.
      if (Math.abs(angleDiff(car.angle, dir)) < 0.4) car.targetAngle = car.angle;
      if (Math.abs(angleDiff(car.angle, dir + Math.PI)) < 0.4) car.targetAngle = car.angle;
    }
    car.angle = turnToward(car.angle, car.targetAngle, 2.2 * dt);
    // Slow down if another car is close ahead.
    let ahead = false;
    for (const o of state.cars) {
      if (o === car) continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d < 70 && Math.abs(angleDiff(car.angle, Math.atan2(o.y - car.y, o.x - car.x))) < 0.6) { ahead = true; break; }
    }
    const want = ahead ? 0 : 78;
    car.speed += clamp(want - car.speed, -160 * dt, 90 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 30, WORLD_W - 30);
    car.y = clamp(car.y, 30, WORLD_H - 30);
    // Panic: peds near a speeding player car scatter (handled in peds).
    if (p && !p.onFoot && p.car === car) car.speed = 0;
  }
  // Recycle traffic that wandered far from the player.
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    if (dist(car.x, car.y, p.x, p.y) > 1500) {
      const spot = randomRoadSpot(state.rng);
      const near = { x: p.x + (spot.x - p.x) * 0.3, y: p.y + (spot.y - p.y) * 0.3 };
      car.x = clamp(near.x, 60, WORLD_W - 60); car.y = clamp(near.y, 60, WORLD_H - 60);
      car.angle = pick(state.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    }
  }
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    const dPlayer = dist(ped.x, ped.y, p.x, p.y);
    const danger = (dPlayer < 90 && p.speed > 60) || (dPlayer < 60 && !p.onFoot) || state.bullets.some(b => dist(b.x, b.y, ped.x, ped.y) < 70);
    if (danger) { ped.panic = 2.5; ped.scared = true; }
    if (ped.panic > 0) {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = turnToward(ped.angle, away, 6 * dt);
      ped.x += Math.cos(ped.angle) * 95 * dt;
      ped.y += Math.sin(ped.angle) * 95 * dt;
    } else {
      ped.wait -= dt;
      if (ped.wait <= 0) {
        ped.tx = clamp(ped.x + range(state.rng, -260, 260), 50, WORLD_W - 50);
        ped.ty = clamp(ped.y + range(state.rng, -260, 260), 50, WORLD_H - 50);
        ped.wait = range(state.rng, 2, 6);
      }
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d > 12) {
        ped.angle = turnToward(ped.angle, Math.atan2(ped.ty - ped.y, ped.tx - ped.x), 4 * dt);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }
    ped.x = clamp(ped.x, 30, WORLD_W - 30);
    ped.y = clamp(ped.y, 30, WORLD_H - 30);
  }
}

export function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const m = car.model, L = m.len, W = m.w;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  ctx.fillStyle = m.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 7);
  ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.beginPath(); ctx.roundRect(-L * 0.18, -W / 2 + 3, L * 0.3, W - 6, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(L / 2 - 5, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 5, W / 2 - 7, 3, 5);
  if (car.brakeLight) { ctx.fillStyle = '#ff2e2e'; ctx.fillRect(-L / 2, -W / 2 + 2, 4, 5); ctx.fillRect(-L / 2, W / 2 - 7, 4, 5); }
  if (car.kind === 'police') {
    ctx.fillStyle = '#101418'; ctx.fillRect(-L * 0.28, -W / 2, L * 0.16, W);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('VPD', 0, 3);
    const blink = Math.floor(t * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2e2e' : '#2e6bff';
    ctx.beginPath(); ctx.arc(-L * 0.05, -W / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blink ? '#2e6bff' : '#ff2e2e';
    ctx.beginPath(); ctx.arc(-L * 0.05, W / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (car.kind === 'mission') {
    ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 2;
    ctx.strokeRect(-L / 2 - 4, -W / 2 - 4, L + 8, W + 8);
  }
  ctx.restore();
}

export function drawPed(ctx, ped, t) {
  const bob = Math.sin(t * 8 + ped.x) * 1.5;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2118';
  ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
