// SOLARA — Streets of Coral Bay. Shared constants and the seeded random
// number generator every system uses, so the same seed always builds the
// same city, the same traffic and the same screenshot scenes.
export const WORLD_HALF = 230;
export const SEA_LINE = -170;
export const SAND_LINE = -150;
export const ROAD_WIDTH = 10;
export const SAVE_KEY = 'solara-save-v1';

// Avenues run along X, streets run along Z. Ocean Drive hugs the beach.
export const AVENUES = [-140, -85, -30, 25, 80, 135, 190];
export const STREETS = [-170, -115, -60, -5, 50, 105, 160];

export const PALETTE = {
  sunsetTop: 0x2b1a4d,
  sunsetMid: 0xff7a3d,
  sunsetLow: 0xffc46b,
  fog: 0xf58a4c,
  sea: 0x1d7f8e,
  seaDeep: 0x0e4d63,
  sand: 0xe8c98f,
  asphalt: 0x2e2e38,
  sidewalk: 0x8d8578,
  grass: 0x4d8a4a,
  building: [0xffb59e, 0x7fd4c1, 0xffe08a, 0xc9a7e8, 0xff8f7a, 0x9ecfff, 0xf5e6c8, 0x8fe3a0],
  car: [0xe63b2e, 0xffc93c, 0x2ec4b6, 0x4361ee, 0xf72585, 0x80ed99, 0xff7b00, 0x7209b7, 0xffffff, 0x222222],
  palmTrunk: 0x8a5a33,
  palmLeaf: 0x3f9e4d,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.6,
  maxHealth: 100,
  maxArmor: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseMax: 10,
  maxSpeed: 38,
  steer: 1.9,
  grip: 6,
};

export const RADIO_STATIONS = [
  { name: 'SOLARA FM 88.1', song: 'Neon Palms — The Drifters', bpm: 96, root: 55, scale: [0, 3, 5, 7, 10] },
  { name: 'CORAL WAVE 102.4', song: 'Sunset Static — Marina Blue', bpm: 118, root: 50, scale: [0, 2, 4, 7, 9] },
  { name: 'BAY TALK 1450 AM', song: 'Coral Bay Nights — DJ Marisol', bpm: 80, root: 48, scale: [0, 3, 5, 8, 10] },
];

export const CONTROLS_TEXT =
  'WASD move / drive · SHIFT sprint · E enter or exit car · SPACE or CLICK shoot · Q rob a pedestrian · R reload · T radio station · P pause';

/** Mulberry32: a tiny deterministic PRNG. Same seed, same city. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item from an array with the seeded rng. */
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/** Clamp a number between min and max. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Shortest signed angle difference, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 2D distance between two {x, z} points. */
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Format dollars with commas, e.g. 12345 -> $12,345. */
export function moneyString(amount) {
  return '$' + Math.floor(amount).toLocaleString('en-US');
}
