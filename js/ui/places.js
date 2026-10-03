// Every "press E" location in Fort Worth.

import { openPanel, closePanel, closeAllPanels, bind, esc, toast, modal, confirm, bar } from './dom.js';
import { game, fmtMoney, spend, earn, activeCar, carSpec, carValue, modelOf, newCar, garageCapacity, tierOf, isNight, hourOf, needsPremium, tankGallons, getCar, carMetrics, addRep } from '../core/state.js';
import { CARS, CAR_BY_ID, carName, soldNew, MAKES, CURRENT_YEAR } from '../data/cars.js';
import { PROPERTIES, LOC_BY_ID, GAS } from '../data/world.js';
import { CLOTHES, CLOTH_BY_ID, FOOD, BLACKOUT_FIT, BLACKOUT_DISCOUNT } from '../data/shops.js';
import { concealment, disguiseLabel } from '../core/disguise.js';
import { partLevels } from '../data/parts.js';
import { marketValue, makeListing, roundPrice } from '../data/market.js';
import { metrics, buildSpec } from '../sim/powertrain.js';
import { drawThumb } from './marketplace.js';
import { openGarage, advanceTime } from './garage.js';
import { openPartsHub } from './partshub.js';
import { openRaceSetup } from './raceSetup.js';
import { openMeet } from './meet.js';
import { drawPortrait } from '../gfx2d/person.js';
import { emit } from '../core/events.js';
import { saveGame } from '../core/save.js';
import { openSlots } from './menu.js';
import { audio } from '../core/audio.js';
import { rebuildCost, resetEngineWarnings } from '../sim/engine.js';
import { recordHtml } from './record.js';
import { payableTotal, warrantTotal, citationTotal, payFines, surrender, SURRENDER_DISCOUNT } from '../core/warrants.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;

export function openPlace(loc, app) {
  const s = game.s;
  const fn = HANDLERS[loc.type];
  if (!fn) { toast(`${loc.name} — closed`, 'info'); return; }
  if (loc.tier && tierOf(s.rep).n < loc.tier && loc.type !== 'dealer') {
    modal(loc.name, `<p>This spot is for <b>Tier ${loc.tier}</b> racers and up. You're ${tierOf(s.rep).name} (${s.rep.toLocaleString()} rep).</p>`);
    return;
  }
  fn(loc, app, s);
}

const HANDLERS = {
  home: homeScreen,
  property: (loc, app, s) => s.properties.includes(loc.id) ? homeScreen(loc, app, s) : realty(loc, app, s, loc.id),
  dealer, usedlot, perf, visual, repair, gas, food, clothing,
  realty: (loc, app, s) => realty(loc, app, s),
  police,
  meet: (loc, app, s) => {
    if (!isNight(s.time)) { modal(loc.name, `<p>Empty lot. A security guard on a golf cart. Meets start after <b>8 PM</b>.</p><p class="muted small">Tip: sleep at home until night.</p>`); return; }
    if (!activeCar(s)) { modal(loc.name, '<p>You can\'t roll up to a car meet on foot. Get a car.</p>'); return; }
    openMeet(loc, app);
  },
  roll: (loc, app, s) => openRaceSetup(app, { type: 'roll', loc }),
  drag: (loc, app, s) => openRaceSetup(app, { type: 'drag', loc }),
};

// ---------------- home / safehouse ----------------
function homeScreen(loc, app, s) {
  const w = app.world;
  if (w && w.police.safehouse(w)) toast('You slipped into the garage. The cops lost you.', 'good');
  else if (w && w.police.phase === 'chase') { modal('Not now', '<p>They\'re right behind you — lose them first, then hide here.</p>'); return; }
  const prop = PROPERTIES[loc.id];
  if (s.home !== loc.id) s.home = loc.id;
  openPanel((root, h) => {
    const hr = hourOf(s.time);
    root.innerHTML = head(prop.name, `Home · ${prop.slots} car garage · ${esc(prop.desc)}`) + `<div class="p-body"><div class="grid">
      <div class="card click" data-action="garage"><h3>🔧 Garage</h3><p class="muted small">Install parts (DIY), switch cars, dyno, tune.</p></div>
      <div class="card click" data-action="sleep" data-to="8"><h3>🛏 Sleep until morning</h3><p class="muted small">Skip to 8:00 AM. Deliveries arrive at 8.</p></div>
      <div class="card click" data-action="sleep" data-to="21"><h3>🌙 Rest until night</h3><p class="muted small">Skip to 9:00 PM. Meets are on.</p></div>
      <div class="card click" data-action="wardrobe"><h3>👕 Wardrobe</h3><p class="muted small">${s.player.outfits.length} items owned.</p></div>
      <div class="card click" data-action="save"><h3>💾 Save game</h3><p class="muted small">Manual save slots.</p></div>
      <div class="card"><h3>📦 Parts bin</h3><p class="muted small">${s.partsBin.length} parts waiting · ${s.orders.length} orders on the way</p></div>
    </div></div>`;
    bind(root, {
      close: () => h.close(),
      garage: () => openGarage(app, { mode: 'home' }),
      sleep: d => {
        const to = +d.to;
        let mins = ((to * 60 - s.time.min) + 1440) % 1440 || 1440;
        advanceTime(s, mins);
        s.player.energy = 100;
        if (app.world) { app.world.police.s.heat = Math.max(0, app.world.police.s.heat - mins / 60 * 0.5); }
        saveGame('auto', true);
        toast(to === 8 ? 'Good morning.' : 'Night falls on Fort Worth.', 'info');
        h.refresh();
      },
      wardrobe: () => wardrobe(app, s),
      save: () => openSlots('save', app),
    });
  });
}

// shop: the clothing store you walked into (null = your own wardrobe).
// Threadline sells streetwear; Riverside Army Surplus sells the blackout gear.
function wardrobe(app, s, shop = null) {
  const owns = id => id === 'no_mask' || s.player.outfits.includes(id);
  const surplus = shop?.shop === 'surplus';
  openPanel((root, h) => {
    const look = s.player.look;
    look.mask ??= 'no_mask';
    const items = shop ? CLOTHES.filter(c => (c.shop || null) === (shop.shop || null) && (c.price > 0 || !owns(c.id))) : CLOTHES.filter(c => owns(c.id));
    const fit = BLACKOUT_FIT.map(id => CLOTH_BY_ID[id]), fitNeed = fit.filter(c => !owns(c.id));
    const fitPrice = Math.round(fitNeed.reduce((t, c) => t + c.price, 0) * (1 - BLACKOUT_DISCOUNT) * 1.0725);
    const night = isNight(s.time), cn = concealment(look, night);
    const sub = surplus ? 'Workwear, cold-weather gear, no questions asked.' : shop ? 'New drops every week. Look the part.' : 'What you own';
    root.innerHTML = head(shop ? shop.name : 'Wardrobe', sub) + `<div class="p-body"><div class="create">
      <div><canvas width="300" height="300" data-p></canvas>
        <div class="li"><span>🕶</span><div class="grow"><div class="t">${disguiseLabel(cn)}</div><div class="s">${Math.round(cn * 100)}% chance a witness can't name you ${night ? 'tonight' : 'in daylight'}. ${look.mask !== 'no_mask' ? 'Cops notice a mask on the street.' : 'A mask and all black works best, at night.'}</div></div></div></div>
      <div>${surplus ? `<div class="section-title">Full blackout fit</div><div class="li"><span class="swatch" style="background:#0c0c0d;width:22px;height:22px"></span><div class="grow"><div class="t">Ski mask, fleece hoodie, joggers, runners</div><div class="s">${fitNeed.length ? `${fmtMoney(fitPrice)} with tax · 10% off as a set` : 'You own the whole fit'}</div></div>
        ${fitNeed.length ? `<button class="btn btn-sm btn-primary" data-action="fit">Buy the fit</button>` : `<button class="btn btn-sm" data-action="wearfit">Wear it</button>`}</div>` : ''}
      ${['mask', 'top', 'bottom', 'hat', 'shoes'].map(slot => { const list = items.filter(c => c.slot === slot); return list.length ? `<div class="section-title">${slot}</div><div class="list">${list.map(c => {
        const owned = owns(c.id);
        const wearing = look[slot] === c.id;
        const locked = c.tier && tierOf(s.rep).n < c.tier;
        return `<div class="li"><span class="swatch" style="background:${c.color};width:22px;height:22px"></span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${owned ? 'Owned' : fmtMoney(c.price)}${locked ? ` · Tier ${c.tier}` : ''}</div></div>
          ${wearing ? '<span class="tag tag-green">Wearing</span>' : owned ? `<button class="btn btn-sm" data-action="wear" data-id="${c.id}">Wear</button>` : `<button class="btn btn-sm btn-primary" data-action="buy" data-id="${c.id}" ${locked ? 'disabled' : ''}>Buy</button>`}</div>`;
      }).join('')}</div>` : ''; }).join('')}</div></div></div>`;
    const cv = root.querySelector('[data-p]');
    drawPortrait(cv.getContext('2d'), 300, 300, look);
    bind(root, {
      close: () => h.close(),
      wear: d => { look[CLOTH_BY_ID[d.id].slot] = d.id; h.refresh(); },
      buy: d => { const c = CLOTH_BY_ID[d.id]; if (!spend(s, c.price * 1.0725, `${shop?.name || 'Threadline'}: ${c.name}`)) return; s.player.outfits.push(c.id); if (c.slot !== 'mask') look[c.slot] = c.id; else toast('In your pocket. Pull it down with V (or MASK) when it\'s time.', 'info'); s.followers += Math.round(c.price / 40); h.refresh(); },
      fit: () => { if (!spend(s, fitPrice, `${shop.name}: blackout fit`)) return; for (const c of fitNeed) s.player.outfits.push(c.id); for (const c of fit) if (c.slot !== 'mask') look[c.slot] = c.id; toast('All black. The mask is in your pocket: pull it down with V (or MASK) when it\'s time.', 'good'); h.refresh(); },
      wearfit: () => { for (const c of fit) if (c.slot !== 'mask') look[c.slot] = c.id; h.refresh(); },
    });
  });
}

// ---------------- dealerships ----------------
function dealer(loc, app, s) {
  const tab = { v: 'new' };
  openPanel((root, h) => {
    const newCars = CARS.filter(c => loc.makes.includes(c.make) && soldNew(c));
    const cpo = s.dealerStock?.[loc.id]?.day === s.time.day ? s.dealerStock[loc.id].list : (() => {
      const pool = CARS.filter(c => loc.makes.includes(c.make));
      const list = Array.from({ length: Math.min(8, pool.length) }, () => {
        const l = makeListing(pool[Math.floor(Math.random() * pool.length)]);
        for (const k in l.cond) l.cond[k] = Math.max(l.cond[k], 80);
        l.title = 'Clean'; l.issues = []; l.mods = {};
        l.price = roundPrice(marketValue(CAR_BY_ID[l.modelId], l.year, l.miles, l.cond) * 1.12);
        return l;
      });
      s.dealerStock ??= {}; s.dealerStock[loc.id] = { day: s.time.day, list };
      return list;
    })();
    const list = tab.v === 'new' ? newCars.map(m => ({ m, year: Math.min(m.years[1], CURRENT_YEAR), miles: 8, price: m.msrp + 1295 + (m.rarity >= 4 ? Math.round(m.msrp * 0.1) : 0), isNew: true }))
      : cpo.map(l => ({ m: CAR_BY_ID[l.modelId], year: l.year, miles: l.miles, price: l.price, l }));
    root.innerHTML = head(loc.name.split(' (')[0], esc(loc.makes.map(m => MAKES[m]).join(' · '))) +
      `<div class="tabs"><button class="${tab.v === 'new' ? 'on' : ''}" data-action="tab" data-v="new">New (${newCars.length})</button><button class="${tab.v === 'cpo' ? 'on' : ''}" data-action="tab" data-v="cpo">Certified Pre-Owned (${cpo.length})</button></div>
      <div class="p-body">${tab.v === 'new' ? '<p class="small muted">Price includes $1,295 destination. High-demand models carry a 10% market adjustment. Tax and fees at signing.</p>' : '<p class="small muted">Inspected, reconditioned, clean title. Dealer markup included.</p>'}
      <div class="grid">${list.map((c, i) => {
        const spec = buildSpec(c.m, {}, c.l?.cond || {});
        const mt = metrics(spec);
        return `<div class="card"><canvas width="320" height="180" class="carthumb" data-i="${i}"></canvas>
          <h3>${esc(carName(c.m, c.year))}</h3>
          <div class="muted small">${c.isNew ? 'New' : `${c.miles.toLocaleString()} mi`} · ${spec.hp} hp · ${c.m.drive} · ${esc(c.m.trans)}</div>
          <div class="small">0-60 ${mt.zero60?.toFixed(1)}s · ¼ ${mt.quarter?.toFixed(2)}s · <span class="pi"><b>${mt.cls}</b>${mt.pi}</span></div>
          <div class="row" style="margin-top:8px"><div class="price grow">${fmtMoney(c.price)}</div><button class="btn btn-primary btn-sm" data-action="buy" data-i="${i}">Buy</button></div></div>`;
      }).join('') || '<div class="empty">Nothing on the lot right now.</div>'}</div></div>`;
    root.querySelectorAll('canvas[data-i]').forEach(cv => { const c = list[+cv.dataset.i]; drawThumb(cv, c.m, { paint: c.l?.visual?.paint || c.m.color, wheels: c.isNew ? 'five' : 'steel', wheelColor: '#c0c4c8' }, {}, c.l?.cond); });
    bind(root, {
      close: () => h.close(),
      tab: d => { tab.v = d.v; h.refresh(); },
      buy: d => buyFromDealer(list[+d.i], app, s, loc, h),
    });
  });
}

async function buyFromDealer(c, app, s, loc, h) {
  const cap = garageCapacity(s, PROPERTIES);
  const trade = activeCar(s);
  const tradeVal = trade ? Math.round(carValue(trade) * 0.72 / 100) * 100 : 0;
  const tax = Math.round(c.price * 0.0725), doc = 499, reg = 185;
  const total = c.price + tax + doc + reg;
  const useTrade = trade && s.cars.length >= cap;
  if (!trade && s.cars.length >= cap) { modal('No garage space', '<p>Buy a bigger place first.</p>'); return; }
  const choice = await modal('Sign the paperwork', `<p><b>${esc(carName(c.m, c.year))}</b></p>
    <div class="kv"><span>Price</span><span>${fmtMoney(c.price)}</span><span>Sales tax (7.25%)</span><span>${fmtMoney(tax)}</span><span>Doc fee</span><span>${fmtMoney(doc)}</span><span>Title & registration</span><span>${fmtMoney(reg)}</span>
    ${trade ? `<span>Trade-in offer (${esc(modelOf(trade).model)})</span><span class="good">−${fmtMoney(tradeVal)}</span>` : ''}
    <span><b>Due today</b></span><span>${fmtMoney(total)}${trade ? ` / ${fmtMoney(total - tradeVal)} with trade` : ''}</span></div>
    ${useTrade ? '<p class="warn small">Your garage is full — you\'d need to trade in.</p>' : ''}`,
    [{ label: 'Cancel', value: 0 }, ...(useTrade ? [] : [{ label: `Pay ${fmtMoney(total)}`, value: 1, primary: !trade }]), ...(trade ? [{ label: `Trade in & pay ${fmtMoney(total - tradeVal)}`, value: 2, primary: true }] : [])]);
  if (!choice) return;
  const due = choice === 2 ? total - tradeVal : total;
  if (!spend(s, due, `Bought ${carName(c.m, c.year)} at ${loc.name.split(' (')[0]}`)) return;
  if (choice === 2) { s.cars = s.cars.filter(x => x !== trade); s.myListings = s.myListings.filter(x => x.carUid !== trade.uid); }
  const car = newCar(c.m.id, { year: c.year, miles: c.miles, paid: c.price, fuel: 1, cond: c.l ? { ...c.l.cond } : undefined });
  if (!car.cond) car.cond = { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 };
  if (c.l) car.visual.paint = c.l.visual.paint || c.m.color;
  car.visual.wheels = c.isNew ? 'five' : 'steel';
  car.visual.wheelColor = '#c0c4c8';
  s.cars.push(car);
  s.activeCar = car.uid;
  if (c.l) s.dealerStock[loc.id].list = s.dealerStock[loc.id].list.filter(x => x !== c.l);
  const w = app.world;
  if (w) {
    const x = loc.x + Math.sin(loc.face) * 4, z = loc.z - Math.cos(loc.face) * 4;
    w.placeCar(car, x, z, loc.face + Math.PI / 2);
    s.carPos = { x, z, h: loc.face + Math.PI / 2 };
    w.inCar = false;
  }
  emit('carBought', { modelId: c.m.id, source: 'dealer' });
  audio.win();
  closeAllPanels();
  modal('Congratulations!', `<p>The ${esc(carName(c.m, c.year))} is yours. It's parked out front — press <kbd>F</kbd> to get in.</p>`);
}

// ---------------- used lot ----------------
function usedlot(loc, app, s) {
  openPanel((root, h) => {
    if (!s.rustyStock || s.rustyStock.day !== s.time.day) {
      const cheap = CARS.filter(c => !c.market && c.msrp < 45000 && c.years[1] < 2020);
      s.rustyStock = { day: s.time.day, list: Array.from({ length: 9 }, () => {
        const l = makeListing(cheap[Math.floor(Math.random() * cheap.length)]);
        l.price = roundPrice(l.value * 1.18 + 600); l.mods = {};
        return l;
      }) };
    }
    const list = s.rustyStock.list;
    root.innerHTML = head("Rusty's Used Autos", 'Buy here, drive today. "Every car mechanically inspected (by Sal)."') + `<div class="p-body">
      <p class="muted small">Sal: "Prices are a little higher than Marketplace, sure. But you get to see the car first, and I take care of the paperwork. Fees included."</p>
      <div class="grid">${list.map((l, i) => {
        const m = CAR_BY_ID[l.modelId];
        return `<div class="card"><canvas width="320" height="180" class="carthumb" data-i="${i}"></canvas><h3>${esc(l.title_)}</h3>
          <div class="muted small">${l.miles.toLocaleString()} mi · ${l.title} title · ${esc(m.trans)}</div>
          <div class="small">${l.issues.length ? `<span class="warn">⚠ ${esc(l.issues.join(' · '))}</span>` : '<span class="good">No known issues</span>'}</div>
          <div class="row" style="margin-top:8px"><div class="price grow">${fmtMoney(l.price)}</div><button class="btn btn-primary btn-sm" data-action="buy" data-i="${i}">Buy</button></div></div>`;
      }).join('')}</div></div>`;
    root.querySelectorAll('canvas[data-i]').forEach(cv => { const l = list[+cv.dataset.i]; drawThumb(cv, CAR_BY_ID[l.modelId], { wheels: 'steel', ...l.visual }, {}, l.cond); });
    bind(root, {
      close: () => h.close(),
      buy: async d => {
        const l = list[+d.i];
        const cap = garageCapacity(s, PROPERTIES);
        if (s.cars.length >= cap) { modal('No garage space', '<p>Sell a car or buy a bigger place.</p>'); return; }
        if (!(await confirm('Buy it?', `<p>${esc(l.title_)} for <b>${fmtMoney(l.price)}</b>, out the door.</p>`, 'Buy'))) return;
        if (!spend(s, l.price, `Bought ${l.title_} at Rusty's`)) return;
        const car = newCar(l.modelId, { year: l.year, miles: l.miles, title: l.title, cond: { ...l.cond }, paid: l.price, fuel: 0.5 });
        Object.assign(car.visual, { wheels: 'steel', ...l.visual });
        s.cars.push(car); s.activeCar = car.uid;
        s.rustyStock.list = list.filter(x => x !== l);
        const w = app.world;
        if (w) { w.placeCar(car, loc.x + 5, loc.z, loc.face + Math.PI / 2); s.carPos = { x: loc.x + 5, z: loc.z, h: loc.face + Math.PI / 2 }; w.inCar = false; }
        emit('carBought', { modelId: l.modelId, source: 'usedlot' });
        closeAllPanels();
        modal('Sold!', `<p>Sal hands you the keys. "She's out front. Don't come back crying."</p>`);
      },
    });
  });
}

// ---------------- shops ----------------
function perf(loc, app, s) {
  openPanel((root, h) => {
    root.innerHTML = head('Torque Temple Performance', 'Rosa Vega, owner · dyno cell · two lifts · no drama') + `<div class="p-body">
      <p class="muted">Rosa: "${activeCar(s) ? `What are we doing to the ${esc(modelOf(activeCar(s)).model)} today?` : 'No car? Come back when you have something for me to work on.'}"</p>
      <div class="grid">
        <div class="card click" data-action="counter"><h3>🛒 Parts counter</h3><p class="muted small">Buy in-stock parts, installed today.</p></div>
        <div class="card click" data-action="bay"><h3>🔧 Service bay</h3><p class="muted small">Install parts you ordered, remove parts, tune gearing, dyno.</p></div>
        <div class="card click" data-action="online"><h3>💻 Order online (PartsHub)</h3><p class="muted small">Cheaper, ships to your place tomorrow.</p></div>
      </div></div>`;
    bind(root, {
      close: () => h.close(),
      counter: () => openPartsHub(app, { store: 'perf' }),
      bay: () => openGarage(app, { mode: 'perf', tab: 'install' }),
      online: () => openPartsHub(app),
    });
  });
}

function visual(loc, app, s) {
  openPanel((root, h) => {
    root.innerHTML = head('Vega Kustoms', 'Manny Vega · paint, wraps, wheels, body') + `<div class="p-body">
      <p class="muted">Manny: "Fast is Rosa's job. Looking fast is mine."</p>
      <div class="grid">
        <div class="card click" data-action="counter"><h3>🎨 Paint, wraps & body</h3><p class="muted small">Respray, wraps, widebody kits, wheels, aero — installed today.</p></div>
        <div class="card click" data-action="booth"><h3>🔧 Install your parts</h3><p class="muted small">Bring visual parts you bought online.</p></div>
      </div></div>`;
    bind(root, {
      close: () => h.close(),
      counter: () => openPartsHub(app, { store: 'visual' }),
      booth: () => openGarage(app, { mode: 'visual', tab: 'install' }),
    });
  });
}

function repairCosts(car) {
  const m = modelOf(car);
  const c = car.cond;
  const lux = m.msrp;
  const cost = {
    body: (100 - c.body) / 100 * (900 + lux * 0.03),
    lights: (100 - c.lights) / 100 * (300 + lux * 0.006),
    tires: c.tires < 99 ? (100 - c.tires) / 100 * (500 + lux * 0.004) : 0,
    engine: car.engineBlown ? rebuildCost(m) : (100 - c.engine) / 100 * (1800 + lux * 0.05),
    trans: (100 - c.trans) / 100 * (1400 + lux * 0.035),
  };
  for (const k in cost) cost[k] = Math.round(cost[k] / 5) * 5;
  return cost;
}

function repair(loc, app, s) {
  openPanel((root, h) => {
    const car = activeCar(s);
    if (!car) { root.innerHTML = head('Second Chance Collision') + '<div class="p-body"><div class="empty">Nothing to fix — you don\'t have a car.</div></div>'; bind(root, { close: () => h.close() }); return; }
    const costs = repairCosts(car);
    const ins = s.insurance ? 0.3 : 1;
    const total = Object.values(costs).reduce((a, b) => a + b, 0) * ins;
    const names = { body: 'Body & paint', lights: 'Lights', tires: 'Tires (replace set)', engine: car.engineBlown ? '💥 Engine rebuild' : 'Engine', trans: 'Transmission' };
    root.innerHTML = head('Second Chance Collision', 'Body · mechanical · tires · we work with all insurers') + `<div class="p-body" style="max-width:720px">
      ${car.engineBlown ? `<p class="bad"><b>Blown motor.</b> Spun a bearing and put a rod through the block. It needs a full rebuild before it'll run again.</p>` : ''}
      <p class="muted">${esc(carName(modelOf(car), car.year))}${s.insurance ? ' · <span class="good">Insurance covers 70%</span>' : ' · <span class="muted">Not insured (Bank app)</span>'}</p>
      <div class="list">${Object.entries(costs).map(([k, v]) => `<div class="li"><div style="width:150px">${names[k]}</div><div class="grow">${bar(car.cond[k], car.cond[k] < 40 ? 'red' : car.cond[k] < 70 ? 'yellow' : 'green')}</div><span style="width:44px;text-align:right">${Math.round(car.cond[k])}%</span>
        <button class="btn btn-sm" data-action="fix" data-k="${k}" ${v > 0 ? '' : 'disabled'}>${v > 0 ? fmtMoney(v * ins) : 'OK'}</button></div>`).join('')}</div>
      <div class="row" style="margin-top:12px"><div class="grow"></div><button class="btn btn-primary" data-action="all" ${total > 0 ? '' : 'disabled'}>Fix everything · ${fmtMoney(total)}</button></div></div>`;
    const fix = k => { car.cond[k] = 100; if (k === 'engine' && car.engineBlown) { car.engineBlown = false; resetEngineWarnings(car); toast('Engine rebuilt. Fix the build or it\'ll happen again.', 'good'); } };
    bind(root, {
      close: () => h.close(),
      fix: d => { if (spend(s, costs[d.k] * ins, `Repair: ${names[d.k]}`)) { fix(d.k); app.world?.refreshCar(); h.refresh(); } },
      all: () => { if (spend(s, total, 'Full repair')) { Object.keys(costs).forEach(fix); app.world?.refreshCar(); toast('Good as new', 'good'); h.refresh(); } },
    });
  });
}

function gas(loc, app, s) {
  openPanel((root, h) => {
    const car = activeCar(s);
    const w = app.world;
    const near = car && w?.vehicle && Math.hypot(w.vehicle.x - loc.x, w.vehicle.z - loc.z) < 45;
    const m = car ? modelOf(car) : null;
    const ev = m?.asp === 'ev';
    const grade = !car ? null : ev ? 'kwh' : needsPremium(car) ? 'premium' : 'regular';
    const need = car ? (1 - car.fuel) * tankGallons(car) : 0;
    const price = grade ? GAS[grade] : 0;
    root.innerHTML = head(loc.name, `Regular $${GAS.regular} · Premium $${GAS.premium} · E85 $${GAS.e85} · EV $${GAS.kwh}/kWh`) + `<div class="p-body" style="max-width:640px">
      ${car ? `<div class="li"><div class="grow"><div class="t">${esc(carName(m, car.year))}</div><div class="s">${ev ? 'Battery' : 'Tank'}: ${(car.fuel * tankGallons(car)).toFixed(1)} / ${tankGallons(car)} ${ev ? 'kWh' : 'gal'} · ${ev ? 'DC fast charging' : grade === 'premium' ? 'Premium 93 required' : 'Regular 87'}</div>${bar(car.fuel * 100, car.fuel < 0.2 ? 'red' : 'green')}</div></div>
        <div class="row" style="margin:10px 0"><button class="btn btn-primary" data-action="fill" ${near && need > 0.05 ? '' : 'disabled'}>${near ? `Fill up · ${fmtMoney(need * price, true)}` : 'Park at the pump first'}</button></div>` : '<p class="muted">No car.</p>'}
      <div class="section-title">Store</div>
      <div class="list">
        <div class="li"><div class="grow"><div class="t">Volt Energy Drink</div><div class="s">+25 energy (sharper reactions)</div></div><button class="btn btn-sm" data-action="snack" data-p="3.49" data-e="25">$3.49</button></div>
        <div class="li"><div class="grow"><div class="t">Gas station hot dog</div><div class="s">+20 energy. Questionable.</div></div><button class="btn btn-sm" data-action="snack" data-p="2.29" data-e="20">$2.29</button></div>
        <div class="li"><div class="grow"><div class="t">Octane booster</div><div class="s">It does nothing. People buy it anyway.</div></div><button class="btn btn-sm" data-action="snack" data-p="8.99" data-e="0">$8.99</button></div>
      </div></div>`;
    bind(root, {
      close: () => h.close(),
      fill: () => { const cost = need * price; if (spend(s, cost, `${loc.name}: ${need.toFixed(1)} ${ev ? 'kWh' : 'gal'} ${grade}`)) { car.fuel = 1; if (ev) advanceTime(s, 25); toast(ev ? 'Charged to 100% (25 min)' : 'Tank full', 'good'); h.refresh(); } },
      snack: d => { if (spend(s, +d.p, 'Gas station snack')) { s.player.energy = Math.min(100, s.player.energy + +d.e); h.refresh(); } },
    });
  });
}

function food(loc, app, s) {
  openPanel((root, h) => {
    root.innerHTML = head(loc.name, `Energy: ${Math.round(s.player.energy)}/100 · energy sharpens your reaction time on the tree`) + `<div class="p-body" style="max-width:640px"><div class="list">${FOOD.map(f => `<div class="li"><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">${esc(f.desc)}${f.energy ? ` · +${f.energy} energy` : ''}</div></div><button class="btn btn-sm" data-action="buy" data-id="${f.id}">${fmtMoney(f.price * 1.0725, true)}</button></div>`).join('')}</div>
      <p class="small muted">Racers hang out here. Sometimes you overhear things.</p></div>`;
    bind(root, {
      close: () => h.close(),
      buy: d => {
        const f = FOOD.find(x => x.id === d.id);
        if (!spend(s, f.price * 1.0725, `${loc.name}: ${f.name}`)) return;
        if (f.item) s.inventory[f.item] = (s.inventory[f.item] || 0) + 1;
        s.player.energy = Math.min(100, s.player.energy + f.energy);
        advanceTime(s, 20);
        if (Math.random() < 0.35) toast(['Overheard: "Static only races after midnight."', 'Overheard: "Somebody ran 9s at Ironline last week on drag radials."', 'Overheard: "Cops set up on Loop 820 on Fridays."', 'Overheard: "Rosa can make a Civic do anything."'][Math.floor(Math.random() * 4)], 'info');
        h.refresh();
      },
    });
  });
}

function clothing(loc, app, s) { wardrobe(app, s, loc); }

function realty(loc, app, s, focusId) {
  openPanel((root, h) => {
    const tier = tierOf(s.rep).n;
    root.innerHTML = head('Bayline Realty', 'Priya Shah · "I sell garages with houses attached."') + `<div class="p-body"><div class="grid">${Object.entries(PROPERTIES).map(([id, p]) => {
      const owned = s.properties.includes(id);
      const locked = p.tier && tier < p.tier;
      return `<div class="card" style="${focusId === id ? 'border-color:var(--red)' : ''}"><h3>${esc(p.name)}</h3><p class="muted small">${esc(p.desc)}</p>
        <div class="kv"><span>Garage</span><span>${p.slots} cars</span><span>Upkeep</span><span>${id === 'eastgate_studio' ? '—' : '$120/week'}</span></div>
        <div class="row" style="margin-top:8px"><div class="price grow">${p.price ? fmtMoney(p.price) : 'Rented'}</div>
        ${owned ? `<span class="tag tag-green">${s.home === id ? 'Home' : 'Owned'}</span>${s.home !== id ? `<button class="btn btn-sm" data-action="home" data-id="${id}">Make home</button>` : ''}` : `<button class="btn btn-sm btn-primary" data-action="buy" data-id="${id}" ${locked ? 'disabled' : ''}>${locked ? `Tier ${p.tier}` : 'Buy'}</button>`}
        <button class="btn btn-sm" data-action="gps" data-id="${id}">📍</button></div></div>`;
    }).join('')}</div><p class="small muted">Prices include closing costs. Every home is a safehouse and adds garage space.</p></div>`;
    bind(root, {
      close: () => h.close(),
      buy: async d => {
        const p = PROPERTIES[d.id];
        if (!(await confirm(`Buy ${p.name}?`, `<p>${fmtMoney(p.price)} — ${p.slots}-car garage.</p>`, 'Buy'))) return;
        if (!spend(s, p.price, `Bought ${p.name}`)) return;
        s.properties.push(d.id); s.home = d.id;
        emit('propertyBought', { id: d.id });
        toast(`${p.name} is yours`, 'good'); h.refresh();
      },
      home: d => { s.home = d.id; h.refresh(); },
      gps: d => { const l = LOC_BY_ID[d.id]; app.world?.setGps(l.x, l.z, PROPERTIES[d.id].name); closeAllPanels(); },
    });
  });
}

function police(loc, app, s) {
  openPanel((root, h) => {
    const w = app.world;
    const heat = s.heat;
    const fine = Math.round(heat * 350 / 10) * 10;
    root.innerHTML = head(loc.name, 'Fort Worth Police Department') + `<div class="p-body" style="max-width:640px">
      ${w?.police.active ? '<p class="bad">You walked into a police station while they\'re looking for you. Bold.</p>' : ''}
      <div class="li"><div class="grow"><div class="t">Outstanding citations</div><div class="s">${heat > 0.05 ? `Your heat is ${heat.toFixed(1)}. Paying your tickets clears it.` : 'You\'re clean.'}</div></div>
        <button class="btn btn-sm btn-primary" data-action="pay" ${heat > 0.05 && !w?.police.active ? '' : 'disabled'}>Pay ${fmtMoney(fine)}</button></div>
      <div class="section-title">Your record</div>
      ${recordHtml(s)}
      ${s.warrants.length || s.citations.length ? `<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
        ${payableTotal(s) ? `<button class="btn btn-sm" data-action="fines" ${w?.police.active ? 'disabled' : ''}>Pay tickets${s.warrants.some(x => !x.felony) ? ' + misdemeanours' : ''} · ${fmtMoney(payableTotal(s))}</button>` : ''}
        <button class="btn btn-sm btn-primary" data-action="surrender">Turn yourself in · ${fmtMoney(Math.round((warrantTotal(s) + citationTotal(s)) * (1 - SURRENDER_DISCOUNT)))}</button></div>
        <p class="small muted">Turning yourself in clears everything, felonies included, at 25% off. You spend a few hours being booked.</p>` : ''}
      <div class="section-title">Sgt. Hal Brenner</div>
      <p class="muted">"${s.stats.pursuitsEscaped > 2 ? `${esc(s.player.name)}. You've been busy. I've got a whiteboard now. You're on it.` : 'Street racing kills people. Take it to Ironline Dragway — it\'s legal there.'}"</p></div>`;
    bind(root, {
      close: () => h.close(),
      pay: () => { if (spend(s, fine, 'FWPD citations')) { s.heat = 0; toast('Record cleared', 'good'); h.refresh(); } },
      fines: () => { const r = payFines(s); if (r.ok) { toast(`Paid ${fmtMoney(r.total)}`, 'good'); h.refresh(); } },
      surrender: async () => {
        const all = Math.round((warrantTotal(s) + citationTotal(s)) * (1 - SURRENDER_DISCOUNT));
        if (!(await confirm('Turn yourself in?', `<p>You'll be booked, pay <b>${fmtMoney(all)}</b> and walk out a few hours later with a clean record.</p>`, 'Turn myself in'))) return;
        const r = surrender(s);
        if (!r.ok) return;
        if (w?.police.active) w.police.reset(w);
        advanceTime(s, 4 * 60);   // booked, processed, released
        addRep(s, -15, 'Turned yourself in');
        toast('Booked and released. Your record is clean.', 'good'); h.refresh();
      },
    });
  });
}
