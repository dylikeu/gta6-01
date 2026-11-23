// player.js — Dante Cruz on foot: the low-poly hero, his walk/run, the
// enter-and-exit-car dance, and the health and armour that decide whether
// a shootout ends WASTED or with a getaway.
import * as THREE from 'three';
import { PLAYER, angleDelta, clamp, dist2d } from './config.js';
import { resolveCollisions } from './city.js';
import { createPedestrianMesh } from './pedestrians.js';

/** Build Dante: a coral-red jacket, dark jeans, a head that turns. */
export function createPlayerMesh() {
  const group = createPedestrianMesh(7);
  group.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.parameters && child.geometry.parameters.width === 0.62) {
      child.material = new THREE.MeshStandardMaterial({ color: 0xe63b2e, roughness: 0.85 });
    }
  });
  // A pistol in his right hand, visible when he is armed.
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.4, metalness: 0.6 }));
  gun.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 }));
  grip.position.set(-0.1, -0.09, 0);
  gun.add(grip);
  gun.position.set(0.4, 1.05, 0.25);
  gun.rotation.y = Math.PI / 2;
  group.add(gun);
  group.userData.gun = gun;
  return group;
}

/** The on-foot state: position, heading, health, armour, speed. */
export function createPlayerState(x, z) {
  return {
    mesh: null,
    x,
    z,
    heading: Math.PI,
    speed: 0,
    health: PLAYER.maxHealth,
    armor: 0,
    inCar: null,
    moving: false,
    walkPhase: 0,
  };
}

/**
 * Move Dante on foot: WASD relative to the camera, SHIFT to sprint, and
 * bump him out of buildings. Returns true while he is actually moving.
 */
export function updatePlayerOnFoot(player, input, cameraHeading, dt, colliders) {
  const forward = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
  const strafe = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
  const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const top = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(forward, strafe);
  player.moving = len > 0;
  if (len > 0) {
    const fx = forward / len;
    const sx = strafe / len;
    const sin = Math.sin(cameraHeading);
    const cos = Math.cos(cameraHeading);
    const mx = (fx * sin - sx * cos) * top;
    const mz = (fx * cos + sx * sin) * top;
    const pos = { x: player.x + mx * dt, z: player.z + mz * dt };
    resolveCollisions(pos, PLAYER.radius, colliders);
    player.x = pos.x;
    player.z = pos.z;
    player.speed = top;
    // Turn smoothly toward where Dante is going, so strafing steers him
    // instead of snapping his facing forty-five degrees a frame.
    const targetHeading = Math.atan2(mx, mz);
    player.heading += clamp(angleDelta(player.heading, targetHeading), -3.5 * dt, 3.5 * dt);
  } else {
    player.speed = 0;
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  player.walkPhase += dt * (player.moving ? (sprint ? 12 : 8) : 0);
  const swing = Math.sin(player.walkPhase) * (player.moving ? 0.6 : 0);
  player.mesh.userData.legs[0].rotation.x = swing;
  player.mesh.userData.legs[1].rotation.x = -swing;
  player.mesh.userData.arms[0].rotation.x = -swing * 0.8;
  player.mesh.userData.arms[1].rotation.x = swing * 0.8;
  return player.moving;
}

/** Damage Dante: armour soaks it first, then health. Returns true if he died. */
export function damagePlayer(player, amount) {
  let left = amount;
  if (player.armor > 0) {
    const soaked = Math.min(player.armor, left);
    player.armor -= soaked;
    left -= soaked;
  }
  player.health -= left;
  return player.health <= 0;
}

/** The nearest car (parked, traffic or police) Dante can climb into. */
export function nearestEnterableCar(cars, x, z, radius = 4) {
  let best = null;
  let bestD = radius;
  for (const car of cars) {
    if (car.destroyed) continue;
    const d = dist2d(car.mesh.position.x, car.mesh.position.z, x, z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Put Dante into a car: hide his mesh and hand the car to the driver. */
export function enterCar(player, car) {
  player.inCar = car;
  player.mesh.visible = false;
  car.driver = player;
  car.stolen = true;
  return car;
}

/** Drop Dante out beside the car, on the side away from traffic. */
export function exitCar(player) {
  const car = player.inCar;
  if (!car) return null;
  player.inCar = null;
  car.driver = null;
  car.speed = 0;
  const side = Math.cos(car.heading) >= 0 ? 1 : -1;
  player.x = car.mesh.position.x + Math.cos(car.heading + Math.PI / 2) * 2.2 * side;
  player.z = car.mesh.position.z - Math.sin(car.heading + Math.PI / 2) * 2.2 * side;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.visible = true;
  return car;
}
