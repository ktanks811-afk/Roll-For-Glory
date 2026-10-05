// Livestock on your land: cows and horses graze inside the fence, dogs run
// the yard and come running when you pull up. Built from the save
// (s.estate.land[id].animals), so buying or selling one shows up at once.

import { ESTATE_LOCATIONS, ANIMAL_BY_ID } from '../data/estate.js';
import { pasture } from '../core/estate.js';

const SIZE = { cow: [1.25, 0.6], longhorn: [1.3, 0.62], horse: [1.35, 0.45], dog: [0.55, 0.22] };

export class Ranch {
  constructor(w) { this.w = w; this.list = []; this.key = ''; this.t = 0; }

  rebuild() {
    const s = this.w.s, out = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const loc of ESTATE_LOCATIONS) {
      const l = s.estate?.land?.[loc.id];
      if (!l?.owned || !l.animals) continue;
      const pen = pasture(loc), lot = { x0: loc.lot.x0 + 3, z0: loc.lot.z0 + 3, x1: loc.lot.x1 - 3, z1: loc.lot.z1 - 3 };
      // the herd keeps together near the gate end of the pasture, where you can see it
      const herd = herdArea(pen, loc.side);
      for (const [kind, n] of Object.entries(l.animals)) {
        const A = ANIMAL_BY_ID[kind];
        if (!A) continue;
        for (let k = 0; k < n; k++) {
          const area = A.pen ? herd : lot;
          const breed = A.breeds ? A.breeds[k % A.breeds.length] : null;
          const x = area.x0 + rnd() * (area.x1 - area.x0), z = area.z0 + rnd() * (area.z1 - area.z0);
          out.push({ kind, area, x, z, h: rnd() * 6.28, tx: x, tz: z, wait: rnd() * 4, color: breed ? breed[1] : kind === 'cow' && k % 4 === 3 ? '#6a3a22' : A.color, step: 0, home: loc.id });
        }
      }
    }
    this.list = out;
  }

  update(dt) {
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1;
      const key = JSON.stringify(Object.entries(this.w.s.estate?.land || {}).map(([id, l]) => [id, l.owned, l.animals, l.fence]));
      if (key !== this.key) { this.key = key; this.rebuild(); }
    }
    if (!this.list.length) return;
    const p = this.w.playerState();
    for (const a of this.list) {
      if (Math.abs(a.x - p.x) > 400 || Math.abs(a.z - p.z) > 400) continue;
      const dog = a.kind === 'dog';
      // dogs come running when you're around (and stay near the yard)
      const near = dog && Math.hypot(p.x - a.x, p.z - a.z) < 45 && p.x > a.area.x0 - 30 && p.x < a.area.x1 + 30 && p.z > a.area.z0 - 30 && p.z < a.area.z1 + 30;
      if (near) {
        const ang = Math.atan2(a.z - p.z, a.x - p.x) + 0.6;
        a.tx = p.x + Math.cos(ang) * 2.6; a.tz = p.z + Math.sin(ang) * 2.6; a.wait = 0;
      } else if (a.wait > 0) { a.wait -= dt; continue; }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      const speed = dog ? (near ? 7.5 : 2.2) : a.kind === 'horse' ? 1.6 : 0.8;
      if (d < 0.4) {
        if (!near) {
          a.wait = dog ? 1 + Math.random() * 3 : 3 + Math.random() * 9;
          const r = dog ? 12 : 20;
          a.tx = Math.max(a.area.x0, Math.min(a.area.x1, a.x + (Math.random() - 0.5) * r * 2));
          a.tz = Math.max(a.area.z0, Math.min(a.area.z1, a.z + (Math.random() - 0.5) * r * 2));
        }
        continue;
      }
      const m = Math.min(d, speed * dt);
      a.x += dx / d * m; a.z += dz / d * m;
      const want = Math.atan2(dx, -dz);
      let dh = want - a.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      a.h += dh * Math.min(1, dt * 6);
      a.step += m * 3;
    }
  }

  draw(ctx, cam) {
    const v = cam.view(10), z = cam.zoom;
    if (z < 0.8) return;
    for (const a of this.list) {
      if (a.x < v.x0 || a.x > v.x1 || a.z < v.z0 || a.z > v.z1) continue;
      const [L, W] = SIZE[a.kind];
      ctx.save();
      ctx.translate(cam.sx(a.x), cam.sy(a.z)); ctx.rotate(a.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0.25 * z, 0.3 * z, W * z, L * z, 0, 0, Math.PI * 2); ctx.fill();
      const leg = Math.sin(a.step) * 0.18 * L;
      ctx.fillStyle = shade(a.color);
      for (const [lx, ly] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect((lx * W * 0.7 - 0.06) * z, (ly * L * 0.55 + (lx * ly > 0 ? leg : -leg) - 0.06) * z, 0.14 * z, 0.14 * z);
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.ellipse(0, 0, W * z, L * z, 0, 0, Math.PI * 2); ctx.fill();
      if (a.kind === 'horse') {
        ctx.beginPath(); ctx.ellipse(0, -L * 1.05 * z, W * 0.45 * z, L * 0.45 * z, 0, 0, Math.PI * 2); ctx.fill();     // neck and head out front
        ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = Math.max(1, 0.12 * z); ctx.beginPath(); ctx.moveTo(0, -L * 0.6 * z); ctx.lineTo(0, -L * 1.3 * z); ctx.stroke();   // mane
        ctx.beginPath(); ctx.moveTo(0, L * z); ctx.lineTo(Math.sin(a.step * 0.5) * 0.2 * z, (L + 0.6) * z); ctx.stroke();    // tail
      } else if (a.kind === 'dog') {
        ctx.beginPath(); ctx.arc(0, -L * 1.05 * z, W * 1.05 * z, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = a.color; ctx.lineWidth = Math.max(1, 0.08 * z); ctx.beginPath(); ctx.moveTo(0, L * z); ctx.lineTo(Math.sin(performance.now() / 90) * 0.25 * z, (L + 0.35) * z); ctx.stroke();   // wagging
      } else {
        ctx.beginPath(); ctx.arc(0, -L * 1.0 * z, W * 0.55 * z, 0, Math.PI * 2); ctx.fill();
        if (a.kind === 'longhorn') { ctx.strokeStyle = '#e8e2c8'; ctx.lineWidth = Math.max(1, 0.12 * z); ctx.beginPath(); ctx.moveTo(-0.95 * z, -L * 1.15 * z); ctx.quadraticCurveTo(0, -L * 0.95 * z, 0.95 * z, -L * 1.15 * z); ctx.stroke(); }
        if (a.color === '#e8e2d8') { ctx.fillStyle = '#1e1e20'; ctx.beginPath(); ctx.arc(0.2 * z, 0.2 * z, 0.25 * z, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
  }
}

// A patch about 64 m wide and 56 m deep at the front of the pasture.
function herdArea(pen, side) {
  const cx = (pen.x0 + pen.x1) / 2, cz = (pen.z0 + pen.z1) / 2;
  const a = { x0: pen.x0 + 2, x1: pen.x1 - 2, z0: pen.z0 + 2, z1: pen.z1 - 2 };
  if (side === 'N' || side === 'S') { a.x0 = Math.max(a.x0, cx - 32); a.x1 = Math.min(a.x1, cx + 32); }
  else { a.z0 = Math.max(a.z0, cz - 32); a.z1 = Math.min(a.z1, cz + 32); }
  if (side === 'N') a.z1 = Math.min(a.z1, a.z0 + 56);
  else if (side === 'S') a.z0 = Math.max(a.z0, a.z1 - 56);
  else if (side === 'W') a.x1 = Math.min(a.x1, a.x0 + 56);
  else a.x0 = Math.max(a.x0, a.x1 - 56);
  return a;
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${((n >> 16) & 255) * 0.6 | 0},${((n >> 8) & 255) * 0.6 | 0},${(n & 255) * 0.6 | 0})`;
}
