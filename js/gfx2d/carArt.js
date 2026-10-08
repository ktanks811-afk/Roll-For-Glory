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
  // Kimari's sheets, 2026-10-04. tireR = tyre radius in metres, sized to the arches.
  chevrolet_corvette_z06_c8_2023: {
    side: 'img/cars/corvette-z06-c8-side.png',
    top: 'img/cars/corvette-z06-c8-top.png',
    wheels: [213, 887],
    archY: 214,
    tireR: 0.35,
  },
  dodge_challenger_srt_hellcat_2015: {
    side: 'img/cars/challenger-hellcat-widebody-side.png',
    top: 'img/cars/challenger-hellcat-widebody-top.png',
    wheels: [203, 868],
    archY: 236,
    tireR: 0.389,
  },
  ford_mustang_shelby_gt500_2020: {
    side: 'img/cars/mustang-shelby-gt500-side.png',
    top: 'img/cars/mustang-shelby-gt500-top.png',
    wheels: [201, 877],
    archY: 239,
    tireR: 0.378,
  },
  infiniti_g35_coupe_2003: {
    side: 'img/cars/infiniti-g35-coupe-side.png',
    top: 'img/cars/infiniti-g35-coupe-top.png',
    wheels: [188, 896],
    archY: 248,
    tireR: 0.347,
  },
  ram_1500_trx_2021: {
    side: 'img/cars/ram-trx-side.png',
    top: 'img/cars/ram-trx-top.png',
    wheels: [177, 887],
    archY: 270,
    tireR: 0.472,
  },
  chevrolet_camaro_zl1_2017: {
    side: 'img/cars/camaro-zl1-side.png',
    top: 'img/cars/camaro-zl1-top.png',
    wheels: [204, 862],
    archY: 240,
    tireR: 0.374,
  },
  ford_f_150_xlt_5_0_2015: {
    side: 'img/cars/f150-regular-cab-side.png',
    top: 'img/cars/f150-regular-cab-top.png',
    wheels: [201, 874],
    archY: 283,
    tireR: 0.42,
  },
  // Kimari's 18-wheeler sheet, 2026-10-05: a long-hood sleeper tractor. Three
  // axles (steer + tandem drive), so `wheels` has three entries. `chrome` lists
  // art rectangles [x0, y0, x1, y1] (px) that keep their own colour when the
  // body is painted: the stacks, air cleaners, fuel tank and step boxes.
  peterbilt_389_sleeper_2022: {
    side: 'img/cars/peterbilt-389-side.png',
    top: 'img/cars/peterbilt-389-top.png',
    wheels: [101, 795, 980],
    archY: 309,
    tireR: 0.52,
    stacks: true,
    chrome: { side: [[316, 0, 348, 272], [238, 146, 294, 250], [428, 258, 624, 344], [298, 258, 408, 344], [618, 250, 692, 344]], top: [[0, 228, 84, 304], [236, 228, 319, 304]] },
  },
  audi_rs3_2022: {
    side: 'img/cars/audi-rs3-side.png',
    top: 'img/cars/audi-rs3-top.png',
    wheels: [204, 868],
    archY: 258,
    tireR: 0.357,
  },
  cadillac_ct5_v_blackwing_2022: {
    side: 'img/cars/cadillac-ct5-v-blackwing-side.webp',
    top: 'img/cars/cadillac-ct5-v-blackwing-top.webp',
    wheels: [102, 307],
    archY: 78,
    tireR: 0.365,
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

// Parts of the art that never take paint (chrome, tanks), as rectangles in art px.
function keepChrome(layer, rects) {
  for (const [x0, y0, x1, y1] of rects || []) {
    for (let y = Math.max(0, y0); y < Math.min(layer.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(layer.w, x1); x++) layer.paint[y * layer.w + x] = 0;
  }
  return layer;
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
      ready[id] = { meta: a, side: keepChrome(analyse(side), a.chrome?.side), top: keepChrome(analyse(top), a.chrome?.top) };
    } catch (e) { console.warn(e); }
  });
  return Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, ms))]);
}
