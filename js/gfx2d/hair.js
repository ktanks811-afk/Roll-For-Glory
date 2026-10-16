// Hair, faces and extras for the front portrait (character creator, wardrobe,
// mirror) and the top-down walker. Portrait space is 300x300 scaled by k:
// head centred at (cx, 66k), 30k wide and 36k tall, hairline near y 42k.

import { HAIR_BY_ID } from '../data/looks.js';

export function shade(hex, f) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex || '#222';
  const n = parseInt(m[1], 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map(c => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f));
  return '#' + ch.map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}

// steady "random" so textures don't shimmer between redraws
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// styles whose hanging hair still shows under a hat
const UNDER_HAT = new Set(['long', 'flow', 'mullet', 'shag', 'bob', 'silk_press', 'locs', 'freeform', 'box_braids', 'braids_back', 'fulani', 'cowboy']);

export function hasExtra(look, id) { return Array.isArray(look?.extras) && look.extras.includes(id); }

// layer 'back' goes behind the head, 'front' on top of it
export function drawHairPortrait(ctx, cx, k, look, layer, hatOn) {
  const id = HAIR_BY_ID[look.hairStyle] ? look.hairStyle : 'short';
  const base = look.hair || '#111', dark = shade(base, -0.45), light = shade(base, 0.3);
  const durag = !hatOn && hasExtra(look, 'durag');
  if (hatOn || durag) {
    // a hat or durag covers the top; hanging hair still shows below it
    if (!UNDER_HAT.has(id)) return;
    if (layer === 'front') { if (durag) hang(ctx, cx, k, id, base, dark, 'front'); return; }
  }
  const X = d => cx + d * k, Y = y => y * k, R = r => r * k;
  const fill = c => { ctx.fillStyle = c; };
  const ell = (x, y, rx, ry, a0 = 0, a1 = Math.PI * 2) => { ctx.beginPath(); ctx.ellipse(X(x), Y(y), R(rx), R(ry), 0, a0, a1); ctx.fill(); };
  const circ = (x, y, r) => ell(x, y, r, r);
  const cap = (hairline = 42, top = 26, w = 31) => ell(0, hairline, w, hairline - top, Math.PI, 0);
  const faded = (a = 0.45, hairline = 46) => { ctx.save(); ctx.globalAlpha = a; cap(hairline, 30, 31); ctx.restore(); };
  const lineUp = (y = 40, w = 22) => ctx.fillRect(X(-w), Y(y), R(w * 2), R(4));
  const strokeSet = (c, lw) => { ctx.strokeStyle = c; ctx.lineWidth = R(lw); ctx.lineCap = 'round'; };
  const clipCap = (hairline, top, w, draw) => { ctx.save(); ctx.beginPath(); ctx.ellipse(X(0), Y(hairline), R(w), R(hairline - top), 0, Math.PI, 0); ctx.clip(); draw(); ctx.restore(); };
  const bumps = (cxo, cy, rx, ry, n, r, c) => { fill(c); for (let i = 0; i < n; i++) { const a = Math.PI + (i / (n - 1)) * Math.PI; circ(cxo + Math.cos(a) * rx, cy + Math.sin(a) * ry, r); } };
  const texture = (pts, c, r = 1.6) => { fill(c); for (let i = 0; i < pts; i++) circ(-28 + rnd(i) * 56, 14 + rnd(i + 99) * 30, r); };
  fill(base);

  if (layer === 'back') {
    switch (id) {
      case 'afro': ell(0, 48, 50, 44); bumps(0, 48, 50, 44, 18, 6, base); break;
      case 'short_afro': ell(0, 48, 39, 31); bumps(0, 48, 39, 31, 14, 4.5, base); break;
      case 'puffs': circ(-34, 30, 17); circ(34, 30, 17); bumps(-34, 30, 17, 17, 9, 3.5, base); bumps(34, 30, 17, 17, 9, 3.5, base); break;
      case 'mullet': ell(0, 70, 30, 30); ctx.fillRect(X(-22), Y(70), R(44), R(56)); break;
      default: hang(ctx, cx, k, id, base, dark, 'back');
    }
    return;
  }

  switch (id) {
    case 'bald':
      fill('rgba(255,255,255,0.16)'); ell(-9, 40, 10, 5); break;
    case 'buzz':
      ell(0, 44, 29, 14, Math.PI, 0); break;
    case 'crew':
      cap(44, 27, 31); ell(0, 34, 22, 7, Math.PI, 0); break;
    case 'short':
      ell(0, 42, 32, 18, Math.PI, 0); ctx.fillRect(X(-32), Y(42), R(8), R(16)); ctx.fillRect(X(24), Y(42), R(8), R(16)); break;
    case 'caesar':
      cap(42, 28, 30.5); lineUp(38, 22); break;
    case 'waves':
      cap(42, 28, 31); lineUp(38, 23);
      clipCap(42, 28, 31, () => { strokeSet(light, 1.4); for (let r = 6; r < 40; r += 5) { ctx.beginPath(); ctx.arc(X(0), Y(26), R(r), 0, Math.PI * 2); ctx.stroke(); } });
      break;
    case 'taper':
      faded(0.45); fill(base); cap(40, 26, 25);
      for (let i = 0; i < 16; i++) { const x = -20 + (i % 6) * 8 + (i > 5 ? 4 : 0), y = 26 + Math.floor(i / 6) * 6; fill(base); circ(x, y, 4.5); fill(dark); circ(x + 1, y + 1, 1.4); }
      lineUp(38, 20); break;
    case 'curly':
      for (let i = -3; i <= 3; i++) circ(i * 10, 36 + Math.abs(i) * 3, 12); break;
    case 'short_afro':
      cap(42, 22, 33); texture(40, dark, 1.2); break;
    case 'afro':
      cap(41, 16, 33); texture(60, dark, 1.4); break;
    case 'high_top':
      faded(0.5); fill(base);
      ctx.beginPath(); ctx.moveTo(X(-25), Y(44)); ctx.lineTo(X(-28), Y(2)); ctx.lineTo(X(28), Y(2)); ctx.lineTo(X(25), Y(44)); ctx.closePath(); ctx.fill();
      texture(30, dark, 1.2); fill(base); lineUp(38, 22); break;
    case 'frohawk':
      faded(0.4); fill(base);
      for (let i = 0; i < 9; i++) circ(-9 + (i % 3) * 9, 12 + Math.floor(i / 3) * 10, 9);
      texture(20, dark, 1.1); break;
    case 'mohawk':
      faded(0.3); fill(base);
      ctx.beginPath(); ctx.moveTo(X(-9), Y(44)); for (let i = 0; i <= 6; i++) ctx.lineTo(X(-9 + i * 3), Y(i % 2 ? 4 : 14)); ctx.lineTo(X(9), Y(44)); ctx.closePath(); ctx.fill(); break;
    case 'twists':
      cap(42, 22, 33);
      for (let i = 0; i < 9; i++) { fill(i % 2 ? dark : base); ell(-26 + i * 6.5, 46 + (i % 3) * 2, 3.4, 7); }
      strokeSet(dark, 1); for (let i = 0; i < 14; i++) { const x = -26 + i * 4; ctx.beginPath(); ctx.moveTo(X(x), Y(26 + rnd(i) * 4)); ctx.lineTo(X(x + 1.5), Y(40)); ctx.stroke(); }
      break;
    case 'cornrows':
    case 'braids_back':
    case 'fulani':
      cap(42, 27, 31);
      clipCap(42, 27, 31, () => { strokeSet(dark, 1.6); for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(X(i * 7.5), Y(44)); ctx.quadraticCurveTo(X(i * 8.5), Y(32), X(i * 4), Y(20)); ctx.stroke(); } });
      if (id === 'fulani') { hang(ctx, cx, k, 'fulani', base, dark, 'front'); }
      break;
    case 'box_braids':
      cap(42, 26, 32);
      clipCap(42, 26, 32, () => { strokeSet(dark, 1); for (let x = -28; x <= 28; x += 9) { ctx.beginPath(); ctx.moveTo(X(x), Y(20)); ctx.lineTo(X(x), Y(44)); ctx.stroke(); } for (let y = 30; y < 44; y += 7) { ctx.beginPath(); ctx.moveTo(X(-32), Y(y)); ctx.lineTo(X(32), Y(y)); ctx.stroke(); } });
      hang(ctx, cx, k, 'box_braids', base, dark, 'front'); break;
    case 'locs':
    case 'freeform':
      cap(42, 24, 33); hang(ctx, cx, k, id, base, dark, 'front'); break;
    case 'loc_updo':
      cap(42, 26, 31); fill(base); ell(0, 14, 20, 14);
      strokeSet(dark, 1.4); for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(X(i * 5), Y(4)); ctx.quadraticCurveTo(X(i * 7), Y(16), X(i * 4), Y(26)); ctx.stroke(); }
      for (const s of [-1, 1]) { fill(base); ctx.fillRect(X(s * 22 - 2.5), Y(10), R(5), R(20)); }
      break;
    case 'bantu':
      cap(42, 28, 31);
      for (const [x, y] of [[-22, 34], [-9, 25], [9, 25], [22, 34], [0, 37]]) {
        fill(base); circ(x, y, 7.5); strokeSet(dark, 1.1); ctx.beginPath(); ctx.arc(X(x), Y(y), R(4), 0, Math.PI * 1.6); ctx.stroke(); ctx.beginPath(); ctx.arc(X(x + 0.5), Y(y), R(1.6), 0, Math.PI * 1.5); ctx.stroke();
      }
      break;
    case 'puff':
      cap(42, 28, 30.5); fill('rgba(255,255,255,0.14)'); ell(-8, 34, 12, 4);
      fill(base); circ(0, 12, 20); bumps(0, 12, 20, 20, 10, 4, base); texture(14, dark, 1.1);
      fill('#c4233a'); ctx.fillRect(X(-9), Y(28), R(18), R(4)); break;
    case 'puffs':
      cap(42, 28, 31); fill('rgba(255,255,255,0.12)'); ell(0, 34, 14, 4);
      fill('#c4233a'); ctx.fillRect(X(-27), Y(36), R(6), R(4)); ctx.fillRect(X(21), Y(36), R(6), R(4)); break;
    case 'silk_press':
    case 'long':
      cap(42, 26, 32); if (id === 'silk_press') { strokeSet(shade(base, -0.6), 1); ctx.beginPath(); ctx.moveTo(X(0), Y(27)); ctx.lineTo(X(0), Y(36)); ctx.stroke(); }
      hang(ctx, cx, k, id, base, dark, 'front');
      fill('rgba(255,255,255,0.18)'); ell(-12, 33, 8, 3); break;
    case 'side_part':
      cap(42, 27, 32); fill(base); ell(5, 35, 27, 10, Math.PI, 0);
      ctx.fillRect(X(-32), Y(42), R(6), R(12)); ctx.fillRect(X(26), Y(42), R(6), R(12));
      strokeSet(shade(base, -0.6), 1.3); ctx.beginPath(); ctx.moveTo(X(-13), Y(28)); ctx.lineTo(X(-14), Y(40)); ctx.stroke(); break;
    case 'slick':
      cap(42, 24, 32); ctx.fillRect(X(-32), Y(42), R(5), R(10)); ctx.fillRect(X(27), Y(42), R(5), R(10));
      clipCap(42, 24, 32, () => { strokeSet('rgba(255,255,255,0.22)', 1.2); for (const x of [-14, -4, 6, 16]) { ctx.beginPath(); ctx.moveTo(X(x), Y(40)); ctx.quadraticCurveTo(X(x * 0.8), Y(30), X(x * 0.5), Y(22)); ctx.stroke(); } }); break;
    case 'pompadour':
      faded(0.6); fill(base); cap(42, 26, 31); ell(3, 24, 28, 15); fill('rgba(255,255,255,0.2)'); ell(-4, 18, 14, 4); break;
    case 'spiky':
      cap(42, 28, 31);
      ctx.beginPath(); for (let i = -3; i <= 3; i++) { ctx.moveTo(X(i * 9 - 6), Y(34)); ctx.lineTo(X(i * 9 + rnd(i) * 3), Y(12 + Math.abs(i) * 3)); ctx.lineTo(X(i * 9 + 6), Y(34)); } ctx.fill(); break;
    case 'undercut':
      faded(0.35); fill(base);
      ctx.beginPath(); ctx.moveTo(X(-24), Y(42)); ctx.quadraticCurveTo(X(-22), Y(18), X(4), Y(18)); ctx.quadraticCurveTo(X(30), Y(18), X(32), Y(38)); ctx.quadraticCurveTo(X(14), Y(32), X(-4), Y(50)); ctx.closePath(); ctx.fill(); break;
    case 'french_crop':
      faded(0.5); fill(base); cap(42, 27, 30);
      ctx.beginPath(); ctx.moveTo(X(-26), Y(36)); ctx.lineTo(X(26), Y(36)); ctx.lineTo(X(26), Y(44)); for (let x = 26; x >= -26; x -= 4) ctx.lineTo(X(x), Y(x % 8 ? 47 : 44)); ctx.closePath(); ctx.fill(); break;
    case 'curtains':
      cap(42, 26, 32);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(s * 1), Y(30)); ctx.quadraticCurveTo(X(s * 14), Y(36), X(s * 22), Y(56)); ctx.lineTo(X(s * 33), Y(58)); ctx.lineTo(X(s * 33), Y(40)); ctx.closePath(); ctx.fill(); }
      strokeSet(shade(base, -0.6), 1); ctx.beginPath(); ctx.moveTo(X(0), Y(26)); ctx.lineTo(X(0), Y(33)); ctx.stroke(); break;
    case 'flow':
    case 'cowboy':
    case 'shag':
      cap(42, 25, 33);
      if (id === 'shag') { ctx.beginPath(); ctx.moveTo(X(-28), Y(36)); for (let x = -28; x <= 28; x += 5) ctx.lineTo(X(x), Y(x % 10 ? 50 : 44)); ctx.lineTo(X(28), Y(36)); ctx.closePath(); ctx.fill(); }
      else { ell(-6, 37, 22, 8, Math.PI, Math.PI * 2.2); }
      hang(ctx, cx, k, id, base, dark, 'front'); break;
    case 'mullet':
      cap(42, 27, 31); ctx.fillRect(X(-32), Y(42), R(6), R(18)); ctx.fillRect(X(26), Y(42), R(6), R(18)); break;
    case 'ponytail':
      cap(42, 26, 31); fill('rgba(255,255,255,0.15)'); ell(-6, 32, 14, 4);
      fill(base); ctx.beginPath(); ctx.moveTo(X(22), Y(50)); ctx.quadraticCurveTo(X(46), Y(80), X(40), Y(132)); ctx.quadraticCurveTo(X(34), Y(96), X(18), Y(60)); ctx.closePath(); ctx.fill();
      fill('#222'); ctx.fillRect(X(23), Y(54), R(7), R(4)); break;
    case 'bob':
      cap(42, 25, 34); ctx.fillRect(X(-28), Y(36), R(56), R(11));
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(s * 34), Y(42)); ctx.lineTo(X(s * 37), Y(98)); ctx.lineTo(X(s * 25), Y(100)); ctx.lineTo(X(s * 26), Y(46)); ctx.closePath(); ctx.fill(); } break;
    case 'pixie':
      cap(42, 27, 31);
      ctx.beginPath(); ctx.moveTo(X(-30), Y(40)); ctx.quadraticCurveTo(X(-6), Y(30), X(20), Y(50)); ctx.lineTo(X(26), Y(36)); ctx.closePath(); ctx.fill(); break;
    case 'bun':
      cap(42, 26, 31); circ(0, 18, 12); break;
  }
}

// hanging hair: braids, locs and long cuts. 'back' hangs behind the shoulders,
// 'front' falls past the face.
function hang(ctx, cx, k, id, base, dark, side) {
  const X = d => cx + d * k, Y = y => y * k, R = r => r * k;
  const strand = (x, y0, y1, w, beads) => {
    ctx.fillStyle = base; ctx.beginPath(); ctx.roundRect(X(x - w / 2), Y(y0), R(w), R(y1 - y0), R(w / 2)); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = R(0.9);
    for (let y = y0 + 4; y < y1 - 2; y += 4) { ctx.beginPath(); ctx.moveTo(X(x - w / 2), Y(y)); ctx.lineTo(X(x + w / 2), Y(y + 2)); ctx.stroke(); }
    if (beads) { ctx.fillStyle = '#d6a41c'; for (const y of beads) { ctx.beginPath(); ctx.arc(X(x), Y(y), R(w * 0.65), 0, Math.PI * 2); ctx.fill(); } }
  };
  const panel = (s, top, bottom, inner, outer, wavy) => {
    ctx.fillStyle = base; ctx.beginPath(); ctx.moveTo(X(s * inner), Y(top)); ctx.lineTo(X(s * outer), Y(top));
    if (wavy) { for (let y = top; y <= bottom; y += 8) ctx.lineTo(X(s * (outer + ((y / 8) % 2 ? 3 : 0))), Y(y)); }
    else ctx.lineTo(X(s * outer), Y(bottom));
    ctx.lineTo(X(s * inner), Y(bottom)); ctx.closePath(); ctx.fill();
  };
  switch (id) {
    case 'box_braids':
      if (side === 'back') for (let x = -46; x <= 46; x += 6) strand(x, 44, 158 - Math.abs(x) * 0.3, 4.4);
      else for (const s of [-1, 1]) for (let i = 0; i < 3; i++) strand(s * (30 + i * 4.5), 44, 140 - i * 6, 4.2);
      break;
    case 'braids_back':
      if (side === 'back') for (let i = 0; i < 9; i++) strand(-24 + i * 6, 60, 150 + (i % 2) * 6, 5);
      break;
    case 'fulani':
      if (side === 'back') for (let i = 0; i < 9; i++) strand(-24 + i * 6, 60, 140, 4.5);
      else for (const s of [-1, 1]) { strand(s * 31, 40, 118, 4.6, [96, 116]); strand(s * 36, 46, 104, 4, [102]); }
      break;
    case 'locs':
      if (side === 'back') for (let x = -44; x <= 44; x += 6.5) strand(x, 42, 120 + rnd(x) * 12, 6);
      else for (const s of [-1, 1]) for (let i = 0; i < 3; i++) strand(s * (28 + i * 5), 40, 112 - i * 4 + rnd(s * i + 3) * 8, 5.6);
      break;
    case 'freeform':
      if (side === 'back') for (let x = -46; x <= 46; x += 7.5) strand(x, 40, 92 + rnd(x + 7) * 50, 7.5);
      else for (const s of [-1, 1]) for (let i = 0; i < 2; i++) strand(s * (29 + i * 6), 38, 84 + rnd(s + i * 5) * 40, 7);
      break;
    case 'long':
    case 'silk_press':
      if (side === 'back') { ctx.fillStyle = base; ctx.beginPath(); ctx.roundRect(X(-40), Y(44), R(80), R(id === 'silk_press' ? 112 : 96), R(10)); ctx.fill(); }
      else for (const s of [-1, 1]) panel(s, 40, id === 'silk_press' ? 150 : 132, 26, 36, false);
      break;
    case 'flow':
    case 'cowboy':
    case 'shag':
      if (side === 'back') { ctx.fillStyle = base; ctx.beginPath(); ctx.roundRect(X(-38), Y(44), R(76), R(id === 'shag' ? 56 : 50), R(10)); ctx.fill(); }
      else for (const s of [-1, 1]) panel(s, 40, id === 'cowboy' ? 92 : 98, 27, 36, true);
      break;
    case 'bob':
      if (side === 'back') { ctx.fillStyle = base; ctx.beginPath(); ctx.roundRect(X(-38), Y(44), R(76), R(56), R(12)); ctx.fill(); }
      break;
  }
}

// face: brows, eyes, ears, facial hair. Drawn over the head, under any mask.
export function drawFace(ctx, cx, k, look) {
  const X = d => cx + d * k, Y = y => y * k, R = r => r * k;
  const skin = look.skin || '#c68e65', hair = look.hair || '#111';
  // ears
  ctx.fillStyle = shade(skin, -0.08);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(X(s * 30), Y(68), R(5), R(8), 0, 0, Math.PI * 2); ctx.fill(); }
  // eyes
  const eye = look.eyes || '#2a1a10';
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#f1ece4'; ctx.fillRect(X(s * 11 - 4.5), Y(61), R(9), R(6));
    ctx.fillStyle = eye; ctx.fillRect(X(s * 11 - 2.2), Y(61), R(4.4), R(6));
    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(X(s * 11 - 1), Y(62.5), R(2), R(3));
  }
  // brows
  const brow = look.brows || 'natural';
  const bh = brow === 'thick' ? 4 : brow === 'thin' ? 1.6 : 2.6;
  ctx.fillStyle = shade(hair === '#9a9a9a' ? '#555' : hair, -0.15);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(X(s * 4), Y(56)); ctx.lineTo(X(s * 17), Y(54.5)); ctx.lineTo(X(s * 17), Y(54.5 + bh)); ctx.lineTo(X(s * 4), Y(56 + bh)); ctx.closePath(); ctx.fill();
  }
  if (brow === 'slit') { ctx.fillStyle = skin; ctx.fillRect(X(-12), Y(53), R(1.6), R(7)); }
  // nose
  ctx.fillStyle = shade(skin, -0.18); ctx.fillRect(X(-3), Y(72), R(6), R(3));
  // facial hair, then the mouth on top
  const fh = look.facialHair || 'none';
  ctx.fillStyle = hair;
  const jaw = (top, a) => { ctx.save(); ctx.beginPath(); ctx.ellipse(X(0), Y(66), R(30.5), R(36.5), 0, 0, Math.PI * 2); ctx.clip(); ctx.globalAlpha = a; ctx.fillRect(X(-31), Y(top), R(62), R(50)); ctx.restore(); };
  const stache = () => { ctx.beginPath(); ctx.moveTo(X(-13), Y(82)); ctx.quadraticCurveTo(X(0), Y(76), X(13), Y(82)); ctx.lineTo(X(11), Y(84)); ctx.quadraticCurveTo(X(0), Y(80), X(-11), Y(84)); ctx.closePath(); ctx.fill(); };
  if (fh === 'stubble') { jaw(76, 0.3); ctx.save(); ctx.globalAlpha = 0.3; stache(); ctx.restore(); }
  if (fh === 'mustache') stache();
  if (fh === 'goatee') { stache(); ctx.beginPath(); ctx.ellipse(X(0), Y(95), R(9), R(8), 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(X(-11), Y(82), R(3), R(12)); ctx.fillRect(X(8), Y(82), R(3), R(12)); }
  if (fh === 'chinstrap') { ctx.strokeStyle = hair; ctx.lineWidth = R(4); ctx.beginPath(); ctx.ellipse(X(0), Y(66), R(28.5), R(34.5), 0, 0.05 * Math.PI, 0.95 * Math.PI); ctx.stroke(); }
  if (fh === 'beard' || fh === 'long_beard') {
    // jaw from sideburn to sideburn, cheeks left clear
    ctx.beginPath(); ctx.ellipse(X(0), Y(66), R(30.5), R(36.5), 0, -0.12 * Math.PI, 1.12 * Math.PI);
    ctx.lineTo(X(-24), Y(53)); ctx.lineTo(X(-23), Y(72)); ctx.quadraticCurveTo(X(-14), Y(80), X(0), Y(78)); ctx.quadraticCurveTo(X(14), Y(80), X(23), Y(72)); ctx.lineTo(X(24), Y(53)); ctx.closePath(); ctx.fill();
    stache();
    if (fh === 'long_beard') { ctx.beginPath(); ctx.moveTo(X(-22), Y(94)); ctx.quadraticCurveTo(X(-16), Y(126), X(0), Y(136)); ctx.quadraticCurveTo(X(16), Y(126), X(22), Y(94)); ctx.closePath(); ctx.fill(); }
  }
  // mouth (gold with a grill)
  if (hasExtra(look, 'grill')) {
    ctx.fillStyle = '#e2b437'; ctx.fillRect(X(-9), Y(83.5), R(18), R(4.5));
    ctx.fillStyle = 'rgba(120,80,0,0.6)'; for (let x = -6; x <= 6; x += 4) ctx.fillRect(X(x), Y(83.5), R(0.8), R(4.5));
    ctx.fillStyle = '#fff'; ctx.fillRect(X(-4), Y(84), R(1.4), R(1.4));
  } else { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(X(-8), Y(84), R(16), R(3)); }
  if (hasExtra(look, 'freckles')) { ctx.fillStyle = shade(skin, -0.3); for (let i = 0; i < 14; i++) { const s = i % 2 ? 1 : -1; ctx.fillRect(X(s * (8 + rnd(i) * 12)), Y(70 + rnd(i + 5) * 8), R(1.4), R(1.4)); } }
  if (hasExtra(look, 'teardrop')) { ctx.fillStyle = '#141a2a'; ctx.beginPath(); ctx.moveTo(X(-12), Y(69)); ctx.quadraticCurveTo(X(-9), Y(74), X(-12), Y(75)); ctx.quadraticCurveTo(X(-15), Y(74), X(-12), Y(69)); ctx.fill(); }
}

// extras that sit on top of everything: shades, studs, chains, neck tat, durag
export function drawExtras(ctx, cx, k, look, { hatOn, masked, topColor }) {
  const X = d => cx + d * k, Y = y => y * k, R = r => r * k;
  if (hasExtra(look, 'neck_tat') && !masked) {
    ctx.strokeStyle = 'rgba(20,24,40,0.75)'; ctx.lineWidth = R(1.2);
    ctx.beginPath(); ctx.moveTo(X(-8), Y(98)); ctx.quadraticCurveTo(X(0), Y(94), X(8), Y(98)); ctx.moveTo(X(-6), Y(104)); ctx.lineTo(X(6), Y(104)); ctx.moveTo(X(0), Y(96)); ctx.lineTo(X(0), Y(110)); ctx.stroke();
  }
  if (hasExtra(look, 'chain') || hasExtra(look, 'cuban')) {
    const cuban = hasExtra(look, 'cuban');
    ctx.strokeStyle = '#e2b437'; ctx.lineWidth = R(cuban ? 4.5 : 2);
    ctx.beginPath(); ctx.moveTo(X(-16), Y(110)); ctx.quadraticCurveTo(X(0), Y(cuban ? 132 : 148), X(16), Y(110)); ctx.stroke();
    if (cuban) { ctx.strokeStyle = 'rgba(120,80,0,0.6)'; ctx.lineWidth = R(0.8); for (let i = 0; i < 9; i++) { const t = i / 8, x = -16 + 32 * t, y = 110 + 44 * t * (1 - t); ctx.beginPath(); ctx.moveTo(X(x - 1.5), Y(y - 2)); ctx.lineTo(X(x + 1.5), Y(y + 2)); ctx.stroke(); } }
    else { ctx.fillStyle = '#e2b437'; ctx.beginPath(); ctx.arc(X(0), Y(134), R(6), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9fe6ff'; ctx.beginPath(); ctx.arc(X(0), Y(134), R(2.6), 0, Math.PI * 2); ctx.fill(); }
  }
  if (masked) return;
  if (hasExtra(look, 'studs')) { ctx.fillStyle = '#dff6ff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(X(s * 31), Y(75), R(2.3), 0, Math.PI * 2); ctx.fill(); } }
  if (hasExtra(look, 'shades')) {
    ctx.fillStyle = '#0d0d10';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(X(s * 11 - 9), Y(57), R(18), R(11), R(3)); ctx.fill(); }
    ctx.fillRect(X(-3), Y(59), R(6), R(2)); ctx.fillRect(X(-30), Y(59), R(10), R(2)); ctx.fillRect(X(20), Y(59), R(10), R(2));
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; for (const s of [-1, 1]) ctx.fillRect(X(s * 11 - 6), Y(59), R(5), R(2));
  } else if (hasExtra(look, 'glasses')) {
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = R(1.8);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(X(s * 11 - 8), Y(57.5), R(16), R(11), R(3)); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(X(-3), Y(61)); ctx.lineTo(X(3), Y(61)); ctx.moveTo(X(-19), Y(61)); ctx.lineTo(X(-30), Y(60)); ctx.moveTo(X(19), Y(61)); ctx.lineTo(X(30), Y(60)); ctx.stroke();
  }
  if (hasExtra(look, 'durag') && !hatOn) {
    const c = topColor || '#1d1d22';
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(X(0), Y(44), R(33), R(19), 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(X(-33), Y(40), R(66), R(6));
    ctx.fillStyle = shade(c, 0.25); ctx.fillRect(X(-2), Y(26), R(4), R(18));
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.ellipse(X(-10), Y(32), R(10), R(4), -0.3, 0, Math.PI * 2); ctx.fill();
  }
}

// top-down hair for the walker (forward is -y, the back of the head is +y)
export function drawHairTop(ctx, s, look) {
  const def = HAIR_BY_ID[look.hairStyle];
  const td = def?.td || 'cap';
  const base = look.hair || '#222';
  const circ = (x, y, r) => { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill(); };
  if (hasExtra(look, 'durag')) { ctx.fillStyle = '#1d1d22'; circ(0, 0.03, 0.115); ctx.fillRect(-0.03 * s, 0.1 * s, 0.06 * s, 0.12 * s); return; }
  ctx.fillStyle = base;
  switch (td) {
    case 'none': ctx.fillStyle = 'rgba(255,255,255,0.18)'; circ(-0.03, -0.02, 0.04); return;
    case 'big': circ(0, 0.03, look.hairStyle === 'afro' ? 0.18 : 0.15); return;
    case 'tall': circ(0, 0.02, 0.125); ctx.fillStyle = shade(base, 0.15); circ(0, 0.02, 0.08); return;
    case 'mohawk': ctx.globalAlpha = 0.5; circ(0, 0.03, 0.11); ctx.globalAlpha = 1; ctx.fillRect(-0.03 * s, -0.1 * s, 0.06 * s, 0.22 * s); return;
    case 'puffs': circ(0, 0.03, 0.11); circ(-0.11, 0.02, 0.06); circ(0.11, 0.02, 0.06); return;
    case 'bun': circ(0, 0.03, 0.11); circ(0, 0.12, 0.06); return;
    case 'tail': circ(0, 0.03, 0.11); ctx.fillRect(-0.03 * s, 0.1 * s, 0.06 * s, 0.16 * s); return;
    case 'long': circ(0, 0.03, 0.12); ctx.beginPath(); ctx.ellipse(0, 0.12 * s, 0.12 * s, 0.11 * s, 0, 0, Math.PI * 2); ctx.fill(); return;
    case 'locs': circ(0, 0.03, 0.125); for (let i = -3; i <= 3; i++) ctx.fillRect((i * 0.035 - 0.012) * s, 0.06 * s, 0.024 * s, (0.15 + (i & 1) * 0.04) * s); return;
    default: circ(0, 0.03, 0.11);
  }
}
