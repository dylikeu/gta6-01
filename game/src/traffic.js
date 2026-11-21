// Traffic cars looping the blocks and pedestrians strolling the sidewalks — the
// city feeling alive whether or not the player is looking at it.
import * as THREE from 'three';
import { CITY } from './config.js';
import { mulberry32, range, rangeInt } from './random.js';
import { blockLoopRoute, spawnTrafficCar } from './vehicles.js';
import { animateWalk, makePedestrian } from './characters.js';
import { collideCircle } from './city.js';

const TRAFFIC_COUNT = 12;
const PED_COUNT = 18;

function roadCoord(rng) {
  // A coordinate on a road line (grid lines every block+road).
  const lines = [];
  for (let c = -CITY.halfSize; c <= CITY.halfSize; c += CITY.block + CITY.road) lines.push(c);
  return lines[rangeInt(rng, 0, lines.length - 1)];
}

export function createTraffic(scene, state) {
  const rng = mulberry32(state.seed + 101);
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const cx = roadCoord(rng);
    const cz = roadCoord(rng);
    const car = spawnTrafficCar(scene, rng, cx + range(rng, -4, 4), cz + range(rng, -4, 4), rng() * Math.PI * 2);
    car.route = blockLoopRoute(cx, cz, 26);
    car.routeIndex = rangeInt(rng, 0, 3);
    state.cars.push(car);
  }
  for (let i = 0; i < PED_COUNT; i += 1) {
    const person = makePedestrian(rng);
    const x = range(rng, -CITY.halfSize, CITY.halfSize);
    const z = range(rng, -CITY.halfSize, CITY.halfSize);
    person.group.position.set(x, 0, z);
    person.group.rotation.y = rng() * Math.PI * 2;
    scene.add(person.group);
    state.peds.push({
      mesh: person.group, parts: person.parts,
      pos: person.group.position,
      heading: person.group.rotation.y,
      speed: range(rng, 0.8, 1.6),
      walkPhase: rng() * 6,
      panic: 0,
      targetHeading: person.group.rotation.y,
      retargetTimer: range(rng, 2, 8),
    });
  }
}

function steerToward(car, target, dt) {
  const dx = target.x - car.pos.x;
  const dz = target.z - car.pos.z;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  return Math.hypot(dx, dz);
}

export function updateTraffic(state, dt) {
  // --- Cars follow their block loops; they slow for the car ahead.
  for (const car of state.cars) {
    if (car.kind === 'police' || car.kind === 'player') continue;
    if (!car.route) continue;
    const target = car.route[car.routeIndex];
    const dist = steerToward(car, target, dt);
    if (dist < 3) car.routeIndex = (car.routeIndex + 1) % car.route.length;
    let wantSpeed = car.cruiseSpeed;
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 8 && side < 2.5) { wantSpeed = 0; break; }
    }
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(state, car.pos.x, car.pos.z, 1.6);
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.36;
  }

  // --- Pedestrians stroll, turn at random, and flee from gunfire or speeding cars.
  const player = state.player;
  for (const ped of state.peds) {
    ped.retargetTimer -= dt;
    const dxP = player.pos.x - ped.pos.x;
    const dzP = player.pos.z - ped.pos.z;
    const distP = Math.hypot(dxP, dzP);
    if (ped.panic > 0) ped.panic -= dt;
    if (player.shooting && distP < 25) ped.panic = 3;
    if (!player.onFoot && player.car && distP < 6 && player.car.speed > 8) ped.panic = 2.5;
    if (ped.panic > 0) {
      // Run away from the player.
      ped.targetHeading = Math.atan2(-dxP, -dzP);
    } else if (ped.retargetTimer <= 0) {
      ped.targetHeading = ped.heading + (state.rng() - 0.5) * 2.2;
      ped.retargetTimer = 3 + state.rng() * 6;
    }
    let diff = ped.targetHeading - ped.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.heading += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
    const speed = ped.panic > 0 ? ped.speed * 3.2 : ped.speed;
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    const fixed = collideCircle(state, ped.pos.x, ped.pos.z, 0.5);
    ped.pos.x = fixed.x;
    ped.pos.z = fixed.z;
    if (ped.pos.x > CITY.maxCoord - 2 || ped.pos.x < -CITY.halfSize - 10 || Math.abs(ped.pos.z) > CITY.maxCoord - 2) {
      ped.targetHeading = ped.heading + Math.PI;
    }
    ped.mesh.rotation.y = ped.heading;
    ped.walkPhase += speed * dt * 3.4;
    animateWalk(ped.parts, ped.walkPhase, ped.panic > 0 ? 0.75 : 0.45);
  }
}

// A pedestrian near a point, for carjacking / robbery interactions.
export function nearestPed(state, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of state.peds) {
    const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}

// Nearest drivable car that is not the player's current one.
export function nearestCar(state, x, z, maxDist, exclude = null) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car === exclude) continue;
    const d = Math.hypot(car.pos.x - x, car.pos.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
