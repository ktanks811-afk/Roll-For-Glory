// Top-down people: shoulders, arms swinging, head and hair/hat.

import { CLOTH_BY_ID } from '../data/shops.js';
import { drawHairPortrait, drawFace, drawExtras, drawHairTop, shade } from './hair.js';
import { sun, shadowFill } from './sun.js';
import { hasTat } from '../data/looks.js';
import { drawArmInk, drawTorsoInk, drawHeadInk, drawLogo, monogram } from './ink.js';

const col = (v, fallback) => (CLOTH_BY_ID[v]?.color) || (typeof v === 'string' && v.startsWith('#') ? v : fallback);

export function drawPerson(ctx, x, y, h, zoom, look = {}, walk = 0, isPlayer = false) {
  const s = zoom;
  const top = col(look.top, '#222');
  const hat = CLOTH_BY_ID[look.hat];
  const mask = CLOTH_BY_ID[look.mask];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(h);
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,40,60,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 0.9 * s, 0, Math.PI * 2); ctx.stroke();
  }
  // shadow along the sun (gfx2d/sun.js), stretched the way it falls
  ctx.save(); ctx.rotate(-h);
  ctx.fillStyle = shadowFill(1.2);
  ctx.beginPath(); ctx.ellipse(sun.dx * 0.9 * s, sun.dz * 0.9 * s, 0.3 * s + Math.hypot(sun.dx, sun.dz) * 0.8 * s, 0.24 * s, Math.atan2(sun.dz, sun.dx), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // legs / feet
  const sw = Math.sin(walk) * 0.22 * s;
  ctx.fillStyle = col(look.shoes, '#e8e8e8');
  ctx.fillRect(-0.16 * s, -0.08 * s - sw, 0.12 * s, 0.18 * s);
  ctx.fillRect(0.04 * s, -0.08 * s + sw, 0.12 * s, 0.18 * s);
  // arms: bare in a wife beater, half sleeves in a tee, ink over the skin
  const ts = CLOTH_BY_ID[look.top]?.style;
  const bare = ts === 'tank' ? 1 : ts === 'tee' || ts === 'crop' ? 0.5 : 0;
  for (const [ax, ay, r] of [[-0.36, -0.08 + sw * 0.8 / s, 0], [0.26, -0.08 - sw * 0.8 / s, 1]]) {
    ctx.fillStyle = top; ctx.fillRect(ax * s, ay * s, 0.1 * s, 0.24 * s);
    if (bare) {
      ctx.fillStyle = look.skin || '#c68e65'; ctx.fillRect(ax * s, (ay + 0.24 * (1 - bare)) * s, 0.1 * s, 0.24 * bare * s);
      if (hasTat(look, r ? 'sleeve_r' : 'sleeve_l') || (bare === 1 && hasTat(look, r ? 'half_r' : 'half_l'))) { ctx.fillStyle = 'rgba(16,20,36,0.55)'; ctx.fillRect(ax * s, (ay + 0.24 * (1 - bare)) * s, 0.1 * s, 0.24 * bare * s); }
    }
  }
  // torso
  ctx.fillStyle = top;
  if (ts === 'tank') { ctx.beginPath(); ctx.ellipse(0, 0, 0.3 * s, 0.17 * s, 0, 0, Math.PI * 2); ctx.fillStyle = look.skin || '#c68e65'; ctx.fill(); ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(0, 0, 0.2 * s, 0.16 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.ellipse(0, 0, 0.3 * s, 0.17 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  // head
  ctx.fillStyle = mask?.style === 'skimask' ? mask.color : look.skin || '#c68e65';
  ctx.beginPath(); ctx.arc(0, 0, 0.12 * s, 0, Math.PI * 2); ctx.fill();
  if (mask?.style === 'bandana') { ctx.fillStyle = mask.color; ctx.beginPath(); ctx.arc(0, 0, 0.12 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.fill(); }
  if (mask?.style === 'skimask' && !(hat && hat.style !== 'none')) {
    // knit top of the mask instead of hair
    ctx.fillStyle = mask.color;
    ctx.beginPath(); ctx.arc(0, 0.02 * s, 0.125 * s, 0, Math.PI * 2); ctx.fill();
  } else if (hat && hat.style !== 'none') {
    ctx.fillStyle = hat.color;
    ctx.beginPath(); ctx.arc(0, 0.01 * s, 0.13 * s, 0, Math.PI * 2); ctx.fill();
    if (hat.style === 'cap') ctx.fillRect(-0.09 * s, -0.22 * s, 0.18 * s, 0.1 * s);
  } else {
    drawHairTop(ctx, s, look);
  }
  ctx.restore();
}

// Front-facing portrait for character creation and the phone.
export function drawPortrait(ctx, w, h, look) {
  const top = col(look.top, '#222'), bottom = col(look.bottom, '#2c3e66');
  const hat = CLOTH_BY_ID[look.hat];
  const cx = w / 2;
  const k = h / 300;
  ctx.clearRect(0, 0, w, h);
  const mask = CLOTH_BY_ID[look.mask];
  const hatOn = !!(hat && hat.style !== 'none'), skimask = mask?.style === 'skimask';
  // hair that hangs behind the head and shoulders
  if (!skimask) drawHairPortrait(ctx, cx, k, look, 'back', hatOn);
  // body: skin first (with any ink on it), then the clothes over it, so a
  // wife beater or a tee shows exactly the skin it would
  const topC = CLOTH_BY_ID[look.top], style = topC?.style, skin = look.skin;
  const wide = 1 + (look.build ?? 1) * 0.08;
  const lx = cx - 74 * k * wide, rx = cx + 56 * k * wide, aw = 18 * k;
  ctx.fillStyle = bottom;
  ctx.fillRect(cx - 34 * k, 190 * k, 30 * k, 88 * k);
  ctx.fillRect(cx + 4 * k, 190 * k, 30 * k, 88 * k);
  drawShoes(ctx, cx, k, CLOTH_BY_ID[look.shoes] || CLOTH_BY_ID.kicks_white);
  const torso = () => { ctx.beginPath(); ctx.moveTo(cx - 58 * k * wide, 110 * k); ctx.lineTo(cx + 58 * k * wide, 110 * k); ctx.lineTo(cx + 44 * k, 200 * k); ctx.lineTo(cx - 44 * k, 200 * k); ctx.closePath(); };
  ctx.fillStyle = skin; torso(); ctx.fill();
  ctx.fillRect(lx, 112 * k, aw, 102 * k); ctx.fillRect(rx, 112 * k, aw, 102 * k);
  ctx.save(); torso(); ctx.clip(); drawTorsoInk(ctx, cx, k, look); ctx.restore();
  drawArmInk(ctx, k, look, -1, lx, aw); drawArmInk(ctx, k, look, 1, rx, aw);
  ctx.fillStyle = top;
  if (style === 'tank') {
    // straps over the shoulders, a scoop neck and deep arm holes
    ctx.beginPath();
    ctx.moveTo(cx - 32 * k, 110 * k); ctx.lineTo(cx - 20 * k, 110 * k); ctx.quadraticCurveTo(cx, 146 * k, cx + 20 * k, 110 * k); ctx.lineTo(cx + 32 * k, 110 * k);
    ctx.quadraticCurveTo(cx + 34 * k, 140 * k, cx + 50 * k * wide, 150 * k); ctx.lineTo(cx + 44 * k, 200 * k); ctx.lineTo(cx - 44 * k, 200 * k); ctx.lineTo(cx - 50 * k * wide, 150 * k);
    ctx.quadraticCurveTo(cx - 34 * k, 140 * k, cx - 32 * k, 110 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(top, parseInt(top.slice(1, 3), 16) > 136 ? -0.12 : 0.12); ctx.lineWidth = 0.8 * k;
    for (let x = -40; x <= 40; x += 4) { ctx.beginPath(); ctx.moveTo(cx + x * k, (Math.abs(x) < 20 ? 146 - Math.abs(x) * 1.4 : 150) * k); ctx.lineTo(cx + x * 0.95 * k, 198 * k); ctx.stroke(); }
  } else {
    torso(); ctx.fill();
    const sleeve = style === 'tee' || style === 'crop' ? 46 : 92;
    ctx.fillRect(lx, 112 * k, aw, sleeve * k); ctx.fillRect(rx, 112 * k, aw, sleeve * k);
  }
  if (topC?.brand === 'maison') monogram(ctx, cx - 44 * k, 118 * k, 88 * k, 80 * k, top);
  if (style === 'hoodie') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 6 * k, 118 * k); ctx.lineTo(cx - 8 * k, 150 * k); ctx.moveTo(cx + 6 * k, 118 * k); ctx.lineTo(cx + 8 * k, 150 * k); ctx.stroke(); }
  if (style === 'jacket') { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - 1, 112 * k, 2, 88 * k); }
  if (topC?.brand) {
    // big chest logo on hoodies and tees, a small one on the left chest of a jacket or tank
    const big = style === 'hoodie' || style === 'tee';
    drawLogo(ctx, topC.brand, big ? cx : cx + 22 * k, big ? 160 * k : 162 * k, (big ? 11 : 6) * k, top);
  }
  // neck + head
  ctx.fillStyle = look.skin;
  ctx.fillRect(cx - 10 * k, 92 * k, 20 * k, 22 * k);
  ctx.beginPath(); ctx.ellipse(cx, 66 * k, 30 * k, 36 * k, 0, 0, Math.PI * 2); ctx.fill();
  if (!(mask?.style === 'skimask')) drawHeadInk(ctx, cx, k, look);
  // face
  drawFace(ctx, cx, k, look);
  // mask: a ski mask covers the whole head (eye and mouth holes), a bandana the lower face
  if (mask?.style === 'skimask') {
    ctx.fillStyle = mask.color;
    ctx.beginPath(); ctx.ellipse(cx, 64 * k, 32 * k, 39 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 12 * k, 92 * k, 24 * k, 22 * k);
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.ellipse(cx, 64 * k, 22 * k, 7 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, 85 * k, 8 * k, 4 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 14 * k, 62 * k, 6 * k, 5 * k); ctx.fillRect(cx + 8 * k, 62 * k, 6 * k, 5 * k);
  } else if (mask?.style === 'bandana') {
    ctx.fillStyle = mask.color;
    ctx.beginPath(); ctx.moveTo(cx - 31 * k, 72 * k); ctx.lineTo(cx + 31 * k, 72 * k); ctx.lineTo(cx + 22 * k, 98 * k); ctx.lineTo(cx, 108 * k); ctx.lineTo(cx - 22 * k, 98 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx - 10 * k, 86 * k, 3 * k, 0, Math.PI * 2); ctx.arc(cx + 10 * k, 86 * k, 3 * k, 0, Math.PI * 2); ctx.stroke();
  }
  // hair, hat, extras
  if (!skimask) drawHairPortrait(ctx, cx, k, look, 'front', hatOn);
  if (hatOn) {
    ctx.fillStyle = hat.color;
    ctx.beginPath(); ctx.ellipse(cx, 42 * k, 33 * k, 20 * k, 0, Math.PI, 0); ctx.fill();
    if (hat.style === 'cap') ctx.fillRect(cx - 34 * k, 40 * k, 58 * k, 7 * k);
    else ctx.fillRect(cx - 33 * k, 38 * k, 66 * k, 9 * k);
  }
  drawExtras(ctx, cx, k, look, { hatOn, masked: skimask, topColor: top });
}

// shoes under the pant legs, with the brand on the outside of each one
function drawShoes(ctx, cx, k, shoe) {
  const c = shoe.color, boots = shoe.style === 'boots';
  for (const sd of [-1, 1]) {
    const x0 = sd < 0 ? cx - 38 * k : cx + 2 * k, w = 36 * k;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.roundRect(x0, (boots ? 266 : 274) * k, w, (boots ? 26 : 18) * k, [3 * k, 3 * k, 2 * k, 2 * k]); ctx.fill();
    // sole: white on kicks, dark on boots; Royale soles are red
    ctx.fillStyle = shoe.brand === 'royale' ? '#c41b1b' : boots ? '#1a120c' : '#f2f2f2';
    ctx.fillRect(x0, 288 * k, w, 4 * k);
    if (shoe.brand) drawLogo(ctx, shoe.brand, x0 + (sd < 0 ? 10 : 26) * k, 281 * k, 4.5 * k, c);
  }
}
