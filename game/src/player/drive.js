// Driving physics for VELMARA: arcade car handling with drift, braking,
// building collision (slide + damage), and traffic-car bumps.
import { clamp, dist } from '../core/math.js';
import { collideBuildings, isOnRoad } from '../city/map.js';
import { addParticles } from '../core/state.js';

export function updateDriving(state, dt, sfx) {
  const p = state.player, car = p.car;
  if (!car) return;
  const keys = state.keys;
  const fwd = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
  const back = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
  const steerL = (keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0;
  const steerR = (keys['KeyD'] || keys['ArrowRight']) ? 1 : 0;
  const handbrake = !!(keys['Space']);
  const model = car.model;

  // Acceleration: stronger on roads, sluggish off-road.
  const offRoad = !isOnRoad(car.x, car.y);
  const grip = offRoad ? 0.55 : 1;
  if (fwd) car.speed += model.accel * grip * dt;
  if (back) car.speed -= (car.speed > 8 ? model.accel * 1.4 : model.accel * 0.6) * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 520 * dt);
  car.speed = clamp(car.speed, -70, model.top);
  car.brakeLight = back || handbrake;

  // Steering scales with speed; reverse flips it.
  const steer = steerR - steerL;
  const steerPower = 2.4 * clamp(Math.abs(car.speed) / 90, 0.25, 1) * (handbrake ? 1.5 : 1);
  car.angle += steer * steerPower * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  const fixed = collideBuildings(state.city, nx, ny, 20);
  const hitWall = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
  car.x = fixed.x; car.y = fixed.y;
  if (hitWall && Math.abs(car.speed) > 60) {
    car.health -= Math.abs(car.speed) * 0.12;
    addParticles(state, car.x, car.y, '#ffb347', 10, 160);
    if (sfx) sfx.crash();
    car.speed *= 0.35;
  } else if (hitWall) {
    car.speed *= 0.6;
  }
  // Bump traffic cars.
  for (const o of state.cars) {
    if (o === car || o.kind === 'police') continue;
    if (dist(car.x, car.y, o.x, o.y) < 46) {
      const push = Math.atan2(o.y - car.y, o.x - car.x);
      o.x += Math.cos(push) * 26 * dt * 10; o.y += Math.sin(push) * 26 * dt * 10;
      if (Math.abs(car.speed) > 80) {
        o.speed = 0; o.kind = 'parked'; o.driver = false;
        if (sfx) sfx.crash();
        addParticles(state, o.x, o.y, '#ffd94a', 8, 140);
      }
      car.speed *= 0.92;
    }
  }
  // Skid marks + smoke when drifting hard.
  if (handbrake && Math.abs(car.speed) > 90) {
    addParticles(state, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, '#cfc8b8', 1, 20);
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
  p.moving = Math.abs(car.speed) > 5;
  if (car.health <= 0) {
    addParticles(state, car.x, car.y, '#ff7d2e', 26, 220);
    addParticles(state, car.x, car.y, '#333', 14, 120);
    if (sfx) sfx.explosion();
    car.kind = 'parked'; car.speed = 0; car.health = 100;
    // Player is thrown out of the wreck.
    p.car = null; p.onFoot = true; p.health = Math.max(20, p.health - 25);
    p.x = car.x + 40; p.y = car.y + 40;
    state.log.push('car wrecked');
  }
}

export function carSpeedKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.9);
}
