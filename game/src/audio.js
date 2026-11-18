// Synthesized sound for Solmar: no audio files, everything comes from the
// Web Audio API. Engine hum, sirens, gunshots, punches, pickups and jingles
// are all little oscillator and noise recipes. Created lazily on the first
// user gesture, since browsers block audio before that.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.25, lowpass = 1200) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.4;
      if (m) this.engine(0);
    },
    engine(speed01) {
      if (!ensure()) return;
      if (muted || speed01 <= 0.02) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineGain.gain.value = 0.05 + speed01 * 0.05;
    },
    siren(on) {
      if (!ensure()) return;
      if (!on || muted) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let hi = true;
        setInterval(() => {
          if (sirenOsc) sirenOsc.frequency.value = hi ? 880 : 660;
          hi = !hi;
        }, 420);
      }
      sirenGain.gain.value = 0.045;
    },
    shoot() { noise(0.12, 0.3, 2400); tone(160, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.22, 700); },
    hit() { tone(220, 0.1, 'sawtooth', 0.14, 110); },
    pickup() { tone(660, 0.09, 'sine', 0.18); setTimeout(() => tone(990, 0.12, 'sine', 0.18), 80); },
    cash() { tone(880, 0.1, 'sine', 0.16); setTimeout(() => tone(1320, 0.16, 'sine', 0.16), 90); },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 110));
    },
    fail() { tone(330, 0.3, 'sawtooth', 0.16, 165); },
    busted() { tone(440, 0.5, 'sawtooth', 0.18, 220); setTimeout(() => tone(220, 0.6, 'sawtooth', 0.18, 110), 300); },
    click() { tone(1200, 0.04, 'square', 0.08); },
    crash() { noise(0.25, 0.3, 500); },
  };
}
