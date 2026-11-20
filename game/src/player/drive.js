// player/drive.js — driving: car physics, entering and stealing cars, crashes.
// The player car is a normal traffic car the player has taken over.

import { S, WORLD } from '../core/state.js';
import { clamp, dist } from '../core/math.js';
import { collideWorld } from '../city/map.js';
import { addWanted } from '../police/wanted.js';
import { showNotice } from '../core/state.js';
import { playSfx } from '../audio/sfx.js';

export function nearestCar(maxDist) {
  let best = null;
  let bd = maxDist;
  for (const c of S.cars) {
    if (c === S.car) continue;
    const d = dist(S.player.x, S.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(car) {
  const p = S.player;
  if (!car) return false;
  if (car.type === 'cop') {
    showNotice('That is a police car — stealing it is a terrible idea.');
    return false;
  }
  if (car.driver && !car.parked) {
    // Steal it: the driver bails out and runs.
    car.driver = false;
    S.stats.carsStolen++;
    addWanted(1, 'stole a car');
    spawnFleeingDriver(car);
    playSfx('steal');
    showNotice('Car stolen! +1 wanted star');
  }
  car.parked = false;
  S.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  playSfx('door');
  return true;
}

function spawnFleeingDriver(car) {
  const a = Math.random() * Math.PI * 2;
  S.peds.push({
    x: car.x + Math.cos(a) * 30, y: car.y + Math.sin(a) * 30,
    angle: a, speed: 60, color: '#e67e22', state: 'flee', panic: 4,
    tx: car.x, ty: car.y, debtor: false, name: '',
  });
}

export function exitCar() {
  const p = S.player;
  if (!S.car) return;
  const car = S.car;
  car.speed = 0;
  p.onFoot = true;
  p.x = car.x - Math.sin(car.angle) * 34;
  p.y = car.y + Math.cos(car.angle) * 34;
  p.angle = car.angle;
  S.car = null;
  playSfx('door');
}

export function updateDrive(dt) {
  const car = S.car;
  if (!car) return;
  const k = S.keys;
  const fwd = (k['KeyW'] || k['ArrowUp']) ? 1 : 0;
  const rev = (k['KeyS'] || k['ArrowDown']) ? 1 : 0;
  const left = (k['KeyA'] || k['ArrowLeft']) ? 1 : 0;
  const right = (k['KeyD'] || k['ArrowRight']) ? 1 : 0;
  const brake = k['Space'] ? 1 : 0;

  const accel = fwd ? car.accel : rev ? -car.accel * 0.6 : 0;
  car.speed += accel * dt;
  // Drag and rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (brake) car.speed -= car.speed * 3.2 * dt;
  if (!fwd && !rev) car.speed -= car.speed * 0.35 * dt;
  car.speed = clamp(car.speed, -car.maxSpeed * 0.45, car.maxSpeed);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = clamp(Math.abs(car.speed) / 120, 0.25, 1);
  car.angle += steer * 2.4 * grip * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);
  if (brake && Math.abs(car.speed) > 60) {
    car.angle += steer * 1.1 * dt * Math.sign(car.speed);
    spawnSkid(car);
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideWorld(nx, ny, 20);
  const hitWall = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
  if (hitWall && Math.abs(car.speed) > 90) {
    crashCar(car, Math.abs(car.speed));
  }
  car.x = fixed.x;
  car.y = fixed.y;

  // Collisions with other cars.
  for (const o of S.cars) {
    if (o === car || o.parked) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d > 0 && d < 40) {
      const impact = Math.abs(car.speed) + Math.abs(o.speed);
      const push = (40 - d) / d;
      car.x += (car.x - o.x) * push * 0.5;
      car.y += (car.y - o.y) * push * 0.5;
      if (impact > 140) crashCar(car, impact);
      if (o.axis !== undefined && !o.mission) {
        o.speed = Math.max(0, o.speed - 60);
      }
    }
  }
  // Running over pedestrians is a crime.
  for (const ped of S.peds) {
    if (ped.debtor) continue;
    const d = dist(car.x, car.y, ped.x, ped.y);
    if (d < 26 && Math.abs(car.speed) > 40) {
      ped.state = 'flee'; ped.panic = 3;
      ped.x += (ped.x - car.x) * 0.6;
      ped.y += (ped.y - car.y) * 0.6;
      S.stats.pedsHit++;
      addWanted(1, 'hit a pedestrian');
      showNotice('You hit a pedestrian! +1 wanted star');
      playSfx('thud');
      spawnBlood(ped.x, ped.y);
    }
  }
  // Keep the player glued to the car.
  S.player.x = car.x;
  S.player.y = car.y;
  S.player.angle = car.angle;
  S.player.speed = car.speed;
}

function crashCar(car, impact) {
  const dmg = Math.floor(impact / 22);
  S.player.health -= dmg;
  if (S.shotMode) S.player.health = Math.max(S.player.health, 30);
  else if (S.player.health <= 0) S.player.health = 1;
  S.player.hurtCd = 0.6;
  playSfx('crash');
  spawnSparks(car.x, car.y, 10);
  if (!S.shotMode) car.speed *= 0.4;
}

function spawnSkid(car) {
  if (S.particles.length > 300) return;
  S.particles.push({
    x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18,
    vx: 0, vy: 0, life: 0.5, max: 0.5, color: 'rgba(40,40,40,0.5)', size: 5,
  });
}

export function spawnSparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    S.particles.push({
      x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
      life: 0.4, max: 0.4, color: '#f1c40f', size: 3,
    });
  }
}

export function spawnBlood(x, y) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    S.particles.push({
      x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
      life: 0.5, max: 0.5, color: '#c0392b', size: 4,
    });
  }
}

export function updateParticles(dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const pt = S.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.9; pt.vy *= 0.9;
    if (pt.life <= 0) S.particles.splice(i, 1);
  }
  for (let i = S.floaters.length - 1; i >= 0; i--) {
    const f = S.floaters[i];
    f.life -= dt;
    f.y -= 30 * dt;
    if (f.life <= 0) S.floaters.splice(i, 1);
  }
}

export function addFloater(x, y, text, color) {
  S.floaters.push({ x, y, text, color: color || '#f1c40f', life: 1.4 });
}
