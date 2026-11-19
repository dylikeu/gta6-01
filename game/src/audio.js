// All sound is synthesised with WebAudio: no audio files, nothing fetched. Engine hum,
// gunshots, sirens, pickups and a little mission jingle are built from oscillators and
// filtered noise. The context is created on the first user gesture, so the page stays
// silent until the player starts; M toggles mute.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function noiseBuffer(seconds) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!ensure() || muted) return;
    const t = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(dur);
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  // A lazy bass-and-hats loop in A minor, quiet under the action.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = BASS[musicStep % BASS.length];
      musicStep += 1;
      blip(note, 0.42, 'triangle', 0.10);
      if (musicStep % 2 === 0) noise(0.05, 0.03, 6000, 'highpass');
    }, 300);
  }

  return {
    unlock,
    startMusic,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    click() {
      blip(660, 0.06, 'square', 0.08);
    },
    shot() {
      noise(0.14, 0.5, 1800);
      blip(160, 0.1, 'square', 0.25, 60);
    },
    shotgun() {
      noise(0.3, 0.6, 900);
      blip(110, 0.2, 'square', 0.3, 45);
    },
    enemyShot() {
      noise(0.12, 0.3, 1400);
    },
    hit() {
      blip(220, 0.12, 'sawtooth', 0.2, 90);
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.2);
      window.setTimeout(() => blip(1320, 0.12, 'sine', 0.2), 70);
    },
    cash() {
      blip(990, 0.08, 'sine', 0.18);
      window.setTimeout(() => blip(1480, 0.14, 'sine', 0.18), 80);
    },
    crash() {
      noise(0.25, 0.5, 500);
    },
    jingle() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, i) => window.setTimeout(() => blip(n, 0.22, 'triangle', 0.22), i * 110));
    },
    fail() {
      [392, 311, 233].forEach((n, i) => window.setTimeout(() => blip(n, 0.25, 'sawtooth', 0.15), i * 140));
    },
    engine(speed01) {
      if (!ensure() || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = context.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = context.createGain();
        engineGain.gain.value = 0;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const t = context.currentTime;
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
      engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, t, 0.1);
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = context.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = context.createGain();
        sirenGain.gain.value = muted ? 0 : 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = false;
        sirenTimer = window.setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 950 : 700, context.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenOsc) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        try {
          sirenOsc.stop();
        } catch {
          // Already stopped.
        }
        sirenOsc.disconnect();
        sirenOsc = null;
        sirenGain = null;
      }
    },
  };
}
