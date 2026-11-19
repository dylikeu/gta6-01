// Saving and loading: one JSON blob in localStorage. A save holds the cash, the health and
// armour, the weapon, how far the story has got, the side-job counts and where Leo stands.
// The city, traffic and pedestrians are re-rolled from the seed on load, so a save is small
// and a load never has to rebuild a broken world.

import { SAVE_KEY } from './config.js';

export function saveGame(world, missions) {
  const state = world.state;
  const data = {
    version: 1,
    cash: state.cash,
    health: state.health,
    armor: state.armor,
    weapon: state.weapon,
    shotgunAmmo: state.shotgunAmmo,
    missionsDone: state.stats.missionsDone,
    stats: state.stats,
    player: { x: state.player.x, y: state.player.y },
    clock: state.clock,
    time: state.time,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(world, data) {
  const state = world.state;
  state.cash = data.cash;
  state.health = data.health;
  state.armor = data.armor;
  state.weapon = data.weapon;
  state.shotgunAmmo = data.shotgunAmmo;
  state.stats.missionsDone = data.missionsDone;
  state.stats = { ...state.stats, ...data.stats };
  state.player.x = data.player.x;
  state.player.y = data.player.y;
  state.player.inCar = null;
  state.clock = data.clock;
  state.time = data.time;
  state.wanted = 0;
  state.wantedTimer = 0;
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
