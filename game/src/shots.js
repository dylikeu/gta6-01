// The screenshot scenes behind ?shot=chase|walk|drive|foot|steal|wanted|mission|start.
// Each one plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (drive straight down the avenue, stand and
// aim at the Sharks, outrun the cops), so the frame is what a short game really
// looks like and the same seed always gives the same frame.

import { CITY, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 3.5;
const FOOT_SECONDS = 2;
const WANTED_SECONDS = 2.5;
const MISSION_SECONDS = 2.5;
const WALK_SECONDS = 2.5;
const STEAL_SECONDS = 1.5;

const NEUTRAL = { move: { x: 0, y: 0 }, sprint: false, aim: { x: 0, y: 0 }, shoot: false, enter: false };

function stepFor(world, missions, seconds, control) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, control);
    missions.update(STEP);
  }
}

function parkPoint(world) {
  const park = world.state.city.park;
  return { x: park.x + park.w / 2, y: park.y + park.h / 2 };
}

function mallPoint(world) {
  const lm = world.state.city.landmarks[CITY.mall];
  return { x: lm.x, y: lm.y + 90 };
}

/**
 * Set `world` (and `missions`) to the named scene and return the screen to draw over it
 * and the HUD data to show. Any unknown name stages the title.
 */
export function stageShot(name, world, missions) {
  const state = world.state;
  world.reset(true);
  missions.clearJustFinished();

  if (name === 'start') {
    stepFor(world, missions, START_SECONDS, NEUTRAL);
    return { screen: SCREEN_TITLE, ui: { hasSave: false, best: 1250 } };
  }

  if (name === 'drive') {
    // Leo in the red sedan, rolling east down Avenida Palma with traffic around him.
    const car = state.cars[0];
    car.x = 240;
    car.y = 600;
    car.angle = 0;
    car.driver = 'player';
    state.player.inCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.cash = 850;
    const drive = { ...NEUTRAL, move: { x: 0, y: -1 }, aim: { x: 1200, y: 600 } };
    stepFor(world, missions, DRIVE_SECONDS, drive);
    const park = parkPoint(world);
    return {
      screen: SCREEN_PLAY,
      ui: {
        objective: 'Drive to Palma Park',
        marker: park,
        prompt: '',
        banner: '',
        damageFlash: 0,
        hasSave: false,
        best: 0,
      },
    };
  }

  if (name === 'foot') {
    // On foot at Palma Mall, Sharks closing in, pedestrians scattering.
    const mall = mallPoint(world);
    state.player.x = mall.x - 120;
    state.player.y = mall.y + 40;
    state.player.aimAngle = 0;
    state.cash = 1240;
    state.armor = 60;
    for (let i = 0; i < 3; i += 1) {
      const e = world.makeEnemy(state.random, state.city, {
        kind: 'thug',
        x: mall.x - 110 + i * 90,
        y: mall.y + 130,
      });
      state.enemies.push(e);
    }
    const aim = { ...NEUTRAL, aim: { x: mall.x + 60, y: mall.y - 40 } };
    stepFor(world, missions, FOOT_SECONDS, aim);
    return {
      screen: SCREEN_PLAY,
      ui: {
        objective: 'Clear out the Sharks',
        marker: mall,
        prompt: '',
        banner: '',
        damageFlash: 0,
        hasSave: false,
        best: 0,
      },
    };
  }

  if (name === 'wanted' || name === 'chase') {
    // Three stars, two cop cars on Leo's tail, sirens in the air.
    const car = state.cars[0];
    car.x = 620;
    car.y = 1000;
    car.angle = 0;
    car.driver = 'player';
    state.player.inCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.wanted = 3;
    state.cash = 2100;
    car.speed = 430;
    const drive = { ...NEUTRAL, move: { x: 0, y: -1 }, aim: { x: 1400, y: 1000 } };
    stepFor(world, missions, WANTED_SECONDS, drive);
    return {
      screen: SCREEN_PLAY,
      ui: {
        objective: 'Lose the cops — stay out of sight',
        marker: { x: 600, y: 2900 },
        prompt: '',
        banner: 'Wanted level 3 — the cops are coming!',
        damageFlash: 0,
        hasSave: false,
        best: 0,
      },
    };
  }

  if (name === 'walk') {
    // On foot at the park corner: pedestrians strolling, traffic rolling past.
    state.player.x = 1380;
    state.player.y = 1380;
    state.player.aimAngle = 0;
    state.cash = 980;
    // Pull four pedestrians onto the sidewalks around the intersection so the
    // frame shows the city alive on foot, not just empty streets.
    const spots = [
      { x: 1330, y: 1370, dx: 1470, dy: 1370 },
      { x: 1470, y: 1430, dx: 1330, dy: 1430 },
      { x: 1370, y: 1330, dx: 1370, dy: 1470 },
      { x: 1430, y: 1470, dx: 1430, dy: 1330 },
    ];
    for (let i = 0; i < spots.length && i < state.peds.length; i += 1) {
      const ped = state.peds[i];
      ped.x = spots[i].x;
      ped.y = spots[i].y;
      ped.dest = { x: spots[i].dx, y: spots[i].dy };
      ped.state = 'walk';
      ped.dead = false;
    }
    // Two traffic cars rolling through the intersection so the frame shows
    // the roads alive, not just the sidewalks.
    const rollers = state.cars.filter((c) => c.driver === 'traffic').slice(0, 2);
    if (rollers[0]) {
      rollers[0].x = 1400;
      rollers[0].y = 1200;
      rollers[0].angle = Math.PI / 2;
      rollers[0].speed = 120;
      rollers[0].node = state.city.nodeIndex.get('3,3');
      rollers[0].prevNode = state.city.nodeIndex.get('3,2');
    }
    if (rollers[1]) {
      rollers[1].x = 1000;
      rollers[1].y = 1400;
      rollers[1].angle = 0;
      rollers[1].speed = 120;
      rollers[1].node = state.city.nodeIndex.get('3,3');
      rollers[1].prevNode = state.city.nodeIndex.get('2,3');
    }
    stepFor(world, missions, WALK_SECONDS, NEUTRAL);
    return {
      screen: SCREEN_PLAY,
      ui: {
        objective: missions.objectiveText(),
        marker: missions.marker(),
        prompt: '',
        banner: '',
        damageFlash: 0,
        hasSave: false,
        best: 0,
      },
    };
  }

  if (name === 'steal') {
    // About to steal a car: Leo on foot beside a stopped traffic car, the
    // prompt up, cash and pistol in the HUD. The traffic car is held still by
    // the starter car parked ahead of it (traffic stops for a car in front).
    const trafficCar = state.cars.find((c) => c.driver === 'traffic');
    const blocker = state.cars[0];
    if (trafficCar && blocker && blocker !== trafficCar) {
      trafficCar.x = 1000;
      trafficCar.y = 1000;
      trafficCar.angle = 0;
      trafficCar.speed = 0;
      trafficCar.node = state.city.nodeIndex.get('3,2');
      trafficCar.prevNode = state.city.nodeIndex.get('1,2');
      blocker.x = 1055;
      blocker.y = 1000;
      blocker.angle = 0;
      blocker.speed = 0;
      blocker.driver = 'parked';
      state.player.x = 1000;
      state.player.y = 1045;
      state.player.aimAngle = Math.PI / 2;
      state.cash = 1340;
      state.armor = 25;
    }
    stepFor(world, missions, STEAL_SECONDS, NEUTRAL);
    return {
      screen: SCREEN_PLAY,
      ui: {
        objective: missions.objectiveText(),
        marker: missions.marker(),
        prompt: 'E — Steal this car',
        banner: '',
        damageFlash: 0,
        hasSave: false,
        best: 0,
      },
    };
  }

  if (name === 'mission') {
    // Mission 2, The Shakedown, at the kill stage: Sharks at the mall, marker on them.
    state.stats.missionsDone = 1;
    missions.startMission(2);
    const mall = mallPoint(world);
    state.player.x = mall.x - 150;
    state.player.y = mall.y + 60;
    state.player.aimAngle = 0;
    state.cash = 1560;
    state.armor = 40;
    // Walk into the kill stage's trigger radius.
    state.player.x = mall.x - 60;
    state.player.y = mall.y + 30;
    const aim = { ...NEUTRAL, aim: { x: mall.x, y: mall.y } };
    stepFor(world, missions, MISSION_SECONDS, aim);
    return {
      screen: SCREEN_PLAY,
      ui: {
        objective: missions.objectiveText(),
        marker: missions.marker(),
        prompt: '',
        banner: 'The Shakedown — Rosa Delgado',
        damageFlash: 0,
        hasSave: false,
        best: 0,
      },
    };
  }

  stepFor(world, missions, START_SECONDS, NEUTRAL);
  return { screen: SCREEN_TITLE, ui: { hasSave: false, best: 0 } };
}
