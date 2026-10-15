// Boats, drawn from their specs and customization: a top-down view for the
// world (cached to a sprite per look) and a side profile for the marina
// screens. Units are meters; the bow points up (-y) in the top view and right
// in the side view. Data: data/boats.js.

import { FINISHES, WRAPS, DECKS, TINTS, FONTS } from '../data/boats.js';

const byId = (list, id) => list.find(x => x.id === id) || list[0];
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

// ---------------------------------------------------------------- top view
function bowLen(kind, L) {
  return L * ({ pwc: 0.42, gofast: 0.42, bass: 0.36, wake: 0.3, console: 0.36, cruiser: 0.34, yacht: 0.3, superyacht: 0.26 }[kind] ?? 0.34);
}
export function hullPath(g, def, inset = 0) {
  const hl = def.L / 2 - inset, hw = def.W / 2 - inset, b = bowLen(def.kind, def.L) * (1 - inset / def.L * 2);
  g.beginPath();
  if (def.kind === 'pontoon') { g.roundRect?.(-hw, -hl, hw * 2, hl * 2, hw * 0.4) ?? g.rect(-hw, -hl, hw * 2, hl * 2); return; }
  g.moveTo(-hw * 0.9, hl);
  g.lineTo(-hw, hl - def.L * 0.06);
  g.lineTo(-hw, -hl + b);
  g.quadraticCurveTo(-hw, -hl + b * 0.2, 0, -hl);
  g.quadraticCurveTo(hw, -hl + b * 0.2, hw, -hl + b);
  g.lineTo(hw, hl - def.L * 0.06);
  g.lineTo(hw * 0.9, hl);
  g.closePath();
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else g.rect(x, y, w, h); };

// Paint with finish: gloss gets a soft highlight, metallic and pearl a sheen,
// chrome a mirror gradient, carbon a weave, matte stays flat.
function paint(g, color, finish, x0, y0, x1, y1) {
  const f = finish;
  if (f === 'chrome') {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, '#6d7179'); gr.addColorStop(0.3, '#f6f8fb'); gr.addColorStop(0.5, '#9aa0aa'); gr.addColorStop(0.72, '#ffffff'); gr.addColorStop(1, '#5d6169');
    g.fillStyle = gr; g.fill();
    g.save(); g.globalAlpha = 0.35; g.fillStyle = color; g.fill(); g.restore();
    return;
  }
  g.fillStyle = f === 'matte' ? shade(color, -0.12) : color; g.fill();
  if (f === 'carbon') {
    g.save(); g.clip(); g.globalAlpha = 0.35; const s = Math.max(0.12, (x1 - x0) / 30);
    for (let y = y0; y < y1; y += s * 2) for (let x = x0 + ((Math.round((y - y0) / s / 2) % 2) * s); x < x1; x += s * 2) { g.fillStyle = '#000'; g.fillRect(x, y, s, s); }
    g.restore(); return;
  }
  if (f === 'matte') return;
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  const k = f === 'metallic' ? 0.32 : f === 'pearl' ? 0.42 : 0.18;
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.42, `rgba(255,255,255,${k})`); gr.addColorStop(0.55, 'rgba(255,255,255,0)');
  if (f === 'pearl') gr.addColorStop(0.8, 'rgba(180,220,255,0.18)');
  g.save(); g.fillStyle = gr; g.fill(); g.restore();
  if (f === 'metallic') {
    g.save(); g.clip(); g.globalAlpha = 0.18; let seed = 9;
    for (let k2 = 0; k2 < 220; k2++) { seed = (seed * 16807) % 2147483647; const rx = seed / 2147483647; seed = (seed * 16807) % 2147483647; const ry = seed / 2147483647; g.fillStyle = k2 % 2 ? '#fff' : '#000'; g.fillRect(x0 + rx * (x1 - x0), y0 + ry * (y1 - y0), (x1 - x0) / 120, (x1 - x0) / 120); }
    g.restore();
  }
}

// Graphics over the paint, clipped to the current path. (x0..x1, y0..y1) is
// the box to cover; `along` says which way the boat runs (top view: y; side: x).
function wrap(g, cu, x0, y0, x1, y1, along) {
  const w = cu.wrap;
  if (w === 'none' || w === 'boot') return;
  g.save(); g.clip();
  const len = along === 'y' ? y1 - y0 : x1 - x0, wid = along === 'y' ? x1 - x0 : y1 - y0;
  // local helper: p(t, s) maps along-position t (0 bow .. 1 stern) and across s (0..1) to x, y
  const P = (t, s) => along === 'y' ? [x0 + s * wid, y0 + t * len] : [x1 - t * len, y0 + s * wid];
  const c2 = cu.hull2, c3 = cu.stripe;
  if (w === 'racing') {
    for (const s of [0.36, 0.56]) { g.fillStyle = c2; g.beginPath(); const a = P(0, s), b = P(1, s + 0.08); g.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]) || 0.1, Math.abs(b[1] - a[1]) || 0.1); g.fill(); }
  } else if (w === 'fade') {
    const a = P(0, 0.5), b = P(1, 0.5), gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(0,0,0,0)'); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  } else if (w === 'flames') {
    g.fillStyle = c2;
    for (let k = 0; k < 7; k++) {
      const s = (k + 0.5) / 7, tip = 0.3 + ((k * 37) % 10) / 30;
      g.beginPath(); const a = P(0, s - 0.07), b = P(0, s + 0.07), t = P(tip, s + (k % 2 ? 0.08 : -0.08)), m = P(tip * 0.55, s);
      g.moveTo(a[0], a[1]); g.quadraticCurveTo(m[0], m[1], t[0], t[1]); g.quadraticCurveTo(m[0], m[1], b[0], b[1]); g.closePath(); g.fill();
    }
    g.fillStyle = c3; g.globalAlpha = 0.7;
    for (let k = 0; k < 7; k++) { const s = (k + 0.5) / 7, tip = 0.15 + ((k * 37) % 10) / 60; g.beginPath(); const a = P(0, s - 0.03), b = P(0, s + 0.03), t = P(tip, s); g.moveTo(a[0], a[1]); g.lineTo(t[0], t[1]); g.lineTo(b[0], b[1]); g.fill(); }
  } else if (w === 'waves') {
    g.strokeStyle = c2; g.lineWidth = wid / 10;
    for (let r = 0; r < 3; r++) { g.beginPath(); for (let t = 0; t <= 1.001; t += 0.02) { const s = 0.25 + r * 0.25 + Math.sin(t * 28 + r) * 0.06; const p = P(t, s); t ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); }
  } else if (w === 'camo') {
    let seed = 41; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 90; k++) { const p = P(R(), R()), q = Math.max(len, wid) / 30; g.fillStyle = [c2, c3, '#3a3d33'][k % 3]; g.fillRect(p[0], p[1], q * (1 + R() * 2), q * (1 + R())); }
  } else if (w === 'checker') {
    const n = 4, q = wid / n;
    for (let i = 0; i < n * 3; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) { const p = P(0.62 + i * (q / len), j / n); g.fillStyle = c2 === '#f4f4f2' ? '#111' : c2; g.fillRect(p[0] - (along === 'y' ? 0 : q), p[1], q, q); }
  } else if (w === 'tribal') {
    g.fillStyle = c2;
    for (let k = 0; k < 5; k++) { const t = 0.08 + k * 0.17; g.beginPath(); const a = P(t, 0.5), b = P(t + 0.14, 0.1), c = P(t + 0.06, 0.5), d = P(t + 0.14, 0.9); g.moveTo(a[0], a[1]); g.quadraticCurveTo(...P(t + 0.1, 0.35), b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.quadraticCurveTo(...P(t + 0.1, 0.65), a[0], a[1]); g.fill(); }
  } else if (w === 'money') {
    for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) { const p = P(i / 12 + (j % 2) * 0.04, j / 4 + 0.03), q = len / 14; g.fillStyle = (i + j) % 2 ? '#7ea36a' : '#5f8a52'; g.fillRect(p[0], p[1], along === 'y' ? wid / 4.6 : q, along === 'y' ? q : wid / 4.6); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(p[0] + 0.05, p[1] + 0.05, along === 'y' ? wid / 12 : q / 3, along === 'y' ? q / 3 : wid / 12); }
  } else if (w === 'texas') {
    const a = P(0.45, 0), b = P(1, 1);
    g.fillStyle = '#bf0a30'; g.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    const m = P(0.45, 0.5), e = P(1, 0.5);
    g.fillStyle = '#fff'; if (along === 'y') g.fillRect(x0, m[1], wid / 2, len * 0.55); else g.fillRect(e[0], y0, Math.abs(m[0] - e[0]), wid / 2);
    const n = P(0, 0), o = P(0.45, 1); g.fillStyle = '#002868'; g.fillRect(Math.min(n[0], o[0]), Math.min(n[1], o[1]), Math.abs(o[0] - n[0]), Math.abs(o[1] - n[1]));
    star(g, ...P(0.22, 0.5), wid * 0.28);
  } else if (w === 'diamond') {
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = wid / 60; const q = wid / 6;
    for (let k = -40; k < 40; k++) { g.beginPath(); g.moveTo(x0 + k * q, y0); g.lineTo(x0 + k * q + (y1 - y0), y1); g.stroke(); g.beginPath(); g.moveTo(x0 + k * q, y1); g.lineTo(x0 + k * q + (y1 - y0), y0); g.stroke(); }
  }
  g.restore();
}
function star(g, x, y, r) {
  g.fillStyle = '#fff'; g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  g.closePath(); g.fill();
}

function flag(g, cu, x, y, s, crewColor) {
  const f = cu.flag;
  if (f === 'none') return;
  g.save(); g.translate(x, y);
  const w = s * 1.5, h = s;
  if (f === 'texas') { g.fillStyle = '#002868'; g.fillRect(0, 0, w / 3, h); g.fillStyle = '#fff'; g.fillRect(w / 3, 0, w * 2 / 3, h / 2); g.fillStyle = '#bf0a30'; g.fillRect(w / 3, h / 2, w * 2 / 3, h / 2); star(g, w / 6, h / 2, h * 0.28); }
  else if (f === 'usa') { for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#fff' : '#bf0a30'; g.fillRect(0, k * h / 7, w, h / 7); } g.fillStyle = '#002868'; g.fillRect(0, 0, w * 0.42, h * 0.54); }
  else if (f === 'pirate') { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#eee'; g.beginPath(); g.arc(w / 2, h * 0.42, h * 0.2, 0, 7); g.fill(); g.fillRect(w * 0.3, h * 0.7, w * 0.4, h * 0.08); }
  else if (f === 'mexico') { g.fillStyle = '#006847'; g.fillRect(0, 0, w / 3, h); g.fillStyle = '#fff'; g.fillRect(w / 3, 0, w / 3, h); g.fillStyle = '#ce1126'; g.fillRect(w * 2 / 3, 0, w / 3, h); g.fillStyle = '#8a5a22'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.14, 0, 7); g.fill(); }
  else if (f === 'cayman') { g.fillStyle = '#00247d'; g.fillRect(0, 0, w, h); g.fillStyle = '#cf142b'; g.fillRect(0, h * 0.2, w * 0.45, h * 0.1); g.fillRect(w * 0.2, 0, w * 0.06, h * 0.5); g.fillStyle = '#fff'; g.beginPath(); g.arc(w * 0.75, h * 0.45, h * 0.18, 0, 7); g.fill(); }
  else { g.fillStyle = crewColor || '#ff1a2e'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.fillRect(0, h * 0.4, w, h * 0.2); }
  g.restore();
}

// The boat seen from above, centred on (0, 0), in meters.
export function drawBoatTop(g, def, cu, { crewColor } = {}) {
  const L = def.L, W = def.W, hl = L / 2, hw = W / 2, k = def.kind;
  const deck = byId(DECKS, cu.deck).color, tint = byId(TINTS, cu.tint).color, fin = cu.finish;
  const box = [-hw, -hl, hw, hl];
  g.lineJoin = 'round';
  if (k === 'pontoon') {
    // three tubes and a deck on top
    for (const x of [-hw * 0.78, 0, hw * 0.78]) { rr(g, x - W * 0.11, -hl, W * 0.22, L, W * 0.11); const gr = g.createLinearGradient(x - W * 0.11, 0, x + W * 0.11, 0); gr.addColorStop(0, '#7b8088'); gr.addColorStop(0.5, '#e6e9ee'); gr.addColorStop(1, '#6b7078'); g.fillStyle = gr; g.fill(); }
    rr(g, -hw, -hl + L * 0.06, W, L * 0.86, 0.3); g.fillStyle = deck; g.fill();
    rr(g, -hw, -hl + L * 0.06, W, L * 0.86, 0.3); paintRing(g, cu, W * 0.08);
    // lounges
    g.fillStyle = cu.uph;
    rr(g, -hw + 0.25, -hl + L * 0.12, 0.6, L * 0.3, 0.2); g.fill(); rr(g, hw - 0.85, -hl + L * 0.12, 0.6, L * 0.3, 0.2); g.fill();
    rr(g, -hw + 0.25, hl - L * 0.4, 0.6, L * 0.3, 0.2); g.fill(); rr(g, -hw + 0.25, hl - L * 0.16, W - 0.5, 0.6, 0.2); g.fill();
    rr(g, hw - 1.2, -0.3, 0.9, 0.9, 0.15); g.fillStyle = '#2a2c30'; g.fill();   // helm
    // bimini top
    rr(g, -hw * 0.85, -L * 0.1, W * 0.85 * 2, L * 0.32, 0.4); g.fillStyle = shade(cu.hull === '#f4f4f2' ? '#1a2a4a' : cu.hull, -0.1); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
    outboard(g, 0, hl, W * 0.22, 2);
    return;
  }
  hullPath(g, def); paint(g, cu.hull, fin, ...box);
  hullPath(g, def); wrap(g, cu, ...box, 'y');
  if (cu.wrap === 'boot') { hullPath(g, def); g.strokeStyle = cu.stripe; g.lineWidth = W * 0.07; g.save(); g.clip(); g.stroke(); g.restore(); }
  hullPath(g, def); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = Math.max(0.05, W * 0.015); g.stroke();
  // rub rail
  hullPath(g, def, W * 0.04); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = W * 0.012; g.stroke();
  if (k === 'pwc') {
    rr(g, -W * 0.18, -L * 0.05, W * 0.36, L * 0.42, W * 0.16); g.fillStyle = cu.uph === '#f4f0e6' ? '#1b1b1d' : cu.uph; g.fill();
    g.strokeStyle = '#222'; g.lineWidth = W * 0.06; g.beginPath(); g.moveTo(-W * 0.32, -L * 0.1); g.lineTo(W * 0.32, -L * 0.1); g.stroke();
    rr(g, -W * 0.14, -L * 0.3, W * 0.28, L * 0.16, W * 0.1); g.fillStyle = tint; g.fill();
    return;
  }
  // the deck, inset from the hull
  const di = W * 0.12;
  const deckFrom = k === 'gofast' || k === 'bass' ? -hl + L * 0.45 : k === 'cruiser' ? -hl + L * 0.42 : -hl + L * 0.2;
  g.save(); hullPath(g, def, di); g.clip();
  g.fillStyle = k === 'bass' ? '#3a3f48' : deck; g.fillRect(-hw, deckFrom, W, hl - deckFrom);
  if (cu.deck.includes('teak') && k !== 'bass') { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.03; for (let x = -hw; x < hw; x += 0.18) { g.beginPath(); g.moveTo(x, deckFrom); g.lineTo(x, hl); g.stroke(); } }
  if (k === 'yacht' || k === 'superyacht') { g.fillStyle = deck; g.fillRect(-hw, -hl, W, L * 0.25); }
  g.restore();
  // swim platform
  if (L > 6) { rr(g, -hw * 0.85, hl - 0.15, hw * 1.7, Math.min(2.5, L * 0.05), 0.2); g.fillStyle = deck; g.fill(); }

  if (k === 'bass') {
    seat(g, cu, -W * 0.22, L * 0.05); seat(g, cu, W * 0.22, L * 0.05);
    rr(g, W * 0.12, -L * 0.04, W * 0.24, L * 0.06, 0.1); g.fillStyle = tint; g.fill();
    outboard(g, 0, hl, W * 0.28, 1);
    g.fillStyle = '#222'; g.fillRect(-0.08, -hl + 0.2, 0.16, 0.8);   // trolling motor
  } else if (k === 'wake' || k === 'console') {
    if (k === 'wake') {
      g.fillStyle = cu.uph; rr(g, -hw + di + 0.1, hl - L * 0.25, W - di * 2 - 0.2, 0.55, 0.2); g.fill();
      rr(g, -hw + di + 0.1, -L * 0.05, 0.5, L * 0.3, 0.2); g.fill(); rr(g, hw - di - 0.6, -L * 0.05, 0.5, L * 0.3, 0.2); g.fill();
      g.strokeStyle = tint; g.lineWidth = 0.18; g.beginPath(); g.arc(0, -L * 0.02, W * 0.42, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.strokeStyle = '#1b1b1d'; g.lineWidth = 0.22; g.beginPath(); g.moveTo(-hw + 0.1, L * 0.08); g.lineTo(hw - 0.1, L * 0.08); g.stroke();   // the tower
      rr(g, -W * 0.3, L * 0.05, W * 0.6, 0.5, 0.15); g.fillStyle = '#1b1b1d'; g.fill();
    } else {
      rr(g, -W * 0.22, -L * 0.08, W * 0.44, L * 0.18, 0.2); g.fillStyle = cu.sup; g.fill();
      rr(g, -W * 0.3, -L * 0.06, W * 0.6, L * 0.3, 0.25); g.fillStyle = 'rgba(245,245,245,0.92)'; g.fill();   // T-top
      g.fillStyle = tint; g.fillRect(-W * 0.2, -L * 0.07, W * 0.4, 0.25);
      g.fillStyle = cu.uph; rr(g, -W * 0.3, -hl + L * 0.24, W * 0.6, L * 0.08, 0.3); g.fill();
      outboard(g, -W * 0.18, hl, W * 0.18, 1); outboard(g, W * 0.18, hl, W * 0.18, 1);
    }
  } else if (k === 'gofast') {
    rr(g, -W * 0.3, L * 0.02, W * 0.6, L * 0.26, 0.3); g.fillStyle = cu.uph; g.fill();
    for (const x of [-0.25, 0.25]) for (const y of [0.06, 0.16]) seat(g, cu, x * W, y * L, '#1b1b1d');
    g.strokeStyle = tint; g.lineWidth = 0.14; g.beginPath(); g.moveTo(-W * 0.32, L * 0.01); g.quadraticCurveTo(0, -L * 0.03, W * 0.32, L * 0.01); g.stroke();
    for (const x of [-0.36, -0.12, 0.12, 0.36]) outboard(g, x * W, hl, W * 0.17, 1, '#111');
  } else if (k === 'cruiser') {
    rr(g, -W * 0.3, -hl + L * 0.14, W * 0.6, L * 0.16, 0.6); g.fillStyle = cu.uph; g.fill();   // bow sunpad
    rr(g, -hw + di, -hl + L * 0.3, W - di * 2, L * 0.28, 0.8); g.fillStyle = cu.sup; g.fill();
    g.fillStyle = tint; rr(g, -hw + di + 0.2, -hl + L * 0.31, W - di * 2 - 0.4, L * 0.07, 0.5); g.fill();
    g.fillStyle = cu.uph; rr(g, -hw + di + 0.2, hl - L * 0.3, W - di * 2 - 0.4, 0.7, 0.3); g.fill();
  } else {
    // yachts: stacked decks, each a little smaller
    const tiers = def.decks || 2;
    for (let t = 0; t < tiers; t++) {
      const f0 = 0.2 + t * 0.07, f1 = 0.82 - t * (k === 'superyacht' ? 0.11 : 0.18), wq = 0.86 - t * 0.08;
      const y0 = -hl + L * f0, y1 = -hl + L * f1, x0 = -hw * wq;
      g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0 + L * 0.05); g.quadraticCurveTo(0, y0 - L * 0.02, -x0, y0 + L * 0.05); g.lineTo(-x0, y1); g.closePath();
      g.fillStyle = t % 2 ? shade(cu.sup, -0.06) : cu.sup; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = Math.max(0.04, W * 0.01); g.stroke();
      // the windows round the front of each deck
      g.strokeStyle = tint; g.lineWidth = Math.max(0.15, W * 0.035);
      g.beginPath(); g.moveTo(x0 + W * 0.04, y0 + L * 0.09); g.quadraticCurveTo(0, y0 + L * 0.005, -x0 - W * 0.04, y0 + L * 0.09); g.stroke();
      // aft deck lounges
      if (t === 0) { g.fillStyle = cu.uph; rr(g, x0 + W * 0.08, y1 - L * 0.07, -x0 * 2 - W * 0.16, L * 0.04, 0.4); g.fill(); }
    }
    // radar arch / mast on the top deck
    const top = -hl + L * (0.2 + (tiers - 1) * 0.07);
    g.fillStyle = '#e8e8e8'; rr(g, -W * 0.08, top + L * 0.12, W * 0.16, L * 0.04, 0.2); g.fill();
    g.fillStyle = '#333'; g.beginPath(); g.arc(0, top + L * 0.14, W * 0.05, 0, 7); g.fill();
    amenitiesTop(g, def, cu, tiers);
  }
  if (cu.flag !== 'none' && L > 6) flag(g, cu, -W * 0.06, hl - L * 0.02, Math.max(0.35, W * 0.07), crewColor);
}
// a narrow band of the hull color round a deck (pontoon fence)
function paintRing(g, cu, w) { g.strokeStyle = cu.hull === '#f4f4f2' ? '#c8ccd2' : cu.hull; g.lineWidth = w; g.stroke(); }
function seat(g, cu, x, y, col) { rr(g, x - 0.28, y - 0.28, 0.56, 0.56, 0.18); g.fillStyle = col || cu.uph; g.fill(); }
function outboard(g, x, y, w, n, col = '#1b1b1d') { for (let k = 0; k < n; k++) { rr(g, x - w / 2 + (n > 1 ? (k - (n - 1) / 2) * w * 1.2 : 0), y - 0.1, w, w * 1.3, w * 0.3); g.fillStyle = col; g.fill(); } }

function amenitiesTop(g, def, cu, tiers) {
  const L = def.L, W = def.W, hl = L / 2, hw = W / 2, a = new Set(cu.amen);
  const blue = (x, y, w, h, r = 0.3) => { rr(g, x, y, w, h, r); const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#2fd2f0'); gr.addColorStop(1, '#0f7fb8'); g.fillStyle = gr; g.fill(); g.strokeStyle = '#f4f4f2'; g.lineWidth = Math.max(0.08, W * 0.012); g.stroke(); };
  if (a.has('helipad')) { // on the foredeck
    const r = Math.min(W * 0.38, L * 0.09), y = -hl + L * 0.13;
    g.fillStyle = '#3a3d44'; g.beginPath(); g.arc(0, y, r, 0, 7); g.fill(); g.strokeStyle = '#f4f4f2'; g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, y, r * 0.82, 0, 7); g.stroke();
    g.fillStyle = '#f4f4f2'; g.font = `900 ${r}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 0, y + r * 0.05);
  }
  if (a.has('helipad2')) { const r = Math.min(W * 0.3, L * 0.06), y = -hl + L * (0.2 + (tiers - 1) * 0.07) + L * 0.05; g.fillStyle = '#3a3d44'; g.beginPath(); g.arc(0, y, r, 0, 7); g.fill(); g.fillStyle = '#e8c21a'; g.font = `900 ${r}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 0, y); }
  if (a.has('pool')) blue(-W * 0.28, hl - L * 0.15, W * 0.56, L * 0.06, 0.3);
  if (a.has('jacuzzi')) { const y = -hl + L * (0.2 + (tiers - 1) * 0.07) + L * 0.06, r = Math.max(0.9, W * 0.12); g.beginPath(); g.arc(0, y, r, 0, 7); g.fillStyle = '#34d6f0'; g.fill(); g.strokeStyle = '#f4f4f2'; g.lineWidth = r * 0.15; g.stroke(); }
  if (a.has('beachClub')) { rr(g, -hw * 0.95, hl - 0.1, hw * 1.9, Math.min(5, L * 0.07), 0.3); g.fillStyle = byId(DECKS, cu.deck).color; g.fill(); g.fillStyle = cu.uph; for (const x of [-0.5, 0, 0.5]) { rr(g, x * hw - 0.5, hl + 0.6, 1, 1.8, 0.3); g.fill(); } }
  if (a.has('skiGarage')) for (const x of [-0.45, 0.45]) { g.save(); g.translate(x * hw, hl - L * 0.1); g.scale(0.9, 0.9); drawBoatTop(g, { kind: 'pwc', L: 3.4, W: 1.3 }, { ...cu, wrap: 'fade', flag: 'none' }); g.restore(); }
  if (a.has('sub')) { g.save(); g.translate(hw * 0.4, hl - L * 0.22); rr(g, -1.2, -1.7, 2.4, 3.4, 1.2); g.fillStyle = '#ffcf1a'; g.fill(); g.fillStyle = '#2a7bbf'; g.beginPath(); g.arc(0, -0.6, 0.9, 0, 7); g.fill(); g.restore(); }
  if (a.has('slide')) { g.strokeStyle = '#2a8bff'; g.lineWidth = Math.max(0.6, W * 0.06); g.beginPath(); g.moveTo(hw * 0.6, -L * 0.05); g.quadraticCurveTo(hw * 1.6, L * 0.05, hw * 1.25, L * 0.22); g.stroke(); }
  if (a.has('nightclub')) { const y = -L * 0.02; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { g.fillStyle = ['#ff2a8a', '#2a8bff', '#b44aff', '#2cff7a'][(i + j) % 4]; g.fillRect(-W * 0.25 + i * W * 0.1, y + j * W * 0.1, W * 0.09, W * 0.09); } }
  if (a.has('dj')) { g.fillStyle = '#111'; rr(g, -W * 0.12, hl - L * 0.3, W * 0.24, W * 0.1, 0.1); g.fill(); g.fillStyle = '#2cff7a'; g.fillRect(-W * 0.1, hl - L * 0.3 + W * 0.02, W * 0.05, W * 0.03); g.fillStyle = '#ff2a8a'; g.fillRect(W * 0.05, hl - L * 0.3 + W * 0.02, W * 0.05, W * 0.03); }
  if (a.has('toys')) for (let i = 0; i < 4; i++) { g.fillStyle = ['#ff6a00', '#e8c21a', '#2cbf5a', '#ff3aa8'][i]; g.beginPath(); g.ellipse(-hw * 0.5 + i * hw * 0.33, -hl + L * 0.24, 0.25, 0.6, 0, 0, 7); g.fill(); }
  if (a.has('skyLounge')) { const y = -hl + L * (0.2 + (tiers - 1) * 0.07) + L * 0.02; g.strokeStyle = '#c9a45a'; g.lineWidth = W * 0.02; g.beginPath(); g.arc(0, y + L * 0.12, W * 0.3, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
}

// One canvas per look, so a fleet costs a drawImage each per frame.
const sprites = new Map();
export function boatSprite(def, cu, crewColor) {
  const key = def.id + JSON.stringify(cu) + (crewColor || '');
  let sp = sprites.get(key);
  if (sp) return sp;
  const ppm = Math.max(4, Math.min(28, 640 / def.L)), pad = def.W * 0.9 + 1;
  const c = document.createElement('canvas');
  const wpx = Math.ceil((def.W + pad * 2) * ppm), hpx = Math.ceil((def.L + pad * 2) * ppm);
  c.width = wpx; c.height = hpx;
  const g = c.getContext('2d');
  g.translate(wpx / 2, hpx / 2); g.scale(ppm, ppm);
  drawBoatTop(g, def, cu, { crewColor });
  sp = { img: c, ppm, w: wpx, h: hpx };
  if (sprites.size > 60) sprites.clear();
  sprites.set(key, sp);
  return sp;
}

// ---------------------------------------------------------------- side view
// The boat in profile, filling a w x h canvas, with water across the bottom.
export function drawBoatSide(g, def, cu, w, h, { t = 0, night = false, crewColor } = {}) {
  const L = def.L, k = def.kind;
  // how tall it stands, in boat lengths
  const tall = { pwc: 0.32, bass: 0.18, pontoon: 0.3, wake: 0.32, console: 0.36, gofast: 0.16, cruiser: 0.28, yacht: 0.3, superyacht: 0.26 }[k] ?? 0.3;
  const s = Math.min(w * 0.86 / L, h * 0.6 / (L * tall + L * 0.06));
  const wl = h * 0.68, x0 = w / 2 - L * s / 2, x1 = x0 + L * s;
  const fb = L * s * ({ pwc: 0.12, bass: 0.05, pontoon: 0.06, gofast: 0.05, wake: 0.08, console: 0.08, cruiser: 0.07, yacht: 0.075, superyacht: 0.06 }[k] ?? 0.07);
  g.clearRect(0, 0, w, h);
  // sky
  const sky = g.createLinearGradient(0, 0, 0, wl);
  sky.addColorStop(0, night ? '#05070f' : '#7cc4f0'); sky.addColorStop(1, night ? '#16233a' : '#d8eefb');
  g.fillStyle = sky; g.fillRect(0, 0, w, wl);
  const below = h - wl;
  // underwater glow (drawn first so the water tints it)
  const glow = cu.under === 'rainbow' ? `hsl(${(t * 60) % 360},100%,60%)` : cu.under;
  // hull side
  const bowX = x1, sternX = x0, sheerS = wl - fb, sheerB = wl - fb * (k === 'pontoon' ? 1 : 1.35), keel = wl + fb * 0.55;
  const hullSide = () => {
    g.beginPath();
    if (k === 'pontoon') { g.rect(sternX, sheerS, L * s, fb + fb * 0.5); return; }
    g.moveTo(sternX, sheerS); g.lineTo(bowX - L * s * 0.08, sheerB); g.lineTo(bowX, sheerB - fb * 0.1);
    g.quadraticCurveTo(bowX - L * s * 0.05, keel - fb * 0.2, bowX - L * s * 0.22, keel);
    g.lineTo(sternX + L * s * 0.02, keel - fb * 0.1); g.lineTo(sternX, sheerS + fb * 0.4); g.closePath();
  };
  if (glow && glow !== 'none') {
    const gr = g.createRadialGradient(w / 2, wl + below * 0.3, 0, w / 2, wl + below * 0.3, L * s * 0.6);
    gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.globalAlpha = night ? 0.9 : 0.55; g.fillStyle = gr; g.fillRect(0, wl, w, below); g.restore();
  }
  if (k === 'pontoon') {
    for (let i = 0; i < 2; i++) { rr(g, sternX + L * s * 0.02, wl - fb * 0.2 + i * 2, L * s * 0.96, fb * 0.8, fb * 0.4); const gr = g.createLinearGradient(0, wl - fb * 0.2, 0, wl + fb * 0.6); gr.addColorStop(0, '#eef1f5'); gr.addColorStop(1, '#6b7078'); g.fillStyle = gr; g.fill(); }
    g.fillStyle = cu.hull === '#f4f4f2' ? '#c8ccd2' : cu.hull; g.fillRect(sternX + L * s * 0.04, wl - fb * 2.6, L * s * 0.9, fb * 1.8);
    g.save(); g.beginPath(); g.rect(sternX + L * s * 0.04, wl - fb * 2.6, L * s * 0.9, fb * 1.8); wrap(g, cu, sternX, wl - fb * 2.6, bowX, wl - fb * 0.8, 'x'); g.restore();
    g.fillStyle = shade(cu.hull === '#f4f4f2' ? '#1a2a4a' : cu.hull, -0.1); g.fillRect(sternX + L * s * 0.25, wl - fb * 5.2, L * s * 0.45, fb * 0.4);
    g.strokeStyle = '#aab'; g.lineWidth = 2; for (const xx of [0.27, 0.68]) { g.beginPath(); g.moveTo(sternX + L * s * xx, wl - fb * 4.8); g.lineTo(sternX + L * s * xx, wl - fb * 2.6); g.stroke(); }
    g.fillStyle = '#1b1b1d'; g.fillRect(sternX - fb * 0.6, wl - fb * 2.2, fb * 0.7, fb * 2.6);
  } else {
    hullSide(); paint(g, cu.hull, cu.finish, sternX, sheerS - fb, bowX, keel);
    hullSide(); wrap(g, cu, sternX, sheerB - fb * 0.2, bowX, keel, 'x');
    // boot stripe at the waterline, and the cove stripe
    g.save(); hullSide(); g.clip();
    g.fillStyle = cu.stripe; if (cu.wrap === 'boot' || k === 'yacht' || k === 'superyacht') g.fillRect(sternX, wl - fb * 0.32, L * s, fb * 0.18);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(sternX, wl, L * s, keel - wl);
    g.restore();
    hullSide(); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.stroke();
  }
  // what stands on deck
  const tint = byId(TINTS, cu.tint).color, sup = cu.sup;
  const dk = (fs, fe, hh, inset = 0, col = sup) => {
    const a = sternX + L * s * fs, b = sternX + L * s * fe, y = sheerS - fb * 0.05;
    g.beginPath(); g.moveTo(a, y); g.lineTo(a + inset, y - hh); g.lineTo(b - hh * 0.9, y - hh); g.quadraticCurveTo(b, y - hh * 0.6, b, y); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.stroke();
    // window band
    g.fillStyle = tint; g.beginPath(); g.moveTo(a + inset + hh * 0.2, y - hh * 0.35); g.lineTo(a + inset + hh * 0.2, y - hh * 0.75); g.lineTo(b - hh * 1.0, y - hh * 0.75); g.quadraticCurveTo(b - hh * 0.25, y - hh * 0.6, b - hh * 0.15, y - hh * 0.35); g.closePath(); g.fill();
    return y - hh;
  };
  const deckH = fb * (k === 'superyacht' ? 0.95 : 1.15);
  if (k === 'pwc') {
    g.fillStyle = cu.uph === '#f4f0e6' ? '#1b1b1d' : cu.uph; rr(g, sternX + L * s * 0.15, sheerS - fb * 0.45, L * s * 0.42, fb * 0.5, fb * 0.25); g.fill();
    g.fillStyle = tint; g.beginPath(); g.moveTo(sternX + L * s * 0.62, sheerS - fb * 0.1); g.lineTo(sternX + L * s * 0.7, sheerS - fb * 0.7); g.lineTo(sternX + L * s * 0.76, sheerS - fb * 0.1); g.fill();
  } else if (k === 'bass' || k === 'gofast') {
    g.fillStyle = tint; g.beginPath(); g.moveTo(sternX + L * s * 0.35, sheerS); g.lineTo(sternX + L * s * 0.42, sheerS - fb * 0.9); g.lineTo(sternX + L * s * 0.5, sheerS - fb * 0.15); g.fill();
    g.fillStyle = '#1b1b1d'; for (let i = 0; i < (k === 'gofast' ? 4 : 1); i++) g.fillRect(sternX - fb * (0.9 + i * 0.12), sheerS - fb * 0.6 - i * 2, fb * 0.8, fb * 2.2);
  } else if (k === 'wake' || k === 'console') {
    if (k === 'wake') { g.strokeStyle = '#1b1b1d'; g.lineWidth = Math.max(2, fb * 0.2); g.beginPath(); g.moveTo(sternX + L * s * 0.35, sheerS); g.lineTo(sternX + L * s * 0.45, sheerS - fb * 3); g.lineTo(sternX + L * s * 0.58, sheerS - fb * 3); g.lineTo(sternX + L * s * 0.62, sheerS); g.stroke(); g.fillStyle = tint; g.fillRect(sternX + L * s * 0.62, sheerS - fb * 0.9, L * s * 0.08, fb * 0.9); }
    else { g.fillStyle = sup; g.fillRect(sternX + L * s * 0.4, sheerS - fb * 1.2, L * s * 0.16, fb * 1.2); g.fillStyle = '#f2f2f2'; g.fillRect(sternX + L * s * 0.33, sheerS - fb * 3.1, L * s * 0.3, fb * 0.25); g.strokeStyle = '#bbb'; g.lineWidth = 2; for (const xx of [0.36, 0.6]) { g.beginPath(); g.moveTo(sternX + L * s * xx, sheerS - fb * 2.9); g.lineTo(sternX + L * s * xx, sheerS); g.stroke(); } g.fillStyle = tint; g.fillRect(sternX + L * s * 0.42, sheerS - fb * 1.7, L * s * 0.12, fb * 0.5); g.fillStyle = '#1b1b1d'; g.fillRect(sternX - fb * 0.8, sheerS - fb * 0.4, fb * 0.7, fb * 2); }
  } else if (k === 'cruiser') {
    dk(0.3, 0.72, deckH * 0.9, deckH * 0.4);
    g.fillStyle = cu.uph; g.fillRect(sternX + L * s * 0.74, sheerB - fb * 0.15, L * s * 0.14, fb * 0.15);
  } else if (k === 'yacht' || k === 'superyacht') {
    const tiers = def.decks || 2;
    let top = sheerS;
    for (let i = 0; i < tiers; i++) {
      const fs = 0.12 + i * (k === 'superyacht' ? 0.06 : 0.1), fe = 0.8 - i * (k === 'superyacht' ? 0.09 : 0.14);
      const a = sternX + L * s * fs, b = sternX + L * s * fe, y = top, hh = deckH;
      g.beginPath(); g.moveTo(a, y); g.lineTo(a + hh * 0.15, y - hh); g.lineTo(b - hh * 1.6, y - hh); g.quadraticCurveTo(b - hh * 0.2, y - hh * 0.8, b, y); g.closePath();
      g.fillStyle = i % 2 ? shade(sup, -0.05) : sup; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = tint; g.beginPath(); g.moveTo(a + hh * 0.5, y - hh * 0.28); g.lineTo(a + hh * 0.5, y - hh * 0.72); g.lineTo(b - hh * 1.65, y - hh * 0.72); g.quadraticCurveTo(b - hh * 0.6, y - hh * 0.6, b - hh * 0.45, y - hh * 0.28); g.closePath(); g.fill();
      // accent LEDs along each deck edge
      if (cu.accent && cu.accent !== 'none') { g.fillStyle = cu.accent === 'rainbow' ? `hsl(${(t * 60 + i * 50) % 360},100%,60%)` : cu.accent; g.globalAlpha = night ? 1 : 0.7; g.fillRect(a, y - 2, b - a, 2); g.globalAlpha = 1; }
      top = y - hh;
    }
    // mast + radar
    const mx = sternX + L * s * (0.45 - (tiers - 2) * 0.02);
    g.fillStyle = '#e8e8e8'; g.fillRect(mx - 3, top - deckH * 0.9, 6, deckH * 0.9); g.fillRect(mx - deckH * 0.5, top - deckH * 0.95, deckH, 3);
    g.fillStyle = '#333'; g.fillRect(mx - deckH * 0.35, top - deckH * 1.1, deckH * 0.7, 3);
    amenitiesSide(g, def, cu, { sternX, bowX, s, sheerS, top, deckH, fb, tiers });
  }
  // name and hailing port on the hull, aft
  if (cu.name && k !== 'pwc') {
    const fz = Math.max(9, Math.min(fb * 0.55, 30)), font = byId(FONTS, cu.font).css.replace('1em', `${fz}px`);
    g.save(); g.font = font; g.fillStyle = cu.nameColor; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 2;
    g.fillText(cu.name, sternX + L * s * 0.05, sheerS + fb * 0.32);
    g.font = `700 ${Math.max(7, fz * 0.42)}px Arial`; g.fillText(cu.port || '', sternX + L * s * 0.05, sheerS + fb * 0.32 + fz * 0.72);
    g.restore();
  }
  // flag on the stern staff
  if (cu.flag !== 'none' && def.kind !== 'pwc') {
    const fs = Math.max(8, Math.min(fb * 0.9, 22)), fx = Math.max(sternX + 2, fs * 1.5 + 4), fy = sheerS - fb * 1.8;
    g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, sheerS); g.lineTo(fx, fy); g.stroke();
    flag(g, cu, fx - fs * 1.5, fy, fs, crewColor);
  }
  // the water, over the bottom of the hull
  const sea = g.createLinearGradient(0, wl, 0, h);
  sea.addColorStop(0, night ? 'rgba(10,30,50,0.82)' : 'rgba(25,110,150,0.78)'); sea.addColorStop(1, night ? '#020812' : '#0b3f63');
  g.fillStyle = sea; g.fillRect(0, wl, w, below);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.beginPath();
  for (let x = 0; x <= w; x += 6) { const y = wl + Math.sin(x * 0.06 + t * 2) * 1.6; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  if (glow && glow !== 'none') { const gr = g.createRadialGradient(w / 2, wl + 6, 0, w / 2, wl + 6, L * s * 0.55); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = night ? 0.6 : 0.3; g.fillStyle = gr; g.fillRect(0, wl, w, below); g.restore(); }
}

function amenitiesSide(g, def, cu, o) {
  const a = new Set(cu.amen), { sternX, bowX, s, sheerS, top, deckH, fb } = o, L = def.L;
  if (a.has('helipad')) { const x = sternX + L * s * 0.84; g.fillStyle = '#3a3d44'; g.fillRect(x - L * s * 0.07, sheerS - fb * 0.5, L * s * 0.14, 3); g.fillStyle = '#d0d4da'; g.fillRect(x - L * s * 0.04, sheerS - fb * 1.2, L * s * 0.07, fb * 0.4); g.fillRect(x - L * s * 0.08, sheerS - fb * 1.25, L * s * 0.16, 2); }
  if (a.has('helipad2')) { g.fillStyle = '#3a3d44'; g.fillRect(sternX + L * s * 0.3, top - 3, L * s * 0.14, 3); }
  if (a.has('pool')) { g.fillStyle = 'rgba(52,214,240,0.85)'; g.fillRect(sternX + L * s * 0.04, sheerS - fb * 0.7, L * s * 0.09, fb * 0.65); g.strokeStyle = '#fff'; g.strokeRect(sternX + L * s * 0.04, sheerS - fb * 0.7, L * s * 0.09, fb * 0.65); }
  if (a.has('jacuzzi')) { g.fillStyle = '#34d6f0'; g.fillRect(sternX + L * s * 0.5, top - deckH * 0.25, L * s * 0.06, deckH * 0.25); }
  if (a.has('slide')) { g.strokeStyle = '#2a8bff'; g.lineWidth = Math.max(3, fb * 0.25); g.beginPath(); g.moveTo(sternX + L * s * 0.38, top); g.quadraticCurveTo(sternX + L * s * 0.25, sheerS, sternX + L * s * 0.12, sheerS + fb * 0.5); g.stroke(); }
  if (a.has('beachClub')) { g.fillStyle = byId(DECKS, cu.deck).color; g.fillRect(sternX - L * s * 0.05, sheerS + fb * 0.35, L * s * 0.06, 3); }
  if (a.has('skyLounge')) { g.fillStyle = 'rgba(201,164,90,0.9)'; g.fillRect(sternX + L * s * 0.3, top - 3, L * s * 0.2, 3); }
  if (a.has('sub')) { g.fillStyle = '#ffcf1a'; rr(g, sternX + L * s * 0.08, sheerS - fb * 1.0, L * s * 0.05, fb * 0.9, fb * 0.4); g.fill(); }
  if (a.has('nightclub')) for (let i = 0; i < 6; i++) { g.fillStyle = ['#ff2a8a', '#2a8bff', '#b44aff', '#2cff7a'][i % 4]; g.fillRect(sternX + L * s * (0.2 + i * 0.03), sheerS - deckH * 1.8, L * s * 0.02, 3); }
  void bowX;
}
