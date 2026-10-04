// Screens for real estate and the drug game: Bayline Realty (houses, land,
// trap houses), your land (pick a build), a trap house you own (stash, the
// door, the safe, how hot the house is) and the plug's back room.

import { openPanel, closeAllPanels, bind, esc, toast, confirm, modal } from './dom.js';
import { game, fmtMoney, tierOf, earn } from '../core/state.js';
import { PROPERTIES, LOC_BY_ID } from '../data/world.js';
import { LAND, PLANS, PLAN_BY_ID, TRAPS, DRUGS, DRUG_BY_ID, WORKER_PAY, WORKER_CUT } from '../data/estate.js';
import { buyProperty, sellProperty, buyLand, sellLand, build, buildCost, landState, ownsLand, isBuilt, building, now, portfolio, SELL_RATE, LAND_SELL } from '../core/estate.js';
import { ensureDrugs, trapState, prices, buy, dump, moveStash, units, raidChance, heatLabel, isClosed } from '../core/drugs.js';
import { applyEstate } from '../world2d/estate.js';
import { homeScreen } from './places.js';
import { openGarage } from './garage.js';
import { audio } from '../core/audio.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const say = r => { toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) audio.buy(); else audio.error(); return r.ok; };
const gps = (app, id, label) => { const l = LOC_BY_ID[id]; app.world?.setGps(l.x, l.z, label || l.name); closeAllPanels(); };
const bagLine = bag => DRUGS.filter(g => bag[g.id]).map(g => `${bag[g.id]} ${g.unit === 'oz' ? 'oz' : '×'} ${g.name}`).join(' · ') || 'nothing';
const tierTag = (t, tier) => t && tier < t ? `<span class="tag">Tier ${t}</span>` : '';

// ---------------------------------------------------------------- Bayline Realty
export function openRealty(app, focusId = null) {
  const s = game.s;
  let tab = focusId ? (TRAPS[focusId] ? 'traps' : LAND[focusId] ? 'land' : 'homes') : 'homes';
  openPanel((root, h) => {
    const tier = tierOf(s.rep).n, pf = portfolio(s);
    const tabs = [['homes', 'Houses'], ['land', 'Land'], ['traps', 'Trap houses']];
    const card = (id, title, desc, kv, actions, hot) => `<div class="card" style="${focusId === id ? 'border-color:var(--red)' : ''}"><h3>${esc(title)}</h3><p class="muted small">${esc(desc)}</p>
      <div class="kv">${kv}</div><div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap">${actions}<button class="btn btn-sm" data-action="gps" data-id="${id}" aria-label="GPS">📍</button></div>${hot || ''}</div>`;
    let body = '';
    if (tab === 'homes') {
      body = Object.entries(PROPERTIES).filter(([, p]) => !p.trap && !p.land).sort((a, b) => a[1].price - b[1].price).map(([id, p]) => {
        const owned = s.properties.includes(id), locked = p.tier && tier < p.tier;
        return card(id, p.name, p.desc, `<span>Garage</span><span>${p.slots} cars</span><span>Price</span><span>${p.price ? fmtMoney(p.price) : 'Rented'}</span>`,
          owned ? `<span class="tag tag-green">${s.home === id ? 'Home' : 'Owned'}</span>${s.home !== id ? `<button class="btn btn-sm" data-action="home" data-id="${id}">Make home</button>` : ''}${p.price ? `<button class="btn btn-sm" data-action="sell" data-id="${id}">Sell ${fmtMoney(Math.round(p.price * SELL_RATE))}</button>` : ''}`
            : `<button class="btn btn-sm btn-primary" data-action="buy" data-id="${id}" ${locked ? 'disabled' : ''}>${locked ? `Tier ${p.tier}` : `Buy ${fmtMoney(p.price)}`}</button>`);
      }).join('');
    } else if (tab === 'land') {
      body = Object.entries(LAND).map(([id, L]) => {
        const own = ownsLand(s, id), l = s.estate?.land?.[id], locked = L.tier && tier < L.tier;
        const status = !own ? '' : building(s, id) ? `Building: ${esc(PLAN_BY_ID[l.plan].name)} · ${Math.max(1, Math.ceil((l.ready - now(s)) / 60))} game hours left` : isBuilt(s, id) ? `Built: ${esc(PLAN_BY_ID[l.plan].name)}` : 'Empty. Go pick a build.';
        return card(id, L.name, L.desc, `<span>Price</span><span>${fmtMoney(L.price)}</span>${own ? `<span>Status</span><span>${status}</span>` : ''}`,
          own ? `<span class="tag tag-green">Owned</span><button class="btn btn-sm btn-primary" data-action="landgo" data-id="${id}">Build</button><button class="btn btn-sm" data-action="sellland" data-id="${id}">Sell ${fmtMoney(Math.round((L.price + (l.plan ? PLAN_BY_ID[l.plan].price : 0)) * LAND_SELL))}</button>`
            : `<button class="btn btn-sm btn-primary" data-action="buyland" data-id="${id}" ${locked ? 'disabled' : ''}>${locked ? `Tier ${L.tier}` : `Buy ${fmtMoney(L.price)}`}</button>`);
      }).join('') + `<p class="small muted" style="grid-column:1/-1">Buy a lot, then drive out to it and pick what Cowtown Custom Builders put up: a starter home up to a ten-car compound. It takes a few game days, then it's a home and a garage like any other.</p>`;
    } else {
      body = Object.entries(TRAPS).map(([id, T]) => {
        const owned = s.properties.includes(id), locked = T.tier && tier < T.tier;
        return card(id, T.name, T.desc, `<span>Garage</span><span>${T.slots} cars</span><span>Customers</span><span>${T.rush >= 1.2 ? 'Steady' : 'Slower'}</span><span>Attention</span><span>${T.risk >= 1 ? 'The block watches' : 'Quieter street'}</span>`,
          owned ? `<span class="tag tag-green">Owned</span><button class="btn btn-sm" data-action="sell" data-id="${id}">Sell ${fmtMoney(Math.round(T.price * SELL_RATE))}</button>`
            : `<button class="btn btn-sm btn-primary" data-action="buy" data-id="${id}" ${locked ? 'disabled' : ''}>${locked ? `Tier ${T.tier}` : `Buy ${fmtMoney(T.price)}`}</button>`);
      }).join('') + `<p class="small muted" style="grid-column:1/-1">Priya doesn't ask what the house is for. Stock it with product from the plug and customers knock while you're there. The more people you serve, the more the neighbours call it in.</p>`;
    }
    root.innerHTML = head('Bayline Realty', 'Priya Shah · "I sell garages with houses attached."') + `<div class="p-body">
      <div class="tabs" style="margin:0 -12px 10px">${tabs.map(([id, label]) => `<button class="${tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${label}</button>`).join('')}</div>
      ${pf.worth ? `<p class="small muted">Your real estate would sell for about <b>${fmtMoney(pf.worth)}</b>.</p>` : ''}
      <div class="grid">${body}</div><p class="small muted">Prices include closing costs. Every house is a safehouse and adds garage space. Each one after your first costs $120 a week in taxes and utilities.</p></div>`;
    const done = r => { if (say(r)) { app.world && applyEstate(app.world.map, s); h.refresh(); } };
    bind(root, {
      close: () => h.close(),
      tab: d => { tab = d.id; h.refresh(); },
      gps: d => gps(app, d.id),
      home: d => { s.home = d.id; h.refresh(); },
      buy: async d => { const p = PROPERTIES[d.id]; if (await confirm(`Buy ${p.name}?`, `<p>${fmtMoney(p.price)} · ${p.slots}-car garage.</p>`, 'Buy')) done(buyProperty(s, d.id)); },
      sell: async d => { const p = PROPERTIES[d.id]; if (await confirm(`Sell ${p.name}?`, `<p>Priya can get you <b>${fmtMoney(Math.round(p.price * SELL_RATE))}</b> for it.${p.trap ? ' Anything in the stash goes in your bag, the safe goes to your bank.' : ''}</p>`, 'Sell', true)) done(sellProperty(s, d.id)); },
      buyland: async d => { const L = LAND[d.id]; if (await confirm(`Buy ${L.name}?`, `<p>${fmtMoney(L.price)}. It's an empty lot until you build on it.</p>`, 'Buy')) done(buyLand(s, d.id)); },
      sellland: async d => { if (await confirm(`Sell ${LAND[d.id].name}?`, '<p>The land and anything you built on it.</p>', 'Sell', true)) done(sellLand(s, d.id)); },
      landgo: d => gps(app, d.id, LAND[d.id].name),
    });
  });
}

// ---------------------------------------------------------------- your land
export function openLand(loc, app) {
  const s = game.s, id = loc.id, L = LAND[id];
  if (!ownsLand(s, id)) { openRealty(app, id); return; }
  if (isBuilt(s, id) && !building(s, id) && s.properties.includes(id)) { homeScreen({ ...loc, type: 'property' }, app, s); return; }
  openPanel((root, h) => {
    const l = landState(s, id), tier = tierOf(s.rep).n;
    const cur = l.plan && PLAN_BY_ID[l.plan];
    const left = l.plan ? l.ready - now(s) : 0;
    root.innerHTML = head(L.name, 'Your land · Cowtown Custom Builders') + `<div class="p-body" style="max-width:720px">
      ${building(s, id) ? `<div class="li"><span>🏗</span><div class="grow"><div class="t">${esc(cur.name)} going up</div><div class="s">The crew is framing it now. Ready in about ${left >= 1440 ? `${Math.ceil(left / 1440)} game day${left >= 2880 ? 's' : ''}` : `${Math.max(1, Math.ceil(left / 60))} game hours`}. Sleep at home to skip ahead.</div></div></div>`
        : `<p class="muted">${cur ? `There's a ${esc(cur.name)} here. Build something bigger and the crew tears it down (you get 30% of it back as credit).` : 'Bare dirt and a survey stake. Pick what to build.'}</p>
      <div class="list">${PLANS.map(P => {
        const locked = P.tier && tier < P.tier, smaller = cur && PLANS.indexOf(P) <= PLANS.indexOf(cur);
        return `<div class="li"><div class="grow"><div class="t">${esc(P.name)} ${tierTag(P.tier, tier)}</div><div class="s">${esc(P.desc)}</div><div class="s">${P.slots}-car garage · ${P.days} game day${P.days > 1 ? 's' : ''} to build</div></div>
          <button class="btn btn-sm btn-primary" data-action="build" data-id="${P.id}" ${locked || smaller ? 'disabled' : ''}>${smaller ? (cur.id === P.id ? 'Built' : '—') : `Build ${fmtMoney(buildCost(s, id, P.id))}`}</button></div>`;
      }).join('')}</div>`}
      <p class="small muted">A finished house is a home and a safehouse with its own garage. Make it your home at Bayline Realty or just by walking in.</p></div>`;
    bind(root, {
      close: () => h.close(),
      build: async d => {
        const P = PLAN_BY_ID[d.id];
        if (!(await confirm(`Build a ${P.name}?`, `<p>${fmtMoney(buildCost(s, id, P.id))}. Ready in ${P.days} game day${P.days > 1 ? 's' : ''}.</p>`, 'Break ground'))) return;
        if (say(build(s, id, d.id))) { app.world && applyEstate(app.world.map, s); h.refresh(); }
      },
    });
  });
}

// ---------------------------------------------------------------- the trap house
export function openTrap(loc, app) {
  const s = game.s, id = loc.id, T = TRAPS[id];
  if (!s.properties.includes(id)) { openRealty(app, id); return; }
  const w = app.world;
  if (w && w.police.safehouse(w)) toast('You ducked into the trap. The cops lost you.', 'good');
  else if (w && w.police.phase === 'chase') { modal('Not now', '<p>They\'re right behind you. Lose them first.</p>'); return; }
  openPanel((root, h) => {
    const t = trapState(s, id), bag = ensureDrugs(s).bag, p = raidChance(s, id), [lbl, cls] = heatLabel(p);
    const closed = isClosed(s, id);
    root.innerHTML = head(T.name, `Trap house · ${T.slots}-car garage`) + `<div class="p-body" style="max-width:720px">
      ${closed ? `<p class="bad"><b>Boarded up.</b> SWAT hit this house. The plywood comes off on day ${t.closed}.</p>` : ''}
      <div class="stats-row"><div><div class="stat-lbl">Heat on the house</div><b class="${cls}">${lbl}</b></div><div><div class="stat-lbl">Served here</div><b>${t.served}</b></div><div><div class="stat-lbl">Safe</div><b class="${t.safe ? 'good' : ''}">${fmtMoney(t.safe)}</b></div></div>
      <div class="li"><span>📦</span><div class="grow"><div class="t">Stash</div><div class="s">${esc(bagLine(t.stash))}</div></div><button class="btn btn-sm" data-action="take" ${units(t.stash) ? '' : 'disabled'}>Take it</button></div>
      <div class="li"><span>🎒</span><div class="grow"><div class="t">Your bag</div><div class="s">${esc(bagLine(bag))}${units(bag) ? ' · <span class="warn">a search turns this into a charge</span>' : ''}</div></div><button class="btn btn-sm btn-primary" data-action="stash" ${units(bag) ? '' : 'disabled'}>Stash it</button></div>
      ${t.safe ? `<div class="li"><span>💰</span><div class="grow"><div class="t">The safe</div><div class="s">What your worker took in.</div></div><button class="btn btn-sm btn-primary" data-action="safe">Take ${fmtMoney(t.safe)}</button></div>` : ''}
      <div class="li"><span>🚪</span><div class="grow"><div class="t">Somebody on the door</div><div class="s">${fmtMoney(WORKER_PAY)} a day and ${Math.round(WORKER_CUT * 100)}% of every sale. He sells out of the stash while you're gone and the money goes in the safe. If SWAT hits it, he gives them your name.</div></div>
        <button class="btn btn-sm ${t.worker ? '' : 'btn-primary'}" data-action="worker" ${closed ? 'disabled' : ''}>${t.worker ? 'Let him go' : 'Hire'}</button></div>
      <div class="li"><span>🔧</span><div class="grow"><div class="t">Garage</div><div class="s">Switch cars, install parts.</div></div><button class="btn btn-sm" data-action="garage">Open</button></div>
      <p class="small muted">${closed ? '' : `Stay here on foot with product in the stash or your bag and customers knock${T.rush >= 1.2 ? ' (this block stays busy)' : ''}. Night brings more. Every one you serve makes the house hotter, and it cools off a little each day you lay low. Right now about ${(p * 100).toFixed(p < 0.1 ? 1 : 0)}% of customers could be the one that brings SWAT.`}</p></div>`;
    bind(root, {
      close: () => h.close(),
      stash: () => { const n = moveStash(s, id, true); toast(`Stashed ${n} unit${n > 1 ? 's' : ''}.`, 'good'); h.refresh(); },
      take: () => { const n = moveStash(s, id, false); toast(`${n} unit${n > 1 ? 's' : ''} in your bag. Don't get pulled over.`, 'info'); h.refresh(); },
      safe: () => { const v = t.safe; t.safe = 0; earn(s, v, `${T.name}: the safe`, { dirty: true }); h.refresh(); },
      worker: () => { t.worker = !t.worker; toast(t.worker ? 'Somebody\'s on the door now. Keep the stash stocked.' : 'You sent him home.', 'info'); h.refresh(); },
      garage: () => openGarage(app, { mode: 'home' }),
    });
  });
}

// ---------------------------------------------------------------- the plug
export function openPlug(loc, app) {
  const s = game.s;
  openPanel((root, h) => {
    const pr = prices(s), bag = ensureDrugs(s).bag, hr = (s.time.min / 60) % 24;
    root.innerHTML = head("Lil Tre's Corner Store", 'Stop Six · chips, Swishers, and the back room') + `<div class="p-body" style="max-width:720px">
      <p class="muted">"${hr >= 20 || hr < 5 ? 'Late night, huh. Come to the back.' : 'You know what I got. Prices move every day, so don\'t ask me yesterday\'s.'}"</p>
      <div class="list">${DRUGS.map(g => `<div class="li"><span class="swatch" style="background:${g.color};width:16px;height:16px;border-radius:50%"></span><div class="grow"><div class="t">${esc(g.name)} <span class="muted small">${esc(g.what)} · per ${esc(g.unit)}</span></div>
        <div class="s">Costs <b>${fmtMoney(pr[g.id].buy)}</b> · street pays about <b class="good">${fmtMoney(pr[g.id].street)}</b>${bag[g.id] ? ` · you have ${bag[g.id]}` : ''}</div></div>
        <div style="text-align:right;white-space:nowrap"><button class="btn btn-sm btn-primary" data-action="buy" data-id="${g.id}" data-n="1">Buy 1</button> <button class="btn btn-sm" data-action="buy" data-id="${g.id}" data-n="5">5</button>${bag[g.id] ? ` <button class="btn btn-sm" data-action="dump" data-id="${g.id}">Sell back</button>` : ''}</div></div>`).join('')}</div>
      <div class="section-title">In your bag</div><p>${esc(bagLine(bag))}</p>
      <p class="small muted">Sell it out of a trap house (Bayline Realty sells them). Get stopped with product on you and it's a charge: a little is possession, ${4} units or more reads as dealing. He buys back at half the street price.</p></div>`;
    bind(root, {
      close: () => h.close(),
      buy: d => { say(buy(s, d.id, +d.n)); h.refresh(); },
      dump: d => { say(dump(s, d.id, 1)); h.refresh(); },
    });
  });
}
