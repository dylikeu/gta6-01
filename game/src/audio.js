// All sound is synthesized with WebAudio — no audio files. Engine hum, sirens,
// gunshots, and a tiny step-sequencer "radio" that plays a different bassline and
// arpeggio per station. Everything is guarded: no context until a user gesture.
import { RADIO } from './config.js';

export function createAudio() {
  return {
    ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenTimer: 0, musicTimer: 0, step: 0,
    started: false, muted: false,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    // Engine: a low sawtooth whose pitch follows speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 50;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Siren: two-tone square wave, gain gated by wanted level.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'square';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    audio.started = true;
    return true;
  } catch {
    return false;
  }
}

function noteFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function blip(audio, freq, when, dur, type, gain, dest) {
  const osc = audio.ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(g);
  g.connect(dest || audio.musicGain);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

// One radio step: bass on the beat, a plucked arpeggio above it.
function radioStep(audio, station) {
  const st = RADIO[station];
  const stepDur = 60 / st.bpm / 2;
  const now = audio.ctx.currentTime + 0.05;
  const bar = Math.floor(audio.step / 8) % 4;
  const roots = [0, 0, -5, -3];
  const root = st.root + roots[bar];
  if (audio.step % 2 === 0) blip(audio, noteFreq(root - 12), now, stepDur * 1.8, 'triangle', 0.5);
  if (audio.step % 4 === 2) blip(audio, noteFreq(root - 12 + 7), now, stepDur, 'triangle', 0.3);
  const arpNote = root + 12 + st.scale[audio.step % st.scale.length];
  blip(audio, noteFreq(arpNote), now, stepDur * 0.9, 'square', 0.12);
  if (audio.step % 8 === 4) blip(audio, noteFreq(arpNote + 12), now, stepDur, 'sine', 0.1);
  audio.step += 1;
  return stepDur;
}

export function updateAudio(audio, state, dt) {
  if (!audio.ctx || audio.muted) {
    if (audio.engineGain) audio.engineGain.gain.value = 0;
    if (audio.sirenGain) audio.sirenGain.gain.value = 0;
    return;
  }
  // Engine pitch follows the car's speed (or the run cycle on foot).
  const carSpeed = !state.player.onFoot && state.player.car ? Math.abs(state.player.car.speed) : 0;
  const runSpeed = state.player.onFoot && state.player.moving ? 6 : 0;
  const speed = carSpeed + runSpeed;
  audio.engineGain.gain.value = speed > 0.5 ? 0.05 + Math.min(0.09, speed * 0.003) : 0;
  audio.engineOsc.frequency.value = 46 + speed * 4.2;
  // Siren wails while wanted; two-tone flip every 0.45 s.
  audio.sirenTimer += dt;
  if (state.player.wanted > 0 && state.police.cars.length > 0) {
    const hi = Math.floor(audio.sirenTimer / 0.45) % 2 === 0;
    audio.sirenOsc.frequency.value = hi ? 820 : 620;
    audio.sirenGain.gain.value = 0.035;
  } else {
    audio.sirenGain.gain.value = 0;
  }
  // Radio sequencer.
  if (state.screen === 'play') {
    audio.musicTimer -= dt;
    if (audio.musicTimer <= 0) {
      audio.musicTimer = radioStep(audio, state.radio.station);
    }
  }
}

export function playGunshot(audio) {
  if (!audio.ctx || audio.muted) return;
  try {
    const dur = 0.14;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    }
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const g = audio.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start();
  } catch { /* sound is optional */ }
}

export function playChime(audio, good = true) {
  if (!audio.ctx || audio.muted) return;
  const now = audio.ctx.currentTime;
  blip(audio, good ? 660 : 220, now, 0.18, 'sine', 0.25, audio.master);
  blip(audio, good ? 880 : 180, now + 0.12, 0.3, 'sine', 0.25, audio.master);
}
