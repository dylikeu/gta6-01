// localStorage save / load for VELMARA.
const KEY = 'velmara-save-v1';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      v: 1, money: p.money, health: p.health, ammo: p.ammo, reserveAmmo: p.reserveAmmo,
      x: p.x, y: p.y, wanted: p.wanted,
      missionIndex: state.missionIndex, missionDone: state.missionDone,
      stats: state.stats, savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}

export function hasSave() { return loadGame() !== null; }

export function applySave(state, d) {
  const p = state.player;
  p.money = d.money; p.health = d.health; p.ammo = d.ammo; p.reserveAmmo = d.reserveAmmo;
  p.x = d.x; p.y = d.y; p.wanted = d.wanted || 0; p.heat = p.wanted > 0 ? 80 : 0;
  state.missionIndex = d.missionIndex || 0;
  state.missionDone = d.missionDone || [false, false, false, false, false, false];
  state.stats = Object.assign(state.stats, d.stats || {});
  state.camera.x = p.x; state.camera.y = p.y;
  state.objective = state.missionIndex < 6 ? 'Meet Mara at the gold marker' : 'All missions complete — free roam';
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
