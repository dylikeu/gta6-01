// The simulation: the player on foot and in a car, traffic and pedestrians, combat,
// pickups, particles and the clock. No drawing and no browser in it: step() advances one
// fixed step from a control object and returns what happened as bit flags, so the caller
// can react (sound, screens, missions) without the world knowing about screens. Missions
// reach in through the same plain state. The things in the city live in entities.js, and
// the police and the wanted level live in police.js; this file steps them all.

import { BEACH, CAR, ECONOMY, PEDS, PLAYER, TIME, TRAFFIC, WANTED, WORLD } from './config.js';
import { buildingAt, isOnRoad, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { collideCircleBuildings, makeCar, makeEnemy, makePed } from './entities.js';
import { EVENT_BUSTED, EVENT_CAR_STOLEN, EVENT_CRASH, EVENT_ENEMY_SHOT, EVENT_HIT, EVENT_KILL, EVENT_PED_DOWN, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED, EVENT_WRECKED } from './events.js';
import { createPolice } from './police.js';
import { createTraffic } from './traffic.js';
import { pick, range, rangeInt } from './random.js';



export function createWorld(random, city) {
  const state = {
    city,
    random,
    time: 0,
    clock: TIME.startHour,
    cash: ECONOMY.startCash,
    health: PLAYER.health,
    armor: 0,
    weapon: 'pistol',
    ammo: Infinity,
    shotgunAmmo: 0,
    wanted: 0,
    wantedTimer: 0,
    bustTimer: 0,
    player: { x: 0, y: 0, angle: 0, speed: 0, inCar: null, aimAngle: 0, cooldown: 0, moving: false },
    cars: [],
    peds: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    stats: { kills: 0, carsStolen: 0, missionsDone: 0, packages: 0, taxiFares: 0 },
    packagesTotal: 12,
    spawn: { x: 0, y: 0 },
  };

  const police = createPolice(random, city);
  const traffic = createTraffic(random, city);

  function garagePoint() {
    const g = city.landmarks["Rosa's Garage"];
    return { x: g.x, y: g.building.y + g.building.h + 60 };
  }

  function addParticles(x, y, count, color, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const s = range(random, speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: range(random, life * 0.5, life),
        maxLife: life,
        color,
        size: range(random, size * 0.6, size * 1.4),
      });
    }
  }

  // The wanted level itself lives in police.js; this is the world's handle on it.
  function addWanted(n) {
    return police.addWanted(state, n);
  }

  function spawnPickup(kind, x, y, amount = 0) {
    state.pickups.push({ kind, x, y, amount, bob: random() * Math.PI * 2 });
  }

  function scatterPickups() {
    // Health and armour dotted around the city, and the 12 hidden packages.
    for (let i = 0; i < 6; i += 1) {
      const p = randomSidewalkPoint(random, city);
      spawnPickup(i % 2 === 0 ? 'health' : 'armor', p.x, p.y);
    }
    for (let i = 0; i < 2; i += 1) {
      const p = randomSidewalkPoint(random, city);
      spawnPickup('shotgun', p.x, p.y);
    }
    for (let i = 0; i < state.packagesTotal; i += 1) {
      const p = randomSidewalkPoint(random, city);
      spawnPickup('package', p.x, p.y);
    }
    // One shotgun on the beach, one health at the pier.
    spawnPickup('shotgun', 1500, BEACH.sandY + 60);
    spawnPickup('health', city.landmarks['Marina Pier'].x, city.landmarks['Marina Pier'].y + 90);
  }

  function reset(newGame = true) {
    state.time = 0;
    state.clock = TIME.startHour;
    state.health = PLAYER.health;
    state.armor = 0;
    state.weapon = 'pistol';
    state.ammo = Infinity;
    state.shotgunAmmo = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.bustTimer = 0;
    state.cars = [];
    state.peds = [];
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.stats = { kills: 0, carsStolen: 0, missionsDone: 0, packages: 0, taxiFares: 0 };
    if (newGame) state.cash = ECONOMY.startCash;
    const g = garagePoint();
    state.spawn = { x: g.x, y: g.y };
    state.player.x = g.x;
    state.player.y = g.y;
    state.player.angle = -Math.PI / 2;
    state.player.inCar = null;
    state.player.cooldown = 0;
    // The player's starter car, parked outside the garage.
    const starter = makeCar(random, city, { x: g.x + 110, y: g.y + 5, angle: 0, kind: 'sedan', color: '#d94f3d', driver: 'parked' });
    state.cars.push(starter);
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const car = makeCar(random, city);
      car.angle = isOnRoad(city, car.x + 1, car.y) ? 0 : Math.PI / 2;
      state.cars.push(car);
    }
    for (let i = 0; i < TRAFFIC.parked; i += 1) {
      const point = randomRoadPoint(random, city);
      const parked = makeCar(random, city, { x: point.x, y: point.y, driver: 'parked', angle: pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]) });
      state.cars.push(parked);
    }
    for (let i = 0; i < PEDS.count; i += 1) state.peds.push(makePed(random, city));
    scatterPickups();
  }

  function nearestCar(x, y, maxDist, excludeWrecked = true) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (excludeWrecked && car.wrecked) continue;
      const dx = car.x - x;
      const dy = car.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function damageCar(car, amount, events) {
    if (car.wrecked) return events;
    car.health -= amount;
    if (car.health <= 0) {
      car.wrecked = true;
      car.speed = 0;
      addParticles(car.x, car.y, 18, '#555', 140, 0.9, 5);
      addParticles(car.x, car.y, 10, '#ff9a3c', 220, 0.5, 6);
      return events | EVENT_WRECKED;
    }
    return events;
  }

  function killPed(ped, byPlayer) {
    if (ped.dead) return 0;
    ped.dead = true;
    ped.deadTimer = 0;
    addParticles(ped.x, ped.y, 8, '#a02020', 90, 0.7, 4);
    let events = EVENT_PED_DOWN;
    if (byPlayer) {
      state.stats.kills += 1;
      events |= addWanted(1);
    }
    return events;
  }

  function fireBullet(x, y, angle, from, damage, spread = 0) {
    const a = angle + (spread ? range(random, -spread, spread) : 0);
    state.bullets.push({
      x, y,
      vx: Math.cos(a) * PLAYER.bulletSpeed,
      vy: Math.sin(a) * PLAYER.bulletSpeed,
      life: 1.2,
      from,
      damage,
    });
  }

  function playerShoot(events) {
    const p = state.player;
    if (p.cooldown > 0) return events;
    if (state.weapon === 'shotgun') {
      if (state.shotgunAmmo <= 0) {
        state.weapon = 'pistol';
        return events;
      }
      state.shotgunAmmo -= 1;
      p.cooldown = PLAYER.shotgunCooldown;
      for (let i = 0; i < PLAYER.shotgunPellets; i += 1) {
        fireBullet(p.x, p.y, p.aimAngle, 'player', PLAYER.shotgunDamage, 0.09);
      }
      addParticles(p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22, 5, '#ffd23e', 120, 0.15, 3);
      return events | EVENT_SHOT;
    }
    p.cooldown = PLAYER.pistolCooldown;
    fireBullet(p.x, p.y, p.aimAngle, 'player', PLAYER.pistolDamage);
    addParticles(p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22, 4, '#ffd23e', 120, 0.15, 3);
    return events | EVENT_SHOT;
  }

  function stepPlayerOnFoot(dt, control) {
    const p = state.player;
    const speed = control.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    let mx = control.move.x;
    let my = control.move.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.moving = true;
    } else {
      p.moving = false;
    }
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    const fixed = collideCircleBuildings(city, p.x, p.y, PLAYER.radius);
    p.x = Math.max(PLAYER.radius, Math.min(WORLD.width - PLAYER.radius, fixed.x));
    p.y = Math.max(PLAYER.radius, Math.min(WORLD.height - PLAYER.radius, fixed.y));
    if (p.moving) p.angle = Math.atan2(my, mx);
    p.aimAngle = Math.atan2(control.aim.y - p.y, control.aim.x - p.x);
    if (p.cooldown > 0) p.cooldown -= dt;
    p.speed = p.moving ? speed : 0;
    // Bumping into a parked or slow car pushes the player out, never through it.
    for (const car of state.cars) {
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 30 && d > 0.01) {
        p.x = car.x + (dx / d) * 30;
        p.y = car.y + (dy / d) * 30;
      }
    }
  }

  function stepPlayerCar(dt, control) {
    const p = state.player;
    const car = p.inCar;
    if (!car || car.wrecked) {
      p.inCar = null;
      return 0;
    }
    let events = 0;
    const forward = control.move.y < 0 ? 1 : control.move.y > 0 ? -1 : 0;
    // W/S (or arrows): W is forward, S brakes then reverses.
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) {
      if (car.speed > 10) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * CAR.drag * 120 * dt;
      if (Math.abs(car.speed) < 8) car.speed = 0;
    }
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steerInput = control.move.x;
    const steerAmount = steerInput * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
    car.angle += steerAmount * Math.sign(car.speed || 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircleBuildings(city, nx, ny, 26);
    if (fixed.hit) {
      if (Math.abs(car.speed) > 240) {
        events |= EVENT_CRASH;
        addParticles(car.x, car.y, 6, '#cccccc', 100, 0.5, 4);
      }
      car.speed *= 0.45;
    }
    car.x = Math.max(30, Math.min(WORLD.width - 30, fixed.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, fixed.y));
    // Running over a pedestrian at speed is a crime, and it is felt.
    for (const ped of state.peds) {
      if (ped.dead) continue;
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      if (Math.abs(dx) < 34 && Math.abs(dy) < 34 && Math.abs(car.speed) > 140) {
        events |= killPed(ped, true);
      } else if (Math.hypot(dx, dy) < 60 && Math.abs(car.speed) > 60) {
        ped.state = 'flee';
        ped.fleeTimer = 2.5;
      }
    }
    // Bumping other cars.
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 52 && d > 0.01) {
        const push = (52 - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        other.x += ux * push;
        other.y += uy * push;
        car.x -= ux * push * 0.5;
        car.y -= uy * push * 0.5;
        if (Math.abs(car.speed) > 260) {
          events |= EVENT_CRASH;
          events |= damageCar(other, 12, 0);
        }
        other.speed = car.speed * 0.4;
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    p.aimAngle = car.angle;
    return events;
  }

  function stepEnemies(dt, events) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      e.angle = Math.atan2(dy, dx);
      if (dist > 520) {
        // Walk toward the player, on the street.
        e.x += Math.cos(e.angle) * 130 * dt;
        e.y += Math.sin(e.angle) * 130 * dt;
      } else if (dist > 200) {
        e.x += Math.cos(e.angle) * 90 * dt;
        e.y += Math.sin(e.angle) * 90 * dt;
      }
      const fixed = collideCircleBuildings(city, e.x, e.y, 12);
      e.x = fixed.x;
      e.y = fixed.y;
      e.shootTimer -= dt;
      if (dist < 420 && e.shootTimer <= 0) {
        e.shootTimer = range(random, 0.9, 1.6);
        const spread = e.kind === 'cop' ? 0.12 : 0.2;
        fireBullet(e.x, e.y, e.angle + range(random, -spread, spread), 'enemy', e.kind === 'cop' ? 9 : 7);
        events |= EVENT_ENEMY_SHOT;
      }
      // A cop standing on top of Leo on foot arrests him.
      if (e.kind === 'cop' && dist < 34 && !p.inCar && state.wanted > 0) {
        state.bustTimer += dt;
      }
    }
    return events;
  }

  function stepBullets(dt) {
    let events = 0;
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) {
        b.life = 0;
        continue;
      }
      if (buildingAt(city, b.x, b.y, 0)) {
        b.life = 0;
        addParticles(b.x, b.y, 3, '#d8d8d8', 80, 0.3, 2);
        continue;
      }
      if (b.from === 'player') {
        let hit = false;
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
            e.hp -= b.damage;
            b.life = 0;
            hit = true;
            addParticles(b.x, b.y, 4, '#c03030', 90, 0.4, 3);
            if (e.hp <= 0) {
              e.dead = true;
              state.stats.kills += 1;
              events |= EVENT_KILL;
              if (e.kind === 'cop') events |= addWanted(2);
              if (random() < 0.5) spawnPickup('cash', e.x, e.y, rangeInt(random, 40, 120));
              if (random() < 0.25) spawnPickup('health', e.x + 20, e.y, 0);
            }
            break;
          }
        }
        if (hit) continue;
        for (const ped of state.peds) {
          if (ped.dead) continue;
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
            b.life = 0;
            events |= killPed(ped, true);
            hit = true;
            break;
          }
        }
        if (hit) continue;
        for (const car of state.cars) {
          if (car.wrecked) continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
            b.life = 0;
            events |= damageCar(car, b.damage, 0);
            addParticles(b.x, b.y, 3, '#ffd23e', 100, 0.25, 2);
            break;
          }
        }
      } else {
        if (Math.hypot(p.x - b.x, p.y - b.y) < (p.inCar ? 30 : 15)) {
          b.life = 0;
          if (p.inCar) {
            events |= damageCar(p.inCar, b.damage, 0);
          } else {
            let remaining = b.damage;
            if (state.armor > 0) {
              const absorbed = Math.min(state.armor, remaining);
              state.armor -= absorbed;
              remaining -= absorbed;
            }
            state.health -= remaining;
            events |= EVENT_HIT;
            if (state.health <= 0) {
              state.health = 0;
              events |= EVENT_WASTED;
            }
          }
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    state.enemies = state.enemies.filter((e) => !e.dead);
    return events;
  }

  function stepPickups(dt) {
    let events = 0;
    const p = state.player;
    for (const pk of state.pickups) {
      pk.bob += dt * 3;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) > 30) continue;
      if (pk.kind === 'health') {
        if (state.health >= PLAYER.health) continue;
        state.health = Math.min(PLAYER.health, state.health + 40);
      } else if (pk.kind === 'armor') {
        if (state.armor >= PLAYER.armor) continue;
        state.armor = Math.min(PLAYER.armor, state.armor + 50);
      } else if (pk.kind === 'shotgun') {
        state.weapon = 'shotgun';
        state.shotgunAmmo += ECONOMY.shotgunAmmo;
      } else if (pk.kind === 'cash') {
        state.cash += pk.amount;
      } else if (pk.kind === 'package') {
        state.stats.packages += 1;
        state.cash += ECONOMY.packageReward;
      }
      pk.taken = true;
      events |= EVENT_PICKUP;
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    return events;
  }

  function stepParticles(dt) {
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    // Wrecked cars smoke.
    for (const car of state.cars) {
      if (!car.wrecked) continue;
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.25;
        state.particles.push({
          x: car.x + range(random, -8, 8),
          y: car.y + range(random, -8, 8),
          vx: range(random, -8, 8),
          vy: range(random, -30, -12),
          life: 0.9,
          maxLife: 0.9,
          color: '#666666',
          size: 7,
        });
      }
    }
  }

  /** One fixed step. `control` carries the frame's input; see main.js. */
  function step(dt, control) {
    let events = 0;
    state.time += dt;
    state.clock = (TIME.startHour + (state.time / TIME.dayLength) * 24) % 24;
    const p = state.player;

    if (control.enter) {
      if (p.inCar) {
        const car = p.inCar;
        p.inCar = null;
        car.driver = 'parked';
        const side = car.angle + Math.PI / 2;
        p.x = car.x + Math.cos(side) * 34;
        p.y = car.y + Math.sin(side) * 34;
        const fixed = collideCircleBuildings(city, p.x, p.y, PLAYER.radius);
        p.x = fixed.x;
        p.y = fixed.y;
      } else {
        const car = nearestCar(p.x, p.y, 70);
        if (car) {
          if (car.driver === 'traffic') {
            // Pull the driver out: they run, and the theft is a crime if a cop saw it.
            const driver = makePed(random, city, { x: car.x + 30, y: car.y + 20, state: 'flee' });
            driver.fleeTimer = 4;
            state.peds.push(driver);
            state.stats.carsStolen += 1;
            events |= EVENT_CAR_STOLEN;
            let copNear = false;
            for (const c of state.cars) {
              if (c.driver === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 380) copNear = true;
            }
            for (const e of state.enemies) {
              if (e.kind === 'cop' && Math.hypot(e.x - p.x, e.y - p.y) < 380) copNear = true;
            }
            if (copNear) events |= addWanted(1);
            if (car.kind === 'police') events |= addWanted(2);
          }
          car.driver = 'player';
          p.inCar = car;
          p.x = car.x;
          p.y = car.y;
        }
      }
    }

    if (p.inCar) {
      events |= stepPlayerCar(dt, control);
    } else {
      stepPlayerOnFoot(dt, control);
      if (control.shoot) events |= playerShoot(events);
    }

    traffic.stepTraffic(state, dt);
    traffic.stepPeds(state, dt, p);
    events |= stepEnemies(dt, events);
    police.stepPolice(state, dt);
    events |= stepBullets(dt);
    events |= stepPickups(dt);
    stepParticles(dt);
    events |= police.stepWanted(state, dt);

    if (state.bustTimer > WANTED.bustSeconds && state.wanted > 0 && !p.inCar) {
      events |= EVENT_BUSTED;
      state.bustTimer = 0;
    }
    return events;
  }

  reset();

  return {
    state,
    reset,
    step,
    makeCar,
    makePed,
    makeEnemy,
    nearestCar,
    addParticles,
    addWanted,
    spawnPickup,
    garagePoint,
    killPed,
  };
}
