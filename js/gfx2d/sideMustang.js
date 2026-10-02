// Side-view Mustang for the Garage showroom, built from the real pixel-art
// parts (assets/mustang/parts/*.png, cut from the customization sheet):
// the base body, and every part you install on top of it — wheels, calipers,
// side skirts, spoilers, mirrors, door handles, emblems, headlights, tail
// lights, exhaust tips — plus paint (the body is re-coloured), window tint,
// ride height, wheel size and offset, livery and underglow.
//
// Parts that can't be seen from the side (hoods, roofs, trunks, bumpers,
// grilles, plates) are drawn in the front / rear / top views instead.

import { CALIPER_COLORS, FX } from '../data/parts.js';
import { designOfVisual } from '../data/mustangParts.js';

export const SIDE_VIEW_CARS = new Set(['ford_mustang_gt_s650_2024', 'ford_mustang_dark_horse_2024']);
export const hasSideView = modelId => SIDE_VIEW_CARS.has(modelId);

const BASE = 'assets/mustang/parts/';
let PARTS = null, SIZES = null, loading = null;

// Loads every part picture once.
export function loadMustangParts() {
  if (PARTS) return Promise.resolve(PARTS);
  loading ??= (async () => {
    SIZES = await (await fetch('assets/mustang/parts.json')).json();
    const out = {};
    await Promise.all(Object.keys(SIZES).map(name => new Promise((res, rej) => {
      const im = new Image(); im.onload = () => { out[name] = im; res(); }; im.onerror = () => rej(new Error('missing part picture: ' + name)); im.src = BASE + name + '.png';
    })));
    PARTS = out; return out;
  })();
  return loading;
}
export const partsReady = () => !!PARTS;
export const partPicture = name => PARTS?.[name];
export const partUrl = name => BASE + name + '.png';

// ----- layout, in pixels of the body picture (664 × 188) -----
const OX = 18, OY = 8;                 // margin around the body
export const LW = 700, LH = 236;       // canvas size
const FRONT_X = 129, REAR_X = 505, WHEEL_Y = 163;       // wheel centres (body-local)
const GROUND = 211;                    // road level (body-local)
const WHEEL_SCALE = 1.0;               // 94 px tyre in a ~108 px arch
const PX_PER_M = 139;

// ----- colour helpers -----
const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const n = m ? parseInt(m[1], 16) : 0x888888; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const mix = (c, to, t) => c.map((v, i) => v + (to[i] - v) * t);
const darken = (c, t) => mix(c, [0, 0, 0], t);
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
function fillPoly(g, pts, fill) { poly(g, pts); g.fillStyle = fill; g.fill(); }

// The sprite body is grey. Re-colour its paint pixels (not the outline, glass,
// lights or badges) while keeping every bit of the shading.
const recolorCache = new Map();
function recolored(paint, finish) {
  const key = paint + '|' + finish;
  if (recolorCache.has(key)) return recolorCache.get(key);
  const body = PARTS.body, mask = PARTS.bodypaint;
  const c = document.createElement('canvas'); c.width = body.width; c.height = body.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(body, 0, 0);
  const m = document.createElement('canvas'); m.width = body.width; m.height = body.height;
  const mg = m.getContext('2d', { willReadFrequently: true }); mg.drawImage(mask, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data, md = mg.getImageData(0, 0, c.width, c.height).data;
  const T = hex(paint);
  let seed = 7;
  for (let i = 0; i < d.length; i += 4) {
    if (md[i + 3] === 0) continue;
    const L = (d[i] + d[i + 1] + d[i + 2]) / 3;
    let f = Math.max(0.4, Math.min(2.6, L / 42));
    // light paints would blow out to pure white: blend toward a gentler curve as the paint gets lighter
    const tb = Math.max(T[0], T[1], T[2]) / 255, w = tb * tb;
    f = (1 - w) * f + w * Math.min(1.08, 0.5 + 0.62 * (L / 110));
    if (finish === 'matte') f = 0.8 + 0.2 * f;
    let r, gr, b;
    if (finish === 'chrome') { const v = Math.max(40, Math.min(255, L * 2.1)); r = v * 0.95; gr = v; b = v * 1.06; }
    else {
      if (finish === 'metallic') { seed = (seed * 16807) % 2147483647; if (seed % 19 === 0) f *= 1.35; }
      r = T[0] * f; gr = T[1] * f; b = T[2] * f;
      if (finish === 'pearl') { const t = Math.max(0, Math.min(1, (f - 0.7) / 1.6)); r = r * (1 - t * 0.25) + 255 * t * 0.25; gr = gr * (1 - t * 0.2) + 150 * t * 0.2; b = b * (1 - t * 0.2) + 235 * t * 0.2; }
    }
    d[i] = Math.min(255, r); d[i + 1] = Math.min(255, gr); d[i + 2] = Math.min(255, b);
  }
  g.putImageData(img, 0, 0);
  recolorCache.set(key, c);
  return c;
}

let glassCanvas = null;
function glassLayer() {
  if (glassCanvas) return glassCanvas;
  const c = document.createElement('canvas'); c.width = PARTS.bodyglass.width; c.height = PARTS.bodyglass.height;
  const g = c.getContext('2d'); g.fillStyle = '#10151c'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(PARTS.bodyglass, 0, 0);
  return (glassCanvas = c);
}

// Where each overlay part sits on the body picture: [x, y, width] (height follows the picture).
const PLACE = {
  mirror: [248, 50, 46],
  handle: [367, 85, 44],
  emblem: [196, 106, 30],
  headlight: [26, 96, 72],
  taillight: [606, 78, 50],
  tip: [628, 163, 34],
  skirt: [190, 163, 262, 25],     // [x, y, width, height]: the skirt pictures are squashed flat to fit the sill
};
// spoilers sit on the deck at the back; [x, bottom y, width]
const SPOILER = [[560, 60, 96], [556, 62, 98], [560, 64, 92], [552, 64, 108]];
const WINDOW_POLY = [[250, 77], [300, 40], [325, 31], [425, 29], [440, 40], [500, 62], [520, 76]];

function put(g, name, x, y, w, anchorBottom = false) {
  const im = PARTS[name]; if (!im) return;
  const h = im.height * w / im.width;
  g.drawImage(im, Math.round(x), Math.round(anchorBottom ? y - h : y), Math.round(w), Math.round(h));
}

function drawWheels(g, v, lv, design, size, offset, caliper, layers) {
  const sc = WHEEL_SCALE * (0.9 + (size - 17) * 0.04) * (offset === 'poke' ? 1.04 : offset === 'stock' ? 0.97 : 1);
  for (const cx of [FRONT_X, REAR_X]) {
    const im = PARTS['wheel' + design]; if (!im) continue;
    const w = im.width * sc, h = im.height * sc;
    g.drawImage(im, Math.round(cx - w / 2), Math.round(WHEEL_Y - h / 2), Math.round(w), Math.round(h));
    if (layers.calipers !== false && caliper) {
      // the caliper shows between the spokes at the top-rear of the disc
      g.save(); g.translate(cx, WHEEL_Y); g.scale(sc, sc);
      g.fillStyle = caliper; poly(g, [[8, -34], [30, -24], [34, -4], [20, -14], [10, -22]]); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(14, -26, 9, 2);
      g.restore();
    }
  }
}

function paintDecals(g, v, maskCanvas) {
  const col = rgb(hex(v.decalColor || '#f2f2f2'), 0.95);
  const t = document.createElement('canvas'); t.width = LW; t.height = LH; const tg = t.getContext('2d');
  tg.translate(OX, OY);
  if (v.decal === 'stripes') { fillPoly(tg, [[50, 86], [215, 60], [215, 68], [52, 94]], col); fillPoly(tg, [[305, 40], [430, 34], [432, 42], [307, 48]], col); fillPoly(tg, [[520, 68], [600, 52], [600, 60], [522, 76]], col); }
  if (v.decal === 'side') fillPoly(tg, [[60, 128], [620, 118], [620, 136], [60, 146]], col);
  if (v.decal === 'number') { tg.fillStyle = '#f2f2f2'; tg.beginPath(); tg.arc(330, 118, 22, 0, 7); tg.fill(); tg.fillStyle = '#111'; tg.font = 'bold 28px sans-serif'; tg.textAlign = 'center'; tg.fillText('7', 330, 128); }
  if (v.decal === 'flames') {
    tg.fillStyle = '#ff9a1a'; poly(tg, [[140, 168], [200, 130], [215, 148], [245, 118], [262, 144], [290, 120], [310, 150], [340, 168]]); tg.fill();
    tg.fillStyle = '#e0192e'; poly(tg, [[150, 168], [205, 142], [218, 156], [245, 132], [260, 154], [290, 134], [304, 158], [330, 168]]); tg.fill();
  }
  if (v.decal === 'crew') { fillPoly(tg, [[60, 120], [620, 110], [620, 124], [60, 134]], col); }
  g.save(); g.globalCompositeOperation = 'source-over';
  // only on the body's paint: mask the decal layer with the paint mask
  const m = document.createElement('canvas'); m.width = LW; m.height = LH; const mg = m.getContext('2d');
  mg.drawImage(t, 0, 0); mg.globalCompositeOperation = 'destination-in'; mg.drawImage(maskCanvas, OX, OY);
  g.drawImage(m, 0, 0); g.restore();
}

// --- engine bay cut-away ---
function drawEngineBay(g, v, lv) {
  // bay: cut out of the front end
  fillPoly(g, [[96, 372], [668, 276], [668, 560], [150, 560], [92, 470]], '#1b1d22');
  g.strokeStyle = '#2a2c33'; g.lineWidth = 4; poly(g, [[96, 372], [668, 276], [668, 560], [150, 560], [92, 470]]); g.stroke();
  // the hood swings up on its hinges at the cowl
  const piv = [668, 276], th = 0.4, c = Math.cos(th), sn = Math.sin(th);
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
// opts: { visual, levels, showEngine, layers:{name:false hides it}, parts }
export function drawSideMustang(canvas, opts) {
  const v = opts.visual || {}, lv = opts.levels || {}, layers = opts.layers || {};
  const on = k => layers[k] !== false;
  canvas.width = LW; canvas.height = LH;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, LW, LH);
  g.imageSmoothingEnabled = false;
  if (!PARTS) return canvas;

  const size = +v.wheelSize || 19, offset = v.offset || 'flush';
  const caliper = (CALIPER_COLORS[Math.min(4, lv.brakes || 0)] || null);
  const dy = Math.round(FX.suspension.drop[Math.min(4, lv.suspension || 0)] * PX_PER_M);   // ride height
  const des = cat => designOfVisual(v, cat);
  const wheelDesign = des('wheels') ?? 4;

  g.save(); g.translate(OX, OY);
  // ground shadow + underglow
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(332, GROUND + 3, 318, 9, 0, 0, 7); g.fill();
  if (on('underglow') && v.neon && v.neon !== 'none') {
    const gr = g.createRadialGradient(332, GROUND, 4, 332, GROUND, 300); gr.addColorStop(0, v.neon); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5; g.fillStyle = gr; g.beginPath(); g.ellipse(332, GROUND + 2, 300, 26, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  }
  // wheel wells are dark; wheels tuck in behind the body unless they poke out
  const drawWells = () => { g.fillStyle = '#050506'; for (const cx of [FRONT_X, REAR_X]) { g.beginPath(); g.arc(cx, WHEEL_Y - 4 + dy, 56, 0, 7); g.fill(); } };
  drawWells();
  const wheelsBehind = offset !== 'poke' && !opts.showEngine;
  if (on('wheels') && wheelsBehind) drawWheels(g, v, lv, wheelDesign, size, offset, caliper, layers);

  // body (re-coloured), glass, tint
  g.save(); g.translate(0, dy);
  const tint = { none: 0.35, light: 0.55, medium: 0.72, limo: 0.9 }[v.tint] ?? 0.35;
  g.drawImage(glassLayer(), 0, 0);                                         // see-through bits show the dark cabin
  if (on('body')) {
    const bc = recolored(v.paint || '#c41b1b', v.finish || 'gloss');
    // a body-sized layer so the tint and decals stay inside the car
    const lay = document.createElement('canvas'); lay.width = PARTS.body.width; lay.height = PARTS.body.height;
    const lg = lay.getContext('2d'); lg.drawImage(bc, 0, 0);
    if (on('windows')) { lg.globalCompositeOperation = 'source-atop'; fillPoly(lg, WINDOW_POLY, `rgba(2,4,8,${tint})`); lg.globalCompositeOperation = 'source-over'; }
    g.drawImage(lay, 0, 0);
  }
  if (on('decals') && v.decal && v.decal !== 'none') { g.save(); g.translate(-OX, -OY); paintDecals(g, v, PARTS.bodypaint); g.restore(); }

  // ----- parts on the body -----
  const sk = des('skirts');
  if (on('skirts') && sk != null && PARTS['skirt' + sk]) g.drawImage(PARTS['skirt' + sk], PLACE.skirt[0], PLACE.skirt[1], PLACE.skirt[2], PLACE.skirt[3]);
  const sp = des('spoiler');
  if (on('spoiler') && sp != null) { const [x, y, w] = SPOILER[sp] || SPOILER[0]; put(g, 'spoiler' + sp, x, y, w, true); }
  const mi = des('mirrors');
  if (on('mirrors') && mi != null) put(g, 'mirror' + mi, ...PLACE.mirror);
  const ha = des('handles');
  if (on('handles') && ha != null) put(g, 'handle' + ha, ...PLACE.handle);
  const em = des('emblem');
  if (on('emblem') && em != null) {
    if (on('body')) { const bc = recolored(v.paint || '#c41b1b', v.finish || 'gloss'); g.drawImage(bc, 152, 104, 40, 20, 190, 102, 42, 22); }   // cover the factory badge with the panel beside it
    put(g, ['emblem50w', 'emblem50r', 'emblempony0', 'emblempony1', 'emblemgt0', 'emblemgt1'][em], PLACE.emblem[0], PLACE.emblem[1] + 2, [26, 26, 34, 34, 30, 30][em]);
  }
  const hl = des('headlights');
  if (on('lights') && hl != null) put(g, 'headlight' + hl, ...PLACE.headlight);
  const tl = des('taillights');
  if (on('lights') && tl != null) put(g, 'taillight' + tl, ...PLACE.taillight);
  const tp = des('exhaustTips');
  if (on('tips') && tp != null) put(g, 'tip' + tp, ...PLACE.tip);
  g.restore();

  if (on('wheels') && !wheelsBehind) drawWheels(g, v, lv, wheelDesign, size, offset, caliper, layers);

  if (opts.showEngine) {
    // engine bay cut-away drawn in the old reference coordinates (1983-wide), scaled onto this body
    const k = 664 / 1874;
    g.save(); g.translate(-52 * k, -124 * k + dy); g.scale(k, k);
    drawEngineBay(g, v, lv);
    g.restore();
    if (on('wheels')) drawWheels(g, v, lv, wheelDesign, size, offset, caliper, layers);
  }
  g.restore();

  return canvas;
}

// ------------------------------------------------------------------ the other views
// Front, rear and top views are built from the front / rear / top pictures, so the
// parts you can't see from the side (bumpers, grilles, plates, hood, roof, trunk) still
// show up on the car. Design 0 of each is the factory part.
const pic = (cat, v, prefix) => `${prefix}${designOfVisual(v, cat) ?? 0}`;
function fit(g, name, cx, y, w) { const im = PARTS[name]; if (!im) return 0; const h = im.height * w / im.width; g.drawImage(im, Math.round(cx - w / 2), Math.round(y), Math.round(w), Math.round(h)); return h; }

export function drawFrontView(canvas, opts) {
  const v = opts.visual || {};
  canvas.width = 280; canvas.height = 128;
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 280, 128);
  if (!PARTS) return canvas;
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(140, 120, 120, 6, 0, 0, 7); g.fill();
  const bn = pic('frontBumper', v, 'fbumper'), h = fit(g, bn, 140, 14, 248);
  // the grille sits in the bumper's opening, the plate low on the splitter
  fit(g, pic('grille', v, 'grille'), 140, 14 + h * 0.34, 132);
  if (designOfVisual(v, 'plate') != null) fit(g, pic('plate', v, 'plate'), 140, 14 + h * 0.74, 44);
  return canvas;
}
export function drawRearView(canvas, opts) {
  const v = opts.visual || {};
  canvas.width = 280; canvas.height = 128;
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 280, 128);
  if (!PARTS) return canvas;
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(140, 120, 110, 6, 0, 0, 7); g.fill();
  const h = fit(g, pic('rearBumper', v, 'rbumper'), 140, 14, 232);
  if (designOfVisual(v, 'plate') != null) fit(g, pic('plate', v, 'plate'), 140, 14 + h * 0.3, 54);
  return canvas;
}
export function drawTopView(canvas, opts) {
  const v = opts.visual || {};
  canvas.width = 150; canvas.height = 250;
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 150, 250);
  if (!PARTS) return canvas;
  let y = 4;
  y += fit(g, pic('hood', v, 'hood'), 75, y, 138) + 4;
  y += fit(g, pic('roof', v, 'roof'), 75, y, 134) + 4;
  fit(g, pic('trunk', v, 'trunk'), 75, y, 112);
  return canvas;
}
