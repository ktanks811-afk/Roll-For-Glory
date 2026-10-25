// Screens for the rental businesses (core/outfitters.js) and the trail park:
// Cross Timbers Trail Park (ride the trails, buy the park and run it) and the
// Sea-Doo rental dock tab on every marina screen.

import { openPanel, bind, esc, toast, confirm } from './dom.js';
import { game, fmtMoney, activeCar, modelOf, tierOf, addRep, addFollowers, earn, spend } from '../core/state.js';
import { CAR_BY_ID } from '../data/cars.js';
import { BOAT_BY_ID, MARINA_BY_ID } from '../data/boats.js';
import { TRAILS, TRAIL_RIDERS, TRAIL_BY_ID } from '../data/trails.js';
import { racerSpec, fmtRaceTime } from '../data/streetRaces.js';
import * as O from '../core/outfitters.js';
import { audio } from '../core/audio.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const say = r => { if (r.text) toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) audio.buy(); else audio.error(); return r.ok; };
const money = n => `<b class="${n >= 0 ? 'good' : 'warn'}">${n >= 0 ? '' : '−'}${fmtMoney(Math.abs(n))}</b>`;
const condTag = c => `<span class="tag ${c > 70 ? 'tag-green' : c > 30 ? '' : 'tag-red'}">${Math.round(c)}%</span>`;

// ---------------------------------------------------------------- the trail park
export function openTrailPark(loc, app, tab0) {
  const s = game.s;
  let tab = tab0 || 'ride';
  openPanel((root, h) => {
    const car = activeCar(s), m = car && modelOf(car);
    const tabs = [['ride', 'Ride the trails'], ['run', O.ownsPark(s) ? 'Run the park' : 'Buy the park']];
    let body;
    if (tab === 'ride') {
      const tier = tierOf(s.rep).n;
      const rec = s.trailRecords || {};
      body = `<p class="small muted">${m ? m.ride === 'atv' ? `Your ${esc(m.model)} is built for this.` : m.ride ? `A ${esc(m.model)} will do, but a 4-wheeler keeps its bite in the dirt.` : `Your ${esc(m.model)} is going to bog down out there. A 4-wheeler from Cowtown Powersports grips the dirt.` : 'Bring something to ride: a 4-wheeler is best. Cowtown Powersports sells them.'}</p>
        <div class="list">${TRAILS.map(t => `<div class="li"><div class="grow"><div class="t">${esc(t.name)} ${t.tier > tier ? `<span class="tag tag-red">Tier ${t.tier}</span>` : ''}</div>
          <div class="s">${esc(t.desc)} · ${t.kind === 'circuit' ? `${t.laps} laps` : 'point to point'} · record ${fmtRaceTime(t.record)}${rec[t.id] ? ` · your best ${fmtRaceTime(rec[t.id])}` : ''}</div>
          <div class="row" style="margin-top:6px;gap:6px"><button class="btn btn-sm btn-primary" data-action="solo" data-id="${t.id}" ${m && t.tier <= tier ? '' : 'disabled'}>Ride it ($20)</button>
          ${TRAIL_RIDERS.filter(r => r.tier <= t.tier).map(r => `<button class="btn btn-sm" data-action="vs" data-id="${t.id}" data-r="${r.id}" ${m && t.tier <= tier ? '' : 'disabled'}>vs ${esc(r.nick)} · ${fmtMoney(betFor(r))}</button>`).join('')}</div></div></div>`).join('')}</div>`;
    } else if (!O.ownsPark(s)) {
      body = `<div class="card"><h3>Cross Timbers Trail Park · ${fmtMoney(O.PARK_PRICE)}</h3>
        <p class="muted small">725 acres of cedar and post oak, three marked trails, a stock tank, the office and the rental barn. Stock it with rental quads (${fmtMoney(O.QUAD_PRICE)} each) and trail horses (${fmtMoney(O.HORSE_PRICE)}), hire guides, and put on Saturday trail rides with a DJ and food trucks. Every morning yesterday's take lands in your bank.</p>
        <button class="btn btn-primary" data-action="buypark">Buy the park</button></div>`;
    } else {
      const p = s.outfit.park, t = p.today;
      const need = Math.ceil(p.quads.filter(q => q.cond > 30).length / O.QUADS_PER_GUIDE) + (p.horses ? 1 : 0);
      body = `<div class="stats-row"><div><div class="stat-lbl">Rental quads</div><b>${p.quads.length} / ${O.MAX_QUADS}</b></div><div><div class="stat-lbl">Trail horses</div><b>${p.horses} / ${O.MAX_HORSES}</b></div>
          <div><div class="stat-lbl">Guides</div><b>${p.guides}</b>${p.guides < need ? ` <small class="warn">need ${need}</small>` : ''}</div><div><div class="stat-lbl">Park rep</div><b>${Math.round(p.rep)}</b></div><div><div class="stat-lbl">Made so far</div>${money(p.earned)}</div></div>
        ${t ? `<p class="small">Yesterday: ${t.quadRides} quad rides, ${t.horseRides} horseback${t.ride ? `, and ${t.ride.heads} came out for the trail ride` : ''}. Took in ${fmtMoney(t.gross)}, paid ${fmtMoney(t.costs)}: ${money(t.net)}.</p>` : '<p class="small muted">The first day settles tomorrow morning.</p>'}
        <div class="section-title">Prices</div><div class="row" style="gap:6px">${Object.entries(O.PARK_PRICES).map(([k, v]) => `<button class="chip ${p.price === k ? 'on' : ''}" data-action="price" data-v="${k}">${v.name}</button>`).join('')}</div>
        <div class="section-title">Fleet and staff</div><div class="row" style="gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" data-action="quads" data-n="1">+1 quad ${fmtMoney(O.QUAD_PRICE)}</button><button class="btn btn-sm" data-action="quads" data-n="5">+5 quads ${fmtMoney(O.QUAD_PRICE * 5)}</button>
          <button class="btn btn-sm" data-action="horses">+1 horse ${fmtMoney(O.HORSE_PRICE)}</button>
          <button class="btn btn-sm" data-action="guides" data-d="1">Hire a guide (${fmtMoney(O.GUIDE)}/day)</button><button class="btn btn-sm" data-action="guides" data-d="-1" ${p.guides ? '' : 'disabled'}>Let one go</button>
          ${O.quadServiceCost(p) ? `<button class="btn btn-sm" data-action="service">Service the quads ${fmtMoney(O.quadServiceCost(p))}</button>` : ''}</div>
        ${p.quads.length ? `<p class="small muted">Quads: ${p.quads.map(q => condTag(q.cond)).join(' ')}</p>` : ''}
        <div class="section-title">Trail ride</div>
        <p class="small muted">A Saturday trail ride: riders on horseback and 4-wheelers, a DJ on a flatbed, food trucks, the trucks lined up along FM 2481. ${fmtMoney(O.RIDE_COST)} to put on, ${fmtMoney(O.RIDE_GATE)} a head at the gate plus the vendors. The bigger the park's name, the bigger the crowd.</p>
        ${p.ride ? `<p class="good small">On the books for day ${p.ride.day}${p.ride.day === s.time.day ? ' (today)' : ''}.</p>` : '<button class="btn btn-primary btn-sm" data-action="ride">Book a trail ride</button>'}
        <div class="row" style="margin-top:14px"><button class="btn btn-sm" data-action="sellpark">Sell the park</button></div>`;
    }
    root.innerHTML = head(loc.name, 'FM 2481 · trails through the cedar') + `<div class="tabs">${tabs.map(([id, l]) => `<button class="${tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${l}</button>`).join('')}</div><div class="p-body" style="max-width:900px">${body}</div>`;
    bind(root, {
      close: () => h.close(),
      tab: d => { tab = d.id; h.refresh(); },
      solo: d => { if (startTrail(app, TRAIL_BY_ID[d.id], null)) h.close(); },
      vs: d => { if (startTrail(app, TRAIL_BY_ID[d.id], TRAIL_RIDERS.find(r => r.id === d.r))) h.close(); },
      buypark: async () => { if (await confirm('Buy the trail park?', `<p>${fmtMoney(O.PARK_PRICE)} for Cross Timbers Trail Park.</p>`, 'Buy')) { say(O.buyPark(s)); h.refresh(); } },
      sellpark: async () => { if (await confirm('Sell the park?', '<p>You get back 60% of the park, plus what the fleet and horses are worth.</p>', 'Sell', true)) { const r = O.sellPark(s); if (r.ok) toast(`Sold for ${fmtMoney(r.pay)}.`, 'good'); h.refresh(); } },
      price: d => { O.setPark(s, { price: d.v }); h.refresh(); },
      quads: d => { say(O.buyQuads(s, +d.n)); h.refresh(); },
      horses: () => { say(O.buyHorses(s, 1)); h.refresh(); },
      guides: d => { O.setPark(s, { guides: s.outfit.park.guides + +d.d }); h.refresh(); },
      service: () => { say(O.serviceQuads(s)); h.refresh(); },
      ride: () => { say(O.bookTrailRide(s)); h.refresh(); },
    });
  });
}

const betFor = r => [0, 500, 1500, 4000][r.tier] || 1000;

// Ride a trail: the street race engine, on dirt, with the locals.
function startTrail(app, t, rider) {
  const s = game.s, w = app.world, car = activeCar(s);
  if (!w || !car) { toast('You need something to ride.', 'bad'); return false; }
  if (!w.inCar) { toast('Get on it first, then come back to the office.', 'bad'); return false; }
  if (w.police.active || w.races.active) { toast('Not right now.', 'bad'); return false; }
  const bet = rider ? betFor(rider) : 0;
  if (!spend(s, rider ? bet : 20, rider ? `Trail ride bet vs ${rider.nick}` : 'Trail park day pass')) return false;
  const ev = { id: t.id, name: t.name, kind: t.kind, laps: t.laps, corners: t.corners, adhoc: true, lanes: [-2, 2] };
  const started = w.races.start({
    ev, rival: rider, rivalModel: rider && CAR_BY_ID[rider.car.model], rivalSpec: rider && racerSpec(rider),
    stake: { type: rider ? 'cash' : 'trial', wager: bet }, recordTime: t.record,
    onDone: r => trailDone(r, t, rider, bet),
    onCancel: () => { if (rider) earn(s, bet, 'Trail ride called off: bet back'); },
  });
  if (!started) { if (rider) earn(s, bet, 'Trail ride: bet back'); return false; }
  toast(rider ? `${rider.nick} pulls up next to you. Three, two…` : `${t.name}: ride it clean.`, 'info');
  return true;
}

function trailDone(r, t, rider, bet) {
  const s = game.s;
  s.trailRecords ??= {};
  const best = s.trailRecords[t.id];
  if (r.pTime != null && (!best || r.pTime < best)) s.trailRecords[t.id] = r.pTime;
  if (rider) {
    if (r.outcome === 'win') { earn(s, bet * 2, `Trail ride: beat ${rider.nick}`); addRep(s, 40 * rider.tier, 'Trail ride'); addFollowers(s, 25 * rider.tier); toast(`You beat ${rider.nick} on ${t.name}${r.pTime != null ? ` in ${fmtRaceTime(r.pTime)}` : ''}. +${fmtMoney(bet * 2)}`, 'good'); }
    else toast(`${rider.nick} got you on ${t.name}. ${fmtMoney(bet)} gone.`, 'bad');
    return;
  }
  if (r.pTime == null) { toast(`Didn't finish ${t.name}.`, 'bad'); return; }
  const beat = r.pTime < t.record, first = beat && !(best && best < t.record);
  if (first) { earn(s, 1000 * t.tier, `Trail record: ${t.name}`); addRep(s, 60 * t.tier, 'Trail record'); }
  toast(`${t.name}: ${fmtRaceTime(r.pTime)}${beat ? ` — under the park record${first ? `! +${fmtMoney(1000 * t.tier)}` : ''}` : ` (record ${fmtRaceTime(t.record)})`}`, beat ? 'good' : 'info');
}

// ---------------------------------------------------------------- Sea-Doo rental dock (a tab on the marina screen)
export function dockTab(s, marinaId) {
  const m = MARINA_BY_ID[marinaId];
  if (!O.hasDock(s, marinaId)) {
    return `<div class="card"><h3>🌊 Sea-Doo rentals at ${esc(m.name)}</h3>
      <p class="muted small">Lease a spot on the dock for ${fmtMoney(O.DOCK_LEASE)}, buy jet skis, hire dock hands and rent them out by the hour. Weekends and sunshine bring the crowds, rain sends them home. ${m.area} is ${(O.LAKE_PULL[marinaId] || 1) >= 1.1 ? 'one of the busiest lakes around' : (O.LAKE_PULL[marinaId] || 1) < 0.9 ? 'quiet, so expect fewer renters' : 'a solid lake for it'}.</p>
      <button class="btn btn-primary" data-action="dockopen">Lease the dock</button></div>`;
  }
  const d = s.outfit.docks[marinaId], t = d.today;
  const need = Math.ceil(d.skis.filter(k => k.cond > 30).length / O.SKIS_PER_HAND);
  return `<div class="stats-row"><div><div class="stat-lbl">Skis</div><b>${d.skis.length} / ${O.MAX_SKIS}</b></div><div><div class="stat-lbl">Dock hands</div><b>${d.staff}</b>${d.staff < need ? ` <small class="warn">need ${need}</small>` : ''}</div><div><div class="stat-lbl">Made so far</div>${money(d.earned)}</div></div>
    ${t ? `<p class="small">Yesterday: ${t.hours} hours on the water, took in ${fmtMoney(t.gross)}, paid ${fmtMoney(t.costs)} (fuel, hands, rent, insurance): ${money(t.net)}.${t.wrecks.length ? ` A renter beached a ${esc(t.wrecks[0])}.` : ''}</p>` : '<p class="small muted">The first day settles tomorrow morning.</p>'}
    <div class="section-title">Rate</div><div class="row" style="gap:6px">${Object.entries(O.SKI_PRICES).map(([k, v]) => `<button class="chip ${d.price === k ? 'on' : ''}" data-action="dockprice" data-v="${k}">${v.name}</button>`).join('')}</div>
    <div class="section-title">Buy skis</div><div class="list">${O.SKI_MODELS.map(id => { const b = BOAT_BY_ID[id]; return `<div class="li"><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${esc(b.desc)}</div></div><button class="btn btn-sm" data-action="ski" data-id="${id}">${fmtMoney(b.price)}</button></div>`; }).join('')}</div>
    ${d.skis.length ? `<div class="section-title">On the dock</div><div class="list">${d.skis.map(k => `<div class="li"><div class="grow"><div class="t">${esc(BOAT_BY_ID[k.model].name)} ${condTag(k.cond)}</div></div><button class="btn btn-sm" data-action="skisell" data-id="${k.id}">Sell</button></div>`).join('')}</div>` : ''}
    <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-sm" data-action="hands" data-d="1">Hire a dock hand (${fmtMoney(O.DOCK_HAND)}/day)</button><button class="btn btn-sm" data-action="hands" data-d="-1" ${d.staff ? '' : 'disabled'}>Let one go</button>
      ${O.skiServiceCost(d) ? `<button class="btn btn-sm" data-action="skiservice">Service the skis ${fmtMoney(O.skiServiceCost(d))}</button>` : ''}
      <button class="btn btn-sm" data-action="dockclose">Close the dock</button></div>`;
}

export function dockHandlers(s, marinaId, refresh) {
  return {
    dockopen: async () => { if (await confirm('Lease a rental dock?', `<p>${fmtMoney(O.DOCK_LEASE)} to set up at ${esc(MARINA_BY_ID[marinaId].name)}, then ${fmtMoney(O.DOCK_RENT)} a day.</p>`, 'Lease')) { say(O.openDock(s, marinaId)); refresh(); } },
    dockprice: d => { O.setDock(s, marinaId, { price: d.v }); refresh(); },
    ski: d => { say(O.buySki(s, marinaId, d.id)); refresh(); },
    skisell: d => { const r = O.sellSki(s, marinaId, d.id); if (r.ok) toast(`Sold for ${fmtMoney(r.pay)}.`, 'good'); refresh(); },
    hands: d => { O.setDock(s, marinaId, { staff: s.outfit.docks[marinaId].staff + +d.d }); refresh(); },
    skiservice: () => { say(O.serviceSkis(s, marinaId)); refresh(); },
    dockclose: async () => { if (await confirm('Close the rental dock?', '<p>The marina buys back part of the lease and the skis.</p>', 'Close it', true)) { const r = O.closeDock(s, marinaId); if (r.ok) toast(`Closed. ${fmtMoney(r.pay)} back.`, 'good'); refresh(); } },
  };
}

