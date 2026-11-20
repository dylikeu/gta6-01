// Wanted level rules for VELMARA (0–5 stars).
// Stars rise with crimes, fall when the player stays unseen; at 3+ stars
// the VPD sets roadblocks, at 5 a helicopter shadow circles overhead.
import { clamp } from '../core/math.js';
import { showBanner } from '../core/state.js';

export const WANTED_LABELS = [
  'Clean', 'Suspicious', 'Wanted', 'Dangerous', 'Most Wanted', 'Citywide Manhunt',
];

export function wantedLabel(stars) { return WANTED_LABELS[clamp(stars, 0, 5)]; }

// How many police units the heat calls for.
export function policeBudget(stars) {
  return [0, 1, 2, 3, 4, 5][clamp(stars, 0, 5)];
}

export function roadblocksActive(stars) { return stars >= 3; }

export function raiseWanted(state, stars, why) {
  const p = state.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + stars, 0, 5);
  p.heat = 100;
  if (p.wanted > before) {
    showBanner(state, 'WANTED — ' + p.wanted + (p.wanted === 1 ? ' STAR' : ' STARS'), wantedLabel(p.wanted), 2.5);
    state.log.push('wanted ' + before + ' -> ' + p.wanted + ' (' + (why || 'crime') + ')');
  }
  return p.wanted;
}

export function clearWanted(state, why) {
  state.player.wanted = 0;
  state.player.heat = 0;
  state.log.push('wanted cleared (' + (why || 'paid off') + ')');
}

// Bribing a fixer contact costs cash and drops one star.
export function bribeCost(stars) { return stars * 150; }
export function canBribe(state) {
  return state.player.wanted > 0 && state.player.money >= bribeCost(state.player.wanted);
}
export function bribe(state) {
  const cost = bribeCost(state.player.wanted);
  if (state.player.money < cost || state.player.wanted === 0) return false;
  state.player.money -= cost;
  state.player.wanted -= 1;
  state.player.heat = state.player.wanted > 0 ? 60 : 0;
  showBanner(state, 'HEAT PAID DOWN', 'Mara smoothed things over — $' + cost, 2.5);
  return true;
}
