// Shared game state for VELMARA: one plain object created fresh per run.
// Everything the systems need lives here so main.js can wire them up
// without globals, and the self-test can build a state and poke it.
import { makeRng } from './math.js';

export const WORLD_W = 3400;
export const WORLD_H = 2600;
export const VIEW_W = 1280;
export const VIEW_H = 800;

export const RANKS = [
  { at: 0, name: 'Wheelman' },
  { at: 800, name: 'Street Runner' },
  { at: 2500, name: 'Wheel Boss' },
  { at: 6000, name: 'Sunset King' },
  { at: 12000, name: 'King of the Sun' },
];

export function rankFor(cash) {
  let rank = RANKS[0];
  for (const r of RANKS) if (cash >= r.at) rank = r;
  return rank;
}

export function createState(seed) {
  return {
    seed: seed || 7,
    rng: makeRng(seed || 7),
    time: 0,            // seconds since run started
    dayT: 0.32,         // 0..1 time of day (0.32 = late afternoon sun)
    paused: false,
    started: false,     // past the title screen
    gameOver: false,
    busted: false,
    muted: false,
    // Player
    player: {
      x: 1700, y: 1500, angle: -Math.PI / 2, speed: 0,
      onFoot: true, car: null, health: 100, money: 250,
      ammo: 24, reserveAmmo: 96, wanted: 0, heat: 0,
      sprint: false, moving: false, punchCd: 0, shootCd: 0,
      invuln: 0, dead: false,
    },
    camera: { x: 1700, y: 1500, zoom: 1 },
    // World content (filled by city/map.js + city/traffic.js)
    city: null,
    cars: [],           // traffic + parked + police cars
    peds: [],
    cops: [],           // police on foot
    bullets: [],
    pickups: [],
    particles: [],
    floaters: [],       // floating text popups
    // Missions
    missionIndex: 0,
    mission: null,      // active mission runtime object
    missionDone: [false, false, false, false, false, false],
    dialogue: null,     // {who, text, t, dur}
    banner: null,       // {title, sub, t, dur}
    objective: 'Meet Mara at the gold marker',
    // Stats
    stats: { carsStolen: 0, copsDodged: 0, missionsDone: 0, shotsFired: 0, cashEarned: 0 },
    // Input (filled by main.js)
    keys: {},
    mouse: { x: VIEW_W / 2, y: VIEW_H / 2, down: false, clicked: false },
    // Test / shot hooks
    testMode: false,
    testResults: [],
    shotMode: null,
    log: [],
  };
}

export function addCash(state, amount, why) {
  state.player.money += amount;
  if (amount > 0) state.stats.cashEarned += amount;
  state.floaters.push({ x: state.player.x, y: state.player.y - 30, text: (amount > 0 ? '+' : '') + '$' + amount, color: amount > 0 ? '#7dff8a' : '#ff7d7d', t: 0, dur: 1.6 });
  if (why) state.log.push(why + ' $' + amount);
}

export function showBanner(state, title, sub, dur) {
  state.banner = { title, sub: sub || '', t: 0, dur: dur || 3 };
}

export function say(state, who, text, dur) {
  state.dialogue = { who, text, t: 0, dur: dur || 4.5 };
}

export function addParticles(state, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = state.rng() * Math.PI * 2;
    const s = (speed || 120) * (0.4 + state.rng() * 0.8);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, t: 0, dur: 0.5 + state.rng() * 0.5, size: 2 + state.rng() * 3 });
  }
}
