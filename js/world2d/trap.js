// The trap game in the open world: construction finishing, customers
// knocking at a trap house you're standing in, and the SWAT raid when one of
// them was the wrong one. Map pieces are in world2d/estate.js.

import { applyEstate } from './estate.js';
import { TRAPS, DRUG_BY_ID } from '../data/estate.js';
import { PROPERTIES, LOC_BY_ID } from '../data/world.js';
import { fmtMoney, addRep } from '../core/state.js';
import { audio } from '../core/audio.js';
import { esc } from '../ui/dom.js';
import { sendMessage } from '../core/story.js';
import { saveGame } from '../core/save.js';
import { addWarrant } from '../core/warrants.js';
import { finishBuilds } from '../core/estate.js';
import { ensureDrugs, trapState, customer, serve, units, myTraps, isClosed, raidHouse, drugOffences, raidChance } from '../core/drugs.js';

// ---------------------------------------------------------------- every frame
// Customers only come while you're at the house (inside or on the porch),
// with something to sell, and nobody chasing you.
const NEAR = 32;
export function trapHere(w) {
  const s = w.s, p = w.playerState();
  for (const id of myTraps(s)) {
    const g = w.map.garages.find(q => q.id === id), loc = LOC_BY_ID[id];
    if (!loc) continue;
    const c = g ? g.center : loc;
    if (Math.hypot(c.x - p.x, c.z - p.z) < NEAR || Math.hypot(loc.x - p.x, loc.z - p.z) < 12) return id;
  }
  return null;
}

export function estateTick(w, dt) {
  const s = w.s;
  w.estateT = (w.estateT ?? 1) - dt;
  if (w.estateT <= 0) {
    w.estateT = 1;
    const done = finishBuilds(s);
    if (done.length) {
      applyEstate(w.map, s);
      for (const id of done) sendMessage(s, 'builder', `Your ${PROPERTIES[id].name} is finished. Keys are under the mat. ${PROPERTIES[id].slots}-car garage, ready to move in.`, { action: { type: 'gps', loc: id } });
      saveGame('auto', true);
    }
  }
  if (w.knocking || w.inCar || w.police.active || w.races.active) return;
  const id = trapHere(w);
  if (!id || isClosed(s, id)) { w.knockT = null; return; }
  const t = trapState(s, id);
  if (!units(t.stash) && !units(ensureDrugs(s).bag)) { w.knockT = null; return; }
  if (w.knockT == null) { w.knockT = 6 + Math.random() * 8; w.ui.toast('You\'re open for business. Customers will knock.', 'info'); }
  const night = (s.time.min / 60) % 24 >= 19 || (s.time.min / 60) % 24 < 4;
  w.knockT -= dt * (TRAPS[id].rush || 1) * (night ? 1.5 : 1);
  if (w.knockT > 0) return;
  w.knockT = 14 + Math.random() * 22;
  knock(w, id);
}

// ---------------------------------------------------------------- knock knock
async function knock(w, id) {
  const s = w.s, T = TRAPS[id];
  const c = customer(s, id);
  if (!c) return;
  w.knocking = true;
  audio.pop(0.6); setTimeout(() => audio.pop(0.6), 170); setTimeout(() => audio.pop(0.5), 340);
  const g = DRUG_BY_ID[c.drug];
  const odds = raidChance(s, id);
  const pick = await w.ui.modal('Knock knock', `<p class="small muted">${esc(T.name)} · ${odds < 0.03 ? 'the street is quiet' : odds < 0.08 ? 'a neighbour is watching from her porch' : 'a car you don\'t know has been parked on the corner all day'}</p>
    <p>It's ${esc(c.who)}. They want <b>${c.qty} ${g.unit === 'oz' ? 'oz' : '×'} ${esc(g.name)}</b>${g.unit !== 'oz' ? ` (${esc(g.unit)})` : ''} for <b>${fmtMoney(c.price)}</b>.</p>`,
    [{ label: `Serve · +${fmtMoney(c.price)}`, primary: true, value: 'serve' }, { label: 'Turn them away', value: 'no' }]);
  if (pick !== 'serve') { w.knocking = false; return; }
  const r = serve(s, id, c);
  if (!r.ok) { w.ui.toast(r.text, 'bad'); w.knocking = false; return; }
  audio.buy();
  if (r.raid) await raid(w, id);
  w.knocking = false;
}

// ---------------------------------------------------------------- SWAT
// You're in the house when they hit it. Get down and you're arrested on
// everything in there; run out the back and maybe you make it, with a
// felony warrant and every unit in the east side looking for you.
export async function raid(w, id) {
  const s = w.s, T = TRAPS[id], t = trapState(s, id);
  audio.gunshot(1.4); audio.crash(1); w.hud?.radio?.('Tarrant County SWAT: search warrant, executing now.');
  // what they find: the stash and whatever's in your pockets, as one load
  const all = { ...t.stash };
  for (const [k, q] of Object.entries(ensureDrugs(s).bag)) all[k] = (all[k] || 0) + q;
  const found = units(all);
  const pick = await w.ui.modal('🚨 SWAT RAID', `<p class="bad"><b>BANG.</b> The front door comes off the hinges. Flashbang. Red dots on the wall.</p>
    <p class="muted">"SHERIFF'S OFFICE, SEARCH WARRANT! GET ON THE GROUND! SHOW ME YOUR HANDS!"</p>
    <p>Too many people knew this address. ${found ? `There's <b>${found}</b> unit${found > 1 ? 's' : ''} of product in the house` : 'The house is empty'}${t.safe ? ` and ${fmtMoney(t.safe)} in the safe` : ''}.</p>`,
    [{ label: 'Get on the ground', primary: true, value: 'down' }, { label: 'Run out the back', danger: true, value: 'run' }]);
  const took = raidHouse(s, id);
  ensureDrugs(s).bag = {};
  const items = drugOffences(all, { intent: true });
  sendMessage(s, 'brenner', `Narcotics hit ${T.name} today. ${took.product ? `${took.product} units of product and ` : ''}${fmtMoney(took.safe)} in cash went into evidence. That house is boarded up.`);
  if (pick === 'run' && Math.random() < 0.35) {
    // out the back fence: they know whose house it is
    for (const o of items) addWarrant(s, { kind: o.kind, text: o.text, fine: Math.max(2000, o.fine), felony: true, evidence: 'SWAT search warrant on a house in your name' });
    const p = w.playerState(), back = w.map.garages.find(g => g.id === id);
    if (back) { w.foot.x = back.center.x + back.inDir.x * 30; w.foot.z = back.center.z + back.inDir.z * 30; }
    w.police.addHeat(3.2, 'Suspect fled a narcotics raid.', w.hud);
    w.police.seen = true;
    w.police.lastSeen = { x: p.x, z: p.z, vx: 0, vz: 0 };
    w.police.startChase(w, true);
    addRep(s, 40, 'Hopped the back fence on SWAT');
    w.ui.toast('You hopped the back fence. There\'s a felony warrant out for you now. Lose them.', 'bad');
    saveGame('auto', true);
    return;
  }
  if (pick === 'run') items.push({ kind: 'evading', text: 'Evading arrest.' });
  // in cuffs: booked through the courts like any arrest
  w.police.phase = 'notice';
  w.onBusted(1500, false, items);
  w.police.reset(w);
}

// A raid on a house nobody was at (your worker caught it). Called from main's newDay.
export function raidWhileAway(s, r) {
  const T = TRAPS[r.trapId];
  const items = drugOffences(r.took.stash || {}, { intent: true });
  if (!items.length) items.push({ kind: 'drugs_SJF', text: `Maintaining a drug house: ${T.name}.`, fine: 1500 });
  for (const o of items) addWarrant(s, { kind: o.kind, text: o.text, fine: Math.max(2000, o.fine), felony: true, evidence: 'SWAT search warrant on a house in your name' });
  sendMessage(s, 'brenner', `SWAT hit ${T.name} this morning. Your man at the door is in county, and we'll see what he has to say. ${r.took.product ? `${r.took.product} units of product` : 'The product'}${r.took.safe ? ` and ${fmtMoney(r.took.safe)} from the safe` : ''} are in evidence. The deed is in your name, so there's a felony warrant out for you.`, { action: { type: 'gps', loc: 'pspd_central' } });
}
