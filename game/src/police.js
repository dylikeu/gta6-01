// The police and the wanted level: how many stars the player has, the cop cars
// and foot cops that answer them, the arrest clock, and how the heat cools off.
// It works on the world's plain state (passed in, never owned), so the world
// stays the one place that steps everything.

import { CAR, WANTED, WORLD } from './config.js';
import { collideCircleBuildings, makeCar, makeEnemy } from './entities.js';
import { EVENT_WANTED_DOWN, EVENT_WANTED_UP } from './events.js';
import { range } from './random.js';

/** Build the police for one world. `state` is the world's state, passed to each call. */
export function createPolice(random, city) {
  /** Raise the wanted level by n stars (capped); returns EVENT_WANTED_UP when it rises. */
  function addWanted(state, n) {
    const before = state.wanted;
    state.wanted = Math.min(WANTED.maxStars, state.wanted + n);
    state.wantedTimer = 0;
    if (state.wanted > before) return EVENT_WANTED_UP;
    return 0;
  }

  /** Spawn the cops the stars call for, chase and ram the player, start the arrest clock. */
  function stepPolice(state, dt) {
    const p = state.player;
    const wantedCars = WANTED.copCars[state.wanted];
    const wantedFoot = WANTED.copFoot[state.wanted];
    // Police cars.
    let copCars = state.cars.filter((c) => c.driver === 'police' && !c.wrecked);
    while (copCars.length < wantedCars) {
      const angle = random() * Math.PI * 2;
      const dist = range(random, 320, 480);
      let x = p.x + Math.cos(angle) * dist;
      let y = p.y + Math.sin(angle) * dist;
      x = Math.max(80, Math.min(WORLD.width - 80, x));
      y = Math.max(80, Math.min(WORLD.height - 80, y));
      const car = makeCar(random, city, { x, y, kind: 'police', color: '#ffffff', driver: 'police' });
      car.angle = Math.atan2(p.y - y, p.x - x);
      state.cars.push(car);
      copCars.push(car);
    }
    for (const car of copCars) {
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const dist = Math.hypot(dx, dy);
      const desired = Math.atan2(dy, dx);
      let diff = desired - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.reverseTimer -= dt;
      if (car.reverseTimer > 0) {
        car.speed -= CAR.reverseAccel * dt;
      } else {
        car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
        const targetSpeed = dist < 60 ? 0 : Math.min(560, 380 + state.wanted * 30);
        car.speed += Math.max(-600 * dt, Math.min(500 * dt, targetSpeed - car.speed));
      }
      car.speed = Math.max(-CAR.maxReverse, Math.min(620, car.speed));
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = collideCircleBuildings(city, nx, ny, 26);
      if (fixed.hit) {
        car.speed *= 0.4;
        car.stuckTimer += dt;
        if (car.stuckTimer > 1.2) {
          car.reverseTimer = 0.8;
          car.stuckTimer = 0;
        }
      } else {
        car.stuckTimer = 0;
      }
      car.x = Math.max(30, Math.min(WORLD.width - 30, fixed.x));
      car.y = Math.max(30, Math.min(WORLD.height - 30, fixed.y));
      // A police car ramming the player's car slows it and shoves it; ramming the player
      // on foot starts the arrest clock.
      if (p.inCar && car === p.inCar) continue;
      if (p.inCar) {
        const d = Math.hypot(car.x - p.inCar.x, car.y - p.inCar.y);
        if (d < 54 && d > 0.01) {
          const ux = (p.inCar.x - car.x) / d;
          const uy = (p.inCar.y - car.y) / d;
          p.inCar.x += ux * 2;
          p.inCar.y += uy * 2;
          car.x -= ux * 2;
          car.y -= uy * 2;
          p.inCar.speed *= 0.94;
          car.speed *= 0.9;
        }
      } else if (dist < 30) {
        state.bustTimer += dt;
      }
      // Cops far away give up.
      if (dist > 1100) {
        car.driver = 'none';
        car.wrecked = true;
      }
    }
    state.cars = state.cars.filter((c) => !(c.driver === 'police' && c.wrecked && Math.hypot(c.x - p.x, c.y - p.y) > 900));
    // Cops on foot, only a threat when the player is on foot.
    let foot = state.enemies.filter((e) => e.kind === 'cop' && !e.dead);
    while (foot.length < wantedFoot && !p.inCar) {
      const angle = random() * Math.PI * 2;
      const dist = range(random, 220, 360);
      const cop = makeEnemy(random, city, {
        kind: 'cop',
        x: Math.max(60, Math.min(WORLD.width - 60, p.x + Math.cos(angle) * dist)),
        y: Math.max(60, Math.min(WORLD.height - 60, p.y + Math.sin(angle) * dist)),
      });
      state.enemies.push(cop);
      foot.push(cop);
    }
    if (p.inCar) {
      for (const e of state.enemies) if (e.kind === 'cop') e.dead = true;
      state.enemies = state.enemies.filter((e) => e.kind !== 'cop' || !e.dead);
    }
    state.bustTimer = state.bustTimer > 0 && state.wanted > 0 && !p.inCar ? state.bustTimer : 0;
    return 0;
  }

  /** Cool the heat off: with no cop near for long enough, lose one star at a time. */
  function stepWanted(state, dt) {
    let events = 0;
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      const p = state.player;
      let copNear = false;
      for (const car of state.cars) {
        if (car.driver === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 420) {
          copNear = true;
          break;
        }
      }
      if (!copNear) {
        for (const e of state.enemies) {
          if (e.kind === 'cop' && Math.hypot(e.x - p.x, e.y - p.y) < 380) {
            copNear = true;
            break;
          }
        }
      }
      if (!copNear && state.wantedTimer > WANTED.decayDelay) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        events |= EVENT_WANTED_DOWN;
        if (state.wanted === 0) state.bustTimer = 0;
      }
    }
    return events;
  }

  return { addWanted, stepPolice, stepWanted };
}
