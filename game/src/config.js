// SOLARA — Streets of Coral Bay: every tuning number lives here so the rest of the
// game reads plain English instead of magic constants.
export const GAME_TITLE = 'SOLARA';
export const GAME_SUBTITLE = 'Streets of Coral Bay';
export const SAVE_KEY = 'solara-save-v1';

// World layout (metres). The city is a grid of blocks; the beach and ocean sit west.
export const CITY = {
  halfSize: 168,          // city spans -168..168 on x and z
  block: 42,              // block size
  road: 12,               // road width
  beachX: -168,           // sand starts here
  waterX: -196,           // ocean starts here
  oceanX: -560,           // ocean plane edge
  wallX: -188,            // invisible wall in the water
  maxCoord: 190,
};

// Sunset palette: warm orange sky, purple dusk overhead, teal sea.
export const PALETTE = {
  skyTop: 0x2b1848,
  skyMid: 0xb34a6e,
  skyHorizon: 0xff8a3d,
  sun: 0xffd27a,
  fog: 0xe87a4e,
  ocean: 0x1e6f8e,
  oceanDeep: 0x0f4a66,
  sand: 0xe8c98f,
  sandWet: 0xc9a86f,
  asphalt: 0x33323e,
  asphaltLine: 0xe8d27a,
  sidewalk: 0x8a7f78,
  building: [0xe86a6a, 0xf2a65a, 0x7fb069, 0x5aa9e6, 0xc77dff, 0xf9c74f, 0xef8354, 0x90be6d, 0x4cc9f0, 0xff8fa3],
  palmTrunk: 0x7a5230,
  palmLeaf: 0x3f9d4e,
  danteJacket: 0x2ec4b6,
  dantePants: 0x2b2d42,
  danteSkin: 0xc68e5f,
  danteHair: 0x1d1a16,
};

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 9.0,
  turnSpeed: 9.0,
  radius: 0.55,
  maxHealth: 100,
  maxArmor: 100,
  startMoney: 150,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 9,
  steer: 1.9,
  grip: 6.0,
  radius: 1.6,
};

export const WANTED = {
  decaySeconds: 26,
  maxStars: 5,
  policePerStar: [0, 1, 2, 3, 4, 5],
  heliAtStars: 3,
  shootRange: 55,
  bustedSeconds: 2.0,
};

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 60,
  pistolFireRate: 0.22,
  pistolAmmo: Infinity,
  policeShotDamage: 4,
  policeShotInterval: 0.9,
};

// Radio stations (WebAudio synth loops, no audio files).
export const RADIO = [
  { name: 'SOLARA FM', song: 'Sunset Drive — The Palms', bpm: 96, root: 45, scale: [0, 3, 5, 7, 10] },
  { name: 'PALM 98.5', song: 'Neon Nights — Velvet Coast', bpm: 118, root: 41, scale: [0, 2, 3, 7, 8] },
  { name: 'WAVE 101', song: 'Ocean Breeze — Coral Static', bpm: 82, root: 48, scale: [0, 2, 4, 7, 9] },
];

// Mission rewards and the story arc live in missions.js; these are the economy knobs.
export const ECONOMY = {
  stealCarBounty: 0,
  pedRobCash: 25,
  missionBonusPerStar: 50,
};
