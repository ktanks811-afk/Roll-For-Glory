// In-world HUD: clock, money, rep, heat, speedo/tach, fuel, nitrous,
// minimap, prompts, police radio and the current objective.

import { $, el, esc } from './dom.js';
import { game, fmtMoney, gameTimeStr, dayName, tierOf, nextTier, activeCar, tankGallons } from '../core/state.js';
import { settings } from '../core/save.js';
import { LOCATIONS, districtAt } from '../data/world.js';
import { currentStep, CHAPTERS } from '../data/story.js';
import { MPH } from '../sim/powertrain.js';
import { input, touch, isTouchDevice } from '../core/input.js';
import { touchUi } from './touch.js';
import { audio } from '../core/audio.js';
import { online } from '../net/online.js';
import { MiniMap } from './minimap.js';
import { LEGAL_DB } from '../sim/sound.js';

const HELP = {
  foot: 'ON FOOT — WASD walk · Shift run · E interact · F get in your car · G draw/holster gun · J/Space/click fire · R reload · P phone · M map · C zoom',
  car: 'DRIVING — W gas · S brake/reverse · A/D steer · Space e-brake · N/Shift nitrous · Q/E shift (manual) · H horn · Enter interact · F get out · P phone',
};

const ICON = { home: '⌂', car: '◆', wrench: '⚙', spray: '✦', repair: '✚', gas: '⛽', food: '☕', shirt: '◇', key: '⌘', shield: '★', meet: '●', flag: '⚑' };

export class Hud {
  constructor() {
    this.root = $('#hud');
    this.root.innerHTML = `
      <div class="hud-tl">
        <div class="hud-clock"><span data-time></span><small data-day></small></div>
        <div class="hud-place" data-place></div>
        <button class="hud-online hidden" data-online aria-label="Online players"></button>
        <div class="hud-objective" data-obj></div>
        <div class="hud-mini"><canvas width="200" height="200" data-mini></canvas><div class="mini-n">N</div></div>
      </div>
      <div class="hud-tr">
        <div class="hud-money"><span data-cash></span><small data-bank></small></div>
        <div class="hud-rep"><span data-tier></span><div class="bar thin"><div data-repbar></div></div></div>
        <div class="hud-heat" data-heat>${'<i></i>'.repeat(5)}</div>
        <div class="hud-pursuit hidden" data-pursuit><b data-ptitle></b><div class="bar thin"><div data-pbar></div></div></div>
        <div class="hud-btns"><button class="hud-btn" data-tp="pause" aria-label="Menu">☰</button><button class="hud-btn" data-tp="camera" aria-label="Zoom">⌕</button><button class="hud-btn" data-tp="view" aria-label="Camera view">🎥</button><button class="hud-btn" data-tp="phone" aria-label="Phone">☎</button></div>
        <div class="hud-dash hidden" data-dash>
        <div class="dash-speed"><b data-speed>0</b><small data-unit>MPH</small></div>
        <div class="dash-gear" data-gear>N</div>
        <div class="dash-tach"><div data-rpm></div><i data-redline></i></div>
        <div class="dash-row"><span>FUEL</span><div class="bar thin"><div data-fuel></div></div></div>
        <div class="dash-row hidden" data-noiserow><span>NOISE</span><b data-noise>—</b></div>
        <div class="dash-row" data-nosrow><span>NOS</span><div class="bar thin nos"><div data-nos></div></div></div>
        <div class="dash-car" data-carname></div>
      </div>
      </div>
      <div class="hud-radio" data-radio></div>
      <div class="hud-weapon hidden" data-weapon></div>
      <div class="hud-prompt hidden" data-prompt></div>
      <div class="hud-help" data-help></div>
    `;
    this.q = s => this.root.querySelector(`[data-${s}]`);
    this.minimap = new MiniMap(this.q('mini'));
    this.last = 0;
    this.radioLines = [];
    this.helpCtx = null;
    this.q('online').addEventListener('pointerdown', async e => { e.preventDefault(); const { openOnline } = await import('./online.js'); const { app } = await import('../main.js'); openOnline(app); });
    this.root.querySelectorAll('[data-tp]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); touch.press(b.dataset.tp); }));
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
    this.minimap.draw(w, w.playerState());   // every frame, so it turns smoothly
    if (now - this.last < 66) return;
    this.last = now;
    const s = game.s;
    this.q('time').textContent = gameTimeStr(s.time);
    this.q('day').textContent = `${dayName(s.time)} · Day ${s.time.day} · ${s.weather}`;
    const p = w.playerState();
    const street = w.streetAt(p.x, p.z);
    this.q('place').textContent = `${street ? street + ' · ' : ''}${districtAt(p.x, p.z)}`;
    const ob = this.q('online');
    ob.classList.toggle('hidden', !online.active);
    if (online.active) ob.textContent = `🌐 ${online.serverName} · ${online.list().length + 1} online`;
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
    // control hints follow what you're doing: walking or driving
    const ctx = w.inCar ? 'car' : 'foot';
    if (ctx !== this.helpCtx) {
      this.helpCtx = ctx;
      const help = this.q('help');
      help.textContent = touchUi.active ? '' : HELP[ctx];
      help.classList.remove('fade');
      clearTimeout(this.helpT);
      this.helpT = setTimeout(() => help.classList.add('fade'), 9000);
    }
    // prompt
    const pr = this.q('prompt');
    const parts = [];
    const tch = touchUi.active;
    if (w.garageHint && !w.nearLoc) parts.push(`<span style="color:#2cff7a">▶</span> ${esc(w.garageHint)}`);
    const cb = w.combat;
    const rp = cb ? cb.robPrompt() : '';
    if (rp) parts.push(`<kbd>${tch ? 'USE' : 'E'}</kbd> <b style="color:#ff5a5a">${esc(rp)}</b>`);
    if (w.nearLoc && !(cb && cb.armed)) parts.push(`<kbd>${tch ? 'USE' : w.inCar ? 'Enter' : 'E'}</kbd> ${esc(w.nearLoc.name)}`);
    if (!w.inCar && w.vehicle && Math.hypot(w.vehicle.x - w.foot.x, w.vehicle.z - w.foot.z) < 4.5) parts.push(`<kbd>${tch ? 'GET IN' : 'F'}</kbd> ${tch ? 'your car' : 'Get in'}`);
    else if (w.inCar && w.vehicle && w.vehicle.speed < 2) parts.push(`<kbd>${tch ? 'GET OUT' : 'F'}</kbd> ${tch ? '' : 'Get out'}`);
    const wl = cb && !w.inCar ? cb.hudLine() : '';
    const wq = this.q('weapon');
    if (wq) {
      const hp = cb ? Math.round(cb.arms.hp) : 100, ar = cb ? Math.round(cb.arms.armor * 100) : 0;
      const html = wl ? `🔫 ${wl}${hp < 100 ? ` &nbsp; ❤ ${hp}` : ''}${ar ? ` &nbsp; 🛡 ${ar}%` : ''}` : '';
      if (wq.dataset.h !== html) { wq.dataset.h = html; wq.innerHTML = html; }
      wq.classList.toggle('hidden', !html);
    }
    const troot = document.getElementById('touch');
    if (troot) { troot.classList.toggle('armed', !!(cb && cb.armed)); troot.classList.toggle('has-gun', !!(cb && cb.gun && !w.inCar)); }
    const prompt = parts.join(' &nbsp;·&nbsp; ');
    pr.innerHTML = prompt; pr.classList.toggle('hidden', !prompt);
    // dash
    const dash = this.q('dash');
    dash.classList.toggle('hidden', !w.inCar);
    if (w.inCar && w.vehicle) {
      const v = w.vehicle;
      const kmh = settings.units === 'kmh';
      this.q('speed').textContent = Math.round(v.speed * (kmh ? 3.6 : MPH));
      this.q('unit').textContent = kmh ? 'KM/H' : 'MPH';
      const gearTxt = v.rev < 0 ? 'R' : v.sim.shiftT > 0 ? '–' : v.model.asp === 'ev' ? 'D' : String(v.sim.gear + 1);
      this.q('gear').textContent = gearTxt;
      touchUi.setGear(gearTxt);
      const rpmPct = v.model.asp === 'ev' ? v.speed / 70 : v.sim.rpm / v.spec.redline;
      this.q('rpm').style.width = `${Math.min(100, rpmPct * 100)}%`;
      this.q('rpm').classList.toggle('hot', rpmPct > 0.9);
      this.q('fuel').style.width = `${v.car.fuel * 100}%`;
      this.q('fuel').classList.toggle('low', v.car.fuel < 0.15);
      // exhaust noise: only worth showing once the car is loud enough to matter
      const nr = this.q('noiserow'), loud = (w.staticDb || 0) > LEGAL_DB - 8;
      nr.classList.toggle('hidden', !loud);
      if (loud) {
        const nz = this.q('noise'), over = (w.liveDb || 0) > LEGAL_DB;
        nz.textContent = `${Math.round(w.liveDb || 0)} dB${over ? ` · over ${LEGAL_DB}` : ''}${w.police.noiseAtt > 0.15 ? ` · ${w.police.noiseAtt > 0.6 ? '👮 cops hear you' : 'heads turning'}` : ''}`;
        nz.style.color = over ? (w.police.noiseAtt > 0.6 ? '#ff2a3a' : '#ffb020') : '';
      }
      this.q('nosrow').classList.toggle('hidden', !v.spec.nosSecs);
      if (v.spec.nosSecs) this.q('nos').style.width = `${v.sim.nos / v.spec.nosSecs * 100}%`;
      this.q('carname').textContent = `${v.car.year} ${v.model.model}${v.car.cond.tires <= 1 ? ' · FLAT TIRES' : ''}`;
    }
    this.renderRadio();
  }

  show(v) { this.root.classList.toggle('hidden', !v); }
}
