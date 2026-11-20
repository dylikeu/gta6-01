// Synthesized WebAudio sound effects for VELMARA.
// No audio files: every sound is built from oscillators + noise at runtime.
export function createSfx() {
  let ctx = null;
  let muted = false;
  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, vol, filterFreq) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = c.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  }
  return {
    unlock() { ac(); },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
    shoot() { noise(0.09, 0.25, 3200); tone(180, 0.07, 'square', 0.08, 60); },
    click() { tone(900, 0.04, 'square', 0.06); },
    reload() { tone(500, 0.05, 'square', 0.08); setTimeout(() => tone(700, 0.05, 'square', 0.08), 90); },
    crash() { noise(0.25, 0.3, 700); tone(90, 0.2, 'sawtooth', 0.12, 40); },
    explosion() { noise(0.7, 0.4, 500); tone(60, 0.6, 'sawtooth', 0.18, 30); },
    hurt() { tone(220, 0.15, 'sawtooth', 0.12, 110); },
    door() { tone(320, 0.08, 'square', 0.08, 180); noise(0.06, 0.1, 900); },
    sirenBlip() { tone(880, 0.16, 'sine', 0.1, 660); setTimeout(() => tone(660, 0.16, 'sine', 0.1, 880), 160); },
    pickup() { tone(660, 0.09, 'sine', 0.12); setTimeout(() => tone(990, 0.12, 'sine', 0.12), 90); },
    missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.14), i * 110)); },
    missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.15), i * 130)); },
    engineHum(on) { if (!on || muted) return; tone(70, 0.12, 'sawtooth', 0.03, 90); },
  };
}
