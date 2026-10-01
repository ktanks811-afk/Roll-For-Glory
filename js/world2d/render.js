// Draws Port Solace top-down: ground, roads, lots, buildings (with a
// parallax lean so they read as 3D), trees, night lighting and weather.

import { HWY_Z, HWY_W, DESERT_Z, TUNNEL, RIVER_X, SEA_X, ROAD_W, LOCATIONS } from '../data/world.js';
import { BACKROAD } from './map.js';

export class Camera {
  constructor() { this.x = 0; this.z = 0; this.zoom = 6; this.w = 1; this.h = 1; this.shake = 0; }
  sx(x) { return (x - this.x) * this.zoom + this.w / 2; }
  sy(z) { return (z - this.z) * this.zoom + this.h / 2; }
  view(pad = 40) {
    const hw = this.w / 2 / this.zoom + pad, hh = this.h / 2 / this.zoom + pad;
    return { x0: this.x - hw, z0: this.z - hh, x1: this.x + hw, z1: this.z + hh };
  }
}

const COLORS = {
  grass: '#2f3a26', city: '#5d5f63', sand: '#c2a172', asphalt: '#2c2d31', asphaltHwy: '#26272b', line: '#e9e9e2',
  yellow: '#e8c21a', water: '#1d3b52', river: '#244861', park: '#3c5a30', yard: '#4a6338', parking: '#323338', gas: '#77797e',
};

export function buildStreetLights(map) {
  const out = [];
  for (const e of map.roads.edges) {
    if (e.kind === 'desert') continue;
    const step = e.kind === 'highway' ? 70 : 45;
    for (let s = 12; s < e.len - 12; s += step) {
      const side = (Math.floor(s / step) % 2) ? 1 : -1;
      const off = e.width / 2 + 2;
      out.push({ x: e.ax + e.dx * s - e.dz * off * side, z: e.az + e.dz * s + e.dx * off * side, r: e.kind === 'highway' ? 26 : 20 });
    }
  }
  for (const l of LOCATIONS) out.push({ x: l.x, z: l.z, r: 16, color: l.color });
  return out;
}

export function drawGround(ctx, cam) {
  const v = cam.view(0);
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, cam.w, cam.h);
  const rect = (x0, z0, x1, z1, col) => {
    const ax = Math.max(x0, v.x0), az = Math.max(z0, v.z0), bx = Math.min(x1, v.x1), bz = Math.min(z1, v.z1);
    if (ax >= bx || az >= bz) return;
    ctx.fillStyle = col;
    ctx.fillRect(cam.sx(ax), cam.sy(az), (bx - ax) * cam.zoom + 1, (bz - az) * cam.zoom + 1);
  };
  rect(-4000, DESERT_Z, 4000, 4000, COLORS.sand);
  rect(-3300, -1000, -1000, DESERT_Z, '#34402a');
  rect(-985, -985, 985, 985, COLORS.city);
}

export function drawWater(ctx, cam, map, t) {
  for (const w of map.water) {
    const v = cam.view(0);
    const ax = Math.max(w.x, v.x0), az = Math.max(w.z, v.z0), bx = Math.min(w.x + w.w, v.x1), bz = Math.min(w.z + w.d, v.z1);
    if (ax >= bx || az >= bz) continue;
    ctx.fillStyle = w.kind === 'river' ? COLORS.river : COLORS.water;
    ctx.fillRect(cam.sx(ax), cam.sy(az), (bx - ax) * cam.zoom + 1, (bz - az) * cam.zoom + 1);
    // ripples
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    const step = 22;
    for (let z = Math.floor(az / step) * step; z < bz; z += step) {
      ctx.beginPath();
      const off = Math.sin(t * 0.6 + z) * 6;
      ctx.moveTo(cam.sx(ax), cam.sy(z + off * 0.2));
      ctx.lineTo(cam.sx(bx), cam.sy(z + off * 0.2));
      ctx.stroke();
    }
  }
  // hills: soft darker mounds
  for (const h of map.hills) {
    if (h.x + h.r < cam.view().x0 || h.x - h.r > cam.view().x1 || h.z + h.r < cam.view().z0 || h.z - h.r > cam.view().z1) continue;
    const g = ctx.createRadialGradient(cam.sx(h.x), cam.sy(h.z), 0, cam.sx(h.x), cam.sy(h.z), h.r * cam.zoom);
    g.addColorStop(0, 'rgba(90,96,80,0.85)'); g.addColorStop(0.5, 'rgba(60,72,50,0.55)'); g.addColorStop(1, 'rgba(47,58,38,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cam.sx(h.x), cam.sy(h.z), h.r * cam.zoom, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawLots(ctx, cam, items) {
  const z = cam.zoom;
  for (const it of items) {
    if (it.type !== 'l') continue;
    const l = it.o;
    const x = cam.sx(l.x), y = cam.sy(l.z), w = l.w * z, h = l.d * z;
    ctx.fillStyle = COLORS[l.kind] || '#444';
    if (l.kind === 'strip') ctx.fillStyle = '#4b4c50';
    ctx.fillRect(x, y, w, h);
    if (l.kind === 'parking' && z > 1.5) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, z * 0.12);
      for (let sx = 3; sx < l.w - 2; sx += 3) {
        ctx.beginPath(); ctx.moveTo(x + sx * z, y + 1 * z); ctx.lineTo(x + sx * z, y + 6 * z); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + sx * z, y + h - 6 * z); ctx.lineTo(x + sx * z, y + h - 1 * z); ctx.stroke();
      }
    }
    if (l.kind === 'strip') {
      ctx.fillStyle = '#3a3b3f'; ctx.fillRect(x + w * 0.1, y, w * 0.35, h); ctx.fillRect(x + w * 0.55, y, w * 0.35, h);
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y + h - 30 * z, w, 0.6 * z);
      ctx.fillStyle = '#e8c21a'; ctx.fillRect(x + w / 2 - 0.3 * z, y, 0.6 * z, h);
    }
    if (l.kind === 'park' && z > 1) {
      ctx.strokeStyle = 'rgba(200,190,160,0.35)'; ctx.lineWidth = 2 * z;
      ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    }
  }
}

export function drawRoads(ctx, cam, map, signalT) {
  const v = cam.view(20);
  const z = cam.zoom;
  // asphalt
  for (const e of map.roads.edges) {
    const minx = Math.min(e.ax, e.bx) - e.width / 2, maxx = Math.max(e.ax, e.bx) + e.width / 2;
    const minz = Math.min(e.az, e.bz) - e.width / 2, maxz = Math.max(e.az, e.bz) + e.width / 2;
    if (maxx < v.x0 || minx > v.x1 || maxz < v.z0 || minz > v.z1) continue;
    ctx.fillStyle = e.kind === 'highway' ? COLORS.asphaltHwy : COLORS.asphalt;
    ctx.fillRect(cam.sx(minx), cam.sy(minz), (maxx - minx) * z, (maxz - minz) * z);
    if (z < 0.9) continue;
    // markings
    const horiz = Math.abs(e.dx) > 0.5;
    const dash = (off, col, w = 0.15, gap = true) => {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, w * z);
      ctx.setLineDash(gap ? [3 * z, 6 * z] : []);
      ctx.beginPath();
      if (horiz) { ctx.moveTo(cam.sx(minx), cam.sy(e.az + off)); ctx.lineTo(cam.sx(maxx), cam.sy(e.az + off)); }
      else { ctx.moveTo(cam.sx(e.ax + off), cam.sy(minz)); ctx.lineTo(cam.sx(e.ax + off), cam.sy(maxz)); }
      ctx.stroke();
    };
    if (e.kind === 'city') {
      dash(-0.2, COLORS.yellow, 0.14, false); dash(0.2, COLORS.yellow, 0.14, false);
      dash(-4, 'rgba(233,233,226,0.8)'); dash(4, 'rgba(233,233,226,0.8)');
    } else if (e.kind === 'highway') {
      ctx.fillStyle = '#8a8b8f';
      if (horiz) ctx.fillRect(cam.sx(minx), cam.sy(e.az - 0.6), (maxx - minx) * z, 1.2 * z);
      for (const o of [5.6, 9.6]) { dash(o, 'rgba(233,233,226,0.8)'); dash(-o, 'rgba(233,233,226,0.8)'); }
      dash(1.4, COLORS.yellow, 0.14, false); dash(-1.4, COLORS.yellow, 0.14, false);
      dash(13.8, 'rgba(233,233,226,0.9)', 0.15, false); dash(-13.8, 'rgba(233,233,226,0.9)', 0.15, false);
    } else if (e.kind === 'desert') {
      dash(0, COLORS.yellow, 0.14);
    }
    ctx.setLineDash([]);
  }
  // intersections (cover markings) + crosswalks + signals
  for (const n of map.roads.nodes) {
    if (n.x < v.x0 || n.x > v.x1 || n.z < v.z0 || n.z > v.z1) continue;
    const city = n.edges.every(id => map.roads.edges[id].kind === 'city');
    const hw = n.edges.some(id => map.roads.edges[id].kind === 'highway') ? HWY_W / 2 : ROAD_W / 2;
    ctx.fillStyle = hw > ROAD_W / 2 ? COLORS.asphaltHwy : COLORS.asphalt;
    ctx.fillRect(cam.sx(n.x - hw), cam.sy(n.z - hw), hw * 2 * z, hw * 2 * z);
    if (!city || z < 1.6) continue;
    ctx.fillStyle = 'rgba(233,233,226,0.75)';
    for (let k = -3; k <= 3; k++) {
      ctx.fillRect(cam.sx(n.x + k * 2 - 0.5), cam.sy(n.z - hw - 3), 1 * z, 2.5 * z);
      ctx.fillRect(cam.sx(n.x + k * 2 - 0.5), cam.sy(n.z + hw + 0.5), 1 * z, 2.5 * z);
      ctx.fillRect(cam.sx(n.x - hw - 3), cam.sy(n.z + k * 2 - 0.5), 2.5 * z, 1 * z);
      ctx.fillRect(cam.sx(n.x + hw + 0.5), cam.sy(n.z + k * 2 - 0.5), 2.5 * z, 1 * z);
    }
    if (n.edges.length >= 3) {
      const ns = signalState(n, signalT);
      const r = Math.max(2, 0.6 * z);
      for (const [dx, dz, axis] of [[-1, -1, 'ns'], [1, 1, 'ns'], [1, -1, 'ew'], [-1, 1, 'ew']]) {
        const green = (axis === 'ns') === ns.nsGreen;
        ctx.fillStyle = ns.yellow ? '#ffb000' : green ? '#2bd94a' : '#ff2a2a';
        ctx.beginPath(); ctx.arc(cam.sx(n.x + dx * (hw + 1)), cam.sy(n.z + dz * (hw + 1)), r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Northridge Pass
  ctx.strokeStyle = COLORS.asphalt; ctx.lineWidth = 9 * z; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); BACKROAD.forEach(([x, zz], i) => i ? ctx.lineTo(cam.sx(x), cam.sy(zz)) : ctx.moveTo(cam.sx(x), cam.sy(zz))); ctx.stroke();
  ctx.strokeStyle = COLORS.yellow; ctx.lineWidth = Math.max(1, 0.15 * z); ctx.setLineDash([3 * z, 6 * z]); ctx.stroke(); ctx.setLineDash([]);
  // river bridge rails
  if (Math.abs(RIVER_X - cam.x) < 600 && Math.abs(HWY_Z - cam.z) < 600) {
    ctx.fillStyle = '#9a9ba0';
    ctx.fillRect(cam.sx(RIVER_X - 50), cam.sy(HWY_Z - HWY_W / 2 - 1.5), 100 * z, 1 * z);
    ctx.fillRect(cam.sx(RIVER_X - 50), cam.sy(HWY_Z + HWY_W / 2 + 0.5), 100 * z, 1 * z);
  }
}

// Each intersection cycles N-S green / E-W green with a short yellow.
export function signalState(node, t) {
  const cycle = 34;
  const ph = (t + (node.id * 7.3) % cycle) % cycle;
  return { nsGreen: ph < 17, yellow: (ph > 14 && ph < 17) || ph > 31 };
}

export function drawSkids(ctx, cam, skids) {
  ctx.strokeStyle = 'rgba(10,10,10,0.45)';
  ctx.lineCap = 'round';
  for (const s of skids) {
    ctx.lineWidth = Math.max(1, 0.25 * cam.zoom);
    ctx.beginPath(); ctx.moveTo(cam.sx(s[0]), cam.sy(s[1])); ctx.lineTo(cam.sx(s[2]), cam.sy(s[3])); ctx.stroke();
  }
}

// Buildings lean away from the screen centre in proportion to height.
export function drawBuildings(ctx, cam, items, night, showLabels = true) {
  const z = cam.zoom;
  const list = [];
  for (const it of items) if (it.type === 'b' || it.type === 'r') list.push(it.o);
  list.sort((a, b) => a.h - b.h);
  const k = 0.0011;   // 1 / camera height (m): how far roofs lean
  for (const b of list) {
    const x0 = cam.sx(b.x), y0 = cam.sy(b.z), w = b.w * z, d = b.d * z;
    const cx = x0 + w / 2 - cam.w / 2, cy = y0 + d / 2 - cam.h / 2;
    const ox = cx * b.h * k, oy = cy * b.h * k;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x0 + b.h * 0.25 * z * 0.4, y0 + b.h * 0.3 * z * 0.4, w, d);
    if (b.kind === 'canopy' || b.kind === 'pier') {
      ctx.fillStyle = b.color; ctx.fillRect(x0 + ox, y0 + oy, w, d);
      if (b.kind === 'canopy' && z > 1.2) {
        ctx.fillStyle = '#c41b1b'; ctx.fillRect(x0 + ox, y0 + oy, w, 1.2 * z);
        ctx.fillStyle = '#222'; ctx.font = `bold ${Math.max(9, 2.2 * z)}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('GAS', x0 + ox + w / 2, y0 + oy + d / 2 + 3);
      }
      continue;
    }
    // walls
    const wall = shadeHex(b.color, -0.35);
    ctx.fillStyle = wall;
    const quad = (ax, ay, bx, by) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx + ox, by + oy); ctx.lineTo(ax + ox, ay + oy); ctx.closePath(); ctx.fill(); };
    quad(x0, y0, x0 + w, y0); quad(x0 + w, y0, x0 + w, y0 + d); quad(x0, y0 + d, x0 + w, y0 + d); quad(x0, y0, x0, y0 + d);
    // lit windows on the walls facing us at night
    if (night > 0.3 && b.h > 12 && z > 1.4) {
      ctx.fillStyle = `rgba(255,214,140,${0.5 * night})`;
      const floors = Math.min(30, Math.floor(b.h / 4));
      for (let f = 1; f < floors; f++) {
        const t = f / floors;
        if (((b.x * 7 + f * 13) | 0) % 3 === 0) continue;
        if (Math.abs(ox) > 2) ctx.fillRect(ox > 0 ? x0 + w + ox * t - 1 : x0 + ox * t - 1, y0 + oy * t + d * 0.2, 2, d * 0.6);
        if (Math.abs(oy) > 2) ctx.fillRect(x0 + ox * t + w * 0.2, oy > 0 ? y0 + d + oy * t - 1 : y0 + oy * t - 1, w * 0.6, 2);
      }
    }
    // roof
    ctx.fillStyle = b.color;
    ctx.fillRect(x0 + ox, y0 + oy, w, d);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + ox, y0 + oy, w, d);
    if (b.kind === 'tower' && z > 1) {
      ctx.fillStyle = shadeHex(b.color, 0.12);
      ctx.fillRect(x0 + ox + w * 0.15, y0 + oy + d * 0.15, w * 0.3, d * 0.25);
      ctx.fillRect(x0 + ox + w * 0.6, y0 + oy + d * 0.55, w * 0.22, d * 0.22);
      if (b.h > 140) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(x0 + ox + w / 2, y0 + oy + d / 2, Math.min(w, d) * 0.18, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (b.kind === 'house' && z > 1.4) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath();
      ctx.moveTo(x0 + ox, y0 + oy + d / 2); ctx.lineTo(x0 + ox + w, y0 + oy + d / 2); ctx.stroke();
    }
    if (b.kind === 'warehouse' && z > 1.2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let s = 4; s < b.w; s += 4) { ctx.beginPath(); ctx.moveTo(x0 + ox + s * z, y0 + oy); ctx.lineTo(x0 + ox + s * z, y0 + oy + d); ctx.stroke(); }
    }
    if (b.label && showLabels && z > 1.3) {
      const fs = Math.max(10, Math.min(18, 2.6 * z));
      ctx.font = `700 ${fs}px Rajdhani, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tx = x0 + ox + w / 2, ty = y0 + oy + d / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = ctx.measureText(b.label.toUpperCase()).width;
      ctx.fillRect(tx - tw / 2 - 6, ty - fs * 0.7, tw + 12, fs * 1.4);
      ctx.fillStyle = b.labelColor || '#fff';
      ctx.fillText(b.label.toUpperCase(), tx, ty + 1);
    }
  }
}

export function drawTrees(ctx, cam, items) {
  const z = cam.zoom;
  for (const it of items) {
    if (it.type !== 't') continue;
    const t = it.o;
    const x = cam.sx(t.x), y = cam.sy(t.z), r = t.r * z;
    if (t.kind === 'cactus') {
      ctx.fillStyle = '#3f6b35'; ctx.fillRect(x - r * 0.3, y - r, r * 0.6, r * 2); ctx.fillRect(x - r, y - r * 0.2, r * 2, r * 0.45);
      continue;
    }
    if (t.kind === 'palm') {
      ctx.strokeStyle = '#2f6b2f'; ctx.lineWidth = Math.max(1, 0.5 * z);
      for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); }
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.35, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.kind === 'pine' ? '#1f3a24' : '#2f5a2a';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.kind === 'pine' ? '#284a2c' : '#3c6e34';
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

// Tunnel roof covers the highway between the portals.
export function drawTunnel(ctx, cam) {
  const x0 = cam.sx(TUNNEL[0]), x1 = cam.sx(TUNNEL[1]);
  if (x1 < 0 || x0 > cam.w) return;
  const y0 = cam.sy(HWY_Z - HWY_W / 2 - 4), y1 = cam.sy(HWY_Z + HWY_W / 2 + 4);
  ctx.fillStyle = 'rgba(58,64,52,0.93)';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = '#7c7f86';
  ctx.fillRect(x0 - 4, y0, 8, y1 - y0); ctx.fillRect(x1 - 4, y0, 8, y1 - y0);
  ctx.fillStyle = '#ddd'; ctx.font = `700 ${Math.max(10, 3 * cam.zoom)}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText('SOLACE TUNNEL', (x0 + x1) / 2, (y0 + y1) / 2);
}

// ---------------- lighting ----------------
let lightCanvas = null, lctx = null;
export function drawLighting(ctx, cam, darkness, lights, extras) {
  if (darkness < 0.03) return;
  const scale = 0.5;
  const w = Math.ceil(cam.w * scale), h = Math.ceil(cam.h * scale);
  if (!lightCanvas) { lightCanvas = document.createElement('canvas'); lctx = lightCanvas.getContext('2d'); }
  if (lightCanvas.width !== w || lightCanvas.height !== h) { lightCanvas.width = w; lightCanvas.height = h; }
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, w, h);
  lctx.fillStyle = `rgba(6,9,22,${darkness})`;
  lctx.fillRect(0, 0, w, h);
  lctx.globalCompositeOperation = 'destination-out';
  const v = cam.view(40);
  const blob = (x, y, r, a = 1) => {
    const g = lctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.beginPath(); lctx.arc(x, y, r, 0, Math.PI * 2); lctx.fill();
  };
  for (const l of lights) {
    if (l.x < v.x0 || l.x > v.x1 || l.z < v.z0 || l.z > v.z1) continue;
    blob(cam.sx(l.x) * scale, cam.sy(l.z) * scale, l.r * cam.zoom * scale, 0.85);
  }
  // headlight cones
  for (const c of extras.cars) {
    if (!c.lightsOn) continue;
    const x = cam.sx(c.x) * scale, y = cam.sy(c.z) * scale;
    const fx = Math.sin(c.h), fz = -Math.cos(c.h);
    const len = (c.beam || 28) * cam.zoom * scale;
    const g = lctx.createRadialGradient(x + fx * len * 0.35, y + fz * len * 0.35, 0, x + fx * len * 0.35, y + fz * len * 0.35, len * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.moveTo(x, y);
    const sp = 0.42;
    lctx.lineTo(x + Math.sin(c.h - sp) * len, y - Math.cos(c.h - sp) * len);
    lctx.lineTo(x + Math.sin(c.h + sp) * len, y - Math.cos(c.h + sp) * len);
    lctx.closePath(); lctx.fill();
    blob(x, y, 4 * cam.zoom * scale, 0.6);
  }
  for (const b of extras.blobs) blob(cam.sx(b.x) * scale, cam.sy(b.z) * scale, b.r * cam.zoom * scale, b.a ?? 0.9);
  ctx.drawImage(lightCanvas, 0, 0, cam.w, cam.h);

  // coloured glows on top
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const gl of extras.glows) {
    const x = cam.sx(gl.x), y = cam.sy(gl.z), r = gl.r * cam.zoom;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, gl.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (gl.a ?? 0.6) * Math.min(1, darkness * 1.6 + 0.25);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------- weather ----------------
const drops = [];
export function drawRain(ctx, cam, intensity, dt) {
  if (intensity <= 0) return;
  const n = Math.floor(260 * intensity);
  while (drops.length < n) drops.push({ x: Math.random() * cam.w, y: Math.random() * cam.h, s: 0.6 + Math.random() * 0.8 });
  drops.length = n;
  ctx.strokeStyle = 'rgba(180,200,230,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of drops) {
    d.x += -120 * dt * d.s; d.y += 900 * dt * d.s;
    if (d.y > cam.h) { d.y = -10; d.x = Math.random() * (cam.w + 100); }
    if (d.x < -10) d.x = cam.w + 10;
    ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4 * d.s, d.y + 16 * d.s);
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(20,30,45,${0.12 * intensity})`;
  ctx.fillRect(0, 0, cam.w, cam.h);
}

export function shadeHex(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// Static overview of the whole map for the minimap and phone map.
export function renderOverview(map, scale = 0.12) {
  const W = 8000, H = 8000, x0 = -4000, z0 = -4000;
  const c = document.createElement('canvas');
  c.width = W * scale; c.height = H * scale;
  const g = c.getContext('2d');
  const sx = x => (x - x0) * scale, sy = z => (z - z0) * scale;
  g.fillStyle = '#1e2619'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#7d6a4c'; g.fillRect(0, sy(DESERT_Z), c.width, c.height);
  g.fillStyle = '#262f20'; g.fillRect(sx(-3300), sy(-1000), (3300 - 1000) * scale, (DESERT_Z + 1000) * scale);
  g.fillStyle = '#34363b'; g.fillRect(sx(-985), sy(-985), 1970 * scale, 1970 * scale);
  for (const w of map.water) { g.fillStyle = '#16314a'; g.fillRect(sx(w.x), sy(w.z), w.w * scale, w.d * scale); }
  g.fillStyle = 'rgba(80,90,100,0.9)';
  for (const b of map.buildings) g.fillRect(sx(b.x), sy(b.z), Math.max(1, b.w * scale), Math.max(1, b.d * scale));
  for (const e of map.roads.edges) {
    g.strokeStyle = e.kind === 'highway' ? '#e8c21a' : e.kind === 'desert' ? '#c9b48a' : '#c8cad0';
    g.lineWidth = Math.max(1.5, e.width * scale * (e.kind === 'highway' ? 1 : 1.4));
    g.beginPath(); g.moveTo(sx(e.ax), sy(e.az)); g.lineTo(sx(e.bx), sy(e.bz)); g.stroke();
  }
  g.strokeStyle = '#a8aab0'; g.lineWidth = 1.5;
  g.beginPath(); BACKROAD.forEach(([x, z], i) => i ? g.lineTo(sx(x), sy(z)) : g.moveTo(sx(x), sy(z))); g.stroke();
  return { canvas: c, scale, x0, z0 };
}
