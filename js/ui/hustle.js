// Phone app: Hustle. Jobs, businesses and rentals that pay into your bank
// every game day — even while you're away.

import { bind, esc, toast, confirm } from './dom.js';
import { fmtMoney, tierOf, carValue, modelOf, activeCar } from '../core/state.js';
import { carName } from '../data/cars.js';
import * as H from '../core/hustle.js';

const head = title => `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>${esc(title)}</h2></div>`;

export function renderHustle(scr, ctx) {
  const s = ctx.s, h = H.ensure(s), tier = tierOf(s.rep).n;
  const tab = ctx.st.tab || 'jobs';
  const day = H.dailyIncome(s);
  const slots = H.jobSlots(tier);
  const done = (r) => { if (r.ok) toast(r.text, 'good'); else toast(r.text, 'bad'); ctx.h.refresh(); };

  const tabs = [['jobs', `Jobs (${h.jobs.length}/${slots})`], ['biz', `Businesses (${Object.keys(h.biz).length})`], ['cars', `Rentals (${h.rentals.length}/${H.rentalSlots(s)})`]];
  let body = '';
  if (tab === 'jobs') {
    body = `<p class="small muted">Take a job and the paycheck lands in your bank every day, after tax — no shifts to play. Better jobs unlock with rep; you can hold ${slots} at your level. Get busted and you might get fired.</p>
      <div class="list">${H.JOBS.map(j => {
        const has = h.jobs.includes(j.id), locked = tier < j.tier;
        return `<div class="li"><div class="grow"><div class="t">${esc(j.name)}</div><div class="s"><b>${esc(j.co)}</b> — ${esc(j.blurb)}</div>
          <div class="s"><b class="good">${fmtMoney(Math.round(j.pay * 0.88))}/day</b>${locked ? ` · <span class="bad">needs tier ${j.tier}</span>` : ''}</div></div>
          <button class="btn btn-sm ${has ? '' : 'btn-primary'}" data-action="${has ? 'quit' : 'hire'}" data-id="${j.id}" ${!has && locked ? 'disabled' : ''}>${has ? 'Quit' : 'Take job'}</button></div>`;
      }).join('')}</div>`;
  } else if (tab === 'biz') {
    body = `<p class="small muted">Buy a business and it earns while you race. Upgrade it for more. Profits go straight to your bank — expect the odd inspection fine or break-in, and the odd viral day.</p>
      <div class="list">${H.BIZ.map(b => {
        const own = h.biz[b.id], locked = tier < b.tier;
        const inc = Math.round(b.daily * H.LEVEL_MULT[own?.level || 1]);
        return `<div class="li"><div class="grow"><div class="t">${b.icon} ${esc(b.name)} ${own ? `<span class="tag tag-green">Level ${own.level}</span>` : ''}</div><div class="s">${esc(b.blurb)}</div>
          <div class="s"><b class="good">${fmtMoney(inc)}/day</b>${own ? '' : ` · pays back in ~${Math.round(b.price / b.daily)} days`}${locked ? ` · <span class="bad">needs tier ${b.tier}</span>` : ''}</div></div>
          <div style="text-align:right">${own
            ? `${own.level < 3 ? `<button class="btn btn-sm btn-primary" data-action="upgrade" data-id="${b.id}">Upgrade ${fmtMoney(H.upgradeCost(b, own.level))}</button>` : '<span class="tag">Maxed</span>'}<br><button class="btn btn-sm" style="margin-top:4px" data-action="sell" data-id="${b.id}">Sell ${fmtMoney(H.sellValue(b, own.level))}</button>`
            : `<button class="btn btn-sm btn-primary" data-action="buy" data-id="${b.id}" ${locked ? 'disabled' : ''}>Buy ${fmtMoney(b.price)}</button>`}</div></div>`;
      }).join('')}</div>`;
  } else {
    body = `<p class="small muted">Put your spare cars on the rental fleet and renters pay about ${(H.RENTAL_RATE * 100).toFixed(2)}% of each car's value every day. Renters are rough: now and then one dings a car${s.insurance ? ' (your insurance covers most of it)' : ' — get insurance to cover that'}. You can't rent out the car you're driving.</p>
      <div class="list">${s.cars.map(c => {
        const on = h.rentals.includes(c.uid), isActive = c.uid === s.activeCar;
        return `<div class="li"><div class="grow"><div class="t">${esc(carName(modelOf(c), c.year))}</div><div class="s">Worth ${fmtMoney(carValue(c))} · <b class="good">${fmtMoney(Math.round(carValue(c) * H.RENTAL_RATE))}/day</b>${isActive ? ' · you\'re driving this' : ''}</div></div>
          <button class="btn btn-sm ${on ? '' : 'btn-primary'}" data-action="rent" data-id="${c.uid}" ${isActive && !on ? 'disabled' : ''}>${on ? 'Take off fleet' : 'Rent out'}</button></div>`;
      }).join('') || '<div class="empty">You don\'t own any cars yet.</div>'}</div>`;
  }

  scr.innerHTML = head('Hustle') + `<div class="app-body">
    <div class="stats-row"><div><div class="stat-lbl">Income / day</div><div class="stat-big good">${fmtMoney(day)}</div></div><div><div class="stat-lbl">Earned so far</div><b>${fmtMoney(Math.round(h.total))}</b></div><div><div class="stat-lbl">Bank</div><b>${fmtMoney(s.bank)}</b></div></div>
    <p class="small muted" style="margin:6px 0">${day ? `That's ${fmtMoney(day * 7)} a week, deposited daily — and it keeps coming while you're away (at a quarter rate, up to 8 hours).` : 'Nothing earning yet. Take a job below — it costs nothing.'}</p>
    <div class="row" style="gap:6px;margin:8px 0;flex-wrap:wrap">${tabs.map(([id, label]) => `<button class="btn btn-sm ${tab === id ? 'btn-primary' : ''}" data-action="tab" data-id="${id}">${esc(label)}</button>`).join('')}</div>
    ${body}
    ${h.log.length ? `<div class="section-title">Recent days</div><div class="list">${h.log.slice(0, 6).map(l => `<div class="li"><div class="grow"><div class="t">Day ${l.day}</div>${l.notes.map(n => `<div class="s">${esc(n)}</div>`).join('')}</div><b class="${l.net >= 0 ? 'good' : 'bad'}">${l.net >= 0 ? '+' : ''}${fmtMoney(l.net)}</b></div>`).join('')}</div>` : ''}
  </div>`;

  bind(scr, {
    back: () => ctx.go(null),
    tab: d => { ctx.st.tab = d.id; ctx.h.refresh(); },
    hire: d => done(H.hire(s, d.id)),
    quit: async d => { if (await confirm('Quit this job?', `<p>You'll lose ${fmtMoney(Math.round(H.JOB_BY_ID[d.id].pay * 0.88))}/day.</p>`, 'Quit', true)) done(H.quit(s, d.id)); },
    buy: d => done(H.buyBiz(s, d.id)),
    upgrade: d => done(H.upgradeBiz(s, d.id)),
    sell: async d => { if (await confirm('Sell this business?', `<p>You'll get ${fmtMoney(H.sellValue(H.BIZ_BY_ID[d.id], h.biz[d.id].level))} (half of what you put in).</p>`, 'Sell', true)) done(H.sellBiz(s, d.id)); },
    rent: d => done(H.toggleRental(s, d.id)),
  });
}
