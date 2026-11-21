// SOLARA — Streets of Coral Bay. Entrypoint: builds the world, runs the fixed-step
// loop, wires the title screen, missions, win/lose flow and the debug API the
// screenshot stager and play-tests use. Written fresh for round 4.
import * as THREE from 'three';
import { PLAYER, RADIO } from './config.js';
import { mulberry32 } from './random.js';
import { createGameState, SCREEN, addMoney, setWanted, damagePlayer } from './state.js';
import { createRenderer, createScene, createSky, createLights, createSunGlitter, resizeRenderer } from './render.js';
import { createCity } from './city.js';
import { makeDante, makePedestrian } from './characters.js';
import { createTraffic, updateTraffic, nearestCar } from './traffic.js';
import { spawnPlayer, givePlayerCar, enterCar, exitCar, tryEnterCar, updatePlayerOnFoot } from './player.js';
import { updateDriving, updateCamera } from './drive.js';
import { updatePolice, commitCrime, placePoliceCar } from './police.js';
import { startMission, startNextMission, advanceDialog, updateMissions, makeMarker } from './missions.js';
import { createCombatFx, shootPistol, updateCombatFx, updateEnemies, spawnMissionEnemies } from './combat.js';
import { createHud, updateHud, showCenter, hideCenter } from './hud.js';
import { createAudio, ensureAudio, updateAudio, playGunshot, playChime } from './audio.js';
import { saveGame, loadSave, applySave } from './save.js';
import { createInput, attachInput, endFrameInput, wasPressed } from './input.js';
import { stageShot } from './shots.js';
import { spawnTrafficCar } from './vehicles.js';

const STEP = 1 / 60;

function boot() {
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const seed = Number(params.get('seed') || 7);
  const canvas = document.getElementById('game');
  const renderer = createRenderer(canvas);
  const scene = createScene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(-120, 26, 90);
  camera.lookAt(0, 4, 0);

  const state = createGameState(seed);
  createSky(scene);
  createLights(scene);
  createSunGlitter(scene);
  createCity(scene, state);
  createTraffic(scene, state);
  const dante = makeDante();
  spawnPlayer(scene, state, dante);
  createCombatFx(scene);
  const marker = makeMarker(scene);
  const hud = createHud();
  const audio = createAudio();
  const input = createInput();
  hud.root.style.display = 'none'; // hidden until the title is dismissed (or a shot stages)

  // --- Cross-system hooks (the game talks to itself through these).
  state.onCrime = (kind) => commitCrime(state, kind);
  state.onShoot = () => playGunshot(audio);
  state.onMissionComplete = () => { playChime(audio, true); saveGame(state); };
  state.onPoliceShot = () => {};

  const world = { scene, state, camera, renderer, hud, audio, input, marker };

  // Camera yaw is tracked by the frame loop and read by on-foot movement.
  let cameraYaw = state.player.heading;
  world._cameraYaw = () => cameraYaw;

  // --- Helpers the screenshot stager uses (fixed spots, no randomness).
  world.givePlayerCar = (sc, st, color, kind, x, z, heading) => givePlayerCar(sc, st, color, kind, x, z, heading);
  world.enterCar = (st, car) => enterCar(st, car);
  world.setWanted = (st, n) => setWanted(st, n);
  world.spawnPoliceCarAt = (sc, st, x, z, heading) => placePoliceCar(sc, st, x, z, heading);
  world.spawnTrafficAt = (sc, st, x, z, heading) => {
    const rng = mulberry32(seed + Math.floor(x) + Math.floor(z));
    const car = spawnTrafficCar(sc, rng, x, z, heading);
    car.cruiseSpeed = 8;
    // Straight route along its heading so staged traffic actually drives.
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    car.route = [
      { x: x + fx * 140, z: z + fz * 140 },
      { x: x - fx * 140, z: z - fz * 140 },
    ];
    car.routeIndex = 0;
    st.cars.push(car);
    return car;
  };
  world.spawnPedAt = (sc, st, x, z, heading) => {
    const rng = mulberry32(seed + Math.floor(x * 3) + Math.floor(z));
    const person = makePedestrian(rng);
    person.group.position.set(x, 0, z);
    person.group.rotation.y = heading;
    sc.add(person.group);
    const ped = {
      mesh: person.group, parts: person.parts, pos: person.group.position,
      heading, speed: 1.2, walkPhase: rng() * 6, panic: 0,
      targetHeading: heading, retargetTimer: 4,
    };
    st.peds.push(ped);
    return ped;
  };
  world.syncMarker = () => syncMarker(world);
  world.shootOnce = () => shootPistol(state, scene, camera);
  world.runSteps = (seconds, keys) => {
    const savedKeys = input.keys;
    input.keys = keys;
    const count = Math.round(seconds / STEP);
    for (let i = 0; i < count; i += 1) fixedUpdate(world, STEP);
    input.keys = savedKeys;
  };

  attachInput(input, canvas, {
    onKey: () => ensureAudio(audio),
    onMouseDown: () => {
      ensureAudio(audio);
      if (state.screen === SCREEN.PLAY && state.player.onFoot && !state.missions.dialog) {
        shootPistol(state, scene, camera);
      }
    },
  });

  // --- Title screen buttons.
  const titleEl = document.getElementById('title');
  const saved = loadSave();
  const continueBtn = document.getElementById('btn-continue');
  if (saved && saved.missionsDone > 0) {
    continueBtn.style.display = 'block';
    document.getElementById('continue-label').textContent = `${saved.missionsDone}/8 jobs • $${saved.money.toLocaleString('en-US')}`;
  }
  document.getElementById('btn-story').addEventListener('click', () => startGame(world, 'story'));
  document.getElementById('btn-roam').addEventListener('click', () => startGame(world, 'roam'));
  continueBtn.addEventListener('click', () => startGame(world, 'story'));

  window.addEventListener('resize', () => resizeRenderer(renderer, camera));

  // --- The debug / test API (screenshots and play-tests drive through this).
  window.__solara = {
    state, world, version: 'solara-v4-rebuild-1.0',
    ready: false, error: null,
    startStory: () => startGame(world, 'story'),
    startFreeRoam: () => startGame(world, 'roam'),
    teleportToObjective: () => {
      const pos = state.missions.objectivePos;
      if (!pos) return false;
      state.player.pos.x = pos.x;
      state.player.pos.z = pos.z;
      if (state.player.car) { state.player.car.pos.x = pos.x; state.player.car.pos.z = pos.z; }
      state.player.mesh.position.set(pos.x, 0, pos.z);
      return true;
    },
    damagePlayer: (n) => damagePlayer(state, n),
    completeCurrentMission: () => {
      const m = state.missions.active;
      if (!m) return false;
      if (m.def.kind === 'eliminate') m.count = m.target;
      return true;
    },
    setWanted: (n) => setWanted(state, n),
    addMoney: (n) => addMoney(state, n),
    snapshot: () => ({
      screen: state.screen, money: state.player.money, health: state.player.health,
      wanted: state.player.wanted, missionsDone: state.missions.completed,
      x: Math.round(state.player.pos.x), z: Math.round(state.player.pos.z),
      onFoot: state.player.onFoot, cars: state.cars.length, peds: state.peds.length,
      police: state.police.cars.length, heli: !!state.police.heli,
    }),
  };

  // --- Screenshot mode: build the scene, freeze it, signal readiness.
  if (shotName) {
    titleEl.style.display = 'none';
    hud.root.style.display = 'block';
    state.screen = SCREEN.PLAY;
    stageShot(shotName, world);
    renderer.render(scene, camera);
    updateHud(state, hud);
    window.__solara.ready = true;
  }

  // --- Main loop: fixed-step sim, render every frame.
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!state.frozen) {
      acc += dt;
      while (acc >= STEP) {
        fixedUpdate(world, STEP);
        acc -= STEP;
      }
      handleEdgeKeys(world);
      if (state.screen === SCREEN.PLAY) cameraYaw = updateCamera(state, camera, dt, input.orbitYaw);
      endFrameInput(input);
    }
    updateHud(state, hud);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return world;
}

function syncMarker(world) {
  const { state, marker } = world;
  const pos = state.missions.objectivePos;
  const active = state.missions.active && state.missions.active.phase === 'active';
  marker.group.visible = !!(pos && active);
  if (pos) {
    marker.group.position.set(pos.x, 0, pos.z);
    marker.diamond.rotation.y += 0.03;
    marker.diamond.position.y = 6 + Math.sin(world.state.time * 2) * 0.5;
  }
}

// What happens the moment a mission's briefing ends and it goes live.
function onMissionActivated(world) {
  const { scene, state } = world;
  const mission = state.missions.active;
  if (!mission) return;
  if (mission.def.kind === 'eliminate') {
    spawnMissionEnemies(scene, state, mission);
  } else if (mission.def.kind === 'steal') {
    const spot = mission.spot;
    givePlayerCar(scene, state, 0xff2e63, 'sports', spot.x + 4, spot.z, 0.8);
  }
}

function startGame(world, mode) {
  const { state, scene } = world;
  document.getElementById('title').style.display = 'none';
  world.hud.root.style.display = 'block';
  hideCenter(world.hud);
  state.flags.started = true;
  state.screen = SCREEN.PLAY;
  if (mode === 'story') {
    const saved = loadSave();
    if (saved && state.missions.completed === 0 && saved.missionsDone > 0) {
      applySave(state, saved);
    }
    if (!state.missions.active) startNextMission(state);
  } else {
    state.freeRoam = true;
    state.missions.objectiveText = 'Free roam — explore Coral Bay, steal cars, have fun.';
  }
  // A starter car parked near Dante so driving starts immediately (inside the
  // 4.5 m enter range).
  if (!state.cars.some((c) => c.kind === 'player')) {
    givePlayerCar(scene, state, 0x2ec4b6, 'player', state.player.pos.x + 3.5, state.player.pos.z + 1.5, state.player.heading);
  }
  ensureAudio(world.audio);
}

function respawn(world, fee, label) {
  const { state, hud } = world;
  state.player.money = Math.max(0, state.player.money - fee);
  state.player.health = PLAYER.maxHealth;
  state.player.armor = 0;
  setWanted(state, 0);
  for (const car of [...state.police.cars]) {
    world.scene.remove(car.mesh);
    state.cars.splice(state.cars.indexOf(car), 1);
  }
  state.police.cars = [];
  if (state.police.heli) { world.scene.remove(state.police.heli.mesh); state.police.heli = null; }
  state.player.pos.x = 0;
  state.player.pos.z = 0;
  state.player.mesh.position.set(0, 0, 0);
  if (state.player.car) { state.player.car = null; state.player.onFoot = true; state.player.mesh.visible = true; }
  state.flags.wasted = false;
  state.flags.busted = false;
  state.screen = SCREEN.PLAY;
  hideCenter(hud);
  state.missions.banner = { text: label, sub: `-$${fee}  •  Back on the streets of Coral Bay`, until: state.time + 4 };
  saveGame(state);
}

function handleEdgeKeys(world) {
  const { state, input, hud } = world;
  if (wasPressed(input, 'Enter')) {
    if (state.screen === SCREEN.TITLE) { startGame(world, 'story'); return; }
    if (state.missions.dialog) {
      const done = advanceDialog(state);
      if (done) onMissionActivated(world);
      return;
    }
    if (state.screen === SCREEN.WASTED) { respawn(world, 100, 'PATCHED UP'); return; }
    if (state.screen === SCREEN.BUSTED) { respawn(world, 250, 'BAIL PAID'); return; }
    if (state.screen === SCREEN.STORY_DONE) {
      state.screen = SCREEN.PLAY;
      state.freeRoam = true;
      hideCenter(hud);
      return;
    }
    if (state.screen === SCREEN.PLAY && !state.missions.active && !state.freeRoam) {
      startNextMission(state);
    }
  }
  if (wasPressed(input, 'KeyE') && state.screen === SCREEN.PLAY && !state.missions.dialog) {
    if (state.player.onFoot) {
      const result = tryEnterCar(state);
      if (result === 'stolen') state.missions.banner = { text: 'CAR STOLEN', sub: 'The cops noticed that. Lose them!', until: state.time + 3 };
    } else {
      exitCar(state);
    }
  }
  if (wasPressed(input, 'KeyR') && state.screen === SCREEN.PLAY) {
    state.radio.station = (state.radio.station + 1) % RADIO.length;
  }
  if (wasPressed(input, 'KeyM')) {
    world.audio.muted = !world.audio.muted;
  }
  if (wasPressed(input, 'KeyP') && (state.screen === SCREEN.PLAY || state.screen === SCREEN.PAUSED)) {
    if (state.screen === SCREEN.PLAY) {
      state.screen = SCREEN.PAUSED;
      showCenter(hud, 'PAUSED', 'Press P to keep playing', '#ffd60a');
    } else {
      state.screen = SCREEN.PLAY;
      hideCenter(hud);
    }
  }
}

function fixedUpdate(world, dt) {
  const { state, scene, camera, input, hud, audio } = world;
  state.time += dt;
  const player = state.player;

  // Win / lose overlays, shown once — checked first so they appear even when the
  // screen changed between steps (e.g. damage from outside the sim).
  if (state.screen === SCREEN.WASTED && !state._wastedShown) {
    state._wastedShown = true;
    showCenter(hud, 'WASTED', 'The streets of Coral Bay got you. ENTER — patched up for $100.', '#ff2e63');
  } else if (state.screen === SCREEN.BUSTED && !state._bustedShown) {
    state._bustedShown = true;
    showCenter(hud, 'BUSTED', 'Coral Bay PD has you. ENTER — bail out for $250.', '#4361ee');
  } else if (state.screen === SCREEN.STORY_DONE && !state._doneShown) {
    state._doneShown = true;
    showCenter(hud, 'KING OF CORAL BAY',
      `All 8 jobs done. $${player.money.toLocaleString('en-US')} in your pocket. ENTER — free roam.`, '#ffd60a');
  }

  if (state.screen === SCREEN.TITLE) {
    // Slow cinematic orbit over the plaza while the title is up.
    const t = state.time * 0.045;
    camera.position.set(Math.cos(t) * 70, 26, Math.sin(t) * 70);
    camera.lookAt(-40, 6, 0);
    updateTraffic(state, dt);
    return;
  }
  if (state.screen === SCREEN.PAUSED) return;
  if (state.screen === SCREEN.WASTED || state.screen === SCREEN.BUSTED || state.screen === SCREEN.STORY_DONE) {
    updateTraffic(state, dt);
    return;
  }
  if (state.screen !== SCREEN.PLAY) return;

  const dialogOpen = !!state.missions.dialog;
  if (!dialogOpen) {
    if (player.onFoot) updatePlayerOnFoot(state, input, dt, world._cameraYaw());
    else updateDriving(state, input, dt);
    // Shooting: hold F or mouse.
    if (player.onFoot && player.weapon === 'pistol' && (input.keys.has('KeyF') || input.mouseDown)) {
      shootPistol(state, scene, camera);
    }
  }
  updateTraffic(state, dt);
  updatePolice(scene, state, dt);
  updateMissions(state, dt);
  updateEnemies(state, dt);
  updateCombatFx(state, dt);
  syncMarker(world);
  updateAudio(audio, state, dt);

  // Context prompt.
  if (dialogOpen) {
    state.promptText = '';
  } else if (player.onFoot) {
    const car = nearestCar(state, player.pos.x, player.pos.z, 4.5);
    state.promptText = car ? (car.kind === 'traffic' ? 'Press E to steal the car' : 'Press E to enter the car') : '';
  } else {
    state.promptText = 'Press E to get out';
  }
}

try {
  boot();
} catch (err) {
  window.__solara = { ready: false, error: String(err && err.stack || err) };
  const status = document.getElementById('status');
  if (status) status.textContent = `SOLARA failed to start: ${err && err.message}`;
  console.error(err);
}
