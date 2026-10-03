// Race setup (opponent, road, roll speed, distance, wager), launching the
// race, and the results / timeslip screen afterwards.

import { openPanel, closeAllPanels, bind, esc, toast, modal } from './dom.js';
import { game, fmtMoney, spend, earn, activeCar, carSpec, carMetrics, modelOf, levels, tierOf, addRep, addFollowers, racingLevel } from '../core/state.js';
import { RACERS, RACER_BY_ID, CREWS } from '../data/npcs.js';
import { CARS, CAR_BY_ID, carName } from '../data/cars.js';
import { ROADS, ROLL_SPEEDS, ROLL_DISTANCES, DRAG_DISTANCES, WAGER_CAP, LOCATIONS, LOC_BY_ID } from '../data/world.js';
import { buildSpec, metrics, MPH } from '../sim/powertrain.js';
import { partLevels, defaultVisual } from '../data/parts.js';
import { Race } from '../race2d/race.js';
import { startRace, enterWorld } from '../main.js';
import { emit } from '../core/events.js';
import { sendMessage } from '../core/story.js';
import { checkSponsors } from './phone.js';
import { audio } from '../core/audio.js';
import { touchUi } from './touch.js';

const FIRST = ['Danny', 'Rico', 'Shay', 'Malik', 'Trina', 'Jace', 'Lex', 'Bo', 'Nadia', 'Cruz', 'Kenji', 'Remy', 'Tasha', 'Vince'];
const NICKS = ['Boost', 'Lowride', 'Two-Step', 'Clutch', 'Redline', 'Smoke', 'Turbo', 'Bandit', 'Lucky', 'Ghost', 'Spool', 'Nitro'];

// A random street racer whose car is roughly as quick as yours.
function streetRacer(s) {
  const car = activeCar(s);
  const myPi = carMetrics(car).pi;
  const pool = CARS.filter(c => !c.market || Math.random() < 0.3).map(c => ({ c, pi: metrics(buildSpec(c, {}, {})).pi })).filter(x => Math.abs(x.pi - myPi) < 140 && x.c.msrp < 400000);
  const pick = (pool.length ? pool : [{ c: CARS[0] }])[Math.floor(Math.random() * Math.max(1, pool.length))].c;
  const lvl = Math.max(0, Math.min(4, Math.round((myPi - metrics(buildSpec(pick, {}, {})).pi) / 90 + Math.random())));
  const parts = { engine: lvl, intake: lvl, exhaust: lvl, ecu: lvl, fuel: Math.min(4, lvl + 1), tires: lvl, turbo: pick.asp === 'na' && lvl >= 2 ? 1 : pick.asp === 'turbo' ? lvl : 0, nitrous: Math.random() < 0.3 ? 1 : 0 };
  const name = FIRST[Math.floor(Math.random() * FIRST.length)];
  const tier = tierOf(s.rep).n;
  return {
    id: 'street_' + Math.random().toString(36).slice(2, 7), name, nick: NICKS[Math.floor(Math.random() * NICKS.length)], tier, generic: true,
    car: { model: pick.id, year: pick.years[1], parts, visual: { paint: ['#c41b1b', '#24262b', '#f2f2f2', '#1b4fc4', '#e8c21a', '#7a1414'][Math.floor(Math.random() * 6)], wheels: ['five', 'mesh', 'split', 'six'][Math.floor(Math.random() * 4)], tint: 'medium' } },
    skill: 0.35 + Math.random() * 0.35, money: [0, 2500, 8000, 25000, 80000, 300000][tier], color: '#6b6e78',
    lines: { greet: 'You running or what?', theyWon: 'Ha. Go home.', theyLost: 'Damn. Good race.', taunt: 'Nice car. Shame.' },
  };
}

function racerSpec(r) {
  const m = CAR_BY_ID[r.car.model];
  return buildSpec(m, partLevels(r.car.parts), {});
}

export function openRaceMenu(app) {
  const s = game.s;
  openPanel((root, h) => {
    root.innerHTML = `<div class="p-head"><h1>Race</h1><button class="btn x" data-action="close">×</button></div><div class="p-body">
      <p class="muted">Races happen at real spots in Fort Worth. Set your GPS and drive there — or race whoever texts you a challenge.</p>
      <div class="list">${LOCATIONS.filter(l => ['roll', 'drag', 'meet'].includes(l.type)).map(l => `<div class="li click" data-action="go" data-id="${l.id}"><div class="grow"><div class="t">${esc(l.name)} ${l.tier && tierOf(s.rep).n < l.tier ? `<span class="tag tag-red">Tier ${l.tier}</span>` : ''}</div><div class="s">${l.type === 'drag' ? 'Drag strip · ' : l.type === 'meet' ? 'Street meet · after 8 PM · ' : 'Roll racing · '}${esc(ROADS[l.road]?.desc || (l.type === 'drag' ? ROADS.strip.desc : 'Show cars, find racers, bet on races.'))}</div></div><span>📍</span></div>`).join('')}</div></div>`;
    bind(root, { close: () => h.close(), go: d => { const l = LOC_BY_ID[d.id]; app.world?.setGps(l.x, l.z, l.name); closeAllPanels(); } });
  });
}

export function openRaceSetup(app, { type, loc, npcId = null, wager = null }) {
  const s = game.s;
  const car = activeCar(s);
  if (!car) { modal(loc.name, '<p>You need a car to race. Check Marketplace on your phone.</p>'); return; }
  const w = app.world;
  if (w && (!w.inCar)) { modal(loc.name, touchUi.active ? '<p>Get in your car first (tap GET IN next to it), then pull up here and tap USE.</p>' : '<p>Get in your car first (F), then pull up here and press Enter.</p>'); return; }
  if (w && w.police.active) { modal('Not now', '<p>Nobody is lining up with the cops on your tail. Lose them first.</p>'); return; }
  if (car.fuel < 0.05) { modal('Out of gas', '<p>You\'re running on fumes. Fill up first.</p>'); return; }
  if (car.engineBlown) { modal('Blown motor', '<p>Your engine is blown. Get it towed to Second Chance Collision for a rebuild (Bank → Roadside → Tow).</p>'); return; }
  const tier = tierOf(s.rep).n;
  const isDrag = type === 'drag';
  const roadKey = isDrag ? 'strip' : loc.road;
  const road = ROADS[roadKey];
  const ch = s.challenge && s.challenge.loc === loc.id ? s.challenge : null;
  // who's around
  const here = RACERS.filter(r => r.tier <= tier + 1 && (isDrag ? true : r.style !== 'drag' || Math.random() < 0.4));
  const present = [...here.sort(() => Math.random() - 0.5).slice(0, 5)];
  if (ch && !present.find(r => r.id === ch.npcId)) present.unshift(RACER_BY_ID[ch.npcId]);
  if (npcId && !present.find(r => r.id === npcId)) present.unshift(RACER_BY_ID[npcId]);
  const extra = streetRacer(s);
  const st = {
    npc: (ch && RACER_BY_ID[ch.npcId]) || (npcId && RACER_BY_ID[npcId]) || (isDrag ? null : extra),
    roll: ch?.roll || 40, dist: ch?.dist || (isDrag ? 'quarter' : 'half'),
    wager: wager ?? ch?.wager ?? 0, opponents: [...present, extra],
  };
  openPanel((root, h) => {
    const myMt = carMetrics(car);
    const cap = WAGER_CAP[tier];
    const npc = st.npc;
    const npcMt = npc ? metrics(racerSpec(npc)) : null;
    const maxW = npc ? Math.min(s.cash + s.bank, npc.money, cap) : 0;
    st.wager = Math.min(st.wager, maxW);
    const mem = npc ? s.npc[npc.id] : null;
    root.innerHTML = `<div class="p-head"><h1>${esc(loc.name)}<small>${esc(road.name)} · ${esc(road.desc)}</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body"><div class="split"><div>
        <div class="section-title" style="margin-top:0">Opponent</div>
        <div class="list">${isDrag ? `<div class="li click" data-action="pick" data-id="" style="${!npc ? 'border-color:var(--red)' : ''}"><div class="grow"><div class="t">Test & Tune (solo)</div><div class="s">Make a pass, get a timeslip. $40 entry.</div></div></div>` : ''}
        ${st.opponents.map(r => {
          const m = CAR_BY_ID[r.car.model];
          const mt = metrics(racerSpec(r));
          const rec = s.npc[r.id];
          const locked = r.tier > tier + 1;
          return `<div class="li click" data-action="pick" data-id="${r.id}" style="${npc?.id === r.id ? 'border-color:var(--red)' : ''}"><span class="avatar" style="background:${r.color}">${esc(r.name[0])}</span><div class="grow"><div class="t">${esc(r.name)} "${esc(r.nick)}" ${r.generic ? '<span class="tag">Street</span>' : `<span class="tag">T${r.tier}</span>`} ${ch?.npcId === r.id ? '<span class="tag tag-green">Challenge</span>' : ''}</div>
            <div class="s">${esc(carName(m, r.car.year))} · <span class="pi"><b>${mt.cls}</b>${mt.pi}</span>${rec ? ` · you're ${rec.wins}-${rec.losses}` : ''}${locked ? ' · <span class="bad">won\'t race a nobody</span>' : ''}</div></div></div>`;
        }).join('')}</div>
      </div><div>
        <div class="section-title" style="margin-top:0">Matchup</div>
        <div class="kv"><span>You</span><span>${esc(carName(modelOf(car), car.year))} · ${myMt.cls} ${myMt.pi}</span>
          ${npc ? `<span>${esc(npc.nick)}</span><span>${esc(carName(CAR_BY_ID[npc.car.model], npc.car.year))} · ${npcMt.cls} ${npcMt.pi}</span>
          <span>Their style</span><span>${esc(npc.focus || 'Street')} · ${npc.style || 'roll'}</span>
          <span>Bankroll</span><span>${fmtMoney(npc.money)}</span>` : '<span>Opponent</span><span>None — solo pass</span>'}
        </div>
        ${npc ? `<p class="muted small" style="margin:8px 0">"${esc(mem ? (mem.lastResult === 'win' ? npc.lines.rematch || npc.lines.greet : npc.lines.greet) : npc.lines.intro || npc.lines.greet)}"</p>` : ''}
        ${!isDrag ? `<label class="field"><span>Roll speed</span><div class="opts">${ROLL_SPEEDS.map(v => `<button class="${st.roll === v ? 'on' : ''}" data-action="roll" data-v="${v}">${v} mph</button>`).join('')}</div></label>` : ''}
        <label class="field"><span>Distance</span><div class="opts">${(isDrag ? DRAG_DISTANCES : ROLL_DISTANCES).map(d => `<button class="${st.dist === d.id ? 'on' : ''}" data-action="dist" data-v="${d.id}">${d.name}</button>`).join('')}</div></label>
        ${npc ? `<label class="field"><span>Wager — ${fmtMoney(st.wager)} <small class="muted">(max ${fmtMoney(maxW)} · tier cap ${fmtMoney(cap)})</small></span><input type="range" class="input" min="0" max="${maxW}" step="${maxW > 5000 ? 250 : 50}" value="${st.wager}" data-wager></label>` : ''}
        ${!isDrag ? `<p class="small ${road.heat > 0.5 ? 'warn' : 'muted'}">⚠ Public road: traffic, and racing here raises police heat.</p>` : '<p class="small muted">Sanctioned strip: no heat, no traffic, real timing.</p>'}
        <div class="row" style="margin-top:12px"><button class="btn btn-primary" data-action="go" style="flex:1">${isDrag ? (npc ? 'Line up' : 'Make a pass ($40)') : 'Line up the roll'}</button></div>
      </div></div></div>`;
    const wr = root.querySelector('[data-wager]');
    if (wr) wr.oninput = () => { st.wager = +wr.value; wr.previousElementSibling.firstChild.textContent = `Wager — ${fmtMoney(st.wager)} `; };
    bind(root, {
      close: () => h.close(),
      pick: d => { st.npc = d.id ? st.opponents.find(r => r.id === d.id) : null; h.refresh(); },
      roll: d => { st.roll = +d.v; h.refresh(); },
      dist: d => { st.dist = d.v; h.refresh(); },
      go: () => {
        const npc = st.npc;
        if (npc) {
          if (npc.tier > tier + 1) { modal(npc.name, `<p>"${esc(npc.lines.taunt || 'Who are you?')}"</p><p class="muted">They won't race you until you have more rep (Tier ${npc.tier - 1}+).</p>`); return; }
          const diff = myMt.pi - npcMt.pi;
          if (diff > 160 && st.wager > 0) { modal(npc.name, `<p>"Nah. Not against <i>that</i>. Not for money."</p><p class="muted">Your car is way faster. Race for $0 or pick someone your speed.</p>`); return; }
          if (st.wager > s.cash + s.bank) { toast('You don\'t have that kind of money', 'bad'); return; }
        } else if (!spend(s, 40, 'Ironline Dragway entry')) return;
        closeAllPanels();
        launch(app, { type, roadKey, road, loc, npc, roll: st.roll, dist: st.dist, wager: npc ? st.wager : 0, challenge: ch });
      },
    });
  });
}

function launch(app, cfg) {
  const s = game.s;
  const car = activeCar(s);
  const m = modelOf(car);
  const tier = tierOf(s.rep).n;
  const opts = {
    type: cfg.type, road: cfg.roadKey, dist: cfg.dist, roll: cfg.roll, wager: cfg.wager, tier,
    trafficDensity: cfg.road.traffic,
    player: { name: s.player.name, car, model: m, spec: carSpec(car), visual: car.visual, levels: levels(car), cond: car.cond, skill: 1 },
    npc: cfg.npc ? { name: cfg.npc.name, car: null, model: CAR_BY_ID[cfg.npc.car.model], spec: racerSpec(cfg.npc), visual: { ...defaultVisual(CAR_BY_ID[cfg.npc.car.model]), plate: cfg.npc.nick.toUpperCase().slice(0, 7), ...cfg.npc.car.visual }, levels: partLevels(cfg.npc.car.parts), cond: {}, skill: cfg.npc.skill } : null,
    onDone: result => results(app, cfg, result),
  };
  startRace(Race, opts);
}

function results(app, cfg, r) {
  const s = game.s;
  const car = activeCar(s);
  const npc = cfg.npc;
  const tier = tierOf(s.rep).n;
  let repGain = 0, money = 0, followers = 0;
  // ---- apply ----
  if (!r.voided) {
    s.stats.races++; car.stats.races++;
    if (npc) {
      if (r.won) {
        money = cfg.wager;
        repGain = Math.round(30 + 25 * npc.tier + cfg.wager / 40) * (npc.tier > tier ? 1.5 : 1);
        if (s.sponsor) money += s.sponsor.perWin;
        followers = Math.round(15 + npc.tier * 20 + cfg.wager / 100);
        s.stats.wins++; car.stats.wins++;
        if (cfg.wager) s.stats.wagersWon += cfg.wager;
      } else {
        money = -cfg.wager;
        repGain = 5;
        s.stats.losses++; car.stats.losses++;
      }
      const mem = s.npc[npc.id] ??= { met: true, wins: 0, losses: 0, rel: 0 };
      if (r.won) { mem.wins++; mem.rel += npc.generic ? 0 : 6; mem.lastResult = 'win'; } else { mem.losses++; mem.rel += 3; mem.lastResult = 'loss'; }
      mem.lastWager = cfg.wager;
      if (!npc.generic && !s.contacts.includes(npc.id)) s.contacts.push(npc.id);
      if (s.crew && r.won) s.crew.rep += Math.round(repGain * 0.6);
    } else {
      repGain = 3;
    }
    s.xp += r.won ? 60 : 25;
    repGain = Math.round(repGain);
    if (money > 0) earn(s, money, npc ? `Beat ${npc.nick} (${cfg.wager ? 'wager' : 'purse'})` : 'Purse');
    if (money < 0) spend(s, -money, `Lost to ${npc.nick}`);
    addRep(s, repGain, r.won ? `Beat ${npc?.nick || 'the clock'}` : 'Showed up');
    addFollowers(s, followers);
    if (cfg.type === 'roll') {
      const add = cfg.road.heat * (0.4 + Math.random() * 0.7);
      s.heat = Math.min(5.99, s.heat + add);
    }
    if (r.won && npc) s.feed.unshift({ day: s.time.day, text: `Walked ${npc.name} "${npc.nick}" ${cfg.type === 'drag' ? 'on the strip' : `from a ${cfg.roll} roll`} in my ${modelOf(car).model}${cfg.wager ? ` for ${fmtMoney(cfg.wager)}` : ''}.`, likes: followers * 4 });
    checkSponsors(s);
  } else {
    addRep(s, -10, 'Jumped the start');
  }
  // wear and tear
  if (r.crashDamage) { car.cond.body = Math.max(5, car.cond.body - r.crashDamage); car.cond.lights = Math.max(0, car.cond.lights - r.crashDamage * 0.6); }
  if (r.nosUsed > 0) car.nos = Math.max(0, (car.nos ?? 0) - r.nosUsed);
  car.cond.tires = Math.max(1, car.cond.tires - 1.5 - r.burn * 2);
  car.fuel = Math.max(0, car.fuel - 0.03 * (cfg.dist === 'mile' ? 2 : 1));
  car.miles += (r.player.peak > 0 ? 1 : 0) * 0.5;
  const P = r.player;
  if (cfg.type === 'drag' && cfg.dist === 'quarter' && P.finished && !P.redLight) {
    if (!car.stats.bestEt || P.time < car.stats.bestEt) car.stats.bestEt = P.time;
    if (!s.stats.bestEt || P.time < s.stats.bestEt) { s.stats.bestEt = P.time; s.stats.bestEtCar = carName(modelOf(car), car.year); }
  }
  if (P.trap > s.stats.bestTrap) s.stats.bestTrap = P.trap;
  if (cfg.challenge && npc && cfg.challenge.npcId === npc.id) s.challenge = null;
  emit('raceFinished', { won: r.won && !r.voided, npcId: npc?.id, wager: cfg.wager, type: cfg.type, dist: cfg.dist });
  if (r.won) audio.win(); else audio.lose();

  // ---- screen ----
  const fmt = v => v == null ? '—' : v.toFixed(3);
  const row = (label, a, b, better) => {
    const aw = better && a != null && b != null && (better === 'low' ? a < b : a > b);
    const bw = better && a != null && b != null && !aw && a !== b;
    const f = v => v == null || (typeof v === 'number' && !isFinite(v)) ? '—' : typeof v !== 'number' ? v : /MPH|mph/.test(label) ? (v ? v.toFixed(1) : '—') : /Shifts|hits/.test(label) ? String(v) : /Wheelspin/.test(label) ? v.toFixed(2) : fmt(v);
    return `<tr><td>${label}</td><td class="${aw ? 'winner' : ''}">${f(a)}</td>${npc ? `<td class="${bw ? 'winner' : ''}">${f(b)}</td>` : ''}</tr>`;
  };
  const N = r.npc || { splits: {} };
  const sp = P.splits || {}, ns = N.splits || {};
  const isDrag = cfg.type === 'drag';
  const title = r.voided ? 'JUMPED THE START' : r.won ? (npc ? 'YOU WIN' : 'TIMESLIP') : P.redLight ? 'RED LIGHT' : 'YOU LOST';
  const line = npc ? (r.won ? npc.lines.theyLost : npc.lines.theyWon) : '';
  closeAllPanels();
  let relaunch = false;
  openPanel((root, h) => {
    root.innerHTML = `<div class="p-head"><h1 style="color:${r.won ? 'var(--green)' : r.voided ? 'var(--yellow)' : 'var(--red2)'}">${title}<small>${esc(cfg.loc.name)} · ${isDrag ? 'Drag' : cfg.roll + ' mph roll'} · ${{ eighth: '1/8 mile', quarter: '1/4 mile', half: '1/2 mile', mile: '1 mile' }[cfg.dist]}${npc ? ` · vs ${esc(npc.name)}` : ''}</small></h1></div>
      <div class="p-body results"><div class="split"><div>
        <table><tr><th></th><th>You</th>${npc ? `<th>${esc(npc.nick)}</th>` : ''}</tr>
        ${isDrag ? row('Reaction time', P.rt, N.rt, 'low') + row("60'", sp.sixty, ns.sixty, 'low') + row("330'", sp.three30, ns.three30, 'low') : ''}
        ${row('1/8 mile ET', sp.eighth, ns.eighth, 'low')}${row('1/8 MPH', sp.eighthMph, ns.eighthMph, 'high')}
        ${isDrag ? row("1000'", sp.thousand, ns.thousand, 'low') : ''}
        ${['quarter', 'half', 'mile'].includes(cfg.dist) ? row('1/4 mile ET', sp.quarter, ns.quarter, 'low') + row('1/4 MPH', sp.quarterMph, ns.quarterMph, 'high') : ''}
        ${['half', 'mile'].includes(cfg.dist) ? row('1/2 mile ET', sp.half, ns.half, 'low') + row('1/2 MPH', sp.halfMph, ns.halfMph, 'high') : ''}
        ${row(isDrag ? 'Elapsed time' : 'Time to finish', P.time, N.time, 'low')}${row('Trap speed (mph)', P.trap, N.trap, 'high')}
        ${row('Top speed (mph)', P.peak, N.peak, 'high')}${row('Shifts', P.shifts, N.shifts)}${row('Wheelspin (s)', P.spin, N.spin)}
        ${P.crashes || N.crashes ? row('Traffic hits', P.crashes, N.crashes) : ''}</table>
        ${r.margin != null && npc && !r.voided ? `<p class="muted small">Margin: ${r.margin.toFixed(3)}s.</p>` : ''}
        ${r.tired > 0.02 ? `<p class="small warn">You were tired: +${r.tired.toFixed(3)}s on your reaction. Eat or sleep.</p>` : ''}
      </div><div>
        ${npc ? `<div class="li"><span class="avatar" style="background:${npc.color}">${esc(npc.name[0])}</span><div class="grow"><div class="t">${esc(npc.name)}</div><div class="s">"${esc(line)}"</div></div></div>` : ''}
        <div class="section-title">Payout</div>
        <div class="kv"><span>Money</span><span class="${money > 0 ? 'good' : money < 0 ? 'bad' : ''}">${money > 0 ? '+' : ''}${fmtMoney(money)}${s.sponsor && r.won && npc ? ` (incl. ${fmtMoney(s.sponsor.perWin)} sponsor)` : ''}</span>
          <span>Rep</span><span>${r.voided ? '−10' : '+' + repGain}</span><span>Followers</span><span>+${followers}</span><span>Racing level</span><span>${racingLevel(s.xp)}</span>
          ${cfg.type === 'roll' && !r.voided ? `<span>Heat</span><span class="warn">${s.heat.toFixed(1)}</span>` : ''}
          ${r.crashDamage ? `<span>Damage</span><span class="bad">Body −${Math.round(r.crashDamage)}%</span>` : ''}</div>
        <div class="row" style="margin-top:16px">${npc && !npc.generic ? `<button class="btn" data-action="again">Run it back</button>` : ''}${!npc ? '<button class="btn" data-action="again">Another pass ($40)</button>' : ''}<button class="btn btn-primary" data-action="leave">Back to the street</button></div>
      </div></div></div>`;
    bind(root, {
      leave: () => h.close(),
      again: () => {
        if (!npc && !spend(s, 40, 'Ironline Dragway entry')) return;
        if (npc && cfg.wager > s.cash + s.bank) { toast('You can\'t cover that wager anymore', 'bad'); return; }
        relaunch = true;
        h.close();
        launch(app, cfg);
      },
    });
  }, { onClose: () => { if (!relaunch) enterWorld(); } });
}
