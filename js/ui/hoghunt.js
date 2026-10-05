// The hog lease on the Nolan River: pick a ground and your dogs, then hunt.
// The hunt itself is a top-down canvas: tap where you want to walk, follow
// the bark to the bay, turn the catch dogs loose, tie off the hog. Works
// with touch, the mouse and WASD. Rules: core/hoghunt.js.

import { openPanel, bind, esc, toast, confirm, closePanel } from './dom.js';
import { game, fmtMoney, spend, tierOf } from '../core/state.js';
import { HUNT_GROUNDS, GROUND_BY_ID, HOGS, MAX_BAY, MAX_CATCH, HUNT_GAME_MIN, HUNT_SECONDS } from '../data/dogs.js';
import * as DG from '../core/dogs.js';
import * as HH from '../core/hoghunt.js';
import { dogImg, hydrateDogs } from '../gfx2d/dogArt.js';
import { advanceTime } from './garage.js';
import { saveGame } from '../core/save.js';
import { audio } from '../core/audio.js';
import { buzz } from './haptics.js';
import { openKennel } from './kennel.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
let sel = null;     // the last pick, kept between hunts
let current = null;
export const activeHunt = () => current;   // for the smoke test

// ---------------------------------------------------------------- setup
export function openHogLease(loc, app) {
  const s = game.s, k = DG.ensureKennel(s);
  const ready = HH.huntReady(s);
  if (!sel || ![...sel.bay, ...sel.ctch].every(id => ready.some(d => d.id === id))) sel = { ground: sel?.ground || 'nolan', ...HH.autoPick(s) };
  openPanel((root, h) => {
    const tier = tierOf(s.rep).n, g = GROUND_BY_ID[sel.ground];
    const pick = (role, d) => {
      const list = role === 'bay' ? sel.bay : sel.ctch, other = role === 'bay' ? sel.ctch : sel.bay;
      const on = list.includes(d.id), ok = HH.readyToHunt(d);
      return `<button class="dpick ${on ? 'on' : ''}" data-action="pick" data-role="${role}" data-id="${esc(d.id)}" ${!ok || other.includes(d.id) ? 'disabled' : ''}>
        ${dogImg(d, 110)}<b>${esc(d.name)}</b><span>${role === 'bay' ? `Bay ${Math.round(DG.bayScore(d))}` : `Catch ${Math.round(DG.catchScore(d))}`}</span><span class="muted">${ok ? 'Ready' : d.age < 12 ? 'Pup' : d.health < 40 ? 'Hurt' : 'Tired'}</span></button>`;
    };
    const adults = k.dogs.filter(d => d.age >= 12);
    root.innerHTML = head(loc.name, 'Hog hunting · Johnson County') + `<div class="p-body" style="max-width:900px">
      <p class="muted small">Feral hogs tear up every pasture in the county. Ranchers let you on for a day fee and the processor in Joshua pays by the pound. Bay dogs find them and hold them; catch dogs take hold; you tie them off.</p>
      <div class="section-title">Where</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${HUNT_GROUNDS.map(x => {
        const locked = !DG.groundOpen(s, x);
        return `<div class="card click ${sel.ground === x.id ? 'pickd' : ''}" data-action="ground" data-id="${x.id}" ${locked ? 'aria-disabled="true"' : ''}><h3>${esc(x.name)}</h3><p class="muted small">${esc(x.desc)}</p>
          <div class="small">${x.hogs.map(([kk]) => HOGS[kk].name).join(', ')}</div><div class="row" style="justify-content:space-between;margin-top:6px"><b>${x.fee ? fmtMoney(x.fee) : 'Free'}</b>${locked ? `<span class="tag">Tier ${x.tier}</span>` : ''}</div></div>`;
      }).join('')}</div>
      ${adults.length ? `<div class="section-title">Bay dogs <span class="muted small">${sel.bay.length} / ${MAX_BAY}</span></div><div class="dpicks">${adults.map(d => pick('bay', d)).join('')}</div>
        <div class="section-title">Catch dogs <span class="muted small">${sel.ctch.length} / ${MAX_CATCH}</span></div><div class="dpicks">${adults.map(d => pick('catch', d)).join('')}</div>`
        : `<div class="empty">You need grown dogs to hunt. Cross Timbers Hog Dogs sells them, just up FM 4.</div>`}
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-primary" data-action="go" ${sel.bay.length ? '' : 'disabled'}>Turn out the dogs${g.fee ? ` · ${fmtMoney(g.fee)}` : ''}</button><button class="btn" data-action="kennel">🐕 Kennel</button></div>
      <p class="small muted">The hunt runs about ${Math.round(HUNT_SECONDS / 60)} minutes and burns ${HUNT_GAME_MIN / 60} game hours. Tap the map to walk. Catch dogs stay at your heel until you turn them loose, so get close to the bay first. Tusks cut; a cut vest helps.</p></div>`;
    bind(root, {
      close: () => h.close(),
      ground: d => { const x = GROUND_BY_ID[d.id]; if (!DG.groundOpen(s, x)) { toast(`That ranch wants a bigger name first (tier ${x.tier}).`, 'bad'); return; } sel.ground = d.id; h.refresh(); },
      pick: d => {
        const list = d.role === 'bay' ? sel.bay : sel.ctch, max = d.role === 'bay' ? MAX_BAY : MAX_CATCH, i = list.indexOf(d.id);
        if (i >= 0) list.splice(i, 1); else if (list.length < max) list.push(d.id); else { toast(`${max} ${d.role === 'bay' ? 'bay' : 'catch'} dogs at most.`, 'info'); return; }
        h.refresh();
      },
      kennel: () => openKennel(app),
      go: () => {
        if (g.fee && !spend(s, g.fee, `Day lease: ${g.name}`)) return;
        const r = HH.startHunt(s, sel.ground, sel.bay, sel.ctch);
        if (!r.ok) { toast(r.text, 'bad'); return; }
        h.close();
        playHunt(app, r.hunt);
      },
    });
    hydrateDogs(root, k.dogs);
  });
}

// ---------------------------------------------------------------- the hunt
export function playHunt(app, hunt) {
  const s = game.s;
  current = hunt;
  let raf = 0, last = 0, hudT = 0, seen = 0, done = false, view = null;
  const keys = new Set();
  const onKey = e => { const c = e.code; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) { if (e.type === 'keydown') keys.add(c); else keys.delete(c); e.preventDefault(); } if (e.type === 'keydown' && c === 'KeyE') act(); };
  const finish = () => { if (done) return; done = true; HH.endHunt(hunt, 'done'); const sum = HH.settleHunt(s, hunt); advanceTime(s, HUNT_GAME_MIN); saveGame('auto', true); return sum; };
  // the one context button: tie, turn loose, or nothing
  const act = () => {
    if (HH.tie(hunt)) { audio.squeal(); buzz(30); return; }
    if (HH.release(hunt)) { audio.bark(1.2); buzz(15); }
  };
  const handle = openPanel((root, h) => {
    if (hunt.settled) { results(root, h, hunt.settled, app); return; }
    root.innerHTML = `<div class="hunt">
      <canvas class="hunt-cv"></canvas>
      <div class="hunt-top"><button class="btn btn-sm" data-action="leave">Load up</button><div class="hunt-hud"><b data-ht>4:00</b><span data-hb>0 hogs</span></div></div>
      <div class="hunt-log" data-hl></div>
      <div class="hunt-acts"><button class="btn btn-primary hunt-act" data-action="act" disabled>Follow the bark</button></div></div>`;
    const cv = root.querySelector('canvas');
    // tap or click to walk there
    cv.addEventListener('pointerdown', e => {
      if (!view) return;
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      HH.walkTo(hunt, view.x0 + px / view.sc, view.y0 + py / view.sc);
      hunt.tap = { x: hunt.player.tx, y: hunt.player.ty, t: 0.6 };
    });
    bind(root, {
      act,
      leave: async () => { if (await confirm('Load up?', `<p>Call the dogs in and head home${hunt.bag.length ? ` with ${hunt.bag.length} hog${hunt.bag.length > 1 ? 's' : ''}` : ''}. Anything still bayed gets away.</p>`, 'Load up')) { finish(); raf = -1; h.refresh(); } },
    });
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }, { cls: 'hunt-panel', back: false, onClose: () => { cancelAnimationFrame(raf); raf = -1; removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); if (!done) finish(); } });
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);

  function loop(now) {
    if (raf === -1) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!hunt.over) {
      if (keys.size) {
        const P = hunt.player, dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
        if (dx || dy) HH.walkTo(hunt, P.x + dx * 4, P.y + dy * 4);
      }
      for (let t = 0; t < dt; t += 0.025) HH.step(hunt, Math.min(0.025, dt - t));
      if (hunt.events.length > seen) {
        for (const e of hunt.events.slice(seen)) { if (e.kind === 'good') { audio.bark(); buzz(20); } else if (e.kind === 'go') audio.bark(1.2); }
        seen = hunt.events.length;
      }
      if (hunt.over) { finish(); handle.refresh(); raf = -1; return; }
    }
    if (hunt.tap) { hunt.tap.t -= dt; if (hunt.tap.t <= 0) hunt.tap = null; }
    const root = handle.inner, cv = root.querySelector('.hunt-cv');
    if (cv) {
      view = draw(cv, hunt, now / 1000);
      hudT -= dt;
      if (hudT <= 0) { hudT = 0.2; hud(root, hunt); }
    }
    raf = requestAnimationFrame(loop);
  }
}

function hud(root, h) {
  const left = Math.ceil(HH.timeLeft(h)), $ = q => root.querySelector(q);
  $('[data-ht]').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('[data-hb]').textContent = `${h.bag.length} hog${h.bag.length === 1 ? '' : 's'} · ${HH.baying(h).length ? '🔊 bayed!' : h.hogs.some(g => g.state === 'run' && g.seen) ? 'running one' : 'dogs out'}`;
  $('[data-hl]').innerHTML = h.events.slice(-3).map(e => `<div class="${e.kind === 'bad' ? 'bad' : e.kind === 'good' || e.kind === 'tie' ? 'good' : ''}">${esc(e.text)}</div>`).join('');
  const b = $('.hunt-act'), tie = HH.tieTarget(h), rel = HH.canRelease(h), caught = h.hogs.find(g => g.state === 'caught');
  b.disabled = !(tie || rel);
  b.textContent = tie ? '🪢 Tie it off' : rel ? '🐕 Turn loose the catch dogs' : caught ? 'Walk up to the catch' : HH.baying(h).length ? 'Get closer to the bay' : h.dogs.some(d => d.role === 'catch' && d.state === 'heel') ? 'Follow the bark' : 'Catch dogs are out';
  b.classList.toggle('pulse', !b.disabled);
}

// ---------------------------------------------------------------- drawing
function draw(cv, h, now) {
  const dpr = Math.min(2, devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  // the whole lease if it fits, otherwise follow the hunter
  const sc = Math.max(Math.min(cw / HH.W, ch / HH.H), Math.min(cw, ch) / 62), big = sc * 1.8;   // animals drawn larger than life so you can see them on a phone
  const vw = cw / sc, vh = ch / sc, P = h.player;
  const x0 = vw >= HH.W ? (HH.W - vw) / 2 : Math.max(0, Math.min(HH.W - vw, P.x - vw / 2));
  const y0 = vh >= HH.H ? (HH.H - vh) / 2 : Math.max(0, Math.min(HH.H - vh, P.y - vh / 2));
  const X = v => (v - x0) * sc, Y = v => (v - y0) * sc;
  x.fillStyle = '#1b2414'; x.fillRect(0, 0, cw, ch);
  x.fillStyle = '#3a5226'; x.fillRect(X(0), Y(0), HH.W * sc, HH.H * sc);
  // mottled ground
  const r = mulberry(h.seed);
  for (let i = 0; i < 160; i++) { x.fillStyle = i % 3 ? 'rgba(90,70,40,.18)' : 'rgba(30,50,20,.25)'; x.beginPath(); x.arc(X(r() * HH.W), Y(r() * HH.H), (2 + r() * 6) * sc, 0, 7); x.fill(); }
  // the creek
  x.strokeStyle = '#3b6a7a'; x.lineWidth = 4 * sc; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); h.creek.forEach(([a, b], i) => i ? x.lineTo(X(a), Y(b)) : x.moveTo(X(a), Y(b))); x.stroke();
  x.strokeStyle = 'rgba(160,200,210,.35)'; x.lineWidth = 1.2 * sc; x.stroke();
  // the ranch road and your truck
  x.fillStyle = '#7a6a4e'; x.fillRect(X(0), Y(0), 8 * sc, HH.H * sc);
  x.save(); x.translate(X(h.truck.x - 4), Y(h.truck.y)); x.fillStyle = '#9a1c1c'; x.fillRect(-2.2 * sc, -5 * sc, 4.4 * sc, 10 * sc); x.fillStyle = '#222'; x.fillRect(-1.9 * sc, -4.2 * sc, 3.8 * sc, 2.6 * sc); x.fillStyle = '#5a5248'; x.fillRect(-1.9 * sc, 0.5 * sc, 3.8 * sc, 4 * sc); x.restore();
  // brush and timber over the ground
  for (const c of h.cover) {
    x.fillStyle = c.kind === 'tree' ? 'rgba(22,40,18,.92)' : 'rgba(64,88,34,.85)';
    x.beginPath(); x.arc(X(c.x), Y(c.y), c.r * sc, 0, 7); x.fill();
    if (c.kind === 'tree') { x.fillStyle = 'rgba(60,90,40,.5)'; x.beginPath(); x.arc(X(c.x - c.r * 0.25), Y(c.y - c.r * 0.25), c.r * 0.55 * sc, 0, 7); x.fill(); }
  }
  // hogs you know about
  for (const g of h.hogs) {
    if (g.state === 'gone' || g.state === 'tied' || (!g.seen && g.state === 'hidden')) continue;
    hog(x, X(g.x), Y(g.y), g.h, big, g);
  }
  // the dogs: close by, baying (you hear them), or on a tracking collar
  for (const d of h.dogs) {
    const near = Math.hypot(d.x - P.x, d.y - P.y) < 55, loud = d.state === 'bay' || d.state === 'hold';
    if (!near && !loud && !h.collar && d.state !== 'heel') continue;
    if (d.bark > 0.35 || (d.state === 'hold' && Math.sin(now * 9) > 0.6)) { x.strokeStyle = 'rgba(255,230,120,.7)'; x.lineWidth = 1.5; x.beginPath(); x.arc(X(d.x), Y(d.y), (2 + (0.9 - d.bark) * 6) * sc, 0, 7); x.stroke(); }
    dog(x, X(d.x), Y(d.y), d.h, big, d);
    if (sc > 4 || d.state === 'bay') { x.fillStyle = '#fff'; x.font = `600 ${Math.min(14, Math.max(10, sc))}px sans-serif`; x.textAlign = 'center'; x.fillText(d.name.split(' ')[0], X(d.x), Y(d.y) - 1.8 * big); }
  }
  // you
  if (h.tap) { x.strokeStyle = `rgba(255,255,255,${h.tap.t})`; x.lineWidth = 2; x.beginPath(); x.arc(X(h.tap.x), Y(h.tap.y), (3 - h.tap.t * 2) * sc, 0, 7); x.stroke(); }
  x.save(); x.translate(X(P.x), Y(P.y)); x.rotate(P.h + Math.PI / 2); x.scale(1.6, 1.6);
  x.fillStyle = '#e8641a'; x.beginPath(); x.ellipse(0, 0, 0.75 * sc, 0.5 * sc, 0, 0, 7); x.fill();
  x.fillStyle = '#6a4a2a'; x.beginPath(); x.arc(0, 0, 0.42 * sc, 0, 7); x.fill();
  x.strokeStyle = '#3a2a1a'; x.lineWidth = Math.max(1, 0.18 * sc); x.beginPath(); x.moveTo(0.4 * sc, -0.2 * sc); x.lineTo(0.4 * sc, -1.6 * sc); x.stroke();
  x.restore();
  // night-ish edges, and arrows to anything bayed off screen
  const gr = x.createRadialGradient(X(P.x), Y(P.y), 25 * sc, X(P.x), Y(P.y), 80 * sc);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = gr; x.fillRect(0, 0, cw, ch);
  for (const g of HH.baying(h)) {
    const gx = X(g.x), gy = Y(g.y);
    if (gx > 10 && gx < cw - 10 && gy > 60 && gy < ch - 70) continue;
    const a = Math.atan2(gy - ch / 2, gx - cw / 2), ex = Math.max(24, Math.min(cw - 24, cw / 2 + Math.cos(a) * cw)), ey = Math.max(70, Math.min(ch - 80, ch / 2 + Math.sin(a) * ch));
    x.save(); x.translate(ex, ey); x.rotate(a); x.fillStyle = '#ffd34a'; x.beginPath(); x.moveTo(14, 0); x.lineTo(-8, -9); x.lineTo(-8, 9); x.closePath(); x.fill(); x.restore();
    x.fillStyle = '#ffd34a'; x.font = '700 11px sans-serif'; x.textAlign = 'center'; x.fillText('BAY', ex, ey + 22);
  }
  return { x0, y0, sc };
}
function hog(x, px, py, a, sc, g) {
  const H = HOGS[g.kind], L = 0.7 + g.w / 380, Wd = L * 0.45;
  x.save(); x.translate(px, py); x.rotate(a);
  x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(0.2 * sc, 0.3 * sc, L * sc, Wd * sc, 0, 0, 7); x.fill();
  x.fillStyle = H.color; x.beginPath(); x.ellipse(0, 0, L * sc, Wd * sc, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(L * 0.95 * sc, 0, L * 0.38 * sc, Wd * 0.62 * sc, 0, 0, 7); x.fill();
  if (H.spots) { x.fillStyle = H.spots; for (const [u, v, rr] of [[-0.3, 0.1, 0.22], [0.2, -0.15, 0.18], [-0.05, 0.25, 0.14]]) { x.beginPath(); x.arc(u * L * sc, v * L * sc, rr * L * sc, 0, 7); x.fill(); } }
  x.strokeStyle = '#eee6d0'; x.lineWidth = Math.max(1, 0.1 * sc);
  x.beginPath(); x.moveTo(L * 1.15 * sc, -Wd * 0.4 * sc); x.lineTo(L * 1.35 * sc, -Wd * 0.75 * sc); x.moveTo(L * 1.15 * sc, Wd * 0.4 * sc); x.lineTo(L * 1.35 * sc, Wd * 0.75 * sc); x.stroke();
  if (g.state === 'caught') { x.strokeStyle = '#ffd34a'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, (L + 0.8) * sc, 0, 7); x.stroke(); }
  x.restore();
}
function dog(x, px, py, a, sc, d) {
  const ph = DG.phenotype(d.d.genes), L = 0.45 + d.d.kg / 120, Wd = L * 0.4;
  const legs = Math.sin((d.step || 0) * 2.2) * 0.15 * L;
  x.save(); x.translate(px, py); x.rotate(a);
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(0.15 * sc, 0.2 * sc, L * sc, Wd * sc, 0, 0, 7); x.fill();
  const body = ph.white === 'extreme' || ph.white === 'heavy' ? ph.white2 : ph.baseHex;
  x.fillStyle = body; x.beginPath(); x.ellipse(0, 0, L * sc, Wd * sc, 0, 0, 7); x.fill();
  if (ph.white === 'piebald') { x.fillStyle = ph.white2; x.beginPath(); x.ellipse(-L * 0.25 * sc, 0, L * 0.35 * sc, Wd * 0.8 * sc, 0, 0, 7); x.fill(); }
  if (ph.pat === 'tan' || ph.pat === 'masked') { x.fillStyle = ph.pat === 'tan' ? '#b07a3a' : ph.euHex; x.beginPath(); x.arc(L * 1.05 * sc, 0, Wd * 0.75 * sc, 0, 7); x.fill(); }
  x.fillStyle = ph.pat === 'tan' ? ph.euHex : body; x.beginPath(); x.arc(L * 0.95 * sc, 0, Wd * 0.9 * sc, 0, 7); x.fill();
  x.fillStyle = ph.euHex; x.fillRect((L * 0.9) * sc, -Wd * 1.0 * sc, 0.2 * sc, 0.25 * sc); x.fillRect((L * 0.9) * sc, Wd * 0.75 * sc, 0.2 * sc, 0.25 * sc);
  x.strokeStyle = body; x.lineWidth = Math.max(1, 0.12 * sc); x.beginPath(); x.moveTo(-L * sc, 0); x.lineTo((-L - 0.4) * sc, legs * sc * 2); x.stroke();
  if (d.role === 'catch') { x.strokeStyle = d.state === 'heel' ? '#e0192e' : '#ffb020'; x.lineWidth = Math.max(1, 0.12 * sc); x.beginPath(); x.arc(L * 0.6 * sc, 0, Wd * 0.95 * sc, -1.2, 1.2); x.stroke(); }
  if (d.state === 'hurt') { x.fillStyle = '#e0192e'; x.beginPath(); x.arc(0, 0, 0.2 * sc, 0, 7); x.fill(); }
  x.restore();
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- results
function results(root, h, sum, app) {
  const s = game.s, k = DG.ensureKennel(s);
  root.innerHTML = head('Back at the truck', `${esc(sum.ground.name)} · ${sum.hogs.length} hog${sum.hogs.length === 1 ? '' : 's'}`) + `<div class="p-body" style="max-width:760px">
    <div class="stats-row"><div><div class="stat-lbl">Hogs</div><b>${sum.hogs.length}</b></div><div><div class="stat-lbl">Processor paid</div><b class="good">${fmtMoney(sum.pay)}</b></div><div><div class="stat-lbl">Biggest ever</div><b>${k.st.best ? `${k.st.best} lb` : '—'}</b></div></div>
    ${sum.hogs.length ? `<div class="section-title">In the box</div><div class="list">${sum.hogs.map(b => `<div class="li"><span style="font-size:20px">🐗</span><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${b.w} lb${HOGS[b.kind].rar >= 3 ? ' · trophy' : ''}</div></div><b class="good">${fmtMoney(b.value)}</b></div>`).join('')}</div>` : `<p class="muted">${esc(sum.text)}</p>`}
    <div class="section-title">The dogs</div>
    <div class="list">${sum.dogs.map(d => { const dog = k.dogs.find(x => x.id === d.id); return `<div class="li"><span class="mini">${dog ? dogImg(dog, 90) : ''}</span><div class="grow"><div class="t">${esc(d.name)} <span class="muted small">${d.role === 'bay' ? 'bay' : 'catch'}</span></div>
      <div class="s">${d.bays ? `${d.bays} bay${d.bays > 1 ? 's' : ''} · ` : ''}${d.catches ? `${d.catches} catch${d.catches > 1 ? 'es' : ''} · ` : ''}${d.hurt ? `<span class="bad">cut up (−${d.hurt})</span> · ` : ''}health ${d.health}${d.ups.length ? ` · <span class="good">+1 ${d.ups.join(', +1 ')}</span>` : ''}</div></div></div>`; }).join('')}</div>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn btn-primary" data-action="close">Head out</button><button class="btn" data-action="kennel">🐕 Kennel</button></div>
    <p class="small muted">${HUNT_GAME_MIN / 60} hours went by. Hurt dogs heal overnight, or see the vet from their profile.</p></div>`;
  bind(root, { close: () => closePanel(h), kennel: () => { closePanel(h); openKennel(app); } });
  hydrateDogs(root, k.dogs);
}
