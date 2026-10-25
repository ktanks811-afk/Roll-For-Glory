// Phone → Garage. Every property you own with parking and the cars in it,
// where the car you drive is right now (parked on a street, left behind in
// a chase, impounded), what each car needs, and the car hauler that moves
// cars between your garages (core/garages.js).

import { esc, bind, toast } from './dom.js';
import { fmtMoney, spend, modelOf, carMetrics, carValue, getCar } from '../core/state.js';
import { carName } from '../data/cars.js';
import { PROPERTIES, LOC_BY_ID } from '../data/world.js';
import { garagesOf, settle, whereIs, carStatus, haulQuote, haulCar } from '../core/garages.js';
import { openGarage } from './garage.js';

const KIND_TAG = { driving: ['tag-green', 'Driving'], out: ['', 'Parked out'], left: ['tag-red', 'Left at the scene'], impound: ['tag-red', 'Impounded'], stolen: ['tag-red', 'Stolen'], trailer: ['', 'On the trailer'], rig: ['', 'With the trailer'], garage: ['', 'In the garage'] };

export function renderGarageApp(scr, ctx) {
  const s = ctx.s, st = ctx.st.garage ??= { moving: null };
  settle(s);
  const gs = garagesOf(s), act = getCar(s, s.activeCar);
  const statusHtml = c => { const list = carStatus(c); return list.length ? list.map(x => `<span class="gchip ${x.bad ? 'bad' : ''}">${esc(x.text)}</span>`).join('') : '<span class="gchip ok">Ready to drive</span>'; };
  const carRow = c => {
    const m = modelOf(c), mt = carMetrics(c), w = whereIs(s, c), [cls, tag] = KIND_TAG[w.kind] || ['', ''];
    const moving = st.moving === c.uid;
    const dests = moving ? gs.filter(g => g.id !== c.garage).map(g => { const q = haulQuote(s, c, g.id); return `<button class="btn btn-sm ${q.block ? '' : 'btn-primary'}" data-action="haul" data-uid="${c.uid}" data-to="${g.id}" ${q.block ? 'disabled' : ''}>${esc(g.name)} · ${q.block ? esc(q.block) : fmtMoney(q.fee)}</button>`; }).join('') : '';
    return `<div class="gcar ${w.kind === 'left' ? 'left' : ''}"><div class="row"><div class="grow"><div class="t"><b>${esc(carName(m, c.year))}</b> ${tag ? `<span class="tag ${cls}">${tag}</span>` : ''}</div>
      <div class="s small muted">${Math.round(c.miles).toLocaleString()} mi · ${mt.cls} ${mt.pi} · worth ~${fmtMoney(carValue(c))}</div></div>
      <button class="btn btn-sm" data-action="specs" data-uid="${c.uid}">Specs</button></div>
      <div class="gchips">${statusHtml(c)}</div>
      ${w.kind !== 'garage' ? `<div class="small" style="margin-top:4px">📍 ${esc(w.text)}</div>` : ''}
      <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
        ${w.x != null && w.kind !== 'garage' && w.kind !== 'driving' ? `<button class="btn btn-sm btn-primary" data-action="gps" data-x="${Math.round(w.x)}" data-z="${Math.round(w.z)}" data-label="Your ${esc(m.model)}">📍 GPS to it</button><button class="btn btn-sm" data-action="taxi">🚕 Taxi there</button>` : ''}
        ${w.kind === 'impound' ? '<button class="btn btn-sm btn-primary" data-action="loc" data-loc="pspd_central">📍 Impound lot</button>' : ''}
        ${w.kind === 'garage' && gs.length > 1 ? `<button class="btn btn-sm" data-action="move" data-uid="${c.uid}">${moving ? 'Cancel' : '🚛 Move to another garage'}</button>` : ''}
      </div>
      ${moving ? `<div class="small muted" style="margin-top:6px">The car hauler picks it up and drops it off. Pick where:</div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">${dests}</div>` : ''}</div>`;
  };
  const away = s.cars.filter(c => c.uid !== s.activeCar && !gs.some(g => g.cars.includes(c)));
  scr.innerHTML = `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>Garage</h2></div><div class="app-body">
    <div class="section-title">Your car right now</div>
    ${act ? carRow(act) : '<p class="small muted">You\'re not driving anything. Pick a car in one of your garages, or buy one on Marketplace.</p>'}
    ${s.carLeft && act ? '<p class="small bad">You ran from it during a chase. Police may be sitting on it, and a warrant can be waiting when you get back in.</p>' : ''}
    ${gs.map(g => `<div class="section-title garage-head"><span>🏠 ${esc(g.name)}${g.id === s.home ? ' · home' : ''}</span><span>${g.cars.length} / ${g.slots}</span><button class="btn btn-sm" data-action="loc" data-loc="${g.id}">📍</button></div>
      ${g.cars.length ? g.cars.map(carRow).join('') : '<p class="small muted">Empty.</p>'}`).join('')}
    ${away.length ? `<div class="section-title">Not in a garage</div>${away.map(carRow).join('')}` : ''}
    <p class="small muted">Switch cars, install parts and tune inside any of your properties. The car you swap out stays parked in that garage.</p></div>`;
  bind(scr, {
    back: () => ctx.go(null),
    specs: d => openGarage(ctx.app, { readOnly: true, carUid: d.uid }),
    gps: d => { ctx.app.world?.setGps(+d.x, +d.z, d.label); ctx.h.close(); },
    loc: d => { const l = LOC_BY_ID[d.loc]; if (l) { ctx.app.world?.setGps(l.x, l.z, PROPERTIES[d.loc]?.name || l.name); ctx.h.close(); } },
    taxi: () => ctx.go('ryde'),
    move: d => { st.moving = st.moving === d.uid ? null : d.uid; ctx.h.refresh(); },
    haul: d => {
      const r = haulCar(s, d.uid, d.to, (a, l) => spend(s, a, l));
      toast(r.text, r.ok ? 'good' : 'bad');
      if (r.ok) st.moving = null;
      ctx.h.refresh();
    },
  });
}
