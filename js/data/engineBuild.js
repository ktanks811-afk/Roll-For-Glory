// Engine Build: crate motors, internals, blowers, turbos, nitrous, headers
// and the tune, built up at any mechanic shop and swapped into the car
// you're driving. calcBuild() is the shop's dyno sheet; swapModel() turns a
// car's factory figures into the swapped car the sim drives (state.modelOf).

import { regear } from './cars.js';

// Crate motors. Factory-blown motors carry their blower and its boost as
// `factory`. limit = horsepower the stock internals hold; kg = dressed motor.
export const ENGINES = {
  ls3: { label: 'LS3 6.2', maker: 'Chevrolet Performance', engine: '6.2L LS3 V8', hp: 430, red: 6600, price: 8995, limit: 650, kg: 210, note: 'The classic swap motor. Cheap, light and takes boost well.' },
  ls7: { label: 'LS7 7.0', maker: 'Chevrolet Performance', engine: '7.0L LS7 V8', hp: 505, red: 7000, price: 17500, limit: 700, kg: 208, note: 'Titanium rods, dry sump, revs to 7,000.' },
  lt4: { label: 'LT4 6.2 SC', maker: 'Chevrolet Performance', engine: '6.2L LT4 Supercharged V8', hp: 650, red: 6500, price: 18900, limit: 900, kg: 250, factory: { name: 'Eaton R1740 (factory)', psi: 9.4, levels: [9.4, 12, 14, 16], k: 0.85 }, note: 'ZL1 motor with its blower on top.' },
  coyote: { label: 'Coyote 5.0', maker: 'Ford Performance', engine: '5.0L Coyote V8', hp: 460, red: 7500, price: 9850, limit: 750, kg: 200, note: 'Four cams, high revs, loves a turbo.' },
  godzilla: { label: 'Godzilla 7.3', maker: 'Ford Performance', engine: '7.3L Godzilla V8', hp: 430, red: 5800, price: 8650, limit: 900, kg: 260, note: 'Pushrod truck motor. Low revs, huge torque, tough block.' },
  hemi: { label: '392 HEMI', maker: 'Mopar', engine: '6.4L 392 HEMI V8', hp: 485, red: 6400, price: 9950, limit: 750, kg: 255, note: 'Scat Pack motor.' },
  hellcat: { label: 'Hellcat 6.2 SC', maker: 'Mopar', engine: '6.2L Supercharged HEMI V8', hp: 707, red: 6200, price: 21000, limit: 1000, kg: 280, factory: { name: 'IHI 2.4L (factory)', psi: 11.6, levels: [11.6, 14, 17, 20], k: 1 }, note: 'Hellcat crate motor with the factory blower.' },
  bbc: { label: '454 big block', maker: 'Chevrolet Performance', engine: '7.4L 454 V8', hp: 438, red: 5800, price: 11900, limit: 700, kg: 310, note: 'Old-school big block. Heavy, loud, all torque.' },
};

// Inside the motor. lim = horsepower that part holds (none = the motor's
// stock limit); k = power it adds; stroke = extra displacement.
export const INSIDE = {
  piston: { label: 'Pistons', opts: [
    { key: 'stock', name: 'Stock cast', price: 0 },
    { key: 'wiseco', name: 'Wiseco forged', price: 950, k: 0.01, lim: 1100 },
    { key: 'mahle', name: 'Mahle PowerPak', price: 1100, k: 0.01, lim: 1150 },
    { key: 'je', name: 'JE Ultra', price: 1250, k: 0.015, lim: 1300 },
    { key: 'diamond', name: 'Diamond Racing', price: 1650, k: 0.02, lim: 1600 },
  ] },
  rod: { label: 'Rods', opts: [
    { key: 'stock', name: 'Stock powdered metal', price: 0 },
    { key: 'eagle', name: 'Eagle H-beam', price: 650, lim: 1000 },
    { key: 'manley', name: 'Manley H-beam', price: 950, lim: 1300 },
    { key: 'callies', name: 'Callies Ultra', price: 1500, lim: 1600 },
    { key: 'carrillo', name: 'Carrillo', price: 2400, lim: 2000 },
  ] },
  crank: { label: 'Crank', opts: [
    { key: 'stock', name: 'Stock', price: 0 },
    { key: 'scat', name: 'Scat 4340 forged', price: 1100, lim: 1200 },
    { key: 'eagle', name: 'Eagle 4340 stroker', price: 1300, lim: 1200, stroke: 0.07 },
    { key: 'callies', name: 'Callies Dragonfly stroker', price: 2200, lim: 1600, stroke: 0.08 },
    { key: 'bryant', name: 'Bryant billet', price: 4500, lim: 2500, k: 0.02 },
  ] },
  cam: { label: 'Cam', opts: [
    { key: 'stock', name: 'Stock', price: 0 },
    { key: 'comp', name: 'COMP Cams Stage 2', price: 780, k: 0.08 },
    { key: 'tsp', name: 'Texas Speed Torquer V3', price: 1400, k: 0.1 },
    { key: 'btr', name: 'Brian Tooley Stage 3', price: 1250, k: 0.11 },
    { key: 'cammotion', name: 'Cam Motion custom grind', price: 1800, k: 0.13 },
  ] },
  head: { label: 'Heads', opts: [
    { key: 'stock', name: 'Stock', price: 0 },
    { key: 'edel', name: 'Edelbrock Victor CNC', price: 3100, k: 0.08 },
    { key: 'tfs', name: 'Trick Flow GenX', price: 3300, k: 0.09 },
    { key: 'afr', name: 'AFR Mongoose', price: 3600, k: 0.1 },
    { key: 'mast', name: 'Mast Black Label', price: 4200, k: 0.12 },
  ] },
};
export const SLOTS = ['piston', 'rod', 'crank', 'cam', 'head'];

// Power adders. levels = boost in psi (nitrous: the shot in hp); eff = how
// much of each atmosphere of boost turns into power.
export const POWER = {
  na: { label: 'Naturally aspirated', type: 'na', price: 0, note: 'No blower, no turbo. Throttle response and a clean idle.' },
  factory: { label: 'Factory blower', type: 'screw', price: 0, note: 'The supercharger the motor came with. Turn it up with smaller pulleys.' },
  whipple30: { label: 'Whipple 3.0L', type: 'screw', price: 9500, levels: [8, 12, 15, 18], eff: 0.85, note: 'Twin-screw on top of the motor. Instant boost off idle.' },
  whipple38: { label: 'Whipple 3.8L', type: 'screw', price: 11200, levels: [10, 14, 18, 22], eff: 0.87, note: 'The biggest Whipple. Moves enough air for 1,000+ hp.' },
  magnuson: { label: 'Magnuson TVS2650', type: 'screw', price: 7800, levels: [7, 10, 13, 16], eff: 0.82, note: 'Eaton TVS rotors, bolt-on, emissions-friendly.' },
  eforce: { label: 'Edelbrock E-Force', type: 'screw', price: 7200, levels: [6, 9, 12, 14], eff: 0.8, note: 'Polished Eaton TVS kit, good street manners.' },
  blower: { label: 'Littlefield 8-71 blower', type: 'roots', price: 9200, levels: [10, 14, 18, 24], eff: 0.72, note: 'Old-school roots blower with a bug-catcher scoop through the hood.' },
  vortech: { label: 'Vortech V-3 Si', type: 'cent', price: 6800, levels: [8, 12, 15, 18], eff: 0.88, note: 'Centrifugal. Boost climbs with rpm and it whistles.' },
  d1x: { label: 'ProCharger D-1X', type: 'cent', price: 7900, levels: [10, 14, 18, 22], eff: 0.9, note: 'Centrifugal head unit on the front of the motor, loud whine up top.' },
  f1x: { label: 'ProCharger F-1X-12', type: 'cent', price: 12200, levels: [16, 22, 28, 34], eff: 0.92, note: 'Race ProCharger. Needs a built bottom end and E85 or race gas.' },
  se: { label: 'Speed Engineering single turbo', type: 'turbo1', price: 6050, levels: [8, 14, 20, 28], eff: 0.95, spool: 3300, big: 1, note: 'Single turbo kit with a Precision 7685.' },
  s480: { label: 'BorgWarner S480 single', type: 'turbo1', price: 4800, levels: [10, 18, 26, 34], eff: 0.95, spool: 4200, big: 2, note: 'Big 80 mm single. More lag, more top end.' },
  on3: { label: 'On 3 twin turbo', type: 'turbo2', price: 6300, levels: [8, 14, 20, 26], eff: 0.97, spool: 3000, big: 1, note: 'Twin turbos up front, one per bank.' },
  hellion: { label: 'Hellion twin turbo', type: 'turbo2', price: 9800, levels: [10, 16, 24, 32], eff: 0.97, spool: 3100, big: 2, note: 'Premium twin turbo kit with Garrett G35s.' },
  nitrous: { label: 'Nitrous Express plate', type: 'n2o', price: 1100, levels: [100, 150, 250, 350], note: 'Plate under the throttle body. Hit the nitrous button to spray.' },
};
export const FUELS = {
  p93: { label: '93 pump gas', price: 0, psi: 12, shot: 150 },
  e85: { label: 'E85', price: 1450, psi: 26, shot: 250, k: 0.04, note: 'Aeromotive fuel system + 1050cc injectors' },
  c16: { label: 'C16 race gas', price: 900, psi: 40, shot: 450, k: 0.03, note: 'Fuel cell + race gas' },
};
export const TUNERS = {
  hpt: { label: 'HP Tuners custom tune', price: 650, k: 0.03, knock: 1 },
  term: { label: 'Holley Terminator X Max', price: 1600, k: 0.03, knock: 1 },
  dom: { label: 'Holley Dominator EFI', price: 2900, k: 0.05, knock: 2 },
  haltech: { label: 'Haltech Elite 2500', price: 2600, k: 0.045, knock: 2 },
  ft: { label: 'FuelTech FT600', price: 3200, k: 0.05, knock: 2 },
};
// Long tube headers (blown and NA builds; turbo kits bring their own manifolds).
export const HEADERS = [
  { key: 'stock', name: 'Stock manifolds', price: 0, hp: 0 },
  { key: 'kooks', name: 'Kooks Super Street', price: 1650, hp: 28 },
  { key: 'arh', name: 'American Racing Headers', price: 1750, hp: 29 },
  { key: 'tsp', name: 'Texas Speed & Performance', price: 1350, hp: 26 },
  { key: 'sw', name: 'Stainless Works', price: 1450, hp: 27 },
  { key: 'hooker', name: 'Hooker Super Competition', price: 799, hp: 22 },
  { key: 'bbk', name: 'BBK Long Tubes', price: 1199, hp: 23 },
  { key: 'jba', name: 'JBA Long Tubes', price: 1399, hp: 24 },
  { key: 'dougs', name: "Doug's Headers", price: 899, hp: 22 },
  { key: 'hedman', name: 'Hedman Hedders', price: 549, hp: 18 },
  { key: 'se', name: 'Speed Engineering', price: 649, hp: 21 },
  { key: 'flowtech', name: 'Flowtech Long Tubes', price: 399, hp: 16 },
  { key: 'schoenfeld', name: 'Schoenfeld stepped race', price: 2895, hp: 38 },
];
export const PIPES = {
  catx: { label: 'Catted X-pipe', price: 699, hp: 0 },
  hpipe: { label: 'Catted H-pipe', price: 649, hp: 2 },
  xpipe: { label: 'Catless X-pipe', price: 399, hp: 9 },
  straight: { label: 'Off-road straights', price: 249, hp: 12 },
};
// Transmission behind the new motor. keep = bolt the factory box up with an adapter.
export const TRANS = {
  keep: { label: 'Keep the factory trans', price: 0 },
  '4AT': { label: '4L80E 4-speed auto', price: 2400 },
  '6AT': { label: '6L80E 6-speed auto', price: 2900 },
  '10AT': { label: '10L90 10-speed auto', price: 4800 },
  '5MT': { label: 'Tremec TKX 5-speed', price: 3400 },
  '6MT': { label: 'Tremec T-56 Magnum 6-speed', price: 3900 },
};

// Swap kits for the cars people actually swap. engKg = the motor that comes out.
const KITS = [
  ['chevrolet', 'Caprice', 240, 'Dirty Dingo LS mounts, Holley harness', 2400, 30],
  ['chevrolet', 'Impala', 230, 'Holley swap mounts, harness', 2200, 28],
  ['chevrolet', 'Chevelle', 310, 'Holley mid-mount brackets, harness', 3200, 32],
  ['chevrolet', 'Camaro', 215, 'Factory-style mounts, Holley harness', 1600, 18],
  ['chevrolet', 'Silverado 1500', 230, 'Factory mounts, harness', 1800, 20],
  ['ford', 'Mustang', 210, 'ICT Billet mounts, harness', 2600, 26],
  ['ford', 'Crown Victoria', 230, 'Swap mounts, harness', 2600, 30],
  ['nissan', '240SX', 150, 'Sikky swap kit, harness', 4200, 40],
  ['nissan', '350Z', 170, 'Sikky swap kit, harness, adapter', 3900, 36],
  ['mazda', 'MX-5 Miata', 130, 'V8 Roadsters kit, rear end', 7200, 50],
  ['toyota', 'Supra', 230, 'Swap mounts, harness', 4600, 40],
];
const LABOR = 125;   // $/hr shop labor

const outKg = e => /V12|W1[26]/.test(e) ? 280 : /V10/.test(e) ? 250 : /V8/.test(e) ? 230 : /I6/.test(e) ? 210 : /V6|Flat-6/.test(e) ? 175 : 140;

// Can this car take a V8 swap, and what does the shop charge for the kit?
export function swapKit(m) {
  if (!m) return { ok: false, why: 'No car.' };
  if (m.asp === 'ev') return { ok: false, why: 'Electric: there\'s no motor bay to put a V8 in.' };
  if (m.rig) return { ok: false, why: 'Big rigs run diesels. Bring a car or a pickup.' };
  if (m.drive !== 'RWD') return { ok: false, why: `It's ${m.drive}. These crate V8s sit long-ways and drive the rear wheels, so bring a rear-wheel-drive car or truck.` };
  const k = KITS.find(([make, model]) => m.make === make && m.model === model);
  if (k) return { ok: true, kit: k[3], price: k[4], hours: k[5], outKg: k[2] };
  const v8 = /V8/.test(m.engine || '');
  return v8
    ? { ok: true, kit: 'Swap motor mounts, wiring harness, fuel lines', price: 2400, hours: 24, outKg: outKg(m.engine) }
    : { ok: true, kit: 'Custom mounts, harness, driveshaft, radiator', price: 5200, hours: 40, outKg: outKg(m.engine || '') };
}

export function defaultBuild() {
  return { eng: 'ls3', piston: 'stock', rod: 'stock', crank: 'stock', cam: 'stock', head: 'stock', pow: 'na', lvl: 0, fuel: 'p93', tuner: 'hpt', hdr: 'kooks', pipe: 'catx', trans: 'keep' };
}
// Fill in anything missing and drop choices that don't fit the motor.
export function fixBuild(b) {
  const d = defaultBuild();
  b = { ...d, ...(b || {}) };
  if (!ENGINES[b.eng]) b.eng = d.eng;
  for (const sl of SLOTS) if (!INSIDE[sl].opts.some(o => o.key === b[sl])) b[sl] = 'stock';
  if (!POWER[b.pow] || (b.pow === 'factory' && !ENGINES[b.eng].factory)) b.pow = ENGINES[b.eng].factory ? 'factory' : 'na';
  if (b.pow === 'na' && ENGINES[b.eng].factory) b.pow = 'factory';   // a factory-blown motor keeps a blower
  const P = powerDef(b);
  b.lvl = P.levels ? Math.max(0, Math.min(P.levels.length - 1, b.lvl | 0)) : 0;
  if (!FUELS[b.fuel]) b.fuel = d.fuel;
  if (!TUNERS[b.tuner]) b.tuner = d.tuner;
  if (!HEADERS.some(h => h.key === b.hdr)) b.hdr = d.hdr;
  if (!PIPES[b.pipe]) b.pipe = d.pipe;
  if (!TRANS[b.trans]) b.trans = 'keep';
  return b;
}

export const partOf = (b, slot) => INSIDE[slot].opts.find(o => o.key === b[slot]) || INSIDE[slot].opts[0];
export const headerOf = b => HEADERS.find(h => h.key === b.hdr) || HEADERS[0];
// Power adder in use, with the factory blower filled in from the motor.
export function powerDef(b) {
  const E = ENGINES[b.eng];
  if (b.pow === 'factory' && E.factory) { const F = E.factory; return { ...POWER.factory, label: F.name, levels: F.levels, eff: 0.8, factory: true }; }
  return POWER[b.pow] || POWER.na;
}
export const isTurbo = b => /turbo/.test(powerDef(b).type);

// The dyno sheet: torque and power from 2,000 rpm to the redline, what the
// bottom end holds and whether it detonates. withShot = spraying.
export function calcBuild(b, { withShot = true } = {}) {
  b = fixBuild(b);
  const E = ENGINES[b.eng], P = powerDef(b), F = FUELS[b.fuel], T = TUNERS[b.tuner];
  const red = E.red, I = SLOTS.map(sl => partOf(b, sl));
  const k = I.reduce((a, o) => a + (o.k || 0), 0), stroke = partOf(b, 'crank').stroke || 0;
  const turbo = /turbo/.test(P.type), boosted = P.type !== 'na' && P.type !== 'n2o';
  let na = (E.factory ? E.hp / (1 + E.factory.psi / 14.7 * 0.8) : E.hp) * (1 + k) * (1 + stroke);
  if (!turbo) na += (headerOf(b).hp + PIPES[b.pipe].hp) * na / 450;
  else na += PIPES[b.pipe].hp * na / 450 + 12;
  const psi = boosted ? P.levels[b.lvl] : 0, shotSize = P.type === 'n2o' ? P.levels[b.lvl] : 0;
  const shot = withShot ? shotSize : 0;
  const g = r => Math.max(0.3, 1 - 0.9 * Math.pow((r - 0.6 * red) / red, 2));
  let mx = 0; for (let r = 1500; r <= red; r += 100) mx = Math.max(mx, g(r) * r);
  const S = na * 5252 / mx, eff = P.eff || 0.8;
  const boostAt = r => {
    if (!boosted) return 0;
    if (P.type === 'cent') return psi * Math.pow(r / red, 2);
    if (turbo) return psi / (1 + Math.exp(-(r - P.spool) / 330));
    return psi * Math.min(1, 0.78 + 0.22 * r / red);
  };
  const fuelK = (boosted || shotSize ? (F.k || 0) : (F.k || 0) * 0.5) + T.k;
  const rpm = [], hp = [], tq = [];
  for (let r = 2000; r <= red; r += 100) {
    let t = S * g(r) * (1 + boostAt(r) / 14.7 * eff) * (1 + fuelK);
    if (shot && r >= 3000) t += shot * 5252 / r * Math.min(1, (r - 3000) / 400);
    rpm.push(r); tq.push(t); hp.push(t * r / 5252);
  }
  const ih = hp.indexOf(Math.max(...hp)), it = tq.indexOf(Math.max(...tq));
  const lim = Math.min(...['piston', 'rod', 'crank'].map(sl => partOf(b, sl).lim || E.limit));
  const fuelPsi = F.psi + T.knock, fuelShot = F.shot + T.knock * 25;
  const det = (psi && psi > fuelPsi) || (shotSize && shotSize > fuelShot);
  const blowAt = det ? Math.round(red * 0.72 / 100) * 100 : hp[ih] > lim ? rpm[hp.findIndex(h => h > lim)] : null;
  const asp = turbo ? 'turbo' : boosted ? 'sc' : 'na';
  return { b, E, P, F, T, rpm, hp, tq, red, peakHp: hp[ih], hpRpm: rpm[ih], peakTq: tq[it], tqRpm: rpm[it], psi, shot: shotSize, lim, det, fuelPsi, fuelShot, blowAt, asp, kg: E.kg + (boosted ? (turbo ? 25 : 30) : 0) + (shotSize ? 14 : 0) };
}

// What the shop charges: parts, then the swap kit, trans and labor.
export function buildCost(b, m, rate = 1) {
  b = fixBuild(b);
  const E = ENGINES[b.eng], P = powerDef(b);
  const items = [[E.label + ' crate motor', E.price]];
  SLOTS.forEach(sl => { const o = partOf(b, sl); if (o.price) items.push([o.name + ' ' + INSIDE[sl].label.toLowerCase(), o.price]); });
  if (P.price) items.push([P.label, P.price]);
  if (!isTurbo(b) && headerOf(b).price) items.push([headerOf(b).name + ' headers', headerOf(b).price]);
  items.push([PIPES[b.pipe].label, PIPES[b.pipe].price]);
  items.push([TUNERS[b.tuner].label, TUNERS[b.tuner].price]);
  if (FUELS[b.fuel].price) items.push([FUELS[b.fuel].note, FUELS[b.fuel].price]);
  const kit = swapKit(m);
  if (kit.ok) {
    items.push(['Swap kit: ' + kit.kit, kit.price]);
    if (TRANS[b.trans].price) items.push([TRANS[b.trans].label, TRANS[b.trans].price]);
    items.push([`Labor, ${kit.hours} hrs`, kit.hours * LABOR]);
  }
  const out = items.map(([name, price]) => [name, Math.round(price * rate / 5) * 5]);
  return { items: out, total: out.reduce((a, [, p]) => a + p, 0), hours: kit.ok ? kit.hours : 0 };
}
// Pulling a swap back out for the factory motor: labor only.
export const unswapCost = (m, rate = 1) => Math.round((swapKit(m).hours || 24) * LABOR * 0.6 * rate / 5) * 5;

// What gets saved on the car: the build, plus the figures the sim needs.
export function swapRecord(b, m) {
  const c = calcBuild(b), dry = calcBuild(b, { withShot: false }), kit = swapKit(m);
  const type = c.P.type;
  return {
    build: c.b, label: c.E.label, engine: c.E.engine + (c.P.factory || type === 'na' ? '' : type === 'n2o' ? ' + nitrous' : /turbo/.test(type) ? (type === 'turbo2' ? ' twin turbo' : ' turbo') : ' supercharged'),
    hp: Math.round(dry.peakHp), tq: Math.round(dry.peakTq), tqRpm: dry.tqRpm, red: c.red, asp: c.asp, shot: c.shot, lim: c.lim,
    blower: type === 'roots' ? 'roots' : type === 'screw' || type === 'cent' ? 'screw' : null, big: c.P.big || 0,
    kgDelta: c.kg - (kit.outKg || 230), trans: c.b.trans === 'keep' ? null : c.b.trans, from: m.engine,
  };
}

// The car the sim drives once the swap is in: new power, weight, redline,
// gearing (final drive re-picked for the new top speed) and engine name.
export function swapModel(base, sw) {
  const m = regear(base, { hp: sw.hp, kg: base.kg + sw.kgDelta, redline: sw.red, asp: sw.asp, trans: sw.trans || base.transCode });
  return {
    ...m, tq: sw.tq, engine: sw.engine, peakTqRpm: sw.tqRpm, lim: null,
    wf: Math.min(0.62, (base.wf ?? 0.53) + sw.kgDelta / m.kg * 0.6),
    swap: sw,
  };
}
