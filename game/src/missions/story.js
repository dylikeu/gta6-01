// missions/story.js — the story of Velmara: six jobs from Mara Kline, the fixer who
// runs the city from a booth at the Sunset Diner. Each mission is a small state
// machine: stages advance on position, theft, collection, combat or escape.

import { S, addMoney, showBanner, showNotice } from '../core/state.js';
import { dist, clamp } from '../core/math.js';
import { makeCar } from '../city/traffic.js';
import { spawnEnemy } from '../player/combat.js';
import { addWanted, clearWanted } from '../police/wanted.js';
import { playSfx } from '../audio/sfx.js';
import { saveGame } from '../save/savegame.js';

export const MISSIONS = [
  {
    id: 0, title: 'First Fare', reward: 150,
    brief: [
      { who: 'Mara Kline', text: 'Velmara runs on favours, kid. First one is easy.' },
      { who: 'Mara Kline', text: 'There is a yellow cab waiting by the diner. Take it to the pier — a tourist pays cash, no questions.' },
    ],
    objective: 'Get in the yellow cab',
  },
  {
    id: 1, title: 'Hot Wheels', reward: 300,
    brief: [
      { who: 'Mara Kline', text: 'A Comet is parked outside the Downtown bank. The owner owes me.' },
      { who: 'Mara Kline', text: 'Take it. Bring it to my garage on Palm Row. Try not to scratch the paint.' },
    ],
    objective: 'Steal the Comet sports car',
  },
  {
    id: 2, title: 'Dockside Debt', reward: 400,
    brief: [
      { who: 'Mara Kline', text: 'Three dock workers borrowed from me and forgot. Go remind them.' },
      { who: 'Mara Kline', text: 'Walk up to each one and press E. Be polite. Mostly.' },
    ],
    objective: 'Collect from 3 debtors at the docks',
  },
  {
    id: 3, title: 'The Getaway', reward: 500,
    brief: [
      { who: 'Mara Kline', text: 'My courier is stuck at the plaza with a bag the VPD wants.' },
      { who: 'Mara Kline', text: 'Pick the bag up, then lose the heat and get to the safehouse. Drive like the sun is setting on you.' },
    ],
    objective: 'Pick up the bag at the plaza',
  },
  {
    id: 4, title: "King's Ransom", reward: 700,
    brief: [
      { who: 'Mara Kline', text: 'The Brass Kings took my briefcase to their warehouse. They have guns. So do you.' },
      { who: 'Mara Kline', text: 'Clear the warehouse, grab the case, bring it to the diner. No survivors with a grudge.' },
    ],
    objective: 'Go to the Brass Kings warehouse',
  },
  {
    id: 5, title: 'Sunset Run', reward: 1000,
    brief: [
      { who: 'Mara Kline', text: 'Last job. A package at the docks, a buyer on Sunset Beach, ninety seconds of daylight.' },
      { who: 'Mara Kline', text: 'The VPD will be on you the moment you move. Make it count, and Velmara is yours.' },
    ],
    objective: 'Grab the package at the docks',
  },
];

const PIER = { x: 2600, y: 2960 };
const GARAGE = { x: 1000, y: 2620 };
const PLAZA = { x: 1800, y: 1800 };
const SAFEHOUSE = { x: 620, y: 2620 };
const WAREHOUSE = { x: 2620, y: 1000 };
const DINER = { x: 1420, y: 2220 };
const DOCKS_PKG = { x: 320, y: 1400 };

export function missionById(id) {
  return MISSIONS[id];
}

export function currentMission() {
  return S.missionIndex >= 0 ? MISSIONS[S.missionIndex] : null;
}

export function objectiveText() {
  const m = currentMission();
  if (!m) return S.missionDone.length >= 6 ? 'Velmara is yours. Free roam.' : 'Visit Mara at the Sunset Diner to start a job';
  switch (m.id) {
    case 0: return S.missionStage === 0 ? 'Get in the yellow cab' : 'Drive the cab to the pier';
    case 1: return S.missionStage === 0 ? 'Steal the Comet sports car' : 'Deliver the Comet to the garage';
    case 2: return 'Collect from the debtors (' + S.missionStage + '/3)';
    case 3: return S.missionStage === 0 ? 'Pick up the bag at the plaza' : 'Lose the heat — reach the safehouse';
    case 4:
      if (S.missionStage === 0) return 'Go to the Brass Kings warehouse';
      if (S.missionStage === 1) return 'Clear the warehouse (' + (4 - S.enemies.length) + '/4 down)';
      if (S.missionStage === 2) return 'Grab the briefcase';
      return 'Deliver the briefcase to the diner';
    case 5: return S.missionStage === 0 ? 'Grab the package at the docks' : 'Deliver to Sunset Beach — ' + Math.ceil(S.missionTimer) + 's left';
    default: return m.objective;
  }
}

export function startMission(id) {
  const m = MISSIONS[id];
  S.missionIndex = id;
  S.missionStage = 0;
  S.missionTimer = 0;
  S.missionMarker = null;
  S.dialog = { lines: m.brief.slice(), idx: 0 };
  S.pausedByDialog = true;
  playSfx('mission');
  setupMissionStage();
}

function setupMissionStage() {
  const m = currentMission();
  if (!m) return;
  const rng = S.rng;
  if (m.id === 0) {
    if (S.missionStage === 0) {
      const cab = makeCar(660, 700, 'taxi', '#f1c40f');
      cab.parked = true; cab.driver = false; cab.mission = true;
      S.cars.push(cab);
      S.missionMarker = { x: cab.x, y: cab.y, label: 'CAB' };
    } else {
      S.missionMarker = { x: PIER.x, y: PIER.y, label: 'PIER' };
    }
  } else if (m.id === 1) {
    if (S.missionStage === 0) {
      const comet = makeCar(1420, 1470, 'sport', '#e74c3c');
      comet.parked = true; comet.driver = false; comet.mission = true;
      S.cars.push(comet);
      S.missionMarker = { x: comet.x, y: comet.y, label: 'COMET' };
    } else {
      S.missionMarker = { x: GARAGE.x, y: GARAGE.y, label: 'GARAGE' };
    }
  } else if (m.id === 2) {
    if (S.missionStage === 0) {
      const spots = [{ x: 320, y: 1000 }, { x: 320, y: 1800 }, { x: 320, y: 2200 }];
      for (const s of spots) {
        S.peds.push({
          x: s.x, y: s.y, angle: 0, speed: 0, color: '#6c5ce7',
          state: 'walk', panic: 0, tx: s.x, ty: s.y, debtor: true, name: 'Debtor',
        });
      }
      S.missionMarker = { x: 320, y: 1000, label: '$' };
    }
  } else if (m.id === 3) {
    if (S.missionStage === 0) {
      S.missionMarker = { x: PLAZA.x, y: PLAZA.y, label: 'BAG' };
      S.pickups.push({ x: PLAZA.x, y: PLAZA.y, kind: 'cash', amount: 0, t: 0, bag: true });
    } else {
      S.missionMarker = { x: SAFEHOUSE.x, y: SAFEHOUSE.y, label: 'SAFEHOUSE' };
    }
  } else if (m.id === 4) {
    if (S.missionStage === 0) {
      S.missionMarker = { x: WAREHOUSE.x, y: WAREHOUSE.y, label: 'WAREHOUSE' };
    } else if (S.missionStage === 1) {
      const spots = [{ x: 2560, y: 940 }, { x: 2700, y: 1060 }, { x: 2580, y: 1120 }, { x: 2680, y: 920 }];
      for (const s of spots) spawnEnemy(s.x, s.y);
      S.missionMarker = { x: WAREHOUSE.x, y: WAREHOUSE.y, label: 'CLEAR THEM' };
    } else if (S.missionStage === 2) {
      S.pickups.push({ x: WAREHOUSE.x, y: WAREHOUSE.y, kind: 'cash', amount: 0, t: 0, briefcase: true });
      S.missionMarker = { x: WAREHOUSE.x, y: WAREHOUSE.y, label: 'BRIEFCASE' };
    } else {
      S.missionMarker = { x: DINER.x, y: DINER.y, label: 'DINER' };
    }
  } else if (m.id === 5) {
    if (S.missionStage === 0) {
      S.pickups.push({ x: DOCKS_PKG.x, y: DOCKS_PKG.y, kind: 'cash', amount: 0, t: 0, package: true });
      S.missionMarker = { x: DOCKS_PKG.x, y: DOCKS_PKG.y, label: 'PACKAGE' };
    } else {
      S.missionTimer = 90;
      addWanted(2, 'the Sunset Run');
      S.missionMarker = { x: PIER.x, y: PIER.y, label: 'BEACH' };
    }
  }
}

function advanceStage() {
  S.missionStage++;
  setupMissionStage();
  playSfx('stage');
}

export function completeMission() {
  const m = currentMission();
  if (!m) return;
  addMoney(m.reward);
  S.missionDone.push(m.id);
  S.stats.missions++;
  S.missionIndex = -1;
  S.missionStage = 0;
  S.missionMarker = null;
  showBanner('JOB DONE — ' + m.title.toUpperCase(), '+' + '$' + m.reward + '  •  Rank: ' + rankName());
  playSfx('complete');
  saveGame();
  if (S.missionDone.length >= 6) {
    showBanner('KINGPIN OF VELMARA', 'Every job done. The city is yours — free roam.');
    playSfx('win');
  }
}

function rankName() {
  const earned = S.player.earned;
  const ranks = [[0, 'Rookie'], [500, 'Wheelman'], [1500, 'Hustler'], [3000, 'Street King'], [6000, 'Kingpin of Velmara']];
  let name = 'Rookie';
  for (const [at, n] of ranks) if (earned >= at) name = n;
  return name;
}

export function failMission(reason) {
  const m = currentMission();
  if (!m) return;
  S.missionIndex = -1;
  S.missionStage = 0;
  S.missionMarker = null;
  S.enemies = [];
  showNotice('Job failed: ' + reason + '. Visit Mara to try again.');
  playSfx('fail');
}

// E pressed near something mission-related. Returns true if it consumed the press.
export function interactWithMission() {
  const p = S.player;
  const m = currentMission();
  // Debtors: collect one.
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (!ped.debtor) continue;
    if (dist(p.x, p.y, ped.x, ped.y) < 64) {
      S.peds.splice(i, 1);
      addMoney(60);
      showNotice('Collected $60 from a debtor');
      playSfx('coin');
      if (m && m.id === 2) {
        S.missionStage++;
        const left = S.peds.filter((q) => q.debtor);
        if (left.length > 0) S.missionMarker = { x: left[0].x, y: left[0].y, label: '$' };
        if (S.missionStage >= 3) completeMission();
      }
      return true;
    }
  }
  // Mission pickups: bag, briefcase, package.
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const pk = S.pickups[i];
    if (!pk.bag && !pk.briefcase && !pk.package) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 64) {
      S.pickups.splice(i, 1);
      playSfx('coin');
      if (pk.bag && m && m.id === 3 && S.missionStage === 0) {
        showNotice('Bag secured. The VPD is coming — run!');
        addWanted(3, 'grabbed the bag');
        advanceStage();
      } else if (pk.briefcase && m && m.id === 4 && S.missionStage === 2) {
        showNotice('Briefcase secured. Take it to the diner.');
        advanceStage();
      } else if (pk.package && m && m.id === 5 && S.missionStage === 0) {
        showNotice('Package grabbed. Ninety seconds to the beach!');
        advanceStage();
      }
      return true;
    }
  }
  // Start the next job at the diner when no mission is active.
  if (!m && dist(p.x, p.y, DINER.x, DINER.y) < 90) {
    const next = MISSIONS.find((mm) => !S.missionDone.includes(mm.id));
    if (next) startMission(next.id);
    return true;
  }
  return false;
}

export function updateMission(dt) {
  const m = currentMission();
  if (!m) return;
  const p = S.player;
  switch (m.id) {
    case 0:
      if (S.missionStage === 0 && S.car && S.car.type === 'taxi') advanceStage();
      else if (S.missionStage === 1 && dist(p.x, p.y, PIER.x, PIER.y) < 90) completeMission();
      break;
    case 1:
      if (S.missionStage === 0 && S.car && S.car.type === 'sport' && S.car.mission) advanceStage();
      else if (S.missionStage === 1 && S.car && dist(p.x, p.y, GARAGE.x, GARAGE.y) < 90) completeMission();
      break;
    case 2:
      break; // debtors advance on interaction
    case 3:
      if (S.missionStage === 1) {
        if (dist(p.x, p.y, SAFEHOUSE.x, SAFEHOUSE.y) < 90) {
          clearWanted();
          completeMission();
        }
      }
      break;
    case 4:
      if (S.missionStage === 0 && dist(p.x, p.y, WAREHOUSE.x, WAREHOUSE.y) < 120) advanceStage();
      else if (S.missionStage === 1 && S.enemies.length === 0) advanceStage();
      else if (S.missionStage === 3 && dist(p.x, p.y, DINER.x, DINER.y) < 90) completeMission();
      break;
    case 5:
      if (S.missionStage === 1) {
        S.missionTimer -= dt;
        if (dist(p.x, p.y, PIER.x, PIER.y) < 90) completeMission();
        else if (S.missionTimer <= 0) failMission('ran out of daylight');
      }
      break;
    default:
      break;
  }
}

export function drawMissionMarker(ctx) {
  const mk = S.missionMarker;
  if (!mk) return;
  const pulse = 1 + Math.sin(S.time * 5) * 0.15;
  ctx.save();
  ctx.translate(mk.x, mk.y);
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(241,196,15,0.18)';
  ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mk.label, 0, -40);
  ctx.restore();
  // Mission pickups get a distinct icon.
  for (const pk of S.pickups) {
    if (!pk.bag && !pk.briefcase && !pk.package) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y + Math.sin(S.time * 4) * 3);
    ctx.fillStyle = pk.briefcase ? '#8e44ad' : pk.package ? '#e67e22' : '#2ecc71';
    ctx.fillRect(-11, -8, 22, 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.briefcase ? 'CASE' : pk.package ? 'PKG' : 'BAG', 0, 4);
    ctx.restore();
  }
}
