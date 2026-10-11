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
import { openStreetRace } from './streetRaceSetup.js';
import { openMeet } from './meet.js';
import { openNightMeet } from './nightmeet.js';
import { openKustoms } from './kustoms.js';
import { openCarShow } from './carshow.js';
import { drawPortrait } from '../gfx2d/person.js';
import { emit } from '../core/events.js';
import { saveGame } from '../core/save.js';
import { openSlots } from './menu.js';
import { audio } from '../core/audio.js';
import { rebuildCost, resetEngineWarnings } from '../sim/engine.js';
import { recordHtml } from './record.js';
import { payableTotal, payFines, surrender, surrenderTotal, hasFelony } from '../core/warrants.js';
import { openCourthouse, book } from './court.js';
import { charge, fileCase, IMPOUND_LOT } from '../core/justice.js';
import { openRealty, openTrap, openLand, openPlug, openRig, openRanch, openRemodel, openBuild } from './estate.js';
import { ensureLoot } from '../core/loot.js';
import { offer as creditOffer, financeCar, payoffOnSale, lienOn, payment as loanPayment, totalCost, AUTO_TERMS, LOAN_CYCLE } from '../core/credit.js';
import { PLATE_SWAP } from '../world2d/theft.js';
import { MENUS } from '../data/food.js';
import { eat, sleep, nap, ensureNeeds } from '../core/needs.js';
import { openChop } from './chop.js';
import { openPawn } from './pawn.js';
import { openHospital } from './hospital.js';
import { openTrailerLot, openTrailerHome } from './trailers.js';
import { openSaleBarn } from './livestock.js';
import { openKennel } from './kennel.js';
import { openLabel } from './label.js';
import { openHogLease } from './hoghunt.js';
import { ensureKennel } from '../core/dogs.js';
import { describe as towLine } from '../core/tow.js';
import { stockRig } from '../core/livestock.js';
import { BREAKDOWNS, needsOil, oilChangeCost, changeOil, clearBreakdown, oilInterval } from '../core/upkeep.js';
import { fromPreset, summary as houseLine } from '../core/homes.js';

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
  property: (loc, app, s) => s.properties.includes(loc.id) ? homeScreen(loc, app, s) : openRealty(app, loc.id),
  chop: (loc, app) => openChop(loc, app),
  dealer, usedlot: fence, perf, visual, repair, gas, food, corner, clothing,
  realty: (loc, app) => openRealty(app),
  trap: (loc, app) => openTrap(loc, app),
  land: (loc, app) => openLand(loc, app),
  rig: (loc, app) => openRig(loc, app),
  plug: (loc, app) => openPlug(loc, app),
  pawn: (loc, app) => openPawn(loc, app),
  trailers: (loc, app) => openTrailerLot(loc, app),
  salebarn: (loc, app) => openSaleBarn(loc, app),
  kennel: (loc, app) => openKennel(app, { shop: true, tab: 'buy' }),
  studio: (loc, app) => openLabel(app, { studio: loc.id }),
  hoghunt: (loc, app) => openHogLease(loc, app),
  police,
  work: async (loc, app) => { const { openPhone } = await import('./phone.js'); openPhone('hustle', app); },
  court: (loc, app) => openCourthouse(loc, app),
  hospital: (loc, app) => openHospital(loc, app),
  meet: (loc, app, s) => {
    if (loc.weekend) { openNightMeet(loc, app); return; }
    if (!isNight(s.time)) { modal(loc.name, `<p>Empty lot. A security guard on a golf cart. Meets start after <b>8 PM</b>.</p><p class="muted small">Tip: sleep at home until night.</p>`); return; }
    if (!activeCar(s)) { modal(loc.name, '<p>You can\'t roll up to a car meet on foot. Get a car.</p>'); return; }
    openMeet(loc, app);
  },
  carshow: (loc, app) => openCarShow(loc, app),
  roll: (loc, app, s) => openRaceSetup(app, { type: 'roll', loc }),
  drag: (loc, app, s) => openRaceSetup(app, { type: 'drag', loc }),
  // a race set up at the weekend meet waits at its start line
  sprint: (loc, app, s) => openStreetRace(app, loc, s.meetRace?.race === loc.race ? { npcId: s.meetRace.npcId } : {}),
};

// ---------------- home / safehouse ----------------
export function homeScreen(loc, app, s) {
  const w = app.world;
  if (w && w.police.safehouse(w)) toast('You slipped into the garage. The cops lost you.', 'good');
  else if (w && w.police.phase === 'chase') { modal('Not now', '<p>They\'re right behind you — lose them first, then hide here.</p>'); return; }
  const prop = PROPERTIES[loc.id];
  if (s.home !== loc.id) s.home = loc.id;
  openPanel((root, h) => {
    const hr = hourOf(s.time);
    const kind = prop.land ? `${prop.stories}-story · comfort ${prop.comfort}` : prop.house ? houseLine(fromPreset(prop.house)) : '';
    root.innerHTML = head(prop.name, `Home · ${kind ? `${kind} · ` : ''}${prop.slots} car garage · ${esc(prop.desc)}`) + `<div class="p-body"><div class="grid">
      ${prop.land ? `<div class="card click" data-action="remodel"><h3>🏗 Redesign the house</h3><p class="muted small">Rooms, floors, furniture, colors. Sims style.</p></div>
      <div class="card click" data-action="biggarage"><h3>🚗 Bigger garage</h3><p class="muted small">${prop.slots} cars now. Up to a 100-car vault.</p></div>
      <div class="card click" data-action="ranch"><h3>🐄 Ranch</h3><p class="muted small">Fence the back, buy cows, horses and dogs.${stockRig(s) ? ' <b class="good">Your stock trailer is here: load or turn out cattle.</b>' : ''}</p></div>` : ''}
      <div class="card click" data-action="kennel"><h3>🐕 Kennel</h3><p class="muted small">${(() => { const n = ensureKennel(s).dogs.filter(d => d.home === loc.id).length; return n ? `${n} dog${n > 1 ? 's' : ''} here.` : 'Your hog dogs: profiles, breeding, training.'; })()}</p></div>
      <div class="card click" data-action="garage"><h3>🔧 Garage</h3><p class="muted small">Install parts (DIY), switch cars, dyno, tune.</p></div>
      <div class="card click" data-action="sleep" data-to="8"><h3>🛏 Sleep until morning</h3><p class="muted small">Skip to 8:00 AM, fully rested. Saves your game.</p></div>
      <div class="card click" data-action="sleep" data-to="21"><h3>🌙 Rest until night</h3><p class="muted small">Skip to 9:00 PM, fully rested. Meets are on. Saves your game.</p></div>
      <div class="card click" data-action="nap"><h3>💤 Quick nap</h3><p class="muted small">2 hours, +40 energy. ${needsLine(s)}</p></div>
      <div class="card click" data-action="wardrobe"><h3>👕 Wardrobe</h3><p class="muted small">${s.player.outfits.length} items owned.</p></div>
      <div class="card click" data-action="save"><h3>💾 Save game</h3><p class="muted small">Manual save slots.</p></div>
      ${w?.thefts?.near(loc) ? `<div class="card click" data-action="keephot"><h3>🔑 Keep the stolen car</h3><p class="muted small">New plates and a VIN swap: ${fmtMoney(PLATE_SWAP)}. It gets a rebuilt title and goes in a bay.${w.thefts.canKeep() ? '' : ' <b class="bad">Your garage is full.</b>'}</p></div>` : ''}
      ${s.trailers?.length ? `<div class="card click" data-action="trailer"><h3>🚚 Trailer</h3><p class="muted small">${esc(towLine(s))} Hitch it to a truck and load a car.</p></div>` : ''}
      <div class="card"><h3>📦 Parts bin</h3><p class="muted small">${s.partsBin.length} parts waiting · ${s.orders.length} orders on the way</p></div>
    </div></div>`;
    bind(root, {
      close: () => h.close(),
      garage: () => openGarage(app, { mode: 'home' }),
      kennel: () => openKennel(app, { home: loc.id }),
      remodel: () => openRemodel(app, loc.id),
      biggarage: () => openBuild(app, loc.id),
      ranch: () => openRanch(app, loc.id),
      trailer: () => openTrailerHome(app),
      keephot: () => {
        if (!w.thefts.canKeep()) { toast('No room. Sell a car or buy a bigger place first.', 'bad'); return; }
        const car = w.thefts.keep();
        if (!car) { toast(`You need ${fmtMoney(PLATE_SWAP)} for the plates.`, 'bad'); return; }
        toast(`New plates on the ${modelOf(car).model}. It's yours now.`, 'good');
        saveGame('auto', true);
        h.refresh();
      },
      sleep: d => {
        const to = +d.to;
        let mins = ((to * 60 - s.time.min) + 1440) % 1440 || 1440;
        advanceTime(s, mins);
        sleep(s, mins);
        if (app.world) { app.world.police.s.heat = Math.max(0, app.world.police.s.heat - mins / 60 * 0.5); }
        saveGame('auto', true);
        toast(`${to === 8 ? 'Good morning.' : 'Night falls on Fort Worth.'} Fully rested, game saved.${s.player.food < 30 ? ' You woke up hungry.' : ''}`, 'info');
        h.refresh();
      },
      nap: () => {
        advanceTime(s, 120);
        nap(s, 120);
        saveGame('auto', true);
        toast(`Power nap. Energy ${Math.round(s.player.energy)}.`, 'info');
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

export async function buyFromDealer(c, app, s, loc, h) {
  const cap = garageCapacity(s, PROPERTIES);
  const trade = activeCar(s);
  const tradeVal = trade ? Math.round(carValue(trade) * 0.72 / 100) * 100 : 0;
  // a loan on the trade-in gets paid off out of what they give you for it
  const lien = trade ? lienOn(s, trade.uid) : null;
  const tradeNet = Math.max(0, tradeVal - (lien?.balance || 0));
  const tax = Math.round(c.price * 0.0725), doc = 499, reg = 185, fees = tax + doc + reg;
  const total = c.price + fees;
  const useTrade = trade && s.cars.length >= cap;
  if (!trade && s.cars.length >= cap) { modal('No garage space', '<p>Buy a bigger place first.</p>'); return; }
  // financing through Cowtown Credit Union, priced off your credit score (core/credit.js)
  const fo = creditOffer(s, 'auto', c.price);
  const finDue = credit => Math.max(0, fo.down + fees - credit);
  const finAmt = credit => fo.financed - Math.max(0, credit - fo.down - fees);
  const choice = await modal('Sign the paperwork', `<p><b>${esc(carName(c.m, c.year))}</b></p>
    <div class="kv"><span>Price</span><span>${fmtMoney(c.price)}</span><span>Sales tax (7.25%)</span><span>${fmtMoney(tax)}</span><span>Doc fee</span><span>${fmtMoney(doc)}</span><span>Title & registration</span><span>${fmtMoney(reg)}</span>
    ${trade ? `<span>Trade-in offer (${esc(modelOf(trade).model)})</span><span class="good">−${fmtMoney(tradeVal)}</span>` : ''}
    ${lien ? `<span>Loan payoff on the trade</span><span class="bad">${fmtMoney(lien.balance)}</span>` : ''}
    <span><b>Due today</b></span><span>${fmtMoney(total)}${trade ? ` / ${fmtMoney(total - tradeNet)} with trade` : ''}</span></div>
    <p class="small ${fo.ok ? 'muted' : 'bad'}" data-finance>${fo.ok ? `Financing: credit score ${fo.score} (${esc(fo.band.name)}) gets ${(fo.apr * 100).toFixed(1)}% APR with ${fmtMoney(fo.down)} down${fo.band.carMax < c.price ? ` (they'll finance up to ${fmtMoney(fo.band.carMax)})` : ''}, plus tax and fees.` : `No financing: ${esc(fo.why)}`}</p>
    ${lien && lien.balance > tradeVal ? `<p class="warn small">You owe more on the trade than it's worth. The other ${fmtMoney(lien.balance - tradeVal)} stays on that loan.</p>` : ''}
    ${useTrade ? '<p class="warn small">Your garage is full — you\'d need to trade in.</p>' : ''}`,
    [{ label: 'Cancel', value: 0 },
      ...(useTrade ? [] : [{ label: `Pay ${fmtMoney(total)}`, value: 1, primary: !trade }]),
      ...(trade ? [{ label: `Trade in & pay ${fmtMoney(total - tradeNet)}`, value: 2, primary: true }] : []),
      ...(fo.ok && !useTrade ? [{ label: `Finance · ${fmtMoney(finDue(0))} down`, value: 3 }] : []),
      ...(fo.ok && trade ? [{ label: `Trade in & finance · ${fmtMoney(finDue(tradeNet))} down`, value: 4 }] : [])]);
  if (!choice) return;
  const withTrade = choice === 2 || choice === 4;
  let due = withTrade ? total - tradeNet : total, term = 0, financed = 0;
  if (choice >= 3) {
    financed = finAmt(withTrade ? tradeNet : 0); due = finDue(withTrade ? tradeNet : 0);
    term = await modal('Finance it', `<p>${fmtMoney(due)} down today, ${fmtMoney(financed)} financed at ${(fo.apr * 100).toFixed(1)}% APR. A payment every ${LOAN_CYCLE} days by autopay from checking. Miss enough of them and the repo truck comes.</p>
      <div class="kv">${AUTO_TERMS.map(k => `<span>${k} payments</span><span>${fmtMoney(loanPayment(financed, fo.apr, k))} each · ${fmtMoney(totalCost(financed, fo.apr, k))} total</span>`).join('')}</div>`,
      [{ label: 'Cancel', value: 0 }, ...AUTO_TERMS.map((k, i) => ({ label: `${k} payments`, value: k, primary: i === 1 }))]);
    if (!term) return;
  }
  if (due > 0 && !spend(s, due, `${term ? 'Down payment on' : 'Bought'} ${carName(c.m, c.year)} at ${loc.name.split(' (')[0]}`)) return;
  if (withTrade) { payoffOnSale(s, trade.uid, tradeVal); s.cars = s.cars.filter(x => x !== trade); s.myListings = s.myListings.filter(x => x.carUid !== trade.uid); }
  const car = newCar(c.m.id, { year: c.year, miles: c.miles, paid: c.price, fuel: 1, cond: c.l ? { ...c.l.cond } : undefined });
  if (!car.cond) car.cond = { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 };
  if (c.l) car.visual.paint = c.l.visual.paint || c.m.color;
  car.visual.wheels = c.isNew ? 'five' : 'steel';
  car.visual.wheelColor = '#c0c4c8';
  s.cars.push(car);
  s.activeCar = car.uid;
  if (term && financed > 0) financeCar(s, car, financed, term);
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
  modal('Congratulations!', `<p>The ${esc(carName(c.m, c.year))} is yours. It's parked out front — press <kbd>F</kbd> to get in.</p>${term ? `<p class="small muted">First payment of ${fmtMoney(loanPayment(financed, fo.apr, term))} comes out of checking in ${LOAN_CYCLE} days. Your loans are in the Bank app under Credit.</p>` : ''}`);
}

// ---------------- used lot ----------------
// Pull a stolen car onto Rusty's lot and Sal buys it, cash, no questions asked.
async function fence(loc, app, s) {
  const th = app.world?.thefts;
  if (!th?.near(loc)) { if (ensureLoot(s).length) fenceGoods(loc, app, s); else usedlot(loc, app, s); return; }
  if (app.world.police.phase === 'chase') { modal("Rusty's Used Autos", '<p>Sal waves you off the lot: "Not with the cops on you. Lose them, then come back."</p>'); return; }
  const v = th.hot, m = CAR_BY_ID[v.car.modelId], offer = th.salOffer();
  const pick = await modal("Rusty's Used Autos", `<p class="muted">Sal walks around the ${esc(carName(m, v.car.year))} and looks at the punched ignition. "I don't want to know."</p>
    <p>He'll give you <b>${fmtMoney(offer)}</b> cash for it, no questions asked. The car gets parted out tonight.</p>
    <p class="small muted">"Or take it to my nephew Junior at Marchetti Salvage and strip it yourself. More money. More heat."</p>`,
    [{ label: `Sell it · ${fmtMoney(offer)}`, primary: true, value: 'sell' }, { label: 'Just browsing', value: 'lot' }]);
  if (pick === 'sell') { const paid = th.sell(); audio.buy?.(); toast(`Sal paid ${fmtMoney(paid)}. That car never existed.`, 'good'); emit('carFenced', { paid }); }
  else if (pick === 'lot') usedlot(loc, app, s);
}

// Sal only does cars. Goods go to Dre at Cash Cow Pawn.
async function fenceGoods(loc, app, s) {
  const pick = await modal("Rusty's Used Autos", `<p class="muted">Sal looks at the bag. "I do cars. Take that to Dre in the back of Cash Cow Pawn on East Lancaster. He'll give you cash, no questions."</p>`,
    [{ label: 'GPS to Cash Cow Pawn', primary: true, value: 'gps' }, { label: 'Look at cars', value: 'lot' }]);
  if (pick === 'gps') { const l = LOC_BY_ID.cashcow_pawn; app.world?.setGps(l.x, l.z, l.name); }
  else if (pick === 'lot') usedlot(loc, app, s);
}

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
    root.innerHTML = head(loc.name, loc.tagline || 'Rosa Vega, owner · dyno cell · two lifts · no drama') + `<div class="p-body">
      <p class="muted">${esc(loc.owner || 'Rosa')}: "${activeCar(s) ? `What are we doing to the ${esc(modelOf(activeCar(s)).model)} today?` : 'No car? Come back when you have something for me to work on.'}"</p>
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
        <div class="card click" data-action="studio"><h3>✨ Design studio</h3><p class="muted small">Try paint, rims, tint, body kits and more on your car before you pay. See what show judges would score it.</p></div>
        <div class="card click" data-action="counter"><h3>🎨 Paint, wraps & body</h3><p class="muted small">Respray, wraps, widebody kits, wheels, aero — installed today.</p></div>
        <div class="card click" data-action="booth"><h3>🔧 Install your parts</h3><p class="muted small">Bring visual parts you bought online.</p></div>
      </div>
      <p class="small muted">Manny: "Car show at the Stockyards every Saturday and Sunday, 10 to 6. Win it and people will know the shop."</p></div>`;
    bind(root, {
      close: () => h.close(),
      studio: () => { if (!activeCar(s)) { toast('Bring a car to the booth first', 'info'); return; } openKustoms(app); },
      counter: () => openPartsHub(app, { store: 'visual' }),
      booth: () => openGarage(app, { mode: 'visual', tab: 'install' }),
    });
  });
}

function repairCosts(car, rate = 1) {
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
  for (const k in cost) cost[k] = Math.round(cost[k] * rate / 5) * 5;
  return cost;
}

function repair(loc, app, s) {
  openPanel((root, h) => {
    const car = activeCar(s);
    if (!car) { root.innerHTML = head(loc.name) + '<div class="p-body"><div class="empty">Nothing to fix — you don\'t have a car.</div></div>'; bind(root, { close: () => h.close() }); return; }
    const costs = repairCosts(car, loc.rate || 1);
    const ins = s.insurance ? 0.3 : 1;
    const oilDue = needsOil(car) && (car.oil ?? 100) < 99;
    const rate = loc.rate || 1;
    const oilCost = oilDue ? Math.round(oilChangeCost(car) * rate * 100) / 100 : 0;   // maintenance: insurance doesn't cover it
    const total = Object.values(costs).reduce((a, b) => a + b, 0) * ins + oilCost;
    const names = { body: 'Body & paint', lights: 'Lights', tires: 'Tires (replace set)', engine: car.engineBlown ? '💥 Engine rebuild' : 'Engine', trans: 'Transmission' };
    const priceNote = rate < 0.97 ? `<span class="good">${Math.round((1 - rate) * 100)}% under Second Chance prices</span>` : rate > 1.03 ? `<span class="bad">${Math.round((rate - 1) * 100)}% over Second Chance prices</span>` : '';
    root.innerHTML = head(loc.name, loc.tagline || 'Body · mechanical · tires') + `<div class="p-body" style="max-width:720px">
      ${car.broken ? `<p class="bad"><b>🛠 ${esc(BREAKDOWNS[car.broken].name)}.</b> ${car.broken === 'trans' ? 'Fix the transmission and it\'ll drive again.' : 'Change the oil and fix the engine and it\'ll run again.'}</p>` : ''}
      ${car.engineBlown ? `<p class="bad"><b>Blown motor.</b> Spun a bearing and put a rod through the block. It needs a full rebuild before it'll run again.</p>` : ''}
      <p class="muted">${esc(carName(modelOf(car), car.year))}${s.insurance ? ' · <span class="good">Insurance covers 70%</span>' : ' · <span class="muted">Not insured (Bank app)</span>'}${priceNote ? ' · ' + priceNote : ''}</p>
      <div class="list">${Object.entries(costs).map(([k, v]) => `<div class="li"><div style="width:150px">${names[k]}</div><div class="grow">${bar(car.cond[k], car.cond[k] < 40 ? 'red' : car.cond[k] < 70 ? 'yellow' : 'green')}</div><span style="width:44px;text-align:right">${Math.round(car.cond[k])}%</span>
        <button class="btn btn-sm" data-action="fix" data-k="${k}" ${v > 0 ? '' : 'disabled'}>${v > 0 ? fmtMoney(v * ins) : 'OK'}</button></div>`).join('')}
        ${needsOil(car) ? `<div class="li"><div style="width:150px">Oil change</div><div class="grow">${bar(car.oil ?? 100, (car.oil ?? 100) < 20 ? 'red' : (car.oil ?? 100) < 45 ? 'yellow' : 'green')}</div><span style="width:44px;text-align:right">${Math.round(car.oil ?? 100)}%</span>
        <button class="btn btn-sm" data-action="oil" ${oilDue ? '' : 'disabled'}>${oilDue ? fmtMoney(oilCost, true) : 'OK'}</button></div>` : ''}</div>
      <div class="row" style="margin-top:12px"><div class="grow"></div><button class="btn btn-primary" data-action="all" ${total > 0 ? '' : 'disabled'}>Fix everything · ${fmtMoney(total)}</button></div></div>`;
    const fix = k => { car.cond[k] = 100; if (k === 'engine' && car.engineBlown) { car.engineBlown = false; resetEngineWarnings(car); toast('Engine rebuilt. Fix the build or it\'ll happen again.', 'good'); } };
    bind(root, {
      close: () => h.close(),
      fix: d => { if (spend(s, costs[d.k] * ins, `Repair: ${names[d.k]}`)) { fix(d.k); clearBreakdown(car); app.world?.refreshCar(); h.refresh(); } },
      oil: () => { if (spend(s, oilCost, 'Oil change')) { changeOil(car); toast('Fresh oil. Good for another ' + oilInterval(carSpec(car)) + ' miles.', 'good'); app.world?.refreshCar(); h.refresh(); } },
      all: () => { if (spend(s, total, 'Full repair')) { Object.keys(costs).forEach(fix); if (needsOil(car)) changeOil(car); clearBreakdown(car); app.world?.refreshCar(); toast('Good as new', 'good'); h.refresh(); } },
    });
  });
}

function gas(loc, app, s) {
  openPanel((root, h) => {
    const w = app.world;
    const car = w?.vehicle?.car?.hot ? w.vehicle.car : activeCar(s);   // filling up a stolen car works too
    const near = car && w?.vehicle && Math.hypot(w.vehicle.x - loc.x, w.vehicle.z - loc.z) < 45;
    const m = car ? modelOf(car) : null;
    const ev = m?.asp === 'ev';
    const grade = !car ? null : ev ? 'kwh' : needsPremium(car) ? 'premium' : 'regular';
    const need = car ? (1 - car.fuel) * tankGallons(car) : 0;
    const price = grade ? GAS[grade] : 0;
    root.innerHTML = head(loc.name, `Regular $${GAS.regular} · Premium $${GAS.premium} · E85 $${GAS.e85} · EV $${GAS.kwh}/kWh`) + `<div class="p-body" style="max-width:640px">
      ${car ? `<div class="li"><div class="grow"><div class="t">${esc(carName(m, car.year))}</div><div class="s">${ev ? 'Battery' : 'Tank'}: ${(car.fuel * tankGallons(car)).toFixed(1)} / ${tankGallons(car)} ${ev ? 'kWh' : 'gal'} · ${ev ? 'DC fast charging' : grade === 'premium' ? 'Premium 93 required' : 'Regular 87'}</div>${bar(car.fuel * 100, car.fuel < 0.2 ? 'red' : 'green')}</div></div>
        <div class="row" style="margin:10px 0"><button class="btn btn-primary" data-action="fill" ${near && need > 0.05 ? '' : 'disabled'}>${near ? `Fill up · ${fmtMoney(need * price, true)}` : 'Park at the pump first'}</button></div>` : '<p class="muted">No car.</p>'}
      ${car && needsOil(car) ? `<div class="section-title">Quick lube</div>
      <div class="li"><div class="grow"><div class="t">Oil change${modelOf(car).asp !== 'na' || (modelOf(car).hp || 0) > 300 ? ' (full synthetic)' : ''}</div><div class="s">Oil life ${Math.round(car.oil ?? 100)}% · good for ~${oilInterval(carSpec(car))} mi on this build · 15 min${car.broken && car.broken !== 'trans' ? ' · gets it running again' : ''}</div>${bar(car.oil ?? 100, (car.oil ?? 100) < 20 ? 'red' : (car.oil ?? 100) < 45 ? 'yellow' : 'green')}</div>
        <button class="btn btn-sm ${(car.oil ?? 100) < 20 ? 'btn-primary' : ''}" data-action="oil" ${near && (car.oil ?? 100) < 99 ? '' : 'disabled'}>${near ? fmtMoney(oilChangeCost(car), true) : 'At the pump'}</button></div>` : ''}
      <div class="section-title">Store</div>
      <div class="list">
        <div class="li"><div class="grow"><div class="t">Volt Energy Drink</div><div class="s">+25 energy (sharper reactions)</div></div><button class="btn btn-sm" data-action="snack" data-p="3.49" data-e="25">$3.49</button></div>
        <div class="li"><div class="grow"><div class="t">Gas station hot dog</div><div class="s">+25 food, +5 energy. Questionable.</div></div><button class="btn btn-sm" data-action="snack" data-p="2.29" data-e="5" data-f="25">$2.29</button></div>
        <div class="li"><div class="grow"><div class="t">Chips and a soda</div><div class="s">+10 food, +5 energy.</div></div><button class="btn btn-sm" data-action="snack" data-p="3.19" data-e="5" data-f="10">$3.19</button></div>
        <div class="li"><div class="grow"><div class="t">Volt Energy Drink (to go)</div><div class="s">Goes in your bag. Drink it from the meters on your screen.</div></div><button class="btn btn-sm" data-action="togo" data-p="3.49">$3.49</button></div>
        <div class="li"><div class="grow"><div class="t">Octane booster</div><div class="s">It does nothing. People buy it anyway.</div></div><button class="btn btn-sm" data-action="snack" data-p="8.99" data-e="0">$8.99</button></div>
      </div></div>`;
    bind(root, {
      close: () => h.close(),
      fill: () => { const cost = need * price; if (spend(s, cost, `${loc.name}: ${need.toFixed(1)} ${ev ? 'kWh' : 'gal'} ${grade}`)) { car.fuel = 1; if (ev) advanceTime(s, 25); toast(ev ? 'Charged to 100% (25 min)' : 'Tank full', 'good'); h.refresh(); } },
      snack: d => { if (spend(s, +d.p, 'Gas station snack')) { eat(s, { food: +(d.f || 0), energy: +d.e }); h.refresh(); } },
      togo: d => { if (spend(s, +d.p, 'Volt Energy Drink')) { ensureNeeds(s); s.inventory.energyDrinks++; toast('In your bag. Tap the meters to drink it.', 'good'); h.refresh(); } },
      oil: () => { if (spend(s, oilChangeCost(car), `${loc.name}: oil change`)) { changeOil(car); if (car.broken && BREAKDOWNS[car.broken].roadside && car.cond.engine < 30) car.cond.engine = 30; clearBreakdown(car); advanceTime(s, 15); toast(car.broken ? 'Fresh oil, but the car still needs a mechanic' : 'Fresh oil', 'good'); h.refresh(); } },
    });
  });
}

// Taco trucks, diners, the BBQ joint (data/food.js) and the original two
// (Lucky's and the noodle bar, data/shops.js).
function food(loc, app, s) {
  const menu = MENUS[loc.menu] || FOOD;
  const truck = !!loc.truck;
  openPanel((root, h) => {
    ensureNeeds(s);
    const bag = s.inventory;
    const gives = f => [f.food ? `+${f.food} food` : '', f.energy ? `+${f.energy} energy` : ''].filter(Boolean).join(', ');
    root.innerHTML = head(loc.name, needsLine(s)) + `<div class="p-body" style="max-width:640px">
      <div class="needs-row">${meter('🌮 Food', s.player.food)}${meter('⚡ Energy', s.player.energy)}</div>
      <div class="list">${menu.map(f => `<div class="li"><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">${esc(f.desc)}${gives(f) ? ` · ${gives(f)}` : ''}${f.item ? ` · in your bag: ${bag[f.item] || 0}` : ''}</div></div><button class="btn btn-sm" data-action="buy" data-id="${f.id}">${fmtMoney(f.price * 1.0725, true)}</button></div>`).join('')}</div>
      <p class="small muted">${truck ? 'Cash only. The line moves fast.' : 'Racers hang out here. Sometimes you overhear things.'}</p></div>`;
    bind(root, {
      close: () => h.close(),
      buy: d => {
        const f = menu.find(x => x.id === d.id);
        if (!spend(s, f.price * 1.0725, `${loc.name}: ${f.name}`)) return;
        if (f.item) { bag[f.item] = (bag[f.item] || 0) + 1; toast('In your bag. Tap the meters on your screen to eat it later.', 'good'); }
        eat(s, f);
        advanceTime(s, f.item ? 5 : truck ? 10 : 20);
        if (!truck && Math.random() < 0.35) toast(['Overheard: "Static only races after midnight."', 'Overheard: "Somebody ran 9s at Ironline last week on drag radials."', 'Overheard: "Cops set up on Loop 820 on Fridays."', 'Overheard: "Rosa can make a Civic do anything."'][Math.floor(Math.random() * 4)], 'info');
        h.refresh();
      },
    });
  });
}

const meter = (label, v) => `<div class="need"><span>${label}</span>${bar(v, v < 25 ? 'red' : v < 60 ? 'yellow' : 'green')}<b>${Math.round(v)}</b></div>`;
function needsLine(s) {
  ensureNeeds(s);
  return `Food ${Math.round(s.player.food)}/100 · Energy ${Math.round(s.player.energy)}/100`;
}

// Corner store: snacks and drinks behind the plexiglass. (Rob it with a gun out: world2d/combat.js.)
function corner(loc, app, s) {
  openPanel((root, h) => {
    const items = [
      { n: 'Hot Cheetos and a tea', d: '+15 food, +10 energy', p: 2.99, e: 10, f: 15 },
      { n: 'Big Red', d: '+10 energy. A Texas classic.', p: 1.79, e: 10 },
      { n: 'Volt Energy Drink', d: '+25 energy', p: 3.49, e: 25 },
      { n: 'Honey bun', d: '+20 food, +10 energy', p: 1.49, e: 10, f: 20 },
    ];
    root.innerHTML = head(loc.name, 'Snacks · drinks · smokes · scratchers') + `<div class="p-body" style="max-width:640px">
      <p class="muted small">The clerk watches you through the bulletproof glass.</p>
      <div class="list">${items.map((f, i) => `<div class="li"><div class="grow"><div class="t">${esc(f.n)}</div><div class="s">${esc(f.d)}</div></div><button class="btn btn-sm" data-action="snack" data-i="${i}">${fmtMoney(f.p, true)}</button></div>`).join('')}</div></div>`;
    bind(root, {
      close: () => h.close(),
      snack: d => { const f = items[+d.i]; if (spend(s, f.p, `${loc.name}: ${f.n}`)) { eat(s, { food: f.f || 0, energy: f.e }); h.refresh(); } },
    });
  });
}

function clothing(loc, app, s) { wardrobe(app, s, loc); }

function police(loc, app, s) {
  openPanel((root, h) => {
    const w = app.world;
    const heat = s.heat;
    const fine = Math.round(heat * 350 / 10) * 10;
    const held = s.cars.filter(c => c.impound);
    root.innerHTML = head(loc.name, 'Fort Worth Police Department') + `<div class="p-body" style="max-width:640px">
      ${w?.police.active ? '<p class="bad">You walked into a police station while they\'re looking for you. Bold.</p>' : ''}
      ${held.length ? `<div class="li"><div class="grow"><div class="t">Impound lot</div><div class="s">${held.map(c => esc(carName(modelOf(c), c.year))).join(', ')} ${held.length > 1 ? 'are' : 'is'} ${loc.id === IMPOUND_LOT ? 'out back' : 'at the Central Precinct lot'}. Sign ${held.length > 1 ? 'them' : 'it'} out here, no charge.</div></div>
        ${loc.id === IMPOUND_LOT ? `<button class="btn btn-sm btn-primary" data-action="release" ${w?.police.active ? 'disabled' : ''}>Get it out</button>` : '<button class="btn btn-sm" data-action="lotgps">GPS</button>'}</div>` : ''}
      <div class="li"><div class="grow"><div class="t">Outstanding citations</div><div class="s">${heat > 0.05 ? `Your heat is ${heat.toFixed(1)}. Paying your tickets clears it.` : 'You\'re clean.'}</div></div>
        <button class="btn btn-sm btn-primary" data-action="pay" ${heat > 0.05 && !w?.police.active ? '' : 'disabled'}>Pay ${fmtMoney(fine)}</button></div>
      <div class="section-title">Your record</div>
      ${recordHtml(s)}
      ${s.warrants.length || s.citations.length ? `<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
        ${payableTotal(s) ? `<button class="btn btn-sm" data-action="fines" ${w?.police.active ? 'disabled' : ''}>Pay tickets${s.warrants.some(x => !x.felony) ? ' + misdemeanours' : ''} · ${fmtMoney(payableTotal(s))}</button>` : ''}
        <button class="btn btn-sm btn-primary" data-action="surrender">Turn yourself in${surrenderTotal(s) ? ` · ${fmtMoney(surrenderTotal(s))}` : ''}</button></div>
        <p class="small muted">Turning yourself in clears tickets and misdemeanour warrants at 25% off.${hasFelony(s) ? ' Felony warrants get filed at the Tarrant County Courthouse: you\'re booked, bail is set low because you came in on your own, and you get a court date.' : ' You spend a few hours being booked.'}</p>` : ''}
      <div class="section-title">Sgt. Hal Brenner</div>
      <p class="muted">"${s.stats.pursuitsEscaped > 2 ? `${esc(s.player.name)}. You've been busy. I've got a whiteboard now. You're on it.` : 'Street racing kills people. Take it to Ironline Dragway — it\'s legal there.'}"</p></div>`;
    bind(root, {
      close: () => h.close(),
      pay: () => { if (spend(s, fine, 'FWPD citations')) { s.heat = 0; toast('Record cleared', 'good'); h.refresh(); } },
      fines: () => { const r = payFines(s); if (r.ok) { toast(`Paid ${fmtMoney(r.total)}`, 'good'); h.refresh(); } },
      release: () => {
        for (const c of held) delete c.impound;
        toast(`Released. Your car${held.length > 1 ? 's are' : ' is'} in the lot out front`, 'good'); h.refresh();
      },
      lotgps: () => { const l = LOC_BY_ID[IMPOUND_LOT]; w?.setGps(l.x, l.z, l.name); h.close(); },
      courtgps: () => { const l = LOC_BY_ID.courthouse; w?.setGps(l.x, l.z, l.name); h.close(); },
      surrender: async () => {
        const all = surrenderTotal(s), fel = hasFelony(s);
        if (!(await confirm('Turn yourself in?', `<p>You'll be booked${all ? ` and pay <b>${fmtMoney(all)}</b> in fines` : ''}.${fel ? ' Your felony warrants become a case at the Tarrant County Courthouse, with low bail and a court date.' : ' You walk out a few hours later with a clean record.'}</p>`, 'Turn myself in'))) return;
        const r = surrender(s);
        if (!r.ok) return;
        if (w?.police.active) w.police.reset(w);
        addRep(s, -15, 'Turned yourself in');
        const { charges } = charge(r.felonies, 0.6);
        if (charges.length || r.skipped) {
          const c = fileCase(s, charges, { surrender: true });
          h.close();
          await book(app, c);
          return;
        }
        advanceTime(s, 4 * 60);   // booked, processed, released
        toast('Booked and released. Your record is clean.', 'good'); h.refresh();
      },
    });
  });
}
