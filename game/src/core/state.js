// core/state.js — the single shared game state for VELMARA.
// Every system reads and writes this one object; nothing else holds game truth.
// main.js owns the loop and calls resetState() when a new game starts.

import { mulberry32 } from './math.js';

export const WORLD = 3200; // world is a square, WORLD x WORLD pixels

export const RANKS = [
  { at: 0, name: 'Rookie' },
  { at: 500, name: 'Wheelman' },
  { at: 1500, name: 'Hustler' },
  { at: 3000, name: 'Street King' },
  { at: 6000, name: 'Kingpin of Velmara' },
];

export function rankFor(earned) {
  let name = RANKS[0].name;
  for (const r of RANKS) if (earned >= r.at) name = r.name;
  return name;
}

export const S = {
  mode: 'title', // title | playing | paused | busted | finished
  time: 0,
  rng: mulberry32(1),
  seed: 1,
  camera: { x: 1600, y: 1600, zoom: 1 },
  keys: {},
  mouse: { x: 0, y: 0, down: false, clicked: false },
  player: null,
  car: null, // the car the player is currently driving (null on foot)
  cars: [], // traffic + parked + mission cars
  peds: [],
  cops: [], // foot police
  copCars: [], // police cars
  bullets: [],
  enemies: [],
  pickups: [],
  particles: [],
  floaters: [], // floating score text
  wanted: 0, // 0..5 stars
  heat: 0, // 0..100, drives wanted changes and decay
  bustedTimer: 0,
  missionIndex: -1, // -1 = no mission active, 0..5 story missions
  missionStage: 0,
  missionTimer: 0,
  missionMarker: null, // {x, y, label}
  missionDone: [], // completed mission ids
  dialog: null, // {lines:[{who,text}], idx} or null
  banner: null, // {title, sub, t} big center announcement
  notice: null, // {text, t} small toast under the objective
  stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, kills: 0, missions: 0 },
  pausedByDialog: false,
  shotMode: null, // 'chase' | 'foot' | 'mission' | 'combat' when staging a screenshot
  testMode: false,
  muted: false,
};

export function freshPlayer() {
  return {
    x: 620, y: 620, angle: -Math.PI / 2, speed: 0,
    health: 100, maxHealth: 100,
    money: 40, earned: 0,
    ammo: 12, reserve: 48, magSize: 12,
    onFoot: true, walkSpeed: 185,
    shootCd: 0, hurtCd: 0, interactCd: 0,
  };
}

export function resetState(seed) {
  S.mode = 'playing';
  S.time = 0;
  S.seed = seed || 1;
  S.rng = mulberry32(S.seed);
  S.camera = { x: 620, y: 620, zoom: 1 };
  S.keys = {};
  S.mouse = { x: 0, y: 0, down: false, clicked: false };
  S.player = freshPlayer();
  S.car = null;
  S.cars = [];
  S.peds = [];
  S.cops = [];
  S.copCars = [];
  S.bullets = [];
  S.enemies = [];
  S.pickups = [];
  S.particles = [];
  S.floaters = [];
  S.wanted = 0;
  S.heat = 0;
  S.bustedTimer = 0;
  S.missionIndex = -1;
  S.missionStage = 0;
  S.missionTimer = 0;
  S.missionMarker = null;
  S.missionDone = [];
  S.dialog = null;
  S.banner = null;
  S.notice = null;
  S.stats = { carsStolen: 0, pedsHit: 0, shotsFired: 0, kills: 0, missions: 0 };
  S.pausedByDialog = false;
  return S;
}

export function addMoney(n) {
  S.player.money += n;
  S.player.earned += n;
}

export function showBanner(title, sub) {
  S.banner = { title, sub: sub || '', t: 3.2 };
}

export function showNotice(text) {
  S.notice = { text, t: 3.0 };
}
