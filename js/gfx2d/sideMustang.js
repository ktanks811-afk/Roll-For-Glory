// Side-view pixel Mustang for the Garage showroom, built from separate layers
// so every part you install shows up on the car:
//
//   body · paint/finish · windows/tint · hood · front bumper/splitter · rear
//   bumper/diffuser · side skirts · spoiler · headlights · taillights · exhaust
//   tips · front wheels · rear wheels · brake calipers · wheel size & offset ·
//   suspension (ride height) · decals/liveries · underglow · engine bay
//
// Geometry is drawn in the coordinates of the reference art (1983×793) and
// scaled down onto a tiny canvas, then alpha-thresholded so the edges stay
// crisp pixel art when the canvas is stretched up with `image-rendering:
// pixelated`.
import { drawRimSprite, rimHasTire } from './rimSprites.js';

import { CALIPER_COLORS } from '../data/parts.js';

export const SIDE_VIEW_CARS = new Set(['ford_mustang_gt_s650_2024', 'ford_mustang_dark_horse_2024']);
export const hasSideView = modelId => SIDE_VIEW_CARS.has(modelId);

export const LW = 990, LH = 396;              // logical pixels
const K = LW / 1983;
const GROUND = 700;                           // y of the road in reference px
const TIRE_R = 143;                           // overall tyre radius
const FRONT_X = 412, REAR_X = 1510;

// ----- colour helpers -----
export const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const n = m ? parseInt(m[1], 16) : 0x888888; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgb = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
export const mix = (c, to, t) => c.map((v, i) => v + (to[i] - v) * t);
export const lighten = (c, t) => mix(c, [255, 255, 255], t);
export const darken = (c, t) => mix(c, [0, 0, 0], t);

export function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
export function fillPoly(g, pts, fill) { poly(g, pts); g.fillStyle = fill; g.fill(); }

const BODY = [[52, 560], [48, 480], [60, 410], [92, 372], [110, 364], [260, 318], [400, 292], [560, 276], [668, 274], [706, 268], [880, 205], [990, 135], [1060, 124], [1330, 128], [1400, 165], [1500, 200], [1620, 242], [1722, 262], [1745, 258], [1905, 246], [1902, 268], [1860, 292], [1905, 305], [1916, 400], [1926, 500], [1916, 565], [1860, 600], [1700, 614], [1350, 610], [580, 612], [250, 614], [90, 610], [60, 590]];
const FRONT_WINDOW = [[872, 298], [1000, 182], [1012, 175], [1250, 196], [1245, 298]];
const REAR_WINDOW = [[1272, 205], [1430, 236], [1478, 298], [1262, 298]];

// deterministic sparkle for metallic paint
function sparkle(g, color) {
  let s = 91;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 160; i++) {
    g.fillStyle = rgb(lighten(color, 0.55), 0.35 + rnd() * 0.3);
    g.fillRect(100 + rnd() * 1800, 150 + rnd() * 440, 9, 9);
  }
}

// ------------------------------------------------------------------ layers
function paintBody(g, v, dropY) {
  const base = hex(v.paint);
  const finish = v.finish || 'gloss';
  g.save();
  poly(g, BODY); g.clip();
  // base + lower shading in hard pixel bands
  if (finish === 'chrome') {
    const gr = g.createLinearGradient(0, 120, 0, 620);
    gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(0.45, '#9aa2ab'); gr.addColorStop(0.5, '#2c3036'); gr.addColorStop(0.62, '#8c939c'); gr.addColorStop(1, '#d6dade');
    g.fillStyle = gr; g.fillRect(0, 0, 2000, 800);
  } else {
    g.fillStyle = rgb(base); g.fillRect(0, 0, 2000, 800);
    g.fillStyle = rgb(darken(base, 0.18), 0.9); g.fillRect(0, 470, 2000, 200);                      // lower body
    g.fillStyle = rgb(darken(base, 0.32), 0.9); g.fillRect(0, 565, 2000, 80);                        // rocker shadow
    if (finish === 'pearl') { g.fillStyle = rgb(mix(base, [255, 120, 200], 0.35), 0.35); g.fillRect(0, 300, 2000, 90); g.fillStyle = rgb(mix(base, [120, 200, 255], 0.35), 0.3); g.fillRect(0, 390, 2000, 70); }
    if (finish !== 'matte') {
      g.fillStyle = rgb(lighten(base, 0.22), 0.85);                                                  // shoulder highlight
      poly(g, [[705, 336], [1200, 322], [1700, 296], [1700, 318], [1200, 346], [705, 360]]); g.fill();
      poly(g, [[110, 376], [400, 312], [668, 296], [668, 308], [400, 330], [120, 392]]); g.fill();   // hood highlight
      g.fillStyle = rgb(lighten(base, 0.5), 0.55);
      poly(g, [[1060, 132], [1320, 136], [1330, 150], [1060, 146]]); g.fill();                       // roof glint
    } else {
      g.fillStyle = rgb(lighten(base, 0.07), 0.8);
      poly(g, [[705, 340], [1700, 306], [1700, 322], [705, 356]]); g.fill();
    }
    if (finish === 'metallic') sparkle(g, base);
  }
  g.restore();
  // panel gaps and details, always dark
  g.strokeStyle = 'rgba(10,10,12,0.85)'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(706, 340); g.lineTo(712, 588); g.moveTo(1250, 300); g.lineTo(1256, 560); g.stroke();   // door shut lines
  g.beginPath(); g.moveTo(706, 340); g.quadraticCurveTo(690, 300, 700, 270); g.stroke();                         // fender line
  g.lineWidth = 5; g.beginPath(); g.moveTo(1693 - 30, 360); g.arc(1693, 360, 30, Math.PI, Math.PI * 3); g.stroke();      // fuel door
  fillPoly(g, [[1125, 352], [1230, 352], [1235, 378], [1130, 380]], rgb(darken(base, 0.55)));                    // handle
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(1130, 352, 100, 5);
}

function paintWindows(g, v) {
  const tint = { none: 0.55, light: 0.68, medium: 0.8, limo: 0.94 }[v.tint] ?? 0.55;
  const glass = rgb([14, 20, 30], tint);
  fillPoly(g, FRONT_WINDOW, glass); fillPoly(g, REAR_WINDOW, glass);
  g.fillStyle = `rgba(150,170,190,${0.22 * (1 - tint)})`;
  poly(g, [[930, 296], [1010, 196], [1050, 196], [980, 296]]); g.fill();
  // pillars + roof trim
  g.strokeStyle = 'rgba(8,8,10,0.9)'; g.lineWidth = 8; g.lineJoin = 'round';
  poly(g, FRONT_WINDOW); g.stroke(); poly(g, REAR_WINDOW); g.stroke();
  // mirror
  fillPoly(g, [[812, 262], [886, 258], [892, 300], [816, 302]], '#16181c');
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(820, 264, 60, 6);
}

function paintHood(g, v) {
  const base = hex(v.paint), dark = rgb(darken(base, 0.55));
  if (v.hood === 'cowl') fillPoly(g, [[470, 282], [640, 270], [668, 274], [650, 296], [490, 304]], dark);
  if (v.hood === 'scoop') { fillPoly(g, [[380, 296], [560, 270], [610, 270], [610, 296], [440, 312]], rgb(darken(base, 0.2))); fillPoly(g, [[560, 276], [608, 272], [608, 292], [566, 296]], '#0a0a0c'); }
  if (v.hood === 'vented') for (let i = 0; i < 5; i++) fillPoly(g, [[330 + i * 50, 318 - i * 7], [352 + i * 50, 316 - i * 7], [352 + i * 50, 326 - i * 7], [330 + i * 50, 328 - i * 7]], '#0a0a0c');
}

function paintFront(g, v) {
  const base = hex(v.paint);
  // lower intake + bumper
  fillPoly(g, [[56, 470], [200, 520], [236, 596], [60, 590]], '#0e0f12');
  g.strokeStyle = 'rgba(70,74,82,0.8)'; g.lineWidth = 3;
  for (let y = 490; y < 590; y += 16) { g.beginPath(); g.moveTo(66, y); g.lineTo(200 + (y - 490) * 0.3, y + 14); g.stroke(); }
  // grille opening + pony badge
  fillPoly(g, [[58, 410], [150, 432], [140, 470], [56, 462]], '#101114');
  g.fillStyle = '#7d828a'; g.fillRect(84, 436, 26, 14);
  // marker light
  fillPoly(g, [[230, 514], [248, 516], [246, 548], [230, 548]], '#ff9a1a');
  // lip / splitter
  if (v.frontBumper === 'sport') fillPoly(g, [[44, 600], [260, 618], [255, 634], [48, 622]], '#0a0a0c');
  if (v.frontBumper === 'splitter') { fillPoly(g, [[30, 604], [300, 622], [296, 640], [30, 626]], '#0a0a0c'); g.fillStyle = rgb(hex('#ff2a3a'), 0.9); g.fillRect(34, 612, 250, 5); }
  if (v.kit === 'street' || v.kit === 'wide') fillPoly(g, [[44, 598], [250, 616], [250, 628], [44, 614]], '#0a0a0c');
  void base;
}

function paintRear(g, v) {
  const base = hex(v.paint);
  // diffuser + lower valance
  fillPoly(g, [[1700, 540], [1922, 520], [1912, 580], [1862, 612], [1710, 616]], '#0e0f12');
  g.strokeStyle = 'rgba(70,74,82,0.8)'; g.lineWidth = 3;
  for (let x = 1730; x < 1900; x += 24) { g.beginPath(); g.moveTo(x, 548); g.lineTo(x + 6, 606); g.stroke(); }
  if (v.rearBumper === 'diffuser') { fillPoly(g, [[1690, 596], [1930, 580], [1925, 640], [1700, 636]], '#0a0a0c'); for (let x = 1730; x < 1910; x += 28) fillPoly(g, [[x, 600], [x + 8, 598], [x + 14, 636], [x + 4, 636]], '#2a2d33'); }
  if (v.rearBumper === 'sport') fillPoly(g, [[1700, 606], [1925, 590], [1920, 618], [1706, 626]], '#0a0a0c');
  // marker
  fillPoly(g, [[1676, 504], [1696, 504], [1698, 556], [1678, 556]], '#e0192e');
  // exhaust tips
  const tips = { single: [[1878, 600, 22]], dual: [[1852, 598, 20], [1900, 596, 20]], quad: [[1832, 598, 15], [1860, 598, 15], [1888, 596, 15], [1912, 594, 15]], cannon: [[1866, 590, 30]] }[v.exhaustTips || 'dual'] || [[1878, 600, 22]];
  for (const [x, y, r] of tips) {
    g.fillStyle = '#1a1c20'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = '#b9bec6'; g.beginPath(); g.arc(x, y, r - 4, 0, 7); g.fill();
    g.fillStyle = '#050506'; g.beginPath(); g.arc(x, y, r - 9, 0, 7); g.fill();
  }
  void base;
}

function paintSkirts(g, v) {
  const base = hex(v.paint);
  fillPoly(g, [[560, 572], [1350, 568], [1335, 612], [580, 614]], '#101114');                       // factory rocker trim
  if (v.skirts === 'sport') fillPoly(g, [[560, 590], [1360, 586], [1350, 626], [572, 630]], rgb(darken(base, 0.7)));
  if (v.skirts === 'aero') { fillPoly(g, [[540, 586], [1380, 580], [1368, 636], [552, 640]], '#0a0a0c'); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(560, 592, 800, 4); }
  if (v.kit === 'street' || v.kit === 'wide') fillPoly(g, [[560, 596], [1360, 592], [1352, 628], [572, 632]], '#0a0a0c');
}

function paintSpoiler(g, v) {
  const base = hex(v.paint);
  const sp = v.spoiler;
  if (sp === 'none') { fillPoly(g, [[1725, 258], [1860, 276], [1860, 288], [1725, 270]], rgb(darken(base, 0.1))); return; }   // plain deck
  const body = rgb(darken(base, 0.45));
  if (sp === 'lip') fillPoly(g, [[1730, 250], [1890, 244], [1894, 262], [1740, 266]], body);
  if (sp === 'duck') fillPoly(g, [[1728, 236], [1905, 222], [1910, 254], [1738, 262]], body);
  if (sp === 'gt') {
    fillPoly(g, [[1700, 150], [1930, 134], [1936, 170], [1706, 186]], '#0c0d10');
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(1710, 154, 210, 5);
    fillPoly(g, [[1770, 186], [1790, 186], [1796, 262], [1774, 262]], '#0c0d10'); fillPoly(g, [[1850, 178], [1870, 176], [1874, 258], [1854, 258]], '#0c0d10');
  }
  if (sp === 'drag') { fillPoly(g, [[1700, 204], [1930, 190], [1934, 232], [1706, 246]], '#0c0d10'); fillPoly(g, [[1912, 150], [1936, 150], [1938, 232], [1914, 232]], '#0c0d10'); }
}

function paintLights(g, v) {
  const head = { halogen: ['#ffe9b0', '#fff4d0'], xenon: ['#cfe4ff', '#f2f8ff'], led: ['#ffffff', '#ffffff'], yellow: ['#ffc21a', '#ffd966'] }[v.headlights] || ['#ffe9b0', '#fff4d0'];
  fillPoly(g, [[108, 392], [244, 392], [252, 426], [128, 434]], '#101114');
  g.fillStyle = head[0]; for (let i = 0; i < 3; i++) fillPoly(g, [[124 + i * 38, 398], [150 + i * 38, 398], [156 + i * 38, 412], [130 + i * 38, 412]], head[0]);
  g.fillStyle = head[1]; g.fillRect(126, 416, 112, 5);
  if (v.headlights === 'led' || v.headlights === 'xenon') { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(120, 408, 70, 0, 7); g.fill(); }
  // tail lights
  const smoked = v.taillights === 'smoked', bar = v.taillights === 'bar';
  const red = smoked ? '#6a0e16' : '#e0192e';
  fillPoly(g, [[1812, 326], [1884, 328], [1894, 394], [1828, 388]], '#1a0b0d');
  for (let i = 0; i < 3; i++) fillPoly(g, [[1818 + i * 22, 334 + i * 4], [1834 + i * 22, 334 + i * 4], [1838 + i * 22, 384], [1824 + i * 22, 382]], bar ? '#ff3b4a' : red);
  if (bar) { g.fillStyle = '#ff6a74'; g.fillRect(1818, 350, 74, 7); }
}

function paintBadges(g) {
  g.fillStyle = '#d8dbe0'; g.font = 'bold 40px sans-serif'; g.textBaseline = 'alphabetic';
  g.fillText('5.0', 606, 418);
}

function paintDecals(g, v) {
  const col = rgb(hex(v.decalColor || '#f2f2f2'), 0.95);
  g.save(); poly(g, BODY); g.clip();
  if (v.decal === 'stripes') { fillPoly(g, [[110, 366], [668, 276], [668, 294], [120, 384]], col); fillPoly(g, [[1000, 130], [1330, 134], [1330, 150], [1000, 146]], col); fillPoly(g, [[1620, 244], [1740, 262], [1740, 276], [1620, 258]], col); }
  if (v.decal === 'side') { fillPoly(g, [[260, 520], [1900, 470], [1900, 500], [260, 548]], col); }
  if (v.decal === 'number') { g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(960, 470, 60, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = 'bold 78px sans-serif'; g.textAlign = 'center'; g.fillText('7', 960, 498); g.textAlign = 'left'; }
  if (v.decal === 'flames') {
    g.fillStyle = '#ff9a1a'; poly(g, [[700, 560], [760, 420], [800, 470], [850, 380], [890, 450], [960, 360], [1000, 450], [1080, 400], [1100, 560]]); g.fill();
    g.fillStyle = '#e0192e'; poly(g, [[720, 560], [770, 470], [810, 510], [850, 440], [900, 520], [960, 430], [1000, 520], [1070, 470], [1080, 560]]); g.fill();
  }
  if (v.decal === 'crew') { fillPoly(g, [[240, 500], [1900, 452], [1900, 480], [240, 530]], col); g.fillStyle = '#111'; g.fillRect(1320, 470, 80, 6); }
  g.restore();
}

// --- wheels ---
function wheelRimFraction(size) { return Math.max(0.5, Math.min(0.8, 0.54 + (size - 17) * 0.045)); }

export function drawWheel(g, cx, cy, v, size, offset, caliper, kind, R0 = TIRE_R) {
  const R = R0 * (1 + (offset === 'poke' ? 0.028 : offset === 'stock' ? -0.02 : 0));
  const rimR = R * wheelRimFraction(size);
  if (v.rim && drawRimWheel(g, cx, cy, v, R, rimR, kind)) return;
  // tyre
  g.fillStyle = '#0b0b0d'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.strokeStyle = '#1b1c20'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, R - 6, 0, 7); g.stroke();
  // brake disc + caliper sit behind the spokes
  g.fillStyle = '#5b5f66'; g.beginPath(); g.arc(cx, cy, rimR * 0.92, 0, 7); g.fill();
  g.fillStyle = '#2b2d33'; g.beginPath(); g.arc(cx, cy, rimR * 0.62, 0, 7); g.fill();
  const rim = hex(v.wheelColor || '#9aa0a8');
  const style = v.wheels || 'steel';
  g.save(); g.translate(cx, cy);
  // caliper (behind the spokes, top-rear of the disc)
  g.fillStyle = caliper; poly(g, [[rimR * 0.2, -rimR * 0.9], [rimR * 0.9, -rimR * 0.5], [rimR * 0.98, rimR * 0.1], [rimR * 0.5, -rimR * 0.3]]); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(rimR * 0.52, -rimR * 0.62, rimR * 0.22, rimR * 0.05);
  // rim barrel
  g.strokeStyle = rgb(rim); g.lineWidth = Math.max(8, rimR * 0.1); g.beginPath(); g.arc(0, 0, rimR - 6, 0, 7); g.stroke();
  const spokes = { five: 5, six: 6, split: 10, turbine: 8, mesh: 14, dish: 0, steel: 0 }[style] ?? 6;
  g.fillStyle = rgb(rim); g.strokeStyle = rgb(rim); g.lineCap = 'round';
  if (style === 'dish' || style === 'steel') {
    g.fillStyle = rgb(darken(rim, 0.15)); g.beginPath(); g.arc(0, 0, rimR * 0.82, 0, 7); g.fill();
    g.fillStyle = rgb(darken(rim, 0.45)); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * rimR * 0.5, Math.sin(a) * rimR * 0.5, rimR * 0.1, 0, 7); g.fill(); }
  } else if (style === 'mesh') {
    g.lineWidth = 7; for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * rimR * 0.94, Math.sin(a) * rimR * 0.94); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.arc(0, 0, rimR * 0.6, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, rimR * 0.35, 0, 7); g.stroke();
  } else {
    // spokes: V-shaped pairs like the stock 6-spoke, thick near the rim
    for (let i = 0; i < spokes; i++) {
      const a = i / spokes * Math.PI * 2 + (kind === 'rear' ? 0.2 : 0);
      const tw = style === 'split' ? 0.07 : style === 'turbine' ? 0.12 : 0.17;
      const ca = Math.cos(a), sa = Math.sin(a), cl = Math.cos(a + tw), sl = Math.sin(a + tw), cr = Math.cos(a - tw), sr = Math.sin(a - tw);
      const sweep = style === 'turbine' ? 0.25 : 0;
      poly(g, [[ca * rimR * 0.18, sa * rimR * 0.18], [Math.cos(a - sweep) * rimR * 0.5 + cr * 0, Math.sin(a - sweep) * rimR * 0.5], [cr * rimR * 0.94, sr * rimR * 0.94], [cl * rimR * 0.94, sl * rimR * 0.94], [Math.cos(a + sweep) * rimR * 0.5, Math.sin(a + sweep) * rimR * 0.5]]);
      g.fill();
    }
  }
  g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(0, 0, rimR * 0.2, 0, 7); g.fill();
  g.fillStyle = '#6b6f78'; g.beginPath(); g.arc(0, 0, rimR * 0.1, 0, 7); g.fill();
  g.restore();
}

// A wheel from the Glitch rim pack (gfx2d/rimSprites.js). Sheet-2 wheels
// carry their own tire, so they fill the whole tire circle.
function drawRimWheel(g, cx, cy, v, R, rimR, kind) {
  g.save(); g.translate(cx, cy); g.rotate(kind === 'rear' ? 0.35 : 0);
  if (rimHasTire(v.rim)) {
    g.fillStyle = '#0b0b0d'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    const ok = drawRimSprite(g, v.rim, R * 1.02);
    g.restore(); return ok;
  }
  g.fillStyle = '#0b0b0d'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  g.strokeStyle = '#1b1c20'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, R - 6, 0, 7); g.stroke();
  const ok = drawRimSprite(g, v.rim, rimR * 1.04);
  g.restore(); return ok;
}

export function wheelArch(g, cx, cy, v, flare, TIRE_R = 143) {
  const base = hex(v.paint);
  g.save();
  // dark well
  g.fillStyle = '#050506'; g.beginPath(); g.arc(cx, cy, TIRE_R + 24 + flare, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(cx + TIRE_R + 24 + flare, cy); g.lineTo(cx - TIRE_R - 24 - flare, cy); g.closePath(); g.fill();
  g.restore();
}
export function archLip(g, cx, cy, v, flare, TIRE_R = 143) {
  const base = hex(v.paint);
  g.strokeStyle = rgb(darken(base, 0.35)); g.lineWidth = 12 + flare * 0.3;
  g.beginPath(); g.arc(cx, cy, TIRE_R + 28 + flare, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
  g.strokeStyle = rgb(lighten(base, 0.18), v.finish === 'matte' ? 0.2 : 0.6); g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy, TIRE_R + 36 + flare, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
}

// --- engine bay cut-away ---
export function drawEngineBay(g, v, lv) {
  // bay: cut out of the front end
  fillPoly(g, [[96, 372], [668, 276], [668, 560], [150, 560], [92, 470]], '#1b1d22');
  g.strokeStyle = '#2a2c33'; g.lineWidth = 4; poly(g, [[96, 372], [668, 276], [668, 560], [150, 560], [92, 470]]); g.stroke();
  // the hood swings up on its hinges at the cowl
  const piv = [668, 276], th = 0.55, c = Math.cos(th), sn = Math.sin(th);
  const rot = ([x, y]) => { const vx = x - piv[0], vy = y - piv[1]; return [piv[0] + vx * c - vy * sn, piv[1] + vx * sn + vy * c]; };
  const slab = [[110, 364], [668, 276], [668, 300], [130, 392]].map(rot);
  fillPoly(g, slab, rgb(darken(hex(v.paint), 0.1)));
  g.strokeStyle = 'rgba(10,10,12,0.95)'; g.lineWidth = 6; poly(g, slab); g.stroke();
  const [hx, hy] = rot([300, 330]); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(hx - 40, hy - 12, 80, 6);
  // radiator / intercooler
  fillPoly(g, [[100, 400], [150, 400], [150, 520], [104, 520]], '#23262c');
  g.strokeStyle = '#3a3e46'; g.lineWidth = 3; for (let y = 410; y < 520; y += 12) { g.beginPath(); g.moveTo(104, y); g.lineTo(148, y); g.stroke(); }
  if (lv.intercooler > 0) { fillPoly(g, [[84, 380], [120, 380], [120, 540], [88, 540]], '#c0c4cc'); g.strokeStyle = '#555a63'; for (let y = 390; y < 540; y += 14) { g.beginPath(); g.moveTo(88, y); g.lineTo(118, y); g.stroke(); } }
  // headers / exhaust manifolds
  const longTube = lv.exhaust >= 2;
  g.strokeStyle = longTube ? '#d9dde3' : '#4a3a30'; g.lineWidth = longTube ? 14 : 22; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(290 + i * 62, 500); g.bezierCurveTo(290 + i * 62, 556, 400, 556, 520, 548); g.stroke(); }
  // block + heads + rocker covers
  fillPoly(g, [[250, 430], [600, 430], [610, 540], [240, 540]], '#3d414a');
  g.fillStyle = '#4b505a'; g.fillRect(270, 440, 320, 8); g.fillStyle = '#2c2f36'; for (let x = 270; x < 590; x += 40) g.fillRect(x, 460, 22, 60);
  fillPoly(g, [[250, 392], [600, 392], [600, 430], [250, 430]], lv.engine >= 2 ? '#d4d8de' : '#2a2d33');
  g.fillStyle = lv.engine >= 2 ? '#8a9099' : '#e0192e'; g.fillRect(280, 396, 290, 10);
  // intake manifold
  fillPoly(g, [[300, 346], [560, 340], [570, 392], [300, 392]], lv.intake >= 2 ? '#c8ccd2' : '#2e3139');
  // supercharger / turbo
  if (lv.supercharger > 0) {
    fillPoly(g, [[330, 280], [520, 270], [540, 346], [330, 348]], '#b9bec6'); fillPoly(g, [[300, 300], [336, 296], [336, 340], [300, 342]], '#e0192e');
    g.strokeStyle = '#5b606a'; g.lineWidth = 4; for (let x = 350; x < 520; x += 24) { g.beginPath(); g.moveTo(x, 280); g.lineTo(x + 4, 346); g.stroke(); }
    g.fillStyle = '#e0192e'; g.beginPath(); g.arc(318, 320, 22, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(318, 320, 8, 0, 7); g.fill();
  }
  if (lv.turbo > 0) {
    g.fillStyle = '#7b4a2c'; g.beginPath(); g.arc(214, 470, 46, 0, 7); g.fill(); g.fillStyle = '#c0c4cc'; g.beginPath(); g.arc(214, 470, 26, 0, 7); g.fill();
    g.strokeStyle = '#c0c4cc'; g.lineWidth = 16; g.beginPath(); g.moveTo(170, 470); g.lineTo(120, 450); g.stroke();
  }
  // cold-air intake
  if (lv.intake > 0) {
    g.strokeStyle = '#d9dde3'; g.lineWidth = 26; g.lineCap = 'butt'; g.beginPath(); g.moveTo(190, 330); g.quadraticCurveTo(250, 320, 300, 350); g.stroke();
    fillPoly(g, [[140, 300], [200, 310], [200, 360], [140, 372]], '#e0192e');
  }
  // nitrous line
  if (lv.nitrous > 0) { g.strokeStyle = '#3a6bff'; g.lineWidth = 7; g.beginPath(); g.moveTo(560, 470); g.bezierCurveTo(620, 480, 640, 420, 600, 400); g.stroke(); }
}

// ------------------------------------------------------------------ main
// opts: { visual, levels, cond, showEngine, layers: {name:false to hide} }
export function drawSideMustang(canvas, opts) {
  const v = opts.visual || {}, lv = opts.levels || {};
  const off = opts.layers || {};
  const on = k => off[k] !== false;
  canvas.width = LW; canvas.height = LH;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, LW, LH);
  g.imageSmoothingEnabled = false;
  g.save(); g.scale(K, K);

  const size = +v.wheelSize || 19, offset = v.offset || 'flush';
  const caliper = CALIPER_COLORS[Math.min(4, lv.brakes || 0)] || '#3a3a3a';
  const flare = v.kit === 'wide' ? 26 : 0;
  const drop = [0, 9, 16, 22, 26][Math.min(4, lv.suspension || 0)];     // lower with suspension stages

  // ground shadow + underglow
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(980, GROUND + 6, 960, 20, 0, 0, 7); g.fill();
  if (on('underglow') && v.neon && v.neon !== 'none') {
    const gr = g.createRadialGradient(980, GROUND, 10, 980, GROUND, 900); gr.addColorStop(0, v.neon); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5; g.fillStyle = gr; g.beginPath(); g.ellipse(980, GROUND + 4, 900, 60, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  }

  // body layers ride lower on lowered suspension
  g.save(); g.translate(0, drop);
  if (flare) { const base = hex(v.paint); for (const cx of [FRONT_X, REAR_X]) { g.fillStyle = rgb(darken(base, 0.1)); g.beginPath(); g.arc(cx, 560, TIRE_R + 46, Math.PI * 0.98, Math.PI * 2.02); g.fill(); } }
  if (on('body')) paintBody(g, v);
  if (on('skirts')) paintSkirts(g, v);
  if (on('windows')) paintWindows(g, v);
  if (on('hood') && !opts.showEngine) paintHood(g, v);
  if (on('front')) paintFront(g, v);
  if (on('rear')) paintRear(g, v);
  if (on('spoiler')) paintSpoiler(g, v);
  if (on('lights')) paintLights(g, v);
  paintBadges(g);
  if (on('decals')) paintDecals(g, v);
  // wheel wells (cut into the body), then the wheels sit in them at ground level
  wheelArch(g, FRONT_X, 560 - 0, v, flare); wheelArch(g, REAR_X, 560 - 0, v, flare);
  if (opts.showEngine) drawEngineBay(g, v, lv);
  g.restore();

  const cy = GROUND - TIRE_R;
  if (on('wheels')) { drawWheel(g, FRONT_X, cy, v, size, offset, caliper, 'front'); drawWheel(g, REAR_X, cy, v, size, offset, caliper, 'rear'); }
  g.save(); g.translate(0, drop);
  if (offset !== 'poke') { archLip(g, FRONT_X, 560, v, flare); archLip(g, REAR_X, 560, v, flare); }
  g.restore();
  g.restore();

  return canvas;
}
