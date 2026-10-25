// Tow app (Hook & Haul Towing). Pick a mechanic and the truck hauls your car
// there with you riding along. The shop's damage report comes up: tick what
// to fix and pay for it. Then the truck takes it on to one of your
// properties, or you drive it off the lot. The rules are in core/towing.js.

import { bind, esc, toast, bar } from './dom.js';
import { fmtMoney, spend, activeCar, modelOf } from '../core/state.js';
import { LOCATIONS, LOC_BY_ID, PROPERTIES, districtAt } from '../data/world.js';
import { stateAt } from '../data/states.js';
import { carName } from '../data/cars.js';
import { towQuote, towBlock, damageReport, applyRepairs, OFF_LOT } from '../core/towing.js';
import { audio } from '../core/audio.js';

const HQ = () => LOC_BY_ID.hook_haul;
const hrs = m => m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Road metres between two points (straight line padded if there's no route).
function roadMeters(w, a, b) {
  const r = w.map.roads.routeBetween(a.x, a.z, b.x, b.z, null);
  return r?.meters > 0 ? r.meters : dist(a, b) * 1.3;
}

// Mechanic shops in the same state as the car, nearest first.
function shopsNear(w, v) {
  const st = stateAt(v.x, v.z), hq = HQ();
  // the truck drives out from the yard on the East Side (or a local partner out of town)
  const pickup = hq && stateAt(hq.x, hq.z) === st ? roadMeters(w, hq, v) : 3000;
  return LOCATIONS.filter(l => l.type === 'repair' && stateAt(l.x, l.z) === st)
    .sort((a, b) => dist(a, v) - dist(b, v)).slice(0, 6)
    .map(l => { const m = roadMeters(w, v, l); return { l, m, q: towQuote(m, pickup) }; });
}

// Your properties in the same state as the car, with a tow quote to each.
function homesNear(w, v) {
  const s = w.s, st = stateAt(v.x, v.z);
  return (s.properties || []).map(id => LOC_BY_ID[id]).filter(l => l && stateAt(l.x, l.z) === st)
    .map(l => { const m = roadMeters(w, v, l); return { l, m, q: towQuote(m) }; })
    .sort((a, b) => a.m - b.m);
}

export function renderTow(scr, ctx) {
  const s = ctx.s, w = ctx.app.world, st = ctx.st;
  const v = w?.vehicle, car = v && !v.car.hot ? v.car : null;
  const own = car || activeCar(s);
  const block = towBlock(s, { car: own, policePhase: w?.police?.phase, hot: !!(w?.inCar && v?.car?.hot), racing: !!w?.races?.active, riding: !!w?.rides?.riding });
  // the job's over once you've walked (or driven) away from the shop
  const job = s.towJob, shop = job && LOC_BY_ID[job.shop];
  if (job && (!shop || !car || dist(v, shop) > OFF_LOT)) { s.towJob = null; st.towSel = null; }
  const top = `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>🛻 Hook &amp; Haul</h2></div>`;
  if (s.towJob && car) { renderReport(scr, ctx, car, LOC_BY_ID[s.towJob.shop], top); return; }

  const where = car ? [w.streetAt(v.x, v.z), districtAt(v.x, v.z)].filter(Boolean).join(', ') : '';
  const status = !own ? '' : own.engineBlown ? '<b class="bad">Blown motor</b>' : own.broken ? '<b class="bad">Broken down</b>' : Math.min(...Object.values(own.cond)) < 45 ? '<b class="bad">Banged up</b>' : 'Runs fine';
  const shops = !block && car ? shopsNear(w, v) : [];
  scr.innerHTML = `${top}<div class="app-body">
    <p class="small muted">24-hour towing out of the East Side. We hook it wherever it sits (broken down, wrecked, or left at a scene), haul it to the shop you pick, and you ride along. The shop writes up a damage report when it lands, and we can haul it home after.</p>
    ${own ? `<div class="li"><span style="font-size:22px">🚗</span><div class="grow"><div class="t">${esc(carName(modelOf(own), own.year))}</div><div class="s">${status}${where ? ` · on ${esc(where)}` : ''}</div></div></div>` : ''}
    ${block ? `<p class="bad" style="margin-top:10px">${esc(block)}</p>` : `
    <div class="section-title">Tow it to</div>
    <div class="list">${shops.map(({ l, m, q }) => `<div class="li"><div class="grow"><div class="t">${esc(l.name)}</div><div class="s">${(m / 1609.34).toFixed(1)} mi · ${hrs(q.minutes)}${l.rate && l.rate < 0.97 ? ` · <span class="good">${Math.round((1 - l.rate) * 100)}% cheaper labor</span>` : l.rate > 1.03 ? ` · <span class="bad">${Math.round((l.rate - 1) * 100)}% pricier labor</span>` : ''}</div></div>
      <button class="btn btn-sm btn-primary" data-action="tow" data-id="${l.id}">${fmtMoney(q.fee)}</button></div>`).join('') || '<div class="empty">No mechanic shops out here.</div>'}</div>
    <p class="small muted">${fmtMoney(85)} to hook it, plus $6 a km. ${s.insurance ? '<span class="good">Cowtown Mutual covers 70% of the repairs.</span>' : 'Insurance (Bank app) covers 70% of repairs.'}</p>`}
  </div>`;
  bind(scr, {
    back: () => ctx.go(null),
    tow: d => {
      const pick = shops.find(o => o.l.id === d.id);
      if (!pick || !spend(s, pick.q.fee, `Hook & Haul tow to ${pick.l.name}`)) { toast(`The tow is ${fmtMoney(pick?.q.fee || 0)}. You're short.`, 'bad'); return; }
      w.towCar(w.dropSpot(pick.l), pick.q.minutes, pick.l.name);
      s.towJob = { shop: pick.l.id, day: s.time.day };
      st.towSel = null;
      toast(`🛻 Hook & Haul dropped your car at ${pick.l.name} (${hrs(pick.q.minutes)}).`, 'good');
      ctx.h.refresh();
    },
  });
}

// At the shop: the damage report, then where the car goes next.
function renderReport(scr, ctx, car, shop, top) {
  const s = ctx.s, w = ctx.app.world, st = ctx.st;
  const rep = damageReport(car, { rate: shop.rate || 1, insured: !!s.insurance });
  st.towSel ??= new Set(rep.items.filter(it => it.recommend).map(it => it.k));
  const sel = rep.items.filter(it => st.towSel.has(it.k));
  const cost = sel.reduce((a, it) => a + it.cost, 0), time = Math.round(sel.reduce((a, it) => a + it.hours, 0) * 60);
  const homes = homesNear(w, w.vehicle);
  const tone = p => p < 45 ? 'red' : p < 75 ? 'yellow' : 'green';
  scr.innerHTML = `${top}<div class="app-body">
    <div class="warrant-status ${rep.drivable ? '' : 'on'}">${rep.drivable ? 'DRIVABLE' : 'NOT DRIVABLE'}</div>
    <p class="small muted">📋 <b>Damage report</b> from ${esc(shop.name)} on your ${esc(carName(modelOf(car), car.year))}. Tap a line to add or take it off the work order.${s.insurance ? ' Prices include your insurance.' : ''}</p>
    <div class="list">${rep.items.map(it => `<div class="li click" data-action="pick" data-k="${it.k}" style="${st.towSel.has(it.k) ? 'border-color:var(--green)' : ''}">
      <span style="font-size:18px;width:20px">${st.towSel.has(it.k) ? '☑' : '☐'}</span>
      <div class="grow"><div class="t">${esc(it.name)}${it.must ? ' <span class="bad">· needed to run</span>' : ''}</div><div class="s">${esc(it.note)} · ${it.pct}%</div>${bar(it.pct, tone(it.pct))}</div>
      <b>${fmtMoney(it.cost, it.k === 'oil')}</b></div>`).join('') || '<div class="empty">Nothing wrong with it. They checked it over for free.</div>'}</div>
    ${rep.items.length ? `<div class="row" style="margin:10px 0;gap:6px"><button class="btn btn-sm btn-primary" data-action="fix" ${sel.length ? '' : 'disabled'}>Fix ${sel.length === rep.items.length ? 'everything' : 'selected'} · ${fmtMoney(cost)}${time ? ` · ${hrs(time)}` : ''}</button></div>` : ''}
    <div class="section-title">Then</div>
    <div class="list">${homes.map(({ l, m, q }) => `<div class="li"><span style="font-size:20px">🏠</span><div class="grow"><div class="t">Tow it to ${esc(PROPERTIES[l.id]?.name || l.name)}</div><div class="s">${(m / 1609.34).toFixed(1)} mi · ${hrs(q.minutes)} · you ride along</div></div><button class="btn btn-sm" data-action="home" data-id="${l.id}">${fmtMoney(q.fee)}</button></div>`).join('')}
      <div class="li"><span style="font-size:20px">🔑</span><div class="grow"><div class="t">Drive it off the lot</div><div class="s">${rep.drivable ? 'It\'s parked out front.' : 'It won\'t run yet. Fix what\'s needed first.'}</div></div><button class="btn btn-sm" data-action="done" ${rep.drivable ? '' : 'disabled'}>Done</button></div>
    </div>
    <p class="small muted">Walk away from the shop and the car stays parked here. You can also walk in for the full repair counter.</p>
  </div>`;
  bind(scr, {
    back: () => ctx.go(null),
    pick: d => { st.towSel.has(d.k) ? st.towSel.delete(d.k) : st.towSel.add(d.k); ctx.h.refresh(); },
    fix: () => {
      if (!spend(s, cost, `${shop.name}: repairs (tow-in)`)) { toast(`That's ${fmtMoney(cost)}. You're short.`, 'bad'); return; }
      applyRepairs(car, sel.map(it => it.k));
      w.passTime(time);
      w.refreshCar();
      audio.buy?.();
      st.towSel = null;
      toast(`Fixed in ${hrs(time)}. ${damageReport(car).drivable ? 'It runs.' : 'It still won\'t run.'}`, 'good');
      ctx.h.refresh();
    },
    home: d => {
      const pick = homes.find(o => o.l.id === d.id);
      if (!pick || !spend(s, pick.q.fee, `Hook & Haul tow to ${pick.l.name}`)) { toast(`The tow is ${fmtMoney(pick?.q.fee || 0)}. You're short.`, 'bad'); return; }
      w.towCar(w.dropSpot(pick.l), pick.q.minutes, pick.l.name);
      s.towJob = null; st.towSel = null;
      toast(`🛻 Your car is in the driveway at ${PROPERTIES[pick.l.id]?.name || pick.l.name}.`, 'good');
      ctx.h.close();
    },
    done: () => { s.towJob = null; st.towSel = null; ctx.h.close(); },
  });
}
