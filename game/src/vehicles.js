// SOLARA round 6 — re-witnessed 23 Nov 2026.
// Role: the car factory and the traffic system on Coral Bay's roads.
// vehicles.js — the cars of Coral Bay: the low-poly car factory every car
// (player, traffic, police) is built from, plus the traffic system that
// drives the city's colourful cars along its avenues and streets.
import * as THREE from 'three';
import { AVENUES, PALETTE, STREETS, WORLD_HALF, clamp, mulberry32, pick } from './config.js';
import { findClearSpot } from './city.js';

const CAR_MODELS = [
  { name: 'Solara GT', body: [4.4, 0.62, 1.9], cabin: [2.2, 0.55, 1.7], sporty: true },
  { name: 'Palm Sedan', body: [4.5, 0.72, 1.95], cabin: [2.4, 0.6, 1.75], sporty: false },
  { name: 'Bay Van', body: [4.8, 1.05, 2.05], cabin: [2.8, 0.7, 1.85], sporty: false },
  { name: 'Coral Coupe', body: [4.1, 0.55, 1.85], cabin: [1.9, 0.5, 1.6], sporty: true },
  { name: 'Beach Buggy', body: [3.9, 0.6, 1.9], cabin: [1.6, 0.5, 1.6], sporty: true },
];

/**
 * Build a low-poly car mesh. `kind` picks the silhouette; `color` the paint.
 * Wheels are kept in userData so the drive code can spin and steer them.
 */
export function createCarMesh(color, kind = 0, police = false) {
  const model = CAR_MODELS[kind % CAR_MODELS.length];
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(...model.body), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(...model.cabin), glass);
  cabin.position.set(model.sporty ? -0.25 : -0.1, model.body[1] + 0.28, 0);
  cabin.castShadow = true;
  group.add(cabin);
  // Bumpers, spoiler and a hood stripe on the sporty ones.
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 1.9), dark);
  bumper.position.set(model.body[0] / 2, 0.42, 0);
  group.add(bumper);
  const bumperBack = bumper.clone();
  bumperBack.position.x = -model.body[0] / 2;
  group.add(bumperBack);
  if (model.sporty) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.8), dark);
    spoiler.position.set(-model.body[0] / 2 + 0.1, 1.05, 0);
    group.add(spoiler);
  }
  // Headlights (warm, glowing at sunset) and red tail lights.
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffdf7a, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xd41a0a, emissiveIntensity: 1.2 });
  for (const side of [-0.62, 0.62]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.34), lightMat);
    head.position.set(model.body[0] / 2 + 0.02, 0.62, side);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.34), tailMat);
    tail.position.set(-model.body[0] / 2 - 0.02, 0.62, side);
    group.add(tail);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.1), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    bar.position.set(-0.1, model.body[1] + 0.62, 0);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.45), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    red.position.set(-0.1, model.body[1] + 0.72, -0.3);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.45), new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.set(-0.1, model.body[1] + 0.72, 0.3);
    group.add(blue);
    group.userData.lightBar = { red, blue };
  }
  // Wheels: dark cylinders that spin with speed and steer at the front.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.38, wz);
    const spinner = new THREE.Group();
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    spinner.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8), hubMat);
    hub.rotation.x = Math.PI / 2;
    spinner.add(hub);
    pivot.add(spinner);
    group.add(pivot);
    wheels.push(pivot);
  }
  group.userData.wheels = wheels;
  group.userData.model = model;
  return group;
}

/** A traffic car: its mesh, its lane, its speed and its steering state. */
export function spawnTraffic(scene, seed = 777) {
  const rng = mulberry32(seed);
  const cars = [];
  for (let i = 0; i < 14; i += 1) {
    const color = pick(rng, PALETTE.car);
    const mesh = createCarMesh(color, Math.floor(rng() * CAR_MODELS.length));
    scene.add(mesh);
    const alongAvenue = rng() < 0.55;
    const line = alongAvenue ? AVENUES[Math.floor(rng() * AVENUES.length)] : STREETS[Math.floor(rng() * STREETS.length)];
    const dir = rng() < 0.5 ? 1 : -1;
    const car = {
      mesh,
      alongAvenue,
      line,
      dir,
      lane: (rng() < 0.5 ? -1 : 1) * 2.4,
      pos: -WORLD_HALF + rng() * WORLD_HALF * 2,
      speed: 8 + rng() * 6,
      baseSpeed: 0,
      brake: 0,
      color,
      name: pick(rng, CAR_MODELS).name,
    };
    car.baseSpeed = car.speed;
    cars.push(car);
  }
  return cars;
}

/** Parked cars the player can steal, placed near mission spots. */
export function spawnParkedCars(scene, seed = 4242, colliders = []) {
  const rng = mulberry32(seed);
  const spots = [
    { x: -88, z: -133, heading: 0 },
    { x: 128, z: -78, heading: Math.PI / 2 },
    { x: -140, z: -145, heading: 0 },
    { x: 78, z: 115, heading: -Math.PI / 2 },
    { x: 22, z: 60, heading: Math.PI },
    { x: -32, z: 60, heading: Math.PI / 2 },
    { x: 150, z: -145, heading: 0 },
    { x: -192, z: 200, heading: Math.PI },
  ];
  const cars = [];
  for (const spot of spots) {
    const clear = findClearSpot(colliders, spot.x, spot.z, 2.5);
    const color = pick(rng, PALETTE.car);
    const mesh = createCarMesh(color, Math.floor(rng() * CAR_MODELS.length));
    mesh.position.set(clear.x, 0, clear.z);
    mesh.rotation.y = spot.heading;
    scene.add(mesh);
    cars.push({
      mesh, color, speed: 0, heading: spot.heading + Math.PI / 2, parked: true,
      name: pick(rng, CAR_MODELS).name, stolen: false,
    });
  }
  return cars;
}

/**
 * Drive every traffic car one step: follow its lane, slow for the car
 * ahead, and wrap around the far edge of the city when it runs out of road.
 */
export function updateTraffic(cars, dt, playerCar) {
  for (const car of cars) {
    let want = car.baseSpeed;
    // Slow down for the car directly ahead in the same lane.
    for (const other of cars) {
      if (other === car || other.alongAvenue !== car.alongAvenue || other.line !== car.line || other.dir !== car.dir) continue;
      const gap = (other.pos - car.pos) * car.dir;
      if (gap > 0 && gap < 11) want = Math.min(want, Math.max(0, (gap - 6) * 0.8));
    }
    if (playerCar) {
      const px = playerCar.mesh.position.x;
      const pz = playerCar.mesh.position.z;
      const cx = car.alongAvenue ? car.pos : car.line;
      const cz = car.alongAvenue ? car.line : car.pos;
      const dx = px - cx;
      const dz = pz - cz;
      const ahead = car.alongAvenue ? dx * car.dir : dz * car.dir;
      const side = car.alongAvenue ? Math.abs(dz - car.lane) : Math.abs(dx - car.lane);
      if (ahead > 0 && ahead < 12 && side < 3.5) want = 0;
    }
    car.speed += clamp(want - car.speed, -14 * dt, 8 * dt);
    car.pos += car.speed * car.dir * dt;
    if (car.pos > WORLD_HALF + 10) car.pos = -WORLD_HALF - 10;
    if (car.pos < -WORLD_HALF - 10) car.pos = WORLD_HALF + 10;
    if (car.alongAvenue) {
      car.mesh.position.set(car.pos, 0, car.line + car.lane);
      car.mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.mesh.position.set(car.line + car.lane, 0, car.pos);
      car.mesh.rotation.y = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    for (const wheel of car.mesh.userData.wheels) wheel.children[0].rotation.z -= (car.speed * dt) / 0.38;
  }
}

/** Spin a car's wheels to match its speed (player and police cars too). */
export function spinWheels(car, dt) {
  const wheels = car.mesh.userData.wheels;
  if (!wheels) return;
  for (const wheel of wheels) wheel.children[0].rotation.z -= (car.speed * dt) / 0.38;
  wheels[0].rotation.y = car.steerAngle || 0;
  wheels[1].rotation.y = car.steerAngle || 0;
}
