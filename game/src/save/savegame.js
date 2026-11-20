// save/savegame.js — save and load through localStorage. Progress (money, rank,
// completed jobs, player position) survives a reload; nothing leaves the browser.

import { S, resetState } from '../core/state.js';

const KEY = 'velmara-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function saveGame() {
  const p = S.player;
  if (!p) return false;
  const data = {
    v: 1,
    money: Math.floor(p.money),
    earned: Math.floor(p.earned),
    health: Math.floor(p.health),
    ammo: p.ammo,
    reserve: p.reserve,
    x: Math.floor(p.x),
    y: Math.floor(p.y),
    missionDone: S.missionDone.slice(),
    stats: { ...S.stats },
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  let data = null;
  try {
    data = JSON.parse(window.localStorage.getItem(KEY) || 'null');
  } catch (e) {
    data = null;
  }
  if (!data || data.v !== 1) return false;
  resetState(1);
  const p = S.player;
  p.money = data.money;
  p.earned = data.earned;
  p.health = data.health;
  p.ammo = data.ammo;
  p.reserve = data.reserve;
  p.x = data.x;
  p.y = data.y;
  S.missionDone = data.missionDone || [];
  S.stats = { ...S.stats, ...(data.stats || {}) };
  S.camera.x = p.x;
  S.camera.y = p.y;
  S.mode = 'playing';
  return true;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) { /* storage unavailable */ }
}
