// Night street meets: a live lot full of cars, racers to talk to, inspect
// and challenge, side bets on other people's races, Zed's van, and a chance
// to show off your build.

import { openPanel, closeAllPanels, bind, esc, toast, modal, confirm, prompt } from './dom.js';
import { game, fmtMoney, spend, earn, activeCar, carSpec, carMetrics, modelOf, levels, tierOf, addRep, addFollowers, uid } from '../core/state.js';
import { RACERS, CREWS } from '../data/npcs.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { PERF_CATALOG, fits } from '../data/catalog.js';
import { partLevels, defaultVisual } from '../data/parts.js';
import { buildSpec, metrics } from '../sim/powertrain.js';
import { carSprite } from '../gfx2d/carSprite.js';
import { drawFlameJets } from '../gfx2d/flames.js';
import { RevLimiter, launchRpmSetting } from '../sim/twostep.js';
import { soundProfile } from '../sim/sound.js';
import { LOC_BY_ID } from '../data/world.js';
import { openRaceSetup } from './raceSetup.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';
import { checkSponsors } from './phone.js';

export function openMeet(loc, app) {
  const s = game.s;
  const tier = tierOf(s.rep).n;
  const meetTier = loc.tier || 1;
  const pool = RACERS.filter(r => r.tier >= meetTier - 1 && r.tier <= Math.max(meetTier + 1, tier + 1));
  const present = pool.sort(() => Math.random() - 0.5).slice(0, 7);
  const st = { talked: new Set(), shown: s.lastShowDay === s.time.day && s.lastShowLoc === loc.id, vendor: makeVendor(s), betDone: false, log: [] };
  s.stats.meets++;
  emit('meetVisited', { loc: loc.id });
  audio.music('meet');
  let anim = 0;
  // Rev it: gas + brake held together (button, or W + S). Flames only with a 2-step.
  const rev = { btn: false, keys: new Set(), lim: null, voice: null, last: performance.now(), car: null };
  const fx = { flame: 0, revving: false };
  const revHeld = () => rev.btn || (rev.keys.has('w') && rev.keys.has('s')) || (rev.keys.has('arrowup') && rev.keys.has('arrowdown'));
  const onKey = (down) => (e) => { rev.keys[down ? 'add' : 'delete'](e.key.toLowerCase()); };
  const kd = onKey(true), ku = onKey(false), pu = () => { rev.btn = false; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  window.addEventListener('pointerup', pu); window.addEventListener('pointercancel', pu);
  const revTick = (car) => {
    const now = performance.now(), dt = Math.min(0.05, (now - rev.last) / 1000); rev.last = now;
    if (!car || modelOf(car).asp === 'ev') { fx.flame = 0; fx.revving = false; return; }
    const spec = carSpec(car);
    if (!rev.lim || rev.lim.spec !== spec) rev.lim = new RevLimiter(spec, launchRpmSetting(spec, car));
    rev.lim.target = launchRpmSetting(spec, car);
    const on = revHeld() && !panel.root.classList.contains('hidden');
    const r = rev.lim.update(dt, on);
    fx.flame = r.flame; fx.revving = on;
    if (on && !rev.voice) rev.voice = audio.engine({ profile: soundProfile(modelOf(car), levels(car), car.parts) });
    if (rev.voice) {
      if (on) rev.voice.update({ rpm: r.rpm, throttle: 1, volume: 1 });
      else { rev.voice.stop(); rev.voice = null; }
    }
    if (r.bang) audio.pop();
    // a crowd reaction once, after a proper show of flames
    if (rev.lim.flames >= 8 && !st.crowd) {
      st.crowd = true; addFollowers(s, 25); addRep(s, 2, 'Flames at the meet');
      st.log.push('"Did you see that?! Flames!" — phones are out.');
      toast('The crowd loves it · +25 followers · +2 rep', 'good');
      panel.refresh?.();
    }
  };
  const panel = openPanel((root, h) => {
    const car = activeCar(s);
    root.innerHTML = `<div class="p-head"><h1>${esc(loc.name)}<small>Street meet · ${present.length} racers here · Kingpin Dre runs the lot</small></h1><button class="btn x" data-action="close">×</button></div>
      <canvas data-lot width="1200" height="300" style="width:100%;display:block;background:#101114"></canvas>
      <div class="p-body"><div class="split"><div>
        <div class="section-title" style="margin-top:0">Racers</div>
        <div class="list">${present.map(r => {
          const m = CAR_BY_ID[r.car.model];
          const mt = metrics(buildSpec(m, partLevels(r.car.parts), {}));
          const mem = s.npc[r.id];
          return `<div class="li"><span class="avatar" style="background:${r.color}">${esc(r.name[0])}</span><div class="grow"><div class="t">${esc(r.name)} "${esc(r.nick)}" ${r.crew ? `<span class="tag" style="border-color:${CREWS[r.crew].color};color:${CREWS[r.crew].color}">${esc(CREWS[r.crew].name)}</span>` : ''}</div>
            <div class="s">${esc(carName(m, r.car.year))} · <span class="pi"><b>${mt.cls}</b>${mt.pi}</span>${mem ? ` · ${mem.wins}-${mem.losses}` : ''}</div></div>
            <button class="btn btn-sm" data-action="talk" data-id="${r.id}">Talk</button><button class="btn btn-sm" data-action="inspect" data-id="${r.id}">Inspect</button><button class="btn btn-sm btn-primary" data-action="challenge" data-id="${r.id}">Race</button></div>`;
        }).join('')}</div>
        ${st.log.length ? `<div class="section-title">Overheard</div>${st.log.slice(-5).map(l => `<p class="small" style="margin:4px 0">${esc(l)}</p>`).join('')}` : ''}
      </div><div>
        <div class="section-title" style="margin-top:0">Show your car</div>
        <p class="small muted">Park it under the lights. People film, post, and talk. Once per meet.</p>
        <button class="btn btn-primary" data-action="show" ${st.shown || !car ? 'disabled' : ''}>${st.shown ? 'Already showed it tonight' : `Show off the ${esc(car ? modelOf(car).model : '')}`}</button>
        <div class="section-title">Rev it</div>
        <p class="small muted">${!car ? 'Bring a car to rev.' : car.modelId && modelOf(car).asp === 'ev' ? 'Electric cars have no engine to rev.' : levels(car).twostep ? 'Hold the button — or W + S on a keyboard — for gas + brake. Your 2-step holds the launch rpm and throws flames.' : 'Hold the button — or W + S — for gas + brake. Just revs into the limiter: no flames until you install a 2-step (PartsHub → Power Adders).'}</p>
        <button class="btn" data-rev style="touch-action:none;user-select:none;width:100%;padding:14px" ${!car || modelOf(car).asp === 'ev' ? 'disabled' : ''}>🔥 HOLD: GAS + BRAKE</button>
        <div class="section-title">Side bets</div>
        <p class="small muted">Two locals are about to run a quarter. Pick a winner.</p>
        ${st.betDone ? '<p class="small">Bet settled.</p>' : (() => { const [a, b] = present; if (!a || !b) return ''; return `<div class="row"><button class="btn btn-sm" data-action="bet" data-w="0">${esc(a.nick)} (${odds(a, b)})</button><button class="btn btn-sm" data-action="bet" data-w="1">${esc(b.nick)} (${odds(b, a)})</button></div>`; })()}
        <div class="section-title">Zed's van</div>
        <p class="small muted">"Don't ask where it's from. It's just discounted, okay?" Goes straight to your parts bin.</p>
        <div class="list">${st.vendor.map((p, i) => `<div class="li"><div class="grow"><div class="t">${esc(p.brand)} ${esc(p.name)}</div><div class="s">Stage ${p.stage} · retail ${fmtMoney(p.price)}</div></div><button class="btn btn-sm" data-action="zed" data-i="${i}" ${p.sold ? 'disabled' : ''}>${p.sold ? 'Sold' : fmtMoney(p.deal)}</button></div>`).join('')}</div>
      </div></div></div>`;
    const cv = root.querySelector('[data-lot]');
    drawLot(cv, present, car, anim, fx);
    const rb = root.querySelector('[data-rev]');
    if (rb) rb.onpointerdown = (e) => { e.preventDefault(); rev.btn = true; };
    bind(root, {
      close: () => h.close(),
      talk: d => {
        const r = present.find(x => x.id === d.id);
        const mem = s.npc[r.id] ??= { met: true, wins: 0, losses: 0, rel: 0 };
        if (!st.talked.has(r.id)) { st.talked.add(r.id); mem.rel += 5; if (!s.contacts.includes(r.id)) s.contacts.push(r.id); }
        const line = mem.wins + mem.losses === 0 ? r.lines.intro : mem.lastResult === 'win' ? r.lines.rematch : r.lines.greet;
        modal(`${r.name} "${r.nick}"`, `<p>"${esc(line)}"</p><p class="muted small">${esc(r.personality)}</p>`);
        h.refresh();
      },
      inspect: d => {
        const r = present.find(x => x.id === d.id);
        const m = CAR_BY_ID[r.car.model];
        const spec = buildSpec(m, partLevels(r.car.parts), {});
        const mt = metrics(spec);
        const lv = partLevels(r.car.parts);
        modal(carName(m, r.car.year), `<div class="kv"><span>Engine</span><span>${esc(m.engine)}</span><span>Power</span><span>${spec.hp} hp / ${spec.tq} lb-ft</span><span>Drivetrain</span><span>${m.drive} · ${esc(m.trans)}</span>
          <span>0-60</span><span>${mt.zero60?.toFixed(2)}s</span><span>1/4 mile</span><span>${mt.quarter?.toFixed(2)}s @ ${Math.round(mt.quarterTrap)}</span><span>Top speed</span><span>${Math.round(mt.topSpeed)} mph</span>
          <span>Mods</span><span>${Object.entries(lv).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}</span></div>`);
      },
      challenge: d => {
        const r = present.find(x => x.id === d.id);
        h.close();
        if (r.style === 'drag') { const l = LOC_BY_ID.ironline; app.world?.setGps(l.x, l.z, `Race ${r.nick} @ Ironline`); s.challenge = { id: uid('ch'), npcId: r.id, type: 'drag', loc: 'ironline', wager: 0, dist: 'quarter', roll: 40, expires: s.time.day + 1 }; toast(`${r.nick}: "Ironline. Let's go." — GPS set`, 'good'); }
        else {
          const spot = tierOf(s.rep).n >= 4 ? 'northridge_start' : tierOf(s.rep).n >= 2 && Math.random() < 0.5 ? 'dustline_start' : Math.random() < 0.5 ? 'glory_onramp' : 'ironside_start';
          const l = LOC_BY_ID[spot];
          s.challenge = { id: uid('ch'), npcId: r.id, type: 'roll', loc: spot, wager: 0, dist: 'half', roll: [40, 50, 60][Math.floor(Math.random() * 3)], expires: s.time.day + 1 };
          app.world?.setGps(l.x, l.z, `Race ${r.nick} @ ${l.name}`);
          toast(`${r.nick}: "Follow me to ${l.name}." — GPS set`, 'good');
        }
      },
      show: () => {
        const c = activeCar(s);
        const m = modelOf(c);
        const mods = Object.values(c.visual).filter(v => v && !['none', 'stock', 'single', 'halogen', 'gloss', '#111111', 'steel'].includes(v)).length;
        const perf = Object.values(levels(c)).reduce((a, b) => a + b, 0);
        const score = mods * 8 + perf * 4 + m.rarity * 20 + carMetrics(c).pi / 15 - (100 - c.cond.body) * 0.5;
        const f = Math.max(5, Math.round(score * (0.6 + Math.random() * 0.8)));
        const rep = Math.max(0, Math.round(score / 3));
        addFollowers(s, f); addRep(s, rep, 'Car show');
        st.shown = true; s.lastShowDay = s.time.day; s.lastShowLoc = loc.id;
        st.log.push(score > 120 ? `"Yo, who built that ${m.model}?!"` : score > 60 ? `"Clean ${m.model}."` : `"…is that a ${m.model}? Respect for showing up."`);
        toast(`+${f} followers · +${rep} rep`, 'good');
        checkSponsors(s);
        h.refresh();
      },
      bet: async d => {
        const [a, b] = present;
        const pickR = d.w === '0' ? a : b, other = d.w === '0' ? b : a;
        const v = await prompt('Place a bet', `<p>On ${esc(pickR.name)}. Odds ${odds(pickR, other)}.</p>`, '$', '200');
        if (!v) return;
        const amt = Math.min(+String(v).replace(/[^\d]/g, ''), [0, 1000, 5000, 20000, 80000, 300000][tierOf(s.rep).n]);
        if (!amt || !spend(s, amt, `Side bet on ${pickR.nick}`)) return;
        const won = simulateRace(pickR, other);
        st.betDone = true;
        const mult = oddsMult(pickR, other);
        if (won) { earn(s, amt * (1 + mult), `Won side bet on ${pickR.nick}`); st.log.push(`${pickR.nick} took it by a fender. You collect.`); }
        else st.log.push(`${other.nick} walked ${pickR.nick}. There goes ${fmtMoney(amt)}.`);
        audio[won ? 'win' : 'lose']();
        h.refresh();
      },
      zed: d => {
        const p = st.vendor[+d.i];
        if (!spend(s, p.deal, `Zed: ${p.name}`)) return;
        p.sold = true; s.partsBin.push({ pid: p.id, uid: uid('b') });
        toast('Zed: "Pleasure doing business."', 'good');
        h.refresh();
      },
    });
  }, { onClose: () => {
    audio.music(null); cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    window.removeEventListener('pointerup', pu); window.removeEventListener('pointercancel', pu);
    if (rev.voice) { rev.voice.stop(); rev.voice = null; }
  } });
  let raf = 0;
  const tick = () => {
    anim += 1 / 60;
    const cv = panel.root.querySelector('[data-lot]');
    if (!cv) return;
    const car = activeCar(s);
    revTick(car);
    cv.dataset.flames = fx.flame.toFixed(2); cv.dataset.revving = fx.revving ? '1' : '0'; cv.dataset.flameCount = rev.lim?.flames || 0;
    drawLot(cv, present, car, anim, fx);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function piOf(r) { return metrics(buildSpec(CAR_BY_ID[r.car.model], partLevels(r.car.parts), {})).pi; }
function winProb(a, b) {
  const d = (piOf(a) - piOf(b)) / 60 + (a.skill - b.skill) * 3;
  return clamp01(1 / (1 + Math.exp(-d)));
}
function clamp01(p) { return Math.max(0.08, Math.min(0.92, p)); }
function oddsMult(a, b) { const p = winProb(a, b); return Math.max(0.1, (1 - p) / p * 0.92); }
function odds(a, b) { const m = oddsMult(a, b); return m >= 1 ? `+${Math.round(m * 100)}` : `-${Math.round(100 / m)}`; }
function simulateRace(a, b) { return Math.random() < winProb(a, b); }

function makeVendor(s) {
  const car = activeCar(s);
  const m = car ? modelOf(car) : null;
  const pool = PERF_CATALOG.filter(p => (!m || fits(p, m)) && p.price > 150);
  return Array.from({ length: 3 }, () => {
    const p = pool[Math.floor(Math.random() * pool.length)];
    return { ...p, deal: Math.round(p.price * (0.55 + Math.random() * 0.2) / 10) * 10, sold: false };
  });
}

function drawLot(cv, present, car, t, fx = { flame: 0, revving: false }) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  g.fillStyle = '#16171a'; g.fillRect(0, 0, W, H);
  // stall lines
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
  for (let x = 40; x < W; x += 140) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 120); g.moveTo(x, 180); g.lineTo(x, 280); g.stroke(); }
  // lights
  for (let x = 110; x < W; x += 280) {
    const gr = g.createRadialGradient(x, 150, 0, x, 150, 200);
    gr.addColorStop(0, 'rgba(255,220,170,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - 200, 0, 400, H);
  }
  const cars = present.map(r => ({ m: CAR_BY_ID[r.car.model], v: { ...defaultVisual(CAR_BY_ID[r.car.model]), plate: r.nick.toUpperCase().slice(0, 7), ...r.car.visual }, lv: partLevels(r.car.parts) }));
  if (car) cars.splice(3, 0, { m: modelOf(car), v: car.visual, lv: levels(car), cond: car.cond, mine: true });
  cars.forEach((c, i) => {
    const top = i % 2 === 0;
    const x = 110 + Math.floor(i / 2) * 140 + (top ? 0 : 70);
    const y = top ? 72 : 228;
    const sp = carSprite(c.m, c.v, c.lv, c.cond);
    const k = 9 / sp.px;
    if (c.v.neon && c.v.neon !== 'none') {
      const gr = g.createRadialGradient(x, y, 0, x, y, 60);
      gr.addColorStop(0, c.v.neon); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.55 + Math.sin(t * 3 + i) * 0.1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, 60, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    }
    const shake = c.mine && fx.revving ? (Math.random() - 0.5) * 1.2 : 0;
    g.save(); g.translate(x + shake, y); g.rotate(top ? Math.PI : 0);
    if (c.mine && fx.flame > 0.04) { g.save(); g.scale(9, 9); drawFlameJets(g, c.m, c.v, fx.flame); g.restore(); }
    g.scale(k, k);
    g.drawImage(sp.canvas, -sp.canvas.width / 2, -sp.canvas.height / 2); g.restore();
    if (c.mine) { g.fillStyle = '#ff2a3a'; g.font = 'bold 14px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('YOU', x, top ? 140 : 168); }
    // people standing around
    for (let p = 0; p < 2; p++) {
      const px = x + 34 + p * 10, py = y + (top ? 40 : -40) + Math.sin(t * 2 + i + p) * 2;
      g.fillStyle = ['#c41b1b', '#e8e8e8', '#1b4fc4', '#222', '#e8c21a'][(i + p) % 5]; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c68e65'; g.beginPath(); g.arc(px, py, 2.5, 0, Math.PI * 2); g.fill();
    }
  });
  // occasional burnout smoke in the aisle
  const bx = (t * 90) % (W + 300) - 150;
  for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(220,220,220,${0.08 + k * 0.01})`; g.beginPath(); g.arc(bx - k * 22, 150 + Math.sin(t * 4 + k) * 8, 18 + k * 4, 0, Math.PI * 2); g.fill(); }
}
