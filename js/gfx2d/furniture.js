// Furniture seen from above, for the house on the map (world2d/render.js)
// and the builder (ui/builder.js). Everything is drawn in a local box where
// -y is the front of the piece: the foot of the bed, the seat of the couch.

import { FURN_BY_ID } from '../data/homes.js';

// (x, y, w, h): the screen rectangle it fills. (fx, fy): which way the front
// faces on screen (a unit vector). s: pixels per metre, for detail cut-offs.
export function drawFurniture(ctx, id, x, y, w, h, fx, fy, s = 10) {
  const F = FURN_BY_ID[id];
  if (!F) return;
  const horiz = Math.abs(fx) > Math.abs(fy);
  const W = horiz ? h : w, D = horiz ? w : h;      // across the front, front to back
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.atan2(fx, -fy));
  const L = -W / 2, T = -D / 2;
  const box = (x0, y0, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(L + x0 * W, T + y0 * D, ww * W, hh * D); };
  const dot = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(L + cx * W, T + cy * D, Math.max(0.6, r * Math.min(W, D)), 0, Math.PI * 2); ctx.fill(); };
  const line = (x0, y0, x1, y1, c, lw = 1) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(L + x0 * W, T + y0 * D); ctx.lineTo(L + x1 * W, T + y1 * D); ctx.stroke(); };
  const pad = 0.08;
  const shade = 'rgba(0,0,0,0.28)';
  // a soft shadow under everything that isn't flat on the floor
  if (!F.flat && id !== 'stairs') { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(L + W * pad + 1, T + D * pad + 1.5, W * (1 - 2 * pad), D * (1 - 2 * pad)); }
  switch (id) {
    case 'bed': case 'kingbed':
      box(pad, pad, 1 - 2 * pad, 1 - 2 * pad, F.c);
      box(pad, pad, 1 - 2 * pad, 0.62, F.accent);                      // the blanket at the foot
      box(pad + 0.04, 0.72, (1 - 2 * pad) / 2 - 0.06, 0.16, '#ffffff');  // pillows at the head
      box(0.52, 0.72, (1 - 2 * pad) / 2 - 0.06, 0.16, '#ffffff');
      box(pad, 0.92 - pad / 2, 1 - 2 * pad, 0.06, '#4a3a2e');            // headboard
      break;
    case 'dresser': box(0.1, 0.45, 0.8, 0.45, F.c); line(0.5, 0.45, 0.5, 0.9, shade); break;
    case 'closet': box(0.06, 0.06, 0.88, 0.88, F.c); for (let k = 1; k < 6; k++) line(0.12, 0.12 + k * 0.13, 0.88, 0.12 + k * 0.13, F.accent); break;
    case 'toilet': box(0.25, 0.68, 0.5, 0.24, F.c); ctx.fillStyle = F.c; ctx.beginPath(); ctx.ellipse(0, D * 0.05, W * 0.2, D * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = shade; ctx.stroke(); break;
    case 'shower':
      box(0.05, 0.05, 0.9, 0.9, F.c);
      for (let k = 1; k < 4; k++) { line(0.05 + k * 0.225, 0.05, 0.05 + k * 0.225, 0.95, 'rgba(255,255,255,0.35)'); line(0.05, 0.05 + k * 0.225, 0.95, 0.05 + k * 0.225, 'rgba(255,255,255,0.35)'); }
      dot(0.5, 0.5, 0.06, '#4a4f57'); break;
    case 'tub': box(0.08, 0.06, 0.84, 0.88, F.c); box(0.18, 0.14, 0.64, 0.72, F.accent); dot(0.5, 0.82, 0.05, '#c8ccd2'); break;
    case 'sink': box(0.05, 0.5, 0.9, 0.42, F.c); ctx.fillStyle = '#ffffff'; for (const cx of [0.28, 0.72]) { ctx.beginPath(); ctx.ellipse(L + cx * W, T + 0.7 * D, W * 0.14, D * 0.1, 0, 0, Math.PI * 2); ctx.fill(); } break;
    case 'counter': box(0.02, 0.4, 0.96, 0.56, F.c); line(0.02, 0.4, 0.98, 0.4, shade); break;
    case 'stove': box(0.06, 0.3, 0.88, 0.64, F.c); for (const [a, b] of [[0.3, 0.48], [0.7, 0.48], [0.3, 0.78], [0.7, 0.78]]) { ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(L + a * W, T + b * D, Math.min(W, D) * 0.1, 0, Math.PI * 2); ctx.stroke(); } break;
    case 'fridge': box(0.1, 0.3, 0.8, 0.64, F.c); line(0.5, 0.3, 0.5, 0.94, shade); break;
    case 'island': box(0.06, 0.25, 0.88, 0.5, F.c); for (const cx of [0.2, 0.4, 0.6, 0.8]) dot(cx, 0.13, 0.09, F.accent); break;
    case 'couch':
      box(pad, 0.3, 1 - 2 * pad, 0.62, F.c);
      box(pad, 0.72, 1 - 2 * pad, 0.2, shadeOf(F.c));
      box(pad, 0.3, 0.08, 0.62, shadeOf(F.c)); box(0.84, 0.3, 0.08, 0.62, shadeOf(F.c));
      break;
    case 'sectional':
      box(0.06, 0.6, 0.88, 0.34, F.c); box(0.06, 0.1, 0.32, 0.84, F.c);
      box(0.06, 0.84, 0.88, 0.1, shadeOf(F.c)); box(0.06, 0.1, 0.1, 0.84, shadeOf(F.c));
      dot(0.55, 0.35, 0.08, F.accent);
      break;
    case 'tv': box(0.08, 0.84, 0.84, 0.1, F.c); box(0.12, 0.8, 0.76, 0.04, F.accent); box(0.3, 0.6, 0.4, 0.2, '#3a2a1e'); break;
    case 'table': box(0.1, 0.25, 0.8, 0.5, F.c); for (const cx of [0.25, 0.5, 0.75]) { box(cx - 0.06, 0.07, 0.12, 0.14, '#4a3a2e'); box(cx - 0.06, 0.79, 0.12, 0.14, '#4a3a2e'); } break;
    case 'rug': box(0.04, 0.04, 0.92, 0.92, F.c); ctx.strokeStyle = 'rgba(255,230,190,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(L + 0.12 * W, T + 0.12 * D, 0.76 * W, 0.76 * D); break;
    case 'plant': dot(0.5, 0.5, 0.22, '#5a3a22'); dot(0.5, 0.5, 0.18, F.c); dot(0.42, 0.42, 0.1, '#3f8a4a'); break;
    case 'lamp': ctx.fillStyle = 'rgba(232,194,26,0.18)'; ctx.beginPath(); ctx.arc(0, 0, Math.min(W, D) * 0.45, 0, Math.PI * 2); ctx.fill(); dot(0.5, 0.5, 0.12, F.c); break;
    case 'desk': box(0.06, 0.5, 0.88, 0.42, F.c); box(0.2, 0.78, 0.6, 0.08, '#111215'); box(0.06, 0.9, 0.88, 0.03, F.accent); box(0.3, 0.15, 0.4, 0.3, '#2a2a2e'); break;
    case 'pool': box(0.06, 0.15, 0.88, 0.7, F.accent); box(0.1, 0.22, 0.8, 0.56, F.c); for (const [a, b] of [[0.1, 0.22], [0.5, 0.22], [0.9, 0.22], [0.1, 0.78], [0.5, 0.78], [0.9, 0.78]]) dot(a, b, 0.04, '#111'); dot(0.35, 0.5, 0.04, '#fff'); break;
    case 'arcade': box(0.15, 0.4, 0.7, 0.52, F.c); box(0.22, 0.45, 0.56, 0.18, F.accent); break;
    case 'bar': box(0.04, 0.6, 0.92, 0.34, F.c); for (let k = 0; k < 7; k++) dot(0.1 + k * 0.13, 0.86, 0.035, k % 2 ? F.accent : '#3fa9d6'); for (const cx of [0.2, 0.45, 0.7]) dot(cx, 0.35, 0.08, '#1a1a1a'); break;
    case 'trophy': box(0.1, 0.55, 0.8, 0.38, F.c); for (const cx of [0.25, 0.5, 0.75]) dot(cx, 0.74, 0.08, F.accent); break;
    case 'safe': box(0.15, 0.15, 0.7, 0.7, F.c); dot(0.5, 0.5, 0.12, '#8a8f96'); break;
    case 'grill': box(0.2, 0.3, 0.6, 0.4, F.c); dot(0.8, 0.5, 0.12, '#3a3a3a'); break;
    case 'jacuzzi': box(0.04, 0.04, 0.92, 0.92, F.c); ctx.fillStyle = F.accent; ctx.beginPath(); ctx.arc(0, 0, Math.min(W, D) * 0.36, 0, Math.PI * 2); ctx.fill(); dot(0.5, 0.5, 0.08, 'rgba(255,255,255,0.5)'); break;
    case 'chairs': box(0.1, 0.3, 0.32, 0.4, F.c); box(0.58, 0.3, 0.32, 0.4, F.c); break;
    case 'stairs':
      box(0.08, 0.02, 0.84, 0.96, F.c);
      for (let k = 1; k < 9; k++) line(0.08, k / 9, 0.92, k / 9, 'rgba(0,0,0,0.35)');
      line(0.5, 0.92, 0.5, 0.12, 'rgba(255,255,255,0.6)', Math.max(1, s * 0.08));
      line(0.5, 0.12, 0.38, 0.26, 'rgba(255,255,255,0.6)', Math.max(1, s * 0.08)); line(0.5, 0.12, 0.62, 0.26, 'rgba(255,255,255,0.6)', Math.max(1, s * 0.08));
      break;
    default: box(0.1, 0.1, 0.8, 0.8, F.c);
  }
  ctx.restore();
}

function shadeOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${Math.round(r * 0.7)},${Math.round(g * 0.7)},${Math.round(b * 0.7)})`;
}
