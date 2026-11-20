// VELMARA — Streets of the Sun: game loop, renderer, input, shot presets,
// and the ?test=1 self-test. Vanilla canvas JS, no libraries, no network.
import { createState, WORLD_W, WORLD_H, VIEW_W, VIEW_H, addCash, showBanner, say, addParticles } from './core/state.js';
import { clamp, dist, makeRng } from './core/math.js';
import { buildCity, districtAt, ROAD_STEP, ROAD_W, collideBuildings } from './city/map.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds, drawCar, drawPed, makeCar, CAR_MODELS } from './city/traffic.js';
import { updatePlayerOnFoot, exitCar, enterCar, updateWantedDecay, drawPlayer, nearestCar } from './player/player.js';
import { updateDriving } from './player/drive.js';
import { updateCombat, drawBullets } from './player/combat.js';
import { updateChase, drawCops, spawnCopCar, spawnCopPed } from './police/chase.js';
import { raiseWanted, bribe } from './police/wanted.js';
import { startMission, updateMission, currentMissionDef, MISSIONS } from './missions/story.js';
import { drawHUD } from './hud/hud.js';
import { drawTitle, titleClick, drawPause, pauseClick, drawGameOver, drawDealership, dealershipClick } from './hud/menus.js';
import { createSfx } from './audio/sfx.js';
import { saveGame, loadGame, applySave, hasSave, clearSave } from './save/savegame.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const state = createState(seed);
const sfx = createSfx();
let showHelp = false;
let showShop = false;
let lastSave = 0;

function newRun() {
  state.city = buildCity(seed);
  state.cars = []; state.peds = []; state.cops = []; state.bullets = [];
  state.pickups = []; state.particles = []; state.floaters = [];
  spawnTraffic(state, 22);
  spawnPeds(state, 34);
  // Cash pickups scattered around the city.
  for (let i = 0; i < 8; i++) {
    state.pickups.push({ x: 200 + state.rng() * 3000, y: 200 + state.rng() * 2200, amount: 50, t: 0 });
  }
  // A starter car parked near Mara so the player can drive immediately.
  const starter = makeCar(state, 1760, 1330, -Math.PI / 2, CAR_MODELS[0], 'parked');
  state.cars.push(starter);
  const p = state.player;
  p.x = 1700; p.y = 1500; p.onFoot = true; p.car = null;
  state.camera.x = p.x; state.camera.y = p.y;
  state.objective = 'Meet Mara at the gold marker';
  say(state, 'Mara Kline', '"You made it. I\'ve got six jobs for you — start at the gold marker, and keep the VPD off your back."', 6);
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  state.keys[e.code] = true;
  if (e.code === 'KeyM') { state.muted = !state.muted; sfx.setMuted(state.muted); }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (state.started && !state.gameOver) state.paused = !state.paused; }
  if (e.code === 'KeyH') showHelp = !showHelp;
  if (e.code === 'KeyB' && state.started) bribe(state);
  if (e.code === 'KeyG' && state.started) showShop = !showShop;
  if (e.code === 'KeyE' && state.started && !state.paused) {
    const lm = state.city.landmarks.maraSpot;
    if (!state.mission && dist(state.player.x, state.player.y, lm.x, lm.y) < 90) startMission(state, sfx);
  }
  sfx.unlock();
});
addEventListener('keyup', (e) => { state.keys[e.code] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - r.left) * (VIEW_W / r.width);
  state.mouse.y = (e.clientY - r.top) * (VIEW_H / r.height);
});
canvas.addEventListener('mousedown', (e) => {
  sfx.unlock();
  const r = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - r.left) * (VIEW_W / r.width);
  state.mouse.y = (e.clientY - r.top) * (VIEW_H / r.height);
  state.mouse.down = true; state.mouse.clicked = true;
  handleClick();
});
addEventListener('mouseup', () => { state.mouse.down = false; });

function handleClick() {
  const mx = state.mouse.x, my = state.mouse.y;
  if (!state.started) {
    const action = titleClick(state, mx, my);
    if (action === 'new') { newRun(); state.started = true; }
    else if (action === 'continue') {
      newRun(); state.started = true;
      const d = loadGame();
      if (d) { applySave(state, d); showBanner(state, 'WELCOME BACK', 'Save loaded — $' + state.player.money.toLocaleString(), 3); }
    }
    return;
  }
  if (state.gameOver) {
    if (mx >= VIEW_W / 2 - 160 && mx <= VIEW_W / 2 + 160 && my >= 430 && my <= 486) {
      state.gameOver = false; state.busted = false; newRun();
    }
    return;
  }
  if (state.paused) {
    const action = pauseClick(state, mx, my);
    if (action === 'resume') state.paused = false;
    else if (action === 'save') { saveGame(state); showBanner(state, 'SAVED', 'Progress saved in your browser', 2); state.paused = false; }
    else if (action === 'restart') { state.paused = false; newRun(); }
    return;
  }
  if (showShop) {
    const model = dealershipClick(state, mx, my);
    if (model && state.player.money >= model.price) {
      state.player.money -= model.price;
      const car = makeCar(state, state.player.x + 70, state.player.y + 40, 0, model, 'parked');
      state.cars.push(car);
      showBanner(state, model.name + ' BOUGHT', 'Your new ride is parked beside you', 3);
      showShop = false;
    } else if (model) { showBanner(state, 'NOT ENOUGH CASH', model.name + ' costs $' + model.price, 2); }
    else showShop = false;
    return;
  }
}

// ---------- update ----------
function update(dt) {
  state.time += dt;
  state.dayT = (state.dayT + dt * 0.0004) % 1;
  if (state.dialogue) { state.dialogue.t += dt; if (state.dialogue.t > state.dialogue.dur) state.dialogue = null; }
  if (state.banner) { state.banner.t += dt; if (state.banner.t > state.banner.dur) state.banner = null; }
  for (const f of state.floaters) f.t += dt;
  state.floaters = state.floaters.filter(f => f.t < f.dur);
  for (const pt of state.particles) { pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
  state.particles = state.particles.filter(pt => pt.t < pt.dur);
  const p = state.player;
  if (p.onFoot) updatePlayerOnFoot(state, dt, sfx);
  else updateDriving(state, dt, sfx);
  if (state.keys['KeyE'] && !p.onFoot && !state._eHeld) { state._eHeld = true; exitCar(state, sfx); }
  if (!state.keys['KeyE']) state._eHeld = false;
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateCombat(state, dt, sfx);
  updateChase(state, dt, sfx);
  updateWantedDecay(state, dt);
  updateMission(state, dt, sfx);
  // Cash pickups.
  for (const pk of state.pickups) {
    pk.t += dt;
    if (dist(p.x, p.y, pk.x, pk.y) < 26) {
      pk.taken = true; addCash(state, pk.amount, 'cash pickup');
      if (sfx) sfx.pickup();
      addParticles(state, pk.x, pk.y, '#7dff8a', 8, 100);
    }
  }
  state.pickups = state.pickups.filter(pk => !pk.taken);
  // Camera follows the player, clamped to the world.
  const tx = clamp(p.x - VIEW_W / 2, -80, WORLD_W - VIEW_W + 80);
  const ty = clamp(p.y - VIEW_H / 2, -80, WORLD_H - VIEW_H + 80);
  state.camera.x += (tx + VIEW_W / 2 - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (ty + VIEW_H / 2 - state.camera.y) * Math.min(1, dt * 5);
  // Autosave every 30 s.
  if (state.time - lastSave > 30) { lastSave = state.time; saveGame(state); }
  if (p.dead && !state.gameOver) state.gameOver = true;
}

// ---------- render ----------
function draw() {
  const camX = state.camera.x - VIEW_W / 2, camY = state.camera.y - VIEW_H / 2;
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (!state.started) { drawTitle(ctx, state); ctx.restore(); return; }
  // Ground: district tint blocks.
  ctx.fillStyle = '#b8a888'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (const d of state.city ? districtBlocks() : []) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x - camX, d.y - camY, d.w, d.h);
  }
  // Marina water.
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(2950 - camX, 0 - camY, 450, 420);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 5; i++) ctx.fillRect(2980 + i * 80 - camX, 60 + i * 60 - camY, 60, 3);
  // Parks.
  for (const pk of state.city.parks) {
    ctx.fillStyle = '#6da85f';
    ctx.beginPath(); ctx.roundRect(pk.x - camX, pk.y - camY, pk.w, pk.h, 12); ctx.fill();
  }
  // Roads.
  ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = ROAD_W; ctx.lineCap = 'square';
  for (let g = 0; g <= WORLD_W; g += ROAD_STEP) {
    ctx.beginPath(); ctx.moveTo(g - camX, -camY); ctx.lineTo(g - camX, WORLD_H - camY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-camX, g - camY); ctx.lineTo(WORLD_W - camX, g - camY); ctx.stroke();
  }
  ctx.strokeStyle = '#e8c93c'; ctx.lineWidth = 2; ctx.setLineDash([18, 22]);
  for (let g = 0; g <= WORLD_W; g += ROAD_STEP) {
    ctx.beginPath(); ctx.moveTo(g - camX, -camY); ctx.lineTo(g - camX, WORLD_H - camY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-camX, g - camY); ctx.lineTo(WORLD_W - camX, g - camY); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Sidewalk edge.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
  for (let g = 0; g <= WORLD_W; g += ROAD_STEP) {
    ctx.strokeRect(g + ROAD_W / 2 - camX, -camY, 0, 0);
  }
  // Buildings.
  for (const b of state.city.buildings) {
    if (b.x - camX > VIEW_W + 100 || b.y - camY > VIEW_H + 100 || b.x + b.w - camX < -100 || b.y + b.h - camY < -100) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x - camX + 6, b.y - camY + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.roundRect(b.x - camX, b.y - camY, b.w, b.h, 4); ctx.fill();
    ctx.fillStyle = b.roof;
    ctx.beginPath(); ctx.roundRect(b.x - camX + 6, b.y - camY + 6, b.w - 12, b.h - 12, 3); ctx.fill();
    // Windows.
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 3 + b.floors) % 3 !== 0) ctx.fillRect(b.x - camX + 12 + i * 34, b.y - camY + 12 + j * 34, 12, 14);
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('▲ ' + b.floors + 'F', b.x + b.w / 2 - camX, b.y + b.h / 2 - camY);
    }
  }
  // Trees + lamps.
  for (const t of state.city.trees) {
    if (t.x - camX < -40 || t.x - camX > VIEW_W + 40 || t.y - camY < -40 || t.y - camY > VIEW_H + 40) continue;
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath(); ctx.arc(t.x - camX, t.y - camY, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath(); ctx.arc(t.x - camX - 3, t.y - camY - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  // Docks + boats.
  for (const d of state.city.docks) {
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(d.x - camX, d.y - camY, d.w, d.h);
    if (d.boat) {
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath(); ctx.roundRect(d.x - camX - 8, d.y - camY + 20, 50, 18, 8); ctx.fill();
    }
  }
  // Landmark labels.
  ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif';
  for (const [key, lm] of Object.entries(state.city.landmarks)) {
    if (lm.x - camX < -80 || lm.x - camX > VIEW_W + 80 || lm.y - camY < -80 || lm.y - camY > VIEW_H + 80) continue;
    ctx.fillStyle = 'rgba(10,14,20,0.7)';
    const w = ctx.measureText(lm.label).width + 18;
    ctx.beginPath(); ctx.roundRect(lm.x - w / 2 - camX, lm.y - 34 - camY, w, 20, 10); ctx.fill();
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText(lm.label, lm.x - camX, lm.y - 20 - camY);
  }
  // Mara / mission marker (pulsing gold ring).
  const marker = state.mission ? state.mission.def.target : state.city.landmarks.maraSpot;
  const pulse = 26 + Math.sin(state.time * 4) * 6;
  ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(marker.x - camX, marker.y - camY, pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath(); ctx.arc(marker.x - camX, marker.y - camY, 6, 0, Math.PI * 2); ctx.fill();
  // Cash pickups.
  for (const pk of state.pickups) {
    const bob = Math.sin(state.time * 3 + pk.x) * 3;
    ctx.fillStyle = '#7dff8a';
    ctx.beginPath(); ctx.arc(pk.x - camX, pk.y - camY + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e2a12'; ctx.font = 'bold 11px sans-serif';
    ctx.fillText('$', pk.x - camX, pk.y - camY + bob + 4);
  }
  // World-space entities: translate once and draw in world coords.
  ctx.save();
  ctx.translate(-camX, -camY);
  for (const car of state.cars) drawCar(ctx, car, state.time);
  for (const ped of state.peds) drawPed(ctx, ped, state.time);
  drawPlayer(ctx, state, state.time);
  drawCops(ctx, state, state.time);
  drawBullets(ctx, state);
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.dur);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Day lighting: warm late-afternoon tint.
  const sun = 0.10 + 0.05 * Math.sin(state.dayT * Math.PI * 2);
  ctx.fillStyle = 'rgba(255,170,80,' + sun.toFixed(3) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Vignette.
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 380, VIEW_W / 2, VIEW_H / 2, 760);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawHUD(ctx, state);
  if (showShop) drawDealership(ctx, state);
  if (showHelp && !state.paused) {
    ctx.fillStyle = 'rgba(8,10,16,0.85)';
    ctx.beginPath(); ctx.roundRect(340, 200, 600, 320, 14); ctx.fill();
    ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', VIEW_W / 2, 250);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.textAlign = 'left';
    const lines = ['WASD / arrows — move or drive', 'Shift — sprint', 'E — enter / exit car, start mission at the gold marker', 'Mouse + click — aim and shoot · R — reload', 'Space — handbrake · B — pay down heat · G — dealership', 'P — pause · M — mute · H — this help'];
    lines.forEach((l, i) => ctx.fillText(l, 380, 290 + i * 32));
  }
  if (state.paused) drawPause(ctx, state);
  if (state.gameOver) drawGameOver(ctx, state);
  ctx.restore();
}

import { DISTRICTS } from './city/map.js';
function districtBlocks() { return DISTRICTS; }

// ---------- shot presets (for screenshots) ----------
function applyShot(kind) {
  newRun();
  state.started = true;
  const p = state.player;
  if (kind === 'chase') {
    const car = makeCar(state, 1700, 1190, -Math.PI / 2, CAR_MODELS[1], 'player');
    car.speed = 150;
    state.cars.push(car); p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    p.wanted = 4; p.heat = 100;
    spawnCopCar(state); spawnCopCar(state);
    state.cars.filter(c => c.kind === 'police').forEach((c, i) => { c.x = 1700 + (i ? -40 : 40); c.y = car.y + 200 + i * 90; c.angle = -Math.PI / 2; c.speed = 150; });
    state.missionIndex = 0; startMission(state, null);
    state.mission.stage = 1;
    showBanner(state, 'THE GETAWAY', 'Lose the VPD — 4 stars', 6);
    if (state.banner) state.banner.t = 1.2;
    say(state, 'Mara Kline', '"They\'re on you! Lose them — stay out of sight till the stars drop."', 6);
    state.camera.x = p.x; state.camera.y = p.y;
  } else if (kind === 'foot') {
    p.x = 1700; p.y = 1190; p.money = 1250;
    for (let i = 0; i < 6; i++) state.peds.push({ x: 1620 + i * 40, y: 1120 + (i % 3) * 50, angle: 0, speed: 30, color: '#e8e0d0', panic: 0, wait: 0, tx: 1700, ty: 1200, scared: false });
    say(state, 'Mara Kline', '"You made it. I\'ve got six jobs for you — start at the gold marker."', 6);
    state.camera.x = p.x; state.camera.y = p.y;
  } else if (kind === 'mission') {
    p.x = 420; p.y = 500; p.money = 2100;
    state.missionIndex = 2; startMission(state, null);
    state.mission.progress = 1;
    state.objective = 'Deliver 2 more car(s) to the chop shop';
    const car = makeCar(state, 680, 500, Math.PI / 2, CAR_MODELS[5], 'player');
    car.speed = 60;
    state.cars.push(car); p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    showBanner(state, 'MISSION 3 — HOT WHEELS', 'Deliver 2 more cars to the chop shop', 6);
    if (state.banner) state.banner.t = 1.2;
    state.camera.x = 680; state.camera.y = 480;
  } else if (kind === 'combat') {
    p.x = 1700; p.y = 790; p.money = 3400; p.ammo = 18;
    p.wanted = 3; p.heat = 100;
    spawnCopPed(state, 1580, 760); spawnCopPed(state, 1820, 830); spawnCopCar(state);
    state.cars.filter(c => c.kind === 'police').forEach(c => { c.x = 1700; c.y = 960; c.angle = -Math.PI / 2; });
    state.bullets.push({ x: 1720, y: 778, vx: 620, vy: -80, from: 'player', life: 0.6 });
    state.bullets.push({ x: 1680, y: 802, vx: 500, vy: 200, from: 'cop', life: 0.6 });
    state.mouse.x = 760; state.mouse.y = 380; state.mouse.down = true;
    addParticles(state, 1740, 770, '#ffd94a', 8, 120);
    showBanner(state, 'PAYBACK', 'The Dune crew is here — deal with them', 6);
    if (state.banner) state.banner.t = 1.2;
    say(state, 'Mara Kline', '"Loud is fine. Settle it and get out."', 6);
    state.objective = 'Deal with the rival crew (2/4)';
    state.camera.x = p.x; state.camera.y = p.y;
  }
  // Let the world settle a few frames so traffic/peds are in place.
  for (let i = 0; i < 20; i++) { updateTraffic(state, 0.05); updatePeds(state, 0.05); }
  state.time = 12.5;
  draw();
}

// ---------- self-test (?test=1) ----------
function runSelfTest() {
  const results = [];
  function check(name, fn) {
    try { const ok = fn(); results.push({ name, ok: !!ok }); }
    catch (e) { results.push({ name, ok: false, err: String(e && e.message || e) }); }
  }
  check('math clamp/dist', () => clamp(9, 0, 5) === 5 && Math.abs(dist(0, 0, 3, 4) - 5) < 0.001);
  check('rng deterministic', () => { const a = makeRng(7), b = makeRng(7); return a() === b() && a() === b(); });
  check('city builds', () => { const c = buildCity(7); return c.buildings.length > 40 && c.parks.length === 5; });
  check('traffic spawns', () => { const s = createState(7); s.city = buildCity(7); spawnTraffic(s, 10); return s.cars.length >= 10; });
  check('player walks', () => { const s = createState(7); s.city = buildCity(7); s.keys = { KeyD: true }; const x0 = s.player.x; updatePlayerOnFoot(s, 0.5, null); return s.player.x > x0; });
  check('enter car', () => { const s = createState(7); s.city = buildCity(7); const car = makeCar(s, s.player.x + 20, s.player.y, 0, CAR_MODELS[0], 'parked'); s.cars.push(car); enterCar(s, car, null); return !s.player.onFoot && s.player.car === car; });
  check('steal raises wanted', () => { const s = createState(7); s.city = buildCity(7); const car = makeCar(s, s.player.x + 20, s.player.y, 0, CAR_MODELS[0], 'parked'); s.cars.push(car); enterCar(s, car, null); return s.player.wanted >= 1; });
  check('driving accelerates', () => { const s = createState(7); s.city = buildCity(7); const car = makeCar(s, 1700, 1500, 0, CAR_MODELS[0], 'player'); s.cars.push(car); s.player.car = car; s.player.onFoot = false; s.keys = { KeyW: true }; updateDriving(s, 0.5, null); return car.speed > 20; });
  check('exit car', () => { const s = createState(7); s.city = buildCity(7); const car = makeCar(s, 1700, 1500, 0, CAR_MODELS[0], 'player'); s.cars.push(car); s.player.car = car; s.player.onFoot = false; const { exitCar: ex } = { exitCar }; ex(s, null); return s.player.onFoot && !s.player.car; });
  check('shoot uses ammo', () => { const s = createState(7); s.city = buildCity(7); s.camera = { x: 1700, y: 1500 }; s.mouse = { x: 700, y: 400, down: true }; updateCombat(s, 0.1, null); return s.player.ammo === 23 && s.bullets.length === 1; });
  check('wanted decays unseen', () => { const s = createState(7); s.city = buildCity(7); s.player.wanted = 1; s.player.heat = 5; updateWantedDecay(s, 1); return s.player.wanted === 0; });
  check('police spawn on wanted', () => { const s = createState(7); s.city = buildCity(7); s.player.wanted = 2; s.player.onFoot = false; const car = makeCar(s, 1700, 1500, 0, CAR_MODELS[0], 'player'); s.cars.push(car); s.player.car = car; updateChase(s, 0.1, null); return s.cars.some(c => c.kind === 'police'); });
  check('mission 1 starts', () => { const s = createState(7); s.city = buildCity(7); return startMission(s, null) && s.mission.def.id === 1; });
  check('mission 1 completes', () => { const s = createState(7); s.city = buildCity(7); startMission(s, null); s.player.car = s.mission.car; s.player.onFoot = false; s.player.wanted = 2; updateMission(s, 0.1, null); s.player.wanted = 0; updateMission(s, 0.1, null); return s.missionDone[0] === true && s.player.money === 250 + 400; });
  check('save/load roundtrip', () => { saveGame(state); const d = loadGame(); return d && d.money === state.player.money; });
  const passed = results.filter(r => r.ok).length;
  state.testResults = results;
  document.title = 'TEST ' + passed + '/' + results.length;
  // Draw the report on the canvas.
  ctx.fillStyle = '#0e1420'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('VELMARA SELF-TEST — ' + passed + '/' + results.length + ' PASS', 40, 70);
  results.forEach((r, i) => {
    ctx.fillStyle = r.ok ? '#7dff8a' : '#ff5a5a';
    ctx.font = '18px sans-serif';
    ctx.fillText((r.ok ? 'PASS' : 'FAIL') + '  ' + r.name + (r.err ? ' — ' + r.err : ''), 40, 110 + i * 36);
  });
  console.log('SELF-TEST ' + passed + '/' + results.length, results.filter(r => !r.ok));
  return passed;
}

// ---------- boot ----------
// Debug/test handle (read-only inspection for the self-test + play tests).
window.__velmara = { state, version: 3 };
newRun();
if (params.get('test') === '1') {
  state.testMode = true;
  runSelfTest();
} else if (params.get('shot')) {
  applyShot(params.get('shot'));
  document.title = 'SHOT ' + params.get('shot');
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.started && !state.paused && !state.gameOver) update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
