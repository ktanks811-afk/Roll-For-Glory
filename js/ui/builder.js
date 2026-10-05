// Cowtown Custom Builders: design your own house, the way the Sims does it.
// Drag across the grid to paint rooms, drop furniture in them, add a 2nd and
// 3rd floor (a staircase gets you up there), pick the siding and the roof.
// Rules are in core/homes.js; this is the screen.
//
//   Touch / mouse   drag to paint a room, tap to place furniture, drag a
//                   piece to move it, tap it to turn or remove it
//   Controller      the D-pad moves the cursor on the plan, A paints or
//                   places, move off the edge of the plan to get to the tools

import { openPanel, bind, esc, toast } from './dom.js';
import { fmtMoney } from '../core/state.js';
import { audio } from '../core/audio.js';
import { GW, GD, MAX_FLOORS, ROOMS, ROOM_BY_ID, FURNITURE, FURN_BY_ID, FURN_CATS, WALL_COLORS, ROOF_COLORS, ROOF_STYLES, PRESETS, PRESET_IDS } from '../data/homes.js';
import * as H from '../core/homes.js';
import { drawFurniture } from '../gfx2d/furniture.js';

const FLOOR_NAMES = ['Ground floor', '2nd floor', '3rd floor'];

// opts: { design, title, sub, action ('Build it'), price(design) → { text, ok },
//         done(design) → true to close }
export function openBuilder(opts) {
  const st = {
    d: H.cloneDesign(opts.design || H.fromPreset('starter')),
    floor: 0, mode: 'rooms', room: 'L', furn: 'bed', cat: 'Bedroom', rot: 0, sel: null,
    cur: { x: 0, y: 0 }, drag: null, move: null, hover: null, ts: 24,
  };
  while (st.d.furn.length < st.d.floors.length) st.d.furn.push([]);
  let cv = null, g = null, tools = null, foot = null;

  openPanel((root, h) => {
    root.innerHTML = `<div class="p-head"><h1>${esc(opts.title || 'Design your house')}<small>${esc(opts.sub || 'Cowtown Custom Builders')}</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body bld">
        <div class="bld-plan"><div class="bld-floors" data-floors></div><canvas class="bld-cv" tabindex="0" data-padgrid aria-label="House plan"></canvas></div>
        <div class="bld-side"><div class="bld-tools" data-tools></div><div class="bld-foot" data-foot></div></div>
      </div>`;
    bind(root.querySelector('.p-head'), { close: () => h.close() });
    cv = root.querySelector('canvas'); g = cv.getContext('2d');
    tools = root.querySelector('[data-tools]'); foot = root.querySelector('[data-foot]');
    const floors = root.querySelector('[data-floors]');

    const size = () => {
      const plan = root.querySelector('.bld-plan');
      const availW = Math.max(200, plan.clientWidth - 4);
      // from the top of the plan to the bottom of the panel body (less its padding)
      const body = root.querySelector('.p-body'), pad = parseFloat(getComputedStyle(body).paddingBottom) || 0;
      const stacked = getComputedStyle(body).flexDirection === 'column';   // narrow phones scroll instead
      const availH = stacked ? 1e4 : Math.max(160, body.getBoundingClientRect().bottom - pad - cv.getBoundingClientRect().top - 2);
      st.ts = Math.max(14, Math.min(40, Math.floor(Math.min(availW / GW, (availH - 22) / GD))));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = GW * st.ts * dpr; cv.height = (GD * st.ts + 22) * dpr;
      cv.style.width = GW * st.ts + 'px'; cv.style.height = GD * st.ts + 22 + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // ------------------------------------------------------------ drawing
    const draw = () => {
      const ts = st.ts, d = st.d, fl = st.floor, OY = 22;
      g.clearRect(0, 0, GW * ts, GD * ts + OY);
      // the street out front
      g.fillStyle = '#2c2d31'; g.fillRect(0, 0, GW * ts, OY - 4);
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '700 11px Rajdhani, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('STREET', 6, OY / 2 - 2);
      g.fillStyle = '#e8c21a'; for (let x = 54; x < GW * ts; x += 22) g.fillRect(x, OY / 2 - 3, 10, 2);
      g.fillStyle = '#8b8d91'; g.fillRect(0, OY - 4, GW * ts, 4);
      g.save(); g.translate(0, OY);
      g.fillStyle = '#3a4a2c'; g.fillRect(0, 0, GW * ts, GD * ts);
      // the floor below, so you can see where an upper floor can go
      if (fl > 0) for (let y = 0; y < GD; y++) for (let x = 0; x < GW; x++) {
        if (!H.isRoom(H.tileAt(d, fl - 1, x, y))) continue;
        g.fillStyle = 'rgba(200,200,210,0.18)'; g.fillRect(x * ts, y * ts, ts, ts);
      }
      // rooms
      for (let y = 0; y < GD; y++) for (let x = 0; x < GW; x++) {
        const c = H.tileAt(d, fl, x, y);
        if (c === '.') continue;
        g.fillStyle = ROOM_BY_ID[c].c; g.fillRect(x * ts, y * ts, ts, ts);
        if (c === 'P') { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x * ts, y * ts + k * ts / 4); g.lineTo(x * ts + ts, y * ts + k * ts / 4); g.stroke(); } }
      }
      // grid
      g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; g.beginPath();
      for (let x = 1; x < GW; x++) { g.moveTo(x * ts + 0.5, 0); g.lineTo(x * ts + 0.5, GD * ts); }
      for (let y = 1; y < GD; y++) { g.moveTo(0, y * ts + 0.5); g.lineTo(GW * ts, y * ts + 0.5); }
      g.stroke();
      // walls: thick round the outside, thin between rooms
      for (let y = 0; y <= GD; y++) for (let x = 0; x <= GW; x++) {
        const c = H.tileAt(d, fl, x, y), up = H.tileAt(d, fl, x, y - 1), left = H.tileAt(d, fl, x - 1, y);
        const edge = (a, b, hz) => {
          const ra = H.isRoom(a), rb = H.isRoom(b);
          if (ra === rb && (!ra || a === b)) return;
          const outer = ra !== rb;
          g.fillStyle = outer ? d.wall : 'rgba(30,26,22,.9)';
          const t = outer ? Math.max(3, ts * 0.16) : Math.max(1.5, ts * 0.07);
          if (hz) g.fillRect(x * ts - t / 2, y * ts - t / 2, ts + t, t); else g.fillRect(x * ts - t / 2, y * ts - t / 2, t, ts + t);
        };
        if (x < GW) edge(up, c, true);
        if (y < GD) edge(left, c, false);
      }
      // furniture
      const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const furn = (f, alpha = 1) => {
        const fp = H.footprint(f), [fx, fy] = dirs[f.r || 0];
        g.globalAlpha = alpha;
        drawFurniture(g, f.id, f.x * ts, f.y * ts, fp.w * ts, fp.d * ts, fx, fy, ts / 2);
        g.globalAlpha = 1;
      };
      for (const f of (d.furn[fl] || []).filter(f => FURN_BY_ID[f.id].flat)) furn(f);
      for (const f of (d.furn[fl] || []).filter(f => !FURN_BY_ID[f.id].flat)) if (f !== st.move?.f) furn(f);
      if (st.sel) { const fp = H.footprint(st.sel); g.strokeStyle = '#2cff7a'; g.lineWidth = 2; g.strokeRect(st.sel.x * ts + 1, st.sel.y * ts + 1, fp.w * ts - 2, fp.d * ts - 2); }
      if (st.move) {
        const f = { ...st.move.f, x: st.move.x, y: st.move.y }, ok = !H.canPlace(d, fl, f, st.move.f), fp = H.footprint(f);
        furn(f, 0.75);
        g.strokeStyle = ok ? '#2cff7a' : '#ff3346'; g.lineWidth = 2; g.strokeRect(f.x * ts + 1, f.y * ts + 1, fp.w * ts - 2, fp.d * ts - 2);
      }
      // painting a room: the rectangle you're dragging
      if (st.drag) {
        const { x0, y0, x1, y1 } = st.drag;
        g.fillStyle = st.room === '.' ? 'rgba(255,51,70,.35)' : hexA(ROOM_BY_ID[st.room].c, 0.6);
        g.fillRect(Math.min(x0, x1) * ts, Math.min(y0, y1) * ts, (Math.abs(x1 - x0) + 1) * ts, (Math.abs(y1 - y0) + 1) * ts);
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(Math.min(x0, x1) * ts + 1, Math.min(y0, y1) * ts + 1, (Math.abs(x1 - x0) + 1) * ts - 2, (Math.abs(y1 - y0) + 1) * ts - 2);
      }
      // where the next piece would go
      const at = st.hover || (document.activeElement === cv ? st.cur : null);
      if (at && st.mode === 'furn' && !st.move && !st.drag) {
        const f = { id: st.furn, x: at.x, y: at.y, r: st.rot }, fp = H.footprint(f), ok = !H.canPlace(d, fl, f);
        if (!H.furnAt(d, fl, at.x, at.y)) { furn(f, 0.45); g.strokeStyle = ok ? 'rgba(44,255,122,.8)' : 'rgba(255,51,70,.8)'; g.lineWidth = 1.5; g.strokeRect(f.x * ts + 1, f.y * ts + 1, fp.w * ts - 2, fp.d * ts - 2); }
      }
      if (document.activeElement === cv && cv.classList.contains('pad-focus')) { g.strokeStyle = '#ffc21a'; g.lineWidth = 2.5; g.strokeRect(st.cur.x * ts + 1, st.cur.y * ts + 1, ts - 2, ts - 2); }
      g.restore();
    };

    // ------------------------------------------------------------ the tools
    const renderFloors = () => {
      floors.innerHTML = Array.from({ length: MAX_FLOORS }, (_, k) => {
        const has = k < st.d.floors.length && H.roomTiles(st.d, k);
        const can = k === 0 || H.roomTiles(st.d, k - 1);
        return `<button class="btn btn-sm ${st.floor === k ? 'btn-primary' : ''}" data-action="floor" data-f="${k}" ${can ? '' : 'disabled'}>${FLOOR_NAMES[k]}${has ? '' : k ? ' +' : ''}</button>`;
      }).join('');
      bind(floors, { floor: dd => { st.floor = +dd.f; st.sel = null; if (st.floor > 0 && st.room === 'P') st.room = 'B'; refresh(); } });
    };
    const renderTools = () => {
      const m = st.mode;
      const tabs = [['rooms', 'Rooms'], ['furn', 'Furniture'], ['look', 'Colors'], ['plans', 'Starter plans']];
      let body = '';
      if (m === 'rooms') {
        body = `<p class="small muted">Drag across the plan to paint a room. ${st.floor ? 'Upper floors only go over rooms on the floor below.' : 'The porch is open air: no walls, no roof.'}</p><div class="bld-grid">${ROOMS.filter(r => !(st.floor && r.open)).map(r => `<button class="btn btn-sm bld-room ${st.room === r.id ? 'on' : ''}" data-action="room" data-id="${r.id}"><span class="bld-sw" style="background:${r.c}"></span><span>${r.icon} ${esc(r.name)}<small>${fmtMoney(r.price)} a tile</small></span></button>`).join('')}
          <button class="btn btn-sm bld-room ${st.room === '.' ? 'on' : ''}" data-action="room" data-id="."><span class="bld-sw" style="background:repeating-linear-gradient(45deg,#e0192e 0 3px,#222 3px 6px)"></span><span>🧹 Knock it down<small>half back</small></span></button></div>`;
      } else if (m === 'furn') {
        const sel = st.sel && FURN_BY_ID[st.sel.id];
        body = `${sel ? `<div class="li"><div class="grow"><div class="t">${esc(sel.name)}</div><div class="s">Drag it to move it.</div></div><button class="btn btn-sm" data-action="turnsel">↻ Turn</button><button class="btn btn-sm btn-danger" data-action="delsel">Remove</button><button class="btn btn-sm" data-action="unsel">Done</button></div>` : ''}
          <div class="row bld-cats">${FURN_CATS.map(c => `<button class="btn btn-sm ${st.cat === c ? 'btn-primary' : ''}" data-action="cat" data-id="${c}">${c}</button>`).join('')}</div>
          <div class="bld-grid">${FURNITURE.filter(f => f.cat === st.cat).map(f => `<button class="btn btn-sm bld-item ${st.furn === f.id ? 'on' : ''}" data-action="furn" data-id="${f.id}"><canvas width="44" height="44" data-ico="${f.id}"></canvas><span>${esc(f.name)}<small>${fmtMoney(f.price)}${f.room ? ` · ${ROOM_BY_ID[f.room].name.toLowerCase()}` : ''}</small></span></button>`).join('')}</div>
          <div class="row" style="margin-top:6px"><button class="btn btn-sm" data-action="rot">↻ Turn before placing</button><span class="small muted">Tap the plan to place it.</span></div>`;
      } else if (m === 'look') {
        body = `<div class="section-title">Siding</div><div class="row">${WALL_COLORS.map(c => `<button class="swatch ${st.d.wall === c ? 'on' : ''}" style="background:${c}" data-action="wall" data-c="${c}" aria-label="Siding ${c}"></button>`).join('')}</div>
          <div class="section-title">Roof</div><div class="row">${ROOF_COLORS.map(c => `<button class="swatch ${st.d.roof === c ? 'on' : ''}" style="background:${c}" data-action="roof" data-c="${c}" aria-label="Roof ${c}"></button>`).join('')}</div>
          <div class="row" style="margin-top:8px">${ROOF_STYLES.map(([id, label]) => `<button class="btn btn-sm ${st.d.roofStyle === id ? 'btn-primary' : ''}" data-action="style" data-id="${id}">${label}</button>`).join('')}</div>`;
      } else {
        body = `<p class="small muted">Start from one of these and make it yours. It replaces what's on the plan.</p><div class="list">${PRESET_IDS.map(id => { const p = H.fromPreset(id); return `<div class="li"><div class="grow"><div class="t">${esc(PRESETS[id].name)}</div><div class="s">${esc(H.summary(p))} · ${fmtMoney(H.cost(p))}</div></div><button class="btn btn-sm" data-action="preset" data-id="${id}">Use</button></div>`; }).join('')}
          <div class="li"><div class="grow"><div class="t">Empty lot</div><div class="s">Start from nothing.</div></div><button class="btn btn-sm" data-action="blank">Clear</button></div></div>`;
      }
      tools.innerHTML = `<div class="tabs bld-tabs">${tabs.map(([id, label]) => `<button class="${m === id ? 'on' : ''}" data-action="mode" data-id="${id}">${label}</button>`).join('')}</div><div class="bld-body">${body}</div>`;
      tools.querySelectorAll('[data-ico]').forEach(c => { const x = c.getContext('2d'), F = FURN_BY_ID[c.dataset.ico]; const s = 40 / Math.max(F.w, F.d); drawFurniture(x, F.id, 22 - F.w * s / 2, 22 - F.d * s / 2, F.w * s, F.d * s, 0, -1, s / 2); });
      bind(tools, {
        mode: dd => { st.mode = dd.id; st.sel = null; refresh(); },
        room: dd => { st.room = dd.id; refresh(); },
        cat: dd => { st.cat = dd.id; st.furn = FURNITURE.find(f => f.cat === dd.id).id; refresh(); },
        furn: dd => { st.furn = dd.id; st.sel = null; refresh(); },
        rot: () => { st.rot = (st.rot + 1) % 4; draw(); },
        turnsel: () => { if (!H.rotate(st.d, st.floor, st.sel)) toast('No room to turn it there.', 'bad'); refresh(); },
        delsel: () => { H.remove(st.d, st.floor, st.sel); st.sel = null; refresh(); },
        unsel: () => { st.sel = null; refresh(); },
        wall: dd => { st.d.wall = dd.c; refresh(); },
        roof: dd => { st.d.roof = dd.c; refresh(); },
        style: dd => { st.d.roofStyle = dd.id; refresh(); },
        preset: dd => { st.d = H.fromPreset(dd.id); st.floor = 0; st.sel = null; refresh(); },
        blank: () => { st.d = H.blankDesign(); st.floor = 0; st.sel = null; refresh(); },
      });
    };
    const renderFoot = () => {
      const c = H.check(st.d), pr = opts.price ? opts.price(st.d) : null;
      foot.innerHTML = `<div class="bld-sum"><b>${esc(H.summary(st.d))}</b> · comfort ${H.comfort(st.d)} · value ${fmtMoney(H.cost(st.d))}${pr ? ` · <b class="${pr.ok === false ? 'bad' : ''}">${esc(pr.text)}</b>` : ''}</div>
        ${c.errors.map(e => `<div class="small bad">⚠ ${esc(e)}</div>`).join('')}${c.warnings.slice(0, 2).map(e => `<div class="small warn">${esc(e)}</div>`).join('')}
        <div class="row" style="margin-top:6px"><button class="btn btn-sm" data-action="cancel">Cancel</button><button class="btn btn-sm btn-primary" data-action="done" ${c.ok && pr?.ok !== false ? '' : 'disabled'}>${esc(opts.action || 'Build it')}</button></div>`;
      bind(foot, {
        cancel: () => h.close(),
        done: () => { if (opts.done(H.cloneDesign(st.d)) !== false) h.close(); },
      });
    };
    const refresh = () => { renderFloors(); renderTools(); renderFoot(); draw(); };

    // ------------------------------------------------------------ input
    const tileOf = e => {
      const r = cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / st.ts), y = Math.floor((e.clientY - r.top - 22) / st.ts);
      return H.inGrid(x, y) ? { x, y } : null;
    };
    const act = t => {
      // one tap or press: paint a tile, select a piece, or drop a new one
      if (st.mode === 'rooms') { H.paint(st.d, st.floor, t.x, t.y, t.x, t.y, st.room); audio.click(); refresh(); return; }
      if (st.mode !== 'furn') return;
      const f = H.furnAt(st.d, st.floor, t.x, t.y);
      if (f) { st.sel = f; refresh(); return; }
      const r = H.place(st.d, st.floor, st.furn, t.x, t.y, st.rot);
      if (!r.ok) { toast(r.text, 'bad'); audio.error(); return; }
      audio.click(); st.sel = null; refresh();
    };
    cv.addEventListener('pointerdown', e => {
      const t = tileOf(e); if (!t) return;
      cv.setPointerCapture?.(e.pointerId);
      st.cur = t;
      if (st.mode === 'rooms') st.drag = { x0: t.x, y0: t.y, x1: t.x, y1: t.y };
      else if (st.mode === 'furn') {
        const f = H.furnAt(st.d, st.floor, t.x, t.y);
        st.press = { t, f, moved: false };
        if (f) st.move = { f, dx: t.x - f.x, dy: t.y - f.y, x: f.x, y: f.y };
      }
      draw();
    });
    cv.addEventListener('pointermove', e => {
      const t = tileOf(e);
      st.hover = e.pointerType === 'mouse' ? t : null;
      if (t && st.drag) { st.drag.x1 = t.x; st.drag.y1 = t.y; }
      if (t && st.move) { const nx = t.x - st.move.dx, ny = t.y - st.move.dy; if (nx !== st.move.x || ny !== st.move.y) { st.move.x = nx; st.move.y = ny; st.press.moved = true; } }
      draw();
    });
    const up = e => {
      if (st.drag) {
        const { x0, y0, x1, y1 } = st.drag; st.drag = null;
        const n = H.paint(st.d, st.floor, x0, y0, x1, y1, st.room);
        if (!n && st.floor && st.room !== '.') toast('Upper floors only go over rooms on the floor below.', 'info');
        audio.click(); refresh(); return;
      }
      if (st.press) {
        const p = st.press; st.press = null;
        if (st.move && p.moved) {
          const f = st.move.f, x = st.move.x, y = st.move.y; st.move = null;
          if (!H.canPlace(st.d, st.floor, { ...f, x, y }, f)) { f.x = x; f.y = y; audio.click(); st.sel = f; }
          else toast(H.canPlace(st.d, st.floor, { ...f, x, y }, f), 'bad');
          refresh(); return;
        }
        st.move = null;
        if (e.type === 'pointerup') act(p.t);
        else draw();
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { st.hover = null; draw(); });
    // controller: the D-pad moves the cursor (padnav sends padmove), A presses
    cv.addEventListener('padmove', e => {
      const x = st.cur.x + e.detail.dx, y = st.cur.y + e.detail.dy;
      if (!H.inGrid(x, y)) return;            // off the edge: padnav moves on to the tools
      st.cur = { x, y }; e.detail.used = true; draw();
    });
    cv.addEventListener('click', e => { if (e.detail === 0) act(st.cur); });   // a pad press, not a tap
    cv.addEventListener('focus', draw); cv.addEventListener('blur', draw);

    size(); refresh();
    // the panel slides in; measure again once it has settled
    setTimeout(() => { if (cv.isConnected) { size(); draw(); } }, 320);
    const onResize = () => { if (!cv.isConnected) { window.removeEventListener('resize', onResize); return; } size(); draw(); };
    window.addEventListener('resize', onResize);
  }, { cls: 'bld-panel' });
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
