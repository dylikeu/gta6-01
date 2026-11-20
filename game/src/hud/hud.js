// HUD + live minimap for VELMARA: cash, health, ammo, wanted stars,
// speed, mission objective, dialogue box, banners, floating text.
import { VIEW_W, VIEW_H, rankFor } from '../core/state.js';
import { districtAt } from '../city/map.js';
import { carSpeedKmh } from '../player/drive.js';
import { wantedLabel } from '../police/wanted.js';
import { clamp } from '../core/math.js';

export function drawHUD(ctx, state) {
  const p = state.player;
  // Top-left: cash + rank + district.
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.beginPath(); ctx.roundRect(14, 14, 250, 64, 10); ctx.fill();
  ctx.fillStyle = '#7dff8a'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('$' + p.money.toLocaleString(), 28, 44);
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText(rankFor(p.money).name.toUpperCase(), 28, 64);
  ctx.fillStyle = '#cfe8ff'; ctx.font = '12px sans-serif';
  ctx.fillText(districtAt(p.x, p.y).name, 170, 64);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(28, 70 - 64 + 64, 0, 0);
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.beginPath(); ctx.roundRect(14, 84, 250, 22, 10); ctx.fill();
  ctx.fillStyle = p.health > 40 ? '#4ade80' : '#ff5a5a';
  ctx.beginPath(); ctx.roundRect(20, 89, 238 * clamp(p.health / 100, 0, 1), 12, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('HEALTH ' + Math.round(p.health), 28, 99);
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.beginPath(); ctx.roundRect(VIEW_W - 264, 14, 250, 64, 10); ctx.fill();
  ctx.textAlign = 'right';
  ctx.font = '28px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = p.wanted > 0 ? '#ffd94a' : '#8a97a8';
  ctx.fillText(stars, VIEW_W - 28, 46);
  ctx.fillStyle = p.wanted > 0 ? '#ffb347' : '#cfe8ff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(p.wanted > 0 ? wantedLabel(p.wanted).toUpperCase() : 'CLEAN', VIEW_W - 28, 66);
  // Bottom-right: ammo + speed.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.beginPath(); ctx.roundRect(VIEW_W - 264, VIEW_H - 84, 250, 70, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText(p.onFoot ? ('AMMO ' + p.ammo + ' / ' + p.reserveAmmo) : (carSpeedKmh(p.car) + ' km/h'), VIEW_W - 28, VIEW_H - 44);
  ctx.fillStyle = '#cfe8ff'; ctx.font = '12px sans-serif';
  ctx.fillText(p.onFoot ? 'Click to shoot · R reload' : (p.car ? p.car.model.name + ' · E exit' : ''), VIEW_W - 28, VIEW_H - 24);
  // Bottom-left: objective.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  const objW = Math.min(520, 40 + state.objective.length * 7);
  ctx.beginPath(); ctx.roundRect(14, VIEW_H - 84, objW, 70, 10); ctx.fill();
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('OBJECTIVE', 28, VIEW_H - 60);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
  ctx.fillText(state.objective, 28, VIEW_H - 36);
  // Mission progress pill.
  if (state.mission) {
    ctx.fillStyle = 'rgba(255,217,74,0.9)';
    ctx.beginPath(); ctx.roundRect(14, VIEW_H - 116, 240, 24, 12); ctx.fill();
    ctx.fillStyle = '#20180a'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('MISSION ' + state.mission.def.id + ' · ' + state.mission.def.title.toUpperCase(), 26, VIEW_H - 100);
  }
  ctx.restore();
  drawMinimap(ctx, state);
  drawDialogue(ctx, state);
  drawBanner(ctx, state);
  drawFloaters(ctx, state);
}

function drawMinimap(ctx, state) {
  const S = 168, X = VIEW_W - S - 14, Y = 110;
  const scale = S / 3400;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  ctx.beginPath(); ctx.roundRect(X - 6, Y - 6, S + 12, S + 12, 10); ctx.fill();
  // District tint blocks.
  for (const d of state.city ? [] : []) void d;
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, S, S); ctx.clip();
  ctx.fillStyle = '#2e4a3a'; ctx.fillRect(X, Y, S, S);
  // Roads.
  ctx.strokeStyle = '#5a6a72'; ctx.lineWidth = 2;
  for (let g = 0; g <= 3400; g += 340) {
    ctx.beginPath(); ctx.moveTo(X + g * scale, Y); ctx.lineTo(X + g * scale, Y + S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X, Y + g * scale); ctx.lineTo(X + S, Y + g * scale); ctx.stroke();
  }
  // Water (marina).
  ctx.fillStyle = '#2e7f9e'; ctx.fillRect(X + 2950 * scale, Y, 450 * scale, 420 * scale);
  // Mission target.
  const def = state.mission ? state.mission.def : null;
  const tx = def ? def.target.x : state.city.landmarks.maraSpot.x;
  const ty = def ? def.target.y : state.city.landmarks.maraSpot.y;
  const pulse = 3 + Math.sin(state.time * 5) * 1.5;
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath(); ctx.arc(X + tx * (S / 3400), Y + ty * (S / 2600), pulse + 3, 0, Math.PI * 2); ctx.fill();
  // Police blips.
  ctx.fillStyle = '#5aa2ff';
  for (const c of state.cars) if (c.kind === 'police') { ctx.beginPath(); ctx.arc(X + c.x * scale, Y + c.y * (S / 2600), 3, 0, Math.PI * 2); ctx.fill(); }
  // Player arrow.
  const px = X + state.player.x * scale, py = Y + state.player.y * (S / 2600);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e8b93c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(px, py, 7.5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#cfe8ff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('VELMARA', X, Y + S + 18);
  ctx.restore();
}

function drawDialogue(ctx, state) {
  const d = state.dialogue;
  if (!d) return;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.85)';
  ctx.beginPath(); ctx.roundRect(280, VIEW_H - 190, 720, 84, 12); ctx.fill();
  ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(280, VIEW_H - 190, 720, 84, 12); ctx.stroke();
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(d.who.toUpperCase(), 300, VIEW_H - 164);
  ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
  wrapText(ctx, d.text, 300, VIEW_H - 140, 680, 20);
  ctx.restore();
}

function drawBanner(ctx, state) {
  const b = state.banner;
  if (!b) return;
  const a = b.t < 0.3 ? b.t / 0.3 : b.t > b.dur - 0.5 ? Math.max(0, (b.dur - b.t) / 0.5) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 40px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12;
  ctx.fillText(b.title, VIEW_W / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText(b.sub, VIEW_W / 2, 180);
  ctx.restore();
}

function drawFloaters(ctx, state) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / f.dur);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - state.camera.x + 640, f.y - state.camera.y + 400 - f.t * 30);
  }
  ctx.restore();
}

export function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lineH; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}
