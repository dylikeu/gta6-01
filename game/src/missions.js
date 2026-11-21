// The story of SOLARA: eight jobs for Dante Cruz, each with a giver, a briefing
// dialogue with portraits, an objective type, and a cash reward. The runtime below
// drives one mission at a time: briefing -> objective -> payout -> next job.
import * as THREE from 'three';
import { addMoney, setWanted } from './state.js';

// Mission spots around Coral Bay (x, z) — all on roads or open ground, so the
// objective beacon is never hidden inside a building.
export const SPOTS = {
  pier: { x: -176, z: 30, name: 'Coral Pier' },
  hotel: { x: 102, z: -84, name: 'Marina Hotel' },
  dealership: { x: -6, z: 102, name: 'Sunset Motors' },
  debtors: { x: 48, z: 48, name: 'Palm Court' },
  beachClub: { x: -168, z: -90, name: 'Neon Beach Club' },
  bank: { x: 48, z: -6, name: 'Coral Bank' },
  docks: { x: -114, z: 156, name: 'Harbor Docks' },
  lighthouse: { x: -168, z: -114, name: 'Lighthouse Point' },
  plaza: { x: -6, z: -6, name: 'Coral Plaza' },
};

export const MISSIONS = [
  {
    id: 1, title: 'Welcome to Coral Bay', giver: 'Rico', giverColor: '#e63946',
    reward: 200, kind: 'goto', spot: 'pier',
    objective: 'Meet Rico at the Coral Pier',
    briefing: [
      ['Rico', 'Dante! My brother. You finally made it to Coral Bay.'],
      ['Dante', 'Rico. The bus dropped me off and my wallet is already crying.'],
      ['Rico', 'Then let us fix that. Come to the pier — I have your first job.'],
    ],
  },
  {
    id: 2, title: 'Sunset Courier', giver: 'Rico', giverColor: '#e63946',
    reward: 350, kind: 'goto', spot: 'hotel',
    objective: 'Deliver the package to the Marina Hotel',
    briefing: [
      ['Rico', 'A package for the Marina Hotel. Do not open it. Do not drop it.'],
      ['Dante', 'What is in it?'],
      ['Rico', 'Sunset in a box. Just drive, brother. The hotel pays well.'],
    ],
  },
  {
    id: 3, title: 'Hot Wheels', giver: 'Luna', giverColor: '#f7b801',
    reward: 500, kind: 'steal', spot: 'dealership',
    objective: 'Steal the sports car at Sunset Motors',
    briefing: [
      ['Luna', 'There is a coral-pink sports car at Sunset Motors. I want it.'],
      ['Dante', 'You want me to steal it? In broad daylight?'],
      ['Luna', 'Sunset is the best daylight. Take it, bring it to the club.'],
    ],
  },
  {
    id: 4, title: 'Debt Collector', giver: 'Rico', giverColor: '#e63946',
    reward: 600, kind: 'eliminate', spot: 'debtors', count: 3,
    objective: 'Collect from the 3 debtors at Palm Court',
    briefing: [
      ['Rico', 'Three men owe me money at Palm Court. They forgot my name.'],
      ['Dante', 'And you want me to remind them.'],
      ['Rico', 'Politely. With the pistol if politeness fails.'],
    ],
  },
  {
    id: 5, title: 'Beach Party Getaway', giver: 'Luna', giverColor: '#f7b801',
    reward: 800, kind: 'escape', spot: 'beachClub',
    objective: 'Pick up Luna, then lose the cops (3 stars)',
    briefing: [
      ['Luna', 'The party got loud and the cops got loud-er. Pick me up!'],
      ['Dante', 'I am on my way. Stay by the club entrance.'],
      ['Luna', 'And Dante? Drive like the sunset is chasing us.'],
    ],
  },
  {
    id: 6, title: 'The Coral Heist', giver: 'Mr. Vane', giverColor: '#4361ee',
    reward: 1200, kind: 'pickup', spot: 'bank',
    objective: 'Grab the cash from Coral Bank and get out',
    briefing: [
      ['Mr. Vane', 'The bank closes at dusk. The vault does not lock until dawn.'],
      ['Dante', 'You are asking me to rob the Coral Bank.'],
      ['Mr. Vane', 'I am asking you to get rich. The cash is waiting inside.'],
    ],
  },
  {
    id: 7, title: 'Harbor Heat', giver: 'Rico', giverColor: '#e63946',
    reward: 1000, kind: 'eliminate', spot: 'docks', count: 5,
    objective: 'Clear the 5 harbor guards at the docks',
    briefing: [
      ['Rico', 'Vane\'s rivals hold the docks. Five guards. No witnesses.'],
      ['Dante', 'Five? You count fast when it is my neck.'],
      ['Rico', 'You are the fastest gun in Coral Bay, brother. Prove it.'],
    ],
  },
  {
    id: 8, title: 'King of Coral Bay', giver: 'Luna', giverColor: '#f7b801',
    reward: 2000, kind: 'escape', spot: 'lighthouse',
    objective: 'Reach Lighthouse Point and lose a 4-star wanted level',
    briefing: [
      ['Luna', 'The whole city is after you now. Four stars, Dante!'],
      ['Dante', 'Then let them watch me disappear at the lighthouse.'],
      ['Luna', 'Win this, and Coral Bay is yours. All of it.'],
    ],
  },
];

// A glowing beacon column + floating diamond marks the objective in the world.
export function makeMarker(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd60a, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = 30;
  group.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.7),
    new THREE.MeshStandardMaterial({ color: 0xffd60a, emissive: 0xffaa00, emissiveIntensity: 2.4 }),
  );
  diamond.position.y = 6;
  group.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return { group, beam, diamond, ring };
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return null;
  const spot = SPOTS[def.spot];
  const mission = {
    def, index,
    phase: 'briefing', // briefing -> active -> done
    spot: { ...spot },
    count: 0,
    target: def.count || 0,
    pickupTimer: 0,
    escapeTimer: 0,
    targets: [],
  };
  state.missions.active = mission;
  state.missions.index = index;
  state.missions.objectiveText = def.objective;
  state.missions.objectivePos = { x: spot.x, z: spot.z };
  state.missions.objectiveKind = def.kind;
  state.missions.objectiveCount = 0;
  state.missions.objectiveTarget = def.count || 0;
  state.missions.dialog = {
    lines: def.briefing,
    lineIndex: 0,
    speaker: def.briefing[0][0],
    onDone: () => { mission.phase = 'active'; },
  };
  return mission;
}

export function completeMission(state) {
  const mission = state.missions.active;
  if (!mission) return;
  mission.phase = 'done';
  const payout = mission.def.reward;
  addMoney(state, payout);
  state.stats.missionsDone += 1;
  state.missions.completed += 1;
  state.missions.active = null;
  state.missions.objectiveText = '';
  state.missions.objectivePos = null;
  state.missions.banner = {
    text: `JOB DONE — ${mission.def.title}`,
    sub: `+$${payout.toLocaleString('en-US')}  •  ${state.missions.completed}/8 jobs complete`,
    until: state.time + 4,
  };
  if (state.onMissionComplete) state.onMissionComplete(mission.def);
  if (state.missions.completed >= MISSIONS.length) {
    state.flags.storyDone = true;
    state.screen = 'story-done';
  }
}

// Advance dialog by one line; returns true when the dialog finished.
export function advanceDialog(state) {
  const dialog = state.missions.dialog;
  if (!dialog) return true;
  dialog.lineIndex += 1;
  if (dialog.lineIndex >= dialog.lines.length) {
    const onDone = dialog.onDone;
    state.missions.dialog = null;
    if (onDone) onDone();
    return true;
  }
  return false;
}

export function updateMissions(state, dt) {
  const mission = state.missions.active;
  if (!mission || mission.phase !== 'active') return;
  const player = state.player;
  const spot = mission.spot;
  const dist = Math.hypot(player.pos.x - spot.x, player.pos.z - spot.z);

  if (mission.def.kind === 'goto' || mission.def.kind === 'pickup') {
    const radius = mission.def.kind === 'pickup' ? 4 : 5;
    if (dist < radius) {
      if (mission.def.kind === 'pickup') {
        mission.pickupTimer += dt;
        if (mission.pickupTimer > 1.2) {
          setWanted(state, Math.max(player.wanted, 3));
          completeMission(state);
        }
      } else {
        completeMission(state);
      }
    }
  } else if (mission.def.kind === 'steal') {
    if (player.car && player.car.kind === 'player' && !player.onFoot) {
      completeMission(state);
    }
  } else if (mission.def.kind === 'eliminate') {
    state.missions.objectiveCount = mission.count;
    if (mission.count >= mission.target) completeMission(state);
  } else if (mission.def.kind === 'escape') {
    if (mission.def.id === 5 && !mission.pickedUp) {
      if (dist < 5) {
        mission.pickedUp = true;
        setWanted(state, 3);
        state.missions.objectiveText = 'Lose the cops — stay out of sight!';
      }
    } else if (mission.def.id === 8 && !mission.started) {
      mission.started = true;
      setWanted(state, 4);
      state.missions.objectiveText = 'Reach Lighthouse Point, then lose 4 stars!';
    }
    if ((mission.def.id === 5 && mission.pickedUp) || (mission.def.id === 8 && mission.started)) {
      const atSpot = dist < 6;
      if (player.wanted === 0 && atSpot) {
        mission.escapeTimer += dt;
        if (mission.escapeTimer > 1.5) completeMission(state);
      } else {
        mission.escapeTimer = 0;
      }
    }
  }
}

export function startNextMission(state) {
  if (state.missions.completed >= MISSIONS.length) return null;
  return startMission(state, state.missions.completed);
}
