// In-world HUD: clock, money, rep, heat, speedo/tach, fuel, nitrous,
// minimap, prompts, police radio and the current objective.
//
// The top-middle column is the "what's happening" strip: GPS turn-by-turn,
// the story step / job / gig you're on, then texts and GPS / job updates
// that pop in one at a time (pop()). A police radio call rides above it all.

import { BREAKDOWNS } from '../core/upkeep.js';
import { $, el, esc } from './dom.js';
import { game, fmtMoney, gameTimeStr, dayName, tierOf, nextTier, activeCar, tankGallons, dirtyOf } from '../core/state.js';
import { settings } from '../core/save.js';
import { LOCATIONS, districtAt } from '../data/world.js';
import { turfLabel } from '../core/turf.js';
import { currentStep, CHAPTERS } from '../data/story.js';
import { MPH } from '../sim/powertrain.js';
import { input, touch, isTouchDevice } from '../core/input.js';
import { touchUi } from './touch.js';
import { pad } from '../core/gamepad.js';
import { audio } from '../core/audio.js';
import { online } from '../net/online.js';
import { MiniMap } from './minimap.js';
import { carName } from '../data/cars.js';
import { LEGAL_DB } from '../sim/sound.js';
import { PULL_OVER_S } from '../world2d/police.js';
import { masked, ownsMask, disguiseLabel } from '../core/disguise.js';
import { wx, nightShift } from '../core/weather.js';
import { currentStop, stopLabel, timeLeft, fmtLeft } from '../core/missions.js';
import { INJURIES, fmtLeft as fmtHeal } from '../core/health.js';

const setText = (el, t) => { t = String(t); if (el.textContent !== t) el.textContent = t; };
const setWidth = (el, w) => { w = Math.round(parseFloat(w) * 10) / 10 + '%'; if (el.dataset.w !== w) { el.dataset.w = w; el.style.width = w; } };

const HELP = {
  foot: 'ON FOOT — WASD walk · Shift run · E interact · F get in your car · T steal a car · G draw/holster gun · V mask on/off · J/Space/click fire · R reload · P phone · M map · C zoom',
  car: 'DRIVING — W gas · S brake/reverse · A/D steer · Space e-brake · N/Shift nitrous · Q/E shift (manual) · H horn · Enter interact · F get out · P phone',
};
const PAD_HELP = {
  foot: 'ON FOOT — Left stick walk · B run · A use · Y get in · X steal · LT draw/holster · RT fire · RB reload · LB mask · Right stick aim · View phone · ↑ map',
  car: 'DRIVING — RT gas · LT brake/reverse · Left stick steer · A e-brake · X nitrous · RB/LB shift · B use · Y get out · L3 horn · R3 camera · View phone',
};

// turn-by-turn arrows (drawn pointing up = straight ahead)
const NAV_SVG = {
  right: '<path d="M7 21V12a3 3 0 0 1 3-3h7"/><path d="M14 5l4 4-4 4"/>',
  left: '<path d="M17 21V12a3 3 0 0 0-3-3H7"/><path d="M10 5L6 9l4 4"/>',
  uturn: '<path d="M16 21V9a4 4 0 0 0-8 0v4"/><path d="M4 10l4 4 4-4"/>',
  arrive: '<path d="M7 21V4"/><path d="M7 4h11l-3 4 3 4H7"/>',
};
const navDist = (m, kmh) => kmh
  ? (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.max(10, Math.round(m / 10) * 10) + ' m')
  : (m >= 402 ? (m / 1609.34).toFixed(1) + ' mi' : Math.max(10, Math.round(m * 3.28084 / 50) * 50) + ' ft');

const ICON = { home: '⌂', car: '◆', wrench: '⚙', spray: '✦', repair: '✚', gas: '⛽', food: '☕', shirt: '◇', key: '⌘', shield: '★', cross: '✚', tow: '$', oil: '◉', meet: '●', flag: '⚑' };

export class Hud {
  constructor() {
    this.root = $('#hud');
    this.root.innerHTML = `
      <div class="hud-tl">
        <div class="hud-clock"><span data-time></span><small data-day></small></div>
        <div class="hud-place" data-place></div>
        <button class="hud-needs" data-needs aria-label="Food and energy"><span data-nfood>🌮<i><b></b></i></span><span data-nenergy>⚡<i><b></b></i></span></button>
        <button class="hud-online hidden" data-online aria-label="Online players"></button>
        <div class="hud-mini"><canvas width="200" height="200" data-mini></canvas></div>
      </div>
      <div class="hud-tr">
        <div class="hud-money"><span data-cash></span><small data-bank></small></div>
        <div class="hud-rep"><span data-tier></span><div class="bar thin"><div data-repbar></div></div></div>
        <div class="hud-heat" data-heat>${'<i></i>'.repeat(5)}</div>
        <div class="hud-warrant hidden" data-warrant></div>
        <div class="hud-court hidden" data-court></div>
        <div class="hud-court hud-injury hidden" data-injury></div>
        <div class="hud-disguise hidden" data-disguise></div>
        <div class="hud-pursuit hidden" data-pursuit><b data-ptitle></b><div class="bar thin"><div data-pbar></div></div></div>
        <div class="hud-btns"><button class="hud-btn" data-tp="pause" aria-label="Menu">☰</button><button class="hud-btn" data-tp="camera" aria-label="Zoom" title="Zoom (C)">⌕</button><button class="hud-btn" data-tp="view" aria-label="Camera view" title="Third-person / top-down (V)">🎥</button><button class="hud-btn hud-inventory-btn" data-inventory aria-label="Inventory" title="Inventory (I)">🎒</button><button class="hud-btn" data-tp="phone" aria-label="Phone" title="Phone (P)">☎</button></div>
        <div class="hud-dash hidden" data-dash>
        <div class="dash-speed"><b data-speed>0</b><small data-unit>MPH</small></div>
        <div class="dash-gear" data-gear>N</div>
        <div class="dash-tach"><div data-rpm></div><i data-redline></i></div>
        <div class="dash-row" data-fuelrow><span>FUEL</span><div class="bar thin"><div data-fuel></div></div></div>
        <div class="dash-row hidden" data-oilrow><span>OIL</span><div class="bar thin"><div data-oil></div></div></div>
        <div class="dash-row hidden" data-engrow><span>ENG</span><div class="bar thin"><div data-eng></div></div></div>
        <div class="dash-row hidden" data-noiserow><span>NOISE</span><b data-noise>—</b></div>
        <div class="dash-row" data-nosrow><span>NOS</span><div class="bar thin nos"><div data-nos></div></div></div>
        <div class="dash-car" data-carname></div>
      </div>
        <div class="hud-weapon hidden" data-weapon></div>
      </div>
      <div class="hud-top" data-top>
        <div class="hud-radio" data-radio></div>
        <div class="hud-nav hidden" data-nav><svg viewBox="0 0 24 24" data-navicon></svg><div><b data-navdist></b><small data-navstreet></small></div></div>
        <div class="hud-objective hidden" data-obj></div>
        <div class="hud-gig hidden" data-gig></div>
        <div class="hud-pop hidden" data-pop></div>
      </div>
      <div class="hud-pit hidden" data-pit><b>PIT</b><span>POLICE ARE SETTING UP A PIT</span></div>
      <div class="hud-prompt hidden" data-prompt></div>
      <div class="hud-help" data-help></div>
      <div class="hud-hotbar" data-hotbar aria-label="Inventory hotbar"></div>
    `;
    // the HUD's elements never change, so each is looked up once
    const els = new Map();
    this.q = s => { let e = els.get(s); if (!e) { e = this.root.querySelector(`[data-${s}]`); if (e) els.set(s, e); } return e; };
    // only touch the page when a value actually changed: on iPhone every
    // write makes Safari restyle and lay the HUD out again
    this.minimap = new MiniMap(this.q('mini'));
    this.last = 0;
    this.radioLines = [];
    this.pops = [];
    this.helpCtx = null;
    // toasts sit under the top strip, however tall it is right now
    if (typeof ResizeObserver === 'function') new ResizeObserver(([e]) => document.documentElement.style.setProperty('--hudtop', `${Math.round(e.target.getBoundingClientRect().bottom)}px`)).observe(this.q('top'));
    // tap a text banner to read it in Messages
    this.q('pop').addEventListener('pointerdown', async e => {
      if (!this.popCur?.text) return;
      e.preventDefault();
      const { openPhone } = await import('./phone.js'); const { app } = await import('../main.js');
      this.popCur.until = 0; openPhone('messages', app, { onClose: () => {} });
    });
    this.q('online').addEventListener('pointerdown', async e => { e.preventDefault(); const { openOnline } = await import('./online.js'); const { app } = await import('../main.js'); openOnline(app); });
    this.q('needs').addEventListener('pointerdown', async e => { e.preventDefault(); const { openBag } = await import('./needs.js'); const { app } = await import('../main.js'); openBag(app); });
    this.q('inventory').addEventListener('pointerdown', async e => { e.preventDefault(); const { openPhone } = await import('./phone.js'); const { app } = await import('../main.js'); openPhone('inventory', app, { onClose: () => {} }); });
    window.addEventListener('keydown', async e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      if (e.code === 'KeyI') { e.preventDefault(); const { openPhone } = await import('./phone.js'); const { app } = await import('../main.js'); openPhone('inventory', app, { onClose: () => {} }); }
      if (/^Digit[1-5]$/.test(e.code) && !document.querySelector('.panel:not(.hidden), .phone:not(.hidden)')) this.q('hotbar')?.querySelector(`[data-hot="${Number(e.code.slice(-1))-1}"]`)?.click();
    });
    this.root.querySelectorAll('[data-tp]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); touch.press(b.dataset.tp); }));
  }

  renderHotbar() {
    const s = game.s;
    if (!s) return;
    s.inventory ??= { energyDrinks: 0, tacos: 0 };
    const slots = s.inventory.rfgSlots || [];
    const labels = { water:['💧','Water'], energy:['⚡','Energy'], taco:['🌮','Taco'], phone:['📱','Phone'], lockpick:['🗝️','Lockpick'], medkit:['🩹','Med Kit'], loot:['📦','Stolen Goods'] };
    const box = this.q('hotbar');
    if (!box) return;
    const sig = slots.slice(0, 5).map(x => x ? `${x.id}:${x.count}:${x.icon || ''}:${x.label || ''}` : '').join('|');
    if (sig === this.hotSig && s.inventory.rfgSlots === this.hotSlots && box.firstChild) return;
    this.hotSig = sig; this.hotSlots = s.inventory.rfgSlots;
    box.innerHTML = Array.from({length:5},(_,i) => {
      const x = slots[i], d = x ? (labels[x.id] || [x.icon || '📦', x.label || x.id]) : null;
      return '<button class="hud-hot-slot'+(x?'':' empty')+'" data-hot="'+i+'" title="'+(d ? esc(d[1]) : 'Empty')+'"><b>'+(i+1)+'</b>'+(d ? '<span>'+d[0]+'</span><small>'+esc(d[1])+'</small><i>'+(x.count > 1 ? x.count : '')+'</i>' : '<em>+</em>')+'</button>';
    }).join('');
    box.querySelectorAll('[data-hot]').forEach(btn => btn.onclick = () => {
      const i = Number(btn.dataset.hot), x = slots[i];
      if (!x) return;
      if (x.id === 'energy') s.player.energy = Math.min(100,(s.player.energy||0)+30);
      else if (x.id === 'taco') s.player.food = Math.min(100,(s.player.food||0)+30);
      else if (x.id === 'water') s.player.energy = Math.min(100,(s.player.energy||0)+10);
      else return;
      x.count--;
      if (x.count <= 0) slots.splice(i,1);
      if (x.id === 'energy') s.inventory.energyDrinks = Math.max(0,(s.inventory.energyDrinks||0)-1);
      if (x.id === 'taco') s.inventory.tacos = Math.max(0,(s.inventory.tacos||0)-1);
      this.renderHotbar();
    });
  }

  pit(seconds = 1) {
    const box = this.q('pit');
    if (!box) return;
    box.classList.remove('hidden');
    clearTimeout(this.pitTimer);
    this.pitTimer = setTimeout(() => box.classList.add('hidden'), Math.max(650, seconds * 1000));
  }

  // Police radio: one dispatch call at a time, as a single line across the
  // top of the screen. New calls wait their turn; repeats are dropped.
  radio(text) {
    const q = this.radioLines;
    const cur = this.radioCur;
    if ((cur && cur.text === text) || q.some(l => l.text === text)) return;
    q.push({ text });
    if (q.length > 3) q.splice(0, q.length - 3);   // stale calls give way to fresh ones
    this.renderRadio();
  }
  renderRadio() {
    const now = performance.now();
    const cur = this.radioCur;
    if (cur && now < cur.until) return;
    const box = this.q('radio');
    const next = this.radioLines.shift();
    if (!next) {
      if (cur) { this.radioCur = null; box.classList.remove('on'); }
      return;
    }
    // long enough to read: ~2.5s plus a beat per word, capped
    const words = next.text.split(/\s+/).length;
    this.radioCur = { text: next.text, until: now + Math.min(6000, 2500 + words * 220) + (this.radioLines.length ? 0 : 600) };
    audio.radio();
    box.innerHTML = `<b>FWPD</b><span><i>${esc(next.text)}</i></span>`;
    box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
    // too long for one line on this screen: slide it along instead of wrapping
    const sp = box.querySelector('span'), over = sp.scrollWidth - sp.clientWidth;
    if (over > 4) {
      const secs = 1.6 + over / 70;
      sp.classList.add('scroll'); sp.style.setProperty('--scroll', `${-over}px`); sp.style.setProperty('--dur', `${secs + 1.6}s`);
      this.radioCur.until += secs * 1000;
    }
  }

  // Top-middle banner: one at a time, long enough to read, newest last.
  // kind: text (a phone text) · gps · job · good · bad · info
  pop(body, { title = '', icon = '', kind = 'info' } = {}) {
    const q = this.pops, cur = this.popCur;
    if ((cur && cur.body === body && performance.now() < cur.until) || q.some(x => x.body === body)) return;
    q.push({ body, title, icon, kind, text: kind === 'text' });
    if (q.length > 4) q.splice(0, q.length - 4);
    this.renderPop();
  }
  renderPop() {
    const now = performance.now(), cur = this.popCur, box = this.q('pop');
    if (cur && now < cur.until) return;
    const next = this.pops.shift();
    if (!next) { if (cur) { this.popCur = null; box.classList.add('hidden'); } return; }
    const words = (next.title + ' ' + next.body).split(/\s+/).length;
    // a queue behind it: move along a little faster
    next.until = now + Math.min(7000, 2600 + words * 200) * (this.pops.length ? 0.7 : 1);
    this.popCur = next;
    box.className = `hud-pop k-${next.kind}`;
    box.innerHTML = `<span class="pop-ic">${esc(next.icon)}</span><div>${next.title ? `<small>${esc(next.title)}</small>` : ''}<p>${esc(next.body)}</p></div>`;
    void box.offsetWidth; box.classList.add('in');
  }

  update(w) {
    const now = performance.now();
    this.minimap.draw(w, w.playerState());
    this.renderHotbar();   // every frame, so it turns smoothly (it only redraws when something changed)
    if (now - this.last < 66) return;
    this.last = now;
    const s = game.s;
    setText(this.q('time'), gameTimeStr(s.time));
    setText(this.q('day'), `${dayName(s.time)} · Day ${s.time.day} · ${wx(s).icon} ${wx(s).name}${nightShift(s.time) ? ' · 🚓 Night shift' : ''}`);
    const p = w.playerState();
    const street = w.streetAt(p.x, p.z);
    const turf = turfLabel(s, p.x, p.z);
    setText(this.q('place'), `${street ? street + ' · ' : ''}${districtAt(p.x, p.z)}${turf ? ' · ' + turf : ''}`);
    // hunger + energy (core/needs.js)
    for (const [k, v] of [['nfood', s.player.food ?? 100], ['nenergy', s.player.energy ?? 100]]) {
      const n = this.q(k), pct = Math.round(v);
      if (n.dataset.pct === String(pct)) continue;
      n.dataset.pct = pct;
      n.querySelector('b').style.width = pct + '%';
      n.className = pct < 8 ? 'empty' : pct < 25 ? 'low' : '';
    }
    const ob = this.q('online');
    ob.classList.toggle('hidden', !online.active);
    if (online.active) ob.textContent = `🌐 ${online.serverName} · ${online.list().length + 1} online`;
    setText(this.q('cash'), fmtMoney(s.cash));
    const dirty = dirtyOf(s);
    setText(this.q('bank'), [s.bank ? `Bank ${fmtMoney(s.bank)}` : '', dirty ? `💵 ${fmtMoney(dirty)} dirty` : ''].filter(Boolean).join(' · '));
    const t = tierOf(s.rep), nt = nextTier(s.rep);
    setText(this.q('tier'), `${s.rep.toLocaleString()} REP · ${t.name}`);
    setWidth(this.q('repbar'), nt ? `${(s.rep - t.rep) / (nt.rep - t.rep) * 100}%` : '100%');
    const lvl = Math.floor(s.heat);
    this.q('heat').querySelectorAll('i').forEach((n, i) => {
      n.className = i < lvl ? 'on' : i < s.heat ? 'part' : '';
    });
    this.q('heat').classList.toggle('flash', w.police.phase === 'chase');
    const wr = this.q('warrant'), nw = s.warrants?.length || 0;
    wr.classList.toggle('hidden', !nw);
    if (nw) { const fel = s.warrants.some(x => x.felony); wr.textContent = `WARRANT${nw > 1 ? 'S ×' + nw : ''}`; wr.title = fel ? 'Felony warrant' : 'Warrant'; wr.classList.toggle('felony', fel); }
    // your next court date, so you don't miss it
    const cc = s.justice?.cases?.[0], ct = this.q('court'), showCourt = !!cc && !cc.fta && !cc.held;
    ct.classList.toggle('hidden', !showCourt);
    if (showCourt) { const today = cc.date.day === s.time.day; ct.textContent = today ? 'COURT TODAY · 9 AM' : `COURT · DAY ${cc.date.day} 9 AM`; ct.classList.toggle('today', today); }
    // hurt: what's wrong and how long until it heals
    const ij = this.q('injury'), inj = s.health?.injuries || [];
    ij.classList.toggle('hidden', !inj.length);
    if (inj.length) { const j = inj.reduce((a, b) => b.left > a.left ? b : a), d = INJURIES[j.kind], t = `${d?.icon || '✚'} ${(d?.short || 'HURT').toUpperCase()} · ${fmtHeal(j.left).toUpperCase()}${inj.length > 1 ? ` +${inj.length - 1}` : ''}`; if (ij.textContent !== t) ij.textContent = t; }
    // masked on foot: how recognisable you are right now
    const dg = this.q('disguise'), mk = !w.inCar && masked(s.player.look);
    dg.classList.toggle('hidden', !mk);
    if (mk) { const t = `MASKED · ${disguiseLabel(w.police.disguise).toUpperCase()}`; if (dg.textContent !== t) dg.textContent = t; }
    const pp = this.q('pursuit');
    const ph = w.police.phase;
    pp.classList.toggle('hidden', ph === 'none');
    if (ph !== 'none') {
      const stopStep = w.police.stop?.step;
      this.q('ptitle').textContent = ph === 'notice' ? `PULL OVER — ${Math.max(0, Math.ceil(w.police.pullT))}s`
        : ph === 'stop' ? (stopStep === 'walk' ? 'OFFICER WALKING UP' : stopStep === 'ticket' ? 'TAKE THE TICKET' : 'PULLED OVER — STAY PUT')
        : ph === 'chase' ? 'PURSUIT' : ph === 'search' ? 'SEARCHING — LEAVE THE CIRCLE' : 'COOLDOWN — STAY HIDDEN';
      const pct = ph === 'notice' ? Math.max(0, w.police.pullT) / PULL_OVER_S * 100
        : ph === 'cooldown' ? (1 - w.police.cooldown / (14 + w.police.level * 5)) * 100 : ph === 'search' ? 100 - Math.min(100, w.police.unseenT * 5) : 100;
      setWidth(this.q('pbar'), `${pct}%`);
      pp.className = `hud-pursuit ${ph}`;
    }
    // GPS turn-by-turn
    const nav = w.navInfo ? w.navInfo() : null, nb = this.q('nav');
    nb.classList.toggle('hidden', !nav);
    this.root.classList.toggle('nav-on', !!nav);
    if (nav) {
      const kmh = settings.units === 'kmh';
      if (nb.dataset.turn !== nav.turn) { nb.dataset.turn = nav.turn; this.q('navicon').innerHTML = NAV_SVG[nav.turn]; }
      setText(this.q('navdist'), navDist(nav.dist, kmh));
      const what = nav.turn === 'arrive' ? nav.label : nav.street ? `${nav.turn === 'uturn' ? 'U-turn' : 'Turn ' + nav.turn} onto ${nav.street}` : nav.turn === 'uturn' ? 'Make a U-turn' : `Turn ${nav.turn}`;
      setText(this.q('navstreet'), nav.turn === 'arrive' ? what : `${what} · ${navDist(nav.total, kmh)} to go`);
    }
    // objective
    // a texted mission you're on takes the objective slot, with its clock
    const step = s.story.enabled ? currentStep(s.story) : null;
    const job = s.missions?.active, stop = job && currentStop(s);
    const objHtml = job && stop ? `<small>📦 ${esc(job.title)} · <b class="${timeLeft(s) < 5 ? 'bad' : ''}">${fmtLeft(timeLeft(s))}</b></small>${esc(stopLabel(job))}: ${esc(stop.name)}`
      : step ? `<small>${esc(CHAPTERS[s.story.chapter].title)}</small>${esc(step.objective)}` : '';
    if (objHtml !== this.objHtml) { this.objHtml = objHtml; this.q('obj').innerHTML = objHtml; }
    this.q('obj').classList.toggle('hidden', !objHtml);
    this.q('obj').classList.toggle('job', !!job);
    // the gig shift you're on
    const gl = w.gigs?.hudLine(), gb = this.q('gig');
    gb.classList.toggle('hidden', !gl);
    if (gl) { const html = `<small>${esc(gl.title)}</small>${esc(gl.text)}`; if (gb.dataset.h !== html) { gb.dataset.h = html; gb.innerHTML = html; } gb.classList.toggle('late', gl.late); }
    // control hints follow what you're doing: walking or driving
    const ctx = w.inCar || w.boats?.boating ? 'car' : 'foot';
    const dev = pad.inUse ? 'pad' : touchUi.active ? 'touch' : 'keys';
    if (ctx + dev !== this.helpCtx) {
      this.helpCtx = ctx + dev;
      const help = this.q('help');
      help.textContent = dev === 'pad' ? PAD_HELP[ctx] : dev === 'touch' ? '' : HELP[ctx];
      help.classList.remove('fade');
      clearTimeout(this.helpT);
      this.helpT = setTimeout(() => help.classList.add('fade'), 9000);
    }
    // prompt
    const pr = this.q('prompt');
    const parts = [];
    const tch = touchUi.active;
    const gp = pad.inUse;   // controller: Xbox button names
    const pu = w.pullups?.promptHtml(tch);
    if (pu) parts.push(pu);
    const rd = w.rides?.promptHtml(tch);
    if (rd) parts.push(rd);
    const bp = w.boats?.promptHtml(tch);
    if (bp) parts.push(bp);
    const tp = w.trailers?.promptHtml(tch);
    if (tp) parts.push(tp);
    const doorPrompt = w.doors?.promptHtml?.();
    if (doorPrompt) parts.push(doorPrompt);
    if (w.garageHint && !w.nearLoc) parts.push(`<span style="color:#2cff7a">▶</span> ${esc(w.garageHint)}`);
    const cb = w.combat;
    const rp = cb ? cb.robPrompt() : '';
    if (rp) parts.push(`<kbd>${gp ? 'A' : tch ? 'USE' : 'E'}</kbd> <b style="color:#ff5a5a">${esc(rp)}</b>`);
    if (w.nearLoc && !(cb && cb.armed)) parts.push(`<kbd>${gp ? (w.inCar ? 'B' : 'A') : tch ? 'USE' : w.inCar ? 'Enter' : 'E'}</kbd> ${esc(w.nearLoc.name)}`);
    if (w.rides?.riding) { /* the ride prompt covers getting out */ }
    else if (!w.inCar && w.vehicle && Math.hypot(w.vehicle.x - w.foot.x, w.vehicle.z - w.foot.z) < 4.5) parts.push(`<kbd>${gp ? 'Y' : tch ? 'GET IN' : 'F'}</kbd> ${w.vehicle.car.hot ? 'the stolen car' : tch ? 'your car' : 'Get in'}`);
    else if (w.inCar && w.vehicle && w.vehicle.speed < 2) parts.push(`<kbd>${gp ? 'Y' : tch ? 'GET OUT' : 'F'}</kbd> ${tch ? '' : 'Get out'}`);
    const own = w.thefts?.own?.vehicle;
    if (!w.inCar && own && Math.hypot(own.x - w.foot.x, own.z - w.foot.z) < 4.5) parts.push(`<kbd>${gp ? 'Y' : tch ? 'GET IN' : 'F'}</kbd> your car`);
    const sp = w.thefts?.promptText();
    if (sp) parts.push(`<kbd>${gp ? 'X' : tch ? 'STEAL' : 'T'}</kbd> <b style="color:#ff5a5a">${esc(sp)}</b>`);
    const wl = cb && !w.inCar ? cb.hudLine(tch) : '';
    const wq = this.q('weapon');
    if (wq) {
      const hp = cb ? Math.round(cb.arms.hp) : 100, ar = cb ? Math.round(cb.arms.armor * 100) : 0;
      const vit = `${hp < 100 ? `❤ ${hp}` : ''}${hp < 100 && ar ? ' &nbsp;' : ''}${ar ? `🛡 ${ar}%` : ''}`;
      const html = wl ? `${wl}${vit ? `<div class="wp-stat">${vit}</div>` : ''}` : '';
      if (wq.dataset.h !== html) { wq.dataset.h = html; wq.innerHTML = html; }
      wq.classList.toggle('hidden', !html);
    }
    const troot = document.getElementById('touch');
    if (troot) { troot.classList.toggle('armed', !!(cb && cb.armed)); troot.classList.toggle('has-gun', !!(cb && cb.gun && !w.inCar)); troot.classList.toggle('has-mask', !w.inCar && ownsMask(w.s)); troot.classList.toggle('masked', !w.inCar && masked(w.s.player.look)); troot.classList.toggle('can-steal', !!w.thefts?.target); }
    const prompt = parts.join(' &nbsp;·&nbsp; ');
    if (pr.dataset.h !== prompt) { pr.dataset.h = prompt; pr.innerHTML = prompt; } pr.classList.toggle('hidden', !prompt);
    // dash
    const dash = this.q('dash');
    // riding in another player's car: their speedo and tach
    const ride = !w.inCar && w.rides?.riding ? w.rides.peer : null;
    const boat = w.boats?.dash();   // out on the water: knots, and the boat's name
    dash.classList.toggle('hidden', !w.inCar && !ride && !boat);
    this.q('fuelrow').classList.toggle('hidden', !!ride || !!boat);
    if (boat) {
      setText(this.q('speed'), Math.round(boat.speed));
      setText(this.q('unit'), 'KNOTS');
      setText(this.q('gear'), boat.gear);
      setWidth(this.q('rpm'), `${Math.min(100, boat.speed / 0.9)}%`);
      this.q('rpm').classList.remove('hot');
      for (const r of ['oilrow', 'noiserow', 'nosrow']) this.q(r).classList.add('hidden');
      this.q('engrow').classList.toggle('hidden', boat.cond > 70);
      setWidth(this.q('eng'), `${boat.cond}%`);
      setText(this.q('carname'), `⚓ ${boat.name}`);
    } else if (ride) {
      const kmh = settings.units === 'kmh';
      setText(this.q('speed'), Math.round(Math.abs(ride.sp) * (kmh ? 3.6 : MPH)));
      setText(this.q('unit'), kmh ? 'KM/H' : 'MPH');
      setText(this.q('gear'), ride.gear || (Math.abs(ride.sp) < 0.3 ? 'N' : 'D'));
      setWidth(this.q('rpm'), `${Math.min(100, (ride.rpm || 0) * 100)}%`);
      this.q('rpm').classList.toggle('hot', ride.rpm > 0.9);
      for (const r of ['oilrow', 'engrow', 'noiserow', 'nosrow']) this.q(r).classList.add('hidden');
      setText(this.q('carname'), `${ride.name}'s ${ride.model ? carName(ride.model) : 'car'} · passenger`);
    } else if (w.inCar && w.vehicle) {
      const v = w.vehicle;
      const kmh = settings.units === 'kmh';
      setText(this.q('speed'), Math.round(v.speed * (kmh ? 3.6 : MPH)));
      setText(this.q('unit'), kmh ? 'KM/H' : 'MPH');
      const gearTxt = v.rev < 0 ? 'R' : v.sim.shiftT > 0 ? '–' : v.model.asp === 'ev' ? 'D' : String(v.sim.gear + 1);
      setText(this.q('gear'), gearTxt);
      touchUi.setGear(gearTxt);
      const rpmPct = v.model.asp === 'ev' ? v.speed / 70 : v.sim.rpm / v.spec.redline;
      setWidth(this.q('rpm'), `${Math.min(100, rpmPct * 100)}%`);
      this.q('rpm').classList.toggle('hot', rpmPct > 0.9);
      touchUi.setShiftCue(v.rev >= 0 && v.model.asp !== 'ev' && v.sim.shiftT <= 0 && v.sim.gear < v.spec.gears.length - 1 && rpmPct > 0.92);
      setWidth(this.q('fuel'), `${v.car.fuel * 100}%`);
      this.q('fuel').classList.toggle('low', v.car.fuel < 0.15);
      // engine health: shows once the build is hurting it (or it's worn / blown)
      const eh = v.car.engineBlown ? 0 : v.car.cond.engine;
      this.q('engrow').classList.toggle('hidden', !(v.spec.engineRisk > 0 || v.spec.engineNosRisk > 0 || eh < 70) || v.model.asp === 'ev');
      setWidth(this.q('eng'), `${eh}%`);
      this.q('eng').classList.toggle('low', eh < 35);
      // oil life: shows once it's due
      const oil = v.car.oil ?? 100;
      this.q('oilrow').classList.toggle('hidden', !(oil < 30) || v.model.asp === 'ev');
      setWidth(this.q('oil'), `${oil}%`);
      this.q('oil').classList.toggle('low', oil < 12);
      // exhaust noise: only worth showing once the car is loud enough to matter
      const nr = this.q('noiserow'), loud = (w.staticDb || 0) > LEGAL_DB - 8;
      nr.classList.toggle('hidden', !loud);
      if (loud) {
        const nz = this.q('noise'), over = (w.liveDb || 0) > LEGAL_DB;
        nz.textContent = `${Math.round(w.liveDb || 0)} dB${over ? ` · over ${LEGAL_DB}` : ''}${w.police.noiseAtt > 0.15 ? ` · ${w.police.noiseAtt > 0.6 ? '👮 cops hear you' : 'heads turning'}` : ''}`;
        nz.style.color = over ? (w.police.noiseAtt > 0.6 ? '#ff2a3a' : '#ffb020') : '';
      }
      this.q('nosrow').classList.toggle('hidden', !v.spec.nosSecs);
      if (v.spec.nosSecs) setWidth(this.q('nos'), `${v.sim.nos / v.spec.nosSecs * 100}%`);
      const hot = v.car.hot;
      setText(this.q('carname'), `${v.car.year} ${v.model.model}${hot ? (hot.reported ? ' · 🚨 STOLEN' : ' · STOLEN') : ''}${v.car.broken ? ` · 🛠 ${BREAKDOWNS[v.car.broken]?.short || 'BROKEN DOWN'}` : ''}${v.car.cond.tires <= 1 ? ' · FLAT TIRES' : v.car.cond.tires < 20 ? ' · BALD TIRES' : ''}`);
    }
    this.renderRadio();
    this.renderPop();
  }

  show(v) { this.root.classList.toggle('hidden', !v); }
}
