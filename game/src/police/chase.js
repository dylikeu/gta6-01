// Police chase AI for VELMARA: patrol cars spawn at the edge of view,
// ram the player's car, and on-foot officers chase and try to arrest.
// Arrest happens only on foot, at close range, after a short struggle.
import { WORLD_W, WORLD_H, addParticles, showBanner } from '../core/state.js';
import { clamp, dist, angleDiff, turnToward, pick } from '../core/math.js';
import { collideBuildings } from '../city/map.js';
import { policeBudget } from './wanted.js';

const COP_MODEL = { name: 'VPD Interceptor', color: '#f2f2f2', top: 215, accel: 330, len: 48, w: 22, price: 0 };

export function spawnCopCar(state) {
  const p = state.player;
  const a = state.rng() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(a) * 700, 60, WORLD_W - 60);
  const y = clamp(p.y + Math.sin(a) * 700, 60, WORLD_H - 60);
  const car = {
    id: 900 + state.cars.length, x, y, angle: Math.atan2(p.y - y, p.x - x),
    speed: 60, model: COP_MODEL, kind: 'police', driver: true,
    targetAngle: 0, lane: 0, stuck: 0, honk: 0, health: 120, siren: true, brakeLight: false,
  };
  state.cars.push(car);
  return car;
}

export function spawnCopPed(state, x, y) {
  const cop = {
    x, y, angle: 0, speed: 150, health: 100, dead: false,
    shootCd: 0.5, arrestT: 0, color: '#1d3a5f',
  };
  state.cops.push(cop);
  return cop;
}

export function ensurePolice(state) {
  const want = policeBudget(state.player.wanted);
  const cars = state.cars.filter(c => c.kind === 'police').length;
  const peds = state.cops.filter(c => !c.dead).length;
  if (state.player.wanted > 0 && cars + peds < want) {
    if (state.player.onFoot && peds < want) {
      spawnCopPed(state, state.player.x + pick(state.rng, [-260, 260]), state.player.y + pick(state.rng, [-260, 260]));
    } else if (!state.player.onFoot && cars < want) {
      spawnCopCar(state);
    }
  }
  // Despawn police far away once the heat is off.
  if (state.player.wanted === 0) {
    state.cars = state.cars.filter(c => c.kind !== 'police' || dist(c.x, c.y, state.player.x, state.player.y) < 900);
    state.cops = state.cops.filter(c => !c.dead && dist(c.x, c.y, state.player.x, state.player.y) < 900);
  }
  state.cops = state.cops.filter(c => !c.dead);
}

export function updateChase(state, dt, sfx) {
  const p = state.player;
  ensurePolice(state);
  // Police cars: steer at the player, ram, and slow them down.
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const target = Math.atan2(p.y - car.y, p.x - car.x);
    car.angle = turnToward(car.angle, target, 2.6 * dt);
    const d = dist(car.x, car.y, p.x, p.y);
    const want = d > 120 ? 200 : 120;
    car.speed += clamp(want - car.speed, -260 * dt, 300 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideBuildings(state.city, nx, ny, 20);
    car.x = fixed.x; car.y = fixed.y;
    if (p.car && d < 52) {
      // Ram: shove the player's car and damage it.
      p.car.speed *= 0.86;
      p.car.health -= 14 * dt * 10;
      addParticles(state, car.x, car.y, '#9fb6ff', 3, 90);
      if (sfx && Math.abs(car.speed) > 40) sfx.crash();
    }
    if (!p.onFoot && d < 60) {
      // Cops try to box the player in: match speed, nudge sideways.
      car.speed = Math.max(car.speed, p.car.speed * 0.9);
    }
  }
  // On-foot officers: run at the player; arrest at arm's length.
  for (const cop of state.cops) {
    if (cop.dead) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (p.onFoot) {
      cop.angle = turnToward(cop.angle, Math.atan2(p.y - cop.y, p.x - cop.x), 5 * dt);
      const sp = d < 200 ? 175 : 150;
      const nx = cop.x + Math.cos(cop.angle) * sp * dt;
      const ny = cop.y + Math.sin(cop.angle) * sp * dt;
      const fixed = collideBuildings(state.city, nx, ny, 10);
      cop.x = fixed.x; cop.y = fixed.y;
      if (d < 26) {
        cop.arrestT += dt;
        if (cop.arrestT > 1.2) {
          state.busted = true; state.gameOver = true;
          showBanner(state, 'BUSTED', 'The VPD hauled you in', 4);
        }
      } else cop.arrestT = 0;
    } else {
      // Player in a car: officers stand their ground and shoot tyres.
      cop.shootCd -= dt;
      if (d < 300 && cop.shootCd <= 0) {
        cop.shootCd = 1.4;
        const a = Math.atan2(p.y - cop.y, p.x - cop.x);
        state.bullets.push({ x: cop.x, y: cop.y, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, from: 'cop', life: 0.8 });
      }
    }
  }
  // Helicopter shadow at 5 stars: a circling spotlight that keeps heat up.
  if (p.wanted >= 5) {
    state.heli = state.heli || { a: 0 };
    state.heli.a += dt * 0.5;
    state.heli.x = p.x + Math.cos(state.heli.a) * 160;
    state.heli.y = p.y + Math.sin(state.heli.a) * 160;
    p.heat = Math.max(p.heat, 60);
  } else state.heli = null;
}

export function drawCops(ctx, state, t) {
  for (const cop of state.cops) {
    if (cop.dead) continue;
    const bob = Math.sin(t * 10 + cop.x) * 1.5;
    ctx.save();
    ctx.translate(cop.x, cop.y + bob * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 7, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1d3a5f';
    ctx.beginPath(); ctx.roundRect(-8, -7, 16, 14, 5); ctx.fill();
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-8, -2, 16, 4);
    ctx.fillStyle = '#d9a06a';
    ctx.beginPath(); ctx.arc(9, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16283e';
    ctx.beginPath(); ctx.arc(10, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (cop.arrestT > 0) {
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(cop.x - 14, cop.y - 26, 28 * Math.min(1, cop.arrestT / 1.2), 4);
    }
  }
  if (state.heli) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#fff8c9';
    ctx.beginPath(); ctx.arc(state.heli.x, state.heli.y, 130, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(state.heli.x, state.heli.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(state.heli.x - 16, state.heli.y); ctx.lineTo(state.heli.x + 16, state.heli.y); ctx.stroke();
    ctx.restore();
  }
}
