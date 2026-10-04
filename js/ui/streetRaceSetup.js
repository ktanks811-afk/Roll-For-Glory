// Street race setup (1v1 for cash or pink slips, or a solo run at the course
// record) and the results / payout afterwards. The race itself runs in the
// open world (world2d/streetRace.js).

import { openPanel, closeAllPanels, bind, esc, toast, modal } from './dom.js';
import { game, fmtMoney, spend, earn, activeCar, carMetrics, carValue, modelOf, tierOf, addRep, addFollowers, newCar, garageCapacity } from '../core/state.js';
import { RACERS } from '../data/npcs.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { WAGER_CAP, PROPERTIES, districtAt } from '../data/world.js';
import { STREET_RACE_BY_ID, raceRoute, courseRecord, racerSpec, fmtRaceTime, pinkSlipCheck, TRIAL_PURSE } from '../data/streetRaces.js';
import { metrics } from '../sim/powertrain.js';
import { PERF_IDS, defaultVisual } from '../data/parts.js';
import { streetRacer } from './raceSetup.js';
import { emit } from '../core/events.js';
import { checkSponsors } from './phone.js';
import { audio } from '../core/audio.js';
import { touchUi } from './touch.js';

const miles = m => (m / 1609.34).toFixed(1) + ' mi';

export function openStreetRace(app, loc, { npcId = null } = {}) {
  const s = game.s;
  const ev = STREET_RACE_BY_ID[loc.race || loc.id];
  const car = activeCar(s);
  const w = app.world;
  if (!car) { modal(ev.name, '<p>You need a car to race. Check Marketplace on your phone.</p>'); return; }
  if (w && !w.inCar) { modal(ev.name, touchUi.active ? '<p>Get in your car first (tap GET IN next to it), then pull up to the start line and tap USE.</p>' : '<p>Get in your car first (F), then pull up to the start line and press Enter.</p>'); return; }
  if (w?.police.active) { modal('Not now', '<p>Nobody is lining up with the cops on your tail. Lose them first.</p>'); return; }
  if (w?.races.active) return;
  if (car.fuel < 0.08) { modal('Low on gas', '<p>You won\'t make it to the finish on fumes. Fill up first.</p>'); return; }
  if (car.broken) { modal('Broken down', '<p>Your car is broken down. Call the mobile mechanic or a tow from your phone (Bank → Roadside).</p>'); return; }
  if (car.engineBlown) { modal('Blown motor', '<p>Your engine is blown. Get it towed to Second Chance Collision for a rebuild (Bank → Roadside → Tow).</p>'); return; }
  const tier = tierOf(s.rep).n;
  const route = raceRoute(ev);
  const rec = courseRecord(ev);
  s.streetRecords ??= {};
  const myBest = s.streetRecords[ev.id];
  // who's out here tonight: named racers near your level, plus a random street racer
  const pool = RACERS.filter(r => r.tier <= Math.max(ev.tier, tier) + 1 && r.tier >= ev.tier - 1 && r.style !== 'drag').sort(() => Math.random() - 0.5).slice(0, 4);
  if (npcId && !pool.some(r => r.id === npcId)) pool.unshift(RACERS.find(r => r.id === npcId));
  const opponents = [...pool, streetRacer(s)];
  const st = { mode: 'race', npc: opponents.find(r => r.id === npcId) || opponents[opponents.length - 1], stake: 'cash', wager: 0 };
  const myMt = carMetrics(car);
  openPanel((root, h) => {
    const npc = st.mode === 'race' ? st.npc : null;
    const npcMt = npc ? metrics(racerSpec(npc)) : null;
    const cap = WAGER_CAP[tier];
    const maxW = npc ? Math.max(0, Math.min(s.cash + s.bank, npc.money, cap)) : 0;
    st.wager = Math.min(st.wager, maxW);
    const freeSlots = garageCapacity(s, PROPERTIES) - s.cars.length;
    const pinkNo = npc ? pinkSlipCheck({ myPi: myMt.pi, theirPi: npcMt.pi, myValue: carValue(car), theirValue: rivalValue(npc), freeSlots, stolen: !!car.stolen }) || (s.npc[npc.id]?.pinkDay > s.time.day - 3 ? `"You already took one title off me this week. Cash only."` : null) : null;
    if (st.stake === 'pinks' && pinkNo) st.stake = 'cash';
    root.innerHTML = `<div class="p-head"><h1>${esc(ev.name)}<small>${ev.kind === 'circuit' ? `Circuit · ${route.laps} laps` : 'Sprint'} · ${miles(route.length)} · ${route.checkpoints.length} checkpoints · ${esc(districtAt(loc.x, loc.z))}</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body"><p class="muted small" style="margin-top:0">${esc(ev.desc)}</p><div class="split"><div>
        <label class="field"><span>Race</span><div class="opts"><button class="${st.mode === 'race' ? 'on' : ''}" data-action="mode" data-v="race">1v1</button><button class="${st.mode === 'trial' ? 'on' : ''}" data-action="mode" data-v="trial">Time trial</button></div></label>
        ${st.mode === 'race' ? `<div class="section-title">Opponent</div><div class="list">${opponents.map(r => {
          const mt = metrics(racerSpec(r)), rec2 = s.npc[r.id], locked = r.tier > tier + 1;
          return `<div class="li click" data-action="pick" data-id="${r.id}" style="${npc?.id === r.id ? 'border-color:var(--red)' : ''}"><span class="avatar" style="background:${r.color}">${esc(r.name[0])}</span><div class="grow"><div class="t">${esc(r.name)} "${esc(r.nick)}" ${r.generic ? '<span class="tag">Street</span>' : `<span class="tag">T${r.tier}</span>`}</div>
            <div class="s">${esc(carName(CAR_BY_ID[r.car.model], r.car.year))} · <span class="pi"><b>${mt.cls}</b>${mt.pi}</span>${rec2 ? ` · you're ${rec2.wins}-${rec2.losses}` : ''}${locked ? ' · <span class="bad">won\'t race a nobody</span>' : ''}</div></div></div>`;
        }).join('')}</div>` : `<div class="section-title">Course record</div>
          <div class="kv"><span>Record</span><span>${fmtRaceTime(rec.time)} · ${esc(rec.holder.name)} "${esc(rec.holder.nick)}"</span><span>Your best</span><span>${myBest ? fmtRaceTime(myBest) : '—'}</span><span>Purse</span><span>${fmtMoney(TRIAL_PURSE[ev.tier])} for beating the record</span></div>
          <p class="small muted">Solo against the clock. Traffic and cops are still out there.</p>`}
      </div><div>
        <div class="section-title" style="margin-top:0">Matchup</div>
        <div class="kv"><span>You</span><span>${esc(carName(modelOf(car), car.year))} · ${myMt.cls} ${myMt.pi}</span>
          ${npc ? `<span>${esc(npc.nick)}</span><span>${esc(carName(CAR_BY_ID[npc.car.model], npc.car.year))} · ${npcMt.cls} ${npcMt.pi}</span><span>Bankroll</span><span>${fmtMoney(npc.money)}</span>` : `<span>Record to beat</span><span>${fmtRaceTime(rec.time)}</span>`}
        </div>
        ${npc ? `<p class="muted small" style="margin:8px 0">"${esc(npc.lines.greet)}"</p>
          <label class="field"><span>Stakes</span><div class="opts"><button class="${st.stake === 'cash' ? 'on' : ''}" data-action="stake" data-v="cash">Cash</button><button class="${st.stake === 'pinks' ? 'on' : ''}" data-action="stake" data-v="pinks" ${pinkNo ? 'disabled style="opacity:.45"' : ''}>Pink slips</button></div></label>
          ${pinkNo ? `<p class="small muted">${esc(pinkNo)}</p>` : ''}
          ${st.stake === 'cash' ? `<label class="field"><span>Wager — ${fmtMoney(st.wager)} <small class="muted">(max ${fmtMoney(maxW)} · tier cap ${fmtMoney(cap)})</small></span><input type="range" class="input" min="0" max="${maxW}" step="${maxW > 5000 ? 250 : 50}" value="${st.wager}" data-wager></label>`
            : `<p class="small warn">Winner keeps both cars. Lose and ${esc(npc.nick)} drives home in your ${esc(modelOf(car).model)} (worth ${fmtMoney(carValue(car))}). You win their ${esc(CAR_BY_ID[npc.car.model].model)} (worth about ${fmtMoney(rivalValue(npc))}).</p>`}` : ''}
        <p class="small ${ev.heat > 0.7 ? 'warn' : 'muted'}">⚠ Public streets: live traffic, red lights, and racing here raises police heat.</p>
        <div class="row" style="margin-top:12px"><button class="btn btn-primary" data-action="go" style="flex:1">${npc ? 'Line up' : 'Start the clock'}</button></div>
      </div></div></div>`;
    const wr = root.querySelector('[data-wager]');
    if (wr) wr.oninput = () => { st.wager = +wr.value; wr.previousElementSibling.firstChild.textContent = `Wager — ${fmtMoney(st.wager)} `; };
    bind(root, {
      close: () => h.close(),
      mode: d => { st.mode = d.v; h.refresh(); },
      pick: d => { st.npc = opponents.find(r => r.id === d.id); h.refresh(); },
      stake: d => { if (d.v === 'pinks' && pinkNo) return; st.stake = d.v; h.refresh(); },
      go: () => {
        if (npc) {
          if (npc.tier > tier + 1) { modal(npc.name, `<p>"${esc(npc.lines.taunt || 'Who are you?')}"</p><p class="muted">They won't race you until you have more rep (Tier ${npc.tier - 1}+).</p>`); return; }
          if (st.stake === 'cash' && myMt.pi - npcMt.pi > 160 && st.wager > 0) { modal(npc.name, '<p>"Nah. Not against <i>that</i>. Not for money."</p><p class="muted">Your car is way faster. Race for $0 or pick someone your speed.</p>'); return; }
          if (st.stake === 'cash' && st.wager > s.cash + s.bank) { toast('You don\'t have that kind of money', 'bad'); return; }
        }
        closeAllPanels();
        const stake = npc ? (st.stake === 'pinks' ? { type: 'pinks', carUid: car.uid } : { type: 'cash', wager: st.wager }) : { type: 'trial' };
        const m = npc ? CAR_BY_ID[npc.car.model] : null;
        w.races.start({ ev, rival: npc, rivalModel: m, rivalSpec: npc ? racerSpec(npc) : null, stake, recordTime: rec.time, onDone: r => results(app, r) });
      },
    });
  });
}

function rivalValue(r) {
  const m = CAR_BY_ID[r.car.model];
  const lv = Object.values(r.car.parts || {}).reduce((a, v) => a + (+v || 0), 0);
  return Math.round((m.msrp * 0.55 + lv * 900) / 10) * 10;
}

// The rival's car, signed over to you.
function wonCar(r) {
  const m = CAR_BY_ID[r.car.model];
  const parts = Object.fromEntries(PERF_IDS.map(k => [k, r.car.parts?.[k] || null]));
  return newCar(m.id, { year: r.car.year, miles: Math.round(20000 + Math.random() * 70000), parts, visual: { ...defaultVisual(m), ...r.car.visual }, paid: 0, title: 'Clean', fuel: 0.4, cond: { body: 88, lights: 95, tires: 70, engine: 90, trans: 92 } });
}

// Your car, signed over to them. If you were driving it you're left standing on the curb.
function loseCar(app, car) {
  const s = game.s, w = app.world;
  s.cars = s.cars.filter(c => c !== car);
  s.myListings = s.myListings.filter(l => l.carUid !== car.uid);
  if (s.activeCar !== car.uid) return;
  if (w?.vehicle) {
    const v = w.vehicle;
    w.foot.x = v.x - Math.cos(v.h) * (v.dims.W / 2 + 1.2); w.foot.z = v.z - Math.sin(v.h) * (v.dims.W / 2 + 1.2); w.foot.h = v.h;
    if (w.engine) { w.engine.stop(); w.engine = null; }
    w.inCar = false; w.vehicle = null;
  }
  s.carPos = null;
  s.activeCar = s.cars.find(c => !c.stolen)?.uid ?? null;
  w?.refreshCar();
}

function results(app, r) {
  const s = game.s;
  const car = activeCar(s);
  const ev = r.ev, npc = r.rival;
  const tier = tierOf(s.rep).n;
  const won = r.outcome === 'win';
  const lost = r.outcome === 'loss' || (r.outcome === 'dnf' && npc);
  let money = 0, repGain = 0, followers = 0, carWon = null, carLost = null;
  s.streetRecords ??= {};
  const rec = courseRecord(ev);
  const prevBest = s.streetRecords[ev.id];
  if (r.pTime != null && (!prevBest || r.pTime < prevBest)) s.streetRecords[ev.id] = r.pTime;
  s.stats.races++;
  if (car) car.stats.races++;
  if (npc) {
    const mem = s.npc[npc.id] ??= { met: true, wins: 0, losses: 0, rel: 0 };
    if (won) {
      repGain = Math.round((40 + 25 * npc.tier + (r.stake.wager || 0) / 40) * (npc.tier > tier ? 1.5 : 1));
      followers = Math.round(20 + npc.tier * 25 + (r.stake.wager || 0) / 100);
      if (r.stake.type === 'cash') { money = r.stake.wager; if (money) s.stats.wagersWon += money; }
      else { carWon = wonCar(npc); s.cars.push(carWon); mem.pinkDay = s.time.day; repGain += 150; followers += 150; }
      if (s.sponsor) money += s.sponsor.perWin;
      s.stats.wins++; if (car) car.stats.wins++;
      mem.wins++; mem.rel += npc.generic ? 0 : 6; mem.lastResult = 'win';
      if (s.crew) s.crew.rep += Math.round(repGain * 0.6);
    } else {
      repGain = r.outcome === 'dnf' ? -15 : 5;
      if (r.stake.type === 'cash') money = -r.stake.wager;
      else { carLost = s.cars.find(c => c.uid === r.stake.carUid) || null; }
      s.stats.losses++; if (car) car.stats.losses++;
      mem.losses++; mem.rel += 3; mem.lastResult = 'loss';
    }
    if (!npc.generic && !s.contacts.includes(npc.id)) s.contacts.push(npc.id);
  } else if (r.outcome === 'done') {
    const beat = r.pTime < rec.time;
    if (beat) { money = TRIAL_PURSE[ev.tier]; repGain = 35 * ev.tier; followers = 25 * ev.tier; }
    else repGain = 6;
  } else repGain = -5;
  s.xp += won || (r.outcome === 'done' && r.pTime < rec.time) ? 70 : 25;
  if (money > 0) earn(s, money, npc ? `Beat ${npc.nick} (${ev.name})` : `${ev.name} record`, { dirty: !!npc });
  if (money < 0) spend(s, -money, `Lost to ${npc.nick}`, { street: true });
  addRep(s, repGain, won ? `Beat ${npc.nick}` : r.outcome === 'done' ? ev.name : 'Street race');
  addFollowers(s, followers);
  s.heat = Math.min(5.99, s.heat + ev.heat * (0.35 + Math.random() * 0.6));
  if (won && npc) s.feed.unshift({ day: s.time.day, text: `Smoked ${npc.name} "${npc.nick}" on the ${ev.name}${carWon ? ` and took the pink slip to their ${CAR_BY_ID[npc.car.model].model}` : r.stake.wager ? ` for ${fmtMoney(r.stake.wager)}` : ''}.`, likes: followers * 4 });
  if (carLost) loseCar(app, carLost);
  checkSponsors(s);
  emit('raceFinished', { won, npcId: npc?.id, wager: r.stake.wager || 0, type: 'street', dist: ev.id, pinks: r.stake.type === 'pinks' });
  if (won || (r.outcome === 'done' && r.pTime < rec.time)) audio.win(); else audio.lose();

  const title = won ? 'YOU WIN' : r.outcome === 'done' ? (r.pTime < rec.time ? 'NEW RECORD' : 'FINISHED') : r.outcome === 'dnf' ? 'DNF' : 'YOU LOST';
  const color = won || (r.outcome === 'done' && r.pTime < rec.time) ? 'var(--green)' : r.outcome === 'done' ? 'var(--yellow)' : 'var(--red2)';
  const line = npc ? (won ? npc.lines.theyLost : npc.lines.theyWon) : '';
  openPanel((root, h) => {
    root.innerHTML = `<div class="p-head"><h1 style="color:${color}">${title}<small>${esc(ev.name)}${npc ? ` · vs ${esc(npc.name)}` : ' · time trial'}${r.stake.type === 'pinks' ? ' · for pink slips' : ''}</small></h1></div>
      <div class="p-body results"><div class="split"><div>
        <table><tr><th></th><th>You</th><th>${npc ? esc(npc.nick) : 'Record'}</th></tr>
          <tr><td>Time</td><td class="${r.pTime != null && (won || (!npc && r.pTime < rec.time)) ? 'winner' : ''}">${r.pTime != null ? fmtRaceTime(r.pTime) : 'DNF'}</td><td class="${lost || (!npc && !(r.pTime < rec.time)) ? 'winner' : ''}">${npc ? (r.rTime != null ? fmtRaceTime(r.rTime) : '—') : fmtRaceTime(rec.time)}</td></tr>
          <tr><td>Checkpoints</td><td>${Math.min(r.checkpoints, r.total)}/${r.total}</td><td>${npc ? (r.rTime != null ? `${r.total}/${r.total}` : '—') : ''}</td></tr>
          <tr><td>Your best here</td><td>${s.streetRecords[ev.id] ? fmtRaceTime(s.streetRecords[ev.id]) : '—'}</td><td></td></tr>
        </table>
        ${r.pTime != null && r.rTime != null ? `<p class="muted small">Margin: ${Math.abs(r.pTime - r.rTime).toFixed(2)}s.</p>` : ''}
        ${r.outcome === 'dnf' ? `<p class="small warn">You never finished${npc ? `, so ${esc(npc.nick)} takes it` : ''}.</p>` : ''}
      </div><div>
        ${npc ? `<div class="li"><span class="avatar" style="background:${npc.color}">${esc(npc.name[0])}</span><div class="grow"><div class="t">${esc(npc.name)}</div><div class="s">"${esc(line)}"</div></div></div>` : ''}
        ${carWon ? `<p class="good"><b>Pink slip:</b> the ${esc(carName(CAR_BY_ID[carWon.modelId], carWon.year))} is yours. It's waiting in your garage.</p>` : ''}
        ${carLost ? `<p class="bad"><b>Pink slip:</b> ${esc(npc.nick)} drives off in your ${esc(carName(modelOf(carLost), carLost.year))}.${!activeCar(s) ? ' You\'re on foot.' : ''}</p>` : ''}
        <div class="section-title">Payout</div>
        <div class="kv"><span>Money</span><span class="${money > 0 ? 'good' : money < 0 ? 'bad' : ''}">${money > 0 ? '+' : ''}${fmtMoney(money)}</span>
          <span>Rep</span><span>${repGain >= 0 ? '+' : ''}${repGain}</span><span>Followers</span><span>+${followers}</span><span>Heat</span><span class="warn">${s.heat.toFixed(1)}</span></div>
        <div class="row" style="margin-top:16px"><button class="btn btn-primary" data-action="leave">Back to the street</button></div>
      </div></div></div>`;
    bind(root, { leave: () => h.close() });
  });
}
