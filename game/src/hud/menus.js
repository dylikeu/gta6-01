// Menus for VELMARA: title screen, pause, help, game over / busted,
// and the dealership. Drawn on the same canvas as the game.
import { VIEW_W, VIEW_H, rankFor } from '../core/state.js';
import { MISSIONS } from '../missions/story.js';
import { CAR_MODELS } from '../city/traffic.js';

export function drawTitle(ctx, state) {
  ctx.save();
  // Sunset gradient sky over the city silhouette.
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#ff9e5e'); g.addColorStop(0.55, '#e85d75'); g.addColorStop(1, '#5a3a8a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath(); ctx.arc(980, 180, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,16,40,0.85)';
  for (let i = 0; i < 14; i++) {
    const w = 60 + ((i * 53) % 70), h = 140 + ((i * 97) % 260);
    ctx.fillRect(i * 95 + 10, VIEW_H - 120 - h, w, h);
  }
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, VIEW_H - 120, VIEW_W, 120);
  ctx.fillStyle = '#e8b93c';
  ctx.fillRect(0, VIEW_H - 122, VIEW_W, 3);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
  ctx.fillText('VELMARA', VIEW_W / 2, 240);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText('— STREETS OF THE SUN —', VIEW_W / 2, 285);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText('An open-world crime story in five districts. Steal, drive, run, and climb.', VIEW_W / 2, 330);
  ctx.fillText('Six missions from Mara Kline. Five stars of VPD heat. One city that never sleeps.', VIEW_W / 2, 356);
  drawButton(ctx, VIEW_W / 2 - 160, 410, 320, 56, '▶  NEW GAME', '#ffd94a', '#20180a');
  drawButton(ctx, VIEW_W / 2 - 160, 478, 320, 56, 'CONTINUE', '#2e7f9e', '#fff');
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '14px sans-serif';
  ctx.fillText('WASD move · E enter car · Mouse aim + click shoot · P pause · M mute', VIEW_W / 2, 580);
  ctx.fillText('Best played with sound on. Progress saves automatically in your browser.', VIEW_W / 2, 604);
  ctx.restore();
}

export function drawButton(ctx, x, y, w, h, label, bg, fg) {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = fg; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  ctx.restore();
}

export function titleClick(state, mx, my) {
  if (mx >= VIEW_W / 2 - 160 && mx <= VIEW_W / 2 + 160) {
    if (my >= 410 && my <= 466) return 'new';
    if (my >= 478 && my <= 534) return 'continue';
  }
  return null;
}

export function drawPause(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 170);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText('Cash $' + state.player.money.toLocaleString() + '  ·  Rank: ' + rankFor(state.player.money).name, VIEW_W / 2, 210);
  ctx.fillText('Missions done: ' + state.stats.missionsDone + ' / 6  ·  Cars stolen: ' + state.stats.carsStolen, VIEW_W / 2, 238);
  drawButton(ctx, VIEW_W / 2 - 160, 280, 320, 50, 'RESUME  (P)', '#ffd94a', '#20180a');
  drawButton(ctx, VIEW_W / 2 - 160, 342, 320, 50, 'SAVE GAME', '#2e7f9e', '#fff');
  drawButton(ctx, VIEW_W / 2 - 160, 404, 320, 50, 'RESTART RUN', '#5a3a3a', '#fff');
  ctx.fillStyle = '#cfe8ff'; ctx.font = '15px sans-serif';
  ctx.fillText('WASD move · Shift sprint · E enter/exit car · Click shoot · R reload', VIEW_W / 2, 500);
  ctx.fillText('Space handbrake · B pay down heat ($150/star) · M mute · H help', VIEW_W / 2, 526);
  // Mission list.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 14px sans-serif';
  ctx.fillText('MISSIONS', VIEW_W / 2 - 260, 580);
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
  MISSIONS.forEach((m, i) => {
    const mark = state.missionDone[i] ? '✓' : (i === state.missionIndex ? '►' : '·');
    ctx.fillText(mark + '  ' + m.id + '. ' + m.title + ' — $' + m.pay, VIEW_W / 2 - 260, 604 + i * 22);
  });
  ctx.restore();
}

export function pauseClick(state, mx, my) {
  if (mx < VIEW_W / 2 - 160 || mx > VIEW_W / 2 + 160) return null;
  if (my >= 280 && my <= 330) return 'resume';
  if (my >= 342 && my <= 392) return 'save';
  if (my >= 404 && my <= 454) return 'restart';
  return null;
}

export function drawGameOver(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.8)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = state.busted ? '#5aa2ff' : '#ff5a5a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(state.busted ? 'BUSTED' : 'WASTED', VIEW_W / 2, 300);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText(state.busted ? 'The VPD hauled you in. Mara will post bail — for a price.' : 'You didn\'t make it. The city moves on without you.', VIEW_W / 2, 350);
  ctx.fillText('Cash kept: $' + state.player.money.toLocaleString() + '  ·  Missions done: ' + state.stats.missionsDone + ' / 6', VIEW_W / 2, 386);
  drawButton(ctx, VIEW_W / 2 - 160, 430, 320, 56, 'TRY AGAIN', '#ffd94a', '#20180a');
  ctx.restore();
}

export function drawDealership(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.85)';
  ctx.beginPath(); ctx.roundRect(240, 120, 800, 560, 14); ctx.fill();
  ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(240, 120, 800, 560, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 28px sans-serif';
  ctx.fillText('SUN MOTORS — DEALERSHIP', VIEW_W / 2, 165);
  ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
  ctx.fillText('Your cash: $' + state.player.money.toLocaleString() + ' — click a car to buy it (it spawns beside you)', VIEW_W / 2, 192);
  CAR_MODELS.forEach((m, i) => {
    const y = 220 + i * 60;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(280, y, 720, 48, 8); ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.roundRect(296, y + 14, 44, 20, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(m.name, 360, y + 30);
    ctx.fillStyle = '#cfe8ff'; ctx.font = '14px sans-serif';
    ctx.fillText('Top speed ' + Math.round(m.top * 0.9) + ' km/h', 560, y + 30);
    ctx.fillStyle = m.price === 0 ? '#7dff8a' : (state.player.money >= m.price ? '#ffd94a' : '#ff7d7d');
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(m.price === 0 ? 'OWNED' : '$' + m.price, 980, y + 30);
  });
  ctx.fillStyle = '#cfe8ff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Press E or click outside to close', VIEW_W / 2, 660);
  ctx.restore();
}

export function dealershipClick(state, mx, my) {
  if (mx < 280 || mx > 1000) return null;
  const i = Math.floor((my - 220) / 60);
  if (i < 0 || i >= CAR_MODELS.length) return null;
  if (my < 220 + i * 60 || my > 220 + i * 60 + 48) return null;
  return CAR_MODELS[i];
}
