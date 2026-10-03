// Top-down people: shoulders, arms swinging, head and hair/hat.

import { CLOTH_BY_ID } from '../data/shops.js';

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
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0.12 * s, 0.15 * s, 0.32 * s, 0.22 * s, 0, 0, Math.PI * 2); ctx.fill();
  // legs / feet
  const sw = Math.sin(walk) * 0.22 * s;
  ctx.fillStyle = col(look.shoes, '#e8e8e8');
  ctx.fillRect(-0.16 * s, -0.08 * s - sw, 0.12 * s, 0.18 * s);
  ctx.fillRect(0.04 * s, -0.08 * s + sw, 0.12 * s, 0.18 * s);
  // arms
  ctx.fillStyle = top;
  ctx.fillRect(-0.36 * s, -0.08 * s + sw * 0.8, 0.1 * s, 0.24 * s);
  ctx.fillRect(0.26 * s, -0.08 * s - sw * 0.8, 0.1 * s, 0.24 * s);
  // torso
  ctx.beginPath(); ctx.ellipse(0, 0, 0.3 * s, 0.17 * s, 0, 0, Math.PI * 2); ctx.fill();
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
    ctx.fillStyle = look.hair || '#222';
    ctx.beginPath(); ctx.arc(0, 0.03 * s, 0.11 * s, 0, Math.PI * 2); ctx.fill();
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
  // body
  ctx.fillStyle = bottom;
  ctx.fillRect(cx - 34 * k, 190 * k, 30 * k, 100 * k);
  ctx.fillRect(cx + 4 * k, 190 * k, 30 * k, 100 * k);
  ctx.fillStyle = top;
  const wide = 1 + (look.build ?? 1) * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx - 58 * k * wide, 110 * k); ctx.lineTo(cx + 58 * k * wide, 110 * k);
  ctx.lineTo(cx + 44 * k, 200 * k); ctx.lineTo(cx - 44 * k, 200 * k); ctx.closePath(); ctx.fill();
  ctx.fillRect(cx - 74 * k * wide, 112 * k, 18 * k, 92 * k);
  ctx.fillRect(cx + 56 * k * wide, 112 * k, 18 * k, 92 * k);
  const style = CLOTH_BY_ID[look.top]?.style;
  if (style === 'hoodie') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 6 * k, 118 * k); ctx.lineTo(cx - 8 * k, 150 * k); ctx.moveTo(cx + 6 * k, 118 * k); ctx.lineTo(cx + 8 * k, 150 * k); ctx.stroke(); }
  if (style === 'jacket') { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - 1, 112 * k, 2, 88 * k); }
  // neck + head
  ctx.fillStyle = look.skin;
  ctx.fillRect(cx - 10 * k, 92 * k, 20 * k, 22 * k);
  ctx.beginPath(); ctx.ellipse(cx, 66 * k, 30 * k, 36 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - 74 * k * wide, 200 * k, 18 * k, 14 * k);
  ctx.fillRect(cx + 56 * k * wide, 200 * k, 18 * k, 14 * k);
  // face
  ctx.fillStyle = '#111';
  ctx.fillRect(cx - 14 * k, 62 * k, 6 * k, 5 * k); ctx.fillRect(cx + 8 * k, 62 * k, 6 * k, 5 * k);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(cx - 8 * k, 84 * k, 16 * k, 3 * k);
  // mask: a ski mask covers the whole head (eye and mouth holes), a bandana the lower face
  const mask = CLOTH_BY_ID[look.mask];
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
  // hair
  ctx.fillStyle = look.hair;
  const hs = look.hairStyle;
  if (mask?.style === 'skimask' && (!hat || hat.style === 'none')) { /* the mask covers the hair */ }
  else if (!hat || hat.style === 'none') {
    if (hs === 'buzz') { ctx.beginPath(); ctx.ellipse(cx, 44 * k, 29 * k, 14 * k, 0, Math.PI, 0); ctx.fill(); }
    else if (hs === 'curly') { for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx + i * 10 * k, 36 * k + Math.abs(i) * 3 * k, 12 * k, 0, Math.PI * 2); ctx.fill(); } }
    else { ctx.beginPath(); ctx.ellipse(cx, 42 * k, 32 * k, 18 * k, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - 32 * k, 42 * k, 8 * k, hs === 'long' ? 60 * k : 16 * k); ctx.fillRect(cx + 24 * k, 42 * k, 8 * k, hs === 'long' ? 60 * k : 16 * k); }
    if (hs === 'bun') { ctx.beginPath(); ctx.arc(cx, 20 * k, 12 * k, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.fillStyle = hat.color;
    ctx.beginPath(); ctx.ellipse(cx, 42 * k, 33 * k, 20 * k, 0, Math.PI, 0); ctx.fill();
    if (hat.style === 'cap') ctx.fillRect(cx - 34 * k, 40 * k, 58 * k, 7 * k);
    else ctx.fillRect(cx - 33 * k, 38 * k, 66 * k, 9 * k);
  }
}
