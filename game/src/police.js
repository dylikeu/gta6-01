// The wanted system: stars, police cruisers that chase and ram, the helicopter
// above three stars, busted and escape rules.
import * as THREE from 'three';
import { COMBAT, WANTED } from './config.js';
import { addWanted, damagePlayer, setWanted } from './state.js';
import { makeCar, makeHelicopter } from './vehicles.js';
import { collideCircle } from './city.js';

function spawnPoliceCar(scene, state, nearPlayer) {
  const p = state.player.pos;
  const angle = Math.random() * Math.PI * 2;
  const dist = nearPlayer ? 26 : 55 + Math.random() * 30;
  return placePoliceCar(scene, state, p.x + Math.cos(angle) * dist, p.z + Math.sin(angle) * dist, 0);
}

// A police cruiser at an exact spot (deterministic — used by screenshot staging).
export function placePoliceCar(scene, state, x, z, heading) {
  const { group, wheels, lightBarL, lightBarR } = makeCar(0xffffff, 'police');
  const p = state.player.pos;
  group.position.set(x, 0, z);
  scene.add(group);
  const car = {
    mesh: group, wheels, lightBarL, lightBarR, kind: 'police',
    pos: group.position, heading: heading || Math.atan2(p.x - x, p.z - z),
    speed: 0, cruiseSpeed: 0, color: 0xffffff, route: null, routeIndex: 0,
    sirenPhase: 0, // deterministic: all bars flash in sync from the same phase
    shotTimer: 2, // cops hold fire for 2 s after spawning
  };
  state.cars.push(car);
  state.police.cars.push(car);
  return car;
}

function spawnHelicopter(scene, state) {
  const heli = makeHelicopter();
  const p = state.player.pos;
  heli.group.position.set(p.x + 18, 42, p.z - 24);
  scene.add(heli.group);
  state.police.heli = {
    mesh: heli.group, rotor: heli.rotor, tailRotor: heli.tailRotor,
    spot: heli.spot, cone: heli.cone, beacon: heli.beacon,
    pos: heli.group.position, heading: 0, phase: 0,
  };
  return state.police.heli;
}

function removePoliceCar(scene, state, car) {
  scene.remove(car.mesh);
  state.cars.splice(state.cars.indexOf(car), 1);
  state.police.cars.splice(state.police.cars.indexOf(car), 1);
}

// Called whenever the player commits a crime (steal, shoot, assault).
export function commitCrime(state, kind) {
  if (kind === 'steal') addWanted(state, 1);
  else if (kind === 'shoot') addWanted(state, 1);
  else if (kind === 'kill') addWanted(state, 1);
  state.player.heatTimer = 0;
}

export function updatePolice(scene, state, dt) {
  const player = state.player;
  const wanted = player.wanted;
  const police = state.police;

  // Wanted decays after a quiet stretch with no cops nearby.
  if (wanted > 0) {
    player.heatTimer += dt;
    const nearestCop = police.cars.reduce((best, c) => {
      const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
      return Math.min(best, d);
    }, Infinity);
    if (player.heatTimer > WANTED.decaySeconds && nearestCop > 45) {
      setWanted(state, wanted - 1);
      player.heatTimer = 0;
    }
  }

  // Keep the cruiser count matched to the wanted level.
  const wantCount = wanted === 0 ? 0 : WANTED.policePerStar[wanted];
  police.spawnTimer -= dt;
  if (police.cars.length < wantCount && police.spawnTimer <= 0) {
    spawnPoliceCar(scene, state, police.cars.length === 0);
    police.spawnTimer = 2.5;
  }
  while (police.cars.length > wantCount) {
    removePoliceCar(scene, state, police.cars[police.cars.length - 1]);
  }

  // Helicopter appears at 3 stars and leaves when the heat drops.
  if (wanted >= WANTED.heliAtStars && !police.heli) spawnHelicopter(scene, state);
  if (wanted < WANTED.heliAtStars && police.heli) {
    scene.remove(police.heli.mesh);
    police.heli = null;
  }

  // --- Cruisers chase: steer at the player, ram, flash lights, siren wail.
  for (const car of police.cars) {
    const dx = player.pos.x - car.pos.x;
    const dz = player.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const targetSpeed = dist > 90 ? 30 : dist > 12 ? 26 : 14;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(state, car.pos.x, car.pos.z, 1.6);
    if (fixed.x !== car.pos.x || fixed.z !== car.pos.z) car.speed *= 0.5;
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.36;
    // Flashing light bar, alternating red/blue.
    car.sirenPhase += dt * 6;
    const on = Math.sin(car.sirenPhase) > 0;
    if (car.lightBarL) car.lightBarL.material.emissiveIntensity = on ? 4 : 0.4;
    if (car.lightBarR) car.lightBarR.material.emissiveIntensity = on ? 0.4 : 4;
    // Ram the player's car; on foot, being touched means an arrest timer
    // (but never while a story dialog is open — the player cannot move then).
    if (dist < 3.2) {
      if (player.onFoot && !state.missions.dialog) {
        police.bustedTimer += dt;
        if (police.bustedTimer > WANTED.bustedSeconds && wanted > 0) {
          state.flags.busted = true;
          state.screen = 'busted';
        }
      } else if (player.car) {
        player.car.speed *= 0.86;
        car.speed *= 0.8;
        state.camera.shake = Math.max(state.camera.shake, 0.3);
      }
    }
    // Cops shoot at 2+ stars when close on foot.
    if (wanted >= 2 && player.onFoot && dist < WANTED.shootRange && dist > 4) {
      car.shotTimer = (car.shotTimer || 0) - dt;
      if (car.shotTimer <= 0) {
        car.shotTimer = COMBAT.policeShotInterval + Math.random() * 0.6;
        if (Math.random() < 0.45) damagePlayer(state, COMBAT.policeShotDamage);
        if (state.onPoliceShot) state.onPoliceShot(car);
      }
    }
  }
  if (police.cars.length === 0 || wanted === 0) police.bustedTimer = 0;

  // --- Helicopter: circle above the player, rotors spinning, searchlight locked on.
  const heli = police.heli;
  if (heli) {
    heli.phase += dt;
    const p = player.pos;
    const orbitR = 22;
    const hx = p.x + Math.cos(heli.phase * 0.35) * orbitR;
    const hz = p.z + Math.sin(heli.phase * 0.35) * orbitR;
    heli.pos.x += (hx - heli.pos.x) * Math.min(1, dt * 1.5);
    heli.pos.z += (hz - heli.pos.z) * Math.min(1, dt * 1.5);
    heli.pos.y = 40 + Math.sin(heli.phase * 0.8) * 2.5;
    heli.heading = Math.atan2(p.x - heli.pos.x, p.z - heli.pos.z);
    heli.mesh.rotation.y = heli.heading;
    heli.rotor.rotation.y += dt * 22;
    heli.tailRotor.rotation.x += dt * 30;
    heli.beacon.material.emissiveIntensity = Math.sin(heli.phase * 5) > 0 ? 4 : 0.3;
    // Searchlight tracks the player (the visible cone hangs straight down from
    // the helicopter, its apex at the belly, wide end over the street).
    heli.spot.target.position.set(p.x - heli.pos.x, -heli.pos.y, p.z - heli.pos.z);
  }
}
