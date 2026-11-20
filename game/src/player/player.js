// player/player.js — the player on foot: walking, interacting, health and ranks.
// Driving lives in drive.js, shooting lives in combat.js.

import { S, WORLD, rankFor } from '../core/state.js';
import { clamp, dist } from '../core/math.js';
import { collideWorld } from '../city/map.js';
import { nearestCar, enterCar, exitCar } from './drive.js';
import { interactWithMission } from '../missions/story.js';
import { showNotice } from '../core/state.js';
import { playSfx } from '../audio/sfx.js';

export function updatePlayer(dt) {
  const p = S.player;
  if (p.hurtCd > 0) p.hurtCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.interactCd > 0) p.interactCd -= dt;

  // Slow health regen when no one is shooting at the player.
  if (S.enemies.length === 0 && S.copCars.length === 0 && p.health > 0 && p.health < p.maxHealth) {
    p.health = Math.min(p.maxHealth, p.health + 2.5 * dt);
  }

  if (!p.onFoot) return; // driving is handled by drive.js

  const k = S.keys;
  let dx = 0, dy = 0;
  if (k['KeyW'] || k['ArrowUp']) dy -= 1;
  if (k['KeyS'] || k['ArrowDown']) dy += 1;
  if (k['KeyA'] || k['ArrowLeft']) dx -= 1;
  if (k['KeyD'] || k['ArrowRight']) dx += 1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len; dy /= len;
    p.angle = Math.atan2(dy, dx);
    const fixed = collideWorld(p.x + dx * p.walkSpeed * dt, p.y + dy * p.walkSpeed * dt, 12);
    p.x = fixed.x; p.y = fixed.y;
    p.speed = p.walkSpeed;
  } else {
    p.speed = 0;
  }

  // Aim at the mouse while on foot.
  if (S.mouse.x !== 0 || S.mouse.y !== 0) {
    const wx = S.camera.x + (S.mouse.x - window.innerWidth / 2) / S.camera.zoom;
    const wy = S.camera.y + (S.mouse.y - window.innerHeight / 2) / S.camera.zoom;
    if (dist(p.x, p.y, wx, wy) > 30) p.angle = Math.atan2(wy - p.y, wx - p.x);
  }

  // E: interact — mission first, then enter the nearest car.
  if (k['KeyE'] && p.interactCd <= 0) {
    p.interactCd = 0.35;
    if (!interactWithMission()) {
      const car = nearestCar(64);
      if (car) enterCar(car);
      else {
        const pickup = nearestPickup(56);
        if (pickup) takePickup(pickup);
      }
    }
  }
}

export function nearestPickup(maxDist) {
  let best = null;
  let bd = maxDist;
  for (const pk of S.pickups) {
    const d = dist(S.player.x, S.player.y, pk.x, pk.y);
    if (d < bd) { bd = d; best = pk; }
  }
  return best;
}

export function takePickup(pk) {
  const p = S.player;
  const idx = S.pickups.indexOf(pk);
  if (idx >= 0) S.pickups.splice(idx, 1);
  if (pk.kind === 'cash') {
    p.money += pk.amount;
    p.earned += pk.amount;
    showNotice('Picked up ' + '$' + pk.amount);
    playSfx('coin');
  } else if (pk.kind === 'health') {
    p.health = Math.min(p.maxHealth, p.health + 40);
    showNotice('Health +40');
    playSfx('heal');
  } else if (pk.kind === 'ammo') {
    p.reserve += 24;
    showNotice('Ammo +24');
    playSfx('coin');
  }
}

export function drawPlayer(ctx) {
  const p = S.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(1, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  // Legs animate with walking.
  const walking = p.speed > 10;
  const swing = walking ? Math.sin(S.time * 14) * 4 : 0;
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(p.angle) * 6 + Math.sin(p.angle) * swing, -Math.sin(p.angle) * 6 - Math.cos(p.angle) * swing);
  ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(p.angle) * 6 - Math.sin(p.angle) * swing, -Math.sin(p.angle) * 6 + Math.cos(p.angle) * swing);
  ctx.stroke();
  // Jacket.
  ctx.fillStyle = '#e67e22';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  // Cap.
  ctx.fillStyle = '#1f618d';
  ctx.beginPath(); ctx.arc(0, -1, 5.5, Math.PI, 0); ctx.fill();
  // Gun in hand when aiming.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.angle) * 6, Math.sin(p.angle) * 6);
  ctx.lineTo(Math.cos(p.angle) * 15, Math.sin(p.angle) * 15);
  ctx.stroke();
  ctx.restore();
}

export function currentRank() {
  return rankFor(S.player.earned);
}
