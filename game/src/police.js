// police.js — the Coral Bay PD: the wanted level, the patrol cars that
// chase Dante down and ram him, and the police helicopter with its
// searchlight that joins the hunt at three stars and above.
import * as THREE from 'three';
import { WORLD_HALF, clamp, dist2d } from './config.js';
import { createCarMesh } from './vehicles.js';

export const WANTED_LABELS = ['CLEAN', 'SUSPECT', 'WANTED', 'FUGITIVE', 'MOST WANTED', 'CITYWIDE MANHUNT'];

/** The wanted system: stars, heat, and the quiet timer that cools it down. */
export class WantedSystem {
  constructor() {
    this.level = 0;
    this.heat = 0;
    this.quietTimer = 0;
    this.bustedTimer = 0;
  }

  /** A crime adds heat; every 25 heat is another star, capped at 5. */
  addCrime(amount) {
    this.heat = Math.min(125, this.heat + amount);
    this.level = Math.min(5, Math.floor(this.heat / 25));
    this.quietTimer = 0;
  }

  setLevel(level) {
    this.level = clamp(level, 0, 5);
    this.heat = this.level * 25;
    this.quietTimer = 0;
  }

  /** Cool down after a long quiet stretch with no police nearby. */
  update(dt, policeNear) {
    if (this.level === 0) return;
    if (policeNear) {
      this.quietTimer = 0;
      return;
    }
    this.quietTimer += dt;
    if (this.quietTimer > 18) {
      this.heat = Math.max(0, this.heat - dt * 2.2);
      const next = Math.floor(this.heat / 25);
      if (next < this.level) {
        this.level = next;
        this.quietTimer = 0;
      }
    }
  }
}

/** One patrol car: a black-and-white cruiser with a flashing light bar. */
export function spawnPoliceCar(scene, x, z) {
  const mesh = createCarMesh(0xf2f2f2, 1, true);
  // The classic black-and-white: a dark hood and trunk over the white body.
  const black = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5, metalness: 0.3 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.9), black);
  hood.position.set(1.7, 0.9, 0);
  mesh.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.9), black);
  trunk.position.set(-1.75, 0.9, 0);
  mesh.add(trunk);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0x0a2a5e, roughness: 0.5 }));
  door.position.set(0, 0.62, 0.99);
  mesh.add(door);
  const door2 = door.clone();
  door2.position.z = -0.99;
  mesh.add(door2);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    speed: 0,
    heading: 0,
    health: 160,
    stuckTimer: 0,
    alive: true,
    sirenPhase: Math.random() * Math.PI * 2,
  };
}

/** Keep the right number of patrol cars for the wanted level, spawning at the edges. */
export function maintainPolice(scene, police, wanted, playerPos, rng) {
  const wantedCount = wanted === 0 ? 0 : Math.min(1 + wanted, 6);
  while (police.length < wantedCount) {
    const angle = rng() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * 90;
    const z = playerPos.z + Math.sin(angle) * 90;
    police.push(spawnPoliceCar(scene, clamp(x, -WORLD_HALF, WORLD_HALF), clamp(z, -WORLD_HALF, WORLD_HALF)));
  }
  while (police.length > wantedCount) {
    const car = police.pop();
    scene.remove(car.mesh);
  }
}

/** Chase the player: steer toward them, ram them, flash the light bar. */
export function updatePolice(police, dt, playerPos, playerSpeed, colliders, onRam) {
  let nearest = Infinity;
  for (const car of police) {
    if (!car.alive) continue;
    const dx = playerPos.x - car.mesh.position.x;
    const dz = playerPos.z - car.mesh.position.z;
    const d = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
    nearest = Math.min(nearest, d);
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const maxSpeed = 15 + Math.min(9, d * 0.15);
    car.speed = Math.min(maxSpeed, car.speed + 12 * dt);
    if (Math.abs(dh) > 1.9) car.speed = Math.max(4, car.speed - 10 * dt);
    car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    const nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
    const blocked = colliders.some((c) => nx > c.x0 - 1.5 && nx < c.x1 + 1.5 && nz > c.z0 - 1.5 && nz < c.z1 + 1.5);
    if (blocked) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 1.2) {
        car.heading += Math.PI * 0.7;
        car.stuckTimer = 0;
      }
      car.speed *= 0.5;
    } else {
      car.stuckTimer = 0;
      car.mesh.position.x = nx;
      car.mesh.position.z = nz;
    }
    car.mesh.rotation.y = car.heading - Math.PI / 2;
    car.mesh.position.x = clamp(car.mesh.position.x, -WORLD_HALF, WORLD_HALF);
    car.mesh.position.z = clamp(car.mesh.position.z, -WORLD_HALF, WORLD_HALF);
    car.sirenPhase += dt * 9;
    const bar = car.mesh.userData.lightBar;
    if (bar) {
      bar.red.material.emissiveIntensity = Math.sin(car.sirenPhase) > 0 ? 3 : 0.2;
      bar.blue.material.emissiveIntensity = Math.sin(car.sirenPhase) > 0 ? 0.2 : 3;
    }
    for (const wheel of car.mesh.userData.wheels) wheel.children[0].rotation.z -= (car.speed * dt) / 0.38;
    if (d < 3.4 && onRam) onRam(car, d, playerSpeed);
  }
  return nearest;
}

/** Build the police helicopter: body, tail, skids and a spinning rotor. */
export function createHelicopter(scene) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a5e, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.5, 1.9), bodyMat);
  body.castShadow = true;
  group.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.7), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.15, metalness: 0.6 }));
  glass.position.set(2.1, 0.1, 0);
  group.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 0.5), bodyMat);
  tail.position.set(-4, 0.3, 0);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.9), bodyMat);
  fin.position.set(-6, 0.8, 0);
  group.add(fin);
  const rotor = new THREE.Group();
  rotor.position.y = 1.0;
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 9.5), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  group.add(rotor);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -0.8, 0);
  group.add(spot);
  const spotTarget = new THREE.Object3D();
  group.add(spotTarget);
  spot.target = spotTarget;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(7, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = -21;
  group.add(beam);
  group.userData.rotor = rotor;
  group.userData.beam = beam;
  group.userData.spotTarget = spotTarget;
  group.visible = false;
  scene.add(group);
  return { mesh: group, angle: 0, active: false };
}

/** Circle above the player with the searchlight on them while wanted ≥ 3. */
export function updateHelicopter(heli, dt, playerPos, wanted) {
  const want = wanted >= 3;
  heli.active = want;
  heli.mesh.visible = want;
  if (!want) return;
  heli.angle += dt * 0.55;
  const x = playerPos.x + Math.cos(heli.angle) * 26;
  const z = playerPos.z + Math.sin(heli.angle) * 26;
  heli.mesh.position.set(x, 46 + Math.sin(heli.angle * 2) * 2, z);
  heli.mesh.rotation.y = Math.atan2(playerPos.x - x, playerPos.z - z);
  heli.mesh.userData.rotor.rotation.y += dt * 22;
  heli.mesh.userData.spotTarget.position.set(playerPos.x - x, -46, playerPos.z - z);
  heli.mesh.userData.beam.lookAt(playerPos.x, 0, playerPos.z);
  heli.mesh.userData.beam.rotateX(Math.PI / 2);
}
