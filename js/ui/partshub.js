// PartsHub — online performance parts store. Real brands, real-ish prices,
// fitment checks against your car, cart, tax, shipping, and delivery to
// your door next morning (freight takes longer). In a shop it doubles as the
// parts counter: buy and have it installed on the spot.

import { openPanel, bind, esc, toast, modal, confirm } from './dom.js';
import { game, fmtMoney, spend, activeCar, carSpec, modelOf, uid } from '../core/state.js';
import { CATALOG, PERF_CATALOG, VISUAL_CATALOG, ITEM_BY_ID, CATEGORY_NAMES, fits, fitNote, shippingFor, deliveryDays, SALES_TAX, LABOR_RATE } from '../data/catalog.js';
import { partLevels, FX, PERF_IDS } from '../data/parts.js';
import { buildSpec } from '../sim/powertrain.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { installPart, pickColorFor } from './garage.js';
import { audio } from '../core/audio.js';

const PERF_CATS = ['engine', 'turbo', 'supercharger', 'intake', 'exhaust', 'intercooler', 'fuel', 'ecu', 'transmission', 'clutch', 'diff', 'suspension', 'brakes', 'tires', 'weight', 'nitrous', 'twostep'];
const VIS_CATS = ['wheels', 'paint', 'tint', 'spoiler', 'kit', 'frontBumper', 'rearBumper', 'skirts', 'hood', 'exhaustTips', 'headlights', 'taillights', 'decal', 'neon', 'interior'];
const ICONS = { engine: '⚙', turbo: '🌀', supercharger: '🔩', intake: '🌬', exhaust: '💨', intercooler: '❄', fuel: '⛽', ecu: '💻', transmission: '⚙', clutch: '◎', diff: '⊕', suspension: '⇕', brakes: '⛔', tires: '◯', weight: '⚖', nitrous: '🧪', twostep: '🔥',
  wheels: '◉', paint: '🎨', tint: '▦', spoiler: '⎺', kit: '▭', frontBumper: '▔', rearBumper: '▁', skirts: '═', hood: '▱', exhaustTips: '◍', headlights: '💡', taillights: '🔴', decal: '✦', neon: '✺', interior: '💺' };

const view = { tab: 'shop', cat: 'turbo', brand: '', q: '', fitOnly: true, sort: 'pop' };

export function openPartsHub(app, opts = {}) {
  const store = opts.store || null;
  if (opts.cat) view.cat = opts.cat;       // 'perf' | 'visual' when used at a shop counter
  if (store === 'visual' && PERF_CATS.includes(view.cat)) view.cat = 'wheels';
  if (store === 'perf' && VIS_CATS.includes(view.cat)) view.cat = 'turbo';
  return openPanel((root, h) => render(root, h, app, store));
}

function effectText(it, car) {
  const L = it.stage;
  switch (it.cat) {
    case 'tires': return `Grip +${Math.round((FX.tires.mu[L] - 1) * 100)}%`;
    case 'weight': return `−${Math.round((1 - FX.weight.mult[L]) * (car ? modelOf(car).kg : 1500))} kg`;
    case 'transmission': return `Shifts ${FX.transmission.shift[L].toFixed(2)}s`;
    case 'clutch': return `Holds ${FX.clutch.cap[L]}× stock torque`;
    case 'diff': return `Traction +${Math.round((FX.diff.trac[L] - 1) * 100)}%`;
    case 'suspension': return `Handling +${Math.round((FX.suspension.handling[L] - 1) * 100)}%`;
    case 'brakes': return `Braking +${Math.round((FX.brakes.force[L] - 1) * 100)}%`;
    case 'nitrous': return `${FX.nitrous.hp[L]} hp shot`;
    case 'twostep': return `Holds launch rpm ±${FX.twostep.tol[L]} · ${['', 'small pops', 'flames', 'big flames', 'huge flames'][L]}`;
    case 'exhaust': return it.db != null ? `+${it.db} dB louder${it.db >= 14 ? ' · too loud for the street' : ''}` : '';
    case 'fuel': return `Supports ${Math.round((FX.fuel.cap[L] - 1) * 100)}% over stock`;
    default: return '';
  }
}

const gainCache = new Map();
function hpGain(it, car) {
  if (!car || !['engine', 'turbo', 'supercharger', 'intake', 'exhaust', 'intercooler', 'ecu', 'fuel'].includes(it.cat)) return null;
  const key = car.uid + JSON.stringify(car.parts) + it.id;
  if (gainCache.has(key)) return gainCache.get(key);
  const m = modelOf(car);
  const lv = partLevels(car.parts);
  const base = carSpec(car).hp;
  const lv2 = { ...lv, [it.cat]: it.stage };
  if (it.cat === 'turbo') lv2.supercharger = 0;
  if (it.cat === 'supercharger') lv2.turbo = 0;
  const hp = buildSpec(m, lv2, car.cond, car.tune, car.visual).hp;
  const out = { delta: hp - base, limited: buildSpec(m, lv2, car.cond, car.tune, car.visual).fuelLimited };
  gainCache.set(key, out);
  return out;
}

function render(root, h, app, store) {
  const s = game.s;
  const car = activeCar(s);
  const m = car ? modelOf(car) : null;
  s.cart ??= [];
  const cats = store === 'visual' ? VIS_CATS : store === 'perf' ? PERF_CATS : [...PERF_CATS, ...VIS_CATS];
  if (!cats.includes(view.cat)) view.cat = cats[0];
  const counts = Object.fromEntries(cats.map(c => [c, CATALOG.filter(p => p.cat === c).length]));
  const title = store === 'perf' ? 'Torque Temple — Parts Counter' : store === 'visual' ? 'Vega Kustoms — Body, Paint & Wheels' : 'PartsHub';
  const subtitle = store ? 'In stock · installed today · shop labor $' + LABOR_RATE + '/hr · in-store pricing +10%' : `${CATALOG.length} parts from ${new Set(CATALOG.map(p => p.brand)).size} brands · ships to your door · free shipping over $1,500`;
  root.innerHTML = `<div class="p-head"><h1><span style="color:var(--red2)">${store ? '' : 'PARTS'}</span>${store ? esc(title) : 'HUB'}<small>${esc(subtitle)}</small></h1>
    <span class="muted small">${car ? `Shopping for: <b style="color:#fff">${esc(carName(m, car.year))}</b>` : 'No car — fitment not checked'}</span>
    <button class="btn x" data-action="close">×</button></div>
    ${store ? '' : `<div class="tabs">${[['shop', 'Shop'], ['cart', `Cart (${s.cart.length})`], ['bin', `My Parts (${s.partsBin.length})`]].map(([id, l]) => `<button class="${view.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${l}</button>`).join('')}</div>`}
    <div class="p-body" style="padding:0" data-body></div>`;
  const body = root.querySelector('[data-body]');
  const tab = store ? 'shop' : view.tab;
  if (tab === 'shop') renderShop(body, h, s, car, cats, counts, store, app);
  if (tab === 'cart') renderCart(body, h, s, car);
  if (tab === 'bin') renderBin(body, h, s);
  bind(root.querySelector('.p-head'), { close: () => h.close() });
  const tabs = root.querySelector('.tabs');
  if (tabs) bind(tabs, { tab: d => { view.tab = d.id; h.refresh(); } });
}

function renderShop(body, h, s, car, cats, counts, store, app) {
  const m = car ? modelOf(car) : null;
  let items = CATALOG.filter(p => p.cat === view.cat);
  const brands = [...new Set(items.map(p => p.brand))].sort();
  if (view.brand && !brands.includes(view.brand)) view.brand = '';
  if (view.brand) items = items.filter(p => p.brand === view.brand);
  if (view.q) { const q = view.q.toLowerCase(); items = CATALOG.filter(p => cats.includes(p.cat) && (`${p.brand} ${p.name}`).toLowerCase().includes(q)); }
  if (view.fitOnly && m) items = items.filter(p => fits(p, m));
  items = [...items].sort((a, b) => view.sort === 'low' ? a.price - b.price : view.sort === 'high' ? b.price - a.price : view.sort === 'stage' ? b.stage - a.stage || a.price - b.price : (a.stage - b.stage) || (a.price - b.price));
  const installed = car ? new Set([...Object.values(car.parts)]) : new Set();
  const mult = store ? 1.1 : 1;
  body.innerHTML = `<div class="shop"><div class="shop-side">
      <div class="section-title" style="margin-top:4px">Performance</div>${cats.filter(c => PERF_CATS.includes(c)).map(c => `<button class="${view.cat === c && !view.q ? 'on' : ''}" data-action="cat" data-c="${c}">${ICONS[c]} ${CATEGORY_NAMES[c]}<small>${counts[c]}</small></button>`).join('')}
      ${cats.some(c => VIS_CATS.includes(c)) ? `<div class="section-title">Looks</div>${cats.filter(c => VIS_CATS.includes(c)).map(c => `<button class="${view.cat === c && !view.q ? 'on' : ''}" data-action="cat" data-c="${c}">${ICONS[c]} ${CATEGORY_NAMES[c]}<small>${counts[c]}</small></button>`).join('')}` : ''}
    </div><div class="shop-main">
      <div class="row" style="margin-bottom:10px">
        <input class="input grow" data-q placeholder="Search parts or brands (Garrett, Brembo, Borla…)" value="${esc(view.q)}" style="min-width:180px">
        <select class="input" data-brand style="width:auto"><option value="">All brands (${brands.length})</option>${brands.map(b => `<option ${view.brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
        <select class="input" data-sort style="width:auto">${[['pop', 'Stage ↑'], ['stage', 'Stage ↓'], ['low', 'Price ↑'], ['high', 'Price ↓']].map(([v, l]) => `<option value="${v}" ${view.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${m ? `<label class="row small" style="gap:4px"><input type="checkbox" data-fit ${view.fitOnly ? 'checked' : ''}> Fits my ${esc(m.model)}</label>` : ''}
      </div>
      ${view.q ? `<p class="small muted">${items.length} results for "${esc(view.q)}" <a href="#" data-action="clearq" style="color:var(--red2)">clear</a></p>` : `<h2 style="margin:0 0 8px;font-family:var(--head)">${CATEGORY_NAMES[view.cat]}</h2>`}
      <div class="list">${items.map(p => {
        const ok = !m || fits(p, m);
        const gain = ok ? hpGain(p, car) : null;
        const eff = (gain ? `${gain.delta >= 0 ? '+' : ''}${gain.delta} hp${gain.limited ? ' (fuel-limited!)' : ''}` : effectText(p, car)) + (gain && p.cat === 'exhaust' ? ` · ${effectText(p, car)}` : '');
        const isOn = installed.has(p.id);
        const price = Math.round(p.price * mult);
        return `<div class="li prod"><div class="prod-img">${ICONS[p.cat]}</div>
          <div class="grow"><div class="brand">${esc(p.brand)}</div><div class="name">${esc(p.name)}</div>
            <div class="row small" style="gap:6px;margin-top:2px">${p.visual ? '' : `<span class="stage stage-${p.stage}">STAGE ${p.stage}</span>`}${eff ? `<span class="${gain && gain.delta > 0 ? 'good' : 'muted'}">${esc(eff)}</span>` : ''}
            <span class="muted">· ${p.labor}h install</span>${!ok ? `<span class="bad">· ${esc(fitNote(p, m))}</span>` : ''}${isOn ? '<span class="tag tag-green">Installed</span>' : ''}</div></div>
          <div style="text-align:right"><div class="price" style="font-family:var(--head);font-size:20px;font-weight:700">${fmtMoney(price)}</div>
            ${store ? `<button class="btn btn-sm btn-primary" data-action="buyinstall" data-id="${p.id}" ${!car || !ok ? 'disabled' : ''}>Buy + install ${fmtMoney(price + p.labor * LABOR_RATE)}</button>`
              : `<button class="btn btn-sm btn-primary" data-action="add" data-id="${p.id}">Add to cart</button>`}</div></div>`;
      }).join('') || '<div class="empty">Nothing here fits your car. Untick "Fits my car" to browse anyway.</div>'}</div>
    </div></div>`;
  const q = body.querySelector('[data-q]');
  q.onkeydown = e => { if (e.key === 'Enter') { view.q = q.value.trim(); h.refresh(); } };
  q.onchange = () => { view.q = q.value.trim(); h.refresh(); };
  body.querySelector('[data-brand]').onchange = e => { view.brand = e.target.value; h.refresh(); };
  body.querySelector('[data-sort]').onchange = e => { view.sort = e.target.value; h.refresh(); };
  const fit = body.querySelector('[data-fit]'); if (fit) fit.onchange = () => { view.fitOnly = fit.checked; h.refresh(); };
  bind(body, {
    cat: d => { view.cat = d.c; view.q = ''; view.brand = ''; h.refresh(); body.querySelector('.shop-main')?.scrollTo(0, 0); },
    clearq: () => { view.q = ''; h.refresh(); },
    add: d => { s.cart.push(d.id); audio.buy(); toast(`Added ${ITEM_BY_ID[d.id].brand} ${ITEM_BY_ID[d.id].name}`, 'good'); h.refresh(); },
    buyinstall: async d => {
      const p = ITEM_BY_ID[d.id];
      const w = app.world;
      if (w?.vehicle && w.vehicle.car === car) {
        const loc = w.nearLoc;
        if (!loc || Math.hypot(w.vehicle.x - loc.x, w.vehicle.z - loc.z) > 60) { modal('Bring your car', '<p>Your car needs to be here at the shop for them to install it. Drive it over (park near the entrance).</p>'); return; }
      }
      const price = Math.round(p.price * 1.1);
      const labor = p.labor * LABOR_RATE;
      const color = await pickColorFor(p);
      if (color === null) return;
      if (!(await confirm('Buy & install?', `<p><b>${esc(p.brand)} ${esc(p.name)}</b></p><div class="kv"><span>Part</span><span>${fmtMoney(price)}</span><span>Tax</span><span>${fmtMoney(price * SALES_TAX)}</span><span>Labor (${p.labor}h)</span><span>${fmtMoney(labor)}</span><span>Total</span><span>${fmtMoney(price * (1 + SALES_TAX) + labor)}</span></div>`, 'Buy & install'))) return;
      if (!spend(s, price * (1 + SALES_TAX) + labor, `${p.brand} ${p.name} (installed)`)) return;
      installPart(s, car, p.id, { color, app });
      h.refresh();
    },
  });
}

function totals(s) {
  const items = s.cart.map(id => ITEM_BY_ID[id]).filter(Boolean);
  const sub = items.reduce((a, p) => a + p.price, 0);
  const ship = shippingFor(sub, items);
  const tax = sub * SALES_TAX;
  return { items, sub, ship, tax, total: sub + ship + tax, days: deliveryDays(items) };
}

function renderCart(body, h, s, car) {
  const t = totals(s);
  const m = car ? modelOf(car) : null;
  body.innerHTML = `<div class="p-body">${t.items.length ? `<div class="list">${t.items.map((p, i) => `<div class="li"><div class="prod-img">${ICONS[p.cat]}</div><div class="grow"><div class="t">${esc(p.brand)} ${esc(p.name)}</div><div class="s">${CATEGORY_NAMES[p.cat]}${m && !fits(p, m) ? ` · <span class="bad">${esc(fitNote(p, m))} (for your ${esc(m.model)})</span>` : ''}</div></div><b>${fmtMoney(p.price)}</b><button class="btn btn-sm" data-action="rm" data-i="${i}">✕</button></div>`).join('')}</div>
    <div style="max-width:360px;margin:16px 0 0 auto"><div class="kv"><span>Subtotal</span><span>${fmtMoney(t.sub, true)}</span><span>Shipping</span><span>${t.ship ? fmtMoney(t.ship, true) : 'FREE'}</span><span>Sales tax (7.25%)</span><span>${fmtMoney(t.tax, true)}</span><span><b>Total</b></span><span style="font-size:20px">${fmtMoney(t.total, true)}</span></div>
    <p class="small muted">⚡ Instant delivery: the parts land in My Parts the moment you order. Install at home (DIY, ≤6h jobs) or at Torque Temple / Vega Kustoms.</p>
    <button class="btn btn-primary" style="width:100%" data-action="checkout">Place order · ${fmtMoney(t.total, true)}</button></div>` : '<div class="empty">Your cart is empty.</div>'}</div>`;
  bind(body, {
    rm: d => { s.cart.splice(+d.i, 1); h.refresh(); },
    checkout: () => {
      if (!spend(s, t.total, `PartsHub order (${t.items.length} item${t.items.length > 1 ? 's' : ''})`)) return;
      // instant delivery: straight into your parts bin
      for (const p of t.items) s.partsBin.push({ pid: p.id, uid: uid('b') });
      s.cart = [];
      audio.buy();
      toast(`⚡ Delivered: ${t.items.length} part${t.items.length > 1 ? 's' : ''} in My Parts`, 'good');
      view.tab = 'bin'; h.refresh();
    },
  });
}

function renderOrders(body, h, s) {
  body.innerHTML = `<div class="p-body">${s.orders.length ? `<div class="list">${s.orders.map(o => `<div class="li"><div class="grow"><div class="t">Order ${o.id.slice(-6).toUpperCase()} · ${fmtMoney(o.total, true)}</div><div class="s">${o.items.map(id => esc(ITEM_BY_ID[id]?.brand + ' ' + ITEM_BY_ID[id]?.name)).join(' · ')}</div></div><span class="tag tag-yellow">Arrives day ${o.arriveDay}, 8 AM</span></div>`).join('')}</div>` : '<div class="empty">No orders on the way.</div>'}</div>`;
}

function renderBin(body, h, s) {
  body.innerHTML = `<div class="p-body">${s.partsBin.length ? `<div class="list">${s.partsBin.map(b => { const p = ITEM_BY_ID[b.pid]; return `<div class="li"><div class="prod-img">${ICONS[p.cat]}</div><div class="grow"><div class="t">${esc(p.brand)} ${esc(p.name)}</div><div class="s">${CATEGORY_NAMES[p.cat]} · ${p.labor}h install${p.labor > 6 || p.shopOnly ? ' (shop install)' : ''}</div></div></div>`; }).join('')}</div><p class="small muted">Install these from your Garage at home, or at Torque Temple / Vega Kustoms.</p>` : '<div class="empty">No uninstalled parts. Parts you order show up here instantly.</div>'}</div>`;
}
