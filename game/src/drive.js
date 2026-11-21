// Arcade driving: acceleration, steering that bites harder at speed, handbrake
// slides, building and car collisions, and the third-person chase camera.
import * as THREE from 'three';
import { CAR, CITY } from './config.js';
import { collideCircle, clampToWorld } from './city.js';

export function updateDriving(state, input, dt) {
  const player = state.player;
  const car = player.car;
  if (player.onFoot || !car) return;
  const fwd = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const back = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  const handbrake = input.keys.has('Space');

  if (fwd) car.speed += CAR.accel * dt;
  else if (back) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    // Rolling resistance.
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));

  // Steering: sharper at low speed, gentle at full speed; reversed when reversing.
  // A (left) raises the heading, D (right) lowers it — that turns the car left/right
  // on screen because the chase camera sits behind it.
  const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 10) * 0.6 + 0.4;
  const grip = handbrake ? 0.45 : 1;
  car.heading += steerInput * CAR.steer * speedFactor * grip * dt * Math.sign(car.speed || 1);

  // Sand slows the car near the beach.
  const onSand = car.pos.x < CITY.beachX + 6;
  const effSpeed = onSand ? car.speed * 0.62 : car.speed;
  car.pos.x += Math.sin(car.heading) * effSpeed * dt;
  car.pos.z += Math.cos(car.heading) * effSpeed * dt;
  state.stats.distanceDriven += Math.abs(effSpeed) * dt;

  // Collisions with buildings: push out and bleed speed (once per knock, so a
  // long scrape does not drain all speed in a single frame).
  const fixed = collideCircle(state, car.pos.x, car.pos.z, CAR.radius);
  car.hitCooldown = Math.max(0, (car.hitCooldown || 0) - dt);
  if ((fixed.x !== car.pos.x || fixed.z !== car.pos.z) && car.hitCooldown <= 0) {
    car.speed *= 0.55;
    car.hitCooldown = 0.4;
    state.camera.shake = Math.max(state.camera.shake, 0.25);
  }
  car.pos.x = fixed.x;
  car.pos.z = fixed.z;
  const clamped = clampToWorld(car.pos.x, car.pos.z);
  if (clamped.x !== car.pos.x || clamped.z !== car.pos.z) car.speed *= 0.4;
  car.pos.x = clamped.x;
  car.pos.z = clamped.z;

  // Soft collisions with other cars: push apart, trade a little speed (once per
  // knock — a sustained push must not drain speed every frame).
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.pos.x - car.pos.x;
    const dz = other.pos.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      car.pos.x -= nx * push;
      car.pos.z -= nz * push;
      if (other.kind === 'traffic') {
        other.pos.x += nx * push;
        other.pos.z += nz * push;
        other.speed *= 0.9;
      }
      if (car.hitCooldown <= 0) {
        car.speed *= 0.75;
        car.hitCooldown = 0.5;
        state.camera.shake = Math.max(state.camera.shake, 0.2);
      }
    }
  }

  car.mesh.rotation.y = car.heading;
  // Body roll and pitch sell the speed.
  car.mesh.rotation.z = -steerInput * Math.min(0.06, Math.abs(car.speed) * 0.002);
  car.mesh.rotation.x = fwd ? -0.02 : back ? 0.02 : 0;
  for (const wheel of car.wheels) wheel.rotation.x += (effSpeed * dt) / 0.36;
  // Front wheels steer visually.
  car.wheels[0].rotation.y = steerInput * 0.4;
  car.wheels[1].rotation.y = steerInput * 0.4;

  // Dante rides inside: keep his position glued to the car.
  player.pos.x = car.pos.x;
  player.pos.z = car.pos.z;
  player.heading = car.heading;
}

// Third-person chase camera: behind the player (or car), smoothed, with a little
// shake on impacts and a closer framing on foot so Dante reads clearly.
export function updateCamera(state, camera, dt, orbitYaw) {
  const player = state.player;
  const driving = !player.onFoot && player.car;
  const target = driving ? player.car : player;
  const heading = driving ? player.car.heading : player.heading;
  // Camera yaw follows the heading, plus the player's mouse-orbit offset.
  const yaw = heading + (orbitYaw || 0);
  const dist = driving ? 9.5 : 5.2;
  const height = driving ? 3.6 : 2.6;
  const backX = target.pos.x - Math.sin(yaw) * dist;
  const backZ = target.pos.z - Math.cos(yaw) * dist;
  const lookX = target.pos.x + Math.sin(yaw) * 6;
  const lookZ = target.pos.z + Math.cos(yaw) * 6;
  const lookY = driving ? 1.4 : 1.5;
  const k = 1 - Math.exp(-dt * 5);
  camera.position.x += (backX - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (backZ - camera.position.z) * k;
  if (state.camera.shake > 0) {
    state.camera.shake = Math.max(0, state.camera.shake - dt * 1.4);
    const s = state.camera.shake;
    camera.position.x += (Math.random() - 0.5) * s * 0.5;
    camera.position.y += (Math.random() - 0.5) * s * 0.4;
  }
  camera.lookAt(lookX, lookY, lookZ);
  return yaw;
}
