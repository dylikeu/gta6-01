// drive.js — arcade driving: acceleration, braking and reverse, steering
// that bites harder the slower you go, a little drift on the sand, and the
// collisions that crumple a chase into a wall of sparks.
import { CAR, SAND_LINE, clamp } from './config.js';
import { resolveCollisions } from './city.js';
import { spinWheels } from './vehicles.js';

/** Give a car its driving state (speed, steering, heading, health). */
export function makeDrivable(car, x, z, heading) {
  car.speed = 0;
  car.heading = heading;
  car.steerAngle = 0;
  car.health = 100;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading - Math.PI / 2;
  return car;
}

/**
 * Drive one step: W accelerates, S brakes then reverses, A/D steer, and the
 * car slides a little on sand and the beach. Returns a dust amount 0..1.
 */
export function updateDrive(car, input, dt, colliders, trafficCars, onCrash) {
  const up = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const down = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  const handbrake = input.keys.has('Space');

  const onSand = car.mesh.position.z < SAND_LINE + 14;
  const topSpeed = onSand ? CAR.maxSpeed * 0.55 : CAR.maxSpeed;
  if (up) car.speed += CAR.accel * dt * (car.speed < 0 ? 1.6 : 1);
  if (down) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.6 * dt;
  }
  if (!up && !down) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = clamp(car.speed, -CAR.reverseMax, topSpeed);

  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  const steerRate = CAR.steer * clamp(Math.abs(car.speed) / 8, 0.25, 1);
  car.steerAngle += clamp(steerTarget * 0.55 - car.steerAngle, -steerRate * 2.4 * dt, steerRate * 2.4 * dt);
  if (steerTarget === 0) car.steerAngle *= Math.max(0, 1 - 8 * dt);
  car.heading += (car.steerAngle * car.speed * dt) / 2.6;

  const nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
  const pos = { x: nx, z: nz };
  const before = { x: car.mesh.position.x, z: car.mesh.position.z };
  resolveCollisions(pos, 1.9, colliders);
  const hitWall = Math.abs(pos.x - nx) > 0.01 || Math.abs(pos.z - nz) > 0.01;
  if (hitWall && Math.abs(car.speed) > 8) {
    if (onCrash) onCrash(Math.abs(car.speed));
    car.speed *= 0.35;
  }
  car.mesh.position.x = pos.x;
  car.mesh.position.z = pos.z;

  // Bump into traffic cars: a soft shove, a little damage, a lot of noise.
  for (const other of trafficCars || []) {
    if (other === car || other.destroyed) continue;
    const dx = car.mesh.position.x - other.mesh.position.x;
    const dz = car.mesh.position.z - other.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      car.mesh.position.x += (dx / d) * push;
      car.mesh.position.z += (dz / d) * push;
      if (Math.abs(car.speed) > 6 && onCrash) onCrash(Math.abs(car.speed));
      car.speed *= 0.82;
      if (other.speed !== undefined && other.baseSpeed !== undefined) {
        other.pos += (dx / d) * push * 0.4;
      }
    }
  }
  car.mesh.rotation.y = car.heading - Math.PI / 2;
  spinWheels(car, dt);
  const dust = clamp((Math.abs(car.speed) - 14) / 24, 0, 1) * (onSand ? 1 : 0.5);
  return { dust, moved: Math.hypot(car.mesh.position.x - before.x, car.mesh.position.z - before.z) };
}

/** The chase camera target: a point just behind and above the car. */
export function carCameraTarget(car) {
  return {
    x: car.mesh.position.x - Math.sin(car.heading) * 9,
    z: car.mesh.position.z - Math.cos(car.heading) * 9,
    y: 4.2,
    lookX: car.mesh.position.x + Math.sin(car.heading) * 6,
    lookZ: car.mesh.position.z + Math.cos(car.heading) * 6,
    lookY: 1.4,
  };
}

/** The on-foot camera target: behind Dante's shoulders, looking ahead. */
export function playerCameraTarget(player) {
  return {
    x: player.x - Math.sin(player.heading) * 6.5,
    z: player.z - Math.cos(player.heading) * 6.5,
    y: 3.4,
    lookX: player.x + Math.sin(player.heading) * 5,
    lookZ: player.z + Math.cos(player.heading) * 5,
    lookY: 1.5,
  };
}
