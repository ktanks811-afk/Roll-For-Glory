// Kimari's top-down cow (2026-10-05): one photo-real Hereford, recoloured at
// load into the other breeds on the map. Head faces up in the art. Used for
// the cattle on your ranch (world2d/ranch.js), the sale barn pens and the
// pastures and Stockyards pens (world2d/render.js).
//
// Until the art is in (or with no DOM) drawCow returns false and the caller
// falls back to its own shapes.

const SRC = 'img/animals/cow-top.png';
const LEN = 3.2;           // metres, nose to tail tip (a touch big, so the hide reads at street zoom)
const variants = {};       // breed -> canvas
let img = null;

function build() {
  const w = img.naturalWidth, h = img.naturalHeight;
  const make = fn => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    if (fn) {
      const d = g.getImageData(0, 0, w, h), p = d.data;
      for (let i = 0; i < p.length; i += 4) if (p[i + 3]) fn(p, i);
      g.putImageData(d, 0, 0);
    }
    return c;
  };
  const lum = (p, i) => 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  variants.hereford = make(null);
  // Black Angus: the whole hide goes black, the shading stays as a sheen
  variants.black = make((p, i) => { const l = lum(p, i); const v = 22 + l * 0.3; p[i] = v; p[i + 1] = v * 0.94; p[i + 2] = v * 0.9; });
  // Charolais: cream all over
  variants.white = make((p, i) => { const l = lum(p, i); const v = 150 + l * 0.42; p[i] = Math.min(255, v + 6); p[i + 1] = Math.min(255, v); p[i + 2] = Math.min(255, v - 18); });
  // Longhorn: a lighter dun-and-red hide (the horns are drawn on top)
  variants.longhorn = make((p, i) => { const r = p[i], g = p[i + 1], b = p[i + 2]; p[i] = Math.min(255, r * 1.05 + 20); p[i + 1] = Math.min(255, g * 0.95 + 28); p[i + 2] = Math.min(255, b * 0.8 + 10); });
}

export function loadCowArt() {
  if (typeof document === 'undefined' || img) return;
  img = new Image();
  img.onload = () => { try { build(); } catch (e) { console.warn(e); } };
  img.src = SRC;
}

export const cowArtReady = () => !!variants.hereford;

// Which breed a cow drawn in this colour is.
export function breedOf(color, kind) {
  if (kind === 'longhorn') return 'longhorn';
  const n = parseInt((color || '#6a3a22').slice(1), 16);
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l < 40 ? 'black' : l > 170 ? 'white' : 'hereford';
}

// Draws a cow centred at (sx, sy) on screen, facing heading h (the car
// convention: 0 = up the screen). scale = metres → pixels. Returns false if
// the art isn't ready.
export function drawCow(ctx, sx, sy, h, scale, breed = 'hereford', opt = {}) {
  const c = variants[breed] || variants.hereford;
  if (!c) return false;
  const L = (opt.len || LEN) * scale, W = L * c.width / c.height;
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(h + (opt.sway || 0));
  // soft shadow down and to the right, like everything else on the map
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(0.3 * scale, 0.35 * scale - L * 0.06, W * 0.34, L * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // the body sits a little ahead of the image centre (the tail hangs off the back)
  ctx.drawImage(c, -W / 2, -L * 0.56, W, L);
  if (breed === 'longhorn') {
    ctx.strokeStyle = '#efe6cc'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, 0.1 * scale);
    const hy = -L * 0.47;
    ctx.beginPath(); ctx.moveTo(-0.95 * scale, hy - 0.22 * scale); ctx.quadraticCurveTo(0, hy + 0.12 * scale, 0.95 * scale, hy - 0.22 * scale); ctx.stroke();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = Math.max(1, 0.06 * scale);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.95 * scale, hy - 0.22 * scale); ctx.lineTo(s * 0.88 * scale, hy - 0.2 * scale); ctx.stroke(); }
  }
  ctx.restore();
  return true;
}
