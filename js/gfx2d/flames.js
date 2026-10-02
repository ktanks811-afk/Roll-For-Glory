// Flames out of the exhaust tips. Drawn in metres: the caller translates to
// the car's centre, rotates to its heading (0 = facing up) and scales to
// pixels-per-metre, so the jets always point out the back of the car.

import { DIMS } from './carSprite.js';

// Same tip layout as the car sprite, so flames come out of the real tips.
export function exhaustTipX(visual, width) {
  const tips = { single: [-0.55], dual: [-0.6, 0.6], quad: [-0.68, -0.52, 0.52, 0.68], cannon: [-0.38, 0.38] }[visual?.exhaustTips || 'single'];
  return tips.map(x => x * (width / 2) / 0.9);
}

export function drawFlameJets(ctx, bodyStyle, visual, intensity) {
  if (intensity < 0.04) return;
  const d = DIMS[bodyStyle] || DIMS.sedan;
  const y0 = d.L / 2 + 0.06;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const x of exhaustTipX(visual, d.W)) {
    const len = (1.2 + 2.8 * intensity) * (0.75 + Math.random() * 0.5);
    const w = 0.2 + 0.14 * intensity;
    const sway = (Math.random() - 0.5) * 0.35;
    // glow on the ground
    const glow = ctx.createRadialGradient(x, y0 + len * 0.25, 0, x, y0 + len * 0.25, 1 + intensity * 1.2);
    glow.addColorStop(0, `rgba(255,150,40,${0.55 * Math.min(1, intensity)})`); glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y0 + len * 0.25, 1 + intensity * 1.2, 0, Math.PI * 2); ctx.fill();
    // outer flame: orange → red, fading out
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, 'rgba(255,255,230,0.95)'); g.addColorStop(0.2, 'rgba(255,205,70,0.9)');
    g.addColorStop(0.55, 'rgba(255,100,20,0.6)'); g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y0);
    ctx.quadraticCurveTo(x - w * 0.9 + sway * 0.4, y0 + len * 0.5, x + sway, y0 + len);
    ctx.quadraticCurveTo(x + w * 0.9 + sway * 0.4, y0 + len * 0.5, x + w / 2, y0);
    ctx.closePath(); ctx.fill();
    // blue-white core, shorter
    const c = ctx.createLinearGradient(0, y0, 0, y0 + len * 0.45);
    c.addColorStop(0, 'rgba(210,230,255,0.95)'); c.addColorStop(1, 'rgba(90,140,255,0)');
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.22, y0);
    ctx.quadraticCurveTo(x - w * 0.3, y0 + len * 0.2, x + sway * 0.3, y0 + len * 0.45);
    ctx.quadraticCurveTo(x + w * 0.3, y0 + len * 0.2, x + w * 0.22, y0);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
