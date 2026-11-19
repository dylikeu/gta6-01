// Traffic and pedestrians: the cars that drive the road grid in right-hand lanes
// and slow for the car ahead, and the people who stroll the sidewalks and run
// when danger comes near. It works on the world's plain state (passed in, never
// owned), so the world stays the one place that steps everything.

import { PEDS, ROADS, TRAFFIC, WORLD } from './config.js';
import { randomSidewalkPoint } from './city.js';
import { collideCircleBuildings, makePed } from './entities.js';
import { pick } from './random.js';

/** Build the traffic for one world. `state` is the world's state, passed to each call. */
export function createTraffic(random, city) {
  /** Move every traffic car along the road graph, in its lane, stopping for the car ahead. */
  function stepTraffic(state, dt) {
    for (const car of state.cars) {
      if (car.driver !== 'traffic' || car.wrecked) continue;
      const target = city.nodes[car.node];
      // Right-hand lane: aim a lane's width to the right of the road centre.
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      const dist = Math.hypot(dx, dy);
      const ux = dx / (dist || 1);
      const uy = dy / (dist || 1);
      const tx = target.x - uy * ROADS.lane;
      const ty = target.y + ux * ROADS.lane;
      const tdx = tx - car.x;
      const tdy = ty - car.y;
      const desired = Math.atan2(tdy, tdx);
      let diff = desired - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      // Slow down for the car ahead.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.wrecked) continue;
        const ox = other.x - car.x;
        const oy = other.y - car.y;
        const od = Math.hypot(ox, oy);
        if (od < 70) {
          const ahead = (ox * Math.cos(car.angle) + oy * Math.sin(car.angle)) / (od || 1);
          if (ahead > 0.6) {
            blocked = true;
            break;
          }
        }
      }
      const targetSpeed = blocked ? 0 : TRAFFIC.cruiseSpeed;
      car.speed += Math.max(-500 * dt, Math.min(300 * dt, targetSpeed - car.speed));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = collideCircleBuildings(city, car.x, car.y, 26);
      car.x = fixed.x;
      car.y = fixed.y;
      if (Math.hypot(target.x - car.x, target.y - car.y) < 34) {
        const neighbours = [];
        for (let xi = 0; xi < city.roadsX.length; xi += 1) {
          // Neighbours of the node we just reached.
        }
        const node = city.nodes[car.node];
        const cand = [];
        if (node.xi > 0) cand.push(car.node - city.roadsY.length);
        if (node.xi < city.roadsX.length - 1) cand.push(car.node + city.roadsY.length);
        if (node.yi > 0) cand.push(car.node - 1);
        if (node.yi < city.roadsY.length - 1) cand.push(car.node + 1);
        const choices = cand.filter((c) => c !== car.prevNode);
        car.prevNode = car.node;
        car.node = choices.length ? pick(random, choices) : cand[0];
        void neighbours;
      }
    }
  }

  /** Walk the pedestrians along the sidewalks; they flee from `danger` (the player). */
  function stepPeds(state, dt, danger) {
    for (const ped of state.peds) {
      if (ped.dead) {
        ped.deadTimer += dt;
        continue;
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
        const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
        ped.angle = away;
        ped.speed = 200;
      } else {
        ped.speed = 55;
        if (!ped.dest || Math.hypot(ped.dest.x - ped.x, ped.dest.y - ped.y) < 24) {
          ped.dest = randomSidewalkPoint(random, city);
        }
        ped.angle = Math.atan2(ped.dest.y - ped.y, ped.dest.x - ped.x);
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      const fixed = collideCircleBuildings(city, ped.x, ped.y, 10);
      ped.x = Math.max(12, Math.min(WORLD.width - 12, fixed.x));
      ped.y = Math.max(12, Math.min(WORLD.height - 12, fixed.y));
    }
    // The dead fade away after a while.
    state.peds = state.peds.filter((ped) => !ped.dead || ped.deadTimer < 20);
    while (state.peds.length < PEDS.count) state.peds.push(makePed(random, city));
  }

  return { stepTraffic, stepPeds };
}
