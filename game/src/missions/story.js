// Story missions for VELMARA: six jobs from Mara Kline, the fixer.
// Each mission is a small state machine: start text, a live objective,
// per-frame progress, and a payout. Missions are started at the gold
// marker and can be retried after failing.
import { addCash, say, showBanner } from '../core/state.js';
import { dist, clamp } from '../core/math.js';
import { makeCar } from '../city/traffic.js';
import { raiseWanted } from '../police/wanted.js';

export const MISSIONS = [
  {
    id: 1, title: 'The Getaway', pay: 400,
    brief: 'Mara: "Courier car, Coral GT, parked by the marina. Take it — and lose the patrol."',
    objective: 'Steal the gold-marked Coral GT, then lose the VPD',
    target: { x: 2380, y: 340 },
  },
  {
    id: 2, title: 'Harbour Lights', pay: 550,
    brief: 'Mara: "Smugglers unload at the Old Harbour dock tonight. Get close, stay unseen, and snap the proof."',
    objective: 'Reach the dock marker without being spotted',
    target: { x: 300, y: 1750 },
  },
  {
    id: 3, title: 'Hot Wheels', pay: 800,
    brief: 'Mara: "The chop shop needs three rides. Bring me any three cars — quick, before the owners wake up."',
    objective: 'Deliver 3 stolen cars to the chop shop',
    target: { x: 420, y: 420 },
  },
  {
    id: 4, title: 'Payback', pay: 950,
    brief: 'Mara: "The Dune crew jumped one of ours at the yards. Go settle it. Loud is fine."',
    objective: 'Deal with the rival crew at Palm Yards',
    target: { x: 500, y: 700 },
  },
  {
    id: 5, title: 'The Long Night', pay: 1200,
    brief: 'Mara: "My van has to cross town tonight. Ride shotgun — anything that follows it, you stop."',
    objective: 'Escort the van to Downtown',
    target: { x: 1700, y: 850 },
  },
  {
    id: 6, title: 'King of the Sun', pay: 2500,
    brief: 'Mara: "One last job. The casino boat, the marina, midnight. Get in, get the take, get out a legend."',
    objective: 'Reach the casino boat, grab the take, return to Mara',
    target: { x: 3050, y: 300 },
  },
];

export function currentMissionDef(state) {
  return MISSIONS[state.missionIndex] || null;
}

export function startMission(state, sfx) {
  const def = currentMissionDef(state);
  if (!def || state.mission) return false;
  const m = { def, t: 0, stage: 0, progress: 0, need: def.id === 3 ? 3 : 1, done: false, failed: false };
  // Mission-specific setup.
  if (def.id === 1) {
    const car = makeCar(state, def.target.x, def.target.y, 0, { name: 'Coral GT', color: '#d84a4a', top: 205, accel: 300, len: 48, w: 22, price: 900 }, 'mission');
    state.cars.push(car); m.car = car;
  }
  if (def.id === 4) {
    m.rivals = [];
    for (let i = 0; i < 4; i++) {
      const r = { x: def.target.x + (i - 1.5) * 70, y: def.target.y + (i % 2) * 60 - 30, angle: 0, speed: 60, color: '#5a2e6e', panic: 0, wait: 0, tx: def.target.x, ty: def.target.y, scared: false, rival: true, health: 100 };
      state.peds.push(r); m.rivals.push(r);
    }
  }
  if (def.id === 5) {
    const van = makeCar(state, 420, 700, 0, { name: 'Harbour Van', color: '#7fa8c9', top: 120, accel: 160, len: 54, w: 24, price: 500 }, 'mission');
    van.driver = true; state.cars.push(van); m.van = van;
  }
  state.mission = m;
  state.objective = def.objective;
  say(state, 'Mara Kline', def.brief, 6);
  showBanner(state, 'MISSION ' + def.id + ' — ' + def.title.toUpperCase(), def.objective, 3.5);
  if (sfx) sfx.missionStart();
  return true;
}

export function failMission(state, reason) {
  if (!state.mission) return;
  state.mission.failed = true;
  showBanner(state, 'MISSION FAILED', reason, 3);
  say(state, 'Mara Kline', '"Shake it off. Come back when you\'re ready and we run it again."', 5);
  cleanupMission(state);
}

export function completeMission(state, sfx) {
  const m = state.mission;
  if (!m) return;
  state.missionDone[m.def.id - 1] = true;
  state.stats.missionsDone += 1;
  addCash(state, m.def.pay, 'mission ' + m.def.id);
  state.player.ammo = 24; state.player.reserveAmmo = Math.min(200, state.player.reserveAmmo + 48);
  showBanner(state, 'MISSION COMPLETE', m.def.title + ' — +$' + m.def.pay, 4);
  say(state, 'Mara Kline', m.def.id >= 6 ? '"That\'s the whole town talking about you now. King of the Sun."' : '"Clean work. The money\'s yours — come see me for the next one."', 5);
  if (sfx) sfx.missionComplete();
  state.missionIndex = Math.min(state.missionIndex + 1, MISSIONS.length - 1);
  if (state.missionDone.every(Boolean)) {
    state.missionIndex = MISSIONS.length;
    showBanner(state, 'KING OF THE SUN', 'Every job done. Velmara is yours.', 6);
  }
  cleanupMission(state);
  state.objective = state.missionIndex < MISSIONS.length ? 'Meet Mara at the gold marker' : 'All missions complete — free roam';
}

function cleanupMission(state) {
  const m = state.mission;
  if (m && m.car) { const i = state.cars.indexOf(m.car); if (i >= 0 && m.car.kind !== 'player') state.cars.splice(i, 1); }
  if (m && m.van) { const i = state.cars.indexOf(m.van); if (i >= 0) state.cars.splice(i, 1); }
  state.mission = null;
}

export function updateMission(state, dt, sfx) {
  const m = state.mission;
  if (!m) return;
  m.t += dt;
  const p = state.player;
  const def = m.def;
  const at = (x, y, r) => dist(p.x, p.y, x, y) < r;

  if (def.id === 1) {
    if (m.stage === 0 && p.car === m.car) { m.stage = 1; raiseWanted(state, 2, 'getaway'); say(state, 'Mara Kline', '"They\'re on you! Lose them — stay out of sight till the stars drop."', 4); }
    else if (m.stage === 1 && p.wanted === 0) completeMission(state, sfx);
    if (m.t > 240) failMission(state, 'Took too long');
  } else if (def.id === 2) {
    if (at(def.target.x, def.target.y, 70)) completeMission(state, sfx);
    else if (p.wanted > 0) failMission(state, 'You were spotted');
    if (m.t > 240) failMission(state, 'The ship sailed');
  } else if (def.id === 3) {
    // Deliver a stolen car to the chop shop while driving it.
    if (!p.onFoot && p.car && at(def.target.x, def.target.y, 90)) {
      m.progress += 1;
      const car = p.car;
      const i = state.cars.indexOf(car); if (i >= 0) state.cars.splice(i, 1);
      p.car = null; p.onFoot = true; p.x = def.target.x + 60; p.y = def.target.y + 60;
      addCash(state, 150, 'chop shop part-payment');
      if (m.progress >= m.need) completeMission(state, sfx);
      else { state.objective = 'Deliver ' + (m.need - m.progress) + ' more car(s) to the chop shop'; say(state, 'Mara Kline', '"One down. ' + (m.need - m.progress) + ' to go."', 3); }
    }
    if (m.t > 300) failMission(state, 'The shop closed');
  } else if (def.id === 4) {
    const alive = (m.rivals || []).filter(r => state.peds.includes(r)).length;
    // Rivals are "dealt with" when knocked down by bullets or a car.
    const down = (m.rivals || []).filter(r => !state.peds.includes(r) || r.health <= 0).length;
    state.objective = 'Deal with the rival crew (' + down + '/4)';
    if (down >= 4) completeMission(state, sfx);
    if (m.t > 300) failMission(state, 'The crew slipped away');
  } else if (def.id === 5) {
    if (m.van) {
      // Van drives itself toward Downtown along the roads.
      const tx = 1700, ty = 850;
      const a = Math.atan2(ty - m.van.y, tx - m.van.x);
      m.van.angle += clamp(((a - m.van.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1.4 * dt, 1.4 * dt);
      m.van.speed = 95;
      m.van.x += Math.cos(m.van.angle) * m.van.speed * dt;
      m.van.y += Math.sin(m.van.angle) * m.van.speed * dt;
      if (dist(m.van.x, m.van.y, tx, ty) < 110) completeMission(state, sfx);
      if (m.van.health <= 0) failMission(state, 'The van was destroyed');
    }
    if (m.t > 300) failMission(state, 'The van never arrived');
  } else if (def.id === 6) {
    if (m.stage === 0 && at(def.target.x, def.target.y, 90)) {
      m.stage = 1; raiseWanted(state, 3, 'casino heist');
      say(state, 'Mara Kline', '"You\'ve got the take! Now get back to me — and don\'t get caught."', 4);
      state.objective = 'Return to Mara with the take';
    } else if (m.stage === 1 && at(state.city.landmarks.maraSpot.x, state.city.landmarks.maraSpot.y, 90) && p.wanted <= 2) {
      completeMission(state, sfx);
    }
    if (m.t > 300) failMission(state, 'The boat left port');
  }
}

// Rival peds take bullet damage via combat: mark them when hit.
export function hitRival(state, rival) {
  rival.health -= 34;
  if (rival.health <= 0) {
    const i = state.peds.indexOf(rival);
    if (i >= 0) state.peds.splice(i, 1);
  }
}
