// police/chase.js — the Velmara PD: patrol cars that chase and ram, foot cops that
// run the player down, and the bust that ends a run when they catch you.

import { S, WORLD } from '../core/state.js';
import { clamp, dist, angleTo, turnToward } from '../core/math.js';
import { collideWorld } from '../city/map.js';
import { makeCar, drawCar } from '../city/traffic.js';
import { policeBudget, clearWanted } from './wanted.js';
import { hurtPlayer } from '../player/combat.js';
import { showNotice, showBanner } from '../core/state.js';
import { playSfx } from '../audio/sfx.js';

const BUST_DIST_FOOT = 26;
const BUST_DIST_CAR = 64;

export function updatePolice(dt) {
  const p = S.player;
  const budget = policeBudget();
  // Spawn police cars up to the budget, at the edge of the screen.
  while (S.copCars.length < budget) {
    const a = Math.random() * Math.PI * 2;
    const r = 700;
    const car = makeCar(
      clamp(p.x + Math.cos(a) * r, 80, WORLD - 80),
      clamp(p.y + Math.sin(a) * r, 80, WORLD - 80),
      'cop', '#111111'
    );
    car.mission = true; // not a traffic car: police AI drives it
    car.driver = true;
    S.copCars.push(car);
  }
  while (S.copCars.length > budget) S.copCars.pop();
  // Foot cops join the chase at 3+ stars when the player is on foot.
  const footBudget = (S.wanted >= 3 && p.onFoot) ? Math.min(3, S.wanted - 1) : 0;
  while (S.cops.length < footBudget) {
    const a = Math.random() * Math.PI * 2;
    S.cops.push({
      x: clamp(p.x + Math.cos(a) * 420, 40, WORLD - 40),
      y: clamp(p.y + Math.sin(a) * 420, 40, WORLD - 40),
      angle: 0, speed: 165, health: 60, down: false, grab: 0,
    });
  }
  while (S.cops.length > footBudget) S.cops.pop();

  // Police cars chase and ram.
  for (const car of S.copCars) {
    const d = dist(car.x, car.y, p.x, p.y);
    const targetAngle = angleTo(car.x, car.y, p.x, p.y);
    car.angle = turnToward(car.angle, targetAngle, 2.6 * dt);
    const wantSpeed = d > 120 ? car.maxSpeed : car.maxSpeed * 0.75;
    car.speed = clamp(car.speed + (wantSpeed - car.speed) * dt * 1.2, 0, car.maxSpeed);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideWorld(car.x, car.y, 20);
    car.x = fixed.x; car.y = fixed.y;
    // Ram the player's car.
    if (S.car && d < 42) {
      if (!S.shotMode) S.car.speed *= 0.55;
      car.speed *= 0.6;
      if (Math.abs(S.car.speed) > 60 || Math.abs(car.speed) > 60) {
        hurtPlayer(4, 'rammed');
        playSfx('crash');
      }
    }
  }

  // Foot cops run the player down and grab them.
  for (const cop of S.cops) {
    if (cop.down) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
    if (d > 18) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    const fixed = collideWorld(cop.x, cop.y, 10);
    cop.x = fixed.x; cop.y = fixed.y;
    if (d < BUST_DIST_FOOT && p.onFoot) {
      cop.grab += dt;
      if (cop.grab > 1.2) bustPlayer('caught by a VPD officer');
    } else {
      cop.grab = Math.max(0, cop.grab - dt * 2);
    }
  }

  // Busted in the car: boxed in and slow, with a cop car on the bumper.
  if (S.car && S.wanted > 0) {
    let close = false;
    for (const car of S.copCars) {
      if (dist(car.x, car.y, p.x, p.y) < BUST_DIST_CAR) { close = true; break; }
    }
    if (close && Math.abs(S.car.speed) < 25) {
      S.bustedTimer += dt;
      if (S.bustedTimer > 2.0) bustPlayer('boxed in by the VPD');
    } else {
      S.bustedTimer = Math.max(0, S.bustedTimer - dt * 2);
    }
  } else {
    S.bustedTimer = Math.max(0, S.bustedTimer - dt);
  }
}

export function bustPlayer(reason) {
  if (S.mode !== 'playing') return;
  if (S.shotMode) return; // screenshots stage a chase, never a bust
  S.mode = 'busted';
  S.bustedTimer = 0;
  const fine = Math.floor(S.player.money * 0.15);
  S.player.money -= fine;
  clearWanted();
  showBanner('BUSTED', reason + (fine > 0 ? ' — fined $' + fine : ''));
  playSfx('busted');
  // Impound the car, clear the heat.
  S.car = null;
  S.copCars = [];
  S.cops = [];
  S.enemies = [];
  S.bullets = [];
}

export function respawnAfterBust() {
  // The VPD drops the player at the precinct in Downtown, on foot.
  S.player.x = 1400;
  S.player.y = 1350;
  S.player.health = S.player.maxHealth;
  S.player.onFoot = true;
  S.camera.x = S.player.x;
  S.camera.y = S.player.y;
  S.mode = 'playing';
  showNotice('The VPD let you go. Lay low for a while.');
}

export function drawPolice(ctx) {
  for (const car of S.copCars) drawCar(ctx, car);
  for (const cop of S.cops) {
    if (cop.down) continue;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(1, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a3a6b';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a3a6b';
    ctx.fillRect(-6, -9, 12, 4);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(cop.angle) * 10, Math.sin(cop.angle) * 10);
    ctx.stroke();
    if (cop.grab > 0.2) {
      ctx.fillStyle = '#ff2d2d';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -16);
    }
    ctx.restore();
  }
}
