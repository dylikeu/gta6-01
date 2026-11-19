// Drawing only: the world's state and the current screen in, pixels out. The camera follows
// the player; the 1280x720 logical view is scaled to fit the window. Flat shapes with strong
// colours, shadows and a day/night tint give Solmar its sun-soaked look. The HUD — health,
// cash, wanted stars, the objective and the minimap — is drawn in screen space on top.

import { BEACH, CITY, ECONOMY, FONT, PALETTE, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_MISSION_DONE = 'missionDone';
export const SCREEN_FAILED = 'failed';
export const SCREEN_SHOP = 'shop';
export const SCREEN_HELP = 'help';

const MAP_SIZE = 216;
const MAP_SCALE = MAP_SIZE / WORLD.width;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas, city) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: 0, height: 0 };
  const camera = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1 };

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    view.width = Math.round(window.innerWidth * ratio);
    view.height = Math.round(window.innerHeight * ratio);
    canvas.width = view.width;
    canvas.height = view.height;
    view.scale = Math.min(view.width / VIEW.width, view.height / VIEW.height);
    view.x = (view.width - VIEW.width * view.scale) / 2;
    view.y = (view.height - VIEW.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  const fonts = new Map();
  function font(size, bold = false) {
    const key = `${size}:${bold}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', bold = false) {
    context.font = font(size, bold);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function textShadowed(value, x, y, size, color, align = 'left', bold = false) {
    context.font = font(size, bold);
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillStyle = PALETTE.hudShadow;
    context.fillText(value, x + 2, y + 2);
    context.fillStyle = color;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function screenToWorld(sx, sy) {
    const cx = view.x + (VIEW.width / 2) * view.scale;
    const cy = view.y + (VIEW.height / 2) * view.scale;
    return {
      x: camera.x + (sx - cx) / (view.scale * camera.zoom),
      y: camera.y + (sy - cy) / (view.scale * camera.zoom),
    };
  }

  function dayTint(clock) {
    if (clock >= 21 || clock < 5) return PALETTE.night;
    if (clock >= 17 && clock < 19) return PALETTE.dusk;
    if (clock >= 5 && clock < 7) return PALETTE.dawn;
    return null;
  }

  function isNight(clock) {
    return clock >= 19 || clock < 6;
  }

  function drawGround(state) {
    // Grass, then the beach and the sea.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH.sandY, WORLD.width, WORLD.height - BEACH.sandY);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, BEACH.waterY, WORLD.width, WORLD.height - BEACH.waterY);
    // Waves: moving lighter bands.
    context.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 5; i += 1) {
      const y = BEACH.waterY + 18 + i * 34 + Math.sin(state.time * 0.7 + i * 1.7) * 5;
      context.fillRect(0, y, WORLD.width, 3);
    }
    // The park.
    const park = city.park;
    context.fillStyle = PALETTE.park;
    context.fillRect(park.x, park.y, park.w, park.h);
    context.fillStyle = PALETTE.sea;
    context.beginPath();
    context.ellipse(park.x + park.w * 0.7, park.y + park.h * 0.6, 46, 30, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawRoads() {
    const half = 36;
    // Sidewalk bands first, asphalt on top.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of city.roadsX) context.fillRect(rx - half - 26, 0, (half + 26) * 2, WORLD.height);
    for (const ry of city.roadsY) context.fillRect(0, ry - half - 26, WORLD.width, (half + 26) * 2);
    context.fillStyle = PALETTE.road;
    for (const rx of city.roadsX) context.fillRect(rx - half, 0, half * 2, WORLD.height);
    for (const ry of city.roadsY) context.fillRect(0, ry - half, WORLD.width, half * 2);
    // Centre dashes.
    context.fillStyle = PALETTE.lane;
    for (const rx of city.roadsX) {
      for (let y = 0; y < WORLD.height; y += 64) context.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of city.roadsY) {
      for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x, ry - 2, 30, 4);
    }
    // Crosswalks at every intersection.
    context.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of city.roadsX) {
      for (const ry of city.roadsY) {
        for (let i = -2; i <= 2; i += 1) {
          context.fillRect(rx + i * 14 - 4, ry - half - 8, 8, 16);
          context.fillRect(rx - half - 8, ry + i * 14 - 4, 16, 8);
        }
      }
    }
  }

  function drawBuildings() {
    for (const b of city.buildings) {
      // Drop shadow: taller buildings throw a longer one.
      context.fillStyle = 'rgba(0,0,0,0.22)';
      context.fillRect(b.x + b.height * 4, b.y + b.height * 5, b.w, b.h);
      context.fillStyle = b.color ?? b.roof;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.fillRect(b.x, b.y, b.w, 8);
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.fillRect(b.x, b.y + b.h - 6, b.w, 6);
      // Windows in a grid.
      context.fillStyle = 'rgba(20,30,50,0.5)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 12 + c * 34, b.y + 12 + r * 34, 16, 12);
        }
      }
      if (b.label) {
        context.font = font(15, true);
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
  }

  function drawTrees() {
    for (const t of city.trees) {
      if (t.palm) {
        context.strokeStyle = '#8a6a3b';
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(t.x, t.y + 8);
        context.lineTo(t.x, t.y - 6);
        context.stroke();
      }
      context.fillStyle = t.palm ? '#4da24a' : PALETTE.tree;
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.treeDark;
      context.beginPath();
      context.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      const x = pk.x;
      const y = pk.y + bob;
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.beginPath();
      context.arc(x, y, 16 + Math.sin(pk.bob) * 2, 0, Math.PI * 2);
      context.fill();
      if (pk.kind === 'health') {
        context.fillStyle = '#ffffff';
        context.fillRect(x - 9, y - 3, 18, 6);
        context.fillRect(x - 3, y - 9, 6, 18);
      } else if (pk.kind === 'armor') {
        context.fillStyle = '#7fb3ff';
        context.beginPath();
        context.moveTo(x, y - 11);
        context.lineTo(x + 10, y - 5);
        context.lineTo(x + 8, y + 9);
        context.lineTo(x, y + 13);
        context.lineTo(x - 8, y + 9);
        context.lineTo(x - 10, y - 5);
        context.closePath();
        context.fill();
      } else if (pk.kind === 'shotgun') {
        context.fillStyle = '#222';
        context.fillRect(x - 12, y - 2, 24, 4);
        context.fillRect(x + 2, y + 2, 6, 8);
      } else if (pk.kind === 'cash') {
        context.fillStyle = '#2fae5f';
        context.fillRect(x - 10, y - 7, 20, 14);
        context.fillStyle = '#ffffff';
        context.font = font(12, true);
        context.textAlign = 'center';
        context.fillText('$', x, y + 4);
      } else {
        context.fillStyle = '#f2c230';
        context.fillRect(x - 9, y - 9, 18, 18);
        context.fillStyle = '#a87f0a';
        context.fillRect(x - 9, y - 2, 18, 3);
      }
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const isVan = car.kind === 'van' || car.kind === 'armored';
    const len = isVan ? 78 : 64;
    const wid = isVan ? 34 : 30;
    // Wheels.
    context.fillStyle = '#16181c';
    const wx = len / 2 - 12;
    const wy = wid / 2 - 2;
    context.fillRect(wx, -wy - 4, 16, 7);
    context.fillRect(wx, wy - 3, 16, 7);
    context.fillRect(-wx - 16, -wy - 4, 16, 7);
    context.fillRect(-wx - 16, wy - 3, 16, 7);
    // Body.
    context.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
    roundRect(-len / 2, -wid / 2, len, wid, 8);
    context.fill();
    if (car.kind === 'police') {
      context.fillStyle = '#1d4fd7';
      context.fillRect(-len / 2 + 6, -wid / 2, len - 12, 7);
      context.fillRect(-len / 2 + 6, wid / 2 - 7, len - 12, 7);
      // Light bar, flashing.
      const flash = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
      context.fillRect(-6, -wid / 2 - 3, 12, 7);
      context.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
      context.fillRect(-6, wid / 2 - 4, 12, 7);
    }
    if (car.kind === 'armored') {
      // Armored cash van: gold band so the player can tell it from traffic vans.
      context.fillStyle = '#d4a017';
      context.fillRect(-len / 2 + 6, -wid / 2, len - 12, 5);
      context.fillRect(-len / 2 + 6, wid / 2 - 5, len - 12, 5);
    }
    if (car.kind === 'taxi') {
      context.fillStyle = '#222';
      context.fillRect(-len / 2 + 8, -wid / 2, len - 16, 4);
      context.fillStyle = '#fff';
      context.font = font(9, true);
      context.textAlign = 'center';
      context.fillText('TAXI', 0, -wid / 2 + 12);
    }
    // Windows and roof.
    context.fillStyle = 'rgba(20,30,50,0.75)';
    roundRect(-8, -wid / 2 + 5, 18, wid - 10, 3);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(-len / 2 + 4, -wid / 2 + 3, 6, wid - 6);
    // Headlights at night.
    context.fillStyle = '#ffe9a8';
    context.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 5);
    context.fillRect(len / 2 - 2, wid / 2 - 8, 3, 5);
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, opts = {}) {
    context.save();
    context.translate(x, y);
    if (opts.dead) {
      context.rotate(angle + Math.PI / 2);
      context.fillStyle = shirt;
      context.beginPath();
      context.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#a02020';
      context.beginPath();
      context.arc(10, 4, 6, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.rotate(angle);
    // Body.
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    // Head.
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(3, 0, 6, 0, Math.PI * 2);
    context.fill();
    if (opts.cop) {
      context.fillStyle = '#1d4fd7';
      context.beginPath();
      context.arc(3, 0, 6.5, Math.PI, Math.PI * 2);
      context.fill();
    }
    if (opts.gun) {
      context.strokeStyle = '#222';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(8, 0);
      context.lineTo(20, 0);
      context.stroke();
    }
    context.restore();
  }

  function drawMarker(state, marker) {
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(marker.x, marker.y - 44);
    context.lineTo(marker.x - 9, marker.y - 26);
    context.lineTo(marker.x + 9, marker.y - 26);
    context.closePath();
    context.fill();
    // A light beam so the marker reads from far away.
    context.fillStyle = 'rgba(255,207,63,0.18)';
    context.fillRect(marker.x - 3, marker.y - 400, 6, 400);
  }

  function drawWorld(state, marker) {
    const p = state.player;
    const targetZoom = p.inCar ? 0.82 : 1;
    camera.zoom += (targetZoom - camera.zoom) * 0.05;
    camera.x = clamp(p.x, (VIEW.width / 2) / camera.zoom, WORLD.width - (VIEW.width / 2) / camera.zoom);
    camera.y = clamp(p.y, (VIEW.height / 2) / camera.zoom, WORLD.height - (VIEW.height / 2) / camera.zoom);

    const cx = view.x + (VIEW.width / 2) * view.scale;
    const cy = view.y + (VIEW.height / 2) * view.scale;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0e1420';
    context.fillRect(0, 0, view.width, view.height);
    context.setTransform(view.scale * camera.zoom, 0, 0, view.scale * camera.zoom, cx, cy);
    context.translate(-camera.x, -camera.y);

    drawGround(state);
    drawRoads();
    drawBuildings();
    drawTrees();
    drawPickups(state);
    drawMarker(state, marker);

    for (const car of state.cars) drawCar(car, state.time);
    for (const ped of state.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, { dead: ped.dead });
    }
    for (const e of state.enemies) {
      drawPerson(e.x, e.y, e.angle, e.kind === 'cop' ? '#2d5fd7' : '#c03030', { cop: e.kind === 'cop', gun: true });
    }
    // The player: brighter, with a ring so they are never lost in a crowd.
    if (state.player.inCar) {
      context.strokeStyle = 'rgba(255,210,62,0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(state.player.x, state.player.y, 42, 0, Math.PI * 2);
      context.stroke();
    } else {
      drawPerson(state.player.x, state.player.y, state.player.aimAngle, PALETTE.player, { gun: true });
      context.strokeStyle = 'rgba(255,210,62,0.9)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(state.player.x, state.player.y, 20, 0, Math.PI * 2);
      context.stroke();
    }
    // Bullets as tracers.
    context.strokeStyle = '#ffe9a8';
    context.lineWidth = 2;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    // Day/night tint over the whole world.
    const tint = dayTint(state.clock);
    if (tint) {
      context.fillStyle = tint;
      context.fillRect(camera.x - VIEW.width / 2 / camera.zoom - 40, camera.y - VIEW.height / 2 / camera.zoom - 40, VIEW.width / camera.zoom + 80, VIEW.height / camera.zoom + 80);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawMinimap(state, marker) {
    const x0 = VIEW.width - MAP_SIZE - 18;
    const y0 = VIEW.height - MAP_SIZE - 18;
    context.save();
    context.translate(view.x, view.y);
    context.scale(view.scale, view.scale);
    context.fillStyle = PALETTE.minimapBg;
    roundRect(x0 - 6, y0 - 6, MAP_SIZE + 12, MAP_SIZE + 12, 10);
    context.fill();
    context.save();
    roundRect(x0, y0, MAP_SIZE, MAP_SIZE, 6);
    context.clip();
    context.fillStyle = '#22303f';
    context.fillRect(x0, y0, MAP_SIZE, MAP_SIZE);
    // Sea.
    context.fillStyle = PALETTE.minimapWater;
    context.fillRect(x0, y0 + BEACH.waterY * MAP_SCALE, MAP_SIZE, MAP_SIZE - BEACH.waterY * MAP_SCALE);
    // Blocks.
    context.fillStyle = PALETTE.minimapBlock;
    for (const b of city.buildings) {
      context.fillRect(x0 + b.x * MAP_SCALE, y0 + b.y * MAP_SCALE, Math.max(2, b.w * MAP_SCALE), Math.max(2, b.h * MAP_SCALE));
    }
    // Roads.
    context.strokeStyle = PALETTE.minimapRoad;
    context.lineWidth = 3;
    for (const rx of city.roadsX) {
      context.beginPath();
      context.moveTo(x0 + rx * MAP_SCALE, y0);
      context.lineTo(x0 + rx * MAP_SCALE, y0 + MAP_SIZE);
      context.stroke();
    }
    for (const ry of city.roadsY) {
      context.beginPath();
      context.moveTo(x0, y0 + ry * MAP_SCALE);
      context.lineTo(x0 + MAP_SIZE, y0 + ry * MAP_SCALE);
      context.stroke();
    }
    // Mission marker.
    if (marker) {
      const pulse = 6 + Math.sin(state.time * 5) * 2;
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(x0 + marker.x * MAP_SCALE, y0 + marker.y * MAP_SCALE, pulse, 0, Math.PI * 2);
      context.fill();
    }
    // Police.
    context.fillStyle = '#5f8dff';
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      context.beginPath();
      context.arc(x0 + car.x * MAP_SCALE, y0 + car.y * MAP_SCALE, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    // The player, as an arrow.
    context.save();
    context.translate(x0 + state.player.x * MAP_SCALE, y0 + state.player.y * MAP_SCALE);
    context.rotate(state.player.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    context.restore();
  }

  function drawHud(state, ui) {
    context.save();
    context.translate(view.x, view.y);
    context.scale(view.scale, view.scale);
    context.textBaseline = 'alphabetic';
    // Health and armour.
    const barW = 220;
    context.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(16, 14, barW + 12, 58, 8);
    context.fill();
    context.fillStyle = '#333';
    context.fillRect(22, 22, barW, 14);
    context.fillStyle = state.health > 30 ? '#37c978' : '#e5484d';
    context.fillRect(22, 22, (barW * state.health) / 100, 14);
    context.fillStyle = '#333';
    context.fillRect(22, 42, barW, 10);
    context.fillStyle = '#7fb3ff';
    context.fillRect(22, 42, (barW * state.armor) / 100, 10);
    textShadowed(`$${state.cash.toLocaleString('en-US')}`, 22, 66, 22, '#7dff9a', 'left', true);
    textShadowed(state.weapon === 'shotgun' ? `Shotgun  ${state.shotgunAmmo}` : 'Pistol  ∞', 22, 92, 17, '#ffffff');
    // Wanted stars, top right.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    textShadowed(stars, VIEW.width - 18, 40, 30, state.wanted > 0 ? PALETTE.star : PALETTE.starEmpty, 'right', true);
    const hours = Math.floor(state.clock);
    const minutes = Math.floor((state.clock - hours) * 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    textShadowed(`${hh}:${mm}`, VIEW.width - 18, 68, 20, '#ffffff', 'right');
    textShadowed(CITY.name, VIEW.width - 18, 92, 15, 'rgba(255,255,255,0.75)', 'right');
    // Objective, top centre.
    if (ui.objective) {
      context.font = font(19, true);
      const w = context.measureText(ui.objective).width + 36;
      context.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect((VIEW.width - w) / 2, 12, w, 34, 17);
      context.fill();
      textShadowed(ui.objective, VIEW.width / 2, 36, 19, PALETTE.objective, 'center', true);
    }
    // Speed and controls, bottom left.
    if (state.player.inCar) {
      const mph = Math.round(Math.abs(state.player.inCar.speed) * 0.12);
      textShadowed(`${mph} mph`, 22, VIEW.height - 22, 30, '#ffffff', 'left', true);
    }
    textShadowed('WASD move/drive · Mouse aim · Click shoot · E enter car · F interact · P pause · M mute', 22, VIEW.height - 52, 13, 'rgba(255,255,255,0.6)');
    // Context prompts.
    if (ui.prompt) {
      context.font = font(18, true);
      const w = context.measureText(ui.prompt).width + 30;
      context.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect((VIEW.width - w) / 2, VIEW.height - 130, w, 34, 17);
      context.fill();
      textShadowed(ui.prompt, VIEW.width / 2, VIEW.height - 106, 18, '#ffffff', 'center', true);
    }
    // Centre flash messages (WASTED etc. are screens; this is the small banner).
    if (ui.banner) {
      textShadowed(ui.banner, VIEW.width / 2, 130, 34, '#ffd23e', 'center', true);
    }
    if (ui.damageFlash > 0) {
      context.fillStyle = `rgba(220,30,30,${Math.min(0.35, ui.damageFlash * 0.4)})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (state.wanted >= 3) {
      context.fillStyle = `rgba(200,20,20,${0.05 + Math.sin(state.time * 3) * 0.02})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    drawMinimap(state, ui.marker);
    context.restore();
  }

  function drawPanel(title, lines, prompt, accent = '#f2c94c') {
    context.save();
    context.translate(view.x, view.y);
    context.scale(view.scale, view.scale);
    const width = 640;
    const height = 150 + lines.length * 30 + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(8,12,20,0.88)';
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 2;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, VIEW.width / 2, y + 62, 40, '#ffffff', 'center', true);
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 108 + i * 30, 19, '#d8dee8', 'center');
    });
    if (prompt) text(prompt, VIEW.width / 2, y + height - 26, 20, accent, 'center', true);
    context.restore();
  }

  function drawTitle(state, ui) {
    drawWorld(state, null);
    context.save();
    context.translate(view.x, view.y);
    context.scale(view.scale, view.scale);
    context.fillStyle = 'rgba(6,10,18,0.35)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    textShadowed(CITY.title, VIEW.width / 2, 210, 110, '#ffd23e', 'center', true);
    textShadowed(CITY.subtitle, VIEW.width / 2, 258, 30, '#ffffff', 'center');
    textShadowed('A sun-soaked open-world crime story — made from scratch.', VIEW.width / 2, 296, 19, '#d8dee8', 'center');
    const options = [];
    options.push('ENTER — New Game');
    if (ui.hasSave) options.push('C — Continue');
    options.push('H — How to Play');
    options.forEach((line, i) => {
      textShadowed(line, VIEW.width / 2, 380 + i * 36, 22, i === 0 ? '#ffd23e' : '#ffffff', 'center', i === 0);
    });
    if (ui.best > 0) textShadowed(`Best cash: $${ui.best.toLocaleString('en-US')}`, VIEW.width / 2, 380 + options.length * 36 + 10, 16, 'rgba(255,255,255,0.7)', 'center');
    textShadowed('WASD move · Mouse aim · Click shoot · E steal & drive · F interact', VIEW.width / 2, VIEW.height - 60, 16, 'rgba(255,255,255,0.75)', 'center');
    textShadowed('An original game. No Rockstar names, characters, maps or assets.', VIEW.width / 2, VIEW.height - 34, 13, 'rgba(255,255,255,0.5)', 'center');
    context.restore();
  }

  /** Paint one frame: the world (when the screen has one), the HUD, then the screen's panel. */
  function draw(state, screen, ui) {
    ui = ui || {};
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
      return;
    }
    drawWorld(state, ui.marker);
    if (screen === SCREEN_PLAY) {
      drawHud(state, ui);
      return;
    }
    drawHud(state, ui);
    context.save();
    context.translate(view.x, view.y);
    context.scale(view.scale, view.scale);
    context.fillStyle = 'rgba(6,10,18,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.restore();
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', [
        `Cash $${state.cash.toLocaleString('en-US')} · Missions done ${state.stats.missionsDone} of 6`,
        `Packages ${state.stats.packages} of 12 · Taxi fares ${state.stats.taxiFares} · Cars stolen ${state.stats.carsStolen}`,
        '',
        'S — Save game      G — Garage shop      H — How to Play',
      ], 'P / Esc — Resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', [
        'Leo went down. The city keeps moving without him.',
        `You lost $${ui.lostCash ? ui.lostCash.toLocaleString('en-US') : 0} to the hospital bill.`,
        '',
      ], 'ENTER — Wake up at Solmar General', '#e5484d');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [
        'The Solmar PD took Leo in. Bail is not cheap.',
        `You lost $${ui.lostCash ? ui.lostCash.toLocaleString('en-US') : 0} in fines and bail.`,
        '',
      ], 'ENTER — Walk out of Solmar PD HQ', '#5f8dff');
    } else if (screen === SCREEN_BRIEFING && ui.mission) {
      drawPanel(`${ui.mission.title}`, [
        `${ui.mission.giver} — Reward $${ui.mission.reward}`,
        '',
        ...ui.mission.briefing,
      ], 'ENTER — Accept the job');
    } else if (screen === SCREEN_MISSION_DONE && ui.mission) {
      drawPanel('Job Done', [
        `${ui.mission.title} — complete.`,
        `Reward: $${ui.mission.reward}. Total cash: $${state.cash.toLocaleString('en-US')}`,
        state.stats.missionsDone >= 6 ? 'That is the whole story. Solmar is yours, Leo.' : `Next up: ${ui.nextTitle || 'free roam'}`,
      ], 'ENTER — Back to the streets', '#37c978');
    } else if (screen === SCREEN_FAILED) {
      drawPanel('Job Failed', [
        'The job fell apart. Rosa is not angry — she is disappointed.',
        'Go back to the garage and try again.',
      ], 'ENTER — Back to the streets', '#e5484d');
    } else if (screen === SCREEN_SHOP) {
      drawPanel("Rosa's Garage — Shop", [
        `Cash: $${state.cash.toLocaleString('en-US')}`,
        '',
        `1 — Repair car  $${ECONOMY.repairCost}`,
        `2 — Body armour  $${ECONOMY.armorCost}`,
        `3 — Shotgun + 24 shells  $${ECONOMY.shotgunCost}`,
        '',
        'Press 1, 2 or 3 to buy. Esc — back.',
      ], '');
    } else if (screen === SCREEN_HELP) {
      drawPanel('How to Play', [
        'WASD / Arrows — walk or drive. Mouse — aim. Click — shoot.',
        'E — steal a car / get out. F — talk, start jobs, pick up fares.',
        'Shift — sprint. M — mute. P / Esc — pause. S in pause — save.',
        'Stars mean the cops are after you: hide until they fade.',
        'Yellow marker — your next job. Green $ — cash. Gold boxes — hidden packages.',
        'Finish all six jobs for Rosa to own Solmar.',
      ], 'Esc — Back');
    }
  }

  return { draw, resize, screenToWorld, camera };
}
