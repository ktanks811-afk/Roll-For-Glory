// Tattoos and brand logos for the front portrait (gfx2d/person.js).
// Portrait space is 300x300 scaled by k, same as gfx2d/hair.js.

import { BRANDS, hasTat } from '../data/looks.js';
import { shade } from './hair.js';

const rnd = i => { const x = Math.sin(i * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
const COLOR_INK = ['#b3202c', '#1f6fb8', '#2a8a4a', '#d9a21c', '#7b3fc4'];

// ink colour on this skin: black & grey sits darker on light skin and a bit
// lighter (healed blue-black) on deep skin so it still reads
function inkOf(look, i) {
  if (look.ink === 'color' && i % 3 !== 0) return COLOR_INK[i % COLOR_INK.length];
  const lum = parseInt((look.skin || '#c68e65').slice(1, 3), 16);
  return lum < 90 ? '#0b0d16' : '#161a2a';
}

// one patch of flash: roses, stars, script, clocks and shading, kept inside
// the clip the caller set. x0,y0,w,h in canvas pixels.
function flash(ctx, look, x0, y0, w, h, seed, dense = 1) {
  const n = Math.round((w * h) / 220 * dense) + 3;
  ctx.save();
  // shading wash first so the pieces read as a connected sleeve
  ctx.globalAlpha = 0.18; ctx.fillStyle = inkOf(look, 0);
  ctx.fillRect(x0, y0, w, h);
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < n; i++) {
    const r = rnd(seed + i * 3), x = x0 + rnd(seed + i * 7 + 1) * w, y = y0 + rnd(seed + i * 11 + 2) * h, sz = Math.min(w, h) * (0.18 + rnd(seed + i * 5) * 0.22);
    const c = inkOf(look, i + seed);
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = Math.max(0.8, sz * 0.14); ctx.lineCap = 'round';
    ctx.beginPath();
    if (r < 0.25) {   // rose
      for (let p = 0; p < 3; p++) ctx.arc(x, y, sz * (0.35 + p * 0.25), p, p + Math.PI * 1.4);
      ctx.stroke();
    } else if (r < 0.45) {   // star
      for (let p = 0; p < 10; p++) { const a = -Math.PI / 2 + p * Math.PI / 5, rr = p % 2 ? sz * 0.4 : sz; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else if (r < 0.65) {   // script
      ctx.moveTo(x - sz, y);
      for (let p = 0; p <= 8; p++) ctx.lineTo(x - sz + p * sz / 4, y + Math.sin(p * 1.9 + seed) * sz * 0.3);
      ctx.stroke();
    } else if (r < 0.8) {   // clock
      ctx.arc(x, y, sz * 0.8, 0, Math.PI * 2); ctx.moveTo(x, y); ctx.lineTo(x, y - sz * 0.6); ctx.moveTo(x, y); ctx.lineTo(x + sz * 0.45, y); ctx.stroke();
    } else {   // tribal sweep
      ctx.moveTo(x - sz, y + sz); ctx.quadraticCurveTo(x, y - sz, x + sz, y + sz * 0.2); ctx.quadraticCurveTo(x, y, x - sz, y + sz); ctx.fill();
    }
  }
  ctx.restore();
}

const clipRect = (ctx, x, y, w, h, draw) => { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); draw(); ctx.restore(); };

// arms: x0 is the arm's left edge, in canvas pixels; the arm runs 112k..214k
export function drawArmInk(ctx, k, look, side, x0, w) {
  const r = side > 0;
  const upper = hasTat(look, r ? 'half_r' : 'half_l'), lower = hasTat(look, r ? 'sleeve_r' : 'sleeve_l');
  if (upper) clipRect(ctx, x0, 112 * k, w, 46 * k, () => flash(ctx, look, x0, 112 * k, w, 46 * k, r ? 11 : 23));
  if (lower) clipRect(ctx, x0, 158 * k, w, 42 * k, () => flash(ctx, look, x0, 158 * k, w, 42 * k, r ? 37 : 51));
  if (hasTat(look, 'hands')) clipRect(ctx, x0, 200 * k, w, 14 * k, () => {
    ctx.save(); ctx.strokeStyle = inkOf(look, 2); ctx.lineWidth = 1.1 * k; ctx.globalAlpha = 0.85;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x0 + (2 + i * 4.2) * k, 202 * k); ctx.lineTo(x0 + (2 + i * 4.2) * k, 212 * k); ctx.stroke(); }
    ctx.restore();
  });
}

// chest and stomach, drawn on the torso skin before the top goes on
export function drawTorsoInk(ctx, cx, k, look) {
  const X = d => cx + d * k, Y = y => y * k;
  if (hasTat(look, 'chest')) {
    ctx.save(); ctx.globalAlpha = 0.85;
    // wings across the collarbones with a piece in the middle
    for (const s of [-1, 1]) {
      ctx.fillStyle = inkOf(look, s > 0 ? 1 : 4);
      ctx.beginPath(); ctx.moveTo(X(s * 6), Y(124));
      for (let i = 0; i < 6; i++) { ctx.lineTo(X(s * (12 + i * 7)), Y(116 + i * 1.5)); ctx.lineTo(X(s * (10 + i * 7)), Y(126 + i * 2)); }
      ctx.lineTo(X(s * 8), Y(134)); ctx.closePath(); ctx.fill();
    }
    flash(ctx, look, X(-12), Y(120), 24 * k, 26 * k, 71, 1.6);
    ctx.restore();
  }
  if (hasTat(look, 'stomach')) {
    ctx.save(); ctx.strokeStyle = inkOf(look, 0); ctx.lineWidth = 2 * k; ctx.globalAlpha = 0.85; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X(-30), Y(176));
    for (let p = 0; p <= 24; p++) ctx.lineTo(X(-30 + p * 2.5), Y(176 + Math.sin(p * 1.7) * 3 - (p % 4 === 0 ? 3 : 0)));
    ctx.stroke(); ctx.restore();
  }
}

// throat piece and face tats, over the head and neck
export function drawHeadInk(ctx, cx, k, look) {
  const X = d => cx + d * k, Y = y => y * k;
  if (hasTat(look, 'neck')) clipRect(ctx, X(-10), Y(94), 20 * k, 20 * k, () => flash(ctx, look, X(-10), Y(94), 20 * k, 20 * k, 83, 2));
  if (hasTat(look, 'face')) {
    ctx.save(); ctx.fillStyle = inkOf(look, 0); ctx.strokeStyle = inkOf(look, 0); ctx.globalAlpha = 0.85;
    // little star by the right eye, script over the left brow, a cross on the cheek
    const star = (x, y, r) => { ctx.beginPath(); for (let p = 0; p < 10; p++) { const a = -Math.PI / 2 + p * Math.PI / 5, rr = p % 2 ? r * 0.4 : r; ctx.lineTo(X(x) + Math.cos(a) * rr * k, Y(y) + Math.sin(a) * rr * k); } ctx.closePath(); ctx.fill(); };
    star(21, 70, 3);
    ctx.lineWidth = 0.9 * k; ctx.beginPath(); ctx.moveTo(X(-18), Y(50)); for (let p = 0; p <= 8; p++) ctx.lineTo(X(-18 + p * 1.6), Y(50 + Math.sin(p * 2.1) * 1.2)); ctx.stroke();
    ctx.lineWidth = 1.1 * k; ctx.beginPath(); ctx.moveTo(X(-20), Y(74)); ctx.lineTo(X(-20), Y(80)); ctx.moveTo(X(-22.5), Y(76)); ctx.lineTo(X(-17.5), Y(76)); ctx.stroke();
    ctx.restore();
  }
}

// a brand's logo centred at (x, y), size in canvas pixels; on picks a colour
// that reads on the garment
export function drawLogo(ctx, brand, x, y, size, on) {
  const b = BRANDS[brand];
  if (!b) return;
  const lum = parseInt((on || '#222222').slice(1, 3), 16);
  const fg = lum > 140 ? '#151515' : '#f4f4f4';
  const S = size;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = fg; ctx.strokeStyle = fg; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (b.logo) {
    case 'vee':   // a sharp curved V
      ctx.beginPath(); ctx.moveTo(-S, -S * 0.3); ctx.quadraticCurveTo(-S * 0.3, S * 0.6, S, -S * 0.5); ctx.quadraticCurveTo(-S * 0.2, S * 0.15, -S, -S * 0.3); ctx.fill(); break;
    case 'wing':   // a single swept wing
      ctx.beginPath(); ctx.moveTo(-S, S * 0.4); for (let i = 0; i < 4; i++) { ctx.lineTo(-S + i * S * 0.6, -S * 0.5 + i * 0.1 * S); ctx.lineTo(-S + i * S * 0.6 + S * 0.25, S * 0.1); } ctx.lineTo(S, S * 0.4); ctx.closePath(); ctx.fill(); break;
    case 'bars':   // three bars stepping up
      for (let i = 0; i < 3; i++) ctx.fillRect(-S + i * S * 0.7, S * 0.5 - (i + 1) * S * 0.38, S * 0.45, (i + 1) * S * 0.38); break;
    case 'diag':   // diagonal stripes
      ctx.lineWidth = S * 0.22; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-S * 0.6 + i * S * 0.4, S * 0.6); ctx.lineTo(S * 0.0 + i * S * 0.4, -S * 0.6); ctx.stroke(); } break;
    case 'mono':   // MN
      ctx.font = `bold ${Math.round(S * 1.3)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = lum > 140 ? '#3a2a1a' : '#d9b46a'; ctx.fillText('MN', 0, 0); break;
    case 'crown':
      ctx.fillStyle = '#e2b437'; ctx.beginPath(); ctx.moveTo(-S, S * 0.5); ctx.lineTo(-S, -S * 0.4); ctx.lineTo(-S * 0.5, S * 0.05); ctx.lineTo(0, -S * 0.6); ctx.lineTo(S * 0.5, S * 0.05); ctx.lineTo(S, -S * 0.4); ctx.lineTo(S, S * 0.5); ctx.closePath(); ctx.fill(); break;
    case 'glitch':   // a G split into cyan and magenta
      ctx.font = `900 ${Math.round(S * 1.7)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#18d6e8'; ctx.fillText('G', -S * 0.12, 0); ctx.fillStyle = '#e8189a'; ctx.fillText('G', S * 0.12, 0); ctx.fillStyle = fg; ctx.fillText('G', 0, 0); break;
    case 'star':   // lone star
      ctx.beginPath(); for (let p = 0; p < 10; p++) { const a = -Math.PI / 2 + p * Math.PI / 5, rr = p % 2 ? S * 0.42 : S; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
}

// Maison Noir prints its monogram all over the piece
export function monogram(ctx, x0, y0, w, h, base) {
  ctx.save(); ctx.fillStyle = shade(base, 0.22); ctx.globalAlpha = 0.5;
  const step = Math.max(6, w / 7);
  for (let y = y0; y < y0 + h; y += step) for (let x = x0 + ((y / step) % 2 ? step / 2 : 0); x < x0 + w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, y - step * 0.2); ctx.lineTo(x + step * 0.2, y); ctx.lineTo(x, y + step * 0.2); ctx.lineTo(x - step * 0.2, y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
