// pedestrians.js — the people of Coral Bay: low-poly walkers who stroll the
// sidewalks, cross at the corners, and run when a gun goes off. A few of
// them carry cash Dante can rob, and a few are mission characters.
import * as THREE from 'three';
import { AVENUES, STREETS, WORLD_HALF, clamp, dist2d, mulberry32, pick } from './config.js';

const SKINS = [0x8a5a3b, 0xc98a5a, 0x6b3f2a, 0xe8b98a, 0x4a2c1a];
const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xa8e6cf, 0xff8c42, 0x6c5ce7];
const PANTS = [0x2d3436, 0x636e72, 0x0984e3, 0x6c5ce7, 0xd63031, 0x00b894];

/** Build one low-poly person: head, torso, legs and arms that swing. */
export function createPedestrianMesh(seed = 1) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: pick(rng, SKINS), roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: pick(rng, PANTS), roughness: 0.9 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: pick(rng, [0x1a1a1a, 0x4a2c1a, 0x8a6a3a, 0xd8d8d8]), roughness: 1 }));
  hair.position.y = 1.66;
  group.add(hair);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  const legs = [];
  for (const side of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
    leg.position.set(side, 0.36, 0);
    leg.geometry.translate(0, -0.36, 0);
    leg.position.y = 0.72;
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const side of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
    arm.geometry.translate(0, -0.31, 0);
    arm.position.set(side, 1.38, 0);
    arm.castShadow = true;
    group.add(arm);
    arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

/** Scatter walkers on the sidewalks; a few carry cash worth robbing. */
export function spawnPedestrians(scene, count = 16, seed = 99) {
  const rng = mulberry32(seed);
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = createPedestrianMesh(1000 + i * 17);
    scene.add(mesh);
    const alongAvenue = rng() < 0.5;
    const line = alongAvenue ? AVENUES[Math.floor(rng() * AVENUES.length)] : STREETS[Math.floor(rng() * STREETS.length)];
    const ped = {
      mesh,
      alongAvenue,
      line,
      dir: rng() < 0.5 ? 1 : -1,
      lane: (rng() < 0.5 ? -1 : 1) * 6.8,
      pos: -WORLD_HALF + rng() * WORLD_HALF * 2,
      speed: 1.1 + rng() * 0.9,
      walkPhase: rng() * Math.PI * 2,
      health: 100,
      cash: 15 + Math.floor(rng() * 70),
      robbed: false,
      fleeing: 0,
      fleeX: 0,
      fleeZ: 0,
      alive: true,
      name: pick(rng, ['Beachgoer', 'Tourist', 'Local', 'Skater', 'Vendor', 'Jogger', 'Fisherman', 'Student']),
    };
    peds.push(ped);
  }
  return peds;
}

/** A mission character who waits at a spot until Dante reaches them. */
export function spawnCharacter(scene, x, z, name, color) {
  const mesh = createPedestrianMesh(name.length * 31 + 7);
  mesh.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.parameters && child.geometry.parameters.width === 0.62) {
      child.material = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    }
  });
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { mesh, x, z, name, health: 200, alive: true, isCharacter: true };
}

/** Walk every pedestrian one step along its sidewalk; flee from gunfire. */
export function updatePedestrians(peds, dt, danger = null) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    if (danger && dist2d(ped.mesh.position.x, ped.mesh.position.z, danger.x, danger.z) < 26) {
      ped.fleeing = 2.5;
      ped.fleeX = danger.x;
      ped.fleeZ = danger.z;
    }
    let heading;
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      const dx = ped.mesh.position.x - ped.fleeX;
      const dz = ped.mesh.position.z - ped.fleeZ;
      const d = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
      heading = Math.atan2(dx / d, dz / d);
      ped.mesh.position.x += (dx / d) * 5.2 * dt;
      ped.mesh.position.z += (dz / d) * 5.2 * dt;
    } else {
      ped.pos += ped.speed * ped.dir * dt;
      if (ped.pos > WORLD_HALF) ped.dir = -1;
      if (ped.pos < -WORLD_HALF) ped.dir = 1;
      if (ped.alongAvenue) {
        ped.mesh.position.set(ped.pos, 0, ped.line + ped.lane);
        heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.mesh.position.set(ped.line + ped.lane, 0, ped.pos);
        heading = ped.dir > 0 ? 0 : Math.PI;
      }
    }
    ped.mesh.position.x = clamp(ped.mesh.position.x, -WORLD_HALF, WORLD_HALF);
    ped.mesh.position.z = clamp(ped.mesh.position.z, -WORLD_HALF, WORLD_HALF);
    ped.mesh.rotation.y = heading;
    ped.walkPhase += dt * (ped.fleeing > 0 ? 11 : 6);
    const swing = Math.sin(ped.walkPhase) * 0.55;
    ped.mesh.userData.legs[0].rotation.x = swing;
    ped.mesh.userData.legs[1].rotation.x = -swing;
    ped.mesh.userData.arms[0].rotation.x = -swing * 0.8;
    ped.mesh.userData.arms[1].rotation.x = swing * 0.8;
  }
}

/** The nearest living pedestrian within `radius` of a point, or null. */
export function nearestPedestrian(peds, x, z, radius) {
  let best = null;
  let bestD = radius;
  for (const ped of peds) {
    if (!ped.alive) continue;
    const d = dist2d(ped.mesh.position.x, ped.mesh.position.z, x, z);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}
