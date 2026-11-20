// Pistol combat for VELMARA: aim with the mouse, click to shoot,
// bullets, muzzle flash, hit feedback, reload, and enemy return fire.
import { dist, clamp } from '../core/math.js';
import { addParticles } from '../core/state.js';
import { addWanted } from './player.js';
import { hitRival } from '../missions/story.js';

const BULLET_SPEED = 620;
const BULLET_RANGE = 520;

export function updateCombat(state, dt, sfx) {
  const p = state.player;
  if (p.shootCd > 0) p.shootCd -= dt;
  // Aim point in world coordinates.
  const aimX = state.camera.x + (state.mouse.x - 640);
  const aimY = state.camera.y + (state.mouse.y - 400);
  state.aim = { x: aimX, y: aimY };
  // Fire on click (or held mouse with a fire-rate cap).
  if (state.mouse.down && p.onFoot && p.shootCd <= 0) {
    if (p.ammo > 0) {
      p.ammo -= 1;
      p.shootCd = 0.22;
      state.stats.shotsFired += 1;
      const a = Math.atan2(aimY - p.y, aimX - p.x) + (state.rng() - 0.5) * 0.05;
      state.bullets.push({ x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, from: 'player', life: BULLET_RANGE / BULLET_SPEED });
      p.angle = a;
      addParticles(state, p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, '#ffd94a', 3, 90);
      if (sfx) sfx.shoot();
    } else {
      p.shootCd = 0.3;
      if (sfx) sfx.click();
    }
  }
  // Reload.
  if (state.keys['KeyR'] && p.ammo < 24 && p.reserveAmmo > 0) {
    const need = 24 - p.ammo;
    const take = Math.min(need, p.reserveAmmo);
    p.ammo += take; p.reserveAmmo -= take;
    state.keys['KeyR'] = false;
    if (sfx) sfx.reload();
  }
  // Bullets fly, hit peds / cops / cars, and expire.
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    // Hit a pedestrian (scares the crowd, raises heat if witnessed).
    for (const ped of state.peds) {
      if (dist(b.x, b.y, ped.x, ped.y) < 10) {
        b.life = 0;
        if (ped.rival) hitRival(state, ped);
        ped.panic = 3;
        addParticles(state, ped.x, ped.y, '#ff5a5a', 8, 130);
        addWanted(state, 1, 'shot fired in public');
        break;
      }
    }
    if (b.life <= 0) continue;
    if (b.from === 'player') {
      for (const cop of state.cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 11) {
          b.life = 0; cop.health -= 34;
          addParticles(state, cop.x, cop.y, '#ff5a5a', 8, 130);
          if (cop.health <= 0) {
            cop.dead = true;
            addWanted(state, 1, 'officer down');
            state.stats.copsDodged += 1;
          }
          break;
        }
      }
    }
    if (b.life <= 0) continue;
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      const dx = b.x - car.x, dy = b.y - car.y;
      const ca = Math.cos(-car.angle), sa = Math.sin(-car.angle);
      const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
      if (Math.abs(lx) < car.model.len / 2 && Math.abs(ly) < car.model.w / 2) {
        b.life = 0;
        car.health -= 8;
        addParticles(state, b.x, b.y, '#ffd94a', 5, 110);
        if (car.kind === 'police') addWanted(state, 1, 'shot at police');
        break;
      }
    }
  }
  state.bullets = state.bullets.filter(b => b.life > 0);
  // Enemy cops shoot back when close.
  for (const cop of state.cops) {
    if (cop.dead) continue;
    cop.shootCd = (cop.shootCd || 0) - dt;
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d < 380 && cop.shootCd <= 0 && p.invuln <= 0) {
      cop.shootCd = 1.1;
      const a = Math.atan2(p.y - cop.y, p.x - cop.x) + (state.rng() - 0.5) * 0.22;
      state.bullets.push({ x: cop.x, y: cop.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, from: 'cop', life: 0.9 });
      if (sfx) sfx.shoot();
    }
  }
  // Cop bullets hit the player.
  for (const b of state.bullets) {
    if (b.from !== 'cop') continue;
    if (dist(b.x, b.y, p.x, p.y) < 12 && p.invuln <= 0) {
      b.life = 0;
      p.health -= 9;
      p.invuln = 0.4;
      addParticles(state, p.x, p.y, '#ff5a5a', 6, 120);
      if (sfx) sfx.hurt();
      if (p.health <= 0) {
        p.health = 0; p.dead = true; state.gameOver = true;
      }
    }
  }
}

export function drawBullets(ctx, state) {
  ctx.save();
  ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}
