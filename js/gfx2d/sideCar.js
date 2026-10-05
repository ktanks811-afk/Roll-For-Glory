// Side-view showroom car, built from the design sheet in data/carShapes.js so
// every car in the game gets the same editable layers the Mustang has:
//
//   body · paint/finish · windows/tint · hood · front bumper/splitter · rear
//   bumper/diffuser · side skirts · spoiler/wing · headlights · taillights ·
//   exhaust tips · front/rear wheels · calipers · wheel size & offset ·
//   suspension (ride height) · decals · underglow · engine bay
//
// The silhouette comes from the car's real length / height / wheelbase and a
// roofline archetype (sedan, hatch, fastback, mid-engine, pickup...), plus the
// details that make a model recognisable (doors, convertible, wing, lights).

import { CALIPER_COLORS } from '../data/parts.js';
import { shapeOf } from '../data/carShapes.js';
import { hex, rgb, mix, lighten, darken, poly, fillPoly, drawWheel, wheelArch, archLip, drawEngineBay, drawSideMustang, lowerBody } from './sideMustang.js';
import { rideDrop } from '../sim/tuning.js';
import { artOf, paintedArt } from './carArt.js';

export const hasSideView = () => true;
export const SW = 1320, SH = 528;             // canvas pixels (HD)
const REF_W = 1983, REF_H = 793, GROUND = 700; // drawing space, same as the Mustang art
const K = SW / REF_W;
const MUSTANG_ART = new Set(['ford_mustang_gt_s650_2024', 'ford_mustang_dark_horse_2024']);

// ------------------------------------------------------------------ geometry
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ROOF_REAR = { S: .98, F: .94, H: .975, h: .93, C: .97, B: .9, M: .97, R: .92, X: .9, N: .9, W: .985, U: .97, Q: .99, P: .99 };

export function sideGeo(sh) {
  const { L, H, WB } = sh;
  const lift = sh.lift || 0;
  const ppm = Math.min(1850 / L, 640 / (H + lift));
  const ox = (REF_W - L * ppm) / 2;
  const X = m => ox + m * ppm, Y = m => GROUND - m * ppm;
  const gc = 0.15 + lift - (sh.lowered ? 0.05 : 0);
  const R = (sh.tr + lift * 0.4) * ppm;
  const conv = !!sh.conv;
  const A = sh.arch;
  const xCowl = sh.xCowl * L, xA = sh.xA * L, xC = sh.xC * L, xD = Math.min(sh.xD * L, L - 0.04);
  const roofA = conv ? 1.0 : (A === 'P' || A === 'Q' ? 1.0 : 0.985);
  const roofRear = conv ? 0 : (sh.roofR ?? ROOF_REAR[A] ?? .97);
  const beltY = sh.belt * H, deckY = sh.deck * H, tailY = sh.tail * H;
  const noseY = sh.nose * H, hoodFY = sh.hoodF * H, hoodBY = sh.hoodB * H;
  const hoodLeadX = Math.max(0.06, 0.05 * L);
  const pts = [];
  const P = (x, y, r) => pts.push({ x, y, r });
  P(0.07, gc, 0.05);
  P(0.0, gc + 0.13, 0.1);
  P(0.0, noseY, 0.1);
  P(hoodLeadX, hoodFY, 0.14);
  P(lerp(hoodLeadX, xCowl, 0.5), lerp(hoodFY, hoodBY, 0.5) + 0.012 * H, 0.4);
  P(xCowl, hoodBY, 0.1);
  const fast = 'FBhRXN'.includes(A);
  P(xA, roofA * H, conv ? 0.06 : fast ? 0.5 : 0.28);
  if (conv) {
    P(xA + 0.12, beltY + 0.015, 0.06);
    P(xC, beltY + 0.015, 0.2);
    P(lerp(xC, xD, 0.55), lerp(beltY, deckY, 0.6) + 0.02, 0.4);
  } else if (A === 'P') {
    P(lerp(xA, xC, 0.5), H, 0.5);
    P(xC, H, 0.18);
  } else {
    P(lerp(xA, xC, 0.45), H, 0.7);
    P(xC, roofRear * H, fast ? 0.55 : 0.26);
  }
  P(xD, deckY, A === 'P' ? 0.1 : (xD < L * 0.95 ? 0.22 : 0.18));
  if (A === 'P') P(xD + 0.02, deckY, 0.06);
  P(L - 0.03, tailY, 0.07);
  P(L, tailY - 0.05, 0.08);
  P(L, gc + 0.15, 0.1);
  P(L - 0.07, gc, 0.05);

  // height of the outline (metres) at x, for anchoring wings, tips, etc.
  const top = pts.slice(0, -4).concat(pts.slice(-4, -2));
  const topAt = x => {
    for (let i = 1; i < top.length; i++) {
      const a = top[i - 1], b = top[i];
      if (x >= a.x && x <= b.x && b.x > a.x) return lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
    }
    return tailY;
  };

  // greenhouse
  const wsAt = y => { const t = clamp((y - hoodBY) / Math.max(0.01, roofA * H - hoodBY), 0, 1); return lerp(xCowl, xA, t); };
  const frontLow = { x: wsAt(beltY) + 0.13, y: beltY };
  const frontTop = { x: xA + 0.17, y: roofA * H - 0.055 };
  const rearTop = { x: xC - 0.12, y: (conv ? beltY : roofRear * H) - 0.055 };
  const rearAt = y => { const t = clamp(((roofRear * H) - y) / Math.max(0.01, roofRear * H - deckY), 0, 1); return lerp(xC, xD, t); };
  let rearLow = { x: (A === 'P' ? xC : rearAt(beltY)) - 0.1, y: beltY };
  if (rearLow.x < rearTop.x + 0.25) rearLow.x = rearTop.x + 0.25;
  const doors = sh.doors ?? 4;

  // wheels & doors
  const fxm = sh.fo, rxm = sh.fo + WB;
  const doorF = Math.max(wsAt(beltY) + 0.05, fxm + (sh.tr + lift * 0.4) * 1.05);
  const doorR = Math.min(rearLow.x + 0.08, rxm - (sh.tr + lift * 0.4) * 1.12);
  return { sh, ppm, ox, X, Y, gc, R, pts, topAt, conv, A, L, H, xCowl, xA, xC, xD, roofA, roofRear, beltY, deckY, tailY, noseY, hoodFY, hoodBY, hoodLeadX,
    frontLow, frontTop, rearTop, rearLow, doors, doorF, doorR, fx: X(fxm), rx: X(rxm), cy: GROUND - R, wsAt, rearAt };
}

function roundPath(g, P) {
  const n = P.length;
  g.beginPath();
  const mid = (a, b) => [(a.x + b.x) / 2, (a.y + b.y) / 2];
  const m0 = mid(P[n - 1], P[0]);
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = P[i], a = P[(i + n - 1) % n], b = P[(i + 1) % n];
    const m = mid(p, b);
    const v1x = a.x - p.x, v1y = a.y - p.y, v2x = b.x - p.x, v2y = b.y - p.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    let r = p.r;
    if (r > 0 && l1 > 0 && l2 > 0) {
      const cos = clamp((v1x * v2x + v1y * v2y) / (l1 * l2), -1, 1);
      const half = Math.acos(cos) / 2;                 // half the interior angle
      const maxR = Math.min(l1, l2) / 2 * Math.tan(half);
      r = Math.min(r, maxR);
    }
    g.arcTo(p.x, p.y, m[0], m[1], Math.max(0.01, r));
  }
  g.closePath();
}

// ------------------------------------------------------------------ layers
function sparkle(g, color, x0, y0, w, h) {
  let s = 91;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 180; i++) {
    g.fillStyle = rgb(lighten(color, 0.55), 0.35 + rnd() * 0.3);
    g.fillRect(x0 + rnd() * w, y0 + rnd() * h, 7, 7);
  }
}

function bodyPx(geo) { return geo.pts.map(p => ({ x: geo.X(p.x), y: geo.Y(p.y), r: p.r * geo.ppm })); }

function paintBody(g, geo, v) {
  const { X, Y, ppm, L, H, gc } = geo;
  const base = hex(v.paint), finish = v.finish || 'gloss';
  const bp = bodyPx(geo);
  const x0 = X(0), x1 = X(L), yTop = Y(H) - 10, yBot = Y(gc) + 6;
  g.save();
  roundPath(g, bp); g.clip();
  if (finish === 'chrome') {
    const gr = g.createLinearGradient(0, yTop, 0, yBot);
    gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(0.45, '#9aa2ab'); gr.addColorStop(0.5, '#2c3036'); gr.addColorStop(0.62, '#8c939c'); gr.addColorStop(1, '#d6dade');
    g.fillStyle = gr; g.fillRect(0, 0, REF_W, REF_H);
  } else {
    // vertical sheen: lighter shoulder, darker lower body and rocker
    const gr = g.createLinearGradient(0, yTop, 0, yBot);
    gr.addColorStop(0, rgb(lighten(base, finish === 'matte' ? 0.05 : 0.16)));
    gr.addColorStop(0.35, rgb(base));
    gr.addColorStop(0.62, rgb(darken(base, 0.1)));
    gr.addColorStop(0.9, rgb(darken(base, 0.3)));
    gr.addColorStop(1, rgb(darken(base, 0.45)));
    g.fillStyle = gr; g.fillRect(0, 0, REF_W, REF_H);
    if (finish === 'pearl') {
      g.fillStyle = rgb(mix(base, [255, 120, 200], 0.35), 0.35); g.fillRect(x0, Y(geo.beltY) - 20, x1 - x0, ppm * 0.14);
      g.fillStyle = rgb(mix(base, [120, 200, 255], 0.35), 0.3); g.fillRect(x0, Y(geo.beltY) + ppm * 0.14 - 20, x1 - x0, ppm * 0.1);
    }
    if (finish !== 'matte') {
      // shoulder highlight (the crease line down the flank) and a hood / roof glint
      const sy = Y(geo.beltY * 0.93);
      g.fillStyle = rgb(lighten(base, 0.28), 0.8);
      poly(g, [[X(geo.hoodLeadX + 0.1), Y(geo.hoodFY) + 16], [X(geo.xCowl), sy], [X(L - 0.12), Y(geo.tailY) + 10], [X(L - 0.12), Y(geo.tailY) + 28], [X(geo.xCowl), sy + 22], [X(geo.hoodLeadX + 0.1), Y(geo.hoodFY) + 36]]); g.fill();
      g.fillStyle = rgb(lighten(base, 0.5), 0.5);
      poly(g, [[X(geo.xA + 0.1), Y(H) + 4], [X(lerp(geo.xA, geo.xC, 0.8)), Y(H) + 4], [X(lerp(geo.xA, geo.xC, 0.8)), Y(H) + 16], [X(geo.xA + 0.1), Y(H) + 16]]); g.fill();
      g.fillStyle = rgb(lighten(base, 0.3), 0.45);
      poly(g, [[X(geo.hoodLeadX + 0.05), Y(geo.hoodFY) + 4], [X(geo.xCowl - 0.08), Y(geo.hoodBY) + 2], [X(geo.xCowl - 0.08), Y(geo.hoodBY) + 14], [X(geo.hoodLeadX + 0.05), Y(geo.hoodFY) + 16]]); g.fill();
    }
    // lower body shadow line
    g.fillStyle = rgb(darken(base, 0.5), 0.55); g.fillRect(x0, Y(gc + 0.15), x1 - x0, ppm * 0.16);
    if (finish === 'metallic') sparkle(g, base, x0, yTop, x1 - x0, yBot - yTop);
  }
  g.restore();
  // panel lines and handles
  g.strokeStyle = 'rgba(10,10,12,0.85)'; g.lineWidth = Math.max(3, ppm * 0.012); g.lineCap = 'round';
  const dy0 = Y(geo.beltY), dy1 = Y(gc + 0.12);
  const doorLines = geo.doors >= 4 ? [geo.doorF, lerp(geo.doorF, geo.doorR, 0.5), geo.doorR] : [geo.doorF, geo.doorR];
  g.beginPath();
  doorLines.forEach((dx, i) => { const sl = i === 0 ? -0.04 : 0.02; g.moveTo(X(dx), dy0 + 6); g.lineTo(X(dx + sl), dy1); });
  // fender / hood cut
  g.moveTo(X(geo.hoodLeadX + 0.05), Y(geo.hoodFY) + 12); g.quadraticCurveTo(X(geo.xCowl - 0.05), Y(geo.hoodBY) + 40, X(geo.doorF - 0.02), dy0 + 6);
  g.stroke();
  // door handles
  g.fillStyle = rgb(darken(base, 0.55));
  const hy = Y(geo.beltY - 0.065 * geo.H);
  const handles = geo.doors >= 4 ? [lerp(geo.doorF, geo.doorR, 0.5) - 0.34, geo.doorR - 0.34] : [geo.doorR - 0.34];
  for (const hx of handles) { g.fillRect(X(hx), hy, ppm * 0.17, ppm * 0.028); }
  // fuel door
  g.lineWidth = 3; g.beginPath(); const fxp = X(geo.L * 0.86), fyp = Y(geo.beltY * 0.93); g.arc(fxp, fyp, ppm * 0.055, 0, Math.PI * 2); g.stroke();
}

function paintWindows(g, geo, v) {
  const { X, Y, ppm } = geo;
  const tint = { none: 0.55, light: 0.68, medium: 0.8, limo: 0.94 }[v.tint] ?? 0.55;
  const a0 = 0.8 + tint * 0.19;
  const gy0 = Y(geo.H), gy1 = Y(geo.beltY);
  const glass = g.createLinearGradient(0, gy0, 0, gy1);
  glass.addColorStop(0, rgb([44, 58, 76], a0)); glass.addColorStop(0.45, rgb([22, 30, 42], a0)); glass.addColorStop(1, rgb([10, 14, 20], a0));
  const P = (pt) => ({ x: X(pt.x), y: Y(pt.y) });
  g.lineJoin = 'round';
  if (geo.conv) {
    // windscreen frame + the open cockpit with seats
    const a = { x: X(geo.xCowl + 0.02), y: Y(geo.hoodBY + 0.01) }, b = { x: X(geo.xA + 0.02), y: Y(geo.roofA * geo.H - 0.01) }, c = { x: X(geo.xA + 0.12), y: Y(geo.beltY + 0.02) };
    fillPoly(g, [[a.x, a.y], [b.x, b.y], [b.x + ppm * 0.07, b.y + ppm * 0.01], [a.x + ppm * 0.1, a.y]], glass);
    const cockX0 = X(geo.xA + 0.12), cockX1 = X(geo.xC), by = Y(geo.beltY + 0.015);
    g.fillStyle = '#0d0e11'; g.fillRect(cockX0, by, cockX1 - cockX0, ppm * 0.07);
    // seat + headrest silhouettes
    g.fillStyle = '#1c1e23';
    const sx = lerp(cockX0, cockX1, 0.5);
    g.beginPath(); g.ellipse(sx, by - ppm * 0.09, ppm * 0.14, ppm * 0.12, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(sx - ppm * 0.42, by - ppm * 0.05, ppm * 0.12, ppm * 0.09, 0, 0, 7); g.fill();
    // speed humps behind the seats
    g.fillStyle = rgb(darken(hex(v.paint), 0.15));
    g.beginPath(); g.ellipse(cockX1 - ppm * 0.1, by, ppm * 0.42, ppm * 0.1, 0, Math.PI, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(8,8,10,0.9)'; g.lineWidth = 6; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(b.x + ppm * 0.07, b.y + ppm * 0.01); g.lineTo(a.x + ppm * 0.1, a.y); g.closePath(); g.stroke(); void c;
  } else {
    const fl = P(geo.frontLow), ft = P(geo.frontTop), rt = P(geo.rearTop), rl = P(geo.rearLow);
    const panes = [];
    const split = geo.doors >= 4 || geo.sh.arch === 'W' || geo.sh.arch === 'U' || geo.sh.arch === 'Q';
    const bx = lerp(fl.x, rl.x, 0.5) + (geo.sh.arch === 'S' || geo.sh.arch === 'F' ? ppm * 0.02 : 0);
    const topAtX = x => lerp(ft.y, rt.y, clamp((x - ft.x) / Math.max(1, rt.x - ft.x), 0, 1));
    const botAtX = x => fl.y + (rl.y - fl.y) * clamp((x - fl.x) / Math.max(1, rl.x - fl.x), 0, 1);
    const pw = ppm * 0.03;
    if (split && geo.sh.arch !== 'P') {
      const bTopY = topAtX(bx);
      panes.push([[fl.x, fl.y], [ft.x, ft.y], [bx - pw, topAtX(bx - pw)], [bx - pw, fl.y]]);
      panes.push([[bx + pw, fl.y], [bx + pw, topAtX(bx + pw)], [rt.x, rt.y], [rl.x, rl.y]]);
      void bTopY;
    } else if (geo.sh.arch === 'P') {
      // cab: front door glass, a B-pillar and the rear window in crew cabs
      if (geo.doors >= 4) {
        panes.push([[fl.x, fl.y], [ft.x, ft.y], [bx - pw, ft.y + (rt.y - ft.y) * 0.45], [bx - pw, fl.y]]);
        panes.push([[bx + pw, fl.y], [bx + pw, rt.y - ppm * 0.0], [rt.x, rt.y], [rl.x, rl.y]]);
      } else panes.push([[fl.x, fl.y], [ft.x, ft.y], [rt.x, rt.y], [rl.x, rl.y]]);
    } else if (geo.doors === 3 || geo.sh.arch === 'H' || geo.sh.arch === 'h') {
      // two-door hatch: door glass + small quarter window behind a thicker C-pillar
      const qx = lerp(fl.x, rl.x, 0.78);
      panes.push([[fl.x, fl.y], [ft.x, ft.y], [qx - pw, topAtX(qx - pw)], [qx - pw, botAtX(qx - pw)]]);
      panes.push([[qx + pw * 1.6, botAtX(qx + pw * 1.6)], [qx + pw * 1.6, topAtX(qx + pw * 1.6)], [rt.x, rt.y], [rl.x, rl.y]]);
    } else panes.push([[fl.x, fl.y], [ft.x, ft.y], [rt.x, rt.y], [rl.x, rl.y]]);
    for (const pane of panes) {
      const mm = pane.map(([x, y]) => ({ x, y, r: ppm * 0.03 }));
      roundPath(g, mm); g.fillStyle = glass; g.fill();
      g.fillStyle = `rgba(150,170,190,${0.22 * (1 - tint)})`;
      const [a, b, c, d] = pane;
      poly(g, [[lerp(a[0], b[0], 0.3), lerp(a[1], b[1], 0.3)], [lerp(a[0], b[0], 0.55), lerp(a[1], b[1], 0.55)], [lerp(d[0], c[0], 0.5), lerp(d[1], c[1], 0.5)], [lerp(d[0], c[0], 0.25), lerp(d[1], c[1], 0.25)]]); g.fill();
      g.strokeStyle = 'rgba(8,8,10,0.9)'; g.lineWidth = Math.max(5, ppm * 0.02); roundPath(g, mm); g.stroke();
    }
  }
  // wing mirror
  const mx = X(geo.wsAt(geo.beltY) + 0.05), my = Y(geo.beltY + 0.045);
  fillPoly(g, [[mx, my], [mx + ppm * 0.16, my - ppm * 0.01], [mx + ppm * 0.17, my + ppm * 0.07], [mx + ppm * 0.01, my + ppm * 0.08]], '#16181c');
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(mx + 4, my + 2, ppm * 0.1, 4);
  // roof rails
  if (geo.sh.rails) {
    g.strokeStyle = '#15171b'; g.lineWidth = Math.max(5, ppm * 0.022); g.lineCap = 'round';
    g.beginPath(); g.moveTo(X(geo.xA + 0.2), Y(geo.H) - ppm * 0.03); g.lineTo(X(geo.xC - 0.1), Y(geo.roofRear * geo.H) - ppm * 0.03); g.stroke();
  }
  // roof spoiler for hatches and crossovers
  if (geo.sh.arch !== 'P' && !geo.conv) {
    const wing = effectiveWing(geo.sh, v);
    if (wing === 'roof') {
      const x = X(geo.xC - 0.05), y = Y(geo.roofRear * geo.H);
      fillPoly(g, [[x - ppm * 0.28, y - ppm * 0.01], [x + ppm * 0.14, y + ppm * 0.07], [x + ppm * 0.16, y + ppm * 0.11], [x - ppm * 0.3, y + ppm * 0.04]], '#0c0d10');
    }
  }
}

function effectiveWing(sh, v) {
  const m = { lip: 'lip', duck: 'duck', gt: 'big', drag: 'huge' };
  return v.spoiler && v.spoiler !== 'none' ? m[v.spoiler] : (sh.wing || 'none');
}

function hoodYAt(geo, xm) { return lerp(geo.hoodFY, geo.hoodBY, clamp((xm - geo.hoodLeadX) / Math.max(0.01, geo.xCowl - geo.hoodLeadX), 0, 1)); }

function paintHood(g, geo, v) {
  const { X, Y, ppm } = geo;
  const base = hex(v.paint), dark = rgb(darken(base, 0.55));
  const hx = frac => geo.hoodLeadX + (geo.xCowl - geo.hoodLeadX) * frac;
  const hy = frac => Y(hoodYAt(geo, hx(frac)));
  const slab = (f0, f1, th, col, inset = 0) => fillPoly(g, [[X(hx(f0)), hy(f0) + inset], [X(hx(f1)), hy(f1) + inset], [X(hx(f1)), hy(f1) + inset + th], [X(hx(f0)), hy(f0) + inset + th]], col);
  if (v.hood === 'cowl') slab(0.62, 0.96, ppm * 0.07, dark, 2);
  if (v.hood === 'scoop' || geo.sh.scoop && (!v.hood || v.hood === 'stock')) {
    slab(0.4, 0.82, ppm * 0.05, rgb(darken(base, 0.2)), -ppm * 0.045);
    slab(0.62, 0.8, ppm * 0.04, '#0a0a0c', -ppm * 0.04);
  }
  if (v.hood === 'vented') for (let i = 0; i < 4; i++) { const f = 0.3 + i * 0.12; slab(f, f + 0.06, ppm * 0.025, '#0a0a0c', ppm * 0.02); }
}

function paintFront(g, geo, v) {
  const { X, Y, ppm, gc } = geo;
  const base = hex(v.paint);
  const x0 = X(0), yb = Y(gc), yn = Y(geo.noseY);
  // lower intake + bumper
  fillPoly(g, [[x0 + 2, lerp(yn, yb, 0.35)], [x0 + ppm * 0.45, lerp(yn, yb, 0.5)], [x0 + ppm * 0.5, yb - 6], [x0 + 8, yb - 4]], '#0e0f12');
  g.strokeStyle = 'rgba(70,74,82,0.8)'; g.lineWidth = 3;
  const n = Math.max(3, Math.round((yb - yn) / (ppm * 0.05)));
  for (let i = 1; i < n; i++) { const yy = lerp(lerp(yn, yb, 0.4), yb, i / n); g.beginPath(); g.moveTo(x0 + 8, yy); g.lineTo(x0 + ppm * 0.4, yy + 4); g.stroke(); }
  // grille / badge
  fillPoly(g, [[x0 + 2, yn + 2], [x0 + ppm * 0.28, yn + ppm * 0.03], [x0 + ppm * 0.26, lerp(yn, yb, 0.3)], [x0 + 2, lerp(yn, yb, 0.3)]], '#101114');
  g.fillStyle = '#7d828a'; g.fillRect(x0 + ppm * 0.08, yn + ppm * 0.07, ppm * 0.08, ppm * 0.04);
  // marker
  fillPoly(g, [[x0 + ppm * 0.5, lerp(yn, yb, 0.55)], [x0 + ppm * 0.58, lerp(yn, yb, 0.55)], [x0 + ppm * 0.57, lerp(yn, yb, 0.75)], [x0 + ppm * 0.5, lerp(yn, yb, 0.75)]], '#ff9a1a');
  if (v.frontBumper === 'sport') fillPoly(g, [[x0 - 4, yb], [x0 + ppm * 0.7, yb + 10], [x0 + ppm * 0.68, yb + 22], [x0 - 2, yb + 14]], '#0a0a0c');
  if (v.frontBumper === 'splitter') { fillPoly(g, [[x0 - ppm * 0.08, yb + 4], [x0 + ppm * 0.9, yb + 18], [x0 + ppm * 0.88, yb + 34], [x0 - ppm * 0.08, yb + 22]], '#0a0a0c'); g.fillStyle = rgb(hex('#ff2a3a'), 0.9); g.fillRect(x0 - ppm * 0.05, yb + 12, ppm * 0.8, 5); }
  if (v.kit === 'street' || v.kit === 'wide') fillPoly(g, [[x0 - 2, yb], [x0 + ppm * 0.7, yb + 8], [x0 + ppm * 0.68, yb + 20], [x0, yb + 12]], '#0a0a0c');
  void base;
}

function exhaustTips(geo, v) {
  const { X, Y, ppm, gc, L } = geo;
  const y = Y(gc + 0.09), x = X(L - 0.14);
  const r = ppm * 0.045;
  const kind = v.exhaustTips || 'dual';
  const arr = { single: [[0, r]], dual: [[-ppm * 0.14, r], [ppm * 0.06, r]], quad: [[-ppm * 0.26, r * 0.8], [-ppm * 0.12, r * 0.8], [ppm * 0.02, r * 0.8], [ppm * 0.14, r * 0.8]], cannon: [[-ppm * 0.08, r * 1.5]] }[kind] || [[0, r]];
  return arr.map(([dx, rr]) => [x + dx, y, rr]);
}

function paintRear(g, geo, v) {
  const { X, Y, ppm, gc, L } = geo;
  const x1 = X(L), yb = Y(gc), yt = Y(geo.tailY * 0.7);
  fillPoly(g, [[x1 - ppm * 0.5, lerp(yt, yb, 0.4)], [x1 - 2, lerp(yt, yb, 0.25)], [x1 - 6, yb - 3], [x1 - ppm * 0.45, yb - 3]], '#0e0f12');
  g.strokeStyle = 'rgba(70,74,82,0.8)'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const xx = x1 - ppm * (0.1 + i * 0.07); g.beginPath(); g.moveTo(xx, lerp(yt, yb, 0.5)); g.lineTo(xx + 5, yb - 8); g.stroke(); }
  if (v.rearBumper === 'diffuser') { fillPoly(g, [[x1 - ppm * 0.55, yb - 24], [x1 + 4, yb - 40], [x1, yb + 12], [x1 - ppm * 0.5, yb + 14]], '#0a0a0c'); for (let i = 0; i < 6; i++) { const xx = x1 - ppm * (0.1 + i * 0.075); fillPoly(g, [[xx, yb - 28], [xx + 6, yb - 28], [xx + 12, yb + 10], [xx + 3, yb + 10]], '#2a2d33'); } }
  if (v.rearBumper === 'sport') fillPoly(g, [[x1 - ppm * 0.5, yb - 8], [x1, yb - 20], [x1 - 2, yb + 4], [x1 - ppm * 0.5, yb + 6]], '#0a0a0c');
  for (const [x, y, r] of exhaustTips(geo, v)) {
    g.fillStyle = '#1a1c20'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = '#b9bec6'; g.beginPath(); g.arc(x, y, r * 0.82, 0, 7); g.fill();
    g.fillStyle = '#050506'; g.beginPath(); g.arc(x, y, r * 0.56, 0, 7); g.fill();
  }
}

function paintSkirts(g, geo, v) {
  const { X, Y, ppm, gc } = geo;
  const base = hex(v.paint);
  const a = X(geo.fx ? (geo.doorF - 0.5) : 0), b = X(geo.doorR + 0.5);
  const y0 = Y(gc + 0.16), y1 = Y(gc - 0.01);
  const xa = X(geo.sh.fo + (geo.sh.tr * 1.1)), xb = X(geo.sh.fo + geo.sh.WB - geo.sh.tr * 1.1);
  void a; void b;
  fillPoly(g, [[xa, y0], [xb, y0 - 3], [xb - 14, y1], [xa + 14, y1 + 2]], '#101114');
  if (v.skirts === 'sport') fillPoly(g, [[xa - 10, y0 + 10], [xb + 10, y0 + 6], [xb - 2, y1 + 14], [xa + 4, y1 + 16]], rgb(darken(base, 0.7)));
  if (v.skirts === 'aero') { fillPoly(g, [[xa - 30, y0 + 8], [xb + 30, y0 + 4], [xb + 16, y1 + 22], [xa - 14, y1 + 24]], '#0a0a0c'); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(xa - 10, y0 + 14, xb - xa + 20, 4); }
  if (v.kit === 'street' || v.kit === 'wide') fillPoly(g, [[xa - 6, y0 + 14], [xb + 6, y0 + 10], [xb, y1 + 14], [xa + 2, y1 + 16]], '#0a0a0c');
  void ppm;
}

function paintSpoiler(g, geo, v) {
  const { X, Y, ppm, L } = geo;
  const base = hex(v.paint);
  const wing = effectiveWing(geo.sh, v);
  const A = geo.A;
  // anchor: on the deck / tail top (roof-end for hatches)
  const hatchy = A === 'H' || A === 'W' || A === 'U' || A === 'Q' || A === 'h';
  const ax = hatchy ? geo.xC + 0.12 : L - 0.35;
  const ay = hatchy ? geo.roofRear * geo.H : geo.topAt(L - 0.35);
  const x = X(ax), y = Y(ay);
  const body = rgb(darken(base, 0.45));
  if (wing === 'none' || wing === 'roof') return;
  if (wing === 'lip') fillPoly(g, [[x - ppm * 0.1, y + 4], [x + ppm * 0.5, y - ppm * 0.02], [x + ppm * 0.52, y + ppm * 0.03], [x - ppm * 0.08, y + ppm * 0.07]], body);
  if (wing === 'duck') fillPoly(g, [[x - ppm * 0.12, y + 4], [x + ppm * 0.48, y - ppm * 0.09], [x + ppm * 0.52, y - ppm * 0.03], [x - ppm * 0.1, y + ppm * 0.06]], body);
  if (wing === 'big' || wing === 'huge') {
    const h = wing === 'huge' ? 0.4 : 0.27, chord = wing === 'huge' ? 0.42 : 0.3;
    const bx = x + ppm * 0.1, by = y - ppm * h;
    fillPoly(g, [[bx - ppm * chord * 0.5, by + ppm * 0.02], [bx + ppm * chord * 0.5, by - ppm * 0.03], [bx + ppm * chord * 0.52, by + ppm * 0.03], [bx - ppm * chord * 0.48, by + ppm * 0.08]], '#0c0d10');
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx - ppm * chord * 0.45, by + ppm * 0.01, ppm * chord * 0.9, 4);
    fillPoly(g, [[bx - ppm * 0.05, by + ppm * 0.07], [bx + ppm * 0.03, by + ppm * 0.07], [bx + ppm * 0.06, y + ppm * 0.02], [bx - ppm * 0.06, y + ppm * 0.02]], '#0c0d10');
    if (wing === 'huge') fillPoly(g, [[bx + ppm * chord * 0.4, by - ppm * 0.08], [bx + ppm * chord * 0.55, by - ppm * 0.08], [bx + ppm * chord * 0.55, by + ppm * 0.12], [bx + ppm * chord * 0.4, by + ppm * 0.12]], '#0c0d10');
  }
}

function paintLights(g, geo, v) {
  const { X, Y, ppm, L, H } = geo;
  const sh = geo.sh;
  const head = { halogen: ['#ffe9b0', '#fff4d0'], xenon: ['#cfe4ff', '#f2f8ff'], led: ['#ffffff', '#ffffff'], yellow: ['#ffc21a', '#ffd966'] }[v.headlights] || ['#ffe9b0', '#fff4d0'];
  // headlight, anchored on the front fascia between bumper top and hood edge
  const hx = X(0.015), hyc = Y(Math.max(geo.gc + 0.3, Math.min(geo.hoodFY, geo.noseY + 0.12) - 0.115));
  const kind = sh.lights || 'swept';
  const housing = '#101114';
  const lit = head[0];
  switch (kind) {
    case 'round': { const r = ppm * 0.07; g.fillStyle = housing; g.beginPath(); g.arc(hx + ppm * 0.14, hyc, r * 1.25, 0, 7); g.fill(); g.fillStyle = lit; g.beginPath(); g.arc(hx + ppm * 0.14, hyc, r, 0, 7); g.fill(); g.fillStyle = head[1]; g.beginPath(); g.arc(hx + ppm * 0.14, hyc, r * 0.45, 0, 7); g.fill(); break; }
    case 'rect': fillPoly(g, [[hx, hyc - ppm * 0.07], [hx + ppm * 0.36, hyc - ppm * 0.07], [hx + ppm * 0.36, hyc + ppm * 0.07], [hx, hyc + ppm * 0.07]], housing); fillPoly(g, [[hx + 6, hyc - ppm * 0.05], [hx + ppm * 0.33, hyc - ppm * 0.05], [hx + ppm * 0.33, hyc + ppm * 0.05], [hx + 6, hyc + ppm * 0.05]], lit); break;
    case 'quad': for (const dy of [-0.065, 0.065]) { fillPoly(g, [[hx, hyc + ppm * dy - ppm * 0.04], [hx + ppm * 0.26, hyc + ppm * dy - ppm * 0.04], [hx + ppm * 0.26, hyc + ppm * dy + ppm * 0.04], [hx, hyc + ppm * dy + ppm * 0.04]], housing); fillPoly(g, [[hx + 5, hyc + ppm * dy - ppm * 0.03], [hx + ppm * 0.24, hyc + ppm * dy - ppm * 0.03], [hx + ppm * 0.24, hyc + ppm * dy + ppm * 0.03], [hx + 5, hyc + ppm * dy + ppm * 0.03]], lit); } break;
    case 'slim': case 'led': case 'pixel': { const h = kind === 'slim' ? 0.05 : 0.06; fillPoly(g, [[hx, hyc - ppm * h], [hx + ppm * 0.46, hyc - ppm * (h + 0.02)], [hx + ppm * 0.46, hyc + ppm * h], [hx, hyc + ppm * (h + 0.015)]], housing); fillPoly(g, [[hx + 6, hyc - ppm * (h - 0.015)], [hx + ppm * 0.43, hyc - ppm * (h + 0.005)], [hx + ppm * 0.43, hyc + ppm * (h - 0.025)], [hx + 6, hyc + ppm * (h - 0.012)]], lit); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(hx + 10, hyc - ppm * 0.012, ppm * 0.4, 4); break; }
    case 'pop': fillPoly(g, [[hx + ppm * 0.18, Y(geo.hoodFY) - ppm * 0.01], [hx + ppm * 0.55, Y(geo.hoodFY) - ppm * 0.07], [hx + ppm * 0.58, Y(geo.hoodFY) - ppm * 0.03], [hx + ppm * 0.2, Y(geo.hoodFY) + ppm * 0.01]], rgb(darken(hex(v.paint), 0.15))); fillPoly(g, [[hx, hyc - ppm * 0.03], [hx + ppm * 0.2, hyc - ppm * 0.03], [hx + ppm * 0.2, hyc + ppm * 0.03], [hx, hyc + ppm * 0.03]], housing); break;
    case 'boomerang': fillPoly(g, [[hx, hyc - ppm * 0.05], [hx + ppm * 0.42, hyc - ppm * 0.1], [hx + ppm * 0.4, hyc - ppm * 0.05], [hx + ppm * 0.12, hyc + ppm * 0.07], [hx, hyc + ppm * 0.06]], housing); fillPoly(g, [[hx + 6, hyc - ppm * 0.035], [hx + ppm * 0.38, hyc - ppm * 0.08], [hx + ppm * 0.18, hyc + ppm * 0.03]], lit); break;
    case 'pill': fillPoly(g, [[hx, hyc - ppm * 0.07], [hx + ppm * 0.3, hyc - ppm * 0.07], [hx + ppm * 0.3, hyc + ppm * 0.07], [hx, hyc + ppm * 0.07]], housing); fillPoly(g, [[hx + 6, hyc - ppm * 0.05], [hx + ppm * 0.27, hyc - ppm * 0.05], [hx + ppm * 0.27, hyc + ppm * 0.05], [hx + 6, hyc + ppm * 0.05]], lit); break;
    default: fillPoly(g, [[hx, hyc - ppm * 0.07], [hx + ppm * 0.44, hyc - ppm * 0.1], [hx + ppm * 0.46, hyc - ppm * 0.02], [hx + ppm * 0.1, hyc + ppm * 0.08], [hx, hyc + ppm * 0.07]], housing); fillPoly(g, [[hx + 8, hyc - ppm * 0.05], [hx + ppm * 0.4, hyc - ppm * 0.08], [hx + ppm * 0.42, hyc - ppm * 0.03], [hx + ppm * 0.12, hyc + ppm * 0.05], [hx + 8, hyc + ppm * 0.05]], lit);
  }
  if (v.headlights === 'led' || v.headlights === 'xenon') { g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(hx + ppm * 0.1, hyc, ppm * 0.28, 0, 7); g.fill(); }
  // tail lights on the rear panel
  const smoked = v.taillights === 'smoked', bar = v.taillights === 'bar';
  const red = smoked ? '#6a0e16' : '#e0192e', hot = bar ? '#ff5a68' : red;
  const tx = X(L - 0.02), tyc = Y(geo.tailY - 0.07 * H - 0.02);
  const tk = bar ? 'bar' : (sh.tl || 'wrap');
  const dark = '#1a0b0d';
  switch (tk) {
    case 'tri': fillPoly(g, [[tx - ppm * 0.36, tyc - ppm * 0.09], [tx, tyc - ppm * 0.1], [tx, tyc + ppm * 0.09], [tx - ppm * 0.34, tyc + ppm * 0.08]], dark); for (let i = 0; i < 3; i++) fillPoly(g, [[tx - ppm * (0.32 - i * 0.1), tyc - ppm * 0.07], [tx - ppm * (0.26 - i * 0.1), tyc - ppm * 0.07], [tx - ppm * (0.26 - i * 0.1), tyc + ppm * 0.07], [tx - ppm * (0.32 - i * 0.1), tyc + ppm * 0.07]], hot); break;
    case 'round': for (const dy of [-0.045, 0.05]) { g.fillStyle = dark; g.beginPath(); g.arc(tx - ppm * 0.1, tyc + ppm * dy, ppm * 0.065, 0, 7); g.fill(); g.fillStyle = hot; g.beginPath(); g.arc(tx - ppm * 0.1, tyc + ppm * dy, ppm * 0.048, 0, 7); g.fill(); } break;
    case 'rect': fillPoly(g, [[tx - ppm * 0.3, tyc - ppm * 0.08], [tx, tyc - ppm * 0.08], [tx, tyc + ppm * 0.08], [tx - ppm * 0.3, tyc + ppm * 0.08]], dark); fillPoly(g, [[tx - ppm * 0.27, tyc - ppm * 0.06], [tx - 3, tyc - ppm * 0.06], [tx - 3, tyc + ppm * 0.06], [tx - ppm * 0.27, tyc + ppm * 0.06]], hot); break;
    case 'bar': case 'led': case 'slim': case 'pixel': fillPoly(g, [[tx - ppm * 0.44, tyc - ppm * 0.04], [tx, tyc - ppm * 0.05], [tx, tyc + ppm * 0.04], [tx - ppm * 0.4, tyc + ppm * 0.04]], dark); fillPoly(g, [[tx - ppm * 0.41, tyc - ppm * 0.025], [tx - 3, tyc - ppm * 0.03], [tx - 3, tyc + ppm * 0.025], [tx - ppm * 0.38, tyc + ppm * 0.025]], '#ff3b4a'); if (bar) { g.fillStyle = '#ff6a74'; g.fillRect(tx - ppm * 0.38, tyc - 3, ppm * 0.36, 6); } break;
    case 'boomerang': fillPoly(g, [[tx - ppm * 0.34, tyc - ppm * 0.08], [tx, tyc - ppm * 0.1], [tx, tyc + ppm * 0.02], [tx - ppm * 0.12, tyc + ppm * 0.08], [tx - ppm * 0.34, tyc - ppm * 0.02]], dark); fillPoly(g, [[tx - ppm * 0.3, tyc - ppm * 0.06], [tx - 4, tyc - ppm * 0.08], [tx - ppm * 0.14, tyc + ppm * 0.04]], hot); break;
    case 'hex': fillPoly(g, [[tx - ppm * 0.3, tyc - ppm * 0.03], [tx - ppm * 0.18, tyc - ppm * 0.09], [tx, tyc - ppm * 0.05], [tx, tyc + ppm * 0.04], [tx - ppm * 0.14, tyc + ppm * 0.08]], dark); fillPoly(g, [[tx - ppm * 0.26, tyc - ppm * 0.02], [tx - ppm * 0.17, tyc - ppm * 0.06], [tx - 4, tyc - ppm * 0.03], [tx - 4, tyc + ppm * 0.02], [tx - ppm * 0.14, tyc + ppm * 0.05]], hot); break;
    case 'quad': for (const dy of [-0.04, 0.04]) for (const dx of [0.07, 0.17]) { g.fillStyle = dark; g.beginPath(); g.arc(tx - ppm * dx, tyc + ppm * dy, ppm * 0.04, 0, 7); g.fill(); g.fillStyle = hot; g.beginPath(); g.arc(tx - ppm * dx, tyc + ppm * dy, ppm * 0.028, 0, 7); g.fill(); } break;
    default: fillPoly(g, [[tx - ppm * 0.34, tyc - ppm * 0.08], [tx, tyc - ppm * 0.1], [tx, tyc + ppm * 0.07], [tx - ppm * 0.3, tyc + ppm * 0.08]], dark); fillPoly(g, [[tx - ppm * 0.3, tyc - ppm * 0.06], [tx - 3, tyc - ppm * 0.08], [tx - 3, tyc + ppm * 0.05], [tx - ppm * 0.27, tyc + ppm * 0.06]], hot);
  }
}

function paintBadges(g, geo, model, v) {
  // trim badge on the front fender
  const t = (model.trim || '').replace(/\(.*?\)/g, '').trim().slice(0, 9);
  if (!t) return;
  const { X, Y, ppm } = geo;
  g.fillStyle = 'rgba(216,219,224,0.9)'; g.font = `700 ${Math.round(ppm * 0.085)}px sans-serif`; g.textBaseline = 'alphabetic';
  g.fillText(t, X(geo.hoodLeadX + 0.35), Y(geo.beltY * 0.74));
  void v;
}

function paintDecals(g, geo, v) {
  const { X, Y, ppm, L, H } = geo;
  const col = rgb(hex(v.decalColor || '#f2f2f2'), 0.95);
  g.save(); roundPath(g, bodyPx(geo)); g.clip();
  const yb = Y(geo.beltY * 0.6), hy = Y(hoodYAt(geo, geo.hoodLeadX + 0.4));
  if (v.decal === 'stripes') {
    fillPoly(g, [[X(geo.hoodLeadX), Y(geo.hoodFY) - 2], [X(geo.xCowl), Y(geo.hoodBY) - 2], [X(geo.xCowl), Y(geo.hoodBY) + ppm * 0.06], [X(geo.hoodLeadX), Y(geo.hoodFY) + ppm * 0.06]], col);
    fillPoly(g, [[X(geo.xA + 0.15), Y(H) - 2], [X(geo.xC - 0.15), Y(geo.roofRear * H) - 2], [X(geo.xC - 0.15), Y(geo.roofRear * H) + ppm * 0.05], [X(geo.xA + 0.15), Y(H) + ppm * 0.05]], col);
    fillPoly(g, [[X(L - 0.5), geo.topAt ? Y(geo.topAt(L - 0.5)) - 2 : 0], [X(L - 0.04), Y(geo.tailY) - 2], [X(L - 0.04), Y(geo.tailY) + ppm * 0.05], [X(L - 0.5), Y(geo.topAt(L - 0.5)) + ppm * 0.05]], col);
  }
  if (v.decal === 'side' || v.decal === 'crew') {
    fillPoly(g, [[X(0.3), yb + ppm * 0.02], [X(L - 0.05), yb - ppm * 0.06], [X(L - 0.05), yb + ppm * 0.02], [X(0.3), yb + ppm * 0.1]], col);
    if (v.decal === 'crew') { g.fillStyle = '#111'; g.fillRect(X(geo.doorR - 0.9), yb - 4, ppm * 0.2, 6); }
  }
  if (v.decal === 'number') { const cx = lerp(X(geo.doorF), X(geo.doorR), 0.5), cy = Y(geo.beltY * 0.62); g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(cx, cy, ppm * 0.17, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = `bold ${Math.round(ppm * 0.22)}px sans-serif`; g.textAlign = 'center'; g.fillText('7', cx, cy + ppm * 0.08); g.textAlign = 'left'; }
  if (v.decal === 'flames') {
    const x0 = X(geo.doorF - 0.1), x1 = X(geo.doorR), yb2 = Y(geo.gc + 0.2), yt = Y(geo.beltY * 0.9);
    const spikes = 6, w = (x1 - x0) / spikes;
    g.fillStyle = '#ff9a1a'; g.beginPath(); g.moveTo(x0, yb2); for (let i = 0; i <= spikes; i++) { g.lineTo(x0 + i * w, i % 2 ? yb2 : lerp(yt, yb2, 0.2 + (i % 3) * 0.12)); g.lineTo(x0 + (i + 0.5) * w, yb2); } g.closePath(); g.fill();
    g.fillStyle = '#e0192e'; g.beginPath(); g.moveTo(x0, yb2); for (let i = 0; i <= spikes; i++) { g.lineTo(x0 + i * w + 4, i % 2 ? yb2 : lerp(yt, yb2, 0.45 + (i % 3) * 0.1)); g.lineTo(x0 + (i + 0.5) * w, yb2); } g.closePath(); g.fill();
  }
  void hy;
  g.restore();
}

function paintExtras(g, geo, v) {
  const { X, Y, ppm, L, H } = geo;
  const sh = geo.sh;
  // mid-engine side intakes behind the door
  if (sh.gills) {
    const x0 = X(geo.doorR - 0.25), x1 = X(geo.doorR + 0.55), y0 = Y(geo.beltY * 0.82), y1 = Y(geo.gc + 0.28);
    fillPoly(g, [[x0, y1 - 10], [x1, y1 - 30], [x1 + 10, y0 + 20], [x0 + 14, y0]], '#08090b');
    g.strokeStyle = 'rgba(80,84,92,0.8)'; g.lineWidth = 3;
    for (let i = 1; i < 6; i++) { const t = i / 6; g.beginPath(); g.moveTo(lerp(x0 + 10, x1, t), lerp(y1 - 12, y1 - 32, t)); g.lineTo(lerp(x0 + 18, x1 + 8, t), lerp(y0 + 4, y0 + 22, t)); g.stroke(); }
  }
  // pickup bed rail + cab gap
  if (sh.arch === 'P') {
    g.strokeStyle = 'rgba(10,10,12,0.85)'; g.lineWidth = 5;
    const bx = X(geo.xD + 0.04), by = Y(geo.deckY);
    g.beginPath(); g.moveTo(bx, by + 4); g.lineTo(bx, Y(geo.gc + 0.45)); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(bx + 14, by + 8, X(L - 0.06) - bx - 20, 8);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(bx + 14, by + 2, X(L - 0.06) - bx - 20, 4);
    g.strokeStyle = 'rgba(10,10,12,0.8)'; g.lineWidth = 4; g.beginPath(); g.moveTo(X(L - 0.08), by + 6); g.lineTo(X(L - 0.08), Y(geo.gc + 0.4)); g.stroke();
  }
  void v; void H;
}

// engine bay: reuse the Mustang cut-away art, scaled into this car's hood area
function engineBay(g, geo, v, lv) {
  const { X, Y, ppm, gc } = geo;
  const nx = X(0.08), cx = X(geo.xCowl), cowlY = Y(geo.hoodBY), botY = Y(gc + 0.12);
  const sx = (cx - nx) / (668 - 92), sy = Math.max(0.3, (botY - cowlY) / (560 - 276));
  g.save();
  g.translate(nx - 92 * sx, cowlY - 276 * sy);
  g.scale(sx, sy);
  drawEngineBay(g, v, lv);
  g.restore();
  void ppm;
}

// ------------------------------------------------------------------ main
// opts: { model, visual, levels, tune, cond, showEngine, layers }
export function drawSideCar(canvas, opts) {
  const model = opts.model;
  if (model && MUSTANG_ART.has(model.id)) return drawSideMustang(canvas, opts);
  if (model && artOf(model.id)) return drawSideArt(canvas, opts, artOf(model.id));
  const v = opts.visual || {}, lv = opts.levels || {};
  const off = opts.layers || {};
  const on = k => off[k] !== false;
  const sh = shapeOf(model);
  const geo = sideGeo(sh);
  canvas.width = SW; canvas.height = SH;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, SW, SH);
  g.save(); g.scale(K, K);
  g.imageSmoothingEnabled = true;

  const size = +v.wheelSize || sh.rim || 18, offset = v.offset || 'flush';
  const caliper = CALIPER_COLORS[Math.min(4, lv.brakes || 0)] || '#3a3a3a';
  const flare = v.kit === 'wide' ? 26 : 0;
  const drop = rideDrop(lv, opts.tune), lower = c => lowerBody(c, drop, geo.fx, geo.rx, geo.ppm / 1000);

  // ground shadow + underglow
  const cxm = (geo.X(0) + geo.X(sh.L)) / 2, hw = (geo.X(sh.L) - geo.X(0)) / 2;
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(cxm, GROUND + 6, hw * 1.02, 20, 0, 0, 7); g.fill();
  if (on('underglow') && v.neon && v.neon !== 'none') {
    const gr = g.createRadialGradient(cxm, GROUND, 10, cxm, GROUND, hw); gr.addColorStop(0, v.neon); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5; g.fillStyle = gr; g.beginPath(); g.ellipse(cxm, GROUND + 4, hw, 60, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  }

  g.save(); lower(g);
  if (flare) { const base = hex(v.paint); for (const cx of [geo.fx, geo.rx]) { g.fillStyle = rgb(darken(base, 0.1)); g.beginPath(); g.arc(cx, geo.cy, geo.R + 46, Math.PI * 0.98, Math.PI * 2.02); g.fill(); } }
  if (on('body')) paintBody(g, geo, v);
  if (on('skirts')) paintSkirts(g, geo, v);
  if (on('windows')) paintWindows(g, geo, v);
  if (on('hood') && !opts.showEngine) paintHood(g, geo, v);
  if (on('front')) paintFront(g, geo, v);
  if (on('rear')) paintRear(g, geo, v);
  if (on('spoiler')) paintSpoiler(g, geo, v);
  if (on('lights')) paintLights(g, geo, v);
  paintExtras(g, geo, v);
  paintBadges(g, geo, model, v);
  if (on('decals')) paintDecals(g, geo, v);
  wheelArch(g, geo.fx, geo.cy, v, flare, geo.R); wheelArch(g, geo.rx, geo.cy, v, flare, geo.R);
  if (opts.showEngine) engineBay(g, geo, v, lv);
  g.restore();

  if (on('wheels')) { drawWheel(g, geo.fx, geo.cy, v, size, offset, caliper, 'front', geo.R); drawWheel(g, geo.rx, geo.cy, v, size, offset, caliper, 'rear', geo.R); }
  g.save(); lower(g);
  if (offset !== 'poke') { archLip(g, geo.fx, geo.cy, v, flare, geo.R); archLip(g, geo.rx, geo.cy, v, flare, geo.R); }
  g.restore();
  g.restore();
  return canvas;
}

// Cars with their own side art (gfx2d/carArt.js): the art is the body,
// repainted to the car's colour, sitting on the game's wheels. Graphics go on
// the paint only; wing, ride height, underglow and engine bay work as usual.
function drawSideArt(canvas, opts, art) {
  const model = opts.model;
  const v = opts.visual || {}, lv = opts.levels || {};
  const off = opts.layers || {};
  const on = k => off[k] !== false;
  const sh = shapeOf(model);
  const geo = sideGeo(sh);
  const { ppm } = geo;
  canvas.width = SW; canvas.height = SH;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, SW, SH);

  const pa = paintedArt(art.side, v);
  const s = ppm * sh.L / pa.w;                   // art px -> drawing px
  const R = (art.meta.tireR || 0.36) * ppm;      // default: 20" wheel on a 275/40 tyre
  const cy = GROUND - R;
  const x0 = (REF_W - pa.w * s) / 2;
  const y0 = cy - 4 * s - art.meta.archY * s;
  const [fx, rx, ...more] = art.meta.wheels.map(x => x0 + x * s);   // a big rig has a second rear axle
  const size = +v.wheelSize || 20, offset = v.offset || 'flush';
  const caliper = CALIPER_COLORS[Math.min(4, lv.brakes || 0)] || '#3a3a3a';
  const drop = rideDrop(lv, opts.tune), lower = c => lowerBody(c, drop, fx, rx, ppm / 1000);

  g.save(); g.scale(K, K);
  g.imageSmoothingEnabled = true;
  const cxm = x0 + pa.w * s / 2, hw = pa.w * s / 2;
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(cxm, GROUND + 6, hw * 1.02, 20, 0, 0, 7); g.fill();
  if (on('underglow') && v.neon && v.neon !== 'none') {
    const gr = g.createRadialGradient(cxm, GROUND, 10, cxm, GROUND, hw); gr.addColorStop(0, v.neon); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5; g.fillStyle = gr; g.beginPath(); g.ellipse(cxm, GROUND + 4, hw, 60, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  }
  // dark wheel wells, then the wheels; the body goes over both
  g.save(); lower(g);
  for (const x of [fx, rx, ...more]) wheelArch(g, x, cy, v, 0, R);
  g.restore();
  if (on('wheels')) { drawWheel(g, fx, cy, v, size, offset, caliper, 'front', R); for (const x of [rx, ...more]) drawWheel(g, x, cy, v, size, offset, caliper, 'rear', R); }
  g.restore();

  // body on its own layer so graphics can be clipped to the paint
  const b = document.createElement('canvas'); b.width = SW; b.height = SH;
  const bg = b.getContext('2d');
  bg.scale(K, K); lower(bg); bg.imageSmoothingEnabled = true;
  if (on('body')) bg.drawImage(pa.full, x0, y0, pa.w * s, pa.h * s);
  if (on('decals') && v.decal && v.decal !== 'none') {
    bg.save(); bg.globalCompositeOperation = 'source-atop';
    const col = rgb(hex(v.decalColor || '#f2f2f2'), 0.95);
    // decal spots were laid out on the 1126x296 Hellcat art; other art scales them
    const X = px => x0 + px * pa.w / 1126 * s, Y = py => y0 + py * pa.h / 296 * s;
    if (v.decal === 'stripes') { bg.fillStyle = col; bg.fillRect(X(0), Y(105), pa.w * s, 9 * s); }
    if (v.decal === 'side' || v.decal === 'crew') fillPoly(bg, [[X(60), Y(205)], [X(1100), Y(190)], [X(1100), Y(204)], [X(60), Y(219)]], col);
    if (v.decal === 'number') { const nx = X(590), ny = Y(195); bg.fillStyle = '#f2f2f2'; bg.beginPath(); bg.arc(nx, ny, ppm * 0.17, 0, 7); bg.fill(); bg.fillStyle = '#111'; bg.font = `bold ${Math.round(ppm * 0.22)}px sans-serif`; bg.textAlign = 'center'; bg.fillText('7', nx, ny + ppm * 0.08); }
    if (v.decal === 'flames') {
      const fx0 = X(300), fx1 = X(780), yb = Y(270), yt = Y(150), spikes = 6, w = (fx1 - fx0) / spikes;
      bg.fillStyle = '#ff9a1a'; bg.beginPath(); bg.moveTo(fx0, yb); for (let i = 0; i <= spikes; i++) { bg.lineTo(fx0 + i * w, i % 2 ? yb : lerp(yt, yb, 0.2 + (i % 3) * 0.12)); bg.lineTo(fx0 + (i + 0.5) * w, yb); } bg.closePath(); bg.fill();
      bg.fillStyle = '#e0192e'; bg.beginPath(); bg.moveTo(fx0, yb); for (let i = 0; i <= spikes; i++) { bg.lineTo(fx0 + i * w + 4, i % 2 ? yb : lerp(yt, yb, 0.45 + (i % 3) * 0.1)); bg.lineTo(fx0 + (i + 0.5) * w, yb); } bg.closePath(); bg.fill();
    }
    bg.restore();
    if (on('body')) bg.drawImage(pa.fixed, x0, y0, pa.w * s, pa.h * s);
  }
  // a wing on stands, if one is fitted (the factory lip is in the art)
  const wing = { gt: 'big', drag: 'huge' }[v.spoiler];
  if (on('spoiler') && wing) {
    const ax = x0 + 1010 * pa.w / 1126 * s, ay = y0 + 92 * pa.h / 296 * s, h = (wing === 'huge' ? 0.4 : 0.27) * ppm, chord = (wing === 'huge' ? 0.42 : 0.3) * ppm;
    bg.fillStyle = '#121316';
    bg.fillRect(ax + chord * 0.2, ay - h, 10, h); bg.fillRect(ax + chord * 0.7, ay - h, 10, h);
    fillPoly(bg, [[ax - 10, ay - h - 4], [ax + chord + 10, ay - h - 14], [ax + chord + 14, ay - h + 6], [ax - 10, ay - h + 12]], wing === 'huge' ? '#1c1d22' : rgb(darken(hex(v.paint), 0.2)));
  }
  if (opts.showEngine) engineBay(bg, geo, v, lv);
  g.drawImage(b, 0, 0);
  return canvas;
}
