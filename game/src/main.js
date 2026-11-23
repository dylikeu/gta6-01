// SOLARA round 6 — re-witnessed 23 Nov 2026.
// Role: entrypoint — builds the world, wires systems, runs the loop.
// main.js — SOLARA, the entrypoint: it builds Coral Bay, wires every system
// together, runs the game loop, and owns the state machine (menu, play,
// dialogue, pause, win, lose) plus the save and the screenshot staging.
import * as THREE from 'three';
import { CAR, PLAYER, RADIO_STATIONS, SAVE_KEY, WORLD_HALF, clamp, dist2d, moneyString, mulberry32 } from './config.js';
import { buildCity, findClearSpot } from './city.js';
import { createCarMesh, spawnParkedCars, spawnTraffic, updateTraffic } from './vehicles.js';
import { nearestPedestrian, spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { WantedSystem, createHelicopter, maintainPolice, updateHelicopter, updatePolice } from './police.js';
import { createPlayerMesh, createPlayerState, damagePlayer, enterCar, exitCar, nearestEnterableCar, updatePlayerOnFoot } from './player.js';
import { carCameraTarget, makeDrivable, playerCameraTarget, updateDrive } from './drive.js';
import { createPistol, firePistol, makeMuzzleFlash, makeTracer, robPedestrian, updatePistol, updateShotFx } from './weapons.js';
import { MISSIONS, MissionRunner } from './missions.js';
import { banner, createHud, showDialogue, showScreen, toast, updateHud } from './hud.js';
import { AudioEngine } from './audio.js';
import { Effects, updateCashPickups } from './effects.js';
import { ChaseCamera, createRenderer, resizeRenderer } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 20261123);

/** The whole game in one object, so every system can see every other. */
export function createGame() {
  const canvas = document.getElementById('game');
  const render = createRenderer(canvas);
  const city = buildCity(render.scene, SEED);
  const hud = createHud(document.getElementById('ui'));
  const audio = new AudioEngine();
  const effects = new Effects(render.scene);

  const player = createPlayerState(22, 52);
  const spawn = findClearSpot(city.colliders, 22, 52, 1);
  player.x = spawn.x;
  player.z = spawn.z;
  player.mesh = createPlayerMesh();
  player.mesh.position.set(player.x, 0, player.z);
  render.scene.add(player.mesh);

  const game = {
    render,
    scene: render.scene,
    camera: render.camera,
    chaseCam: new ChaseCamera(render.camera),
    city,
    colliders: city.colliders,
    hud,
    audio,
    effects,
    player,
    pistol: createPistol(),
    wanted: new WantedSystem(),
    money: 250,
    radioStation: 0,
    missionRunner: null,
    trafficCars: spawnTraffic(render.scene, SEED + 11),
    parkedCars: spawnParkedCars(render.scene, SEED + 23, city.colliders),
    policeCars: [],
    heli: createHelicopter(render.scene),
    peds: spawnPedestrians(render.scene, 16, SEED + 37),
    cashPickups: [],
    shotFx: [],
    input: { keys: new Set(), mouseDown: false },
    time: 0,
    mode: 'menu',
    shotMode: !!SHOT,
    shotName: SHOT,
    shotFrozen: false,
    stats: { earned: 0, missionsDone: 0, kills: 0, carsStolen: 0, robbed: 0 },
    bustedTimer: 0,
    ramCooldown: 0,
    rng: mulberry32(SEED + 91),
  };

  game.missionRunner = new MissionRunner(MISSIONS, render.scene, {
    onMissionStart: (mission) => {
      banner(hud, 'NEW JOB', `${mission.name} — ${mission.giver}`);
      toast(hud, `Job ${game.missionRunner.index + 1} of 8: ${mission.name}`);
      audio.blip();
    },
    onDialogue: (line) => showDialogue(hud, line, game.missionRunner.mission),
    onObjective: (label) => { hud.objective.textContent = '◎ ' + label; },
    onMissionComplete: (mission) => {
      game.money += mission.reward;
      game.stats.earned += mission.reward;
      game.stats.missionsDone += 1;
      audio.fanfare();
      audio.chaChing();
      banner(hud, 'JOB COMPLETE', `${mission.name} — ${moneyString(mission.reward)}`);
      toast(hud, `Paid ${moneyString(mission.reward)} — press M for the next job`, 'good');
      game.cashPickups.push(effects.cashPickup(game.player.x + 4, game.player.z + 2, 100));
      saveGame(game);
      if (game.stats.missionsDone >= MISSIONS.length) winGame(game, 'CORAL BAY IS YOURS');
    },
    onMissionFail: (reason) => toast(hud, reason, 'bad'),
    onPickup: () => {
      toast(hud, 'Rico is in the car — drive him to Hotel Miramar', 'good');
      audio.blip();
    },
    onRobbery: () => {
      game.wanted.setLevel(3);
      game.money += 1500;
      toast(hud, 'Bank robbed! Lose the cops and reach the Safehouse', 'bad');
      audio.chaChing();
    },
    onDelivery: (done, total) => {
      toast(hud, `Crate delivered (${done} of ${total})`, 'good');
      audio.blip();
    },
    setWanted: (level) => game.wanted.setLevel(level),
  });
  game.missionRunner.colliders = game.colliders;
  // Mission markers, pickups and hold zones must sit on open ground, never
  // inside a building: nudge every objective point to the nearest clear spot.
  for (const mission of MISSIONS) {
    const o = mission.objective;
    const clear = (p) => {
      const c = findClearSpot(game.colliders, p.x, p.z, 3);
      p.x = c.x;
      p.z = c.z;
    };
    if (o.to) clear(o.to);
    if (o.at) clear(o.at);
    if (o.pickup) clear(o.pickup);
    if (o.stops) for (const stop of o.stops) clear(stop);
  }
  return game;
}

/** Save money and progress so CONTINUE works after a reload. */
export function saveGame(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: game.money,
      missionsDone: game.stats.missionsDone,
      earned: game.stats.earned,
    }));
  } catch { /* private mode: the game still plays */ }
}

/** Load a save if one exists, or null. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function startPlaying(game, freeroam = false) {
  game.mode = 'play';
  showScreen(game.hud, 'play');
  game.audio.ensure();
  if (!freeroam && !game.missionRunner.active && game.stats.missionsDone < MISSIONS.length) {
    game.missionRunner.startMission(game.stats.missionsDone);
  }
}

function winGame(game, title) {
  game.mode = 'win';
  game.audio.fanfare();
  const mins = Math.max(1, Math.round(game.time / 60));
  game.hud.endTitle.textContent = title;
  game.hud.endText.textContent = 'Dante Cruz took all eight jobs and the city with them. Marisol was right — Coral Bay was always his.';
  game.hud.endStats.innerHTML = `Jobs done <b>${game.stats.missionsDone}/8</b> · Cash earned <b>${moneyString(game.stats.earned)}</b> · Cars stolen <b>${game.stats.carsStolen}</b> · Time <b>${mins} min</b>`;
  showScreen(game.hud, 'end');
  saveGame(game);
}

function loseGame(game, title, text) {
  game.mode = 'lose';
  game.hud.endTitle.textContent = title;
  game.hud.endText.textContent = text;
  game.hud.endStats.innerHTML = `Jobs done <b>${game.stats.missionsDone}/8</b> · Cash <b>${moneyString(game.money)}</b> · Cars stolen <b>${game.stats.carsStolen}</b>`;
  showScreen(game.hud, 'end');
}

/** Aim from the camera through the centre of the screen. */
function aimDirection(game) {
  const dir = new THREE.Vector3();
  game.camera.getWorldDirection(dir);
  return dir;
}

function shoot(game) {
  const pistol = game.pistol;
  if (pistol.cooldown > 0 || pistol.reloading > 0 || pistol.ammo <= 0) return;
  const origin = new THREE.Vector3(game.player.x, 1.55, game.player.z);
  const dir = aimDirection(game);
  const targets = [
    ...game.peds,
    ...game.missionRunner.gangsters,
    ...game.policeCars.filter((c) => c.alive),
  ];
  const result = firePistol(game.scene, pistol, origin, dir, targets, (target, point) => {
    game.effects.sparks(point.x, point.y, point.z);
    if (target.health !== undefined) {
      target.health -= 34;
      if (target.health <= 0 && target.alive !== false) {
        target.alive = false;
        game.stats.kills += 1;
        target.mesh.rotation.x = -Math.PI / 2;
        target.mesh.position.y = 0.25;
        if (target.gangster) game.missionRunner.registerKill(target);
        else {
          game.wanted.addCrime(25);
          toast(game.hud, 'A bystander went down — the city saw that', 'bad');
        }
      }
    }
  });
  if (!result) return;
  game.audio.shoot();
  game.shotFx.push(makeTracer(game.scene, origin.clone().addScaledVector(dir, 0.8), result.point));
  game.shotFx.push(makeMuzzleFlash(game.scene, origin, dir));
  game.peds.forEach((ped) => {
    if (ped.alive && dist2d(ped.mesh.position.x, ped.mesh.position.z, game.player.x, game.player.z) < 26) {
      ped.fleeing = 2.5;
      ped.fleeX = game.player.x;
      ped.fleeZ = game.player.z;
    }
  });
  if (!result.hit) game.wanted.addCrime(2);
}

/** One fixed step of the live game: input, driving, police, missions, HUD. */
export function updateGame(game, dt) {
  game.time += dt;
  const input = game.input;
  const player = game.player;
  game.ramCooldown = Math.max(0, game.ramCooldown - dt);

  // Wanted heat cools when the police lose sight of Dante.
  const nearestPolice = game.policeCars.length ? Math.min(...game.policeCars.map((c) => dist2d(c.mesh.position.x, c.mesh.position.z, player.x, player.z))) : Infinity;
  game.wanted.update(dt, nearestPolice < 45);
  maintainPolice(game.scene, game.policeCars, game.wanted.level, player, game.rng);
  updatePolice(game.policeCars, dt, player, player.inCar ? Math.abs(player.inCar.speed) : player.speed, game.colliders, (car, d) => {
    if (game.ramCooldown > 0) return;
    game.ramCooldown = 0.6;
    game.audio.crash(d < 2);
    if (player.inCar) {
      player.inCar.health -= 8;
      game.effects.sparks(player.x, 1, player.z);
      if (player.inCar.health <= 0) {
        game.effects.explosion(player.inCar.mesh.position.x, 1, player.inCar.mesh.position.z);
        exitCar(player);
        damagePlayer(player, 25);
      }
    } else if (damagePlayer(player, 8)) {
      loseGame(game, 'WASTED', 'The Coral Bay PD ran Dante down in the street.');
      return;
    }
  });
  updateHelicopter(game.heli, dt, player, game.wanted.level);

  // Driving or walking, and the camera that follows.
  if (player.inCar) {
    const car = player.inCar;
    const { dust } = updateDrive(car, input, dt, game.colliders, game.trafficCars, (speed) => {
      game.audio.crash(speed > 18);
      game.effects.sparks(car.mesh.position.x, 0.8, car.mesh.position.z);
      car.health -= Math.round(speed * 0.4);
      if (car.health <= 0) {
        game.effects.explosion(car.mesh.position.x, 1, car.mesh.position.z);
        exitCar(player);
        damagePlayer(player, 20);
      }
    });
    player.x = car.mesh.position.x;
    player.z = car.mesh.position.z;
    if (dust > 0.05) game.effects.dust(car.mesh.position.x - Math.sin(car.heading) * 2, car.mesh.position.z - Math.cos(car.heading) * 2, dust);
    game.chaseCam.follow(carCameraTarget(car), dt);
  } else {
    updatePlayerOnFoot(player, input, game.chaseCam.heading, dt, game.colliders);
    game.chaseCam.follow(playerCameraTarget(player), dt);
  }
  // Keep the chase heading in step with where Dante actually faces.
  game.chaseCam.heading = player.inCar ? player.inCar.heading : player.heading;

  updateTraffic(game.trafficCars, dt, player.inCar);
  updatePedestrians(game.peds, dt, null);
  game.missionRunner.update(dt, game);
  game.missionRunner.marker.userData.diamond.rotation.y += dt * 2;
  game.missionRunner.marker.userData.diamond.position.y = 7 + Math.sin(game.time * 2.4) * 0.7;
  game.city.seaTexture.offset.y += dt * 0.015;
  game.city.seaTexture.offset.x += dt * 0.004;

  // Gangsters shoot back while their job is live.
  for (const g of game.missionRunner.gangsters) {
    if (!g.alive) continue;
    g.shootTimer -= dt;
    const d = dist2d(g.mesh.position.x, g.mesh.position.z, player.x, player.z);
    if (g.shootTimer <= 0 && d < 30) {
      g.shootTimer = 1.4 + game.rng() * 0.9;
      const from = new THREE.Vector3(g.mesh.position.x, 1.4, g.mesh.position.z);
      const to = new THREE.Vector3(player.x, 1.3, player.z);
      game.shotFx.push(makeTracer(game.scene, from, to));
      if (game.rng() < 0.55 && damagePlayer(player, 7)) {
        loseGame(game, 'WASTED', 'The Sharks got Dante at the marina.');
        return;
      }
    }
    g.mesh.lookAt(player.x, 0, player.z);
  }

  // Busted: caught on foot, up close, with nowhere to run.
  if (!player.inCar && game.wanted.level >= 2 && nearestPolice < 3.2 && player.speed < 1) {
    game.bustedTimer += dt;
    if (game.bustedTimer > 2) {
      loseGame(game, 'BUSTED', 'The Coral Bay PD cuffed Dante on the sidewalk. The city keeps its secrets.');
      return;
    }
  } else {
    game.bustedTimer = 0;
  }

  updatePistol(game.pistol, dt, input.keys.has('KeyR'));
  if (input.mouseDown && !player.inCar) shoot(game);
  updateShotFx(game.shotFx, dt);
  game.effects.update(dt, game.time);
  updateCashPickups(game.cashPickups, game.scene, player.x, player.z, (amount) => {
    game.money += amount;
    game.audio.chaChing();
    toast(game.hud, `Picked up ${moneyString(amount)}`, 'good');
  });

  game.audio.updateEngine(player.inCar ? Math.abs(player.inCar.speed) : 0, !!player.inCar);
  game.audio.updateSiren(game.wanted.level, dt);
  game.audio.updateMusic();
  updateHud(game.hud, game);

  // Slow health regen when Dante is out of trouble.
  if (game.wanted.level === 0 && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + dt * 2);
  }

  // Any damage that drops Dante to zero ends the run, however it happened.
  if (player.health <= 0 && game.mode === 'play') {
    loseGame(game, 'WASTED', 'Dante Cruz went down in the streets of Coral Bay.');
  }
}

/** Bind every key, click and button to the game. */
function bindInput(game) {
  const input = game.input;
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.code);
    game.audio.ensure();
    if (event.code === 'KeyM') {
      if (game.mode === 'play' && !game.missionRunner.active && game.stats.missionsDone < MISSIONS.length) {
        game.missionRunner.startMission(game.stats.missionsDone);
      }
    }
    if (event.code === 'KeyT') {
      game.radioStation = (game.radioStation + 1) % RADIO_STATIONS.length;
      game.audio.setStation(game.radioStation);
      toast(game.hud, `Radio: ${RADIO_STATIONS[game.radioStation].name}`);
    }
    if (event.code === 'KeyP') {
      if (game.mode === 'play') {
        game.mode = 'pause';
        showScreen(game.hud, 'pause');
      } else if (game.mode === 'pause') {
        game.mode = 'play';
        showScreen(game.hud, 'play');
      }
    }
    if (event.code === 'KeyE') {
      if (game.mode === 'play') {
        if (game.missionRunner.phase === 'briefing') {
          game.missionRunner.advanceDialogue();
        } else if (game.player.inCar) {
          exitCar(game.player);
          toast(game.hud, 'Out of the car');
        } else {
          const car = nearestEnterableCar([...game.parkedCars, ...game.trafficCars, ...game.policeCars], game.player.x, game.player.z);
          if (car) {
            if (car.parked || car.baseSpeed !== undefined) game.stats.carsStolen += 1;
            enterCar(game.player, car);
            makeDrivable(car, car.mesh.position.x, car.mesh.position.z, car.heading ?? (car.mesh.rotation.y + Math.PI / 2));
            toast(game.hud, `Stolen: ${car.name || 'Cruiser'} — the city is yours to drive`);
            game.audio.blip();
            if (car.parked) game.wanted.addCrime(8);
          }
        }
      }
    }
    if (event.code === 'KeyQ' && game.mode === 'play' && !game.player.inCar) {
      const cash = robPedestrian(game.peds, game.player.x, game.player.z, (ped, amount) => {
        game.stats.robbed += 1;
        game.wanted.addCrime(15);
        toast(game.hud, `Robbed ${ped.name} for ${moneyString(amount)} — run!`, 'bad');
      });
      if (cash > 0) {
        game.money += cash;
        game.audio.chaChing();
      }
    }
    if (event.code === 'Space') {
      event.preventDefault();
      // Edge-triggered: a quick tap still fires, even on a slow frame rate.
      if (game.mode === 'play' && !game.player.inCar) shoot(game);
    }
  });
  window.addEventListener('keyup', (event) => input.keys.delete(event.code));
  window.addEventListener('mousedown', (event) => {
    if (event.target.closest('button')) return;
    input.mouseDown = true;
    game.audio.ensure();
    if (game.mode === 'play' && game.missionRunner.phase === 'briefing') game.missionRunner.advanceDialogue();
    else if (game.mode === 'play' && !game.player.inCar) shoot(game);
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  window.addEventListener('resize', () => resizeRenderer(game.render, window.innerWidth, window.innerHeight));
  game.hud.root.querySelector('#btn-start').addEventListener('click', () => startPlaying(game));
  game.hud.root.querySelector('#btn-freeroam').addEventListener('click', () => startPlaying(game, true));
  game.hud.root.querySelector('#btn-continue').addEventListener('click', () => {
    const save = loadSave();
    if (save) {
      game.money = save.money;
      game.stats.missionsDone = save.missionsDone;
      game.stats.earned = save.earned;
    }
    startPlaying(game);
  });
  game.hud.root.querySelector('#btn-resume').addEventListener('click', () => {
    game.mode = 'play';
    showScreen(game.hud, 'play');
  });
  game.hud.root.querySelector('#btn-quit').addEventListener('click', () => {
    game.mode = 'menu';
    showScreen(game.hud, 'menu');
  });
  game.hud.root.querySelector('#btn-again').addEventListener('click', () => window.location.reload());
  game.hud.root.querySelector('#btn-menu').addEventListener('click', () => window.location.reload());
}

/** Boot the game, stage a screenshot scene when asked, and run the loop. */
function boot() {
  const game = createGame();
  game.__step = (dt) => updateGame(game, dt);
  bindInput(game);
  const save = loadSave();
  if (save && save.missionsDone > 0) {
    game.hud.root.querySelector('#btn-continue').classList.remove('hidden');
  }
  if (game.shotMode) {
    game.mode = 'play';
    showScreen(game.hud, 'play');
    stageShot(game.shotName, game);
    game.shotFrozen = true;
    updateHud(game.hud, game);
    game.render.renderer.render(game.scene, game.camera);
  }
  // The test hook: Playwright drives the real game through this handle.
  window.__solara = {
    game,
    state: () => ({
      mode: game.mode,
      money: game.money,
      health: game.player.health,
      wanted: game.wanted.level,
      missionsDone: game.stats.missionsDone,
      player: { x: game.player.x, z: game.player.z, inCar: !!game.player.inCar },
      mission: game.missionRunner.mission ? game.missionRunner.mission.name : null,
      objective: game.missionRunner.objectiveLabel(),
      marker: game.missionRunner.markerPos,
    }),
    startMission: (i) => game.missionRunner.startMission(i),
    completeAllMissions: () => {
      while (game.stats.missionsDone < MISSIONS.length) {
        game.missionRunner.startMission(game.stats.missionsDone);
        game.missionRunner.phase = 'active';
        game.missionRunner.complete();
      }
    },
    killPlayer: () => damagePlayer(game.player, 9999),
    setMoney: (n) => { game.money = n; },
  };

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.mode === 'play' && !game.shotFrozen) updateGame(game, dt);
    else if (game.mode === 'menu') {
      // The menu orbits the city in a slow cinematic pan.
      game.time += dt;
      const a = game.time * 0.05;
      game.chaseCam.place(Math.sin(a) * 150, 55, Math.cos(a) * 150 - 40, 0, 4, -60);
      game.city.seaTexture.offset.y += dt * 0.015;
    }
    game.render.renderer.render(game.scene, game.camera);
  }
  requestAnimationFrame(frame);
}

boot();
