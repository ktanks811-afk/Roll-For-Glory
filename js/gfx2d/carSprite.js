// Top-down car sprites, drawn procedurally and cached. Every visual mod —
// paint finish, wheels, tint, aero, hood, lights, graphics, widebody,
// damage — changes the drawing. Sprites face up (north); length runs along y.

import { CALIPER_COLORS } from '../data/parts.js';

export const SPRITE_PX = 12; // pixels per metre in the cached sprite

export const DIMS = {
  hatch:  { L: 4.1,  W: 1.76, cab: [0.24, 0.36, 0.78, 0.9] },
  sedan:  { L: 4.85, W: 1.85, cab: [0.28, 0.4, 0.66, 0.76] },
  coupe:  { L: 4.45, W: 1.8,  cab: [0.32, 0.44, 0.66, 0.78] },
  muscle: { L: 4.75, W: 1.92, cab: [0.36, 0.48, 0.68, 0.78] },
  truck:  { L: 5.6,  W: 2.0,  cab: [0.3, 0.38, 0.55, 0.58] },
  suv:    { L: 4.9,  W: 1.95, cab: [0.24, 0.34, 0.86, 0.93] },
  exotic: { L: 4.55, W: 1.9,  cab: [0.38, 0.5, 0.68, 0.78] },
  super:  { L: 4.5,  W: 1.98, cab: [0.26, 0.4, 0.58, 0.72] },
  wagon:  { L: 4.8,  W: 1.84, cab: [0.27, 0.38, 0.88, 0.95] },
};

const TINT = { none: 0.45, light: 0.62, medium: 0.78, limo: 0.92 };
const HEAD = { halogen: '#fff1c9', xenon: '#dfe9ff', led: '#ffffff', yellow: '#ffd23a' };

function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

function rrect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y); g.lineTo(x + w - rr, y); g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr); g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr); g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

// Body outline with a tapered nose for sporty shapes.
function bodyPath(g, style, L, W) {
  const taper = { super: 0.16, exotic: 0.12, coupe: 0.08, muscle: 0.05, hatch: 0.04, sedan: 0.05, wagon: 0.04, suv: 0.02, truck: 0.02 }[style] * W;
  const rF = { super: 0.6, exotic: 0.5, coupe: 0.45, hatch: 0.35, sedan: 0.35, wagon: 0.3, muscle: 0.25, suv: 0.25, truck: 0.18 }[style] * W * 0.5;
  const rR = rF * 0.7;
  const x0 = -W / 2, x1 = W / 2, y0 = -L / 2, y1 = L / 2;
  g.beginPath();
  g.moveTo(x0 + taper + rF, y0);
  g.lineTo(x1 - taper - rF, y0);
  g.quadraticCurveTo(x1 - taper, y0, x1 - taper * 0.3, y0 + rF);
  g.lineTo(x1, y0 + L * 0.22);
  g.lineTo(x1, y1 - rR);
  g.quadraticCurveTo(x1, y1, x1 - rR, y1);
  g.lineTo(x0 + rR, y1);
  g.quadraticCurveTo(x0, y1, x0, y1 - rR);
  g.lineTo(x0, y0 + L * 0.22);
  g.lineTo(x0 + taper * 0.3, y0 + rF);
  g.quadraticCurveTo(x0 + taper, y0, x0 + taper + rF, y0);
  g.closePath();
}

function paintFill(g, color, finish, W) {
  if (finish === 'chrome') {
    const gr = g.createLinearGradient(-W / 2, 0, W / 2, 0);
    gr.addColorStop(0, shade(color, -0.3)); gr.addColorStop(0.3, shade(color, 0.75)); gr.addColorStop(0.5, shade(color, 0.2));
    gr.addColorStop(0.7, shade(color, 0.8)); gr.addColorStop(1, shade(color, -0.35));
    return gr;
  }
  const gr = g.createLinearGradient(-W / 2, 0, W / 2, 0);
  const hi = finish === 'matte' ? 0.06 : finish === 'metallic' ? 0.32 : finish === 'pearl' ? 0.38 : 0.2;
  const lo = finish === 'matte' ? -0.08 : -0.3;
  gr.addColorStop(0, shade(color, lo));
  gr.addColorStop(0.35, shade(color, hi));
  gr.addColorStop(0.55, color);
  if (finish === 'pearl') gr.addColorStop(0.75, shade(color, 0.15).replace('rgb', 'rgb'));
  gr.addColorStop(1, shade(color, lo * 1.2));
  return gr;
}

const cache = new Map();

export function spriteKey(style, v, lv, cond) {
  const dmg = cond ? [Math.round((cond.body ?? 100) / 25), Math.round((cond.lights ?? 100) / 30), (cond.tires ?? 100) <= 1 ? 1 : 0] : [4, 4, 0];
  return JSON.stringify([style, v, lv && [lv.turbo, lv.supercharger, lv.intercooler, lv.tires, lv.brakes, lv.nitrous, lv.exhaust, lv.weight], dmg]);
}

// v: visual object, lv: performance stage levels, cond: condition (for damage)
export function carSprite(style, v = {}, lv = {}, cond = null, opts = {}) {
  const key = spriteKey(style, v, lv, cond) + (opts.police ? 'P' : '') + (opts.taxi ? 'T' : '');
  if (cache.has(key)) return cache.get(key);
  const d = DIMS[style] || DIMS.sedan;
  const S = SPRITE_PX;
  const wide = v.kit === 'wide';
  const W = d.W + (wide ? 0.16 : 0), L = d.L;
  const pad = 0.7;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W + pad * 2) * S);
  c.height = Math.ceil((L + pad * 2) * S);
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.scale(S, S);

  const paint = v.paint || '#888888';
  const finish = v.finish || 'gloss';
  const y = f => -L / 2 + L * f;           // fraction from the front
  const [hoodEnd, wsEnd, roofEnd, rgEnd] = d.cab;

  // ---- tires (under the body) ----
  const tl = lv.tires || 0;
  const tireW = 0.24 + [0, 0.02, 0.04, 0.07, 0.09][tl] + (wide ? 0.05 : 0);
  const tireL = 0.66;
  const axF = y(0.18), axR = y(0.82);
  const track = W / 2 - tireW / 2 + 0.06;
  for (const ax of [axF, axR]) for (const s of [-1, 1]) {
    const tw = ax === axR && tl >= 3 ? tireW + 0.04 : tireW;
    g.fillStyle = '#0d0d0d';
    rrect(g, s * track - tw / 2, ax - tireL / 2, tw, tireL, 0.06); g.fill();
    // rim lip peeking out
    g.fillStyle = v.wheels === 'steel' ? '#6d7178' : (v.wheelColor || '#c0c4c8');
    g.fillRect(s * (track + tw / 2) - (s > 0 ? 0.05 : 0), ax - tireL * 0.32, 0.05, tireL * 0.64);
    if (tl >= 3) { g.fillStyle = tl === 4 ? '#ffd23a' : '#eeeeee'; g.fillRect(s * (track + tw / 2) - (s > 0 ? 0.08 : -0.03), ax - 0.12, 0.03, 0.24); }
  }

  // ---- body ----
  bodyPath(g, style, L, W - (wide ? 0.16 : 0));
  g.fillStyle = paintFill(g, paint, finish, W);
  g.fill();
  g.lineWidth = 0.04; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.stroke();
  if (wide) {
    g.fillStyle = paintFill(g, paint, finish, W);
    for (const ax of [axF, axR]) for (const s of [-1, 1]) {
      rrect(g, s * (W / 2 - 0.1) - 0.1, ax - 0.55, 0.2, 1.1, 0.1); g.fill(); g.stroke();
    }
  }
  if (opts.police) {
    g.fillStyle = '#0d0d0d';
    g.fillRect(-W / 2 + 0.02, y(hoodEnd), W - 0.04, L * (roofEnd - hoodEnd));
    g.fillStyle = '#f2f2f2';
    g.fillRect(-W / 2 + 0.25, y(wsEnd), W - 0.5, L * (roofEnd - wsEnd));
  }

  // ---- glass + roof ----
  const glass = `rgba(14,20,30,${TINT[v.tint] ?? 0.45 + 0.1})`;
  const gw = W * 0.82;
  // windshield
  g.fillStyle = glass;
  g.beginPath();
  g.moveTo(-gw / 2 + 0.06, y(hoodEnd)); g.lineTo(gw / 2 - 0.06, y(hoodEnd));
  g.lineTo(gw / 2 - 0.16, y(wsEnd)); g.lineTo(-gw / 2 + 0.16, y(wsEnd)); g.closePath(); g.fill();
  // windshield glare
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath(); g.moveTo(-gw / 4, y(hoodEnd) + 0.05); g.lineTo(0, y(hoodEnd) + 0.05); g.lineTo(-gw / 6, y(wsEnd) - 0.05); g.lineTo(-gw / 3, y(wsEnd) - 0.05); g.fill();
  // side windows
  g.fillStyle = glass;
  g.fillRect(-gw / 2 + 0.02, y(wsEnd), 0.12, L * (roofEnd - wsEnd));
  g.fillRect(gw / 2 - 0.14, y(wsEnd), 0.12, L * (roofEnd - wsEnd));
  // roof
  g.fillStyle = opts.police ? '#f2f2f2' : paintFill(g, paint, finish, W);
  rrect(g, -gw / 2 + 0.16, y(wsEnd), gw - 0.32, L * (roofEnd - wsEnd), 0.12); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.03; g.stroke();
  // rear glass
  g.fillStyle = glass;
  g.beginPath();
  g.moveTo(-gw / 2 + 0.16, y(roofEnd)); g.lineTo(gw / 2 - 0.16, y(roofEnd));
  g.lineTo(gw / 2 - 0.08, y(rgEnd)); g.lineTo(-gw / 2 + 0.08, y(rgEnd)); g.closePath(); g.fill();
  // truck bed
  if (style === 'truck') {
    g.fillStyle = '#1b1c1f';
    rrect(g, -W / 2 + 0.14, y(0.6), W - 0.28, L * 0.37, 0.05); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 0.02;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(-W / 2 + 0.2, y(0.6) + i * L * 0.06); g.lineTo(W / 2 - 0.2, y(0.6) + i * L * 0.06); g.stroke(); }
  }
  // mid-engine cover slats
  if (style === 'super') {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = 0; i < 5; i++) g.fillRect(-W * 0.25, y(rgEnd) + 0.08 + i * 0.13, W * 0.5, 0.05);
  }

  // ---- hood ----
  const hoodMid = y(hoodEnd * 0.55);
  const carbonHood = v.hood === 'vented' || (lv.weight || 0) >= 2;
  if (carbonHood) {
    g.fillStyle = '#17181c';
    rrect(g, -W * 0.36, y(0.05), W * 0.72, L * (hoodEnd - 0.07), 0.1); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 0.015;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 0.11, y(0.05)); g.lineTo(i * 0.11 + 0.2, y(hoodEnd - 0.02)); g.stroke(); }
  }
  if (v.hood === 'cowl') { g.fillStyle = shade(paint, 0.15); rrect(g, -0.3, y(0.08), 0.6, L * (hoodEnd - 0.11), 0.08); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke(); }
  if (v.hood === 'scoop') {
    g.fillStyle = shade(paint, 0.12); rrect(g, -0.28, hoodMid - 0.35, 0.56, 0.7, 0.1); g.fill();
    g.fillStyle = '#060606'; g.fillRect(-0.22, hoodMid - 0.35, 0.44, 0.12);
  }
  if (v.hood === 'vented') {
    g.fillStyle = '#050505';
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.fillRect(s * 0.42 - 0.18, hoodMid - 0.3 + i * 0.16, 0.36, 0.06);
  }
  if ((lv.supercharger || 0) >= 3) {
    g.fillStyle = '#c9ccd1'; rrect(g, -0.25, hoodMid - 0.42, 0.5, 0.75, 0.05); g.fill();
    g.fillStyle = '#111'; rrect(g, -0.28, hoodMid - 0.5, 0.56, 0.32, 0.06); g.fill();
    g.fillStyle = '#444'; for (let i = 0; i < 4; i++) g.fillRect(-0.24, hoodMid - 0.12 + i * 0.1, 0.48, 0.03);
  }

  // ---- graphics ----
  const dc = v.decalColor || '#f2f2f2';
  if (v.decal === 'stripes') {
    g.fillStyle = dc;
    for (const s of [-1, 1]) g.fillRect(s * 0.13 - 0.08, -L / 2 + 0.05, 0.16, L - 0.1);
    // keep glass visible over stripes
    g.fillStyle = glass;
    g.fillRect(-0.3, y(hoodEnd), 0.6, L * (wsEnd - hoodEnd));
    g.fillRect(-0.3, y(roofEnd), 0.6, L * (rgEnd - roofEnd));
  }
  if (v.decal === 'side' || v.decal === 'crew') {
    g.fillStyle = v.decal === 'crew' ? (opts.crewColor || dc) : dc;
    for (const s of [-1, 1]) g.fillRect(s * (W / 2 - 0.08) - 0.04, y(0.06), 0.08, L * 0.88);
  }
  if (v.decal === 'number') {
    g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(0, y((wsEnd + roofEnd) / 2), 0.32, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 0.4px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String((v.plate || '7').replace(/\D/g, '').slice(-2) || '7'), 0, y((wsEnd + roofEnd) / 2) + 0.02);
  }
  if (v.decal === 'flames') {
    for (let i = -2; i <= 2; i++) {
      const gr = g.createLinearGradient(0, y(0.02), 0, y(hoodEnd));
      gr.addColorStop(0, dc); gr.addColorStop(1, 'rgba(255,190,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(i * 0.18 - 0.08, y(0.03)); g.quadraticCurveTo(i * 0.22, y(hoodEnd * 0.6), i * 0.12 + 0.05, y(hoodEnd + 0.04));
      g.quadraticCurveTo(i * 0.2 + 0.1, y(hoodEnd * 0.5), i * 0.18 + 0.08, y(0.03)); g.fill();
    }
  }

  // ---- front aero ----
  if (v.frontBumper === 'sport' || v.kit === 'street') { g.fillStyle = '#121212'; g.fillRect(-W / 2 + 0.2, -L / 2 - 0.06, W - 0.4, 0.08); }
  if (v.frontBumper === 'splitter') { g.fillStyle = '#1c1d22'; rrect(g, -W / 2 + 0.05, -L / 2 - 0.16, W - 0.1, 0.18, 0.05); g.fill(); }
  if ((lv.intercooler || 0) > 0 || (lv.turbo || 0) > 0) {
    g.fillStyle = '#9aa0a8'; g.fillRect(-W * 0.3, -L / 2 + 0.02, W * 0.6, 0.07);
    g.fillStyle = '#333'; for (let i = 0; i < 8; i++) g.fillRect(-W * 0.3 + i * W * 0.075, -L / 2 + 0.02, 0.02, 0.07);
  }
  if (v.skirts && v.skirts !== 'none' || v.kit !== 'stock' && v.kit) {
    g.fillStyle = v.skirts === 'aero' ? '#1c1d22' : shade(paint, -0.2);
    for (const s of [-1, 1]) g.fillRect(s * (W / 2 - 0.02) - 0.04, axF + 0.4, 0.08, axR - axF - 0.8);
  }

  // ---- lights ----
  const lightsHealth = cond?.lights ?? 100;
  const head = HEAD[v.headlights] || HEAD.halogen;
  for (const s of [-1, 1]) {
    const broken = lightsHealth < 20 || (lightsHealth < 55 && s < 0);
    g.fillStyle = broken ? '#2a2a2a' : head;
    g.beginPath();
    g.ellipse(s * (W / 2 - 0.32), -L / 2 + 0.14, 0.24, 0.08, s * 0.15, 0, Math.PI * 2);
    g.fill();
    if (broken) { g.strokeStyle = '#888'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(s * (W / 2 - 0.45), -L / 2 + 0.1); g.lineTo(s * (W / 2 - 0.2), -L / 2 + 0.2); g.stroke(); }
  }
  const tailCol = v.taillights === 'smoked' ? '#5a0d0d' : '#d01515';
  g.fillStyle = tailCol;
  if (v.taillights === 'bar') g.fillRect(-W / 2 + 0.15, L / 2 - 0.1, W - 0.3, 0.07);
  else for (const s of [-1, 1]) g.fillRect(s * (W / 2 - 0.3) - 0.2, L / 2 - 0.12, 0.4, 0.09);

  // ---- rear: spoiler, diffuser, exhaust ----
  const sp = v.spoiler;
  if (sp === 'lip') { g.fillStyle = shade(paint, -0.25); g.fillRect(-W / 2 + 0.3, L / 2 - 0.3, W - 0.6, 0.07); }
  if (sp === 'duck') { g.fillStyle = shade(paint, -0.15); rrect(g, -W / 2 + 0.2, L / 2 - 0.35, W - 0.4, 0.2, 0.06); g.fill(); }
  if (sp === 'gt' || sp === 'drag') {
    const ww = sp === 'drag' ? W + 0.05 : W - 0.1;
    g.fillStyle = sp === 'drag' ? '#1c1d22' : shade(paint, -0.2);
    rrect(g, -ww / 2, L / 2 - 0.45, ww, sp === 'drag' ? 0.32 : 0.24, 0.04); g.fill();
    g.fillStyle = '#0a0a0a';
    for (const s of [-1, 1]) g.fillRect(s * ww / 2 - (s > 0 ? 0.05 : 0), L / 2 - 0.5, 0.05, 0.36);
  }
  if (v.rearBumper === 'diffuser') { g.fillStyle = '#1c1d22'; g.fillRect(-W / 2 + 0.25, L / 2, W - 0.5, 0.12); g.fillStyle = '#000'; for (let i = -2; i <= 2; i++) g.fillRect(i * 0.22 - 0.01, L / 2, 0.03, 0.12); }
  if (v.rearBumper === 'sport') { g.fillStyle = '#121212'; g.fillRect(-W / 2 + 0.25, L / 2 - 0.02, W - 0.5, 0.08); }
  const tips = { single: [-0.55], dual: [-0.6, 0.6], quad: [-0.68, -0.52, 0.52, 0.68], cannon: [-0.38, 0.38] }[v.exhaustTips || 'single'];
  const tipR = 0.05 + (lv.exhaust || 0) * 0.008 + (v.exhaustTips === 'cannon' ? 0.04 : 0);
  g.fillStyle = (lv.exhaust || 0) >= 4 ? '#8a7fc0' : '#c9ccd1';
  for (const x of tips) { g.beginPath(); g.arc(x * (W / 2) / 0.9, L / 2 + 0.03, tipR, 0, Math.PI * 2); g.fill(); }

  // mirrors
  g.fillStyle = opts.police ? '#0d0d0d' : shade(paint, -0.2);
  for (const s of [-1, 1]) { rrect(g, s * (W / 2 + 0.06) - 0.08, y(hoodEnd + 0.02), 0.16, 0.1, 0.03); g.fill(); }

  // police light bar / taxi sign
  if (opts.police) {
    g.fillStyle = '#d01515'; g.fillRect(-0.55, y((wsEnd + roofEnd) / 2) - 0.08, 0.5, 0.16);
    g.fillStyle = '#1e5bff'; g.fillRect(0.05, y((wsEnd + roofEnd) / 2) - 0.08, 0.5, 0.16);
  }

  // nitrous: blue bottle visible through the rear glass
  if ((lv.nitrous || 0) > 0) { g.fillStyle = '#2b55ff'; rrect(g, -0.1, y(roofEnd) + 0.04, 0.2, 0.35, 0.08); g.fill(); }

  // ---- damage ----
  const body = cond?.body ?? 100;
  if (body < 75) {
    g.strokeStyle = 'rgba(30,30,30,0.7)'; g.lineWidth = 0.03;
    g.beginPath(); g.moveTo(-W / 2 + 0.2, -L / 2 + 0.3); g.lineTo(-W / 2 + 0.5, -L / 2 + 0.12); g.lineTo(-W / 2 + 0.7, -L / 2 + 0.3); g.stroke();
    g.fillStyle = 'rgba(40,36,32,0.55)'; g.beginPath(); g.ellipse(W / 2 - 0.25, y(0.5), 0.12, 0.5, 0, 0, Math.PI * 2); g.fill();
  }
  if (body < 45) {
    g.fillStyle = 'rgba(40,36,32,0.65)';
    g.beginPath(); g.ellipse(-W / 4, -L / 2 + 0.2, 0.45, 0.15, 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(W / 5, L / 2 - 0.2, 0.4, 0.14, -0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(200,200,200,0.4)'; g.lineWidth = 0.02;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-W / 2 + 0.05, y(0.3 + i * 0.08)); g.lineTo(-W / 2 + 0.3, y(0.33 + i * 0.08)); g.stroke(); }
  }

  const out = { canvas: c, L, W, pad, px: S };
  cache.set(key, out);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return out;
}

// Draw a sprite centred at (x, y) in the current transform, rotated by `rot`
// (0 = facing up), at `scale` pixels per metre.
export function drawCar(ctx, sprite, x, y, rot, scale) {
  const k = scale / sprite.px;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ctx.drawImage(sprite.canvas, -sprite.canvas.width / 2, -sprite.canvas.height / 2);
  ctx.restore();
}

export function caliperColor(level) { return CALIPER_COLORS[level] || '#3a3a3a'; }
