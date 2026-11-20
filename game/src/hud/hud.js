// hud/hud.js — the heads-up display: money, rank, wanted stars, health, ammo,
// speed, mission objective, screen-edge objective arrow, and the live minimap.

import { S, WORLD } from '../core/state.js';
import { formatMoney, formatTime, clamp } from '../core/math.js';
import { objectiveText, currentMission } from '../missions/story.js';
import { currentRank } from '../player/player.js';
import { ROADS, buildings } from '../city/map.js';

const MM = 176; // minimap size in pixels

export function drawHUD(ctx, vw, vh) {
  const p = S.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // --- top left: money + rank ---
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(14, 12, 210, 64, 10); ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(formatMoney(p.money), 26, 42);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(currentRank() + '  •  ' + S.missionDone.length + '/6 jobs done', 26, 64);

  // --- top right: wanted stars ---
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(vw - 214, 12, 200, 52, 10); ctx.fill();
  ctx.font = '26px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < S.wanted ? '#ffd700' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', vw - 198 + i * 38, 46);
  }
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(S.wanted === 0 ? 'CLEAN' : 'WANTED — VPD ON YOU', vw - 198, 60 - 8);

  // --- top centre: mission objective ---
  const m = currentMission();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const obj = objectiveText();
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = ctx.measureText(obj).width + 56;
  ctx.beginPath(); ctx.roundRect(vw / 2 - ow / 2, 12, ow, 44, 10); ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.fillText('◆ ' + (m ? m.title.toUpperCase() : 'VELMARA'), vw / 2 - ow / 2 + 16, 30);
  ctx.fillStyle = '#fff';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(obj, vw / 2 - ow / 2 + 16, 48);

  // --- bottom left: health + weapon ---
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(14, vh - 76, 220, 62, 10); ctx.fill();
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('HEALTH', 26, vh - 54);
  ctx.fillStyle = '#333';
  ctx.fillRect(26, vh - 46, 196, 12);
  ctx.fillStyle = p.health > 40 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(26, vh - 46, 196 * clamp(p.health / 100, 0, 1), 12);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('PISTOL  ' + p.ammo + ' / ' + p.reserve + (p.ammo === 0 ? '  — press R' : ''), 26, vh - 22);

  // --- speed, bottom right, just left of the minimap, when driving ---
  if (S.car) {
    const kmh = Math.round(Math.abs(S.car.speed) * 0.32);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(vw - MM - 168, vh - 76, 140, 62, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(kmh), vw - MM - 40, vh - 36);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('km/h', vw - MM - 40, vh - 20);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, vw, vh);
  drawObjectiveArrow(ctx, vw, vh);

  // --- banner + notice ---
  if (S.banner) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(vw / 2 - 300, vh / 2 - 130, 600, 84, 12); ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(S.banner.title, vw / 2, vh / 2 - 92);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(S.banner.sub, vw / 2, vh / 2 - 64);
    ctx.textAlign = 'left';
  }
  if (S.notice) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const nw = ctx.measureText(S.notice.text).width + 28;
    ctx.beginPath(); ctx.roundRect(vw / 2 - nw / 2, 66, nw, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(S.notice.text, vw / 2, 86);
    ctx.textAlign = 'left';
  }
  // Busted warning while a cop is closing in.
  if (S.bustedTimer > 0.4 && S.mode === 'playing') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2d2d';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('THE VPD HAS YOU CORNERED — DRIVE!', vw / 2, vh - 110);
    ctx.textAlign = 'left';
  }
}

function drawMinimap(ctx, vw, vh) {
  const mx = vw - MM - 14;
  const my = vh - MM - 14;
  const scale = MM / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.roundRect(mx - 6, my - 6, MM + 12, MM + 12, 10); ctx.fill();
  ctx.beginPath(); ctx.rect(mx, my, MM, MM); ctx.clip();
  // Water + sand.
  ctx.fillStyle = '#2e86c1';
  ctx.fillRect(mx, my + 3060 * scale, MM, MM);
  ctx.fillStyle = '#f2d5a0';
  ctx.fillRect(mx, my + 2900 * scale, MM, 160 * scale);
  ctx.fillStyle = '#8fae6b';
  ctx.fillRect(mx, my, MM, 2900 * scale);
  // Roads.
  ctx.strokeStyle = '#5d6d7e';
  ctx.lineWidth = 3;
  for (const r of ROADS) {
    ctx.beginPath(); ctx.moveTo(mx + r * scale, my); ctx.lineTo(mx + r * scale, my + MM); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + r * scale); ctx.lineTo(mx + MM, my + r * scale); ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = 'rgba(60,60,60,0.6)';
  for (const b of buildings) {
    if (b.park) continue;
    ctx.fillRect(mx + b.x * scale, my + b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
  }
  // Traffic dots.
  ctx.fillStyle = '#bdc3c7';
  for (const c of S.cars) ctx.fillRect(mx + c.x * scale - 1, my + c.y * scale - 1, 3, 3);
  // Enemies.
  ctx.fillStyle = '#8e44ad';
  for (const e of S.enemies) ctx.fillRect(mx + e.x * scale - 2, my + e.y * scale - 2, 4, 4);
  // Police.
  ctx.fillStyle = '#2d6bff';
  for (const c of S.copCars) ctx.fillRect(mx + c.x * scale - 2, my + c.y * scale - 2, 4, 4);
  for (const cop of S.cops) ctx.fillRect(mx + cop.x * scale - 2, my + cop.y * scale - 2, 4, 4);
  // Mission marker.
  if (S.missionMarker) {
    const pulse = 3 + Math.sin(S.time * 6) * 1.5;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(mx + S.missionMarker.x * scale, my + S.missionMarker.y * scale, pulse + 2, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const px = mx + S.player.x * scale;
  const py = my + S.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(S.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e67e22';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VELMARA', mx, my - 10);
}

function drawObjectiveArrow(ctx, vw, vh) {
  const mk = S.missionMarker;
  if (!mk) return;
  const cam = S.camera;
  const sx = (mk.x - cam.x) * cam.zoom + vw / 2;
  const sy = (mk.y - cam.y) * cam.zoom + vh / 2;
  if (sx > 40 && sx < vw - 40 && sy > 40 && sy < vh - 40) return; // on screen already
  const cx = clamp(sx, 50, vw - 50);
  const cy = clamp(sy, 90, vh - 90);
  const a = Math.atan2(sy - vh / 2, sx - vw / 2);
  const d = Math.round(Math.hypot(mk.x - S.player.x, mk.y - S.player.y));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d + 'm', cx, cy + 28);
  ctx.textAlign = 'left';
}
