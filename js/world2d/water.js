// Water that moves: deep color in the middle and shallows by the shore, two
// layers of waves sliding across each other (a long swell and a short chop,
// each a tiling texture baked once), foam lapping at the shoreline and sun
// glints that flicker on the crests. Everything is drawn only where the
// camera can see it, so phones keep their frame rate. render.js drawWater
// calls this.

const TEX = 256;          // texture size, px
const MPT = 44;           // meters one tile covers
const PPM = TEX / MPT;    // texture px per meter

let swell = null, chop = null, pats = null;

// A tiling wave texture: sum of sines whose wavelengths divide the tile, lit
// from the top left. Bright where a slope faces the sun, dark in the troughs,
// a fleck of white on the tallest crests.
function bake(waves, crest, bright, dark) {
  const c = document.createElement('canvas'); c.width = c.height = TEX;
  const g = c.getContext('2d'), img = g.createImageData(TEX, TEX), d = img.data;
  const lx = 0.55, ly = -0.83, T = Math.PI * 2 / TEX;
  let hmax = 0; for (const w of waves) hmax += w[2];
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let h = 0, gx = 0, gy = 0;
    for (const [kx, ky, a, ph] of waves) { const th = (kx * x + ky * y) * T + ph, c2 = Math.cos(th) * a * T; h += Math.sin(th) * a; gx += c2 * kx; gy += c2 * ky; }
    const sh = (gx * lx + gy * ly) * 9;
    const i = (y * TEX + x) * 4;
    const top = h / hmax;
    if (sh > 0 || top > crest) {
      const a = Math.min(1, Math.max(0, sh) ** 1.4 * bright + (top > crest ? (top - crest) / (1 - crest) * 0.9 : 0));
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = a * 255;
    } else {
      d[i] = 0; d[i + 1] = 18; d[i + 2] = 38; d[i + 3] = Math.min(1, (-sh) ** 1.2 * dark) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
function textures(ctx) {
  if (pats) return pats;
  swell = bake([[1, 2, 1.0, 0.3], [2, 1, 0.7, 1.7], [3, -1, 0.45, 2.9], [-1, 3, 0.35, 4.1], [4, 3, 0.22, 0.8]], 0.86, 0.55, 0.55);
  chop = bake([[5, 7, 0.5, 0.1], [8, -3, 0.45, 1.2], [-6, 9, 0.35, 2.3], [11, 4, 0.3, 3.3], [3, 12, 0.25, 4.4], [13, -9, 0.2, 5.1]], 0.78, 0.8, 0.45);
  pats = { swell: ctx.createPattern(swell, 'repeat'), chop: ctx.createPattern(chop, 'repeat') };
  return pats;
}

// Which sides of a water rect are shoreline (not touching more water).
const shores = new WeakMap();
function shoreOf(w, all) {
  let s = shores.get(w);
  if (s) return s;
  const touch = (side) => all.some(o => {
    if (o === w) return false;
    if (side === 'n') return Math.abs(o.z + o.d - w.z) < 1 && o.x < w.x + w.w && o.x + o.w > w.x;
    if (side === 's') return Math.abs(o.z - (w.z + w.d)) < 1 && o.x < w.x + w.w && o.x + o.w > w.x;
    if (side === 'w') return Math.abs(o.x + o.w - w.x) < 1 && o.z < w.z + w.d && o.z + o.d > w.z;
    return Math.abs(o.x - (w.x + w.w)) < 1 && o.z < w.z + w.d && o.z + o.d > w.z;
  });
  s = { n: !touch('n'), s: !touch('s'), w: !touch('w'), e: !touch('e') };
  shores.set(w, s);
  return s;
}

// deep, shallow
function palette(w) {
  if (w.kind === 'river') return ['#24443c', '#46644a'];
  if (w.x > 12000) return ['#0b4c78', '#3cc9d2'];      // out of state: Miami's bay and the Atlantic
  if (w.kind === 'sea') return ['#0f3b5e', '#2b86a6'];
  if (w.kind === 'lake') return ['#173f52', '#2f7d84'];
  return ['#1d3b52', '#2f6f86'];
}

const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

export function drawWaterBodies(ctx, cam, map, t, { night = 0, low = false } = {}) {
  const v = cam.view(0), z = cam.zoom;
  const P = textures(ctx);
  const list = map.water;
  for (const w of list) {
    const ax = Math.max(w.x, v.x0), az = Math.max(w.z, v.z0), bx = Math.min(w.x + w.w, v.x1), bz = Math.min(w.z + w.d, v.z1);
    if (ax >= bx || az >= bz) continue;
    const [deep, shallow] = palette(w);
    const X = cam.sx(ax), Y = cam.sy(az), WW = (bx - ax) * z + 1, HH = (bz - az) * z + 1;
    ctx.fillStyle = deep; ctx.fillRect(X, Y, WW, HH);
    const sh = shoreOf(w, list);
    // shallows: a band of lighter water along each shore
    const band = Math.min(w.kind === 'river' ? 14 : 34, w.w / 3, w.d / 3);
    const edge = (x0, z0, x1, z1, gx0, gz0, gx1, gz1) => {
      const cx0 = Math.max(x0, v.x0), cz0 = Math.max(z0, v.z0), cx1 = Math.min(x1, v.x1), cz1 = Math.min(z1, v.z1);
      if (cx0 >= cx1 || cz0 >= cz1) return;
      const gr = ctx.createLinearGradient(cam.sx(gx0), cam.sy(gz0), cam.sx(gx1), cam.sy(gz1));
      gr.addColorStop(0, shallow); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(cam.sx(cx0), cam.sy(cz0), (cx1 - cx0) * z + 1, (cz1 - cz0) * z + 1);
    };
    ctx.globalAlpha = 0.85;
    if (sh.n) edge(w.x, w.z, w.x + w.w, w.z + band, 0, w.z, 0, w.z + band);
    if (sh.s) edge(w.x, w.z + w.d - band, w.x + w.w, w.z + w.d, 0, w.z + w.d, 0, w.z + w.d - band);
    if (sh.w) edge(w.x, w.z, w.x + band, w.z + w.d, w.x, 0, w.x + band, 0);
    if (sh.e) edge(w.x + w.w - band, w.z, w.x + w.w, w.z + w.d, w.x + w.w, 0, w.x + w.w - band, 0);
    ctx.globalAlpha = 1;

    // the waves: the swell rolls one way, the chop crosses it, and a second
    // copy of the swell at another angle breaks up the repeat
    const k = z / PPM, flow = w.kind === 'river' ? 1.6 : 1;
    const layer = (pat, vx, vz, alpha, scale = 1) => {
      const ox = ((t * vx * flow) % (MPT * scale) + MPT * scale) % (MPT * scale), oz = ((t * vz * flow) % (MPT * scale) + MPT * scale) % (MPT * scale);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cam.sx(ox), cam.sy(oz));
      ctx.scale(k * scale, k * scale);
      ctx.fillStyle = pat;
      ctx.fillRect((ax - ox) * PPM / scale, (az - oz) * PPM / scale, (bx - ax) * PPM / scale + 1, (bz - az) * PPM / scale + 1);
      ctx.restore();
    };
    const day = 1 - night * 0.6;
    layer(P.swell, 1.3, 0.55, 0.45 * day, 1);
    if (!low) {
      layer(P.chop, -0.9, 1.4, 0.25 * day, 0.6);
      layer(P.swell, -0.6, -1.1, 0.2 * day, 1.7);
    }

    // foam where the water meets the shore, lapping in and out
    const lw = Math.max(1, 0.55 * z);
    ctx.lineCap = 'round';
    for (let r = 0; r < 2; r++) {
      const off = 1.2 + r * 2.4 + Math.sin(t * 1.3 + r * 2) * 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${(r ? 0.22 : 0.5) * (0.75 + 0.25 * Math.sin(t * 2 + r))})`;
      ctx.lineWidth = lw * (r ? 0.8 : 1);
      ctx.setLineDash([3 * z, (1.5 + r * 2) * z]); ctx.lineDashOffset = -t * z * (r ? 1.5 : 2.5);
      ctx.beginPath();
      if (sh.n && w.z + off > v.z0 && w.z + off < v.z1) { ctx.moveTo(cam.sx(ax), cam.sy(w.z + off)); ctx.lineTo(cam.sx(bx), cam.sy(w.z + off)); }
      if (sh.s && w.z + w.d - off > v.z0 && w.z + w.d - off < v.z1) { ctx.moveTo(cam.sx(ax), cam.sy(w.z + w.d - off)); ctx.lineTo(cam.sx(bx), cam.sy(w.z + w.d - off)); }
      if (sh.w && w.x + off > v.x0 && w.x + off < v.x1) { ctx.moveTo(cam.sx(w.x + off), cam.sy(az)); ctx.lineTo(cam.sx(w.x + off), cam.sy(bz)); }
      if (sh.e && w.x + w.w - off > v.x0 && w.x + w.w - off < v.x1) { ctx.moveTo(cam.sx(w.x + w.w - off), cam.sy(az)); ctx.lineTo(cam.sx(w.x + w.w - off), cam.sy(bz)); }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // sun (or moon) glints flickering on the crests
    if (z > 2.2) {
      let cell = 7;
      while (((bx - ax) / cell) * ((bz - az) / cell) > 260) cell *= 1.6;
      ctx.fillStyle = night > 0.5 ? 'rgba(190,215,255,0.7)' : 'rgba(255,255,240,0.95)';
      const s = Math.max(1.5, 0.35 * z);
      for (let i = Math.floor(ax / cell); i <= Math.floor(bx / cell); i++) for (let j = Math.floor(az / cell); j <= Math.floor(bz / cell); j++) {
        const h = hash(i, j), b = Math.sin(t * (1.6 + h * 2.2) + h * 40);
        if (b < 0.9) continue;
        const x = (i + hash(j, i)) * cell, y = (j + h) * cell;
        if (x < ax || x > bx || y < az || y > bz) continue;
        const a = (b - 0.9) * 10, px = cam.sx(x), py = cam.sy(y);
        ctx.globalAlpha = a * (night > 0.5 ? 0.5 : 1);
        ctx.fillRect(px - s * 1.6, py - s * 0.25, s * 3.2, s * 0.5);
        ctx.fillRect(px - s * 0.25, py - s, s * 0.5, s * 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}
