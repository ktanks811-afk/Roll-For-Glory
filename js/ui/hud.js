// In-world HUD: clock, money, rep, heat, speedo/tach, fuel, nitrous,
// minimap, prompts, police radio and the current objective.

import { $, el, esc } from './dom.js';
import { game, fmtMoney, gameTimeStr, dayName, tierOf, nextTier, activeCar, tankGallons } from '../core/state.js';
import { settings } from '../core/save.js';
import { LOCATIONS, districtAt } from '../data/world.js';
import { currentStep, CHAPTERS } from '../data/story.js';
import { MPH } from '../sim/powertrain.js';
import { input, isTouchDevice } from '../core/input.js';
import { audio } from '../core/audio.js';

const ICON = { home: '⌂', car: '◆', wrench: '⚙', spray: '✦', repair: '✚', gas: '⛽', food: '☕', shirt: '◇', key: '⌘', shield: '★', meet: '●', flag: '⚑' };

export class Hud {
  constructor() {
    this.root = $('#hud');
    this.root.innerHTML = `
      <div class="hud-tl">
        <div class="hud-clock"><span data-time></span><small data-day></small></div>
        <div class="hud-place" data-place></div>
        <div class="hud-objective" data-obj></div>
      </div>
      <div class="hud-tr">
        <div class="hud-money"><span data-cash></span><small data-bank></small></div>
        <div class="hud-rep"><span data-tier></span><div class="bar thin"><div data-repbar></div></div></div>
        <div class="hud-heat" data-heat>${'<i></i>'.repeat(5)}</div>
        <div class="hud-pursuit hidden" data-pursuit><b data-ptitle></b><div class="bar thin"><div data-pbar></div></div></div>
      </div>
      <div class="hud-radio" data-radio></div>
      <div class="hud-prompt hidden" data-prompt></div>
      <div class="hud-mini"><canvas width="200" height="200" data-mini></canvas><div class="mini-n">N</div></div>
      <div class="hud-dash hidden" data-dash>
        <div class="dash-speed"><b data-speed>0</b><small data-unit>MPH</small></div>
        <div class="dash-gear" data-gear>N</div>
        <div class="dash-tach"><div data-rpm></div><i data-redline></i></div>
        <div class="dash-row"><span>FUEL</span><div class="bar thin"><div data-fuel></div></div></div>
        <div class="dash-row" data-nosrow><span>NOS</span><div class="bar thin nos"><div data-nos></div></div></div>
        <div class="dash-car" data-carname></div>
      </div>
      <div class="hud-help" data-help></div>
    `;
    this.q = s => this.root.querySelector(`[data-${s}]`);
    this.mini = this.q('mini').getContext('2d');
    this.last = 0;
    this.radioLines = [];
    this.root.querySelector('[data-help]').textContent = isTouchDevice() ? '' : 'WASD drive/walk · F car · E interact · Space e-brake · N/Shift nitrous · Q/E shift (manual) · P phone · M map · C zoom';
    setTimeout(() => this.q('help')?.classList.add('fade'), 12000);
  }

  radio(text) {
    audio.radio();
    this.radioLines.push({ text, t: performance.now() });
    if (this.radioLines.length > 4) this.radioLines.shift();
    this.renderRadio();
  }
  renderRadio() {
    const now = performance.now();
    this.radioLines = this.radioLines.filter(l => now - l.t < 9000);
    this.q('radio').innerHTML = this.radioLines.map(l => `<div><b>PSPD</b> ${esc(l.text)}</div>`).join('');
  }

  update(w) {
    const now = performance.now();
    if (now - this.last < 66) return;
    this.last = now;
    const s = game.s;
    this.q('time').textContent = gameTimeStr(s.time);
    this.q('day').textContent = `${dayName(s.time)} · Day ${s.time.day} · ${s.weather}`;
    const p = w.playerState();
    const street = w.streetAt(p.x, p.z);
    this.q('place').textContent = `${street ? street + ' · ' : ''}${districtAt(p.x, p.z)}`;
    this.q('cash').textContent = fmtMoney(s.cash);
    this.q('bank').textContent = s.bank ? `Bank ${fmtMoney(s.bank)}` : '';
    const t = tierOf(s.rep), nt = nextTier(s.rep);
    this.q('tier').textContent = `${s.rep.toLocaleString()} REP · ${t.name}`;
    this.q('repbar').style.width = nt ? `${(s.rep - t.rep) / (nt.rep - t.rep) * 100}%` : '100%';
    const lvl = Math.floor(s.heat);
    this.q('heat').querySelectorAll('i').forEach((n, i) => {
      n.className = i < lvl ? 'on' : i < s.heat ? 'part' : '';
    });
    this.q('heat').classList.toggle('flash', w.police.phase === 'chase');
    const pp = this.q('pursuit');
    const ph = w.police.phase;
    pp.classList.toggle('hidden', ph === 'none');
    if (ph !== 'none') {
      this.q('ptitle').textContent = ph === 'notice' ? 'PULL OVER' : ph === 'chase' ? 'PURSUIT' : ph === 'search' ? 'SEARCHING — LEAVE THE CIRCLE' : 'COOLDOWN — STAY HIDDEN';
      const pct = ph === 'cooldown' ? (1 - w.police.cooldown / (14 + w.police.level * 5)) * 100 : ph === 'search' ? 100 - Math.min(100, w.police.unseenT * 5) : 100;
      this.q('pbar').style.width = `${pct}%`;
      pp.className = `hud-pursuit ${ph}`;
    }
    // objective
    const step = s.story.enabled ? currentStep(s.story) : null;
    this.q('obj').innerHTML = step ? `<small>${esc(CHAPTERS[s.story.chapter].title)}</small>${esc(step.objective)}` : '';
    this.q('obj').classList.toggle('hidden', !step);
    // prompt
    const pr = this.q('prompt');
    let prompt = '';
    if (w.nearLoc) prompt = `<kbd>E</kbd> ${esc(w.nearLoc.name)}`;
    else if (!w.inCar && w.vehicle && Math.hypot(w.vehicle.x - w.foot.x, w.vehicle.z - w.foot.z) < 4.5) prompt = `<kbd>F</kbd> Get in`;
    pr.innerHTML = prompt; pr.classList.toggle('hidden', !prompt);
    // dash
    const dash = this.q('dash');
    dash.classList.toggle('hidden', !w.inCar);
    if (w.inCar && w.vehicle) {
      const v = w.vehicle;
      const kmh = settings.units === 'kmh';
      this.q('speed').textContent = Math.round(v.speed * (kmh ? 3.6 : MPH));
      this.q('unit').textContent = kmh ? 'KM/H' : 'MPH';
      this.q('gear').textContent = v.rev < 0 ? 'R' : v.sim.shiftT > 0 ? '–' : v.model.asp === 'ev' ? 'D' : String(v.sim.gear + 1);
      const rpmPct = v.model.asp === 'ev' ? v.speed / 70 : v.sim.rpm / v.spec.redline;
      this.q('rpm').style.width = `${Math.min(100, rpmPct * 100)}%`;
      this.q('rpm').classList.toggle('hot', rpmPct > 0.9);
      this.q('fuel').style.width = `${v.car.fuel * 100}%`;
      this.q('fuel').classList.toggle('low', v.car.fuel < 0.15);
      this.q('nosrow').classList.toggle('hidden', !v.spec.nosSecs);
      if (v.spec.nosSecs) this.q('nos').style.width = `${v.sim.nos / v.spec.nosSecs * 100}%`;
      this.q('carname').textContent = `${v.car.year} ${v.model.model}${v.car.cond.tires <= 1 ? ' · FLAT TIRES' : ''}`;
    }
    this.renderRadio();
    this.drawMinimap(w, p);
  }

  drawMinimap(w, p) {
    const g = this.mini, S = 200;
    const ov = w.map.overview;
    const scale = 0.5;                // px per metre on the minimap
    const span = S / scale;           // metres across
    g.save();
    g.fillStyle = '#0c0d10'; g.fillRect(0, 0, S, S);
    const sx = (p.x - span / 2 - ov.x0) * ov.scale, sz = (p.z - span / 2 - ov.z0) * ov.scale;
    g.imageSmoothingEnabled = true;
    g.drawImage(ov.canvas, sx, sz, span * ov.scale, span * ov.scale, 0, 0, S, S);
    const m = (x, z) => [(x - p.x) * scale + S / 2, (z - p.z) * scale + S / 2];
    // gps
    if (w.gpsPath && game.s.gps) {
      g.strokeStyle = '#ff2a3a'; g.lineWidth = 3; g.beginPath();
      w.gpsPath.forEach(([x, z], i) => { const [a, b] = m(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
    }
    // places
    g.font = '11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of LOCATIONS) {
      const [a, b] = m(l.x, l.z);
      if (a < -8 || a > S + 8 || b < -8 || b > S + 8) continue;
      g.fillStyle = l.color; g.beginPath(); g.arc(a, b, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.fillText(ICON[l.icon] || '•', a, b + 1);
    }
    // cops
    for (const u of [...w.police.units, ...w.police.patrols]) {
      const [a, b] = m(u.x, u.z);
      g.fillStyle = performance.now() % 400 < 200 ? '#ff2a3a' : '#2a6bff';
      g.fillRect(a - 3, b - 3, 6, 6);
    }
    if (w.police.lastSeen && (w.police.phase === 'search' || w.police.phase === 'cooldown')) {
      const [a, b] = m(w.police.lastSeen.x, w.police.lastSeen.z);
      g.strokeStyle = w.police.phase === 'cooldown' ? '#ffc800' : '#ff2a3a'; g.lineWidth = 2;
      g.beginPath(); g.arc(a, b, w.police.searchR * scale, 0, Math.PI * 2); g.stroke();
    }
    // your parked car
    if (w.vehicle && !w.inCar) { const [a, b] = m(w.vehicle.x, w.vehicle.z); g.fillStyle = '#4af'; g.fillRect(a - 3, b - 3, 6, 6); }
    // player arrow
    g.translate(S / 2, S / 2); g.rotate(p.h);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  show(v) { this.root.classList.toggle('hidden', !v); }
}
