// The story of Solmar and the mission runner. Leo Marín, just out of a short stretch,
// drives for Rosa Delgado, who runs Rosa's Garage on Calle Verde. Across six missions he
// climbs from errand boy to the man the whole city owes — while Los Tiburones, the Sharks,
// try to take the garage. Side work: taxi fares and twelve hidden packages around the city.
//
// A mission is a list of stages. Each stage is one job — walk somewhere, get in a car,
// drive somewhere before the clock runs out, clear out the thugs, lose the cops — and the
// runner moves through them, spawning what the stage needs and reporting progress. The
// runner never draws anything: main.js reads objectiveText() and marker() for the HUD.

import { CITY, ECONOMY } from './config.js';
import { randomRoadPoint } from './city.js';
import { range, rangeInt } from './random.js';

export const MISSION_STAGE = 1;
export const MISSION_DONE = 2;
export const MISSION_FAILED = 4;
export const TAXI_DONE = 8;

function at(world, label, dx = 0, dy = 0) {
  const lm = world.state.city.landmarks[label];
  return { x: lm.x + dx, y: lm.y + dy };
}

/** The spot in front of the garage door: south of the building, where Leo spawns. */
function garageDoor(world) {
  const lm = world.state.city.landmarks[CITY.garage];
  return { x: lm.x, y: lm.building.y + lm.building.h + 40 };
}

function missionDefs(world) {
  const garage = garageDoor(world);
  const park = { x: world.state.city.park.x + world.state.city.park.w / 2, y: world.state.city.park.y + world.state.city.park.h / 2 };
  const pier = at(world, CITY.pier, 0, 110);
  const mall = at(world, CITY.mall, 0, 90);
  const hospital = at(world, CITY.hospital, 0, 90);
  const beach = { x: 1600, y: 3000 };
  const hideout = { x: 600, y: 2900 };
  return [
    {
      id: 0,
      title: 'First Wheels',
      giver: 'Rosa Delgado',
      reward: 200,
      briefing: [
        'Leo. You are out, you are broke, and my garage needs a driver.',
        'Walk over to my door, then take the red sedan out front.',
        'Drive it to Palma Park and do not scratch it. The city is yours — learn it.',
      ],
      stages: [
        { type: 'goto', ...garage, radius: 70, text: 'Go to Rosa\'s Garage' },
        { type: 'enterCar', text: 'Get in the red sedan' },
        { type: 'goto', ...park, radius: 80, text: 'Drive to Palma Park' },
      ],
    },
    {
      id: 1,
      title: 'The Delivery',
      giver: 'Rosa Delgado',
      reward: 350,
      briefing: [
        'A package for the marina. No questions, no stops, no cops.',
        'Take a car and get it to the pier in 90 seconds. The tide waits for nobody.',
      ],
      stages: [
        { type: 'enterCar', text: 'Get in a car' },
        { type: 'drive', ...pier, radius: 80, time: 90, text: 'Deliver the package to Marina Pier' },
      ],
    },
    {
      id: 2,
      title: 'The Shakedown',
      giver: 'Rosa Delgado',
      reward: 400,
      briefing: [
        'The Sharks are shaking down the shops at Palma Mall. My shops.',
        'Go on foot. Put them down. Take back what is ours.',
      ],
      stages: [
        { type: 'goto', ...mall, radius: 90, text: 'Go to Palma Mall' },
        {
          type: 'kill', text: 'Clear out the Sharks',
          spawn: [
            { kind: 'thug', x: mall.x - 110, y: mall.y + 130 },
            { kind: 'thug', x: mall.x + 20, y: mall.y + 140 },
            { kind: 'thug', x: mall.x + 120, y: mall.y + 120 },
          ],
        },
        { type: 'goto', ...garage, radius: 70, text: 'Report back to Rosa\'s Garage' },
      ],
    },
    {
      id: 3,
      title: 'Hot Pursuit',
      giver: 'Rosa Delgado',
      reward: 500,
      briefing: [
        'The cops saw the delivery. Three stars, Leo. THREE.',
        'Lose them. Get to the old hideout by the beach and stay out of sight.',
      ],
      stages: [
        { type: 'enterCar', text: 'Get in a car — any car' },
        { type: 'escape', ...hideout, radius: 90, text: 'Reach the beach hideout' },
        { type: 'loseWanted', text: 'Lose the cops — stay out of sight' },
      ],
    },
    {
      id: 4,
      title: 'The Armored Van',
      giver: 'Rosa Delgado',
      reward: 700,
      briefing: [
        'A Sharks van, full of cash, parked by the police HQ. The irony is delicious.',
        'Deal with the guards, take the van, bring it home to the garage.',
      ],
      stages: [
        { type: 'goto', ...at(world, CITY.policeHQ, 0, 110), radius: 100, text: 'Find the van by Solmar PD HQ' },
        {
          type: 'kill', text: 'Deal with the guards',
          spawn: [
            { kind: 'thug', x: at(world, CITY.policeHQ, -70, 130).x, y: at(world, CITY.policeHQ, -70, 130).y },
            { kind: 'thug', x: at(world, CITY.policeHQ, 70, 130).x, y: at(world, CITY.policeHQ, 70, 130).y },
          ],
          then: 'van',
        },
        { type: 'stealVan', ...garage, radius: 80, text: 'Steal the van and bring it to the garage' },
      ],
    },
    {
      id: 5,
      title: 'Solmar Nights',
      giver: 'Rosa Delgado',
      reward: 1200,
      briefing: [
        'Tonight the Sharks come for the garage. All of them.',
        'Hold the line, Leo. Three waves. Then meet me at the pier — the city is ours.',
      ],
      stages: [
        { type: 'survive', seconds: 60, waves: 3, text: 'Defend Rosa\'s Garage' },
        { type: 'goto', ...pier, radius: 80, text: 'Meet Rosa at Marina Pier' },
      ],
    },
  ];
}

export function createMissions(world) {
  const defs = missionDefs(world);
  const state = world.state;
  let missionIndex = -1;
  let stageIndex = 0;
  let stageTimer = 0;
  let stageData = null;
  let taxi = null;
  let taxiCooldown = 8;
  let vanCar = null;
  let briefing = null;
  let justFinished = null;

  function current() {
    return missionIndex >= 0 && missionIndex < defs.length ? defs[missionIndex] : null;
  }

  function stage() {
    const m = current();
    return m ? m.stages[stageIndex] : null;
  }

  function enterStage() {
    const s = stage();
    if (!s) return;
    stageTimer = s.time ?? s.seconds ?? 0;
    stageData = { spawned: [], wave: 0, waveTimer: 0 };
    if (s.type === 'kill' && s.spawn) {
      for (const sp of s.spawn) {
        const e = world.makeEnemy(state.random, state.city, { kind: sp.kind, x: sp.x, y: sp.y });
        e.mission = missionIndex;
        state.enemies.push(e);
        stageData.spawned.push(e);
      }
    }
    if (s.type === 'escape') {
      world.addWanted(3 - state.wanted > 0 ? 3 - state.wanted : 0);
    }
    if (s.type === 'survive') {
      stageData.waveTimer = 2;
      // A health and an armour pickup by the garage door, so the fight is winnable.
      const g = garageDoor(world);
      world.spawnPickup('health', g.x - 90, g.y + 30);
      world.spawnPickup('armor', g.x + 90, g.y + 30);
    }
    if (s.type === 'stealVan' && vanCar) {
      // The van is already parked by the HQ from the previous stage.
    }
  }

  function nextStage() {
    const m = current();
    stageIndex += 1;
    if (stageIndex >= m.stages.length) {
      finishMission();
      return MISSION_DONE;
    }
    enterStage();
    return MISSION_STAGE;
  }

  function finishMission() {
    const m = current();
    state.cash += m.reward;
    state.stats.missionsDone += 1;
    justFinished = m;
    if (vanCar) {
      // Rosa's crew parks the delivered van on the road by the garage, clear of the door.
      const g = garageDoor(world);
      const roadX = state.city.roadsX.find((x) => x > g.x) ?? g.x + 200;
      vanCar.x = roadX;
      vanCar.y = g.y;
      vanCar.speed = 0;
      vanCar.angle = 0;
      vanCar.driver = 'parked';
    }
    missionIndex = -1;
    stageIndex = 0;
    stageData = null;
    vanCar = null;
  }

  function failMission() {
    missionIndex = -1;
    stageIndex = 0;
    stageData = null;
    vanCar = null;
    return MISSION_FAILED;
  }

  function startMission(index) {
    if (index < 0 || index >= defs.length) return false;
    missionIndex = index;
    stageIndex = 0;
    briefing = defs[index];
    enterStage();
    return true;
  }

  function spawnWave(count) {
    const g = garageDoor(world);
    for (let i = 0; i < count; i += 1) {
      const angle = range(state.random, 0, Math.PI * 2);
      const dist = range(state.random, 260, 380);
      const e = world.makeEnemy(state.random, state.city, {
        kind: 'thug',
        x: Math.max(60, Math.min(3100, g.x + Math.cos(angle) * dist)),
        y: Math.max(60, Math.min(3100, g.y + Math.sin(angle) * dist)),
      });
      e.mission = missionIndex;
      state.enemies.push(e);
      stageData.spawned.push(e);
    }
  }

  function updateTaxi(dt) {
    const p = state.player;
    taxiCooldown -= dt;
    if (!taxi) {
      if (missionIndex === -1 && p.inCar && !p.inCar.wrecked && taxiCooldown <= 0) {
        // A fare waves from the sidewalk ahead.
        const angle = range(state.random, 0, Math.PI * 2);
        const dist = range(state.random, 300, 520);
        const px = Math.max(80, Math.min(3100, p.x + Math.cos(angle) * dist));
        const py = Math.max(80, Math.min(3000, p.y + Math.sin(angle) * dist));
        const ped = world.makePed(state.random, state.city, { x: px, y: py, state: 'wait' });
        state.peds.push(ped);
        taxi = { stage: 'pickup', ped, dest: null, fare: ECONOMY.taxiFare };
      }
      return 0;
    }
    if (taxi.stage === 'pickup') {
      if (Math.hypot(taxi.ped.x - p.x, taxi.ped.y - p.y) < 55 && p.inCar) {
        taxi.ped.dead = true;
        taxi.ped.deadTimer = 99;
        const dest = randomRoadPoint(state.random, state.city);
        taxi.dest = { x: dest.x, y: dest.y };
        taxi.stage = 'dropoff';
      }
      return 0;
    }
    if (taxi.stage === 'dropoff' && Math.hypot(taxi.dest.x - p.x, taxi.dest.y - p.y) < 60 && p.inCar) {
      state.cash += taxi.fare;
      state.stats.taxiFares += 1;
      taxi = null;
      taxiCooldown = 25;
      return TAXI_DONE;
    }
    return 0;
  }

  function update(dt) {
    let events = 0;
    events |= updateTaxi(dt);
    const m = current();
    if (!m) return events;
    const s = stage();
    if (!s) return events;
    const p = state.player;

    if (s.type === 'goto') {
      if (Math.hypot(s.x - p.x, s.y - p.y) < s.radius) events |= nextStage();
    } else if (s.type === 'enterCar') {
      if (p.inCar) events |= nextStage();
    } else if (s.type === 'drive') {
      stageTimer -= dt;
      if (Math.hypot(s.x - p.x, s.y - p.y) < s.radius) {
        events |= nextStage();
      } else if (stageTimer <= 0) {
        events |= failMission();
      }
    } else if (s.type === 'kill') {
      const alive = state.enemies.some((e) => e.mission === missionIndex && !e.dead);
      if (!alive) {
        if (s.then === 'van') {
          const hq = at(world, CITY.policeHQ, 0, 140);
          vanCar = world.makeCar(state.random, state.city, { x: hq.x, y: hq.y, kind: 'armored', color: '#2b2b2b', driver: 'parked', angle: 0 });
          state.cars.push(vanCar);
        }
        events |= nextStage();
      }
    } else if (s.type === 'escape') {
      if (Math.hypot(s.x - p.x, s.y - p.y) < s.radius) events |= nextStage();
    } else if (s.type === 'loseWanted') {
      if (state.wanted === 0) events |= nextStage();
    } else if (s.type === 'stealVan') {
      if (vanCar && p.inCar === vanCar && Math.hypot(s.x - p.x, s.y - p.y) < s.radius) {
        events |= nextStage();
      }
    } else if (s.type === 'survive') {
      stageTimer -= dt;
      stageData.waveTimer -= dt;
      if (stageData.waveTimer <= 0 && stageData.wave < s.waves) {
        stageData.wave += 1;
        stageData.waveTimer = 22;
        spawnWave(1 + stageData.wave);
      }
      if (stageTimer <= 0) {
        // Clear any stragglers, then move on.
        for (const e of state.enemies) if (e.mission === missionIndex) e.dead = true;
        events |= nextStage();
      }
    }
    return events;
  }

  function objectiveText() {
    const m = current();
    if (!m) {
      if (taxi) return taxi.stage === 'pickup' ? 'Pick up the fare' : 'Drop off the fare';
      return state.stats.missionsDone >= defs.length
        ? 'Story complete — Solmar is yours. Free roam!'
        : `Go to Rosa's Garage (press E) to start: ${defs[state.stats.missionsDone].title}`;
    }
    const s = stage();
    if (!s) return '';
    let text = s.text;
    if (s.type === 'drive') text += ` — ${Math.max(0, Math.ceil(stageTimer))}s`;
    if (s.type === 'survive') text += ` — ${Math.max(0, Math.ceil(stageTimer))}s`;
    return text;
  }

  function marker() {
    const m = current();
    if (m) {
      const s = stage();
      if (!s) return null;
      if (s.type === 'goto' || s.type === 'drive' || s.type === 'escape') return { x: s.x, y: s.y };
      if (s.type === 'stealVan') return vanCar ? { x: vanCar.x, y: vanCar.y } : { x: s.x, y: s.y };
      if (s.type === 'kill' || s.type === 'survive') {
        const alive = state.enemies.find((e) => e.mission === missionIndex && !e.dead);
        return alive ? { x: alive.x, y: alive.y } : null;
      }
      if (s.type === 'enterCar' || s.type === 'loseWanted') return null;
    }
    if (taxi) {
      return taxi.stage === 'pickup' ? { x: taxi.ped.x, y: taxi.ped.y } : taxi.dest;
    }
    // No mission: point at the garage to start the next one.
    if (state.stats.missionsDone < defs.length) {
      const g = garageDoor(world);
      return { x: g.x, y: g.y };
    }
    return null;
  }

  function nearGarageDoor() {
    const g = garageDoor(world);
    const p = state.player;
    return Math.hypot(g.x - p.x, g.y - p.y) < 60 && !p.inCar;
  }

  return {
    defs,
    current,
    stage,
    startMission,
    update,
    objectiveText,
    marker,
    nearGarageDoor,
    failMission,
    get taxi() {
      return taxi;
    },
    get missionIndex() {
      return missionIndex;
    },
    get justFinished() {
      return justFinished;
    },
    clearJustFinished() {
      justFinished = null;
    },
    get briefing() {
      return briefing;
    },
    clearBriefing() {
      briefing = null;
    },
    get nextMission() {
      return state.stats.missionsDone < defs.length ? defs[state.stats.missionsDone] : null;
    },
    get stageTimer() {
      return stageTimer;
    },
  };
}
