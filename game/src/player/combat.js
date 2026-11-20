// player/combat.js — pistol combat: shooting, bullets, gang enemies and pickups.
// The player fights on foot; enemies chase, shoot back, and drop cash.

import { S } from '../core/state.js';
import { clamp, dist, angleTo } from '../core/math.js';
import { collideWorld } from '../city/map.js';
import { addWanted } from '../police/wanted.js';
import { showNotice } from '../core/state.js';
import { playSfx } from '../audio/sfx.js';
import { spawnSparks, addFloater } from './drive.js';

const BULLET_SPEED = 720;
const BULLET_RANGE = 520;

export function shootAt(wx, wy) {
  const p = S.player;
  if (!p.onFoot) return;
  if (p.shootCd > 0) return;
  if (p.ammo <= 0) {
    playSfx('empty');
    p.shootCd = 0.25;
    showNotice('Out of ammo — press R to reload');
    return;
  }
  p.ammo--;
  p.shootCd = 0.16;
  S.stats.shotsFired++;
  const a = angleTo(p.x, p.y, wx, wy);
  p.angle = a;
  S.bullets.push({
    x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
    vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
    life: BULLET_RANGE / BULLET_SPEED, from: 'player', dmg: 12,
  });
  playSfx('shot');
  spawnMuzzle(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18);
}

export function reload() {
  const p = S.player;
  if (p.ammo >= p.magSize || p.reserve <= 0) return;
  const need = p.magSize - p.ammo;
  const take = Math.min(need, p.reserve);
  p.reserve -= take;
  p.ammo += take;
  p.shootCd = 0.5;
  playSfx('reload');
}

function spawnMuzzle(x, y) {
  S.particles.push({ x, y, vx: 0, vy: 0, life: 0.08, max: 0.08, color: '#ffe27a', size: 9 });
}

export function updateBullets(dt) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    // Hit a building?
    const fixed = collideWorld(b.x, b.y, 2);
    if (fixed.x !== b.x || fixed.y !== b.y) { dead = true; spawnSparks(b.x, b.y, 3); }
    if (!dead && b.from === 'player') {
      // Hit an enemy.
      for (let j = S.enemies.length - 1; j >= 0; j--) {
        const e = S.enemies[j];
        if (dist(b.x, b.y, e.x, e.y) < 14) {
          e.health -= b.dmg;
          dead = true;
          spawnSparks(b.x, b.y, 4);
          if (e.health <= 0) killEnemy(j);
          break;
        }
      }
      // Hit a foot cop.
      if (!dead) {
        for (const cop of S.cops) {
          if (dist(b.x, b.y, cop.x, cop.y) < 14) {
            cop.health -= b.dmg;
            dead = true;
            addWanted(1, 'shot a cop');
            if (cop.health <= 0) {
              cop.health = 0;
              cop.down = true;
              S.stats.kills++;
            }
            break;
          }
        }
      }
      // Hit a pedestrian: a crime, and they drop cash when scared off.
      if (!dead) {
        for (const ped of S.peds) {
          if (ped.debtor) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 12) {
            ped.state = 'flee'; ped.panic = 4;
            dead = true;
            addWanted(1, 'fired on a pedestrian');
            showNotice('You shot a pedestrian! +1 wanted star');
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      const p = S.player;
      if (dist(b.x, b.y, p.x, p.y) < (p.onFoot ? 12 : 20)) {
        dead = true;
        hurtPlayer(b.dmg, 'shot');
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
}

function killEnemy(j) {
  const e = S.enemies[j];
  S.enemies.splice(j, 1);
  S.stats.kills++;
  addFloater(e.x, e.y, '+$60', '#2ecc71');
  S.player.money += 60;
  S.player.earned += 60;
  spawnSparks(e.x, e.y, 12);
  playSfx('kill');
  // Enemies drop a little cash or ammo.
  S.pickups.push({
    x: e.x, y: e.y,
    kind: Math.random() < 0.5 ? 'cash' : 'ammo',
    amount: 25, t: 0,
  });
}

export function hurtPlayer(dmg, cause) {
  const p = S.player;
  if (p.hurtCd > 0 || p.health <= 0) return;
  p.health -= dmg;
  p.hurtCd = 0.5;
  playSfx('hurt');
  if (S.shotMode) { p.health = Math.max(p.health, 30); return; } // staged shots never die
  if (p.health <= 0) {
    p.health = 0;
    // The player is down: busted, not dead — Velmara police take them in.
    if (S.mode === 'playing') {
      S.mode = 'busted';
      S.bustedTimer = 0;
    }
  }
}

// ---------- gang enemies ----------

export function spawnEnemy(x, y) {
  S.enemies.push({
    x, y, angle: 0, health: 36, shootCd: 1 + Math.random(),
    speed: 120, state: 'hunt', color: '#8e44ad',
  });
}

export function updateEnemies(dt) {
  const p = S.player;
  for (const e of S.enemies) {
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = angleTo(e.x, e.y, p.x, p.y);
    if (d > 320) {
      // Walk toward the player.
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (d > 200) {
      e.x += Math.cos(e.angle) * e.speed * 0.5 * dt;
      e.y += Math.sin(e.angle) * e.speed * 0.5 * dt;
    }
    const fixed = collideWorld(e.x, e.y, 12);
    e.x = fixed.x; e.y = fixed.y;
    e.shootCd -= dt;
    if (d < 340 && e.shootCd <= 0 && p.health > 0) {
      e.shootCd = 1.1 + Math.random() * 0.7;
      const a = angleTo(e.x, e.y, p.x, p.y) + (Math.random() - 0.5) * 0.25;
      S.bullets.push({
        x: e.x + Math.cos(a) * 16, y: e.y + Math.sin(a) * 16,
        vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        life: 0.9, from: 'enemy', dmg: 8,
      });
      playSfx('eshot');
    }
  }
}

export function drawEnemies(ctx) {
  for (const e of S.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(1, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(-5, -8, 10, 3); // headband
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(e.angle) * 6, Math.sin(e.angle) * 6);
    ctx.lineTo(Math.cos(e.angle) * 16, Math.sin(e.angle) * 16);
    ctx.stroke();
    // Health bar.
    ctx.fillStyle = '#222';
    ctx.fillRect(-12, -18, 24, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-12, -18, 24 * clamp(e.health / 36, 0, 1), 4);
    ctx.restore();
  }
}

export function drawBullets(ctx) {
  ctx.fillStyle = '#ffe27a';
  for (const b of S.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawPickups(ctx) {
  for (const pk of S.pickups) {
    const bob = Math.sin(S.time * 4 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-3, -7, 6, 14);
      ctx.fillRect(-7, -3, 14, 6);
    } else {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-7, -10, 14, 20);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 3);
    }
    ctx.restore();
  }
}
