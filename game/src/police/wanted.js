// police/wanted.js — the wanted level: heat from crimes, stars, and cooling off.
// 0 stars: free. 1: a patrol car. 5: the whole Velmara PD is on you.

import { S } from '../core/state.js';
import { clamp } from '../core/math.js';
import { showNotice } from '../core/state.js';

const HEAT_PER_STAR = 20;

export function wantedStars() {
  return S.wanted;
}

export function addWanted(stars, reason) {
  const before = S.wanted;
  S.heat = clamp(S.heat + stars * HEAT_PER_STAR, 0, 100);
  // Ceil, not floor: one star of heat is one star on the HUD until it fully cools.
  S.wanted = S.heat <= 0 ? 0 : clamp(Math.ceil(S.heat / HEAT_PER_STAR), 1, 5);
  if (S.wanted > before) {
    showNotice('WANTED: ' + S.wanted + ' star' + (S.wanted > 1 ? 's' : '') + (reason ? ' — ' + reason : ''));
  }
}

export function clearWanted() {
  S.wanted = 0;
  S.heat = 0;
}

// Heat cools when the player stays out of trouble and out of sight.
export function updateWanted(dt) {
  if (S.shotMode) return; // staged screenshots keep their stars lit
  const p = S.player;
  if (S.wanted === 0) { S.heat = 0; return; }
  // Being seen by police keeps the heat up; hiding cools it faster.
  let nearCop = false;
  for (const c of S.copCars) {
    if (Math.hypot(c.x - p.x, c.y - p.y) < 420) { nearCop = true; break; }
  }
  if (!nearCop) {
    for (const cop of S.cops) {
      if (Math.hypot(cop.x - p.x, cop.y - p.y) < 320) { nearCop = true; break; }
    }
  }
  const cool = nearCop ? 1.1 : 3.2;
  S.heat = Math.max(0, S.heat - cool * dt);
  const stars = S.heat <= 0 ? 0 : clamp(Math.ceil(S.heat / HEAT_PER_STAR), 1, 5);
  if (stars < S.wanted) {
    S.wanted = stars;
    if (stars === 0) showNotice('You lost the heat. The VPD moved on.');
  }
}

export function policeBudget() {
  // How many police units the current wanted level calls for.
  return [0, 1, 2, 3, 4, 5][S.wanted];
}
