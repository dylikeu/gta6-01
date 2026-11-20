// On-foot player movement + entering / exiting cars (VELMARA).
import { WORLD_W, WORLD_H, addCash, showBanner } from '../core/state.js';
import { clamp, dist } from '../core/math.js';
import { collideBuildings } from '../city/map.js';
import { makeCar } from '../city/traffic.js';

const WALK_SPEED = 165;
const SPRINT_SPEED = 255;

export function nearestCar(state, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function updatePlayerOnFoot(state, dt, sfx) {
  const p = state.player, keys = state.keys;
  let mx = 0, my = 0;
  if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) my += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
  p.moving = mx !== 0 || my !== 0;
  p.sprint = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  const speed = p.sprint ? SPRINT_SPEED : WALK_SPEED;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    const fixed = collideBuildings(state.city, nx, ny, 12);
    p.x = fixed.x; p.y = fixed.y;
    // Face the mouse while aiming, else face movement.
    if (state.mouse.down || p.shootCd > 0) {
      const aimX = state.camera.x + (state.mouse.x - 640);
      const aimY = state.camera.y + (state.mouse.y - 400);
      p.angle = Math.atan2(aimY - p.y, aimX - p.x);
    } else p.angle = Math.atan2(my, mx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  // Steal / enter a nearby car — but not while standing at Mara's marker
  // with no mission running (that E press is for starting the mission).
  if (keys['KeyE'] && !state._eHeld) {
    state._eHeld = true;
    const lm = state.city.landmarks.maraSpot;
    const atMara = dist(p.x, p.y, lm.x, lm.y) < 90;
    if (!atMara) {
      const car = nearestCar(state, 64);
      if (car) enterCar(state, car, sfx);
    }
  }
  if (!keys['KeyE']) state._eHeld = false;
}

export function enterCar(state, car, sfx) {
  const p = state.player;
  const stolen = car.kind === 'parked' || car.kind === 'traffic';
  if (car.kind === 'traffic' && car.driver) {
    // Yank the driver out: the driver becomes a fleeing pedestrian.
    state.peds.push({ x: car.x + 30, y: car.y + 20, angle: 0, speed: 40, color: '#e8e0d0', panic: 3, wait: 0, tx: car.x + 120, ty: car.y + 120, scared: true });
    car.driver = false;
  }
  car.kind = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  if (sfx) sfx.door();
  if (stolen) {
    state.stats.carsStolen += 1;
    addWanted(state, 1, 'car stolen');
    showBanner(state, 'CAR JACKED', car.model.name + ' — the VPD is on its way', 2.5);
    if (sfx) sfx.sirenBlip();
  } else {
    showBanner(state, car.model.name, 'Your ride', 1.5);
  }
}

export function exitCar(state, sfx) {
  const p = state.player;
  if (!p.car) return;
  const car = p.car;
  car.kind = car.driver ? 'traffic' : 'parked';
  car.speed = 0;
  const side = Math.cos(p.angle) > 0 ? 1 : -1;
  p.x = car.x + side * 34; p.y = car.y + 26;
  const fixed = collideBuildings(state.city, p.x, p.y, 12);
  p.x = fixed.x; p.y = fixed.y;
  p.car = null;
  p.onFoot = true;
  if (sfx) sfx.door();
}

export function addWanted(state, stars, why) {
  const p = state.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + stars, 0, 5);
  p.heat = 100;
  if (p.wanted > before && why) state.log.push('wanted +' + stars + ' (' + why + ')');
}

export function updateWantedDecay(state, dt) {
  const p = state.player;
  if (p.wanted === 0) return;
  // Heat cools only when no cop can see the player.
  const seen = state.cops.some(c => dist(c.x, c.y, p.x, p.y) < 420) ||
    state.cars.some(c => c.kind === 'police' && dist(c.x, c.y, p.x, p.y) < 460);
  if (!seen) {
    p.heat -= dt * (p.wanted >= 4 ? 4 : 9);
    if (p.heat <= 0) {
      p.wanted -= 1;
      p.heat = p.wanted > 0 ? 100 : 0;
      if (p.wanted === 0) showBanner(state, 'HEAT OFF', 'You slipped away clean', 2);
      else state.log.push('wanted cooled to ' + p.wanted);
    }
  } else {
    p.heat = Math.min(100, p.heat + dt * 2);
  }
}

export function drawPlayer(ctx, state, t) {
  const p = state.player;
  if (!p.onFoot) return;
  const bob = p.moving ? Math.sin(t * 12) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  // Jacket, arms, head — a readable top-down figure.
  ctx.fillStyle = '#e8b93c';
  ctx.beginPath(); ctx.roundRect(-9, -8, 18, 16, 6); ctx.fill();
  ctx.fillStyle = '#2a2118';
  ctx.fillRect(6, -9, 7, 5); ctx.fillRect(6, 4, 7, 5);
  ctx.fillStyle = '#d9a06a';
  ctx.beginPath(); ctx.arc(10, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1d22';
  ctx.beginPath(); ctx.arc(11, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  // Pistol in hand when aiming.
  if (state.mouse.down || p.shootCd > 0) {
    ctx.fillStyle = '#333';
    ctx.fillRect(14, -2, 10, 4);
  }
  ctx.restore();
  // Health ring when hurt.
  if (p.health < 100) {
    ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.health / 100)); ctx.stroke();
  }
}
