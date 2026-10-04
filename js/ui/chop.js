// Marchetti Salvage: the chop shop panel and the task force sweep.
// The rules (prices, heat, sweep odds) are in core/chop.js.

import { openPanel, bind, esc, toast, modal } from './dom.js';
import { game, fmtMoney, addRep } from '../core/state.js';
import { CAR_BY_ID, carName, MAKES } from '../data/cars.js';
import { audio } from '../core/audio.js';
import { saveGame } from '../core/save.js';
import { addWarrant } from '../core/warrants.js';
import { advanceTime } from './garage.js';
import { ensureChop, isClosed, wantedToday, stripPlan, strip, sellParts, partPrice, shelfValue, sweepChance, heatLabel, sweep, WANTED_BONUS, CHOP_CHARGE, PARTS_CHARGE } from '../core/chop.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const makeName = id => MAKES[id] || id;
const fmtMins = m => m >= 60 ? `${Math.floor(m / 60)} hr${m >= 120 ? 's' : ''}${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;

export function openChop(loc, app) {
  const s = game.s, w = app.world, c = ensureChop(s);
  if (isClosed(s)) {
    modal('Marchetti Salvage', `<p>The gate is chained shut. Yellow tape, a padlock, and an evidence notice from the <b>Tarrant Regional Auto Crimes Task Force</b> zip-tied to the fence.</p><p class="muted">Junior's out on bond. He opens back up on day ${c.closed}.</p>`);
    return;
  }
  if (w && w.police.phase === 'chase') { modal('Marchetti Salvage', '<p>Junior drags the gate half shut in your face: "You brought the cops to my yard? Lose them first."</p>'); return; }
  openPanel((root, h) => {
    const th = w?.thefts, hot = th?.near(loc, 32) ? th.hot : null;
    const want = wantedToday(s), [lbl, cls] = heatLabel(s), level = w?.police.level || 0;
    const shelf = c.shelf;
    let carCard = '';
    if (hot) {
      const car = hot.car, m = CAR_BY_ID[car.modelId];
      const full = stripPlan(s, car), quick = stripPlan(s, car, true);
      const pFull = sweepChance(s, level, full.mins), pQuick = sweepChance(s, level, quick.mins);
      const sal = th.salOffer();
      carCard = `<div class="section-title">In the bay</div>
        <div class="card"><h3>🔧 ${esc(carName(m, car.year))}${want.includes(m.make) ? ' <span class="tag tag-green">Wanted today</span>' : ''}</h3>
          <p class="small muted">Sal would give you ${fmtMoney(sal)} for it whole. ${level >= 2 ? '<span class="bad">You pulled in hot. The task force could be right behind you.</span>' : ''}</p>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
            <button class="btn btn-primary" data-action="strip">Strip it all · ${fmtMins(full.mins)} · ${fmtMoney(full.total)}</button>
            <button class="btn" data-action="quick">Quick strip · ${fmtMins(quick.mins)} · ${fmtMoney(quick.total)}</button>
          </div>
          <p class="small muted">Risk of a sweep while you work: about ${Math.round(pFull * 100)}% for the full teardown, ${Math.round(pQuick * 100)}% for the quick one (cat, wheels, airbags, stereo, lights). Whatever's left gets crushed either way.</p>
          <div class="list">${full.parts.map(p => `<div class="li"><div class="grow"><div class="t">${esc(p.name)}${quick.parts.some(q => q.id === p.id) ? ' <span class="muted small">· quick</span>' : ''}</div><div class="s">${fmtMins(p.mins)}</div></div><b>${fmtMoney(p.price)}</b></div>`).join('')}</div></div>`;
    } else {
      carCard = `<p class="muted">Junior: "${th?.hot ? 'Bring it inside the gate. I\'m not walking out to the street.' : 'I don\'t touch cars with clean titles. Bring me something hot.'}"</p>`;
    }
    root.innerHTML = head('Marchetti Salvage', 'Riverside Industrial · used auto parts · "we buy junk cars"') + `<div class="p-body" style="max-width:720px">
      <div class="stats-row"><div><div class="stat-lbl">Heat on the shop</div><b class="${cls}">${lbl}</b></div><div><div class="stat-lbl">Wanted today</div><b>${want.map(makeName).map(esc).join(' · ')}</b></div><div><div class="stat-lbl">Cars chopped</div><b>${c.chopped}</b></div></div>
      ${carCard}
      <div class="section-title">Your shelf${shelf.length ? ` · ${fmtMoney(shelfValue(s))}` : ''}</div>
      ${shelf.length ? `<div class="row" style="margin-bottom:8px"><button class="btn btn-primary" data-action="sellall">Sell it all to Junior · ${fmtMoney(shelfValue(s))}</button></div><div class="list">${shelf.map(i => `<div class="li"><div class="grow"><div class="t">${esc(i.name)}</div><div class="s">${esc(i.car)}${want.includes(i.make) ? ` · <span class="good">+${Math.round((WANTED_BONUS - 1) * 100)}% today</span>` : ''}</div></div><b>${fmtMoney(partPrice(s, i))}</b> <button class="btn btn-sm" data-action="sell" data-uid="${i.uid}">Sell</button></div>`).join('')}</div>` : '<p class="small muted">Empty. Parts you strip wait here until you sell them.</p>'}
      <p class="small muted">Junior pays more for makes his buyers want that day, so you can hold parts on the shelf and wait. But every car you bring makes the shop hotter, and if the task force sweeps it, everything on the shelf goes into evidence. The heat cools off a little each day.</p></div>`;
    bind(root, {
      close: () => h.close(),
      strip: () => doStrip(app, h, false),
      quick: () => doStrip(app, h, true),
      sell: d => { const pay = sellParts(s, [d.uid]); if (pay) { audio.buy?.(); saveGame('auto', true); } h.refresh(); },
      sellall: () => { const pay = sellParts(s); if (pay) { audio.buy?.(); toast(`Junior counts out ${fmtMoney(pay)}.`, 'good'); saveGame('auto', true); } h.refresh(); },
    });
  });
}

async function doStrip(app, h, quick) {
  const s = game.s, w = app.world, th = w.thefts, v = th.hot;
  if (!v) return;
  const level = w.police.level;
  const plan = stripPlan(s, v.car, quick);
  if (Math.random() < sweepChance(s, level, plan.mins)) { h.close(); await sweepLive(w, v); return; }
  const title = carName(CAR_BY_ID[v.car.modelId], v.car.year);
  strip(s, v.car, { quick, policeLevel: level });
  th.leave();
  advanceTime(s, plan.mins);
  audio.crash?.(0.3);
  toast(`${plan.parts.length} parts off the ${title}. The shell went in the crusher.`, 'good');
  saveGame('auto', true);
  h.refresh();
}

// The task force hits the yard while you're in there with a stolen car.
export async function sweepLive(w, v) {
  const s = w.s, c = ensureChop(s);
  const had = c.shelf.length;
  audio.crash?.(1); w.hud?.radio?.('Auto Crimes Task Force: executing the warrant at Marchetti Salvage.');
  const pick = await w.ui.modal('🚨 TASK FORCE SWEEP', `<p class="bad"><b>The gate rolls open and it's not Junior.</b> Unmarked Tahoes, a tow truck and a dozen vests that say POLICE.</p>
    <p class="muted">"TARRANT REGIONAL AUTO CRIMES TASK FORCE! EVERYBODY ON THE GROUND!"</p>
    <p>The stolen car is up on the lift${had ? ` and ${had} part${had > 1 ? 's' : ''} with your name on them are on the shelf` : ''}.</p>`,
    [{ label: 'Get on the ground', primary: true, value: 'down' }, { label: 'Run out the back', danger: true, value: 'run' }]);
  const h = v.car.hot;
  const items = [w.thefts.charge(h), { ...CHOP_CHARGE }];
  if (had) items.push({ ...PARTS_CHARGE });
  sweep(s);
  if (pick === 'run' && Math.random() < 0.35) {
    // over the back fence. They have the car, the shop and Junior, and Junior has your name.
    for (const o of items) addWarrant(s, { kind: o.kind, text: o.text, fine: Math.max(2000, o.fine || 0), felony: true, evidence: 'Task force sweep of Marchetti Salvage' });
    w.thefts.leave();
    w.foot.x += 26; w.foot.z += 18;
    const p = w.playerState();
    w.police.addHeat(3, 'Suspect fled a chop shop sweep.', w.hud);
    w.police.seen = true;
    w.police.lastSeen = { x: p.x, z: p.z, vx: 0, vz: 0 };
    w.police.startChase(w, true);
    addRep(s, 40, 'Ran from the task force');
    w.ui.toast('You went over the back fence. There\'s a felony warrant out for you now. Lose them.', 'bad');
    saveGame('auto', true);
    return;
  }
  if (pick === 'run') items.push({ kind: 'evading', text: 'Evading arrest.' });
  w.police.phase = 'notice';
  w.onBusted(1500, false, items);
  w.police.reset(w);
}
