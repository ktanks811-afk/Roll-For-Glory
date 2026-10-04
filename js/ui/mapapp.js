// Phone → Map. A real map you can drag, pinch and zoom: every place you can go
// is pinned and named, filter by type or search, tap a pin (or a row in the
// list) to see what's there and how far it is, and hit Set GPS to get a route.
// You can also tap any empty spot to drop a pin and navigate to it.

import { esc } from './dom.js';
import { tierOf } from '../core/state.js';
import { LOCATIONS, LOC_BY_ID, districtAt } from '../data/world.js';
import { TILE, tileCache } from '../world2d/mapTiles.js';
import { online } from '../net/online.js';

const ICON = { home: '⌂', car: '◆', wrench: '⚙', spray: '✦', repair: '✚', gas: '⛽', food: '☕', shirt: '◇', key: '⌘', shield: '★', cross: '✚', tow: '$', meet: '●', flag: '⚑', trophy: '♛' };
const CATS = [
  { id: 'all', label: 'All', types: null },
  { id: 'cars', label: 'Cars', types: ['dealer', 'usedlot'] },
  { id: 'shops', label: 'Shops', types: ['perf', 'visual', 'repair', 'clothing', 'realty'] },
  { id: 'race', label: 'Races & meets', types: ['meet', 'carshow', 'drag', 'roll', 'sprint'] },
  { id: 'fuel', label: 'Gas & food', types: ['gas', 'food', 'corner'] },
  { id: 'work', label: 'Work', types: ['work'] },
  { id: 'home', label: 'Home', types: ['home', 'property', 'trap', 'land'] },
  { id: 'police', label: 'Police & courts', types: ['police', 'court'] },
  { id: 'health', label: 'Hospital', types: ['hospital'] },
];
const WHAT = {
  home: 'Your place: sleep, save, garage, change clothes.',
  property: 'A property: extra garage space.',
  usedlot: 'Used cars, cheap and honest-ish.',
  dealer: 'New cars at real prices.',
  perf: 'Install performance parts, dyno and tune.',
  visual: 'Paint, wheels, body kits and looks.',
  repair: 'Collision repair and fixing damage.',
  gas: 'Fill the tank.',
  food: 'Food and energy.',
  corner: 'Corner store: snacks, drinks, smokes.',
  work: 'Tow yard and gig dispatch: take delivery runs, Ryde riders and tow calls.',
  clothing: 'Outfits and streetwear.',
  realty: 'Buy and sell houses, land and trap houses.',
  trap: 'A trap house. Stock the stash and customers knock. Too many and SWAT does too.',
  land: 'Land for sale. Buy it and build your own house and garage.',
  plug: 'Lil Tre sells product out the back of his corner store.',
  police: 'FWPD precinct. Lay low when you have heat.',
  hospital: 'JPS, the county trauma center. Urgent care, clinic follow-ups for injuries, and your medical bills.',
  court: 'Criminal courts. Show up on your court date or a warrant goes out.',
  meet: 'Street meet: racers to talk to, side bets, Zed\'s van, show your car.',
  drag: 'The drag strip: burnouts, the tree, timeslips.',
  roll: 'A roll-race road. Pick a rival and a wager.',
  sprint: 'A street race start line: 1v1 for cash or pink slips, or a run at the course record.',
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shortName = n => n.replace(/\s*\(.*?\)\s*/g, ' ').trim();
const fmtDist = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m';
const fmtEta = m => { const sec = m / 19; return sec < 50 ? 'under a minute' : '~' + Math.round(sec / 60) + ' min'; };   // 1 real second = 1 game minute

export function renderMap(scr, ctx) {
  const s = ctx.s, w = ctx.app.world;
  const st = ctx.st.mapView ??= { k: 0, cx: 0, cz: 0, sel: null, cat: 'all', q: '', pin: null };
  const tier = tierOf(s.rep).n;
  const me = () => w ? w.playerState() : { x: 0, z: 0, h: 0 };

  scr.innerHTML = `<div class="app-head"><button class="back" data-back>‹ Back</button><h2>Map</h2></div>
    <div class="app-body mapapp">
      <div class="map-wrap"><canvas data-map></canvas>
        <div class="map-tools"><button data-z="1" aria-label="Zoom in">+</button><button data-z="-1" aria-label="Zoom out">−</button><button data-me aria-label="My location">◎</button><button data-fit aria-label="Show all places">▦</button></div>
        </div>
      <div class="map-card" data-card></div>
      <input class="input" data-q placeholder="Search places…" value="${esc(st.q)}" autocomplete="off">
      <div class="map-chips">${CATS.map(c => `<button class="sr-chip ${st.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}</div>
      <div class="list" data-list></div></div>`;
  scr.querySelector('[data-back]').onclick = () => ctx.go(null);
  const cv = scr.querySelector('[data-map]'), g = cv.getContext('2d');
  const card = scr.querySelector('[data-card]'), listEl = scr.querySelector('[data-list]');

  // ------------------------------------------------------------ view state
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const size = () => { const r = cv.getBoundingClientRect(); W = Math.round(r.width) || 360; H = Math.round(r.height) || 360; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
  const places = () => LOCATIONS.filter(l => { const c = CATS.find(x => x.id === st.cat); return (!c.types || c.types.includes(l.type)) && (!st.q || (l.name + ' ' + l.type + ' ' + districtAt(l.x, l.z)).toLowerCase().includes(st.q.toLowerCase())); });
  const fitAll = (pts) => {
    const list = pts && pts.length ? pts : [...LOCATIONS.map(l => [l.x, l.z]), [me().x, me().z]];
    const xs = list.map(p => p[0]), zs = list.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    st.cx = (x0 + x1) / 2; st.cz = (z0 + z1) / 2;
    st.k = clamp(Math.min(W / Math.max(300, (x1 - x0) * 1.2), H / Math.max(300, (z1 - z0) * 1.2)), 0.05, 1.2);
  };
  const toScreen = (x, z) => [(x - st.cx) * st.k + W / 2, (z - st.cz) * st.k + H / 2];
  const toWorld = (sx, sy) => [(sx - W / 2) / st.k + st.cx, (sy - H / 2) / st.k + st.cz];
  let dirty = true, selRoute = null;

  // ------------------------------------------------------------ drawing
  const draw = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0c0d10'; g.fillRect(0, 0, W, H);
    const map = w?.map; if (!map) return;
    const k = st.k;
    g.save(); g.translate(W / 2, H / 2); g.scale(k, k); g.translate(-st.cx, -st.cz);
    g.imageSmoothingEnabled = true;
    const ov = map.overview; if (ov) g.drawImage(ov.canvas, ov.x0, ov.z0, ov.canvas.width / ov.scale, ov.canvas.height / ov.scale);
    let missing = 0;
    const vw = W / k, vh = H / k;
    if (vw <= 3400) {
      const i0 = Math.floor((st.cx - vw / 2) / TILE), i1 = Math.floor((st.cx + vw / 2) / TILE), j0 = Math.floor((st.cz - vh / 2) / TILE), j1 = Math.floor((st.cz + vh / 2) / TILE);
      missing = tileCache.ensure(map, i0, i1, j0, j1, st.cx, st.cz, 3);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const c = tileCache.get(i, j); if (c) g.drawImage(c, i * TILE - 1, j * TILE - 1, TILE + 2, TILE + 2); }
    }
    g.restore();
    if (missing) dirty = true;

    // districts, faint, when zoomed out
    if (k < 0.2) {
      g.font = '700 13px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.55)';
      const inner = k > 0.11 ? [['STOCKYARDS', 0, -650], ['NEAR SOUTHSIDE', 0, 650], ['ARLINGTON HEIGHTS', -650, 0], ['RIVERSIDE', 650, -300], ['LAKESIDE', 650, 800]] : [];
      for (const [t, x, z] of [['DOWNTOWN', 0, 0], ...inner, ['STOP SIX', 1800, -420], ['LAKE WORTH', 1900, 700], ['LOOP 820', 0, -1330], ['CROSS TIMBERS', -2100, -500], ['CHISHOLM FLATS', -300, 1250]]) { const [a, b] = toScreen(x, z); g.fillText(t, a, b); }
    }

    // route preview (dashed) and the active GPS route
    const line = (path, wd, col, dash) => { g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); path.forEach(([x, z], i) => { const [a, b] = toScreen(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); g.setLineDash([]); };
    if (selRoute && !(s.gps && st.sel && s.gps.x === st.sel.x && s.gps.z === st.sel.z)) { line(selRoute.path, 5, 'rgba(0,0,0,.6)'); line(selRoute.path, 3, 'rgba(255,255,255,.9)', [7, 6]); }
    if (w.gpsPath && s.gps) {
      line(w.gpsPath, 8, 'rgba(40,6,12,.9)'); line(w.gpsPath, 5, '#ff2a3a');
      // little chevrons along the route show which way to go
      g.fillStyle = '#fff'; let acc = 0;
      for (let i = 1; i < w.gpsPath.length; i++) {
        const [ax, ay] = toScreen(...w.gpsPath[i - 1]), [bx, by] = toScreen(...w.gpsPath[i]), seg = Math.hypot(bx - ax, by - ay);
        for (let d = 40 - (acc % 80); d < seg; d += 80) { const t = d / seg, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, an = Math.atan2(by - ay, bx - ax); g.save(); g.translate(x, y); g.rotate(an); g.beginPath(); g.moveTo(4, 0); g.lineTo(-3, -3.2); g.lineTo(-3, 3.2); g.closePath(); g.fill(); g.restore(); }
        acc += seg;
      }
    }

    // pins
    const shown = places(), drawn = [];
    g.textBaseline = 'middle';
    const sel = st.sel && st.sel.id;
    const pins = shown.map(l => ({ l, p: toScreen(l.x, l.z) })).filter(({ p }) => p[0] > -20 && p[0] < W + 20 && p[1] > -20 && p[1] < H + 20);
    pins.sort((a, b) => (a.l.id === sel) - (b.l.id === sel));
    for (const { l, p } of pins) {
      const [x, y] = p, r = l.id === sel ? 11 : k > 0.35 ? 9 : 7.5;
      g.fillStyle = 'rgba(8,9,12,.85)'; g.beginPath(); g.arc(x, y, r + 2, 0, 7); g.fill();
      g.fillStyle = l.color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = '#000'; g.font = `700 ${Math.round(r * 1.2)}px sans-serif`; g.textAlign = 'center'; g.fillText(ICON[l.icon] || '•', x, y + 0.5);
      if (l.id === sel) { const t = (performance.now() % 1400) / 1400; g.strokeStyle = `rgba(255,255,255,${1 - t})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 4 + t * 12, 0, 7); g.stroke(); dirty = true; }
    }
    // labels once there's room, never on top of each other
    if (k > 0.14) {
      g.font = '700 11px Rajdhani, sans-serif'; g.textAlign = 'center';
      for (const { l, p } of pins) {
        const name = shortName(l.name), tw = g.measureText(name).width, x = p[0], y = p[1] + 17;
        const box = [x - tw / 2 - 2, y - 7, x + tw / 2 + 2, y + 7];
        if (drawn.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) && l.id !== sel) continue;
        drawn.push(box);
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.9)'; g.strokeText(name, x, y); g.fillStyle = l.id === sel ? '#fff' : '#e6e9ee'; g.fillText(name, x, y);
      }
    }

    // dropped pin and destination flag
    const flag = (x, y, col) => { g.fillStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, y + 7); g.lineTo(x - 3, y - 7); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(x - 3, y - 7); g.lineTo(x + 7, y - 3.5); g.lineTo(x - 3, y); g.closePath(); g.fill(); };
    if (st.pin) { const [x, y] = toScreen(st.pin.x, st.pin.z); flag(x, y, '#ffb020'); }
    // every stop left on the mission you're on, numbered
    const job = s.missions?.active;
    if (job) job.stops.forEach((id, i) => {
      if (i < job.stage) return;
      const l = LOC_BY_ID[id], [x, y] = toScreen(l.x, l.z);
      g.fillStyle = 'rgba(0,0,0,.85)'; g.beginPath(); g.arc(x, y - 16, 9, 0, 7); g.fill();
      g.fillStyle = i === job.stage ? '#ffb020' : '#8a6a20'; g.beginPath(); g.arc(x, y - 16, 7.5, 0, 7); g.fill();
      g.fillStyle = '#000'; g.font = '700 10px sans-serif'; g.textAlign = 'center'; g.fillText(String(i + 1), x, y - 15.5);
    });
    if (s.gps) { const [x, y] = toScreen(s.gps.x, s.gps.z); flag(x, y, '#ff2a3a'); }

    // traffic that matters: cops, other players, your parked car, you
    const flash = performance.now() % 400 < 200;
    if (w.police) for (const u of w.police.units) { const [x, y] = toScreen(u.x, u.z); g.fillStyle = flash ? '#ff2a3a' : '#2a6bff'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke(); dirty = true; }
    if (online.active) for (const o of online.list()) { if (o.fresh) continue; const [x, y] = toScreen(o.x, o.z); g.fillStyle = '#3ddc84'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#052'; g.font = '700 7px sans-serif'; g.textAlign = 'center'; g.fillText((o.name[0] || '?').toUpperCase(), x, y + 0.5); }
    if (w.vehicle && !w.inCar) { const [x, y] = toScreen(w.vehicle.x, w.vehicle.z); g.fillStyle = '#000'; g.fillRect(x - 6.5, y - 6.5, 13, 13); g.fillStyle = '#4af'; g.fillRect(x - 5, y - 5, 10, 10); }
    { const p = me(), [x, y] = toScreen(p.x, p.z);
      g.save(); g.translate(x, y); g.rotate(p.h);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.stroke(); g.fill();
      g.fillStyle = '#e0192e'; g.beginPath(); g.moveTo(0, -6); g.lineTo(3.2, 4); g.lineTo(0, 2); g.lineTo(-3.2, 4); g.closePath(); g.fill(); g.restore(); }

    // scale bar, compass
    const nice = [50, 100, 200, 500, 1000, 2000, 5000].find(m => m * k >= 46) || 5000, bw = nice * k;
    g.fillStyle = 'rgba(8,9,12,.8)'; g.fillRect(8, H - 24, bw + 16, 16);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(16, H - 12); g.lineTo(16 + bw, H - 12); g.moveTo(16, H - 16); g.lineTo(16, H - 12); g.moveTo(16 + bw, H - 16); g.lineTo(16 + bw, H - 12); g.stroke();
    g.fillStyle = '#fff'; g.font = '700 10px Rajdhani, sans-serif'; g.textAlign = 'left'; g.fillText(nice >= 1000 ? nice / 1000 + ' km' : nice + ' m', 16, H - 18.5);
    g.fillStyle = 'rgba(8,9,12,.85)'; g.beginPath(); g.arc(W - 18, 18, 11, 0, 7); g.fill(); g.fillStyle = '#ff4a58'; g.font = '700 12px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('N', W - 18, 18.5);
  };
  let raf = 0;
  const loop = () => { if (!cv.isConnected) return; if (dirty) { dirty = false; draw(); } raf = requestAnimationFrame(loop); };

  // ------------------------------------------------------------ selection card + list
  const drive = (x, z) => w ? w.routeTo(x, z) : { path: [], meters: 0 };
  const select = (target, opts = {}) => {
    st.sel = target; st.pin = target && target.pin ? target : null;
    selRoute = target ? drive(target.x, target.z) : null;
    if (target && opts.center) { st.cx = target.x; st.cz = target.z; st.k = Math.max(st.k, 0.32); }
    dirty = true; drawCard(); drawList();
  };
  const drawCard = () => {
    const t = st.sel, active = t && s.gps && s.gps.x === t.x && s.gps.z === t.z;
    const job = s.missions?.active, jl = job && LOC_BY_ID[job.stops[job.stage]];
    const jobRow = job && jl ? `<div class="mc-job">📦 <b>${esc(job.title)}</b> · stop ${job.stage + 1} of ${job.stops.length}: ${esc(shortName(jl.name))}${s.gps && s.gps.x === jl.x && s.gps.z === jl.z ? '' : ' <button class="btn btn-sm" data-job>Route there</button>'}</div>` : '';
    if (!t) {
      card.innerHTML = jobRow + (s.gps
        ? `<div class="mc-name">🚩 GPS: ${esc(s.gps.label)}</div><div class="mc-sub">${fmtDist(drive(s.gps.x, s.gps.z).meters)} by road · ${fmtEta(drive(s.gps.x, s.gps.z).meters)}</div><div class="row" style="gap:6px;margin-top:8px"><button class="btn btn-sm btn-primary" data-go>Start driving</button><button class="btn btn-sm" data-clear>Clear GPS</button></div>`
        : `<div class="mc-name">Where to?</div><div class="mc-sub">Tap a pin or a place below to see what's there and get directions. Tap anywhere on the map to drop a pin.</div>`);
    } else {
      const l = LOC_BY_ID[t.id], locked = l && l.tier && tier < l.tier;
      const m = selRoute ? selRoute.meters : 0;
      card.innerHTML = `<div class="mc-name">${t.pin ? '📍 Dropped pin' : esc(shortName(t.name))}${locked ? ' <span class="tag tag-red">🔒 Tier ' + l.tier + '</span>' : ''}</div>
        <div class="mc-sub">${esc(districtAt(t.x, t.z))} · ${fmtDist(m)} by road · ${fmtEta(m)}</div>
        ${l ? `<div class="mc-what">${esc(WHAT[l.type] || '')}${l.tier ? ` Needs rep tier ${l.tier}.` : ''}</div>` : ''}
        <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${active
          ? '<button class="btn btn-sm btn-primary" data-go>Start driving</button><button class="btn btn-sm" data-clear>Clear GPS</button>'
          : '<button class="btn btn-sm btn-primary" data-gps>📍 Set GPS</button>'}<button class="btn btn-sm" data-center>Center</button><button class="btn btn-sm" data-x>✕</button></div>`;
    }
    const q = sel => card.querySelector(sel);
    q('[data-job]')?.addEventListener('click', () => { select(jl, { center: true }); setGps(jl); });
    q('[data-gps]')?.addEventListener('click', () => setGps(t));
    q('[data-go]')?.addEventListener('click', () => ctx.h.close());
    q('[data-clear]')?.addEventListener('click', () => { s.gps = null; if (w) w.gpsPath = null; select(st.sel); });
    q('[data-center]')?.addEventListener('click', () => { st.cx = t.x; st.cz = t.z; st.k = Math.max(st.k, 0.32); dirty = true; });
    q('[data-x]')?.addEventListener('click', () => select(null));
  };
  const setGps = t => {
    const label = t.pin ? 'Dropped pin' : shortName(t.name);
    w?.setGps(t.x, t.z, label); w?.updateGps();       // route now, not next frame
    drawCard(); drawList(); dirty = true;
  };
  const drawList = () => {
    const p = me();
    const rows = places().map(l => ({ l, d: Math.hypot(l.x - p.x, l.z - p.z) })).sort((a, b) => a.d - b.d);
    listEl.innerHTML = rows.length ? rows.map(({ l, d }) => {
      const locked = l.tier && tier < l.tier, on = s.gps && s.gps.x === l.x && s.gps.z === l.z;
      return `<div class="li click" data-loc="${l.id}"><span class="mp-chip" style="background:${l.color}">${ICON[l.icon] || '•'}</span><div class="grow"><div class="t">${esc(shortName(l.name))}</div><div class="s">${esc(districtAt(l.x, l.z))} · ${fmtDist(d)}${locked ? ` · <span class="bad">🔒 tier ${l.tier}</span>` : ''}</div></div><button class="btn btn-sm ${on ? '' : 'btn-primary'}" data-go-loc="${l.id}">${on ? '🚩 Active' : 'Go'}</button></div>`;
    }).join('') : '<div class="empty">No places match.</div>';
    listEl.querySelectorAll('[data-loc]').forEach(row => row.onclick = e => {
      const l = LOC_BY_ID[row.dataset.loc];
      if (e.target.closest('[data-go-loc]')) { select(l, { center: true }); setGps(l); return; }
      select(l, { center: true }); cv.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
  };

  // ------------------------------------------------------------ input: drag, pinch, wheel, tap
  const ptrs = new Map(); let tap = null, pinch = null;
  const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, rel(e));
    tap = ptrs.size === 1 ? { at: rel(e), t: performance.now(), moved: 0 } : null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: st.k }; }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId), cur = rel(e); ptrs.set(e.pointerId, cur);
    if (ptrs.size === 1) {
      const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
      if (tap) tap.moved += Math.abs(dx) + Math.abs(dy);
      st.cx = clamp(st.cx - dx / st.k, -3600, 3600); st.cz = clamp(st.cz - dy / st.k, -3600, 3600); dirty = true;
    } else if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      st.k = clamp(pinch.k * d / Math.max(20, pinch.d), 0.05, 1.6); dirty = true;
    }
  });
  const up = e => {
    const had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (had && tap && e.type === 'pointerup' && tap.moved < 8 && performance.now() - tap.t < 600) onTap(tap.at);
    if (!ptrs.size) tap = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const [mx, my] = rel(e), [wx, wz] = toWorld(mx, my);
    st.k = clamp(st.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 0.05, 1.6);
    st.cx = wx - (mx - W / 2) / st.k; st.cz = wz - (my - H / 2) / st.k; dirty = true;
  }, { passive: false });
  const onTap = ([mx, my]) => {
    let best = null, bd = 22;
    for (const l of places()) { const [a, b] = toScreen(l.x, l.z), d = Math.hypot(a - mx, b - my); if (d < bd) { bd = d; best = l; } }
    if (best) { select(best); return; }
    // empty ground: drop a pin on the nearest road
    const [wx, wz] = toWorld(mx, my), r = w?.map.roads.nearestOnRoad(wx, wz);
    const pin = r && r.dist < 300 ? { x: r.x, z: r.z } : { x: wx, z: wz };
    select({ id: '_pin', name: 'Dropped pin', pin: true, x: pin.x, z: pin.z });
  };
  const zoomBy = f => { st.k = clamp(st.k * f, 0.05, 1.6); dirty = true; };
  scr.querySelectorAll('[data-z]').forEach(b => b.onclick = () => zoomBy(+b.dataset.z > 0 ? 1.5 : 1 / 1.5));
  scr.querySelector('[data-me]').onclick = () => { const p = me(); st.cx = p.x; st.cz = p.z; st.k = Math.max(st.k, 0.4); dirty = true; };
  scr.querySelector('[data-fit]').onclick = () => { fitAll(); dirty = true; };
  scr.querySelector('[data-q]').oninput = e => { st.q = e.target.value; drawList(); dirty = true; };
  scr.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { st.cat = b.dataset.cat; scr.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === b)); drawList(); dirty = true; });

  // ------------------------------------------------------------ go
  size();
  if (!st.k) { const p = me(); if (s.gps) fitAll([[p.x, p.z], [s.gps.x, s.gps.z]]); else fitAll(); }
  if (st.sel && st.sel.id !== '_pin') st.sel = LOC_BY_ID[st.sel.id] || null;
  selRoute = st.sel ? drive(st.sel.x, st.sel.z) : null;
  drawCard(); drawList(); dirty = true;
  const ro = new ResizeObserver(() => { if (cv.isConnected) { size(); dirty = true; } }); ro.observe(cv);
  raf = requestAnimationFrame(loop);
}
