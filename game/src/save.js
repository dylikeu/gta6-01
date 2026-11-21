// Save / continue: one localStorage slot with money, story progress and stats.
// The game never writes anything else to storage.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: state.player.money,
      missionsDone: state.missions.completed,
      carsStolen: state.stats.carsStolen,
      enemiesDown: state.stats.enemiesDown,
      moneyEarned: state.stats.moneyEarned,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(state, data) {
  state.player.money = data.money;
  state.missions.completed = data.missionsDone;
  state.stats.carsStolen = data.carsStolen || 0;
  state.stats.enemiesDown = data.enemiesDown || 0;
  state.stats.moneyEarned = data.moneyEarned || 0;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
