// hud.js — everything on top of the 3D view: the wanted stars, the money,
// the health and armour bars, the weapon slot, the radio ticker, the
// mission objective, the portrait dialogue box, the live minimap, and the
// title, pause, win and lose screens.
import { AVENUES, RADIO_STATIONS, STREETS, WORLD_HALF, moneyString } from './config.js';

export const STATION_SONGS = RADIO_STATIONS;

/** Build the whole HUD inside `root` and return handles to update it. */
export function createHud(root) {
  root.innerHTML = `
    <div id="hud" class="hidden">
      <div id="top-left">
        <div id="stars" aria-label="Wanted level"></div>
        <div id="money">$0</div>
        <div id="mission-name"></div>
      </div>
      <div id="top-right"><canvas id="minimap" width="220" height="220"></canvas></div>
      <div id="objective"></div>
      <div id="toasts"></div>
      <div id="bottom-left">
        <div class="bar-label">HEALTH</div>
        <div class="bar"><div id="health-fill"></div></div>
        <div class="bar-label">ARMOR</div>
        <div class="bar"><div id="armor-fill"></div></div>
      </div>
      <div id="bottom-right">
        <div id="weapon">PISTOL · 12 / ∞</div>
        <div id="radio">SOLARA FM 88.1 — Neon Palms</div>
        <div id="hint">E enter car · Q rob · T radio</div>
      </div>
      <div id="crosshair">+</div>
      <div id="dialogue" class="hidden">
        <div id="portrait">MV</div>
        <div id="dialogue-body"><div id="dialogue-name"></div><div id="dialogue-text"></div><div id="dialogue-next">E ▸ continue</div></div>
      </div>
      <div id="center-banner" class="hidden"></div>
    </div>
    <div id="menu" class="screen">
      <div class="title-block">
        <div class="kicker">CORAL BAY · SUNSET · OPEN WORLD</div>
        <h1>SOLARA</h1>
        <div class="subtitle">— Streets of Coral Bay —</div>
        <p class="tagline">Dante Cruz is back in town. Steal cars, outrun the Coral Bay PD, and take all eight jobs from Marisol Vega.</p>
        <div class="menu-buttons">
          <button id="btn-start">▶ START STORY</button>
          <button id="btn-continue" class="hidden">↻ CONTINUE</button>
          <button id="btn-freeroam">☀ FREE ROAM</button>
        </div>
        <p class="controls">WASD move / drive · SHIFT sprint · E enter or exit car · SPACE or CLICK shoot · Q rob · R reload · T radio · M mission · P pause</p>
        <p class="fineprint">An original open-world crime game. Its city, characters, vehicles, story, art and music are all its own.</p>
      </div>
    </div>
    <div id="pause" class="screen hidden">
      <h2>PAUSED</h2>
      <p>Coral Bay waits for no one — except right now.</p>
      <div class="menu-buttons"><button id="btn-resume">▶ RESUME</button><button id="btn-quit">■ QUIT TO MENU</button></div>
    </div>
    <div id="end" class="screen hidden">
      <h2 id="end-title">WASTED</h2>
      <p id="end-text"></p>
      <div id="end-stats"></div>
      <div class="menu-buttons"><button id="btn-again">↻ PLAY AGAIN</button><button id="btn-menu">■ MAIN MENU</button></div>
    </div>`;
  return {
    root,
    hud: root.querySelector('#hud'),
    stars: root.querySelector('#stars'),
    money: root.querySelector('#money'),
    missionName: root.querySelector('#mission-name'),
    minimap: root.querySelector('#minimap'),
    objective: root.querySelector('#objective'),
    toasts: root.querySelector('#toasts'),
    healthFill: root.querySelector('#health-fill'),
    armorFill: root.querySelector('#armor-fill'),
    weapon: root.querySelector('#weapon'),
    radio: root.querySelector('#radio'),
    hint: root.querySelector('#hint'),
    crosshair: root.querySelector('#crosshair'),
    dialogue: root.querySelector('#dialogue'),
    portrait: root.querySelector('#portrait'),
    dialogueName: root.querySelector('#dialogue-name'),
    dialogueText: root.querySelector('#dialogue-text'),
    centerBanner: root.querySelector('#center-banner'),
    menu: root.querySelector('#menu'),
    pause: root.querySelector('#pause'),
    end: root.querySelector('#end'),
    endTitle: root.querySelector('#end-title'),
    endText: root.querySelector('#end-text'),
    endStats: root.querySelector('#end-stats'),
  };
}

/** Render the wanted stars: filled gold stars for the heat, dim for the rest. */
export function renderStars(hud, level) {
  let html = '';
  for (let i = 0; i < 5; i += 1) {
    html += `<span class="star${i < level ? ' lit' : ''}">★</span>`;
  }
  hud.stars.innerHTML = html;
}

/** Update every live HUD value from the game state, once a frame. */
export function updateHud(hud, game) {
  renderStars(hud, game.wanted.level);
  hud.money.textContent = moneyString(game.money);
  hud.missionName.textContent = game.missionRunner.mission ? `JOB ${game.missionRunner.index + 1}/8 — ${game.missionRunner.mission.name}` : 'FREE ROAM · CORAL BAY';
  hud.objective.textContent = '◎ ' + game.missionRunner.objectiveLabel();
  hud.healthFill.style.width = Math.max(0, game.player.health) + '%';
  hud.armorFill.style.width = Math.max(0, game.player.armor) + '%';
  const pistol = game.pistol;
  hud.weapon.textContent = pistol.reloading > 0 ? 'PISTOL · RELOADING…' : `PISTOL · ${pistol.ammo} / ∞`;
  const station = RADIO_STATIONS[game.radioStation];
  hud.radio.textContent = `${station.name} — ${station.song}`;
  hud.hint.textContent = game.player.inCar ? 'E exit car · SPACE handbrake · T radio' : 'E enter car · Q rob · SPACE shoot · T radio';
  hud.crosshair.style.display = game.player.inCar ? 'none' : 'block';
  drawMinimap(hud.minimap, game);
}

/** Draw the minimap: sea, sand, roads, traffic, police, the player, the marker. */
export function drawMinimap(canvas, game) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const scale = size / (WORLD_HALF * 2 + 40);
  const toMap = (x, z) => [(x + WORLD_HALF + 20) * scale, (z + WORLD_HALF + 20) * scale];
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(8, 20, 34, 0.88)';
  ctx.fillRect(0, 0, size, size);
  // Sea and sand at the top (north is -Z).
  const [, seaY] = toMap(0, -170);
  ctx.fillStyle = '#1d7f8e';
  ctx.fillRect(0, 0, size, seaY);
  ctx.fillStyle = '#e8c98f';
  ctx.fillRect(0, seaY, size, toMap(0, -150)[1] - seaY);
  // Roads.
  ctx.strokeStyle = '#8a8f9e';
  ctx.lineWidth = 3;
  for (const z of AVENUES) {
    const [, y] = toMap(0, z);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (const x of STREETS) {
    const [mx] = toMap(x, 0);
    ctx.beginPath();
    ctx.moveTo(mx, 0);
    ctx.lineTo(mx, size);
    ctx.stroke();
  }
  // Objective marker: a pulsing pink diamond.
  const runner = game.missionRunner;
  if (runner.markerPos) {
    const [mx, my] = toMap(runner.markerPos.x, runner.markerPos.z);
    const pulse = 5 + Math.sin(game.time * 5) * 2;
    ctx.fillStyle = '#ff4d8d';
    ctx.beginPath();
    ctx.moveTo(mx, my - pulse - 3);
    ctx.lineTo(mx + pulse, my);
    ctx.lineTo(mx, my + pulse + 3);
    ctx.lineTo(mx - pulse, my);
    ctx.closePath();
    ctx.fill();
  }
  // Traffic: small yellow dots. Police: flashing blue.
  for (const car of game.trafficCars) {
    const [mx, my] = toMap(car.mesh.position.x, car.mesh.position.z);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
  }
  const flash = Math.sin(game.time * 9) > 0;
  for (const car of game.policeCars) {
    const [mx, my] = toMap(car.mesh.position.x, car.mesh.position.z);
    ctx.fillStyle = flash ? '#ff2a2a' : '#3a6bff';
    ctx.beginPath();
    ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow pointing where Dante faces.
  const [px, py] = toMap(game.player.x, game.player.z);
  const heading = game.player.inCar ? game.player.inCar.heading : game.player.heading;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + Math.sin(heading) * 8, py + Math.cos(heading) * 8);
  ctx.lineTo(px + Math.sin(heading + 2.5) * 6, py + Math.cos(heading + 2.5) * 6);
  ctx.lineTo(px + Math.sin(heading - 2.5) * 6, py + Math.cos(heading - 2.5) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Show a portrait dialogue line, or hide the box when `line` is null. */
export function showDialogue(hud, line, mission) {
  if (!line) {
    hud.dialogue.classList.add('hidden');
    return;
  }
  hud.dialogue.classList.remove('hidden');
  hud.dialogueName.textContent = line.speaker;
  hud.dialogueText.textContent = line.text;
  const initials = line.speaker.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  hud.portrait.textContent = initials;
  hud.portrait.style.background = mission && mission.color ? mission.color : '#e63b2e';
}

/** A short toast message above the objective, fading after a few seconds. */
export function toast(hud, text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  hud.toasts.appendChild(el);
  window.setTimeout(() => el.remove(), 4200);
  while (hud.toasts.children.length > 3) hud.toasts.firstChild.remove();
}

/** A big centre-screen banner, e.g. MISSION COMPLETE +$3,000. */
export function banner(hud, title, sub = '') {
  hud.centerBanner.innerHTML = `<div class="banner-title">${title}</div><div class="banner-sub">${sub}</div>`;
  hud.centerBanner.classList.remove('hidden');
  window.clearTimeout(banner._t);
  banner._t = window.setTimeout(() => hud.centerBanner.classList.add('hidden'), 3200);
}

/** Show one screen (menu / pause / end) and hide the HUD, or the reverse. */
export function showScreen(hud, name) {
  hud.menu.classList.toggle('hidden', name !== 'menu');
  hud.pause.classList.toggle('hidden', name !== 'pause');
  hud.end.classList.toggle('hidden', name !== 'end');
  hud.hud.classList.toggle('hidden', name !== 'play');
}
