// Combat: Dante's pistol — shooting on foot, muzzle flash, tracer, hit reactions,
// and the enemies missions spawn. Fists are the other slot; they do nothing here.
import * as THREE from 'three';
import { COMBAT } from './config.js';
import { addMoney, damagePlayer } from './state.js';
import { makePerson, animateWalk } from './characters.js';
import { mulberry32, pick } from './random.js';

let tracer = null;
let flash = null;
let flashLight = null;

export function createCombatFx(scene) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
  scene.add(tracer);
  flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }),
  );
  scene.add(flash);
  flashLight = new THREE.PointLight(0xffe9a8, 0, 12, 1.5);
  scene.add(flashLight);
  return { tracer, flash, flashLight };
}

// Spawn an armed enemy (a mission target) near a spot. They stand, aim and shoot.
export function spawnEnemy(scene, state, x, z) {
  const rng = mulberry32(state.seed + state.stats.enemiesDown * 31 + Math.floor(x));
  const person = makePerson({ jacket: 0x5a189a, pants: 0x212529, skin: pick(rng, [0xc68e5f, 0x8d5524]), hair: 0x1d1a16 });
  person.group.position.set(x, 0, z);
  scene.add(person.group);
  const enemy = {
    mesh: person.group, parts: person.parts,
    pos: person.group.position,
    heading: 0, health: 100, alive: true,
    shotTimer: 1 + rng() * 1.5, walkPhase: 0, missionTarget: true,
  };
  state.enemies = state.enemies || [];
  state.enemies.push(enemy);
  return enemy;
}

export function spawnMissionEnemies(scene, state, mission) {
  const spot = mission.spot;
  const rng = mulberry32(state.seed + mission.def.id * 97);
  for (let i = 0; i < mission.target; i += 1) {
    const angle = (i / mission.target) * Math.PI * 2;
    spawnEnemy(scene, state, spot.x + Math.cos(angle) * 8, spot.z + Math.sin(angle) * 8);
  }
}

// Fire the pistol toward the camera aim point. Hits the nearest enemy/ped in a
// cone in front of Dante, or sparks off the world.
export function shootPistol(state, scene, camera) {
  const player = state.player;
  if (player.onFoot === false || player.weapon !== 'pistol') return;
  const now = state.time;
  if (state.lastShot && now - state.lastShot < COMBAT.pistolFireRate) return;
  state.lastShot = now;
  state.stats.shotsFired += 1;
  player.shooting = true;
  if (state.onCrime) state.onCrime('shoot');

  const origin = new THREE.Vector3(player.pos.x, 1.45, player.pos.z);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();
  const end = origin.clone().add(dir.clone().multiplyScalar(COMBAT.pistolRange));

  // Find the nearest hittable target inside a cone around the aim direction.
  let best = null;
  let bestDist = COMBAT.pistolRange;
  const targets = [...(state.enemies || []), ...state.peds];
  for (const t of targets) {
    if (t.alive === false) continue;
    const to = new THREE.Vector3(t.pos.x - origin.x, 0, t.pos.z - origin.z);
    const dist = to.length();
    if (dist > COMBAT.pistolRange || dist < 0.5) continue;
    to.normalize();
    const dot = to.dot(dir);
    if (dot < 0.94) continue; // outside the aim cone
    if (dist < bestDist) { bestDist = dist; best = t; }
  }
  if (best) {
    end.copy(new THREE.Vector3(best.pos.x, 1.2, best.pos.z));
    if (best.missionTarget) {
      best.health -= COMBAT.pistolDamage;
      if (best.health <= 0 && best.alive) {
        best.alive = false;
        best.mesh.rotation.x = -Math.PI / 2; // fall flat
        best.mesh.position.y = 0.3;
        state.stats.enemiesDown += 1;
        const mission = state.missions.active;
        if (mission && mission.def.kind === 'eliminate') mission.count += 1;
        if (state.onCrime) state.onCrime('kill');
      }
    } else {
      // Hitting a civilian: they drop cash and flee, and the cops notice.
      best.panic = 5;
      addMoney(state, 25);
      if (state.onCrime) state.onCrime('kill');
    }
  }
  // Tracer + muzzle flash, both fade in updateCombatFx.
  const positions = tracer.geometry.attributes.position;
  positions.setXYZ(0, origin.x, origin.y, origin.z);
  positions.setXYZ(1, end.x, end.y, end.z);
  positions.needsUpdate = true;
  tracer.material.opacity = 0.9;
  flash.position.copy(origin.clone().add(dir.clone().multiplyScalar(0.8)));
  flash.material.opacity = 0.95;
  flashLight.position.copy(flash.position);
  flashLight.intensity = 40;
  state.camera.shake = Math.max(state.camera.shake, 0.12);
  if (state.onShoot) state.onShoot();
}

export function updateCombatFx(state, dt) {
  if (!tracer) return;
  tracer.material.opacity = Math.max(0, tracer.material.opacity - dt * 6);
  flash.material.opacity = Math.max(0, flash.material.opacity - dt * 8);
  flashLight.intensity = Math.max(0, flashLight.intensity - dt * 320);
  if (state.player.shooting && state.time - (state.lastShot || 0) > 0.25) {
    state.player.shooting = false;
  }
}

// Enemies strafe, keep their distance and shoot back (inaccurately).
export function updateEnemies(state, dt) {
  if (!state.enemies) return;
  const player = state.player;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const dx = player.pos.x - e.pos.x;
    const dz = player.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    e.heading = Math.atan2(dx, dz);
    e.mesh.rotation.y = e.heading;
    if (dist > 14) {
      e.pos.x += Math.sin(e.heading) * 3.2 * dt;
      e.pos.z += Math.cos(e.heading) * 3.2 * dt;
      e.walkPhase += dt * 9;
      animateWalk(e.parts, e.walkPhase, 0.5);
    } else if (dist < 6) {
      e.pos.x -= Math.sin(e.heading) * 2 * dt;
      e.pos.z -= Math.cos(e.heading) * 2 * dt;
    }
    e.shotTimer -= dt;
    if (e.shotTimer <= 0 && dist < 40 && state.screen === 'play') {
      e.shotTimer = 1.1 + Math.random() * 0.9;
      if (Math.random() < 0.4) {
        damagePlayer(state, 6);
      }
    }
  }
}
