// All sound is synthesized with WebAudio — no audio files to download.
// Engines are oscillators tuned to firing frequency, music is a small
// step sequencer with a few moods.

import { settings } from './save.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  applyVolume();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function applyVolume() {
  if (!ctx) return;
  master.gain.value = settings.volume;
  musicBus.gain.value = settings.music * 0.55;
}

// Browsers only allow audio after a gesture.
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => {
  init(); if (ctx && ctx.state === 'suspended') ctx.resume();
}, { passive: true }));

function noiseSource() {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; return n;
}

function env(g, t, a, peak, d) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

// ---------------- engine voice ----------------
class EngineVoice {
  constructor(opts = {}) {
    this.cyl = opts.cylinders || 8;
    this.loud = opts.loudness || 0.5;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.Q.value = 3;
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator(); this.o2.type = 'square';
    this.o3 = ctx.createOscillator(); this.o3.type = 'triangle';
    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    const g3 = ctx.createGain(); g3.gain.value = 0.4;
    this.o1.connect(g1).connect(this.filter);
    this.o2.connect(g2).connect(this.filter);
    this.o3.connect(g3).connect(this.filter);
    this.filter.connect(this.out);
    // turbo whistle
    this.whistle = ctx.createOscillator(); this.whistle.type = 'sine';
    this.wg = ctx.createGain(); this.wg.gain.value = 0;
    this.whistle.connect(this.wg).connect(this.out);
    // tire / wind noise
    this.noise = noiseSource();
    this.nf = ctx.createBiquadFilter(); this.nf.type = 'bandpass'; this.nf.frequency.value = 1400; this.nf.Q.value = 1.4;
    this.ng = ctx.createGain(); this.ng.gain.value = 0;
    this.noise.connect(this.nf).connect(this.ng).connect(this.out);
    this.panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.panner) this.out.connect(this.panner).connect(sfxBus); else this.out.connect(sfxBus);
    [this.o1, this.o2, this.o3, this.whistle, this.noise].forEach(o => o.start());
    this.lastBoost = 0;
  }
  update({ rpm, throttle = 0, boost = 0, slip = 0, volume = 1, pan = 0, turbo = false, speed = 0 }) {
    const t = ctx.currentTime;
    const f = Math.max(20, rpm / 60 * this.cyl / 2);
    this.o1.frequency.setTargetAtTime(f, t, 0.02);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.02);
    this.o3.frequency.setTargetAtTime(f * 2.01, t, 0.02);
    this.filter.frequency.setTargetAtTime(300 + throttle * 1800 + rpm * 0.12, t, 0.04);
    const vol = (0.05 + 0.13 * throttle + rpm / 9000 * 0.07) * this.loud * volume;
    this.out.gain.setTargetAtTime(vol, t, 0.05);
    if (turbo) {
      this.whistle.frequency.setTargetAtTime(2400 + boost * 4200, t, 0.05);
      this.wg.gain.setTargetAtTime(boost * 0.05, t, 0.05);
      if (this.lastBoost > 0.55 && boost < 0.25) blowOff(volume);
    }
    this.lastBoost = boost;
    this.ng.gain.setTargetAtTime(Math.min(1, slip) * 0.5 + Math.min(1, speed / 70) * 0.05, t, 0.05);
    this.nf.frequency.setTargetAtTime(slip > 0.05 ? 1900 : 700, t, 0.1);
    if (this.panner) this.panner.pan.setTargetAtTime(pan, t, 0.05);
  }
  stop() {
    const t = ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => {
      [this.o1, this.o2, this.o3, this.whistle, this.noise].forEach(o => { try { o.stop(); } catch { /* already stopped */ } });
      this.out.disconnect();
    }, 400);
  }
}

function blowOff(volume = 1) {
  const t = ctx.currentTime;
  const n = noiseSource();
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
  const g = ctx.createGain();
  n.connect(f).connect(g).connect(sfxBus);
  env(g, t, 0.01, 0.12 * volume, 0.35);
  n.start(t); n.stop(t + 0.5);
}

// ---------------- siren ----------------
let siren = null;
function setSiren(on, intensity = 1) {
  if (!ctx) return;
  if (on && !siren) {
    const o = ctx.createOscillator(); o.type = 'square';
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.55;
    const lfoG = ctx.createGain(); lfoG.gain.value = 380;
    lfo.connect(lfoG).connect(o.frequency);
    o.frequency.value = 980;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2000;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f).connect(g).connect(sfxBus);
    o.start(); lfo.start();
    siren = { o, lfo, g };
  }
  if (siren) {
    siren.g.gain.setTargetAtTime(on ? 0.035 * intensity : 0, ctx.currentTime, 0.2);
    siren.lfo.frequency.setTargetAtTime(intensity > 0.7 ? 2.6 : 0.55, ctx.currentTime, 0.3);
    if (!on) {
      const s = siren; siren = null;
      setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch { /* stopped */ } }, 900);
    }
  }
}

// ---------------- one-shots ----------------
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
  if (!init()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  const g = ctx.createGain();
  o.connect(g).connect(sfxBus);
  env(g, t, 0.005, vol, dur);
  o.start(t); o.stop(t + dur + 0.05);
}

function noiseHit(dur, vol, freq = 800, type = 'lowpass') {
  if (!init()) return;
  const t = ctx.currentTime;
  const n = noiseSource();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  n.connect(f).connect(g).connect(sfxBus);
  env(g, t, 0.005, vol, dur);
  n.start(t); n.stop(t + dur + 0.05);
}

// ---------------- music ----------------
const MOODS = {
  menu:    { bpm: 92,  root: 41, scale: [0, 3, 7, 10, 12, 15], kick: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0], hat: [0,0,1,0], bass: [0,0,0,3, 0,0,5,0, 0,0,0,3, 0,2,0,0], pad: true },
  cruise:  { bpm: 104, root: 38, scale: [0, 3, 5, 7, 10, 12], kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,1], hat: [0,1,1,1], bass: [0,0,3,0, 0,0,5,0, 0,7,0,5, 3,0,0,0], pad: true },
  meet:    { bpm: 96,  root: 36, scale: [0, 3, 7, 10, 12], kick: [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0], hat: [0,0,1,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], bass: [0,0,0,0, 3,0,0,0, 0,0,0,0, 5,0,4,0], pad: true },
  pursuit: { bpm: 150, root: 40, scale: [0, 1, 5, 7, 8, 12], kick: [1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,1,0], hat: [1,1,1,1], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], bass: [0,0,1,0, 0,0,0,1, 0,0,1,0, 2,0,3,0], pad: false },
  race:    { bpm: 140, root: 43, scale: [0, 3, 5, 7, 10, 12], kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0], hat: [0,1,0,1], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], bass: [0,0,0,2, 0,0,3,0, 0,0,0,2, 4,0,3,0], pad: false },
};
let mood = null, step = 0, nextT = 0, timer = null, padNodes = null;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function setMusic(name) {
  if (name === mood) return;
  mood = name;
  if (!init()) return;
  if (padNodes) { const p = padNodes; padNodes = null; p.g.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => p.os.forEach(o => { try { o.stop(); } catch { /* stopped */ } }), 2500); }
  if (!name) { clearInterval(timer); timer = null; return; }
  const m = MOODS[name];
  if (m.pad) {
    const g = ctx.createGain(); g.gain.value = 0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const os = [0, 7, 15].map(iv => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m.root + 24 + iv); o.detune.value = Math.random() * 14 - 7; o.connect(f); o.start(); return o; });
    f.connect(g).connect(musicBus);
    g.gain.setTargetAtTime(0.03, ctx.currentTime, 1.5);
    padNodes = { g, os };
  }
  step = 0; nextT = ctx.currentTime + 0.1;
  if (!timer) timer = setInterval(schedule, 50);
}

function schedule() {
  if (!mood || !ctx) return;
  const m = MOODS[mood];
  const stepDur = 60 / m.bpm / 4;
  while (nextT < ctx.currentTime + 0.15) {
    const i = step % 16;
    if (m.kick[i]) drum(nextT, 'kick');
    if (m.hat[i % 4]) drum(nextT, 'hat');
    if (m.snare && m.snare[i]) drum(nextT, 'snare');
    const b = m.bass[i];
    if (b) bassNote(nextT, mtof(m.root + m.scale[(b - 1) % m.scale.length]), stepDur * 1.8);
    else if (i % 8 === 0) bassNote(nextT, mtof(m.root), stepDur * 1.8);
    nextT += stepDur; step++;
  }
}

function drum(t, kind) {
  if (kind === 'kick') {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    o.connect(g).connect(musicBus); env(g, t, 0.002, 0.6, 0.22); o.start(t); o.stop(t + 0.3);
  } else {
    const n = noiseSource(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
    n.connect(f).connect(g).connect(musicBus);
    env(g, t, 0.002, kind === 'hat' ? 0.08 : 0.25, kind === 'hat' ? 0.04 : 0.14);
    n.start(t); n.stop(t + 0.2);
  }
}

function bassNote(t, freq, dur) {
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(160, t + dur);
  const g = ctx.createGain();
  o.connect(f).connect(g).connect(musicBus);
  env(g, t, 0.01, 0.22, dur);
  o.start(t); o.stop(t + dur + 0.05);
}

export const audio = {
  init,
  get ready() { return !!ctx; },
  applyVolume,
  engine(opts) { return init() ? new EngineVoice(opts) : null; },
  siren: setSiren,
  music: setMusic,
  horn() { tone(392, 0.45, 'square', 0.08); tone(494, 0.45, 'square', 0.06); },
  beep(f = 880, d = 0.12) { tone(f, d, 'square', 0.1); },
  treeAmber() { tone(660, 0.12, 'sine', 0.12); },
  treeGreen() { tone(1320, 0.25, 'sine', 0.16); },
  click() { tone(1200, 0.04, 'triangle', 0.05); },
  buy() { tone(880, 0.08, 'triangle', 0.1); setTimeout(() => tone(1320, 0.12, 'triangle', 0.1), 70); },
  error() { tone(180, 0.2, 'square', 0.08); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.12), i * 110)); },
  lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 150)); },
  crash(strength = 1) { noiseHit(0.35, Math.min(0.6, 0.15 + strength * 0.3), 600); tone(70, 0.25, 'sine', 0.3 * Math.min(1, strength)); },
  shift() { noiseHit(0.06, 0.05, 3000, 'highpass'); },
  nos() { noiseHit(0.5, 0.12, 4000, 'highpass'); },
  // a crackle/bang from the exhaust (2-step limiter cuts)
  pop(vol = 1) { noiseHit(0.09, 0.2 * vol, 1500, 'bandpass'); tone(95, 0.1, 'sine', 0.22 * vol, -50); },
  phone() { tone(1046, 0.08, 'sine', 0.1); setTimeout(() => tone(1318, 0.1, 'sine', 0.1), 110); },
  radio() { noiseHit(0.12, 0.06, 2200, 'bandpass'); },
};
