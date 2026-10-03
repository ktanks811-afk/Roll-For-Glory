// The corner minimap. It draws crisp map tiles straight from the city's real
// roads, buildings, lots and water (not a blurry shrunken picture), rotates
// with your heading, zooms out as you speed up, and shows the GPS route, the
// destination (pinned to the edge when it's off the map), cops, roadblocks,
// the helicopter, other players and your parked car.
//
// Tap it to switch view: heading-up (auto zoom) → close → far → north-up.

import { LOCATIONS } from '../data/world.js';
import { TILE, tileCache } from '../world2d/mapTiles.js';
import { settings, saveSettings } from '../core/save.js';
import { game } from '../core/state.js';
import { online } from '../net/online.js';

const S = 220;                         // logical size of the canvas
const MODES = [
  { name: 'HEADING UP', rot: true, zoom: 'auto' },
  { name: 'HEADING UP · CLOSE', rot: true, zoom: 'close' },
  { name: 'HEADING UP · FAR', rot: true, zoom: 'far' },
  { name: 'NORTH UP', rot: false, zoom: 'auto' },
];
const ICON = { home: '⌂', car: '◆', wrench: '⚙', spray: '✦', repair: '✚', gas: '⛽', food: '☕', shirt: '◇', key: '⌘', shield: '★', tow: '$', court: '⚖', meet: '●', flag: '⚑', trophy: '♛' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class MiniMap {
  constructor(canvas) {
    this.cv = canvas;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(S * this.dpr);
    this.g = canvas.getContext('2d');
    this.h = 0; this.scale = 0.7; this.t = performance.now();
    this.modeT = 0;
    this.q = [];
    canvas.parentElement.addEventListener('pointerdown', e => { e.preventDefault(); this.cycle(); });
  }

  tileCount() { return tileCache.size; }
  get mode() { return MODES[(settings.miniMode ?? 0) % MODES.length]; }
  cycle() {
    settings.miniMode = ((settings.miniMode ?? 0) + 1) % MODES.length;
    saveSettings(); this.modeT = 1.6;
  }

  // ---------------------------------------------------------------- drawing
  draw(w, p) {
    const now = performance.now(), dt = Math.min(0.1, (now - this.t) / 1000); this.t = now;
    const mode = this.mode, g = this.g, map = w.map;
    // heading eases so the map turns smoothly
    const rot = mode.rot && p.inCar;
    const targetH = rot ? p.h : 0;
    this.h += angDiff(this.h, targetH) * Math.min(1, dt * 9);
    // zoom: faster = further out
    const spd = Math.hypot(p.vx || 0, p.vz || 0);
    const targetS = mode.zoom === 'close' ? 1.0 : mode.zoom === 'far' ? 0.2 : p.inCar ? 0.75 - 0.47 * clamp(spd / 55, 0, 1) : 0.95;
    this.scale += (targetS - this.scale) * Math.min(1, dt * 3);
    const s = this.scale, h = this.h;
    const OFF = rot ? 26 : 0;                  // you sit low in the circle so there's more road ahead
    this.modeT = Math.max(0, this.modeT - dt);

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#0c0d10'; g.fillRect(0, 0, S, S);
    // world → minimap pixels (heading-up: forward points up)
    const ca = Math.cos(-h), sa = Math.sin(-h);
    const P = (x, z) => { const dx = (x - p.x) * s, dz = (z - p.z) * s; return [S / 2 + dx * ca - dz * sa, S / 2 + OFF + dx * sa + dz * ca]; };

    // base map: blurry overview first, then the sharp tiles on top
    g.save(); g.translate(S / 2, S / 2 + OFF); g.rotate(-h); g.scale(s, s); g.translate(-p.x, -p.z);
    g.imageSmoothingEnabled = true;
    const ov = map.overview; if (ov) g.drawImage(ov.canvas, ov.x0, ov.z0, ov.canvas.width / ov.scale, ov.canvas.height / ov.scale);
    const R = ((S / 2) * 1.45 + OFF) / s;
    const i0 = Math.floor((p.x - R) / TILE), i1 = Math.floor((p.x + R) / TILE), j0 = Math.floor((p.z - R) / TILE), j1 = Math.floor((p.z + R) / TILE);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) <= 36) {
      tileCache.ensure(map, i0, i1, j0, j1, p.x, p.z, 1);   // one new tile a frame keeps driving smooth
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const c = tileCache.get(i, j); if (c) g.drawImage(c, i * TILE - 1, j * TILE - 1, TILE + 2, TILE + 2); }
    }
    g.restore();

    // night
    const dark = w.darkness ? w.darkness() : 0;
    if (dark > 0.02) { g.fillStyle = `rgba(4,8,30,${dark * 0.5})`; g.fillRect(0, 0, S, S); }

    // GPS route: dark casing, then the route in red
    const gps = game.s.gps;
    if (w.gpsPath && gps) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [wd, col] of [[7, 'rgba(40,6,12,.9)'], [4, '#ff2a3a']]) { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); w.gpsPath.forEach(([x, z], k) => { const [a, b] = P(x, z); k ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); }
    }

    // places (named when you're close and slow)
    g.font = '600 11px Rajdhani, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of LOCATIONS) {
      const [a, b] = P(l.x, l.z);
      if (Math.hypot(a - S / 2, b - S / 2) > S / 2 + 8) continue;
      g.fillStyle = 'rgba(8,9,12,.8)'; g.beginPath(); g.arc(a, b, 8, 0, 7); g.fill();
      g.fillStyle = l.color; g.beginPath(); g.arc(a, b, 6.4, 0, 7); g.fill();
      g.fillStyle = '#000'; g.font = '700 10px sans-serif'; g.fillText(ICON[l.icon] || '•', a, b + 0.5);
      if (s > 0.55 && Math.hypot(a - S / 2, b - S / 2) < S / 2 - 24 && b < S - 44 && Math.hypot(l.x - p.x, l.z - p.z) < 130) {
        g.font = '700 10px Rajdhani, sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(l.name, a, b + 15); g.fillStyle = '#f2f4f8'; g.fillText(l.name, a, b + 15);
      }
    }

    // police
    const pol = w.police, flash = performance.now() % 400 < 200;
    if (pol.lastSeen && (pol.phase === 'search' || pol.phase === 'cooldown')) {
      const [a, b] = P(pol.lastSeen.x, pol.lastSeen.z);
      g.strokeStyle = pol.phase === 'cooldown' ? '#ffc800' : '#ff2a3a'; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); g.arc(a, b, pol.searchR * s, 0, 7); g.stroke(); g.setLineDash([]);
    }
    for (const b of pol.blocks) {
      const [a, c] = P(b.x ?? b.spikes?.x, b.z ?? b.spikes?.z);
      g.strokeStyle = '#ff2a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(a - 5, c - 5); g.lineTo(a + 5, c + 5); g.moveTo(a + 5, c - 5); g.lineTo(a - 5, c + 5); g.stroke();
    }
    const cops = [...pol.units, ...(game.s.heat > 0 || pol.active ? pol.patrols : pol.patrols.filter(c => Math.hypot(c.x - p.x, c.z - p.z) < 70))];
    for (const u of cops) {
      const [a, b] = P(u.x, u.z);
      if (Math.hypot(a - S / 2, b - S / 2) > S / 2 + 6) continue;
      g.fillStyle = 'rgba(0,0,0,.7)'; g.beginPath(); g.arc(a, b, 6, 0, 7); g.fill();
      g.fillStyle = flash ? '#ff2a3a' : '#2a6bff'; g.beginPath(); g.arc(a, b, 4.4, 0, 7); g.fill();
    }
    if (pol.heli) { const [a, b] = P(pol.heli.x, pol.heli.z); g.strokeStyle = '#e8eaee'; g.lineWidth = 2; g.beginPath(); g.moveTo(a - 7, b); g.lineTo(a + 7, b); g.moveTo(a, b - 7); g.lineTo(a, b + 7); g.stroke(); g.fillStyle = flash ? '#ff2a3a' : '#2a6bff'; g.beginPath(); g.arc(a, b, 3, 0, 7); g.fill(); }
    // a red pulse around you while you're being chased
    if (pol.phase === 'chase' || pol.phase === 'notice') {
      const t = (performance.now() % 1200) / 1200; g.strokeStyle = `rgba(255,42,58,${1 - t})`; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2 + OFF, 8 + t * 34, 0, 7); g.stroke();
    }

    // other players
    if (online.active) for (const o of online.list()) {
      if (o.fresh) continue;
      const [a, b] = P(o.x, o.z);
      if (Math.hypot(a - S / 2, b - S / 2) > S / 2 + 6) continue;
      g.fillStyle = 'rgba(0,0,0,.7)'; g.beginPath(); g.arc(a, b, 6.4, 0, 7); g.fill();
      g.fillStyle = '#3ddc84'; g.beginPath(); g.arc(a, b, 4.8, 0, 7); g.fill();
      g.fillStyle = '#052'; g.font = '700 7px sans-serif'; g.fillText((o.name[0] || '?').toUpperCase(), a, b + 0.5);
    }
    // your parked car
    if (w.vehicle && !w.inCar) {
      const [a, b] = P(w.vehicle.x, w.vehicle.z);
      g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(a - 6, b - 6, 12, 12); g.fillStyle = '#4af'; g.fillRect(a - 4.5, b - 4.5, 9, 9);
    }

    // destination: a flag, or an arrow on the rim when it's off the map
    if (gps) {
      const [a, b] = P(gps.x, gps.z), dx = a - S / 2, dy = b - S / 2, d = Math.hypot(dx, dy), lim = S / 2 - 13;
      if (d <= lim) { this.flag(g, a, b); }
      else {
        const ang = Math.atan2(dy, dx), ex = S / 2 + Math.cos(ang) * lim, ey = S / 2 + Math.sin(ang) * lim;
        g.save(); g.translate(ex, ey); g.rotate(ang); g.fillStyle = '#ff2a3a'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -7); g.lineTo(-3, 0); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
        const m = Math.hypot(gps.x - p.x, gps.z - p.z), label = m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m';
        g.font = '700 10px Rajdhani, sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.9)'; const lx = S / 2 + Math.cos(ang) * (lim - 22), ly = S / 2 + Math.sin(ang) * (lim - 22); g.strokeText(label, lx, ly); g.fillStyle = '#fff'; g.fillText(label, lx, ly);
      }
    }

    // you: an arrow with a soft glow (always points the way you face)
    g.save(); g.translate(S / 2, S / 2 + OFF); g.rotate(p.h - h);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.stroke(); g.fill();
    g.fillStyle = '#e0192e'; g.beginPath(); g.moveTo(0, -6); g.lineTo(3.2, 4); g.lineTo(0, 2); g.lineTo(-3.2, 4); g.closePath(); g.fill();
    g.restore();

    // compass: N rides the rim as the map turns
    { const nx = S / 2 + Math.sin(h) * (S / 2 - 12), ny = S / 2 - Math.cos(h) * (S / 2 - 12);
      g.fillStyle = 'rgba(8,9,12,.85)'; g.beginPath(); g.arc(nx, ny, 8.5, 0, 7); g.fill();
      g.fillStyle = '#ff4a58'; g.font = '700 11px Rajdhani, sans-serif'; g.fillText('N', nx, ny + 0.5); }

    // street name chip along the bottom
    const street = w.streetAt ? w.streetAt(p.x, p.z) : '';
    if (street) {
      g.font = '700 11px Rajdhani, sans-serif'; const tw = Math.min(150, g.measureText(street).width + 16);
      g.fillStyle = 'rgba(8,9,12,.82)'; g.fillRect(S / 2 - tw / 2, S - 28, tw, 17); g.fillStyle = '#e8eaee'; g.fillText(street, S / 2, S - 19, 140);
    }
    // vignette + current mode
    const vg = g.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S * 0.5); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, S, S);
    if (this.modeT > 0) {
      g.globalAlpha = Math.min(1, this.modeT); g.font = '700 11px Rajdhani, sans-serif';
      const tw = g.measureText(mode.name).width + 16; g.fillStyle = 'rgba(8,9,12,.9)'; g.fillRect(S / 2 - tw / 2, 40, tw, 18); g.fillStyle = '#fff'; g.fillText(mode.name, S / 2, 49.5); g.globalAlpha = 1;
    }
  }

  flag(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, y + 6); g.lineTo(x - 3, y - 6); g.stroke();
    g.fillStyle = '#ff2a3a'; g.beginPath(); g.moveTo(x - 3, y - 6); g.lineTo(x + 6, y - 3); g.lineTo(x - 3, y); g.closePath(); g.fill();
  }
}
