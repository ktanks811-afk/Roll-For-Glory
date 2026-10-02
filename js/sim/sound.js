// What each car should sound like, worked out from its engine and its parts.
//
// An engine's note is set by its firing pattern. A 4-stroke engine repeats
// every two crank turns, so the sound is built on a fundamental of rpm/120 Hz
// (harmonic k = engine order k/2). An evenly-firing n-cylinder engine puts
// its energy on harmonics n, 2n, 3n… (n/2 pulses per crank turn). Unevenly
// firing engines leak energy onto the in-between harmonics — that leakage IS
// the character: the cross-plane V8 "potato-potato" lope, the Subaru boxer
// rumble, a three-cylinder's shake. Flat-plane V8s fire evenly, so they are
// smooth and scream instead of burble.
//
// Researched from engine layouts (crank plane, firing order, header design)
// rather than recordings; the numbers below are tuned by ear-and-physics, not
// sampled. Everything is synthesized, no audio files.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// kind → how it fires. n = cylinders firing per 2 crank turns (rotary: 4, two
// rotors); slope = how fast the harmonics fall off (small = bright/shrieky);
// leak = extra energy on non-firing harmonics (the rumble); grit = raspiness.
const KINDS = {
  i3:      { n: 3,  slope: 1.05, leak: { 1: 0.20, 2: 0.14 }, grit: 0.25, label: 'inline-3' },
  i4:      { n: 4,  slope: 0.90, leak: { 2: 0.10 },           grit: 0.30, label: 'inline-4' },
  i5:      { n: 5,  slope: 0.95, leak: { 1: 0.10, 2: 0.16, 3: 0.10 }, grit: 0.30, label: 'inline-5' },
  i6:      { n: 6,  slope: 1.30, leak: {},                    grit: 0.15, label: 'inline-6' },
  v6:      { n: 6,  slope: 1.00, leak: { 2: 0.12, 4: 0.10 },  grit: 0.30, label: 'V6' },
  v6odd:   { n: 6,  slope: 1.00, leak: { 1: 0.18, 2: 0.34, 4: 0.22 }, grit: 0.35, label: 'odd-fire V6' },
  flat4eq: { n: 4,  slope: 0.95, leak: { 2: 0.20, 6: 0.10 },  grit: 0.30, label: 'boxer-4 (equal-length headers)' },
  flat4:   { n: 4,  slope: 0.95, leak: { 1: 0.30, 2: 0.55, 6: 0.28 }, grit: 0.35, label: 'boxer-4 (unequal-length headers)' },
  flat6:   { n: 6,  slope: 0.85, leak: { 2: 0.08 },           grit: 0.40, label: 'flat-6' },
  v8x:     { n: 8,  slope: 1.00, leak: { 2: 0.42, 4: 0.55, 6: 0.30, 12: 0.30 }, grit: 0.35, label: 'cross-plane V8' },
  v8f:     { n: 8,  slope: 0.65, leak: { 4: 0.12 },           grit: 0.45, label: 'flat-plane V8' },
  v10:     { n: 10, slope: 0.62, leak: { 2: 0.05 },           grit: 0.45, label: 'V10' },
  v12:     { n: 12, slope: 0.70, leak: {},                    grit: 0.35, label: 'V12' },
  w12:     { n: 12, slope: 1.00, leak: { 4: 0.12 },           grit: 0.25, label: 'W12' },
  w16:     { n: 16, slope: 1.05, leak: { 8: 0.10 },           grit: 0.25, label: 'W16' },
  rotary:  { n: 4,  slope: 0.42, leak: { 2: 0.25 },           grit: 0.80, label: 'rotary' },
  ev:      { n: 0,  slope: 1,    leak: {},                    grit: 0,    label: 'electric' },
};

// Ferrari/McLaren/Koenigsegg/Maserati V8s and GM's LT6 / AMG GT use flat-plane cranks.
const FLAT_PLANE_V8 = m => /Flat-Plane/i.test(m.engine) || (/V8/.test(m.engine) && ['ferrari', 'mclaren', 'koenigsegg', 'maserati'].includes(m.make));

export function engineKind(m) {
  const e = m.engine || '';
  if (m.asp === 'ev' || /Electric/i.test(e)) return 'ev';
  if (/Rotary/i.test(e)) return 'rotary';
  if (/W16/.test(e)) return 'w16';
  if (/W12/.test(e)) return 'w12';
  if (/V12/.test(e)) return 'v12';
  if (/V10/.test(e)) return 'v10';
  if (/V8/.test(e)) return FLAT_PLANE_V8(m) ? 'v8f' : 'v8x';
  if (/Flat-6/i.test(e)) return 'flat6';
  if (/Flat-4/i.test(e)) return /FA20|FA24/.test(e) ? 'flat4eq' : 'flat4';   // EJ-era Subarus have unequal-length headers
  if (/I6/.test(e)) return 'i6';
  if (/V6/.test(e)) return /Grand National|SFI Turbo|4\.3L/.test(e + ' ' + m.model) || /Syclone|Grand National/.test(m.model) ? 'v6odd' : 'v6';   // GM/Buick 90° V6s fire unevenly: the lumpy idle
  if (/I5/.test(e)) return 'i5';
  if (/I3/.test(e)) return 'i3';
  return 'i4';
}

// Where Honda's VTEC (and Toyota's VVTL-i) change cams, and the sound changes.
// Researched crossover points: B16A2 ~5300, B18C1 ~4400, B18C5 ~5600, K20A2
// ~5800, F20C/F22C ~6000, H22A ~5200, 2ZZ-GE ~6200.
export function vtecRpm(m) {
  const e = m.engine || '';
  if (/B16A|SOHC VTEC/.test(e)) return 5300;
  if (/B18C1/.test(e)) return 4400;
  if (/B18C5/.test(e)) return 5600;
  if (/K20A2/.test(e)) return 5800;
  if (/F22C|F20C/.test(e)) return 6000;
  if (/H22A/.test(e)) return 5200;
  if (/2ZZ/.test(e)) return 6200;
  return 0;
}

// Big-cammed American V8s and the rotary idle rougher than everything else.
const lopey = m => /LS7|LS6|Windsor|HEMI|392|Predator/.test(m.engine || '');

// Exhaust stage 0-4: stock muffler → cat-back → headers/axle-back → race →
// straight pipe. Louder, brighter, raspier, and from stage 2 it burbles on
// the overrun.
const EXH = {
  cut:   [0.65, 0.85, 1.0, 1.25, 1.55],   // how open the tone is (lowpass scale)
  gain:  [1.00, 1.12, 1.25, 1.40, 1.60],
  drive: [0.00, 0.12, 0.30, 0.55, 0.85],   // grit from the waveshaper
  burble:[0.00, 0.00, 0.25, 0.55, 0.85],   // chance of overrun pops per lift
};

export function soundProfile(m, lv = {}) {
  const kind = engineKind(m);
  const k = KINDS[kind];
  const ex = clamp(lv.exhaust || 0, 0, 4);
  const turbo = m.asp === 'turbo' || lv.turbo > 0;
  const blower = (m.asp === 'sc' || lv.supercharger > 0) && !(lv.turbo > 0);
  const base = 0.4 + clamp((m.hp - 150) / 1500, 0, 0.35);       // fast cars are louder
  const tuned = (lv.ecu || 0) >= 2 || (lv.exhaust || 0) >= 2;
  return {
    kind, label: k.label, n: k.n, slope: k.slope, leak: k.leak,
    grit: clamp(k.grit + EXH.drive[ex] * 0.6, 0, 1.2),
    cut: EXH.cut[ex], drive: EXH.drive[ex], exhaust: ex,
    loud: clamp(base * EXH.gain[ex], 0.25, 1.1),
    turbo, twinCharged: turbo && (m.asp === 'sc' || /Twincharged/.test(m.engine || '')),
    turboBig: lv.turbo || 0,
    blower,
    // Eaton roots: Predator, LT4, Jaguar/Land Rover 5.0, Audi 3.0, Emira. Twin-screw (higher, thinner whine): Hellcat family, Mercedes.
    blowerKind: blower ? (/Supercharged HEMI/.test(m.engine || '') || m.make === 'mercedes' ? 'screw' : 'roots') : null,
    intake: lv.intake || 0,
    vtec: vtecRpm(m),
    lope: lopey(m) || kind === 'rotary' ? 1 : 0,
    burble: clamp(EXH.burble[ex] + (tuned ? 0.1 : 0) + (kind === 'v8x' ? 0.15 : 0), 0, 0.95),
    // pulses per crank turn → fundamental used by the synth
    redline: m.redline,
  };
}

// Harmonic amplitudes for the synth's periodic wave. Index = harmonic number
// of rpm/120 Hz. Deterministic phases so the same car always sounds the same.
export function harmonics(p, count = 96) {
  const a = new Float32Array(count + 1);
  if (!p.n) return a;
  for (let m = 1; p.n * m <= count; m++) a[p.n * m] = Math.pow(m, -p.slope);
  for (const [k, amp] of Object.entries(p.leak)) {
    const kk = +k;
    for (let m = 1; kk * m <= count; m++) if (!a[kk * m]) a[kk * m] = amp * Math.pow(m, -p.slope - 0.25);
  }
  // a touch of grit: extra upper harmonics fill in the top end
  for (let k = 1; k <= count; k++) a[k] += p.grit * 0.035 / Math.sqrt(k);
  return a;
}

// The dominant pitch of the car at a given rpm, in Hz (for tests and the dyno).
export function firingHz(p, rpm) { return p.n * rpm / 120; }
