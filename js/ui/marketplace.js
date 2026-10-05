// Marketplace: the social-marketplace app for private used-car sales.
// Browse cheap high-mileage cars, message sellers, haggle, buy; or list
// your own cars and take offers.

import { bind, esc, toast, modal, confirm, prompt, bar } from './dom.js';
import { ensureTow } from '../core/tow.js';
import { game, fmtMoney, newCar, spend, earn, carValue, activeCar, carSpec, carMetrics, modelOf, garageCapacity, uid, gameTimeStr } from '../core/state.js';
import { payoffOnSale } from '../core/credit.js';
import { CAR_BY_ID, carName, MAKES, CURRENT_YEAR } from '../data/cars.js';
import { negotiate, avgCond, makeListing } from '../data/market.js';
import { partLevels } from '../data/parts.js';
import { ITEM_BY_ID } from '../data/catalog.js';
import { buildSpec, metrics, MPH } from '../sim/powertrain.js';
import { carSprite } from '../gfx2d/carSprite.js';
import { PROPERTIES } from '../data/world.js';
import { emit } from '../core/events.js';
import { sendMessage } from '../core/story.js';
import { audio } from '../core/audio.js';

const PRICE_FILTERS = [[3000, 'Under $3k'], [5000, 'Under $5k'], [10000, 'Under $10k'], [25000, 'Under $25k'], [Infinity, 'Any price']];
const DISTRICT_PTS = {
  'Arlington Heights': [-600, 100], 'Near Southside': [0, 620], Riverside: [600, -250], 'Lakeside': [650, 760], Stockyards: [0, -560],
  Downtown: [0, 0], Eastgate: [450, 60], 'Chisholm Flats': [0, 1500], 'Stop Six': [1700, -400],
};

let filt = { price: 5000, q: '', make: '', sort: 'new', manual: false };

export function drawThumb(cv, model, visual, parts, cond) {
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#6c6f74'); grd.addColorStop(1, '#3f4246');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let x = -w; x < w * 2; x += w / 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w * 0.15, h); g.stroke(); }
  const sp = carSprite(model, visual, partLevels(parts || {}), cond);
  const scale = Math.min(w * 0.9 / sp.canvas.height, h * 0.8 / sp.canvas.width);
  g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 2);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-sp.canvas.width * scale * 0.42 + 6, -sp.canvas.height * scale * 0.45 + 6, sp.canvas.width * scale * 0.84, sp.canvas.height * scale * 0.9);
  g.drawImage(sp.canvas, -sp.canvas.width * scale / 2, -sp.canvas.height * scale / 2, sp.canvas.width * scale, sp.canvas.height * scale);
  g.restore();
}

export function openMarketplace(scr, ctx) {
  const s = ctx.s;
  if (!s.listings?.length) { s.listings = []; for (let i = 0; i < 30; i++) s.listings.push(makeListing()); }
  const sub = ctx.st.sub;
  if (sub === 'selling') return renderSelling(scr, ctx);
  if (sub && sub.startsWith('ls:')) return renderDetail(scr, ctx, sub.slice(3));
  renderBrowse(scr, ctx);
}

function renderBrowse(scr, ctx) {
  const s = ctx.s;
  let list = s.listings.filter(l => l.price <= filt.price);
  if (filt.make) list = list.filter(l => CAR_BY_ID[l.modelId].make === filt.make);
  if (filt.manual) list = list.filter(l => /MT/.test(CAR_BY_ID[l.modelId].transCode));
  if (filt.q) { const q = filt.q.toLowerCase(); list = list.filter(l => l.title_.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q)); }
  list = [...list].sort((a, b) => filt.sort === 'low' ? a.price - b.price : filt.sort === 'high' ? b.price - a.price : filt.sort === 'miles' ? a.miles - b.miles : a.posted - b.posted);
  const makes = [...new Set(s.listings.map(l => CAR_BY_ID[l.modelId].make))].sort();
  scr.innerHTML = `<div class="mp"><div class="app-head"><button class="back" data-action="home">‹</button><h2>Marketplace</h2><button class="btn btn-sm btn-fb" data-action="sell">Sell</button></div>
    <div class="mp-search"><input class="input" data-q placeholder="Search Marketplace (e.g. civic, manual, turbo)" value="${esc(filt.q)}"></div>
    <div class="mp-filters">${PRICE_FILTERS.map(([v, l]) => `<button class="${filt.price === v ? 'on' : ''}" data-action="price" data-v="${v}">${l}</button>`).join('')}
      <button class="${filt.manual ? 'on' : ''}" data-action="manual">Manual</button></div>
    <div class="mp-filters"><select class="input" data-make style="width:auto;padding:4px 8px;font-size:13px"><option value="">All makes</option>${makes.map(m => `<option value="${m}" ${filt.make === m ? 'selected' : ''}>${MAKES[m]}</option>`).join('')}</select>
      <select class="input" data-sort style="width:auto;padding:4px 8px;font-size:13px">${[['new', 'Newest'], ['low', 'Price: low'], ['high', 'Price: high'], ['miles', 'Lowest miles']].map(([v, l]) => `<option value="${v}" ${filt.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div style="padding:0 12px;font-size:13px;color:#b0b3b8">Vehicles near Fort Worth · ${list.length} results · cash ${fmtMoney(s.cash + s.bank)}</div>
    <div class="mp-grid">${list.map(l => `<div class="mp-item" data-action="open" data-id="${l.id}"><canvas width="220" height="220" data-thumb="${l.id}"></canvas>
      <div class="p">${fmtMoney(l.price)}</div><div class="t">${esc(l.title_)}</div><div class="l">${Math.round(l.miles / 1000)}K miles · ${esc(l.district)}</div></div>`).join('') || '<div class="empty" style="grid-column:span 2">Nothing matches. Try a higher price filter.</div>'}</div></div>`;
  for (const cv of scr.querySelectorAll('[data-thumb]')) {
    const l = s.listings.find(x => x.id === cv.dataset.thumb);
    drawThumb(cv, CAR_BY_ID[l.modelId], { ...defaultVis(l) }, l.mods, l.cond);
  }
  const q = scr.querySelector('[data-q]');
  q.onchange = () => { filt.q = q.value; ctx.h.refresh(); };
  scr.querySelector('[data-make]').onchange = e => { filt.make = e.target.value; ctx.h.refresh(); };
  scr.querySelector('[data-sort]').onchange = e => { filt.sort = e.target.value; ctx.h.refresh(); };
  bind(scr, {
    home: () => ctx.go(null),
    sell: () => ctx.go('marketplace', 'selling'),
    price: d => { filt.price = d.v === 'Infinity' ? Infinity : +d.v; ctx.h.refresh(); },
    manual: () => { filt.manual = !filt.manual; ctx.h.refresh(); },
    open: d => ctx.go('marketplace', 'ls:' + d.id),
  });
}

function defaultVis(l) {
  return { wheels: 'steel', wheelColor: '#9aa0a8', tint: 'none', ...l.visual };
}

function renderDetail(scr, ctx, id) {
  const s = ctx.s;
  const l = s.listings.find(x => x.id === id);
  if (!l) { ctx.go('marketplace'); return; }
  const m = CAR_BY_ID[l.modelId];
  const spec = buildSpec(m, partLevels(l.mods), l.cond);
  const mt = metrics(spec);
  l.chat ??= [];
  const deal = l.deal;
  const fees = Math.round((deal ?? l.price) * 0.0725 + 85);
  const cap = garageCapacity(s, PROPERTIES);
  scr.innerHTML = `<div class="mp mp-detail"><div class="app-head"><button class="back" data-action="back">‹ Marketplace</button><h2></h2></div>
    <canvas width="400" height="260" data-big></canvas>
    <div class="body">
      <h3>${esc(l.title_)}</h3>
      <div class="price">${fmtMoney(deal ?? l.price)}${deal ? ' <span class="tag tag-green">Agreed</span>' : ''}</div>
      <div style="color:#b0b3b8;font-size:13px">Listed ${l.posted < 24 ? l.posted + ' hours' : Math.floor(l.posted / 24) + ' days'} ago in ${esc(l.district)}</div>
      <div class="section-title">Details</div>
      <div class="kv"><span>Mileage</span><span>${l.miles.toLocaleString()} miles</span><span>Title</span><span class="${l.title !== 'Clean' ? 'bad' : ''}">${l.title}</span>
        <span>Transmission</span><span>${esc(m.trans)}</span><span>Drivetrain</span><span>${m.drive}</span><span>Engine</span><span>${esc(m.engine)}</span>
        <span>Power (as it sits)</span><span>${spec.hp} hp / ${spec.tq} lb-ft</span><span>0-60 (est.)</span><span>${mt.zero60?.toFixed(1)}s</span><span>Quarter (est.)</span><span>${mt.quarter?.toFixed(2)}s</span>
        <span>New price (${m.years[1]})</span><span>${fmtMoney(m.msrp)}</span></div>
      <div class="section-title">Condition (your inspection)</div>
      ${['engine', 'trans', 'body', 'tires', 'lights'].map(k => `<div class="cond"><span>${{ engine: 'Engine', trans: 'Transmission', body: 'Body', tires: 'Tires', lights: 'Lights' }[k]}</span>${bar(l.cond[k], l.cond[k] < 40 ? 'red' : l.cond[k] < 70 ? 'yellow' : 'green')}<span>${l.cond[k]}%</span></div>`).join('')}
      ${Object.keys(l.mods).length ? `<div class="section-title">Mods included</div><div class="small">${Object.values(l.mods).map(pid => `${esc(ITEM_BY_ID[pid]?.brand)} ${esc(ITEM_BY_ID[pid]?.name)}`).join('<br>')}</div>` : ''}
      <div class="section-title">Seller's description</div>
      <p style="margin:0;line-height:1.4">${esc(l.desc)}</p>
      <div class="row" style="margin-top:10px"><span class="avatar" style="background:${l.seller.color}">${esc(l.seller.name[0])}</span><div class="grow"><b>${esc(l.seller.name)}</b><div style="color:#b0b3b8;font-size:13px">★ ${l.seller.rating} · Joined Marketplace</div></div></div>
      <div class="mp-chat">${l.chat.map(c => `<div class="bubble ${c.me ? 'me' : 'them'}">${esc(c.text)}</div>`).join('') || '<div style="color:#b0b3b8;font-size:13px">Send the seller a message</div>'}</div>
      ${deal ? `<p class="small" style="color:#b0b3b8">Title, tax & registration at the DMV: ${fmtMoney(fees)} · Garage space: ${s.cars.length}/${cap}</p>
        <button class="btn btn-fb" style="width:100%" data-action="buy">Pay ${fmtMoney(deal + fees)} & pick it up</button>`
        : `<div class="row"><button class="btn btn-sm" data-action="avail">Is this still available?</button><button class="btn btn-sm btn-fb" data-action="offer">Make offer</button><button class="btn btn-sm" data-action="full">Offer asking price</button></div>`}
    </div></div>`;
  drawThumb(scr.querySelector('[data-big]'), m, defaultVis(l), l.mods, l.cond);
  const say = (me, text) => { l.chat.push({ me, text }); };
  bind(scr, {
    back: () => ctx.go('marketplace'),
    avail: () => { say(true, 'Is this still available?'); say(false, l.patience > 0 ? 'Yes it is' : 'Sold, sorry'); ctx.h.refresh(); },
    full: () => { say(true, `I'll take it for ${fmtMoney(l.price)}.`); say(false, 'Deal. When can you come get it?'); l.deal = l.price; audio.phone(); ctx.h.refresh(); },
    offer: async () => {
      const v = await prompt('Make an offer', `<p>Asking ${fmtMoney(l.price)}. Lowball too hard and they stop answering.</p>`, 'Your offer', String(Math.round(l.price * 0.85 / 50) * 50));
      if (!v) return;
      const amt = +String(v).replace(/[^\d]/g, '');
      if (!amt) return;
      say(true, `Would you take ${fmtMoney(amt)}?`);
      const r = negotiate(l, amt);
      say(false, r.msg);
      if (r.result === 'accept') l.deal = r.price;
      audio.phone();
      ctx.h.refresh();
    },
    buy: () => buyListing(ctx, l, l.deal + fees),
  });
}

function buyListing(ctx, l, total) {
  const s = ctx.s;
  const cap = garageCapacity(s, PROPERTIES);
  if (s.cars.length >= cap) { modal('No garage space', `<p>You have ${s.cars.length} cars and room for ${cap}. Sell a car or buy a bigger place (Bayline Realty).</p>`); return; }
  if (!spend(s, total, `Bought ${l.title_} (Marketplace)`)) return;
  const m = CAR_BY_ID[l.modelId];
  const car = newCar(l.modelId, {
    year: l.year, miles: l.miles, title: l.title, cond: { ...l.cond }, paid: l.deal,
    fuel: 0.15 + Math.random() * 0.4,
  });
  Object.assign(car.visual, defaultVis(l));
  for (const [k, pid] of Object.entries(l.mods)) car.parts[k] = pid;
  s.cars.push(car);
  s.listings = s.listings.filter(x => x !== l);
  const prev = s.activeCar;
  s.activeCar = car.uid;
  // the car waits at the seller's place
  const w = ctx.app.world;
  const [cx, cz] = DISTRICT_PTS[l.district] || [0, 0];
  let x = cx + (Math.random() - 0.5) * 160, z = cz + (Math.random() - 0.5) * 160;
  if (w) {
    const r = w.map.roads.nearestOnRoad(x, z);
    const off = r.edge.width / 2 + 3;
    x = r.x - r.edge.dz * off; z = r.z + r.edge.dx * off;
    s.carPos = { x, z, h: Math.atan2(r.edge.dx, -r.edge.dz) };
    w.placeCar(car, x, z, s.carPos.h);
    w.inCar = false;
    w.setGps(x, z, `Pick up your ${m.model}`);
  }
  emit('carBought', { modelId: m.id, source: 'marketplace' });
  sendMessage(s, 'marketplace', `${l.seller.name}: Money received 👍 It's parked on the street in ${l.district}, keys are on the front tire. Title is signed. Good luck with it.`);
  modal('You bought a car!', `<p><b>${esc(l.title_)}</b> is yours.</p><p>It's waiting in <b>${esc(l.district)}</b> — your GPS is set. Walk there, or use <b>Ryde</b> on your phone to get a ride.</p>${prev ? '<p class="muted small">Your previous car was dropped back at your home garage.</p>' : ''}`);
  ctx.h.close();
}

function renderSelling(scr, ctx) {
  const s = ctx.s;
  const listed = new Set(s.myListings.map(m => m.carUid));
  scr.innerHTML = `<div class="mp"><div class="app-head"><button class="back" data-action="back">‹ Marketplace</button><h2>Your listings</h2></div><div class="app-body">
    ${s.myListings.map(ml => {
      const c = s.cars.find(x => x.uid === ml.carUid);
      if (!c) return '';
      return `<div class="msg"><div class="from"><span>${esc(carName(modelOf(c), c.year))}</span><small>Asking ${fmtMoney(ml.asking)}</small></div>
        ${ml.offers.length ? ml.offers.map(o => `<div class="row" style="margin-top:6px"><div class="grow">${esc(o.name)} offers <b>${fmtMoney(o.amount)}</b></div><button class="btn btn-sm btn-fb" data-action="accept" data-car="${c.uid}" data-o="${o.id}">Accept</button></div>`).join('') : '<p>No offers yet. Buyers message you over time (lower price = more offers).</p>'}
        <div class="row" style="margin-top:6px"><button class="btn btn-sm" data-action="delist" data-car="${c.uid}">Remove listing</button></div></div>`;
    }).join('')}
    <div class="section-title">List a car</div>
    ${s.cars.filter(c => !listed.has(c.uid)).map(c => `<div class="li"><div class="grow"><div class="t">${esc(carName(modelOf(c), c.year))}</div><div class="s">Estimated private-sale value ${fmtMoney(carValue(c))}</div></div><button class="btn btn-sm btn-fb" data-action="list" data-car="${c.uid}">List</button></div>`).join('') || '<p style="color:#b0b3b8">No cars to list.</p>'}
  </div></div>`;
  bind(scr, {
    back: () => ctx.go('marketplace'),
    list: async d => {
      const c = s.cars.find(x => x.uid === d.car);
      const v = await prompt('Asking price', `<p>Fair value is about ${fmtMoney(carValue(c))}. Price it high and you'll wait; price it low and it goes fast.</p>`, '$', String(Math.round(carValue(c) * 1.1 / 100) * 100));
      if (!v) return;
      s.myListings.push({ carUid: c.uid, asking: +String(v).replace(/[^\d]/g, ''), offers: [] });
      toast('Listed on Marketplace', 'good');
      ctx.h.refresh();
    },
    delist: d => { s.myListings = s.myListings.filter(m => m.carUid !== d.car); ctx.h.refresh(); },
    accept: async d => {
      const ml = s.myListings.find(m => m.carUid === d.car);
      const o = ml.offers.find(x => x.id === d.o);
      const c = s.cars.find(x => x.uid === d.car);
      if (!(await confirm('Sell it?', `<p>Sell your ${esc(carName(modelOf(c), c.year))} to ${esc(o.name)} for <b>${fmtMoney(o.amount)}</b>?</p>`, 'Sell'))) return;
      sellCar(s, c, o.amount, ctx.app);
      ctx.h.refresh();
    },
  });
}

export function sellCar(s, c, amount, app) {
  s.cars = s.cars.filter(x => x !== c);
  ensureTow(s);   // it can't stay on (or pull) a trailer once it's gone
  s.myListings = s.myListings.filter(m => m.carUid !== c.uid);
  // a car with a loan on it: the credit union gets paid off first (core/credit.js)
  const { payoff } = payoffOnSale(s, c.uid, amount);
  earn(s, amount, `Sold ${carName(modelOf(c), c.year)}`);
  if (payoff) { s.cash -= payoff; s.stats.expenses += payoff; s.ledger.unshift({ day: s.time.day, t: gameTimeStr(s.time), label: `Auto loan payoff from the sale`, amount: -payoff }); }
  if (s.activeCar === c.uid) {
    s.activeCar = s.cars[0]?.uid || null;
    s.carPos = null;
    if (app?.world) app.world.refreshCar();
  }
}
