// The single mutable game state. Every system reads and writes this object, so a
// screenshot scene, a save file and the live game all speak the same language.
import { PLAYER } from './config.js';
import { mulberry32 } from './random.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  WASTED: 'wasted',
  BUSTED: 'busted',
  STORY_DONE: 'story-done',
  PAUSED: 'paused',
};

export function createGameState(seed) {
  return {
    seed,
    rng: mulberry32(seed + 555), // seeded rng for ambient randomness (deterministic shots)
    time: 0,
    screen: SCREEN.TITLE,
    paused: false,
    frozen: false, // screenshot staging freezes the sim after the scene is set
    freeRoam: false,
    // Player (Dante Cruz).
    player: {
      pos: { x: -162, y: 0, z: 48 }, // beach-road corner: on the road, facing the city
      heading: Math.PI / 2,
      speed: 0,
      health: PLAYER.maxHealth,
      armor: 0,
      money: PLAYER.startMoney,
      onFoot: true,
      car: null, // the car object Dante is driving, or null
      weapon: 'pistol',
      ammo: Infinity,
      wanted: 0,
      heatTimer: 0, // seconds since the last crime
      moving: false,
      running: false,
      shooting: false,
      aimYaw: 0,
      mesh: null,
      walkPhase: 0,
    },
    // World objects, filled by city.js / traffic.js / police.js.
    cars: [],        // every drivable car: { mesh, pos, heading, speed, kind, color, ... }
    peds: [],        // pedestrians: { mesh, pos, heading, speed, state, ... }
    colliders: [],   // building AABBs { minX, maxX, minZ, maxZ }
    markers: [],     // objective markers
    police: {
      cars: [],
      heli: null,
      bustedTimer: 0,
      spawnTimer: 0,
    },
    missions: {
      index: 0,          // 0..7 story jobs
      active: null,      // active mission runtime object
      completed: 0,
      dialog: null,      // { lines, lineIndex, speaker, portrait, onDone }
      banner: null,      // { text, sub, until }
      objectiveText: '',
      objectivePos: null,
      objectiveKind: null, // 'goto' | 'steal' | 'eliminate' | 'escape' | 'pickup'
      objectiveCount: 0,
      objectiveTarget: 0,
    },
    stats: {
      carsStolen: 0,
      shotsFired: 0,
      enemiesDown: 0,
      missionsDone: 0,
      moneyEarned: 0,
      distanceDriven: 0,
    },
    camera: {
      yaw: 0,
      pitch: 0.32,
      distance: 7,
      shake: 0,
    },
    radio: { station: 0, muted: false },
    flags: {
      started: false,
      storyDone: false,
      busted: false,
      wasted: false,
    },
    // Debug / test hooks (also used by the screenshot stager).
    debug: {},
  };
}

export function addMoney(state, amount) {
  state.player.money += amount;
  if (amount > 0) state.stats.moneyEarned += amount;
  return state.player.money;
}

export function setWanted(state, stars) {
  state.player.wanted = Math.max(0, Math.min(5, stars));
  state.player.heatTimer = 0;
}

export function addWanted(state, stars) {
  setWanted(state, state.player.wanted + stars);
}

export function damagePlayer(state, amount) {
  if (state.screen !== SCREEN.PLAY) return;
  let left = amount;
  if (state.player.armor > 0) {
    const absorbed = Math.min(state.player.armor, left);
    state.player.armor -= absorbed;
    left -= absorbed;
  }
  state.player.health = Math.max(0, state.player.health - left);
  if (state.player.health <= 0) {
    state.flags.wasted = true;
    state.screen = SCREEN.WASTED;
  }
}

export function healPlayer(state, amount) {
  state.player.health = Math.min(PLAYER.maxHealth, state.player.health + amount);
}
