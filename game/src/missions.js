// missions.js — the story of Dante Cruz: eight jobs for Marisol Vega, from
// stealing his first wheels to taking the Vega Mansion. Each job carries
// its briefing dialogue, its objective, and its payday, and the runner
// below tracks the job from briefing to the cash hitting Dante's pocket.
import * as THREE from 'three';
import { dist2d } from './config.js';
import { findClearSpot } from './city.js';
import { spawnCharacter } from './pedestrians.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    giver: 'Marisol Vega',
    initials: 'MV',
    color: '#e63b2e',
    reward: 500,
    briefing: [
      { speaker: 'Marisol Vega', text: 'Dante. You are back in Coral Bay, and you are broke. Same as always.' },
      { speaker: 'Dante Cruz', text: 'I need wheels, Marisol. Something fast. Something nobody misses.' },
      { speaker: 'Marisol Vega', text: 'Then take one. Any car on the street is yours if you are quick. Bring it to my garage.' },
    ],
    objective: { type: 'stealThenDrive', to: { x: -88, z: -58 }, label: "Steal a car, then drive it to Marisol's Garage" },
  },
  {
    id: 'sunset-delivery',
    name: 'Sunset Delivery',
    giver: 'Marisol Vega',
    initials: 'MV',
    color: '#e63b2e',
    reward: 800,
    briefing: [
      { speaker: 'Marisol Vega', text: 'A package for the pier. No questions, no peeking, no cops.' },
      { speaker: 'Dante Cruz', text: 'What is in it? Fish? Or the other kind of fish?' },
      { speaker: 'Marisol Vega', text: 'Drive, Dante. The sun is going down and so is my patience.' },
    ],
    objective: { type: 'driveTo', to: { x: 0, z: -196 }, inCar: true, label: 'Deliver the package to Coral Pier' },
  },
  {
    id: 'the-pickup',
    name: 'The Pickup',
    giver: 'Rico Sands',
    initials: 'RS',
    color: '#2ec4b6',
    reward: 1200,
    briefing: [
      { speaker: 'Rico Sands', text: 'Yo, Dante! I am at the Salty Palm, three drinks in, and the tab is NOT mine.' },
      { speaker: 'Dante Cruz', text: 'Stay put, Rico. I will get you to the Miramar before the bar finds its wallet.' },
      { speaker: 'Rico Sands', text: 'You are the best, brother. Drive smooth, my stomach is doing flips.' },
    ],
    objective: { type: 'pickup', pickup: { x: -140, z: -152, name: 'Rico Sands', color: 0x2ec4b6 }, to: { x: 128, z: -58 }, label: 'Pick up Rico at the Salty Palm, then drive him to Hotel Miramar' },
  },
  {
    id: 'beachfront-heat',
    name: 'Beachfront Heat',
    giver: 'Marisol Vega',
    initials: 'MV',
    color: '#e63b2e',
    reward: 1500,
    briefing: [
      { speaker: 'Marisol Vega', text: 'The Sharks are selling on MY marina. Three of them. Make them leave.' },
      { speaker: 'Dante Cruz', text: 'Leave, or leave permanently?' },
      { speaker: 'Marisol Vega', text: 'Your pistol decides. Just do not bring the whole PD down on us.' },
    ],
    objective: { type: 'shoot', count: 3, at: { x: 150, z: -152 }, label: 'Clear the Sharks off the Marina (3 left)' },
  },
  {
    id: 'the-vault-run',
    name: 'The Vault Run',
    giver: 'Marisol Vega',
    initials: 'MV',
    color: '#e63b2e',
    reward: 3000,
    briefing: [
      { speaker: 'Marisol Vega', text: 'The Coral Bay Bank keeps its cash in the back room. Stand there, look busy, take it.' },
      { speaker: 'Dante Cruz', text: 'And the alarms? The guards? The sirens?' },
      { speaker: 'Marisol Vega', text: 'That is why the safehouse is on the other side of town. Run, Dante.' },
    ],
    objective: { type: 'robThenEscape', at: { x: -32, z: 52 }, holdSeconds: 5, to: { x: 78, z: 108 }, label: 'Rob the Coral Bay Bank, then escape to the Safehouse' },
  },
  {
    id: 'harbor-lights',
    name: 'Harbor Lights',
    giver: 'Captain Okafor',
    initials: 'CO',
    color: '#4361ee',
    reward: 2500,
    briefing: [
      { speaker: 'Captain Okafor', text: 'Three crates, three docks, one night. The harbor master owes me a favour. You owe me nothing yet.' },
      { speaker: 'Dante Cruz', text: 'Crates of what? Please say fish. Please say fish.' },
      { speaker: 'Captain Okafor', text: 'Fish, Dante. Very expensive, very quiet fish. Go.' },
    ],
    objective: { type: 'deliver', stops: [{ x: 188, z: -108 }, { x: 150, z: -152 }, { x: 188, z: -60 }], label: 'Deliver the crates to the Harbor docks' },
  },
  {
    id: 'the-getaway',
    name: 'The Getaway',
    giver: 'Marisol Vega',
    initials: 'MV',
    color: '#e63b2e',
    reward: 4000,
    briefing: [
      { speaker: 'Marisol Vega', text: 'They know your name now, Dante. Four stars, a helicopter, the whole circus.' },
      { speaker: 'Dante Cruz', text: 'Then I drive until they get tired. Or until I run out of road.' },
      { speaker: 'Marisol Vega', text: 'Sixty seconds, Dante. Survive sixty seconds and Coral Bay forgets you.' },
    ],
    objective: { type: 'survive', seconds: 60, wanted: 4, label: 'Survive the police chase for 60 seconds' },
  },
  {
    id: 'kingpin-of-coral-bay',
    name: 'Kingpin of Coral Bay',
    giver: 'Marisol Vega',
    initials: 'MV',
    color: '#e63b2e',
    reward: 10000,
    briefing: [
      { speaker: 'Marisol Vega', text: 'One last job. The old Vega Mansion, five of the Sharks inside. End it, and this city is ours.' },
      { speaker: 'Dante Cruz', text: 'Ours, Marisol. Say it again. Ours.' },
      { speaker: 'Marisol Vega', text: 'Ours. Now go take it, kingpin.' },
    ],
    objective: { type: 'shootThenReach', count: 5, at: { x: -192, z: 208 }, to: { x: -192, z: 208 }, label: 'Clear the Vega Mansion (5 left), then take the rooftop' },
  },
];

/** The glowing beacon that marks where Dante has to go next. */
export function createObjectiveMarker(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff4d8d, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xff4d8d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff9f1c, emissiveIntensity: 1.4 }),
  );
  diamond.position.y = 7;
  group.add(diamond);
  group.userData = { beam, ring, diamond };
  group.visible = false;
  scene.add(group);
  return group;
}

/** The mission runner: briefings, objectives, gangsters, and the payday. */
export class MissionRunner {
  constructor(missions, scene, hooks) {
    this.missions = missions;
    this.scene = scene;
    this.hooks = hooks;
    this.index = -1;
    this.mission = null;
    this.phase = 'idle';
    this.marker = createObjectiveMarker(scene);
    this.dialogue = [];
    this.dialogueIndex = 0;
    this.gangsters = [];
    this.holdTimer = 0;
    this.surviveTimer = 0;
    this.deliverIndex = 0;
    this.pickedUp = false;
    this.robbed = false;
    this.markerPos = null;
    this.killsLeft = 0;
    this.colliders = null;
  }

  get active() {
    return this.mission !== null;
  }

  objectiveLabel() {
    if (!this.mission) return 'Free roam — press M for the next job';
    if (this.phase === 'briefing') return 'Listen to the briefing…';
    const o = this.mission.objective;
    if (o.type === 'shoot' || o.type === 'shootThenReach') return o.label.replace(/\(\d+ left\)/, `(${this.killsLeft} left)`);
    if (o.type === 'deliver') return `${o.label} — dock ${this.deliverIndex + 1} of ${o.stops.length}`;
    if (o.type === 'pickup' && !this.pickedUp) return 'Pick up Rico at the Salty Palm Bar';
    if (o.type === 'robThenEscape' && !this.robbed) return `Rob the bank — stay in the vault ${Math.ceil(o.holdSeconds - this.holdTimer)}s`;
    if (o.type === 'survive') return `${o.label} — ${Math.ceil(o.seconds - this.surviveTimer)}s left`;
    return o.label;
  }

  startMission(index) {
    this.index = index;
    this.mission = this.missions[index];
    this.phase = 'briefing';
    this.dialogue = this.mission.briefing.slice();
    this.dialogueIndex = 0;
    this.gangsters = [];
    this.holdTimer = 0;
    this.surviveTimer = 0;
    this.deliverIndex = 0;
    this.pickedUp = false;
    this.robbed = false;
    this.killsLeft = this.mission.objective.count || 0;
    this.marker.visible = false;
    this.markerPos = null;
    this.hooks.onMissionStart(this.mission);
    this.hooks.onDialogue(this.dialogue[0]);
  }

  /** Advance the briefing; returns true when the job itself begins. */
  advanceDialogue() {
    this.dialogueIndex += 1;
    if (this.dialogueIndex >= this.dialogue.length) {
      this.phase = 'active';
      this.hooks.onDialogue(null);
      this.beginObjective();
      return true;
    }
    this.hooks.onDialogue(this.dialogue[this.dialogueIndex]);
    return false;
  }

  beginObjective() {
    const o = this.mission.objective;
    if (o.type === 'stealThenDrive' || o.type === 'driveTo') this.setMarker(o.to.x, o.to.z);
    if (o.type === 'pickup') this.setMarker(o.pickup.x, o.pickup.z);
    if (o.type === 'shoot' || o.type === 'shootThenReach') this.spawnGangsters(o.at.x, o.at.z, o.count);
    if (o.type === 'robThenEscape') this.setMarker(o.at.x, o.at.z);
    if (o.type === 'deliver') this.setMarker(o.stops[0].x, o.stops[0].z);
    if (o.type === 'survive') this.hooks.setWanted(o.wanted);
    this.hooks.onObjective(this.objectiveLabel());
  }

  setMarker(x, z) {
    this.markerPos = { x, z };
    this.marker.position.set(x, 0, z);
    this.marker.visible = true;
  }

  hideMarker() {
    this.marker.visible = false;
    this.markerPos = null;
  }

  spawnGangsters(x, z, count) {
    const names = ['Shark', 'Shark', 'Shark', 'Shark', 'Shark'];
    for (let i = 0; i < count; i += 1) {
      const gx = x + (i - count / 2) * 5 + (Math.random() - 0.5) * 3;
      const gz = z + (Math.random() - 0.5) * 8;
      const clear = this.colliders ? findClearSpot(this.colliders, gx, gz, 1.5) : { x: gx, z: gz };
      const g = spawnCharacter(this.scene, clear.x, clear.z, names[i] + ' ' + (i + 1), 0x8a2a2a);
      g.gangster = true;
      g.shootTimer = 1 + i * 0.7;
      this.gangsters.push(g);
    }
    this.setMarker(x, z);
  }

  registerKill(gangster) {
    const i = this.gangsters.indexOf(gangster);
    if (i === -1) return;
    this.gangsters.splice(i, 1);
    this.killsLeft -= 1;
    this.hooks.onObjective(this.objectiveLabel());
    if (this.killsLeft <= 0 && this.mission.objective.type === 'shootThenReach') {
      this.setMarker(this.mission.objective.to.x, this.mission.objective.to.z);
    }
  }

  complete() {
    const mission = this.mission;
    this.hideMarker();
    for (const g of this.gangsters) this.scene.remove(g.mesh);
    this.gangsters = [];
    this.mission = null;
    this.phase = 'idle';
    this.hooks.onMissionComplete(mission);
  }

  fail(reason) {
    this.hideMarker();
    for (const g of this.gangsters) this.scene.remove(g.mesh);
    this.gangsters = [];
    this.mission = null;
    this.phase = 'idle';
    this.hooks.onMissionFail(reason);
  }

  /** Check the objective against the live game; call once a frame. */
  update(dt, game) {
    if (!this.mission || this.phase !== 'active') return;
    const o = this.mission.objective;
    const px = game.player.x;
    const pz = game.player.z;
    const inCar = !!game.player.inCar;
    if (o.type === 'stealThenDrive') {
      if (!inCar) {
        this.setMarker(o.to.x, o.to.z);
        return;
      }
      if (dist2d(px, pz, o.to.x, o.to.z) < 9) this.complete();
      return;
    }
    if (o.type === 'driveTo') {
      if (inCar && dist2d(px, pz, o.to.x, o.to.z) < 9) this.complete();
      return;
    }
    if (o.type === 'pickup') {
      if (!this.pickedUp) {
        if (dist2d(px, pz, o.pickup.x, o.pickup.z) < 5) {
          this.pickedUp = true;
          this.hooks.onPickup();
          this.setMarker(o.to.x, o.to.z);
        }
        return;
      }
      if (inCar && dist2d(px, pz, o.to.x, o.to.z) < 9) this.complete();
      return;
    }
    if (o.type === 'shoot') {
      if (this.killsLeft <= 0) this.complete();
      return;
    }
    if (o.type === 'shootThenReach') {
      if (this.killsLeft <= 0 && dist2d(px, pz, o.to.x, o.to.z) < 9) this.complete();
      return;
    }
    if (o.type === 'robThenEscape') {
      if (!this.robbed) {
        if (dist2d(px, pz, o.at.x, o.at.z) < 6) {
          this.holdTimer += dt;
          if (this.holdTimer >= o.holdSeconds) {
            this.robbed = true;
            this.hooks.onRobbery();
            this.setMarker(o.to.x, o.to.z);
          }
        } else {
          this.holdTimer = Math.max(0, this.holdTimer - dt * 2);
        }
        return;
      }
      if (dist2d(px, pz, o.to.x, o.to.z) < 9) this.complete();
      return;
    }
    if (o.type === 'deliver') {
      const stop = o.stops[this.deliverIndex];
      if (dist2d(px, pz, stop.x, stop.z) < 8) {
        this.deliverIndex += 1;
        this.hooks.onDelivery(this.deliverIndex, o.stops.length);
        if (this.deliverIndex >= o.stops.length) this.complete();
        else this.setMarker(o.stops[this.deliverIndex].x, o.stops[this.deliverIndex].z);
      }
      return;
    }
    if (o.type === 'survive') {
      this.surviveTimer += dt;
      if (this.surviveTimer >= o.seconds) this.complete();
    }
  }
}
