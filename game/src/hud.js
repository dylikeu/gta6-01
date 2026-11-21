// The whole 2D HUD: wanted stars, cash, health/armor, weapon slot, radio, mission
// objective, minimap, dialog box with character portraits, prompts and banners.
// Plain DOM over the WebGL canvas, so it stays crisp at contact-sheet size.
import { CITY, RADIO } from './config.js';

// Tiny inline-SVG portraits (drawn, not loaded) — one face per story character.
export function portraitSVG(name, color) {
  const hair = name === 'Luna' ? 'M18 14 q-14 -4 -12 14 l4 2 q-2 -12 8 -12 q10 0 8 12 l4 -2 q2 -18 -12 -14' : 'M20 12 q-12 -2 -12 8 l3 1 q0 -6 9 -6 q9 0 9 6 l3 -1 q0 -10 -12 -8';
  const face = {
    Rico: '#c68e5f', Dante: '#c68e5f', Luna: '#f1c27d', 'Mr. Vane': '#e0ac69',
  }[name] || '#c68e5f';
  return `<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
    <rect width="64" height="64" fill="${color}"/>
    <circle cx="32" cy="26" r="10" fill="${face}"/>
    <path d="${hair}" fill="#1d1a16"/>
    <circle cx="28" cy="25" r="1.6" fill="#1d1a16"/><circle cx="36" cy="25" r="1.6" fill="#1d1a16"/>
    <path d="M28 32 q4 3 8 0" stroke="#7a4a2b" stroke-width="1.6" fill="none"/>
    <path d="M20 44 q12 -6 24 0 l2 20 l-28 0 z" fill="#2b2d42"/>
    <rect x="28" y="46" width="8" height="4" fill="#ffd60a"/>
  </svg>`;
}

export function createHud() {
  const hud = document.getElementById('hud');
  const el = {};
  el.stars = document.getElementById('hud-stars');
  el.money = document.getElementById('hud-money');
  el.healthFill = document.getElementById('hud-health-fill');
  el.armorFill = document.getElementById('hud-armor-fill');
  el.healthText = document.getElementById('hud-health-text');
  el.weapon = document.getElementById('hud-weapon');
  el.radio = document.getElementById('hud-radio');
  el.speed = document.getElementById('hud-speed');
  el.objective = document.getElementById('hud-objective');
  el.objectiveTitle = document.getElementById('hud-objective-title');
  el.objectiveDist = document.getElementById('hud-objective-dist');
  el.minimap = document.getElementById('hud-minimap');
  el.minimapCtx = el.minimap.getContext('2d');
  el.dialog = document.getElementById('hud-dialog');
  el.dialogPortrait = document.getElementById('hud-dialog-portrait');
  el.dialogName = document.getElementById('hud-dialog-name');
  el.dialogText = document.getElementById('hud-dialog-text');
  el.prompt = document.getElementById('hud-prompt');
  el.banner = document.getElementById('hud-banner');
  el.bannerTitle = document.getElementById('hud-banner-title');
  el.bannerSub = document.getElementById('hud-banner-sub');
  el.center = document.getElementById('hud-center');
  el.crosshair = document.getElementById('hud-crosshair');
  return { root: hud, ...el };
}

function starRow(wanted) {
  let out = '';
  for (let i = 0; i < 5; i += 1) {
    out += `<span class="star ${i < wanted ? 'on' : ''}">★</span>`;
  }
  return out;
}

export function updateHud(state, hud) {
  const player = state.player;
  hud.stars.innerHTML = starRow(player.wanted);
  hud.money.textContent = `$${player.money.toLocaleString('en-US')}`;
  hud.healthFill.style.width = `${player.health}%`;
  hud.armorFill.style.width = `${player.armor}%`;
  hud.healthText.textContent = `${Math.ceil(player.health)}`;
  hud.weapon.textContent = player.weapon === 'pistol' ? 'PISTOL  ∞' : 'FISTS';
  const station = RADIO[state.radio.station];
  hud.radio.innerHTML = `<b>${station.name}</b> — ${station.song}`;
  hud.speed.textContent = !player.onFoot && player.car
    ? `${Math.round(Math.abs(player.car.speed) * 2.237)} mph` : '';
  hud.speed.style.display = (!player.onFoot && player.car) ? 'block' : 'none';

  // Objective panel (top-left).
  const mission = state.missions.active;
  if (mission) {
    hud.objective.style.display = 'block';
    hud.objectiveTitle.textContent = `${mission.def.id}. ${mission.def.title}`;
    const count = mission.def.kind === 'eliminate'
      ? `  (${mission.count}/${mission.target})` : '';
    hud.objectiveDist.textContent = `${state.missions.objectiveText}${count}`;
  } else if (state.missions.completed >= 8) {
    hud.objective.style.display = 'block';
    hud.objectiveTitle.textContent = 'KING OF CORAL BAY';
    hud.objectiveDist.textContent = 'Story complete — free roam!';
  } else {
    hud.objective.style.display = 'none';
  }

  // Dialog box.
  const dialog = state.missions.dialog;
  if (dialog) {
    const [speaker, text] = dialog.lines[dialog.lineIndex];
    hud.dialog.style.display = 'flex';
    const color = { Rico: '#e63946', Dante: '#2ec4b6', Luna: '#f7b801', 'Mr. Vane': '#4361ee' }[speaker] || '#888';
    hud.dialogPortrait.innerHTML = portraitSVG(speaker, color);
    hud.dialogName.textContent = speaker;
    hud.dialogName.style.color = color;
    hud.dialogText.textContent = text;
  } else {
    hud.dialog.style.display = 'none';
  }

  // Banner (mission complete etc.).
  const banner = state.missions.banner;
  if (banner && state.time < banner.until) {
    hud.banner.style.display = 'block';
    hud.bannerTitle.textContent = banner.text;
    hud.bannerSub.textContent = banner.sub;
  } else {
    hud.banner.style.display = 'none';
  }

  // Context prompt (enter car, etc.).
  hud.prompt.textContent = state.promptText || '';
  hud.prompt.style.display = state.promptText ? 'block' : 'none';

  // Crosshair only when on foot with the pistol out (never in staged shots).
  hud.crosshair.style.display = (player.onFoot && player.weapon === 'pistol' && state.screen === 'play' && !state.shotMode) ? 'block' : 'none';

  drawMinimap(state, hud);
}

function drawMinimap(state, hud) {
  const ctx = hud.minimapCtx;
  const S = 190;
  const scale = S / (CITY.maxCoord * 2 + 80);
  const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  // Ocean (west) and land.
  ctx.fillStyle = '#1e6f8e';
  ctx.fillRect(0, 0, S, S);
  const [beachX] = toMap(CITY.beachX, 0);
  ctx.fillStyle = '#3f7d4e';
  ctx.fillRect(beachX, 0, S - beachX, S);
  ctx.fillStyle = '#e8c98f';
  ctx.fillRect(beachX - 6, 0, 6, S);
  // Roads.
  ctx.strokeStyle = '#33323e';
  ctx.lineWidth = 4;
  for (let c = -CITY.halfSize; c <= CITY.halfSize; c += CITY.block + CITY.road) {
    const [x] = toMap(c, 0);
    const [, z] = toMap(0, c);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
  }
  // Objective marker (yellow diamond).
  if (state.missions.objectivePos) {
    const [ox, oz] = toMap(state.missions.objectivePos.x, state.missions.objectivePos.z);
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.moveTo(ox, oz - 7); ctx.lineTo(ox + 6, oz); ctx.lineTo(ox, oz + 7); ctx.lineTo(ox - 6, oz);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Police (red), traffic (white), enemies (purple).
  for (const car of state.cars) {
    if (car.kind === 'player') continue;
    const [cx, cz] = toMap(car.pos.x, car.pos.z);
    ctx.fillStyle = car.kind === 'police' ? '#ff2e2e' : '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cz, car.kind === 'police' ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const e of state.enemies || []) {
    if (!e.alive) continue;
    const [ex, ez] = toMap(e.pos.x, e.pos.z);
    ctx.fillStyle = '#c77dff';
    ctx.fillRect(ex - 3, ez - 3, 6, 6);
  }
  // Player arrow (centre-ish, points along heading).
  const player = state.player;
  const [px, py] = toMap(player.pos.x, player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(player.heading), Math.cos(player.heading)) + Math.PI);
  ctx.fillStyle = '#2ec4b6';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Ring.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

// Big centre-screen text: WASTED / BUSTED / story complete.
export function showCenter(hud, title, sub, color) {
  hud.center.style.display = 'block';
  hud.center.innerHTML = `<div class="center-title" style="color:${color}">${title}</div><div class="center-sub">${sub}</div>`;
}

export function hideCenter(hud) {
  hud.center.style.display = 'none';
  hud.center.innerHTML = '';
}
