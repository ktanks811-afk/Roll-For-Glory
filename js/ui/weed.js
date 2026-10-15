// Screens for the legal weed business in Denver (core/weed.js): a dispensary
// (buy it, stock the shelf, set prices and staff), a grow farm (buy it,
// plant, harvest, the vault) and the Mile High phone app that lists them.

import { openPanel, closeAllPanels, bind, esc, toast, confirm, bar } from './dom.js';
import { game, fmtMoney } from '../core/state.js';
import { LOC_BY_ID } from '../data/world.js';
import { STRAINS, STRAIN_BY_ID, FARMS, SHOPS, FARM_IDS, SHOP_IDS, PRICE_LEVELS, BUDTENDER, TAX, LEGAL_OZ, SELL_BACK } from '../data/weed.js';
import * as W from '../core/weed.js';
import { audio } from '../core/audio.js';
import { openShipping, caseCard } from './traffick.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const say = r => { toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) audio.buy(); else audio.error(); return r.ok; };
const gps = (app, id) => { const l = LOC_BY_ID[id]; app.world?.setGps(l.x, l.z, l.name); closeAllPanels(); };
const dot = g => `<span class="swatch" style="background:${g.color};width:14px;height:14px;border-radius:50%;display:inline-block;vertical-align:middle"></span>`;
const jarLine = jar => Object.entries(jar || {}).filter(([, q]) => q > 0).map(([id, q]) => `${W.ozText(q)} ${STRAIN_BY_ID[id].name}`).join(' · ') || 'empty';
// a typical day for a shop, for the for-sale card: full shelf of mid-shelf flower at market prices
const estimate = id => { const oz = W.demandOz(id), gross = oz * W.shelfPrice(id, 'gsc'); return Math.round(gross * (1 - TAX) - W.staffNeeded(id) * BUDTENDER.pay - SHOPS[id].rent); };

// ---------------------------------------------------------------- dispensary
export function openDispensary(loc, app, { remote = false } = {}) {
  const s = game.s, id = loc.id, d = SHOPS[id];
  openPanel((root, h) => {
    const shop = W.shopOf(s, id);
    let body;
    if (!shop) {
      body = `<p class="muted">${esc(d.desc)}</p>
        <div class="card"><div class="kv">
          <span>Price</span><span><b>${fmtMoney(d.price)}</b></span>
          <span>Customers</span><span>about ${W.traffic(id)} a day</span>
          <span>Sells</span><span>about ${W.ozText(W.demandOz(id))} a day</span>
          <span>Budtenders</span><span>${W.staffNeeded(id)} at ${fmtMoney(BUDTENDER.pay)} a day each</span>
          <span>Rent and license</span><span>${fmtMoney(d.rent)} a day</span>
          <span>A good day</span><span class="good">about ${fmtMoney(estimate(id))} profit</span>
        </div>
        <div class="row" style="margin-top:10px">${remote ? '' : `<button class="btn btn-primary" data-action="buy">Buy it · ${fmtMoney(d.price)}</button>`}</div></div>
        <p class="small muted">Weed is legal in Colorado, so this is a real business: the profit goes in your bank clean, after the ${Math.round(TAX * 100)}% retail marijuana tax. Keep the shelf stocked from your own grow farm (cheapest) or the wholesale distributor.</p>`;
    } else {
      const t = shop.today, need = W.staffNeeded(id, shop.level), shelf = W.total(shop.shelf), daily = W.demandOz(id, shop.level);
      const rows = STRAINS.map(g => `<div class="li">${dot(g)}<div class="grow"><div class="t">${esc(g.name)} <span class="muted small">${esc(g.kind)}</span></div>
        <div class="s">${shop.shelf[g.id] ? `<b>${W.ozText(shop.shelf[g.id])}</b> on the shelf · ` : ''}sells for ${fmtMoney(W.shelfPrice(id, g.id, shop.level))}/oz · distributor ${fmtMoney(W.distributorPrice(g.id))}/oz</div></div>
        <div style="white-space:nowrap"><button class="btn btn-sm" data-action="stock" data-id="${g.id}" data-n="10">+10 oz</button> <button class="btn btn-sm" data-action="stock" data-id="${g.id}" data-n="50">+50</button></div></div>`).join('');
      body = `${t ? `<div class="card"><h3>Yesterday</h3><div class="kv">
          <span>Customers</span><span>${t.customers}${t.walked ? ` <span class="warn small">(${t.walked} walked out)</span>` : ''}</span>
          <span>Sold</span><span>${W.ozText(t.oz)}</span>
          <span>Sales</span><span>${fmtMoney(t.gross)}</span>
          <span>Tax, payroll, rent</span><span>−${fmtMoney(t.tax + t.payroll + t.rent)}</span>
          <span>Profit</span><span class="${t.net >= 0 ? 'good' : 'bad'}"><b>${fmtMoney(t.net)}</b></span></div></div>` : '<p class="muted">First day open. Sales settle up every morning.</p>'}
        <div class="card"><h3>The shelf</h3>
          <p>${shelf ? `<b>${W.ozText(shelf)}</b>, about ${Math.max(0, Math.round(shelf / daily * 10) / 10)} days of sales` : '<span class="bad">Empty. Nobody buys from an empty shelf.</span>'}</p>
          <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn btn-sm btn-primary" data-action="farms">Restock from my farms</button>
          <button class="btn btn-sm" data-action="supply">${shop.supply ? '✓ Farms restock it every morning' : 'Farms restock it every morning: off'}</button>
          ${shelf ? '<button class="btn btn-sm btn-danger" data-action="texas">🚚 Ship to Texas</button>' : ''}</div></div>
        <div class="card"><h3>Prices</h3><div class="row" style="gap:6px;flex-wrap:wrap">${PRICE_LEVELS.map(l => `<button class="btn btn-sm ${shop.level === l.id ? 'btn-primary' : ''}" data-action="level" data-id="${l.id}">${esc(l.name)}</button>`).join('')}</div>
          <p class="small muted">${esc(PRICE_LEVELS.find(l => l.id === shop.level).blurb)} About ${W.traffic(id, shop.level)} customers a day.</p></div>
        <div class="card"><h3>Budtenders</h3><div class="row" style="gap:8px;align-items:center"><button class="btn btn-sm" data-action="staff" data-n="-1">−</button><b>${shop.staff}</b><button class="btn btn-sm" data-action="staff" data-n="1">+</button>
          <span class="small ${shop.staff < need ? 'warn' : 'muted'}">${need} needed for the crowd · ${fmtMoney(BUDTENDER.pay)} a day each · each serves ${BUDTENDER.serves}</span></div></div>
        <div class="section-title">Stock it from the wholesale distributor</div><div class="list">${rows}</div>
        <div class="row" style="margin-top:12px">${remote ? '' : `<button class="btn btn-danger btn-sm" data-action="sell">Sell the shop · ${fmtMoney(Math.round(d.price * SELL_BACK))}</button>`}</div>`;
    }
    root.innerHTML = head(d.name, `Denver, CO · ${shop ? 'your dispensary' : 'for sale'}`) + `<div class="p-body" style="max-width:760px">${body}</div>`;
    bind(root, {
      close: () => h.close(),
      buy: () => { say(W.buyShop(s, id)); h.refresh(); },
      stock: dd => { say(W.buyStock(s, id, dd.id, +dd.n)); h.refresh(); },
      farms: () => { say(W.restockFromFarms(s, id)); h.refresh(); },
      supply: () => { say(W.setSupply(s, id, !shop.supply)); h.refresh(); },
      texas: () => openShipping(app, `shop:${id}`),
      level: dd => { say(W.setLevel(s, id, dd.id)); h.refresh(); },
      staff: dd => { W.setStaff(s, id, shop.staff + +dd.n); h.refresh(); },
      sell: async () => { if (await confirm('Sell the shop?', `<p>${esc(d.name)} sells for ${fmtMoney(Math.round(d.price * SELL_BACK))}. What's on the shelf goes with it.</p>`, 'Sell', true)) { say(W.sellShop(s, id)); h.refresh(); } },
    });
  });
}

// ---------------------------------------------------------------- grow farm
export function openGrowFarm(loc, app, { remote = false } = {}) {
  const s = game.s, id = loc.id, f = FARMS[id];
  openPanel((root, h) => {
    const farm = W.ensureWeed(s).farms[id];
    let body;
    if (!farm) {
      body = `<p class="muted">${esc(f.desc)}</p>
        <div class="card"><div class="kv">
          <span>Price</span><span><b>${fmtMoney(f.price)}</b></span>
          <span>Type</span><span>${esc(f.kind)}</span>
          <span>Holds</span><span>${f.plants.toLocaleString()} plants</span>
          <span>Upkeep</span><span>${fmtMoney(f.upkeep)} a day (power, water, the license)</span>
          <span>A Blue Dream crop</span><span>${W.growDays(id, 'bluedream')} days, about ${W.ozText(W.expectedYield(id, 'bluedream', f.plants))}</span>
          ${f.storm ? '<span>Weather</span><span class="warn">Outdoor: hail can take part of a crop</span>' : ''}
        </div>
        <div class="row" style="margin-top:10px">${remote ? '' : `<button class="btn btn-primary" data-action="buy">Buy it · ${fmtMoney(f.price)}</button>`}</div></div>
        <p class="small muted">Grow it, then stock your own dispensaries (the shelf price is about twice what a processor pays), sell it wholesale, or bag some up. It's legal here; in Texas it's loud and it's a charge.</p>`;
    } else {
      const c = farm.crop, ready = W.isReady(s, id), vault = W.total(farm.vault);
      const crop = c ? `<div class="card"><h3>${dot(STRAIN_BY_ID[c.strain])} ${c.plants.toLocaleString()} ${esc(STRAIN_BY_ID[c.strain].name)}</h3>
          ${bar(W.growth(s, id) * 100, ready ? 'good' : '')}
          <p class="small">${ready ? '<b class="good">Ready to harvest.</b>' : `Planted day ${c.planted} · ready day ${c.ready} (it's day ${s.time.day})`}${c.hail ? ` · <span class="warn">hail took about ${Math.round(c.hail * 100)}%</span>` : ''}</p>
          <p class="small muted">Expect about ${W.ozText(W.expectedYield(id, c.strain, c.plants) * (1 - (c.hail || 0)))}.</p>
          ${ready ? '<button class="btn btn-primary" data-action="harvest">Harvest</button>' : ''}</div>`
        : `<div class="section-title">Put a crop in · ${f.plants.toLocaleString()} plants</div><div class="list">${STRAINS.map(g => `<div class="li">${dot(g)}<div class="grow"><div class="t">${esc(g.name)} <span class="muted small">${esc(g.kind)} · ${W.growDays(id, g.id)} days</span></div>
          <div class="s">${esc(g.blurb)} About ${W.ozText(W.expectedYield(id, g.id, f.plants))}, worth ${fmtMoney(Math.round(W.expectedYield(id, g.id, f.plants) * g.wholesale))} wholesale or ${fmtMoney(Math.round(W.expectedYield(id, g.id, f.plants) * g.retail))} on a shelf.</div></div>
          <div style="text-align:right;white-space:nowrap"><button class="btn btn-sm btn-primary" data-action="plant" data-id="${g.id}" data-n="${f.plants}">Plant all · ${fmtMoney(W.cloneCost(g.id, f.plants))}</button> <button class="btn btn-sm" data-action="plant" data-id="${g.id}" data-n="${Math.ceil(f.plants / 2)}">Half</button></div></div>`).join('')}</div>`;
      const shops = W.myShops(s);
      body = `${crop}
        <div class="card"><h3>The vault</h3><p>${vault ? esc(jarLine(farm.vault)) : 'Empty.'}</p>
          ${vault ? `<div class="row" style="gap:6px;flex-wrap:wrap">
            ${shops.length ? '<button class="btn btn-sm btn-primary" data-action="ship">Ship to my dispensaries</button>' : ''}
            <button class="btn btn-sm btn-danger" data-action="texas">🚚 Ship to Texas</button>
            <button class="btn btn-sm" data-action="wholesale">Sell it all wholesale · ${fmtMoney(Math.round(Object.entries(farm.vault).reduce((t, [k, q]) => t + q * STRAIN_BY_ID[k].wholesale, 0)))}</button>
            ${remote ? '' : `<button class="btn btn-sm" data-action="bag" data-n="1">Bag 1 oz</button><button class="btn btn-sm" data-action="bag" data-n="${LEGAL_OZ}">Bag ${LEGAL_OZ} oz</button><button class="btn btn-sm" data-action="bag" data-n="10">Bag 10 oz</button>`}</div>
            <p class="small muted">Up to ${LEGAL_OZ} oz on you is legal in Colorado. More than that, or any at all back in Texas, and it's a charge if you get searched. Texas street pays well for it out of a trap.</p>` : ''}</div>
        <div class="card"><h3>Head grower</h3><p class="small">${farm.grower ? 'On the payroll: he harvests the day it\'s ready and puts the same strain right back in (you pay for the clones).' : 'Nobody. You harvest and replant yourself.'}</p>
          <button class="btn btn-sm ${farm.grower ? '' : 'btn-primary'}" data-action="grower">${farm.grower ? 'Let him go' : `Hire one · ${fmtMoney(f.wage)} a day`}</button></div>
        ${farm.last ? `<p class="small muted">Last harvest: ${W.ozText(farm.last.oz)} of ${esc(STRAIN_BY_ID[farm.last.strain].name)} on day ${farm.last.day}.</p>` : ''}
        <p class="small muted">Upkeep ${fmtMoney(f.upkeep)} a day${farm.grower ? ` + the grower's ${fmtMoney(f.wage)}` : ''}.</p>
        <div class="row" style="margin-top:12px">${remote ? '' : `<button class="btn btn-danger btn-sm" data-action="sell">Sell the farm · ${fmtMoney(Math.round(f.price * SELL_BACK))}</button>`}</div>`;
    }
    root.innerHTML = head(f.name, `${esc(f.kind)} grow · Colorado · ${farm ? 'yours' : 'for sale'}`) + `<div class="p-body" style="max-width:760px">${body}</div>`;
    bind(root, {
      close: () => h.close(),
      buy: () => { say(W.buyFarm(s, id)); h.refresh(); },
      plant: dd => { say(W.plant(s, id, dd.id, +dd.n)); h.refresh(); },
      harvest: () => { say(W.harvest(s, id)); h.refresh(); },
      ship: () => { const rs = W.myShops(s).map(sid => W.restockFromFarms(s, sid, Math.ceil(W.total(farm.vault) / Math.max(1, W.myShops(s).length)))); const oz = rs.reduce((t, r) => t + (r.oz || 0), 0); say(oz ? { ok: true, text: `${W.ozText(oz)} shipped to your dispensaries.` } : rs[0]); h.refresh(); },
      wholesale: () => { say(W.sellWholesale(s, id)); h.refresh(); },
      texas: () => openShipping(app, `farm:${id}`),
      bag: dd => { say(W.takeToBag(s, id, +dd.n)); h.refresh(); },
      grower: () => { say(W.setGrower(s, id, !farm.grower)); h.refresh(); },
      sell: async () => { if (await confirm('Sell the farm?', `<p>${esc(f.name)} sells for ${fmtMoney(Math.round(f.price * SELL_BACK))}. Whatever's growing or in the vault goes with it.</p>`, 'Sell', true)) { say(W.sellFarm(s, id)); h.refresh(); } },
    });
  });
}

// ---------------------------------------------------------------- the Mile High app
// Everything you own in Colorado at a glance, and what's still for sale.
export function openWeedApp(app) {
  const s = game.s;
  openPanel((root, h) => {
    const w = W.ensureWeed(s), farms = W.myFarms(s), shops = W.myShops(s);
    const farmRow = fid => { const farm = w.farms[fid], c = farm.crop;
      return `<div class="li"><div class="grow"><div class="t">🌱 ${esc(FARMS[fid].name)}</div><div class="s">${c ? `${c.plants.toLocaleString()} ${esc(STRAIN_BY_ID[c.strain].name)} · ${W.isReady(s, fid) ? '<b class="good">ready</b>' : `ready day ${c.ready}`}` : '<span class="warn">Nothing planted</span>'} · vault ${esc(jarLine(farm.vault))}</div></div>
        <button class="btn btn-sm" data-action="farm" data-id="${fid}">Manage</button> <button class="btn btn-sm" data-action="gps" data-id="${fid}">📍</button></div>`; };
    const shopRow = sid => { const sh = w.shops[sid], t = sh.today;
      return `<div class="li"><div class="grow"><div class="t">🏪 ${esc(SHOPS[sid].name)}</div><div class="s">Shelf ${W.ozText(W.total(sh.shelf))}${t ? ` · yesterday ${t.customers} customers, <span class="${t.net >= 0 ? 'good' : 'bad'}">${fmtMoney(t.net)}</span>` : ''}</div></div>
        <button class="btn btn-sm" data-action="shop" data-id="${sid}">Manage</button> <button class="btn btn-sm" data-action="gps" data-id="${sid}">📍</button></div>`; };
    const forSale = [...FARM_IDS.filter(x => !farms.includes(x)).map(x => [x, FARMS[x].name, FARMS[x].price, `${FARMS[x].kind} grow, ${FARMS[x].plants.toLocaleString()} plants`]),
      ...SHOP_IDS.filter(x => !shops.includes(x)).map(x => [x, SHOPS[x].name, SHOPS[x].price, `Dispensary, about ${W.traffic(x)} customers a day`])];
    root.innerHTML = head('Mile High', 'Your cannabis business in Denver, Colorado') + `<div class="p-body" style="max-width:760px">
      <div class="kv"><span>Sold over the counter</span><span>${W.ozText(w.sold)}</span><span>Dispensary profit</span><span class="good">${fmtMoney(w.earned)}</span><span>Harvested</span><span>${W.ozText(w.harvested)}</span></div>
      ${farms.length || shops.length ? `<div class="row" style="margin:10px 0"><button class="btn btn-danger" data-action="texas">🚚 Ship to Texas</button></div>${caseCard(s)}` : ''}
      ${farms.length ? `<div class="section-title">Your farms</div><div class="list">${farms.map(farmRow).join('')}</div>` : ''}
      ${shops.length ? `<div class="section-title">Your dispensaries</div><div class="list">${shops.map(shopRow).join('')}</div>` : ''}
      ${!farms.length && !shops.length ? '<p class="muted">Weed is legal in Colorado. Fly to Denver from Alliance Airport, buy a grow farm and a dispensary, and run it.</p>' : ''}
      ${forSale.length ? `<div class="section-title">For sale in Colorado</div><div class="list">${forSale.map(([x, n, p, what]) => `<div class="li"><div class="grow"><div class="t">${esc(n)}</div><div class="s">${esc(what)} · ${fmtMoney(p)}</div></div><button class="btn btn-sm" data-action="gps" data-id="${x}">📍 GPS</button></div>`).join('')}</div>` : ''}
      <p class="small muted">Sales settle every morning. Buy in person; once it's yours, you can run it from here.</p></div>`;
    bind(root, {
      close: () => h.close(),
      gps: dd => gps(app, dd.id),
      farm: dd => openGrowFarm(LOC_BY_ID[dd.id], app, { remote: true }),
      shop: dd => openDispensary(LOC_BY_ID[dd.id], app, { remote: true }),
      texas: () => openShipping(app),
    });
  });
}
