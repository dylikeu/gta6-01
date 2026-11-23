// audio.js — all of Coral Bay's sound, synthesized live with WebAudio: the
// engine hum that follows the speed, three radio stations that play their
// own generative sunset grooves, police sirens, gunshots and cash-register
// cha-chings. No audio files, nothing to download.
import { RADIO_STATIONS } from './config.js';

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** The audio engine: one AudioContext, one master gain, lazy-started. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.station = 0;
    this.muted = false;
    this.step = 0;
    this.nextNoteTime = 0;
    this.started = false;
  }

  /** Start on the first user gesture; browsers block audio before that. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.started = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  setStation(index) {
    this.station = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    this.step = 0;
  }

  /** The engine note follows the car's speed; silent on foot. */
  updateEngine(speed, inCar) {
    if (!this.ctx) return;
    const target = inCar ? 0.05 + Math.min(0.09, Math.abs(speed) * 0.0022) : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 3.4, this.ctx.currentTime, 0.1);
  }

  /** The two-tone siren swells with the wanted level. */
  updateSiren(wanted, dt) {
    if (!this.ctx) return;
    const target = wanted > 0 ? 0.03 + wanted * 0.008 : 0;
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    this.sirenOsc.frequency.value = 660 + Math.sin(this.ctx.currentTime * 2.4) * 160;
  }

  /** One step of the current station's groove: bass, pluck and a hat tick. */
  updateMusic() {
    if (!this.ctx || this.muted) return;
    const station = RADIO_STATIONS[this.station];
    const beat = 60 / station.bpm / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
      const t = this.nextNoteTime;
      const step = this.step;
      const chordRoot = station.root + [0, 0, -4, 3][Math.floor(step / 8) % 4];
      if (step % 4 === 0) this.note(chordRoot - 12, t, beat * 3.4, 'triangle', 0.5);
      if (step % 2 === 0) {
        const degree = station.scale[(step * 3 + Math.floor(step / 16)) % station.scale.length];
        this.note(chordRoot + 12 + degree, t, beat * 0.9, 'square', 0.1);
      }
      if (step % 2 === 1) this.tick(t, 0.05);
      this.nextNoteTime += beat;
      this.step += 1;
    }
  }

  note(midi, when, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = midiToFreq(midi);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  tick(when, vol) {
    const buffer = this.ctx.createBuffer(1, 2205, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(when);
  }

  /** A gunshot: a short burst of filtered noise. */
  shoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, 4410, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  /** A crash: low thud plus noise. */
  crash(hard) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(hard ? 0.6 : 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  /** The cash register: two bright notes, money in. */
  chaChing() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.note(88, t, 0.12, 'sine', 0.3);
    this.note(93, t + 0.09, 0.22, 'sine', 0.3);
  }

  /** Mission complete: a little four-note fanfare. */
  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84].forEach((midi, i) => this.note(midi, t + i * 0.11, 0.3, 'triangle', 0.3));
  }

  /** A soft pickup blip. */
  blip() {
    if (!this.ctx) return;
    this.note(79, this.ctx.currentTime, 0.12, 'sine', 0.25);
  }
}
