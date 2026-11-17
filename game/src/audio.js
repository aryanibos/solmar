// Sound, synthesized live with WebAudio: no audio files, no network.
// Engine hum follows the car's speed, sirens wail two tones, gunshots are
// filtered noise, and a small bass-and-hat loop keeps the city moving.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: null,
    musicStep: 0,
    musicOn: false,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(audio.ctx.destination);
    // Engine: two detuned saws through a lowpass, pitched by speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineOsc2 = audio.ctx.createOscillator();
    audio.engineOsc2.type = 'square';
    audio.engineOsc2.frequency.value = 110;
    audio.engineFilter = audio.ctx.createBiquadFilter();
    audio.engineFilter.type = 'lowpass';
    audio.engineFilter.frequency.value = 420;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineFilter);
    audio.engineOsc2.connect(audio.engineFilter);
    audio.engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.engineOsc2.start();
    // Siren: a triangle that swings between two tones.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    return true;
  } catch {
    return false;
  }
}

export function setEngine(audio, speed01, driving) {
  if (!audio.ctx) return;
  const target = driving ? 0.045 + speed01 * 0.05 : 0;
  audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
  audio.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, audio.ctx.currentTime, 0.08);
  audio.engineOsc2.frequency.setTargetAtTime(110 + speed01 * 260, audio.ctx.currentTime, 0.08);
}

export function setSiren(audio, on, time) {
  if (!audio.ctx) return;
  audio.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, audio.ctx.currentTime, 0.2);
  if (on) {
    const f = Math.floor(time * 1.6) % 2 === 0 ? 660 : 880;
    audio.sirenOsc.frequency.setTargetAtTime(f, audio.ctx.currentTime, 0.05);
  }
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}

function noiseBurst(audio, duration, filterFreq, gainValue) {
  if (!audio.ctx) return;
  const len = Math.floor(audio.ctx.sampleRate * duration);
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = audio.ctx.createGain();
  gain.gain.value = gainValue;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start();
}

function tone(audio, freq, duration, type, gainValue, slideTo) {
  if (!audio.ctx) return;
  const osc = audio.ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audio.ctx.currentTime + duration);
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(gainValue, audio.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(audio.ctx.currentTime + duration + 0.02);
}

export function playGunshot(audio) {
  noiseBurst(audio, 0.14, 2400, 0.5);
  tone(audio, 180, 0.08, 'square', 0.18, 60);
}

export function playPunch(audio) {
  noiseBurst(audio, 0.09, 500, 0.4);
}

export function playPickup(audio) {
  tone(audio, 660, 0.09, 'sine', 0.25);
  tone(audio, 990, 0.12, 'sine', 0.22);
}

export function playCrash(audio) {
  noiseBurst(audio, 0.3, 700, 0.5);
}

export function playJingle(audio) {
  const notes = [523, 659, 784, 1046];
  notes.forEach((n, i) => {
    setTimeout(() => tone(audio, n, 0.22, 'triangle', 0.25), i * 110);
  });
}

export function playClick(audio) {
  tone(audio, 440, 0.06, 'square', 0.15);
}

export function playBusted(audio) {
  tone(audio, 392, 0.3, 'sawtooth', 0.2, 196);
  tone(audio, 311, 0.5, 'sawtooth', 0.2, 155);
}

// A tiny two-bar loop: a bass line over a hat tick, Am – F – C – G.
const BASS = [110, 110, 87, 98, 131, 131, 98, 110];
const HAT_EVERY = 2;

export function startMusic(audio) {
  if (!audio.ctx || audio.musicOn) return;
  audio.musicOn = true;
  audio.musicTimer = setInterval(() => {
    if (audio.muted) return;
    const step = audio.musicStep;
    const bass = BASS[step % BASS.length];
    tone(audio, bass, 0.22, 'triangle', 0.16);
    if (step % HAT_EVERY === 0) noiseBurst(audio, 0.03, 8000, 0.05);
    audio.musicStep += 1;
  }, 210);
}

export function stopMusic(audio) {
  audio.musicOn = false;
  if (audio.musicTimer) {
    clearInterval(audio.musicTimer);
    audio.musicTimer = null;
  }
}
