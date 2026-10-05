// Cowtown Trailer Sales (buy and sell trailers) and the Trailer screen at
// home (hitch one to a truck, load a car on it). Rules live in core/tow.js;
// the trailer out on the road is world2d/trailer.js.

import { openPanel, bind, esc, toast, confirm } from './dom.js';
import { game, fmtMoney, spend, earn, activeCar, modelOf, canAfford } from '../core/state.js';
import { CARS, carName } from '../data/cars.js';
import { CAR_ART } from '../gfx2d/carArt.js';
import { buyFromDealer } from './places.js';
import { metrics, buildSpec } from '../sim/powertrain.js';
import { districtAt } from '../data/world.js';
import { TRAILERS, TRAILER_BY_ID } from '../data/trailers.js';
import { ensureTow, hitched, ownedTrailers, canPull, buyTrailer, sellTrailer, resaleOf, hitch, unhitch, loadCar, unloadAtHome, loadBlock, carModel, headOnTrailer } from '../core/tow.js';
import { saveGame } from '../core/save.js';
import { audio } from '../core/audio.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const ft = m => `${Math.round(m * 3.281)} ft`;
// the side art has empty wheel wells, so it sits on a dark plate like the sheets it came from
const pic = def => `<div style="background:#111;border-radius:8px;padding:10px 8px;margin-bottom:8px"><img src="${def.side}" alt="" style="width:100%;display:block"></div>`;
const specs = def => def.kind === 'stock' ? `Tandem axle · gooseneck · ${ft(def.len)} long · ${def.head} head of cattle or horses`
  : `${def.axles === 3 ? 'Triple' : 'Tandem'} axle · ${def.kind === 'open' ? 'open deck' : 'enclosed'} · ${ft(def.len)} long · fits cars up to ${def.maxCar >= 7 ? 'any size' : ft(def.maxCar)}`;
// the big rigs on the lot (CARS with `rig`), sold like a dealer sells a new car
const RIGS = CARS.filter(m => m.rig);

export function openTrailerLot(loc, app) {
  const s = game.s;
  ensureTow(s);
  openPanel((root, h) => {
    const mine = ownedTrailers(s);
    root.innerHTML = head(loc.name, 'Big rigs, car haulers, enclosed and stock trailers · Riverside Industrial') + `<div class="p-body" style="max-width:900px">
      <p class="muted small">"Trucks only. You hook it up at home, load your car, and roll up to the meet like a pro." Trailers wait at your place once you buy them.</p>
      <div class="section-title">Big rigs</div>
      <div class="grid">${RIGS.map((m, i) => { const mt = metrics(buildSpec(m, {}, {})), price = m.msrp + 1295; return `<div class="card"><div style="background:#111;border-radius:8px;padding:10px 8px;margin-bottom:8px"><img src="${CAR_ART[m.id]?.side}" alt="" style="width:100%;display:block"></div>
        <h3>${esc(carName(m, Math.min(m.years[1], 2026)))}</h3><p class="muted small">Long hood, 72-inch sleeper, chrome stacks. ${m.hp} hp and ${m.tq.toLocaleString()} lb-ft from the ${esc(m.engine)}. It pulls any trailer on the lot and turns heads at every truck stop.</p>
        <p class="small">0-60 ${mt.zero60?.toFixed(1)}s · governed at ${Math.round(mt.topSpeed)} mph · paint it any color at Vega Kustoms</p>
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:8px"><b>${fmtMoney(price)}</b>
        <button class="btn btn-sm btn-primary" data-action="rig" data-i="${i}">Buy</button></div></div>`; }).join('')}</div>
      <div class="section-title">Trailers</div>
      <div class="grid">${TRAILERS.map(def => `<div class="card">${pic(def)}
        <h3>${esc(def.name)}</h3><p class="muted small">${esc(def.desc)}</p><p class="small">${specs(def)}</p>
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:8px"><b>${fmtMoney(def.price)}</b>
        <button class="btn btn-sm btn-primary" data-action="buy" data-id="${def.id}" ${canAfford(s, def.price) ? '' : 'disabled'}>Buy</button></div></div>`).join('')}</div>
      ${mine.length ? `<h3 style="margin-top:16px">Your trailers</h3><div class="list">${mine.map(t => `<div class="li"><div class="grow"><div class="t">${esc(t.def.name)}</div><div class="s">${s.tow.trailer === t.uid ? 'Hitched up' : 'Parked at home'}</div></div>
        <button class="btn btn-sm" data-action="sell" data-uid="${t.uid}">Sell ${fmtMoney(resaleOf(t))}</button></div>`).join('')}</div>` : ''}
    </div>`;
    bind(root, {
      close: () => h.close(),
      rig: d => { const m = RIGS[+d.i]; buyFromDealer({ m, year: Math.min(m.years[1], 2026), miles: 8, price: m.msrp + 1295, isNew: true }, app, s, loc, h); },
      buy: async d => {
        const def = TRAILER_BY_ID[d.id];
        if (!await confirm(`Buy the ${def.name}?`, `<p>${fmtMoney(def.price)}. It goes home to your place. Hitch it to a truck from your home screen.</p>`, 'Buy')) return;
        const r = buyTrailer(s, d.id, spend);
        if (!r.ok) { toast(r.text, 'bad'); audio.error?.(); return; }
        audio.buy?.();
        const truck = s.cars.find(c => canPull(modelOf(c)));
        toast(`The ${def.name} is yours. ${truck ? 'It\'s waiting at your place: hitch it up from the home screen.' : 'You\'ll need a truck to pull it.'}`, 'good');
        saveGame('auto', true);
        h.refresh();
      },
      sell: async d => {
        const t = mine.find(x => x.uid === d.uid);
        if (!t || !await confirm(`Sell the ${t.def.name}?`, `<p>The lot pays <b>${fmtMoney(resaleOf(t))}</b>.</p>`, 'Sell', true)) return;
        const r = sellTrailer(s, d.uid, earn);
        if (!r.ok) { toast(r.text, 'bad'); return; }
        toast(`Sold for ${fmtMoney(r.paid)}.`, 'good');
        saveGame('auto', true);
        h.refresh();
      },
    });
  });
}

// From the home screen: hitch, unhitch, load and unload.
export function openTrailerHome(app) {
  const s = game.s;
  openPanel((root, h) => {
    const t = ensureTow(s), hit = hitched(s), car = activeCar(s), m = car && modelOf(car);
    const truckOk = car && !car.stolen && canPull(m);
    const mine = ownedTrailers(s);
    let body = '';
    if (t.rig) {
      body += `<div class="card"><h3>Your rig is parked out</h3><p class="muted small">The ${esc(carName(carModel(s, t.truck)))} and the ${esc(hit.def.name)} are parked in ${esc(districtAt(t.rig.x, t.rig.z))}. Drive back to them and pull up behind the trailer to load up, or pick the truck in the Garage and a buddy brings it home.</p></div>`;
    } else {
      body += `<p class="muted small">${truckOk ? `You're driving the ${esc(carName(m))}. It can pull any of these.` : car ? `You're driving the ${esc(carName(m))}. Only trucks can pull a trailer. Switch to a truck in the Garage.` : 'You need a truck to pull a trailer.'}</p>
        <div class="grid">${mine.map(tr => {
          const on = t.trailer === tr.uid, onOther = on && t.truck !== s.activeCar;
          return `<div class="card">${pic(tr.def)}<h3>${esc(tr.def.name)}</h3><p class="small">${specs(tr.def)}</p>
            <p class="muted small">${on ? `Hitched to the ${esc(carName(carModel(s, t.truck)))}${t.car ? `, carrying the ${esc(carName(carModel(s, t.car)))}` : ''}.` : 'Parked at home.'}</p>
            <div class="row" style="gap:6px;flex-wrap:wrap">${on && !onOther ? '<button class="btn btn-sm" data-action="unhitch">Unhitch</button>' : truckOk ? `<button class="btn btn-sm btn-primary" data-action="hitch" data-uid="${tr.uid}">Hitch to the ${esc(m.model)}</button>` : ''}</div></div>`;
        }).join('')}</div>`;
      if (hit && t.truck === s.activeCar && hit.def.kind === 'stock') {
        const n = headOnTrailer(hit);
        body += `<h3 style="margin-top:16px">Livestock</h3><p class="muted small">${n ? `${n} head on board. ` : ''}Drive to your ranch and open the Ranch screen to load cattle or turn them out, or haul them to the Joshua Livestock Auction on FM 4 in Johnson County to buy and sell.</p>`;
      } else if (hit && t.truck === s.activeCar) {
        const others = s.cars.filter(c => c.uid !== t.truck);
        body += `<h3 style="margin-top:16px">${t.car ? 'On the trailer' : 'Load a car'}</h3>`;
        if (t.car) body += `<div class="li"><div class="grow"><div class="t">${esc(carName(carModel(s, t.car)))}</div><div class="s">Strapped down. Drive the truck anywhere, stop, and press USE to unload it.</div></div><button class="btn btn-sm" data-action="unload">Unload it here</button></div>`;
        else body += others.length ? `<div class="list">${others.map(c => {
          const why = loadBlock(s, c.uid);
          return `<div class="li"><div class="grow"><div class="t">${esc(carName(modelOf(c), c.year))}</div><div class="s">${why ? esc(why) : 'Fits'}</div></div>${why ? '' : `<button class="btn btn-sm btn-primary" data-action="load" data-uid="${c.uid}">Load it</button>`}</div>`;
        }).join('')}</div>` : '<p class="muted">You don\'t have another car to put on it.</p>';
      }
    }
    root.innerHTML = head('Trailer', 'Hitch it to a truck, load a car, haul it to the meet') + `<div class="p-body" style="max-width:900px">${body}</div>`;
    const done = msg => { if (msg) toast(msg, 'good'); audio.click?.(); saveGame('auto', true); h.refresh(); };
    bind(root, {
      close: () => h.close(),
      hitch: d => { const r = hitch(s, d.uid); if (!r.ok) { toast(r.text, 'bad'); return; } done(`Hitched the ${r.def.name} to the ${m.model}. Drive careful, it swings.`); },
      unhitch: () => { const r = unhitch(s); if (!r.ok) { toast(r.text, 'bad'); return; } done('Trailer unhitched and parked.'); },
      load: d => { const r = loadCar(s, d.uid); if (!r.ok) { toast(r.text, 'bad'); return; } done(`The ${r.model.model} is loaded and strapped down. Drive to the meet and press USE when you stop to unload it.`); },
      unload: () => { const r = unloadAtHome(s); if (!r.ok) { toast(r.text, 'bad'); return; } done('Unloaded. It\'s back in the garage.'); },
    });
  });
}
