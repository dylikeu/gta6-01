// audio/sfx.js — all sound is synthesised with WebAudio: no audio files, no network.
// A tiny synth: tones, noise bursts and a looping siren + engine hum.

import { S } from '../core/state.js';

let ctx = null;
let sirenNodes = null;
let engineNodes = null;

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

function tone(freq, dur, type, vol, slideTo) {
  const c = ac();
  if (!c || S.muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

function noise(dur, vol, lowpass) {
  const c = ac();
  if (!c || S.muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass || 1200;
  const g = c.createGain();
  g.gain.value = vol || 0.2;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

export function playSfx(name) {
  if (S.muted) return;
  switch (name) {
    case 'shot': noise(0.12, 0.35, 3000); tone(180, 0.08, 'square', 0.15, 60); break;
    case 'eshot': noise(0.1, 0.18, 2400); break;
    case 'empty': tone(900, 0.05, 'square', 0.08); break;
    case 'reload': tone(500, 0.06, 'square', 0.1); setTimeout(() => tone(700, 0.06, 'square', 0.1), 90); break;
    case 'crash': noise(0.3, 0.4, 700); tone(90, 0.25, 'sawtooth', 0.2, 40); break;
    case 'thud': noise(0.15, 0.3, 500); break;
    case 'hurt': tone(140, 0.2, 'sawtooth', 0.18, 70); break;
    case 'coin': tone(880, 0.09, 'sine', 0.15); setTimeout(() => tone(1320, 0.14, 'sine', 0.15), 80); break;
    case 'heal': tone(520, 0.12, 'sine', 0.14, 780); break;
    case 'door': noise(0.08, 0.2, 900); tone(220, 0.06, 'square', 0.08); break;
    case 'steal': tone(300, 0.1, 'square', 0.12, 500); break;
    case 'kill': tone(220, 0.15, 'square', 0.12, 90); noise(0.12, 0.15, 900); break;
    case 'mission': tone(523, 0.12, 'sine', 0.14); setTimeout(() => tone(659, 0.12, 'sine', 0.14), 110); setTimeout(() => tone(784, 0.2, 'sine', 0.14), 220); break;
    case 'stage': tone(659, 0.1, 'sine', 0.13); setTimeout(() => tone(880, 0.15, 'sine', 0.13), 100); break;
    case 'complete': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.15), i * 110)); break;
    case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.16), i * 140)); break;
    case 'fail': tone(300, 0.4, 'sawtooth', 0.14, 120); break;
    case 'busted': [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.15), i * 180)); break;
    default: break;
  }
}

// Looping siren while wanted > 0, and an engine hum while driving.
export function updateAmbience() {
  const c = ac();
  if (!c) return;
  if (S.muted) {
    stopLoop(sirenNodes); sirenNodes = null;
    stopLoop(engineNodes); engineNodes = null;
    return;
  }
  if (S.wanted > 0 && S.mode === 'playing') {
    if (!sirenNodes) sirenNodes = startSiren(c);
  } else if (sirenNodes) {
    stopLoop(sirenNodes); sirenNodes = null;
  }
  if (S.car && Math.abs(S.car.speed) > 20 && S.mode === 'playing') {
    if (!engineNodes) engineNodes = startEngine(c);
    if (engineNodes) {
      engineNodes.osc.frequency.value = 50 + Math.abs(S.car.speed) * 0.35;
      engineNodes.gain.gain.value = 0.03 + Math.abs(S.car.speed) / 380 * 0.05;
    }
  } else if (engineNodes) {
    stopLoop(engineNodes); engineNodes = null;
  }
}

function startSiren(c) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = 700;
  g.gain.value = 0.045;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.9;
  lfoGain.gain.value = 260;
  lfo.connect(lfoGain).connect(o.frequency);
  o.connect(g).connect(c.destination);
  o.start(); lfo.start();
  return { osc: o, gain: g, extra: lfo };
}

function startEngine(c) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.value = 70;
  g.gain.value = 0.04;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  o.connect(f).connect(g).connect(c.destination);
  o.start();
  return { osc: o, gain: g, extra: null };
}

function stopLoop(nodes) {
  if (!nodes) return;
  try {
    nodes.osc.stop();
    if (nodes.extra) nodes.extra.stop();
  } catch (e) { /* already stopped */ }
}
