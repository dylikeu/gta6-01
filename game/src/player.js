// Dante on foot: WASD movement relative to the camera, sprint, entering and
// leaving cars (stealing a traffic car raises the wanted level), and the aim pose.
import { PLAYER } from './config.js';
import { addWanted } from './state.js';
import { collideCircle, clampToWorld } from './city.js';
import { nearestCar } from './traffic.js';
import { animateIdle, animateWalk } from './characters.js';
import { makeCar, SPORTS_COLORS } from './vehicles.js';

// Spawn Dante's mesh and put him at the start spot.
export function spawnPlayer(scene, state, dante) {
  state.player.mesh = dante.group;
  state.player.parts = dante.parts;
  state.player.gun = dante.gun;
  dante.group.position.set(state.player.pos.x, 0, state.player.pos.z);
  dante.group.rotation.y = state.player.heading;
  scene.add(dante.group);
  return dante;
}

// A fresh drivable car for the player (used at mission starts and free roam).
export function givePlayerCar(scene, state, color, kind = 'player', x = null, z = null, heading = null) {
  const { group, wheels, lightBarL, lightBarR } = makeCar(color, kind);
  const px = x ?? state.player.pos.x + 4;
  const pz = z ?? state.player.pos.z + 2;
  group.position.set(px, 0, pz);
  group.rotation.y = heading ?? state.player.heading;
  scene.add(group);
  const car = {
    mesh: group, wheels, lightBarL, lightBarR, kind,
    pos: group.position, heading: group.rotation.y, speed: 0,
    cruiseSpeed: 0, color, route: null, routeIndex: 0,
  };
  state.cars.push(car);
  return car;
}

export function enterCar(state, car) {
  const player = state.player;
  if (!player.onFoot || !car) return false;
  if (car.kind === 'traffic') {
    // Stealing a stranger's car: the driver flees, the cops notice.
    addWanted(state, 1);
    state.stats.carsStolen += 1;
    if (state.onCrime) state.onCrime('steal');
  }
  player.onFoot = false;
  player.car = car;
  car.kind = 'player';
  car.speed = 0;
  player.mesh.visible = false;
  return true;
}

export function exitCar(state) {
  const player = state.player;
  if (player.onFoot || !player.car) return false;
  const car = player.car;
  player.onFoot = true;
  player.car = null;
  player.mesh.visible = true;
  // Step out to the left of the car.
  const sideX = car.pos.x + Math.cos(car.heading) * -2.2;
  const sideZ = car.pos.z - Math.sin(car.heading) * -2.2;
  player.pos.x = sideX;
  player.pos.z = sideZ;
  player.heading = car.heading;
  player.mesh.position.set(sideX, 0, sideZ);
  player.mesh.rotation.y = car.heading;
  car.speed = 0;
  return true;
}

// Try to enter the nearest car; returns a status string for the prompt line.
export function tryEnterCar(state) {
  const player = state.player;
  const car = nearestCar(state, player.pos.x, player.pos.z, 4.5);
  if (!car) return 'no-car';
  const wasTraffic = car.kind === 'traffic';
  enterCar(state, car);
  return wasTraffic ? 'stolen' : 'entered';
}

export function updatePlayerOnFoot(state, input, dt, cameraYaw) {
  const player = state.player;
  if (!player.onFoot) return;
  const fwd = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0)
    - (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0);
  const strafe = (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0)
    - (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0);
  player.running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = player.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const moving = fwd !== 0 || strafe !== 0;
  player.moving = moving;
  if (moving) {
    // Movement is relative to the camera yaw: W walks away from the camera, D
    // strafes to the screen-right (camera right is (-cos yaw, sin yaw)).
    const moveAngle = cameraYaw + Math.atan2(-strafe, fwd);
    const targetHeading = moveAngle;
    let diff = targetHeading - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += Math.max(-PLAYER.turnSpeed * dt, Math.min(PLAYER.turnSpeed * dt, diff));
    player.pos.x += Math.sin(player.heading) * speed * dt;
    player.pos.z += Math.cos(player.heading) * speed * dt;
    player.walkPhase += speed * dt * 2.6;
  }
  const fixed = collideCircle(state, player.pos.x, player.pos.z, PLAYER.radius);
  player.pos.x = fixed.x;
  player.pos.z = fixed.z;
  const clamped = clampToWorld(player.pos.x, player.pos.z);
  player.pos.x = clamped.x;
  player.pos.z = clamped.z;
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.heading;
  if (moving) animateWalk(player.parts, player.walkPhase, player.running ? 0.7 : 0.5);
  else animateIdle(player.parts, state.time);
  player.gun.visible = player.weapon === 'pistol';
  // Aim pose: face the camera yaw while shooting.
  if (player.shooting) {
    player.mesh.rotation.y = cameraYaw;
    player.parts.armR.rotation.x = -Math.PI / 2 + 0.2;
    player.parts.armL.rotation.x = -Math.PI / 2 + 0.2;
  }
}

export function spawnSportsCarNearby(scene, state) {
  const rng = Math.random;
  const color = SPORTS_COLORS[Math.floor(rng() * SPORTS_COLORS.length)];
  return givePlayerCar(scene, state, color, 'sports',
    state.player.pos.x + 6, state.player.pos.z - 4, state.player.heading + 0.6);
}
