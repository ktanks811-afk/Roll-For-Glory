// Performance categories and what each stage does in the simulation.
// Actual products (brands, prices) live in catalog.js; each product has a
// `stage` 1-4 that maps onto these effects.

import { ITEM_BY_ID } from './catalog.js';

export const STAGE_NAMES = ['Stock', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4'];

export const PERF = [
  { id: 'engine', name: 'Engine Internals', group: 'Engine' },
  { id: 'turbo', name: 'Turbo', group: 'Forced Induction' },
  { id: 'supercharger', name: 'Supercharger', group: 'Forced Induction' },
  { id: 'intake', name: 'Intake', group: 'Engine' },
  { id: 'exhaust', name: 'Exhaust', group: 'Engine' },
  { id: 'intercooler', name: 'Intercooler', group: 'Forced Induction' },
  { id: 'fuel', name: 'Fuel System', group: 'Engine' },
  { id: 'ecu', name: 'Tune / ECU', group: 'Engine' },
  { id: 'transmission', name: 'Transmission', group: 'Drivetrain' },
  { id: 'clutch', name: 'Clutch', group: 'Drivetrain' },
  { id: 'diff', name: 'Differential', group: 'Drivetrain' },
  { id: 'suspension', name: 'Suspension', group: 'Chassis' },
  { id: 'brakes', name: 'Brakes', group: 'Chassis' },
  { id: 'tires', name: 'Tires', group: 'Chassis' },
  { id: 'weight', name: 'Weight Reduction', group: 'Chassis' },
  { id: 'nitrous', name: 'Nitrous', group: 'Power Adders' },
];
export const PERF_IDS = PERF.map(p => p.id);
export const PERF_BY_ID = Object.fromEntries(PERF.map(p => [p.id, p]));

// Multipliers / values per stage. Read by sim/powertrain.js.
export const FX = {
  engine:       { hp: [1, 1.07, 1.15, 1.25, 1.38], redline: [0, 200, 400, 700, 1000] },
  turboKit:     { hp: [1, 1.28, 1.45, 1.66, 1.95] },     // NA car gaining a turbo
  turboUp:      { hp: [1, 1.12, 1.25, 1.42, 1.62] },     // factory turbo upgraded
  scKit:        { hp: [1, 1.24, 1.40, 1.58, 1.82] },
  scUp:         { hp: [1, 1.10, 1.22, 1.36, 1.52] },
  intake:       { hp: [1, 1.025, 1.045, 1.065, 1.085] },
  exhaust:      { hp: [1, 1.03, 1.05, 1.07, 1.10] },
  intercooler:  { hp: [1, 1.03, 1.055, 1.08, 1.10] },
  fuel:         { cap: [1.35, 1.6, 1.95, 2.5, 3.6] },
  ecu:          { hp: [1, 1.04, 1.07, 1.10, 1.14], redline: [0, 100, 200, 300, 450] },
  transmission: { shift: [0.42, 0.32, 0.22, 0.12, 0.05] },
  clutch:       { cap: [1.25, 1.55, 2.0, 2.8, 4.2] },
  diff:         { trac: [1, 1.05, 1.09, 1.14, 1.18] },
  suspension:   { trac: [1, 1.02, 1.04, 1.07, 1.09], handling: [1, 1.08, 1.16, 1.24, 1.32], drop: [0, 0.025, 0.045, 0.06, 0.07] },
  brakes:       { force: [1, 1.12, 1.28, 1.45, 1.6] },
  tires:        { mu: [1, 1.08, 1.17, 1.32, 1.45], width: [0, 0.02, 0.04, 0.07, 0.09] },
  weight:       { mult: [1, 0.965, 0.93, 0.89, 0.85] },
  nitrous:      { hp: [0, 50, 100, 175, 250], secs: [0, 7, 7, 8, 9] },
};

export const NITROUS_REFILL = 65; // 10 lb bottle fill

export const PAINT_SWATCHES = [
  '#0d0d0d', '#f2f2f2', '#8c9196', '#3d4452', '#c41b1b', '#7a1414', '#e8641a', '#e8c21a',
  '#1f8f3a', '#0f6b4f', '#1b4fc4', '#0b1f4d', '#6b2bd1', '#d12a8a', '#13b3c4', '#c8b98a',
];
export const WHEEL_COLORS = ['#c0c4c8', '#1a1a1a', '#5b5f66', '#c9a24a', '#c41b1b', '#f2f2f2', '#2a6bd1'];
export const CALIPER_COLORS = ['#3a3a3a', '#3a3a3a', '#c41b1b', '#e8c21a', '#e8641a'];

export function defaultVisual(model) {
  return {
    paint: model.color, finish: 'gloss', wheels: 'steel', wheelColor: '#9aa0a8',
    tint: 'none', kit: 'stock', frontBumper: 'stock', rearBumper: 'stock', skirts: 'none',
    spoiler: 'none', hood: 'stock', exhaustTips: 'single', headlights: 'halogen', taillights: 'stock',
    decal: 'none', decalColor: '#f2f2f2', plate: randomPlate(), neon: 'none', interior: '#111111',
  };
}

export function randomPlate() {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const r = () => L[Math.floor(Math.random() * L.length)];
  return `${Math.floor(1 + Math.random() * 9)}${r()}${r()}${r()}${Math.floor(100 + Math.random() * 900)}`;
}

// car.parts holds either catalog product ids (player cars) or plain stage
// numbers (NPC builds). Either way, this gives the sim its stage map.
export function partLevels(parts = {}) {
  const out = {};
  for (const id of PERF_IDS) {
    const v = parts[id];
    out[id] = typeof v === 'number' ? v : v ? (ITEM_BY_ID[v]?.stage || 0) : 0;
  }
  return out;
}

export function partLabel(parts, catId) {
  const v = parts?.[catId];
  if (!v) return 'Stock';
  if (typeof v === 'number') return STAGE_NAMES[v];
  const it = ITEM_BY_ID[v];
  return it ? `${it.brand} ${it.name}` : 'Stock';
}
