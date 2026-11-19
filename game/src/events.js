// What happened in one fixed step, as bit flags, so the caller (main.js) can react
// — sound, screens, missions — without the simulation knowing about screens.
// Missions define their own flags in missions.js; these are the world's.
export const EVENT_SHOT = 1;
export const EVENT_ENEMY_SHOT = 2;
export const EVENT_HIT = 4;
export const EVENT_KILL = 8;
export const EVENT_WANTED_UP = 16;
export const EVENT_WANTED_DOWN = 32;
export const EVENT_PICKUP = 64;
export const EVENT_CAR_STOLEN = 128;
export const EVENT_CRASH = 256;
export const EVENT_WASTED = 512;
export const EVENT_BUSTED = 1024;
export const EVENT_WRECKED = 2048;
export const EVENT_PED_DOWN = 4096;
