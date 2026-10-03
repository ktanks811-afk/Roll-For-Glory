// Hand-drawn art for cars that have their own sprite sheet. The art is drawn
// white with the wheels left off, so any paint can be laid over the body
// panels while glass, trim, lights and badges keep their own colours, and the
// game's own wheels show through the empty arches.
//
// Images load once at boot (loadCarArt). Until they are in, or if they fail,
// the car falls back to the procedural drawing from data/carShapes.js.

export const CAR_ART = {
  dodge_charger_srt_hellcat_widebody_2020: {
    side: 'img/cars/hellcat-widebody-side.png',   // faces left, wheels off
    top: 'img/cars/hellcat-widebody-top.png',     // faces up
    wheels: [187, 895],                           // axle x in the side art (px)
    archY: 257,                                   // wheel-arch centre y in the side art (px)
  },
};

const ready = {};   // id -> { side, top } processed layers

export const hasArt = id => !!ready[id];
export const artOf = id => ready[id] || null;

const WHITE = 215;  // luminance of the art's body panels in full light

// Split an image into luminance + "how much of this pixel is body paint".
function analyse(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const n = c.width * c.height, px = d.data;
  const lum = new Float32Array(n), paint = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const l = 0.299 * r + 0.587 * gg + 0.114 * b;
    lum[i] = l;
    const sat = mx ? (mx - mn) / mx : 0;
    // light, colourless pixels are paint; glass, tyres-wells, trim and lights are not
    const bright = Math.min(1, Math.max(0, (l - 80) / 45));
    const grey = Math.min(1, Math.max(0, (0.16 - sat) / 0.08));
    paint[i] = bright * grey;
  }
  return { w: c.width, h: c.height, data: d, lum, paint, cache: new Map() };
}

const hexRgb = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const n = m ? parseInt(m[1], 16) : 0xf2f2f2; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const TINT_DARK = { none: 1, light: 0.85, medium: 0.68, limo: 0.45 };

// The art recoloured for a paint job: { full, fixed } canvases. `full` is the
// whole car; `fixed` is only the non-paint pixels (glass, trim, lights), drawn
// back on top after decals so stripes never cover the windows.
export function paintedArt(layer, v = {}) {
  const key = [v.paint, v.finish, v.tint].join('|');
  if (layer.cache.has(key)) return layer.cache.get(key);
  const base = hexRgb(v.paint), finish = v.finish || 'gloss';
  const bl = (0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2]) / 255;
  const dark = TINT_DARK[v.tint] ?? 1;
  const { w, h, lum, paint } = layer, src = layer.data.data;
  const full = new ImageData(w, h), fixed = new ImageData(w, h);
  const out = full.data, fx = fixed.data;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, a = src[o + 3];
    if (!a) continue;
    const wgt = paint[i];
    let r = src[o], g = src[o + 1], b = src[o + 2];
    if (wgt > 0) {
      let f = lum[i] / WHITE;
      if (finish === 'matte') f = 1 + (f - 1) * 0.55;
      const hi = Math.max(0, f - 1) * (finish === 'matte' ? 1 : finish === 'gloss' ? 3 : 4);
      const lift = (1 - bl) ** 2 * (lum[i] - 150) * 0.4;  // keeps shading on dark paint
      let pr, pg, pb;
      if (finish === 'chrome') {
        const t = Math.min(1, Math.max(0, (lum[i] - 120) / 120));
        const s = t < 0.5 ? 40 + t * 380 : 230 - (t - 0.5) * 60 + (t > 0.85 ? 60 : 0);
        pr = s * 0.7 + base[0] * 0.3; pg = s * 0.7 + base[1] * 0.3; pb = s * 0.7 + base[2] * 0.3;
      } else {
        const k = Math.min(f, 1);
        pr = base[0] * k + lift; pg = base[1] * k + lift; pb = base[2] * k + lift;
        pr += (255 - pr) * Math.min(1, hi); pg += (255 - pg) * Math.min(1, hi); pb += (255 - pb) * Math.min(1, hi);
        if (finish === 'pearl') { const sh = (i % w) / w; pr += 18 * (1 - sh) * wgt; pb += 18 * sh * wgt; }
        if (finish === 'metallic' && ((i * 2654435761) >>> 0) % 23 === 0) { pr += 40; pg += 40; pb += 40; }
      }
      r += (pr - r) * wgt; g += (pg - g) * wgt; b += (pb - b) * wgt;
    } else if (lum[i] < 70) {
      r *= dark; g *= dark; b *= dark;                     // window tint on the glass
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
    fx[o] = r; fx[o + 1] = g; fx[o + 2] = b; fx[o + 3] = a * (1 - wgt);
  }
  const mk = d => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(d, 0, 0); return c; };
  const res = { full: mk(full), fixed: mk(fixed), w, h };
  layer.cache.set(key, res);
  if (layer.cache.size > 40) layer.cache.delete(layer.cache.keys().next().value);
  return res;
}

function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('art ' + src)); im.src = src; });
}

// Load and prepare every car's art. Never throws; never waits more than `ms`.
export function loadCarArt(ms = 4000) {
  if (typeof document === 'undefined') return Promise.resolve();
  const jobs = Object.entries(CAR_ART).map(async ([id, a]) => {
    try {
      const [side, top] = await Promise.all([loadImg(a.side), loadImg(a.top)]);
      ready[id] = { meta: a, side: analyse(side), top: analyse(top) };
    } catch (e) { console.warn(e); }
  });
  return Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, ms))]);
}
