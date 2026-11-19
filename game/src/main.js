// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between screens: title, play, paused, briefing, shop, help, wasted,
// busted, mission done and mission failed. Saves live in localStorage; the story auto-saves
// when a job is done.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|walk|drive|foot|steal|wanted|mission|start
// (with &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, ECONOMY, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createWorld } from './world.js';
import { EVENT_BUSTED, EVENT_CAR_STOLEN, EVENT_CRASH, EVENT_HIT, EVENT_KILL, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED, EVENT_WANTED_UP } from './events.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createMissions, MISSION_DONE, MISSION_FAILED, TAXI_DONE } from './missions.js';
import { createRenderer, SCREEN_BRIEFING, SCREEN_BUSTED, SCREEN_FAILED, SCREEN_HELP, SCREEN_MISSION_DONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE } from './render.js';
import { applySave, hasSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// Any uncaught error is reported on the window, so a headless check can see it.
window.addEventListener('error', (event) => {
  window.__gameError = String(event.message || event.error || 'unknown error');
});

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = buildCity(random);
const world = createWorld(random, city);
const missions = createMissions(world);
const renderer = createRenderer(canvas, city);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best cash then lasts this visit only.
  }
}

function runShot(name) {
  const staged = stageShot(name, world, missions);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, staged.screen, staged.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let previousScreen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingFlags = 0;
  let damageFlash = 0;
  let banner = '';
  let bannerTimer = 0;
  let lostCash = 0;
  let uiMission = null;

  function announce(message) {
    status.textContent = message;
  }

  function showBanner(message, seconds = 2.5) {
    banner = message;
    bannerTimer = seconds;
  }

  function startNewGame() {
    world.reset(true);
    missions.clearJustFinished();
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    showBanner('Welcome to Solmar, Leo.');
    announce('Playing. Go to Rosa\'s Garage to start the first job.');
  }

  function continueGame() {
    const data = loadSave();
    if (!data) return;
    world.reset(true);
    applySave(world, data);
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    showBanner('Welcome back, Leo.');
    announce('Continuing your game.');
  }

  function respawn(kind) {
    const state = world.state;
    const lossRate = kind === 'wasted' ? ECONOMY.wastedLoss : ECONOMY.bustedLoss;
    lostCash = Math.floor(state.cash * lossRate);
    state.cash -= lostCash;
    state.health = 100;
    state.armor = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.bustTimer = 0;
    state.player.inCar = null;
    const landmark = kind === 'wasted' ? 'Solmar General' : 'Solmar PD HQ';
    const lm = city.landmarks[landmark];
    state.player.x = lm.x;
    state.player.y = lm.building.y + lm.building.h + 60;
    if (missions.missionIndex >= 0) missions.failMission();
    if (state.cash > best) {
      best = state.cash;
      saveBest(best);
    }
  }

  function garagePrompt() {
    const state = world.state;
    if (state.player.inCar) return '';
    if (!missions.nearGarageDoor()) return '';
    const next = missions.nextMission;
    if (next) return `E — Start job: ${next.title}    F — Garage shop`;
    return 'F — Garage shop';
  }

  function carPrompt() {
    const state = world.state;
    if (state.player.inCar) return 'E — Get out';
    const car = world.nearestCar(state.player.x, state.player.y, 70);
    if (!car) return '';
    if (car.driver === 'traffic') return 'E — Steal this car';
    if (car.driver === 'police') return 'E — Steal the cop car?!';
    return 'E — Get in';
  }

  function uiForPlay() {
    return {
      objective: missions.objectiveText(),
      marker: missions.marker(),
      prompt: garagePrompt() || carPrompt(),
      banner: bannerTimer > 0 ? banner : '',
      damageFlash,
      hasSave: hasSave(),
      best,
    };
  }

  /** One fixed step of live play. `flags` are this frame's one-shot actions. */
  function stepPlay(dt, flags) {
    const state = world.state;
    if (flags & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (flags & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      showBanner(audio.isMuted() ? 'Muted' : 'Sound on', 1.2);
    }
    const control = {
      move: input.move(),
      sprint: input.sprint(),
      aim: renderer.screenToWorld(input.mouse.x, input.mouse.y),
      shoot: input.mouse.down && !state.player.inCar,
      enter: Boolean(flags & ACTION_ENTER),
    };
    // F at the garage door opens the shop; E at the garage door starts the next job.
    // The garage always wins over a car parked at the door (e.g. the delivered van),
    // so the next job is never blocked — the player can drive away from the door.
    if (flags & ACTION_INTERACT && missions.nearGarageDoor() && !state.player.inCar) {
      screen = SCREEN_SHOP;
      return;
    }
    if (control.enter && missions.nearGarageDoor() && !state.player.inCar && missions.nextMission) {
      screen = SCREEN_BRIEFING;
      return;
    }
    const events = world.step(dt, control);
    const missionEvents = missions.update(dt);
    if (events & EVENT_HIT) {
      damageFlash = 0.7;
      audio.hit();
    }
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_CAR_STOLEN) showBanner('Car stolen!', 2);
    if (events & EVENT_WANTED_UP) {
      showBanner(`Wanted level ${state.wanted} — the cops are coming!`, 2.5);
      audio.siren(true);
    }
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_KILL) showBanner('Target down', 1.5);
    if (missionEvents & MISSION_DONE) {
      const done = missions.justFinished;
      missions.clearJustFinished();
      saveGame(world, missions);
      if (state.cash > best) {
        best = state.cash;
        saveBest(best);
      }
      audio.jingle();
      audio.siren(false);
      screen = SCREEN_MISSION_DONE;
      uiMission = done;
      return;
    }
    if (missionEvents & MISSION_FAILED) {
      audio.fail();
      screen = SCREEN_FAILED;
      return;
    }
    if (missionEvents & TAXI_DONE) {
      showBanner(`Taxi fare +$${ECONOMY.taxiFare}`, 2);
      audio.cash();
    }
    if (events & EVENT_WASTED) {
      audio.fail();
      audio.siren(false);
      respawn('wasted');
      screen = SCREEN_OVER;
      return;
    }
    if (events & EVENT_BUSTED) {
      audio.fail();
      audio.siren(false);
      respawn('busted');
      screen = SCREEN_BUSTED;
      return;
    }
    if (state.player.inCar) audio.engine(Math.abs(state.player.inCar.speed) / 620);
    else audio.engine(0);
    if (state.wanted === 0) audio.siren(false);
    if (bannerTimer > 0) bannerTimer -= dt;
    if (damageFlash > 0) damageFlash -= dt;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot actions are taken exactly once per frame, here, and handed down. A press
    // that arrives on a frame too fast for a fixed step is carried to the next frame
    // rather than dropped.
    const { flags: freshFlags } = input.takeActions();
    const flags = pendingFlags | freshFlags;
    pendingFlags = 0;

    if (screen === SCREEN_TITLE) {
      // The city idles behind the title: traffic drives, pedestrians walk.
      world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, aim: { x: 0, y: 0 }, shoot: false, enter: false });
      if (flags & ACTION_CONFIRM) startNewGame();
      else if (flags & ACTION_MUTE) audio.setMuted(!audio.isMuted());
      renderer.draw(world.state, SCREEN_TITLE, { hasSave: hasSave(), best });
      accumulator = 0;
      return;
    }

    if (screen === SCREEN_PLAY) {
      // One-shot presses belong to the first sub-step only: replaying them into every
      // catch-up step would, say, enter a car and get straight out again. If no step
      // runs on this fast frame, the press is carried to the next frame, not dropped.
      let firstStep = true;
      let ran = false;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepPlay(STEP, firstStep ? flags : 0);
        firstStep = false;
        ran = true;
        accumulator -= STEP;
      }
      if (!ran) pendingFlags = flags;
      if (screen === SCREEN_PLAY) accumulator = 0;
      renderer.draw(world.state, screen, uiForPlay());
      return;
    }

    accumulator = 0;
    if (screen === SCREEN_PAUSED) {
      if (flags & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      renderer.draw(world.state, SCREEN_PAUSED, { objective: missions.objectiveText(), marker: missions.marker(), damageFlash: 0, hasSave: hasSave(), best });
      return;
    }
    if (screen === SCREEN_BRIEFING) {
      if (flags & ACTION_CONFIRM) {
        const next = missions.nextMission;
        if (next) missions.startMission(next.id);
        missions.clearBriefing();
        screen = SCREEN_PLAY;
        announce(`Job started: ${next ? next.title : ''}`);
      } else if (flags & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
      }
      renderer.draw(world.state, SCREEN_BRIEFING, { mission: missions.nextMission, damageFlash: 0 });
      return;
    }
    if (screen === SCREEN_MISSION_DONE) {
      if (flags & ACTION_CONFIRM) screen = SCREEN_PLAY;
      renderer.draw(world.state, SCREEN_MISSION_DONE, { mission: uiMission, nextTitle: missions.nextMission ? missions.nextMission.title : '', damageFlash: 0 });
      return;
    }
    if (screen === SCREEN_FAILED) {
      if (flags & ACTION_CONFIRM) screen = SCREEN_PLAY;
      renderer.draw(world.state, SCREEN_FAILED, { damageFlash: 0 });
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      const kind = screen;
      if (flags & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        showBanner(kind === SCREEN_OVER ? 'Patched up. Back on the streets.' : 'Out on bail. Back on the streets.', 2.5);
      }
      renderer.draw(world.state, screen, { lostCash, damageFlash: 0 });
      return;
    }
    if (screen === SCREEN_SHOP) {
      if (flags & ACTION_PAUSE) screen = SCREEN_PAUSED;
      renderer.draw(world.state, SCREEN_SHOP, { damageFlash: 0 });
      return;
    }
    if (screen === SCREEN_HELP) {
      if (flags & ACTION_PAUSE) screen = previousScreen;
      renderer.draw(world.state, SCREEN_HELP, { damageFlash: 0 });
      return;
    }
    renderer.draw(world.state, screen, { damageFlash: 0 });
  }

  // Keys that are not one-shot actions: C to continue, H for help, S to save, G for the
  // shop, 1/2/3 to buy. They are read here so the fixed-step loop stays clean.
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (screen === SCREEN_TITLE) {
      if (event.code === 'KeyC' && hasSave()) continueGame();
      else if (event.code === 'KeyH') {
        previousScreen = SCREEN_TITLE;
        screen = SCREEN_HELP;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (event.code === 'KeyS') {
        if (saveGame(world, missions)) showBanner('Game saved.', 2);
        else showBanner('Could not save.', 2);
      } else if (event.code === 'KeyG') {
        screen = SCREEN_SHOP;
      } else if (event.code === 'KeyH') {
        previousScreen = SCREEN_PAUSED;
        screen = SCREEN_HELP;
      }
    } else if (screen === SCREEN_SHOP) {
      const state = world.state;
      if (event.code === 'Digit1' && state.cash >= ECONOMY.repairCost) {
        if (state.player.inCar) state.player.inCar.health = 100;
        state.cash -= ECONOMY.repairCost;
        audio.cash();
      } else if (event.code === 'Digit2' && state.cash >= ECONOMY.armorCost) {
        state.armor = 100;
        state.cash -= ECONOMY.armorCost;
        audio.cash();
      } else if (event.code === 'Digit3' && state.cash >= ECONOMY.shotgunCost) {
        state.weapon = 'shotgun';
        state.shotgunAmmo += ECONOMY.shotgunAmmo;
        state.cash -= ECONOMY.shotgunCost;
        audio.cash();
      }
    }
  });

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A read-only handle for automated play-testing (and the curious): the live world,
  // the missions and the current screen.
  window.__solmar = {
    world,
    missions,
    get screen() {
      return screen;
    },
  };

  announce('Solmar. Press Enter to start, C to continue.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
