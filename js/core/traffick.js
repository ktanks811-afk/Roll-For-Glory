// Shipping Colorado weed into Texas (data/traffick.js). It's legal where you
// grow it and sell it, and a felony the second it crosses the state line.
//
// Pull ounces out of a farm vault or off a dispensary shelf, pick how it
// travels (the mail, a driver with a trap compartment, a reefer trailer) and
// who gets it in Texas: Primo, a connect who pays dirty cash on delivery, or
// one of your own trap houses, where it lands in the stash. Every load builds
// a DEA case against you. Some loads get taken on the way, and the people
// caught with them sometimes talk.
//
// When the case gets serious, agents sit on your houses: a search warrant
// gets signed and the raid comes in while you're home (world2d/dea.js). At
// 100 a federal grand jury indicts you: a felony warrant, and SWAT boxes you
// in on the road the next time they spot your car.
//
// s.dea = { heat, stage, shipped, earned, seized, loads: [load], raid, hunt, last, log }
// load: { id, from, dest, method, oz, mix: { strain: oz }, value, fee, sent, arrive }
// DOM-free so scripts/check-data.mjs can test it.

import { spend, earn, fmtMoney, uid } from './state.js';
import { sendMessage } from './story.js';
import { addWarrant } from './warrants.js';
import { ensureWeed, total, ozText } from './weed.js';
import { trapState, myTraps } from './drugs.js';
import { STRAIN_BY_ID, FARMS, SHOPS } from '../data/weed.js';
import { TRAPS } from '../data/estate.js';
import { METHODS, METHOD_BY_ID, TEXAS_MULT, FLIP_ODDS, DECAY, SURVEIL, RAID_ODDS, STAGES, stageOf, trafficClass, lbText } from '../data/traffick.js';

const err = text => ({ ok: false, text });
const r1 = n => Math.round(n * 10) / 10;

export function ensureDea(s) {
  s.dea ??= {};
  const d = s.dea;
  d.heat ??= 0;
  d.stage ??= 0;        // highest warning sent
  d.shipped ??= 0;      // ounces sent to Texas, all time (the weight in the federal case)
  d.earned ??= 0;       // what Texas paid you
  d.seized ??= 0;       // ounces the agents took on the road
  d.loads ??= [];       // on the road right now
  d.raid ??= false;     // a search warrant is signed: the next time you're home, they come in
  d.hunt ??= false;     // indicted: a federal warrant is out and SWAT is looking for your car
  d.last ??= -99;       // the last day you sent a load
  d.raids ??= 0; d.stops ??= 0;
  d.log ??= [];         // { day, text }
  return d;
}

function note(s, text) {
  const d = ensureDea(s);
  d.log.unshift({ day: s.time.day, text });
  if (d.log.length > 20) d.log.length = 20;
}

export const texasPrice = strainId => Math.round(STRAIN_BY_ID[strainId].retail * TEXAS_MULT);
export const shipFee = (methodId, oz) => { const m = METHOD_BY_ID[methodId]; return Math.round(m.fee[0] + m.fee[1] * oz); };
export const shipHeat = (methodId, oz) => { const m = METHOD_BY_ID[methodId]; return r1(m.heat[0] + m.heat[1] * oz); };
// the odds a load gets taken: the method's, and worse the more they already know
export const catchOdds = (s, methodId) => Math.min(0.6, METHOD_BY_ID[methodId].catchOdds * (1 + ensureDea(s).heat / 100));

// Where a load can come from: 'farm:<id>' (the vault) or 'shop:<id>' (the shelf).
export function jarOf(s, from) {
  const w = ensureWeed(s), [kind, id] = String(from).split(':');
  if (kind === 'farm') return w.farms[id]?.vault || null;
  if (kind === 'shop') return w.shops[id]?.shelf || null;
  return null;
}
export const sourceName = from => { const [kind, id] = String(from).split(':'); return (kind === 'farm' ? FARMS[id] : SHOPS[id])?.name || 'Colorado'; };
export function sources(s) {
  const w = ensureWeed(s);
  return [
    ...Object.keys(w.farms).filter(id => FARMS[id]).map(id => `farm:${id}`),
    ...Object.keys(w.shops).filter(id => SHOPS[id]).map(id => `shop:${id}`),
  ];
}
// Who gets it: 'connect' (Primo pays cash) or 'trap:<id>' (into your stash).
export const destinations = s => ['connect', ...myTraps(s).map(id => `trap:${id}`)];
export const destName = dest => dest === 'connect' ? 'Primo in Stop Six' : TRAPS[dest.split(':')[1]]?.name || 'Texas';

// What `oz` from a jar is worth in Texas, taking the top jars first.
function pull(jar, oz, take = false) {
  const mix = {};
  let left = oz, value = 0;
  for (const id of Object.keys(jar).filter(k => STRAIN_BY_ID[k]).sort((a, b) => STRAIN_BY_ID[b].retail - STRAIN_BY_ID[a].retail)) {
    const n = r1(Math.min(jar[id], left));
    if (n <= 0) continue;
    mix[id] = n; value += n * texasPrice(id); left = r1(left - n);
    if (take) { jar[id] = r1(jar[id] - n); if (jar[id] <= 0) delete jar[id]; }
    if (left <= 0) break;
  }
  return { mix, oz: r1(oz - Math.max(0, left)), value: Math.round(value) };
}
export const quote = (s, from, oz) => { const jar = jarOf(s, from); return jar ? pull(jar, oz) : { mix: {}, oz: 0, value: 0 }; };

// ---------------------------------------------------------------- sending a load
export function ship(s, { from, oz, method, dest = 'connect' }) {
  const d = ensureDea(s), m = METHOD_BY_ID[method], jar = jarOf(s, from);
  if (d.hunt) return err('You\'re under federal indictment. Nobody will touch a load of yours.');
  if (!m) return err('Pick how it travels.');
  if (!jar) return err('You don\'t own that.');
  if (dest !== 'connect' && !myTraps(s).includes(dest.split(':')[1])) return err('You don\'t have that trap house.');
  oz = Math.min(m.max, Math.floor(oz));
  if (oz < 1) return err('Send at least an ounce.');
  if (total(jar) < oz) return err(`There's only ${ozText(total(jar))} there.`);
  const fee = shipFee(method, oz);
  if (!spend(s, fee, `${m.name}: ${ozText(oz)} to Texas`, { street: true })) return err(`Sending that costs ${fmtMoney(fee)}. You're short.`);
  const p = pull(jar, oz, true);
  const load = { id: uid('load'), from, dest, method, oz: p.oz, mix: p.mix, value: p.value, fee, sent: s.time.day, arrive: s.time.day + m.days };
  d.loads.push(load);
  d.last = s.time.day;
  note(s, `Sent ${lbText(p.oz)} to ${destName(dest)} (${m.name.toLowerCase()})`);
  const ind = bumpDea(s, shipHeat(method, p.oz), `${lbText(p.oz)} headed to Texas`);
  return { ok: true, text: `${ozText(p.oz)} is on the way to ${destName(dest)}. ${m.days === 1 ? 'It lands tomorrow' : `It lands in ${m.days} days`}${dest === 'connect' ? `, and Primo pays ${fmtMoney(p.value)} when it does` : ''}.`, load, indicted: ind };
}

// ---------------------------------------------------------------- the DEA case
export function bumpDea(s, amount, why) {
  const d = ensureDea(s);
  if (d.hunt || amount <= 0) return null;
  d.heat = Math.min(100, r1(d.heat + amount));
  const st = STAGES.indexOf(stageOf(d.heat));
  if (st > d.stage) {
    d.stage = st;
    if (st === 1) sendMessage(s, 'primo', 'My cousin at the post office says the DEA sent a memo about Colorado packages coming into 76112. Somebody upstairs is counting boxes. Be smart.');
    if (st === 2) sendMessage(s, 'primo', 'Bro. Feds picked up one of my guys\' phones. Don\'t text me about loads, call. And switch up how you move it.');
    if (st === 3) sendMessage(s, 'primo', 'Same white Expedition been parked down the street from your spot three nights straight. Two dudes in it. That\'s not the city. Stay away from home or stay clean.');
    if (st === 4) sendMessage(s, 'dea', 'TARGET LETTER: You are a target of a federal grand jury investigation into conspiracy to distribute marijuana (21 U.S.C. §§ 841, 846). You may contact the U.S. Attorney\'s Office, Northern District of Texas.');
  }
  if (why) note(s, why);
  if (d.heat >= 100) return indictDea(s);
  return null;
}

// What they'd charge you with right now: the weight you've moved.
export function federalCharges(s) {
  const d = ensureDea(s), oz = Math.max(1, d.shipped + d.loads.reduce((t, l) => t + l.oz, 0));
  return [
    { kind: `drugs_${trafficClass(oz)}`, text: `Federal: conspiracy to distribute ${lbText(oz)} of marijuana (21 U.S.C. § 846).`, fine: 0 },
    { kind: 'drugs_F3', text: 'Federal: interstate travel in aid of drug trafficking, Colorado to Texas (18 U.S.C. § 1952).', fine: 0 },
  ];
}

// The grand jury indicts: a federal warrant, and they're actively hunting you.
export function indictDea(s) {
  const d = ensureDea(s);
  for (const c of federalCharges(s)) addWarrant(s, { ...c, felony: true, dea: true, evidence: 'DEA wiretaps, seized loads and cooperating witnesses' });
  d.hunt = true; d.raid = true; d.heat = 100;
  note(s, 'Indicted by a federal grand jury');
  sendMessage(s, 'dea', 'INDICTMENT: A federal grand jury in the Northern District of Texas charged you with conspiracy to distribute marijuana. A warrant is out for your arrest. Agents and Tarrant County SWAT are looking for you. Surrender at the courthouse.', { action: { type: 'gps', loc: 'courthouse' } });
  return { indicted: true };
}

// Once you're in custody on the federal case, it's built: the hunt is over.
export function caseServed(s) {
  const d = ensureDea(s);
  d.hunt = false; d.raid = false;
  d.heat = 35; d.stage = STAGES.indexOf(stageOf(d.heat));
  d.shipped = 0;   // that weight is charged now; new loads start a new case
  note(s, 'Arrested on the federal case');
}
export const deaWarrant = s => (s.warrants || []).some(w => w.dea);

// A raid on your house: what they take. Asset forfeiture takes a cut of the
// bank (capped at what Texas has paid you); the search warrant becomes the
// federal charges. Returns { items, forfeited }.
export function raidHome(s) {
  const d = ensureDea(s);
  const forfeited = Math.max(0, Math.min(Math.round(s.bank * 0.3), Math.round(d.earned * 0.6)));
  s.bank -= forfeited;
  d.raid = false; d.raids++;
  note(s, `Federal raid on your house${forfeited ? `: ${fmtMoney(forfeited)} forfeited` : ''}`);
  return { items: d.hunt ? [] : federalCharges(s), forfeited };
}

// ---------------------------------------------------------------- every game day
// Loads land (or get taken), the case cools off or closes in, and a search
// warrant can get signed. Returns { notes }.
export function traffickDay(s, rng = Math.random) {
  const d = ensureDea(s), notes = [];
  if (d.hunt && !deaWarrant(s)) caseServed(s);
  for (const l of d.loads.filter(x => x.arrive <= s.time.day)) {
    d.loads = d.loads.filter(x => x !== l);
    const m = METHOD_BY_ID[l.method];
    if (rng() < catchOdds(s, l.method)) {
      d.seized += l.oz;
      const talked = rng() < FLIP_ODDS;
      note(s, `${lbText(l.oz)} seized on the road${talked ? ', and somebody talked' : ''}`);
      const where = { mail: 'at the Fort Worth sorting center', mule: 'at the Border Patrol checkpoint on I-27', rig: 'at the Amarillo ag checkpoint' }[l.method];
      sendMessage(s, 'primo', `It's gone. ${lbText(l.oz)} got taken ${where}. ${talked ? 'And the one they caught with it is talking. Your name is in a DEA report now.' : 'Nobody said nothing. It\'s just a loss.'}`);
      notes.push(`🚔 ${lbText(l.oz)} seized ${where}.`);
      bumpDea(s, 8 + (talked ? 22 : 0), talked ? 'A courier is cooperating' : 'A load was seized');
      continue;
    }
    d.shipped = r1(d.shipped + l.oz);
    if (l.dest === 'connect') {
      earn(s, l.value, `Primo: ${lbText(l.oz)} delivered`, { dirty: true });
      d.earned += l.value;
      notes.push(`🌿 ${lbText(l.oz)} made it to Stop Six. Primo paid ${fmtMoney(l.value)} cash.`);
    } else {
      const id = l.dest.split(':')[1], t = trapState(s, id);
      t.stash.loud = (t.stash.loud || 0) + Math.floor(l.oz);
      notes.push(`🌿 ${lbText(l.oz)} made it to ${TRAPS[id]?.name || 'your trap'}. It's in the stash.`);
    }
    note(s, `${lbText(l.oz)} delivered to ${destName(l.dest)} (${m.name.toLowerCase()})`);
  }
  if (!d.hunt) {
    if (d.last < s.time.day - 1 && d.heat > 0) d.heat = Math.max(0, r1(d.heat - DECAY));
    d.stage = Math.min(d.stage, STAGES.indexOf(stageOf(d.heat)));
    if (d.heat >= SURVEIL && !d.raid && rng() < RAID_ODDS) { d.raid = true; note(s, 'A federal judge signed a search warrant for your house'); }
  }
  return { notes };
}

export { METHODS, stageOf, lbText };
