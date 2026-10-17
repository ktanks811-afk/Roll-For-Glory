// Sound is synthesized with WebAudio. Engines are oscillators tuned to firing
// frequency, music is a small step sequencer with a few moods. The audio
// files are the intro song on the loading and title screens and the songs on
// the car radio (audio/radio/).

import { settings, saveSettings } from './save.js';
import { harmonics } from '../sim/sound.js';
import { audioBuild } from '../data/carAudio.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, moodBus = null, ambBus = null, noiseBuf = null;

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  moodBus = ctx.createGain(); moodBus.connect(musicBus);   // the synth moods; the car radio ducks them
  ambBus = ctx.createGain(); ambBus.connect(master);
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
  ambBus.gain.value = (settings.ambience ?? 0.8) * 1.2;
}

// Browsers only allow audio after a gesture. iOS only counts the end of a
// tap (touchend / click) as one, and leaves the context 'interrupted' after
// the app was in the background, so try on every kind of tap until it runs.
['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown'].forEach(ev => window.addEventListener(ev, () => {
  init(); if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  if (radio.el && radio.playing && radio.el.paused && !document.hidden) radio.el.play().catch(() => {});
  if (peerRadio.el && peerRadio.id && peerRadio.el.paused && !document.hidden) peerRadio.el.play().catch(() => {});
}, { passive: true, capture: true }));

function noiseSource() {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; return n;
}
// Several loops of the same noise started together would comb-filter each
// other, so each long-running layer starts somewhere random in the buffer.
const startNoise = n => n.start(0, Math.random() * 1.9);

function env(g, t, a, peak, d) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

// ---------------- engine voice ----------------
// Combustion engines are one periodic wave whose harmonics come from the
// car's firing pattern (see sim/sound.js), pushed through an exhaust-shaped
// filter and waveshaper, plus the extras that make each car recognisable:
// turbo whistle and blow-off, supercharger whine, VTEC crossover, overrun
// burble. Electric cars get a motor whine instead.
const waveCache = new Map();
function engineWave(p) {
  const key = p.kind + '|' + p.slope + '|' + p.grit.toFixed(2);
  if (waveCache.has(key)) return waveCache.get(key);
  const a = harmonics(p, 96);
  const re = new Float32Array(a.length), im = new Float32Array(a.length);
  let seed = 1234567 + p.n * 977;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 1; k < a.length; k++) { const ph = rnd() * Math.PI * 2; re[k] = a[k] * Math.cos(ph); im[k] = a[k] * Math.sin(ph); }
  const w = ctx.createPeriodicWave(re, im);
  waveCache.set(key, w);
  return w;
}
function driveCurve(amount) {
  const n = 512, c = new Float32Array(n), k = 1 + amount * 6;
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
  return c;
}

class EngineVoice {
  constructor(opts = {}) {
    const p = opts.profile || { kind: 'i4', n: opts.cylinders || 8, slope: 0.9, leak: {}, grit: 0.3, cut: 1, drive: 0, loud: opts.loudness || 0.5, burble: 0, vtec: 0 };
    this.p = p;
    this.ev = p.kind === 'ev';
    this.loud = (p.loud ?? 0.5) * (opts.volume ?? 1);
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.nodes = [];
    const track = (...n) => { this.nodes.push(...n); return n[0]; };
    this.panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.panner) this.out.connect(this.panner).connect(sfxBus); else this.out.connect(sfxBus);
    this.lastBoost = 0; this.lastThr = 0; this.vt = 0; this.vtOn = false;

    if (this.ev) {
      // motor + inverter whine
      this.m1 = track(ctx.createOscillator()); this.m1.type = 'sine';
      this.m2 = track(ctx.createOscillator()); this.m2.type = 'triangle';
      this.m3 = track(ctx.createOscillator()); this.m3.type = 'sine';
      this.mg = [0.5, 0.18, 0.05].map(v => { const g = ctx.createGain(); g.gain.value = v; return g; });
      this.mf = ctx.createBiquadFilter(); this.mf.type = 'lowpass'; this.mf.frequency.value = 3500;
      [this.m1, this.m2, this.m3].forEach((o, i) => o.connect(this.mg[i]).connect(this.mf));
      this.mf.connect(this.out);
      [this.m1, this.m2, this.m3].forEach(o => o.start());
    } else {
      this.osc = track(ctx.createOscillator()); this.osc.setPeriodicWave(engineWave(p));
      this.shaper = ctx.createWaveShaper(); this.shaper.curve = driveCurve(p.drive || 0); this.shaper.oversample = '2x';
      this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.Q.value = 2.2 + (p.drive || 0) * 2;
      this.osc.connect(this.shaper).connect(this.filter).connect(this.out);
      this.osc.start();
      // induction / intake roar
      this.air = noiseSource(); this.af = ctx.createBiquadFilter(); this.af.type = 'bandpass'; this.af.frequency.value = 600; this.af.Q.value = 0.8;
      this.ag = ctx.createGain(); this.ag.gain.value = 0;
      this.air.connect(this.af).connect(this.ag).connect(this.out); this.air.start();
      // turbo whistle
      this.whistle = ctx.createOscillator(); this.whistle.type = 'sine';
      this.wg = ctx.createGain(); this.wg.gain.value = 0;
      this.whistle.connect(this.wg).connect(this.out); this.whistle.start();
      // supercharger whine
      if (p.blower) {
        this.bl = ctx.createOscillator(); this.bl.type = 'sawtooth';
        this.blf = ctx.createBiquadFilter(); this.blf.type = 'bandpass'; this.blf.Q.value = 5;
        this.blg = ctx.createGain(); this.blg.gain.value = 0;
        this.bl.connect(this.blf).connect(this.blg).connect(this.out); this.bl.start();
      }
    }
    // tire / wind noise
    this.noise = noiseSource();
    this.nf = ctx.createBiquadFilter(); this.nf.type = 'bandpass'; this.nf.frequency.value = 1400; this.nf.Q.value = 1.4;
    this.ng = ctx.createGain(); this.ng.gain.value = 0;
    this.noise.connect(this.nf).connect(this.ng).connect(this.out);
    this.noise.start();
    this.sources = [this.osc, this.whistle, this.noise, this.air, this.bl, this.m1, this.m2, this.m3].filter(Boolean);
  }

  update({ rpm, throttle = 0, boost = 0, slip = 0, volume = 1, pan = 0, turbo = false, speed = 0, wet = 0 }) {
    const t = ctx.currentTime, p = this.p;
    if (this.ev) {
      const f = 170 + speed * 24;
      this.m1.frequency.setTargetAtTime(f, t, 0.04);
      this.m2.frequency.setTargetAtTime(f * 2.5, t, 0.04);
      this.m3.frequency.setTargetAtTime(2600 + speed * 38, t, 0.05);
      this.mg[2].gain.setTargetAtTime(0.03 + throttle * 0.06, t, 0.08);
      this.mf.frequency.setTargetAtTime(1400 + throttle * 1800 + speed * 40, t, 0.06);
      const vol = (0.02 + 0.09 * throttle + Math.min(1, speed / 55) * 0.08) * this.loud * volume * 1.6;
      this.out.gain.setTargetAtTime(vol, t, 0.06);
    } else {
      const f0 = Math.max(5, rpm / 120);
      this.osc.frequency.setTargetAtTime(f0, t, 0.015);
      // VTEC / VVTL-i crossover: the cam changes and the engine opens up
      if (p.vtec) {
        const on = rpm > p.vtec && throttle > 0.3;
        if (on && !this.vtOn) this.out.gain.setTargetAtTime(this.out.gain.value * 1.5, t, 0.01);
        this.vtOn = on;
        this.vt += ((on ? 1 : 0) - this.vt) * 0.25;
      }
      const bright = Math.min(1.3, Math.max(0.7, 1.25 - 0.4 * (p.slope - 0.6)));
      const cutoff = (300 + throttle * 1800 + rpm * 0.12) * p.cut * bright * (1 + 0.8 * this.vt);
      this.filter.frequency.setTargetAtTime(Math.min(9000, cutoff), t, 0.04);
      const vol = (0.05 + 0.13 * throttle + rpm / 9000 * 0.07) * this.loud * volume * (1 + 0.3 * this.vt) * 1.5;
      this.out.gain.setTargetAtTime(vol, t, 0.05);
      // intake roar grows with throttle, rpm and intake mods (and VTEC)
      this.af.frequency.setTargetAtTime(500 + rpm * 0.12, t, 0.05);
      this.ag.gain.setTargetAtTime(throttle * Math.min(1, rpm / 7000) * (0.18 + 0.07 * (p.intake || 0) + 0.15 * this.vt) * (p.blower ? 0.6 : 1), t, 0.05);
      if (turbo || p.turbo) {
        const big = 1 - 0.07 * (p.turboBig || 0);              // bigger turbos whistle lower and breathier
        this.whistle.frequency.setTargetAtTime((2400 + boost * 4200) * big, t, 0.05);
        this.wg.gain.setTargetAtTime(boost * (0.05 + 0.01 * (p.turboBig || 0)), t, 0.05);
        if (this.lastBoost > 0.55 && boost < 0.25) blowOff(volume * (p.exhaust >= 3 ? 1.3 : 1));
      }
      if (this.bl) {
        const roots = p.blowerKind === 'roots';
        this.bl.frequency.setTargetAtTime(rpm * (roots ? 0.34 : 0.55), t, 0.03);
        this.blf.frequency.setTargetAtTime(rpm * (roots ? 0.34 : 0.55) * 2, t, 0.05);
        this.blg.gain.setTargetAtTime(throttle * Math.min(1, rpm / 6500) * (roots ? 0.075 : 0.045), t, 0.05);
      }
      // overrun burble: lift off at revs on a tuned exhaust
      if (this.lastThr > 0.6 && throttle < 0.1 && rpm > 3200 && p.burble > 0 && Math.random() < p.burble) {
        const n = 2 + Math.floor(Math.random() * (2 + p.exhaust));
        for (let i = 0; i < n; i++) setTimeout(() => this.burble(0.35 + Math.random() * 0.35 + p.exhaust * 0.08), 70 + i * (60 + Math.random() * 130));
      }
      this.lastThr = throttle;
    }
    this.lastBoost = boost;
    // wet road: the tires throw a hiss of spray that grows with speed
    const spray = wet * Math.min(1, speed / 30);
    this.ng.gain.setTargetAtTime(Math.min(1, slip) * 0.5 + Math.min(1, speed / 70) * 0.05 + spray * 0.22, t, 0.05);
    this.nf.frequency.setTargetAtTime(slip > 0.05 ? 1900 : spray > 0.1 ? 2600 : 700, t, 0.1);
    if (this.panner) this.panner.pan.setTargetAtTime(pan, t, 0.05);
  }

  // a small crackle out of the pipes
  burble(v = 0.5) {
    if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const n = noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 900; f.Q.value = 1.1;
    n.connect(f).connect(g).connect(this.out);
    env(g, t, 0.004, 0.35 * v * this.loud * 2, 0.07 + Math.random() * 0.06);
    n.start(t); n.stop(t + 0.2);
  }

  stop() {
    const t = ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => {
      this.sources.forEach(o => { try { o.stop(); } catch { /* already stopped */ } });
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
    f.connect(g).connect(moodBus);
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
    o.connect(g).connect(moodBus); env(g, t, 0.002, 0.6, 0.22); o.start(t); o.stop(t + 0.3);
  } else {
    const n = noiseSource(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
    n.connect(f).connect(g).connect(moodBus);
    env(g, t, 0.002, kind === 'hat' ? 0.08 : 0.25, kind === 'hat' ? 0.04 : 0.14);
    n.start(t); n.stop(t + 0.2);
  }
}

function bassNote(t, freq, dur) {
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(160, t + dur);
  const g = ctx.createGain();
  o.connect(f).connect(g).connect(moodBus);
  env(g, t, 0.01, 0.22, dur);
  o.start(t); o.stop(t + dur + 0.05);
}

// ---------------- intro song ----------------
// Streams from an <audio> element routed into the music bus, so the Music
// volume slider works on iPhone too (iOS ignores <audio>.volume). Browsers
// block it until the first tap; the gesture listener above starts it then.
const INTRO_SRC = 'audio/shooting-stars.m4a';
const INTRO_GAIN = 1.6;
let introOn = false, introEl = null, introGain = null, introStop = 0;

function setIntro(on) {
  if (on === introOn) return;
  introOn = on;
  if (!init()) return;
  clearTimeout(introStop);
  if (on) {
    if (!introEl) {
      introEl = new Audio(INTRO_SRC);
      introEl.loop = true; introEl.preload = 'auto'; introEl.setAttribute('playsinline', '');
      introGain = ctx.createGain();
      ctx.createMediaElementSource(introEl).connect(introGain).connect(musicBus);
    }
    introGain.gain.cancelScheduledValues(ctx.currentTime);
    introGain.gain.setValueAtTime(INTRO_GAIN, ctx.currentTime);
    if (!document.hidden) introEl.play().catch(() => {});
  } else if (introEl) {
    introGain.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
    introStop = setTimeout(() => { if (!introOn) introEl.pause(); }, 1600);
  }
}
// Leaving the app shouldn't keep the song going in the background.
document.addEventListener('visibilitychange', () => {
  for (const [el, on] of [[introEl, introOn], [radio.el, radio.playing], [peerRadio.el, !!peerRadio.id]]) {
    if (!el) continue;
    if (document.hidden) el.pause();
    else if (on) el.play().catch(() => {});
  }
});

// ---------------- car radio ----------------
// The studio's own songs, played in order and looping, whenever you're in a
// car (driving, riding along, or out on a boat) with the radio on. The world
// calls carRadio(true) every frame you're in one; when the calls stop (you got
// out, a race, the title screen) a watchdog fades the song out and pauses it.
// One <audio> element streams the current song into the music bus, so the
// Music slider sets its volume, and the synth moods duck while it plays.
export const STATIONS = [
  { id: 'smooth-criminals', title: 'Smooth Criminals' },
  { id: 'hustlin',          title: 'Hustlin' },
  { id: 'srt-punisher',     title: 'SRT Punisher' },
  { id: 'murda-dance',      title: 'Murda Dance' },
  { id: 'ass-appeal',       title: 'Ass Appeal' },
];
const RADIO_GAIN = 1.5;
const radio = { el: null, gain: null, fx: null, build: '', pow: 0, track: -1, playing: false, seen: 0, stop: 0, onChange: null };

// The song runs through the car's speakers before it reaches the music bus.
// Dry: the full song, through a factory or upgraded door-speaker EQ.
// Bass: the lows split off and fed to the subs, a saturated 808 boom plus a
// clean sub. Rattle: noise for the trunk lid and plate, its volume driven by
// how hard the bass is hitting, so it only buzzes on the big notes.
// A compressor keeps the hits loud without clipping.
function shaper(fn, n = 1024) {
  const w = ctx.createWaveShaper(), c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn(i / (n - 1) * 2 - 1);
  w.curve = c; return w;
}
function buildRadioFx(src) {
  const g = (v = 0) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const bq = (type, f, q = 0.7, db = 0) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = db; return n; };
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -12; out.knee.value = 8; out.ratio.value = 4; out.attack.value = 0.004; out.release.value = 0.18;
  // dry: the door speakers
  const lowCut = bq('highpass', 70, 0.6), mids = bq('peaking', 2400, 0.8, 0), air = bq('highshelf', 7000, 0.7, 0);
  src.connect(lowCut).connect(mids).connect(air).connect(out);
  // bass: everything under ~110 Hz
  const lp1 = bq('lowpass', 110, 0.7), lp2 = bq('lowpass', 110, 0.7);
  src.connect(lp1).connect(lp2);
  const boom = shaper(x => Math.tanh(x * 3.2) / Math.tanh(3.2)), boomG = g(), subG = g();
  lp2.connect(boom).connect(boomG).connect(out);
  lp2.connect(subG).connect(out);
  const meter = ctx.createAnalyser(); meter.fftSize = 512; meter.smoothingTimeConstant = 0;
  lp2.connect(meter);
  // rattle: the bass's loudness (rectified and smoothed) opens a noise gate
  const rect = shaper(x => Math.abs(x)), envLp = bq('lowpass', 28, 0.5);
  const gate = shaper(x => Math.max(0, x - 0.14) * 3), rattleAmt = g();
  const vca = g(0);
  lp2.connect(rect).connect(envLp).connect(gate).connect(rattleAmt).connect(vca.gain);
  const n = noiseSource(), lid = bq('bandpass', 240, 1.6), plate = bq('bandpass', 1100, 2.2), plateG = g(0.45);
  n.connect(lid).connect(vca); n.connect(plate).connect(plateG).connect(vca);
  vca.connect(out); startNoise(n);
  return { out, lowCut, mids, air, boomG, subG, rattleAmt, meter, buf: new Float32Array(512) };
}
// set the speakers for the car you're in (null: factory, like a ride-along or a boat)
function applyRadioBuild(car, R = radio) {
  const b = audioBuild(car), key = b.subs.id + '/' + b.doors.id;
  if (!R.fx || key === R.build) return;
  R.build = key;
  const fx = R.fx, t = ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, t, 0.25);
  const subs = b.subs.id !== 'none', P = subs ? b.pow : 0;
  R.pow = P;
  set(fx.lowCut.frequency, subs ? 55 : 70);   // with subs in, the doors don't have to carry the low end
  set(fx.boomG.gain, P * 0.9);
  set(fx.subG.gain, P * 1.6);
  set(fx.rattleAmt.gain, P > 0.3 ? (P - 0.3) * 1.1 : 0);
  set(fx.mids.gain, b.doors.bonus * 20);
  set(fx.air.gain, b.doors.bonus * 26);
}
// how hard the subs are hitting right now, 0 to about 1 (for the car rocking)
function radioBass(R = radio) {
  if (!R.fx || !(R === radio ? radio.playing : R.id) || R.pow <= 0 || R.el?.paused) return 0;
  const d = R.fx.buf; R.fx.meter.getFloatTimeDomainData(d);
  let pk = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
  return Math.min(1, pk * 1.6) * R.pow;
}

// ---------------- other players' radios ----------------
// The closest online player with their radio on plays through a second
// <audio> element, in step with their song. From outside the car you mostly
// hear the low end: the farther away, the lower the muffle cuts, so a car
// with subs thumps from down the block and a factory radio fades out fast.
const peerRadio = { el: null, fx: null, muffle: null, gain: null, id: '', build: '', pow: 0, track: -1, want: 0, seekAt: 0 };
const PEER_RANGE = 28;   // metres a factory radio carries; subs add up to ~55 more
function peerRadioLoad() {
  if (peerRadio.el) return;
  const el = peerRadio.el = new Audio();
  el.preload = 'auto'; el.setAttribute('playsinline', ''); el.loop = true;
  el.addEventListener('loadedmetadata', () => { if (peerRadio.want) { try { el.currentTime = peerRadio.want % (el.duration || 1e9); } catch { /* not seekable yet */ } } });
  peerRadio.fx = buildRadioFx(ctx.createMediaElementSource(el));
  peerRadio.muffle = ctx.createBiquadFilter(); peerRadio.muffle.type = 'lowpass'; peerRadio.muffle.frequency.value = 1200; peerRadio.muffle.Q.value = 0.5;
  peerRadio.gain = ctx.createGain(); peerRadio.gain.gain.value = 0;
  peerRadio.fx.out.connect(peerRadio.muffle).connect(peerRadio.gain).connect(musicBus);
}
// peers: [{ id, x, z, radio: { on, tr, pos, at, sb, dr } }], me: { x, z }
function setPeerRadios(peers, me, inOwnCar) {
  if (!ctx) return;
  const now = performance.now() / 1000;
  let best = null, bestK = 0;
  for (const p of peers) {
    const r = p.radio;
    if (!r?.on || !p.inCar || now - r.at > 20) continue;
    const b = audioBuild({ audio: { subs: r.sb, doors: r.dr } }), pow = b.subs.id === 'none' ? 0 : b.pow;
    const range = PEER_RANGE + pow * 55, d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d >= range) continue;
    const k = 1 - d / range;
    if (k > bestK) { best = { p, d, k, range }; bestK = k; }
  }
  if (!best) {
    if (peerRadio.id) {
      peerRadio.id = '';
      peerRadio.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => { if (!peerRadio.id) peerRadio.el.pause(); }, 1200);
    }
    return;
  }
  peerRadioLoad();
  const { p, d, k } = best, r = p.radio, el = peerRadio.el;
  const n = STATIONS.length, tr = ((Math.round(r.tr) % n) + n) % n;
  const want = r.pos + (now - r.at);
  if (peerRadio.id !== p.id || peerRadio.track !== tr) {
    peerRadio.id = p.id; peerRadio.track = tr; peerRadio.want = want;
    el.src = `audio/radio/${STATIONS[tr].id}.m4a`;
  } else if (el.readyState >= 1 && el.duration && now - peerRadio.seekAt > 3 && Math.abs(el.currentTime - want % el.duration) > 2.5) {
    peerRadio.seekAt = now;
    try { el.currentTime = want % el.duration; } catch { /* not seekable yet */ }
  }
  if (el.paused && !document.hidden) el.play().catch(() => {});
  applyRadioBuild({ audio: { subs: r.sb, doors: r.dr } }, peerRadio);
  const t = ctx.currentTime;
  peerRadio.muffle.frequency.setTargetAtTime(d < 6 ? 2600 : 180 + 1600 * k * k, t, 0.2);
  peerRadio.gain.gain.setTargetAtTime(RADIO_GAIN * 0.9 * k * k * (inOwnCar ? 0.4 : 1), t, 0.2);
}

function radioTrack() {
  const n = STATIONS.length;
  return ((settings.radioTrack ?? 0) % n + n) % n;
}
function radioLoad() {
  const i = radioTrack();
  if (!radio.el) {
    radio.el = new Audio();
    radio.el.preload = 'auto'; radio.el.setAttribute('playsinline', '');
    radio.el.addEventListener('ended', () => radioSkip(1));
    radio.gain = ctx.createGain(); radio.gain.gain.value = 0;
    radio.fx = buildRadioFx(ctx.createMediaElementSource(radio.el));
    radio.fx.out.connect(radio.gain).connect(musicBus);
  }
  if (radio.track !== i) { radio.track = i; radio.el.src = `audio/radio/${STATIONS[i].id}.m4a`; }
}
function radioFade(on) {
  const t = ctx.currentTime;
  radio.gain.gain.cancelScheduledValues(t);
  radio.gain.gain.setTargetAtTime(on ? RADIO_GAIN : 0, t, on ? 0.15 : 0.3);
  moodBus.gain.cancelScheduledValues(t);
  moodBus.gain.setTargetAtTime(on ? 0 : 1, t, 0.4);
}
function radioStart() {
  radioLoad();
  clearTimeout(radio.stop);
  radio.playing = true;
  radioFade(true);
  if (!document.hidden) radio.el.play().catch(() => {});
}
function radioHalt() {
  if (!radio.playing) return;
  radio.playing = false;
  radioFade(false);
  radio.stop = setTimeout(() => { if (!radio.playing) radio.el.pause(); }, 1200);
}
function setCarRadio(inCar, car = null) {
  if (!init()) return;
  radio.seen = performance.now();
  const want = inCar && settings.radio !== false;
  if (want && !radio.playing) radioStart();
  else if (!want && radio.playing) radioHalt();
  if (want) applyRadioBuild(car);
}
setInterval(() => { if (radio.playing && performance.now() - radio.seen > 600) radioHalt(); }, 300);

function radioSkip(dir) {
  settings.radioTrack = radioTrack() + dir;
  saveSettings();
  if (!ctx || !radio.el) { radio.onChange?.(); return; }
  const was = radio.playing;
  radioLoad();
  radio.el.currentTime = 0;
  if (was && !document.hidden) radio.el.play().catch(() => {});
  radio.onChange?.();
}
function radioPower(on = settings.radio === false) {
  settings.radio = !!on;
  saveSettings();
  if (!on) radioHalt();
  radio.onChange?.();
}

// ---------------- world ambience ----------------
// Rain, wind, the city's hum, and the cars rolling past you, all built from
// the one noise buffer and a handful of oscillators so it stays cheap on a
// phone. The world calls ambience() every frame with where you are; if the
// calls stop (a race, the title screen) a watchdog fades it all out.
// Sitting in a car or indoors muffles the outside through one lowpass.
let amb = null, ambSeen = 0;
const PASSBY_VOICES = 3;

function buildAmbience() {
  const live = ctx.createGain(); live.gain.value = 0; live.connect(ambBus);
  const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 16000; muffle.Q.value = 0.4;
  muffle.connect(live);
  const layer = (type, freq, q) => {
    const n = noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    n.connect(f).connect(g).connect(muffle); startNoise(n);
    return { f, g };
  };
  amb = {
    live, muffle,
    rainHi: layer('highpass', 3200, 0.5),   // the hiss of rain everywhere
    rainLo: layer('bandpass', 750, 0.45),   // the wash of it hitting the street
    wind: layer('bandpass', 380, 1.1),
    hum: layer('lowpass', 130, 0.7),        // the city: far-off engines and highways
    road: layer('bandpass', 1100, 0.6),     // tires on far-off streets (louder when wet)
    voices: [],
    windPhase: Math.random() * 10,
    next: { drop: 0, horn: 6, siren: 40, dog: 10, cricket: 0, bird: 3, bass: 25 },
    st: {},
  };
  for (let i = 0; i < PASSBY_VOICES; i++) {
    const out = ctx.createGain(); out.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) out.connect(pan).connect(muffle); else out.connect(muffle);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 40;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 1.5;
    const og = ctx.createGain(); og.gain.value = 1;
    o.connect(lp).connect(og).connect(out); o.start();
    const n = noiseSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
    nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.7; ng.gain.value = 0.5;
    n.connect(nf).connect(ng).connect(out); startNoise(n);
    amb.voices.push({ out, pan, o, lp, nf, ng, car: null, d: 0 });
  }
  // fade out when nobody has called for a moment
  setInterval(() => {
    if (amb && performance.now() - ambSeen > 450) amb.live.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  }, 300);
}

// short one-shots that live outside the muffle (drops on your own roof) or inside it (the city)
function ambShot(muffled = true) {
  const t = ctx.currentTime, g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const dest = muffled ? amb.muffle : amb.live;
  if (p) g.connect(p).connect(dest); else g.connect(dest);
  return { t, g, pan: v => { if (p) p.pan.value = Math.max(-1, Math.min(1, v)); } };
}
const rp = () => Math.random() * 1.6 - 0.8;

const AMB_EVENTS = {
  // a raindrop smacking the roof or windshield
  drop(vol) {
    const { t, g, pan } = ambShot(false); pan(rp());
    const n = noiseSource(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 2600; f.Q.value = 2.5;
    n.connect(f).connect(g); env(g, t, 0.002, vol * (0.3 + Math.random() * 0.7), 0.03);
    n.start(t, Math.random() * 1.9); n.stop(t + 0.06);
  },
  // somebody leaning on a horn a few blocks over
  horn(vol) {
    const { t, g, pan } = ambShot(); pan(rp());
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; f.connect(g);
    const base = 330 + Math.random() * 120, dur = 0.18 + Math.random() * 0.5, n = Math.random() < 0.4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const st = t + k * (dur + 0.12);
      [1, 1.26].forEach(m => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = base * m; o.connect(f); o.start(st); o.stop(st + dur); });
    }
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + n * (dur + 0.12)); g.gain.linearRampToValueAtTime(0.0001, t + n * (dur + 0.12) + 0.05);
  },
  // a siren somewhere across town, coming and going
  siren(vol) {
    const { t, g, pan } = ambShot();
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = Math.random() < 0.5 ? 0.45 : 2.2;
    const lg = ctx.createGain(); lg.gain.value = 320; lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1300;
    o.connect(f).connect(g);
    const len = 7 + Math.random() * 5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + len * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.frequency.setValueAtTime(930, t); o.frequency.linearRampToValueAtTime(860, t + len);   // it's driving away by the end
    const p0 = rp(); pan(p0);
    o.start(t); lfo.start(t); o.stop(t + len); lfo.stop(t + len);
  },
  // a yard dog going off down the block
  dog(vol) {
    const { t, g, pan } = ambShot(); pan(rp());
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(g); g.gain.value = vol;
    const pitch = 0.8 + Math.random() * 0.5, n = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const st = t + k * (0.28 + Math.random() * 0.2), o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(380 * pitch, st); o.frequency.exponentialRampToValueAtTime(230 * pitch, st + 0.1);
      o.connect(og).connect(f); env(og, st, 0.006, 1, 0.1); o.start(st); o.stop(st + 0.14);
    }
  },
  // a cricket chirping three times
  cricket(vol) {
    const { t, g, pan } = ambShot(); pan(rp());
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4200 + Math.random() * 600;
    o.connect(g); g.gain.value = 0;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) { const st = t + k * 0.09; g.gain.setValueAtTime(vol, st); g.gain.setValueAtTime(0, st + 0.045); }
    o.start(t); o.stop(t + n * 0.09 + 0.05);
  },
  // a bird in the trees
  bird(vol) {
    const { t, g, pan } = ambShot(); pan(rp());
    const o = ctx.createOscillator(); o.type = 'sine'; o.connect(g);
    const n = 1 + Math.floor(Math.random() * 3), f0 = 2400 + Math.random() * 1600;
    for (let k = 0; k < n; k++) {
      const st = t + k * 0.16;
      o.frequency.setValueAtTime(f0, st); o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.4), st + 0.08);
      g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(vol, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.12);
    }
    o.start(t); o.stop(t + n * 0.16 + 0.05);
  },
  // somebody bumping it with the windows down a couple streets away
  bass(vol) {
    const { t, g, pan } = ambShot(); pan(rp());
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; f.connect(g);
    const bpm = 70 + Math.random() * 20, beat = 60 / bpm / 2, bars = 6 + Math.floor(Math.random() * 6);
    const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0];
    for (let k = 0; k < bars * 4; k++) {
      if (!pat[k % 16]) continue;
      const st = t + k * beat, o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.setValueAtTime(95, st); o.frequency.exponentialRampToValueAtTime(42, st + 0.25);
      o.connect(og).connect(f); env(og, st, 0.004, 1, 0.45); o.start(st); o.stop(st + 0.5);
    }
    const len = bars * 4 * beat;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + len * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + len);
  },
};

// w: { rain 0-2, wind 0-1, urban 0-1, night bool, hour, inside: '' | 'car' | 'room',
//      duck 0-1, cars: [{ ref, dx, dz, v }] nearest first, rot (camera turn), police bool }
function setAmbience(w, dt) {
  if (!init()) return;
  if (!amb) buildAmbience();
  ambSeen = performance.now();
  const t = ctx.currentTime, a = amb, st = a.st;
  // only retune the filters ten times a second; the events and voices ride along
  st.acc = (st.acc || 0) + dt;
  const tick = st.acc >= 0.1;
  const duck = w.duck ?? 1;
  a.live.gain.setTargetAtTime(duck, t, 0.3);
  if (tick) {
    const step = st.acc; st.acc = 0;
    const rain = w.rain || 0, urban = w.urban ?? 0.5, wet = Math.min(1, rain);
    const inside = w.inside || '';
    a.muffle.frequency.setTargetAtTime(inside === 'room' ? 650 : inside === 'car' ? 1500 : 16000, t, 0.25);
    a.rainHi.g.gain.setTargetAtTime(0.11 * Math.min(1.6, rain), t, 0.8);
    a.rainLo.g.gain.setTargetAtTime((inside === 'car' ? 0.3 : 0.18) * Math.min(1.6, rain), t, 0.8);
    // wind gusts: a slow wander so it breathes
    a.windPhase += step * (0.25 + w.wind * 0.5);
    const gust = 0.55 + 0.45 * Math.sin(a.windPhase) * Math.sin(a.windPhase * 0.37 + 1.3);
    a.wind.g.gain.setTargetAtTime((0.015 + w.wind * 0.16) * gust * (inside === 'car' ? 0.5 : 1), t, 0.5);
    a.wind.f.frequency.setTargetAtTime(260 + gust * 320 + w.wind * 200, t, 0.5);
    // the city's hum is lowest in the dead of night
    const busy = w.hour > 1 && w.hour < 5 ? 0.35 : w.night ? 0.65 : 1;
    a.hum.g.gain.setTargetAtTime(0.16 * urban * busy + 0.02, t, 1);
    a.road.g.gain.setTargetAtTime((0.012 + 0.03 * wet) * urban * busy, t, 1);
    a.road.f.frequency.setTargetAtTime(wet ? 1900 : 1100, t, 1);

    // cars rolling past you (pitch climbs on approach, drops away: doppler)
    const cars = w.cars || [], c = Math.cos(w.rot || 0), s = Math.sin(w.rot || 0);
    for (let i = 0; i < a.voices.length; i++) {
      const vo = a.voices[i], car = cars[i];
      if (!car) { vo.out.gain.setTargetAtTime(0, t, 0.3); vo.car = null; continue; }
      const d = Math.hypot(car.dx, car.dz);
      const closing = vo.car === car.ref ? (vo.d - d) / step : 0;
      vo.car = car.ref; vo.d = d;
      const dop = 343 / (343 - Math.max(-40, Math.min(40, closing)));
      const near = Math.max(0, 1 - d / 55) ** 2;
      const v = Math.abs(car.v || 0);
      vo.o.frequency.setTargetAtTime((26 + v * 1.9) * dop, t, 0.12);
      vo.lp.frequency.setTargetAtTime(260 + v * 18, t, 0.2);
      vo.nf.frequency.setTargetAtTime((wet ? 2200 : 800 + v * 20) * dop, t, 0.2);
      vo.ng.gain.setTargetAtTime(0.25 + wet * 0.9, t, 0.3);
      vo.out.gain.setTargetAtTime(near * (0.02 + Math.min(1, v / 22) * 0.07), t, 0.12);
      if (vo.pan) vo.pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, (car.dx * c - car.dz * s) / 25)), t, 0.12);
    }
  }

  // things that happen now and then
  const nx = a.next, h = w.hour ?? 12, rain = w.rain || 0, urban = w.urban ?? 0.5, roll = (k, gap) => { nx[k] = gap * (0.6 + Math.random() * 0.8); };
  for (const k in nx) nx[k] -= dt;
  if (w.inside === 'car' && rain > 0 && nx.drop <= 0) { AMB_EVENTS.drop(0.05 * Math.min(1.5, rain)); nx.drop = 1 / (9 * Math.min(1.8, rain)) * (0.4 + Math.random() * 1.2); }
  if (nx.horn <= 0) { if (urban > 0.5 && rain < 1.5 && !(h > 1 && h < 5)) AMB_EVENTS.horn(0.012 + Math.random() * 0.015); roll('horn', 14); }
  if (nx.siren <= 0) { if (urban > 0.5 && !w.police) AMB_EVENTS.siren(0.01 + Math.random() * 0.008); roll('siren', 75); }
  if (nx.dog <= 0) { if (urban < 0.9 && (w.night || Math.random() < 0.3) && rain < 1) AMB_EVENTS.dog(0.012 + Math.random() * 0.012); roll('dog', w.night ? 22 : 45); }
  if (nx.cricket <= 0) { const on = w.night && rain === 0 && w.inside !== 'room'; if (on) AMB_EVENTS.cricket(0.006 + (1 - urban) * 0.01); nx.cricket = on ? 0.5 + Math.random() * (0.9 + urban * 2) : 2; }
  if (nx.bird <= 0) { const on = !w.night && rain === 0 && h >= 6 && h < 19; if (on) AMB_EVENTS.bird((0.006 + (1 - urban) * 0.008) * (h < 10 ? 1.4 : 1)); roll('bird', on ? (h < 10 ? 3 : 7) * (0.6 + urban) : 5); }
  if (nx.bass <= 0) { if (urban > 0.5 && (w.night || h >= 17) && rain < 1.5) AMB_EVENTS.bass(0.05 + Math.random() * 0.04); roll('bass', 70); }
}

// Thunder: a close strike cracks before it rumbles, a far one just rolls.
function thunder(near = 0.5) {
  if (!init()) return;
  const v = 0.4 + near * 0.6;
  if (near > 0.6) noiseHit(0.25, 0.3 * near, 3500, 'highpass');
  noiseHit(1.4 + (1 - near) * 1.2, 0.35 * v, 140 + near * 160);
  tone(42 + near * 10, 1.6, 'sine', 0.28 * v, -18);
  setTimeout(() => noiseHit(1.6, 0.2 * v, 120), 300 + (1 - near) * 500);
  if (Math.random() < 0.6) setTimeout(() => noiseHit(1.1, 0.12 * v, 100), 1100 + Math.random() * 700);
}

export const audio = {
  init,
  get ready() { return !!ctx; },
  applyVolume,
  engine(opts) { return init() ? new EngineVoice(opts) : null; },
  // test hook: an analyser on the sfx bus
  async analyser() { if (!init()) return null; await ctx.resume(); const an = ctx.createAnalyser(); an.fftSize = 16384; an.smoothingTimeConstant = 0; sfxBus.connect(an); return an; },
  siren: setSiren,
  music: setMusic,
  intro: setIntro,
  // car radio: the world calls carRadio(inCar) every frame
  carRadio: setCarRadio,
  radioBass() { return radioBass(radio); },
  // other online players' radios: the closest one plays, and its subs thump
  peerRadios: setPeerRadios,
  peerBass() { return { id: peerRadio.id, bass: radioBass(peerRadio) }; },
  peerRadioState() { return { id: peerRadio.id, src: peerRadio.el?.getAttribute('src') || '', build: peerRadio.build, gain: peerRadio.gain?.gain.value ?? 0 }; },
  // what goes out online about your radio (null when it isn't playing in your car)
  radioShare() {
    if (!radio.playing || !radio.el || radio.el.paused) return null;
    const [sb, dr] = (radio.build || 'none/stock').split('/');
    return { tr: radioTrack(), pos: radio.el.currentTime || 0, sb, dr };
  },
  radioNext() { radioSkip(1); },
  radioPrev() { radioSkip(-1); },
  radioPower,
  radioState() { return { on: settings.radio !== false, playing: radio.playing, track: radioTrack(), title: STATIONS[radioTrack()].title, src: radio.el?.getAttribute('src') || '', gain: radio.gain?.gain.value ?? 0, mood: moodBus?.gain.value ?? 1, build: radio.build, pow: radio.pow, sub: radio.fx?.subG.gain.value ?? 0, rattle: radio.fx?.rattleAmt.gain.value ?? 0 }; },
  set onRadio(fn) { radio.onChange = fn; },
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
  // a gunshot: sharp crack plus a low thump (kind scales the size)
  gunshot(size = 1) { noiseHit(0.22, Math.min(0.7, 0.4 * size), 2400, 'highpass'); noiseHit(0.35, Math.min(0.6, 0.3 * size), 700); tone(70, 0.22, 'sine', 0.35 * size, -40); },
  // hog dogs (ui/hoghunt.js): a bay dog's chop, and a hog squealing on the catch
  bark(pitch = 1) { tone(320 * pitch, 0.06, 'sawtooth', 0.05, -80); setTimeout(() => tone(270 * pitch, 0.08, 'sawtooth', 0.045, -60), 95); },
  squeal() { tone(1400, 0.35, 'sawtooth', 0.04, 600); },
  phone() { tone(1046, 0.08, 'sine', 0.1); setTimeout(() => tone(1318, 0.1, 'sine', 0.1), 110); },
  radio() { noiseHit(0.12, 0.06, 2200, 'bandpass'); },
  thunder,
  // the living world: rain, wind, the city, passing cars (world2d/world.js soundscape())
  ambience: setAmbience,
  // test hook: how loud each ambience layer is set right now
  ambienceLevels() { return amb && { live: amb.live.gain.value, rain: amb.rainHi.g.gain.value, wind: amb.wind.g.gain.value, hum: amb.hum.g.gain.value, muffle: amb.muffle.frequency.value }; },
};
