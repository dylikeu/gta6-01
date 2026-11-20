// hud/menus.js — the screens around the game: title, pause, busted, finished,
// and the dialogue box where Mara Kline hands out jobs.

import { S } from '../core/state.js';
import { formatMoney } from '../core/math.js';
import { currentRank } from '../player/player.js';
import { currentMission } from '../missions/story.js';

export function drawTitle(ctx, vw, vh) {
  // Sunlit sky gradient over the city silhouette.
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, '#f9d976');
  g.addColorStop(0.45, '#f7b733');
  g.addColorStop(1, '#e67e22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  // Sun.
  ctx.fillStyle = 'rgba(255,244,180,0.95)';
  ctx.beginPath(); ctx.arc(vw * 0.78, vh * 0.2, 64, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,244,180,0.35)';
  ctx.beginPath(); ctx.arc(vw * 0.78, vh * 0.2, 96, 0, Math.PI * 2); ctx.fill();
  // City skyline.
  ctx.fillStyle = 'rgba(90,50,30,0.55)';
  const skyline = [120, 200, 150, 260, 180, 300, 220, 160, 280, 190, 140, 240];
  let x = 0;
  for (const h of skyline) {
    ctx.fillRect(x, vh - 220 - h * 0.4, 90, 220 + h * 0.4);
    x += 100;
  }
  // Sea at the bottom.
  ctx.fillStyle = '#2e86c1';
  ctx.fillRect(0, vh - 120, vw, 120);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 6; i++) ctx.fillRect(((i * 230 + 40) % vw), vh - 100 + i * 14, 120, 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 18;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('VELMARA', vw / 2, vh * 0.32);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('— STREETS OF THE SUN —', vw / 2, vh * 0.32 + 44);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('An open-world crime game. Steal cars, outrun the VPD, and work six jobs', vw / 2, vh * 0.32 + 84);
  ctx.fillText('for Mara Kline — from First Fare to the Sunset Run.', vw / 2, vh * 0.32 + 110);

  // Buttons.
  drawButton(ctx, vw / 2 - 130, vh * 0.58, 260, 52, '▶  NEW GAME', true);
  if (S.hasSave) drawButton(ctx, vw / 2 - 130, vh * 0.58 + 64, 260, 52, 'CONTINUE', false);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move / drive  •  E enter car & interact  •  Mouse aim, Click shoot  •  R reload  •  P pause', vw / 2, vh * 0.58 + (S.hasSave ? 150 : 86));
  ctx.fillText('Space handbrake  •  M mute  •  Progress saves automatically after every job', vw / 2, vh * 0.58 + (S.hasSave ? 174 : 110));
  ctx.textAlign = 'left';
}

function drawButton(ctx, x, y, w, h, label, primary) {
  ctx.fillStyle = primary ? '#e67e22' : 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  ctx.textAlign = 'left';
}

export function titleClick(mx, my, vw, vh) {
  const bx = vw / 2 - 130;
  if (mx >= bx && mx <= bx + 260 && my >= vh * 0.58 && my <= vh * 0.58 + 52) return 'new';
  if (S.hasSave && mx >= bx && mx <= bx + 260 && my >= vh * 0.58 + 64 && my <= vh * 0.58 + 116) return 'continue';
  return null;
}

export function drawPaused(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 60);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('P or Esc to resume  •  Progress saves after every job', vw / 2, vh / 2 - 20);
  ctx.fillText('Money ' + formatMoney(S.player.money) + '  •  Rank ' + currentRank() + '  •  Jobs ' + S.missionDone.length + '/6', vw / 2, vh / 2 + 12);
  ctx.textAlign = 'left';
}

export function drawBusted(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(20,20,60,0.75)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('BUSTED', vw / 2, vh / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(S.banner ? S.banner.sub : 'The Velmara PD took you in.', vw / 2, vh / 2 + 4);
  ctx.fillText('Click anywhere or press Enter to walk free', vw / 2, vh / 2 + 40);
  ctx.textAlign = 'left';
}

export function drawDialog(ctx, vw, vh) {
  const d = S.dialog;
  if (!d) return;
  const line = d.lines[d.idx];
  const boxW = Math.min(760, vw - 80);
  const bx = (vw - boxW) / 2;
  const by = vh - 190;
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.beginPath(); ctx.roundRect(bx, by, boxW, 120, 12); ctx.fill();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(line.who, bx + 22, by + 30);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  wrapText(ctx, line.text, bx + 22, by + 58, boxW - 44, 24);
  ctx.fillStyle = '#aaa';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText((d.idx + 1) + '/' + d.lines.length + ' — E or Click to continue', bx + 22, by + 102);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function advanceDialog() {
  const d = S.dialog;
  if (!d) return false;
  d.idx++;
  if (d.idx >= d.lines.length) {
    S.dialog = null;
    S.pausedByDialog = false;
    const m = currentMission();
    if (m) showNotice('Job: ' + m.title + ' — ' + m.objective);
    return false;
  }
  return true;
}
