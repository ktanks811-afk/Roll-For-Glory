// Bank heists. Every bank on the map (data/banks.js) can be planned and hit:
//
//   1. Case it. Walk in and look around (once a game day, up to 3 times):
//      guards and cameras, then the vault and the time lock, then how fast
//      the police get there and when the guards rotate. Better intel, better odds.
//   2. Pick an approach. Loud (take the lobby, empty the drawers, drill the
//      vault, then outrun the whole department), quiet (break in between
//      midnight and 4 AM, kill the alarm, burn through the vault, gone before
//      the morning shift), or the inside man (pay a manager, walk in with the
//      cash delivery in armored-car uniforms).
//   3. Hire a crew from the Professor (a driver, muscle, a hacker): each takes
//      a cut of the take. Buy the gear (bags, masks, a drill, a thermal lance,
//      a jammer, a scanner, body armor, uniforms).
//   4. Go. The job plays out a phase at a time (ui/heist.js asks what you do
//      at each one) and ends with you outside the bank with the money and,
//      if an alarm went off, every unit in the city on the way.
//
// A bank you hit locks down for 10 days. Bank robbery is federal: the FBI
// heat lands on your fed meter (core/bank.js) and the money is dirty. An
// inside man can flip on you later.
//
// Save key: s.heists. DOM-free so check-data can test it.

import { spend, uid } from './state.js';
import { bumpFeds, ensureFeds } from './bank.js';
import { addWarrant } from './warrants.js';
import { BANK_TIERS } from '../data/banks.js';

export const LOCKDOWN_DAYS = 10;
export const MAX_INTEL = 3;
export const CASE_MINUTES = 60;

// The Professor's people. skill 1-5; cut is their share of the gross.
export const CREW = [
  { id: 'wheels', name: 'Dre "Wheels" Johnson', role: 'driver', skill: 3, cut: 0.08, bio: 'Drove for a towing company for ten years. Knows every alley between here and the county line.' },
  { id: 'turbo', name: 'Lil Turbo', role: 'driver', skill: 2, cut: 0.05, bio: 'Nineteen and fearless. Too fearless.' },
  { id: 'ghost', name: 'Maria "Ghost" Reyes', role: 'driver', skill: 5, cut: 0.14, bio: 'Never been caught. Swaps cars twice before she gets on the highway.' },
  { id: 'tank', name: 'Tank', role: 'muscle', skill: 2, cut: 0.06, bio: 'Big, loud, and nervous. People get on the floor when he walks in.' },
  { id: 'moe', name: 'Big Moe', role: 'muscle', skill: 3, cut: 0.1, bio: 'Did security at the clubs on Bluebonnet Circle. Knows how guards think.' },
  { id: 'smoke', name: 'Smoke', role: 'muscle', skill: 4, cut: 0.12, bio: 'Ex-Army. Calm voice, steady hands, nobody gets hurt on his jobs.' },
  { id: 'juice', name: 'Juice', role: 'muscle', skill: 5, cut: 0.15, bio: 'Has done four banks. Has never fired his gun in one.' },
  { id: 'nerd', name: 'Nerd', role: 'hacker', skill: 2, cut: 0.07, bio: 'TCC dropout with a laptop full of stickers. Fast, sloppy.' },
  { id: 'pixel', name: 'Pixel', role: 'hacker', skill: 4, cut: 0.12, bio: 'Used to install the same alarm systems for a living.' },
  { id: 'oracle', name: 'Oracle', role: 'hacker', skill: 5, cut: 0.16, bio: 'Nobody has met her. She is in the cameras before you are in the lot.' },
];
export const CREW_BY_ID = Object.fromEntries(CREW.map(c => [c.id, c]));
export const ROLES = {
  driver: { name: 'Driver', does: 'Has your car at the curb and loses the cops. Less heat on the way out.' },
  muscle: { name: 'Muscle', does: 'Controls the lobby. Guards stand down and nobody gets hurt.' },
  hacker: { name: 'Hacker', does: 'Kills the alarm and the cameras, and gets you past a time lock.' },
};

export const GEAR = [
  { id: 'bags', name: 'Duffel bags', price: 250, icon: '👜', desc: 'You need something to carry it in.' },
  { id: 'masks', name: 'Crew ski masks', price: 300, icon: '🎭', desc: 'The cameras get nothing. Witnesses can\'t pick you out.' },
  { id: 'drill', name: 'Vault drill', price: 4500, icon: '🛠', desc: 'Through a vault door or a time lock in four minutes.' },
  { id: 'thermite', name: 'Thermal lance', price: 15000, icon: '🔥', desc: 'Cuts a vault quietly. The after-hours job needs it.' },
  { id: 'jammer', name: 'Alarm and cell jammer', price: 9000, icon: '📡', desc: 'Buys time before the alarm reaches dispatch.' },
  { id: 'scanner', name: 'Police scanner', price: 1200, icon: '📻', desc: 'You hear them coming. An easier getaway.' },
  { id: 'armor', name: 'Body armor', price: 2500, icon: '🦺', desc: 'If a guard shoots, it hurts less.' },
  { id: 'uniforms', name: 'Armored-car uniforms', price: 3500, icon: '🧥', desc: 'The inside job: walk in with the cash delivery.' },
];
export const GEAR_BY_ID = Object.fromEntries(GEAR.map(g => [g.id, g]));

export const APPROACHES = {
  loud: { name: 'Loud', title: 'Take it over', desc: 'Masks on, through the front door in the middle of the day. Empty the drawers, then the vault. Every alarm goes off and you have minutes.', roles: ['muscle'], gear: ['bags'] },
  quiet: { name: 'Quiet', title: 'After hours', desc: 'In between midnight and 4 AM. The hacker kills the alarm, the lance opens the vault, and nobody knows until the morning shift.', roles: ['hacker'], gear: ['bags', 'thermite'], night: true },
  inside: { name: 'Inside man', title: 'The cash delivery', desc: 'Pay a manager to look the other way. Walk in with Thursday\'s delivery in armored-car uniforms and walk out with the vault.', roles: [], gear: ['bags', 'uniforms'], bribe: true },
};

// what a tier's bank is worth to the inside man: a cut up front
export const bribeFor = bank => Math.round(BANK_TIERS[bank].vault[0] * 0.12 / 500) * 500;
const tierOf = loc => BANK_TIERS[loc.bank] || BANK_TIERS.branch;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const between = ([a, b], rng) => Math.round((a + (b - a) * rng()) / 10) * 10;

export function ensureHeists(s) {
  s.heists ??= {};
  const h = s.heists;
  h.plans ??= {};       // bankId -> plan
  h.lockdown ??= {};    // bankId -> day it opens back up
  h.flips ??= [];       // inside men the FBI might turn: { bank, name, day }
  h.log ??= [];         // { day, bank, net, approach }
  return h;
}

export function planFor(s, bankId) {
  const h = ensureHeists(s);
  return h.plans[bankId] ??= { id: uid('job'), intel: 0, cased: 0, approach: null, crew: { driver: null, muscle: null, hacker: null }, gear: [], bribed: false };
}
export const lockedDown = (s, bankId) => (ensureHeists(s).lockdown[bankId] || 0) > s.time.day;

// What casing it tells you, a line per level of intel.
export function intelLines(loc, intel) {
  const t = tierOf(loc), out = [];
  if (intel >= 1) out.push(`${t.guards} armed guard${t.guards > 1 ? 's' : ''} and ${t.cams} cameras. The teller line holds about $${Math.round(t.drawers[0] / 1000)}k–${Math.round(t.drawers[1] / 1000)}k.`);
  if (intel >= 2) out.push(`The vault holds $${Math.round(t.vault[0] / 1000)}k–${t.vault[1] >= 1e6 ? (t.vault[1] / 1e6).toFixed(1) + 'M' : Math.round(t.vault[1] / 1000) + 'k'}.${t.lock ? ' It\'s on a time lock: drill it, have a hacker beat it, or wait it out.' : ' No time lock: the manager opens it.'}`);
  if (intel >= 3) out.push(`First units show up about ${t.response} minutes after the alarm. The guards change shifts at 2 PM, and nobody watches the back door for ten minutes.`);
  return out;
}

// Walk in and look around. Once a game day per bank.
export function caseBank(s, loc) {
  const p = planFor(s, loc.id);
  if (p.intel >= MAX_INTEL) return { ok: false, why: 'done' };
  if (p.cased === s.time.day) return { ok: false, why: 'today' };
  p.intel++;
  p.cased = s.time.day;
  return { ok: true, intel: p.intel, line: intelLines(loc, p.intel)[p.intel - 1] };
}

export const crewCut = p => Object.values(p.crew).reduce((t, id) => t + (CREW_BY_ID[id]?.cut || 0), 0);
export const skillOf = (p, role) => CREW_BY_ID[p.crew[role]]?.skill || 0;

export function hire(s, bankId, crewId) {
  const p = planFor(s, bankId), c = CREW_BY_ID[crewId];
  if (!c) return false;
  p.crew[c.role] = p.crew[c.role] === crewId ? null : crewId;   // tap again to let them go
  return true;
}

export function buyGear(s, bankId, gearId) {
  const p = planFor(s, bankId), g = GEAR_BY_ID[gearId];
  if (!g || p.gear.includes(gearId)) return { ok: false, have: true };
  if (!spend(s, g.price, `Heist gear: ${g.name}`, { street: true })) return { ok: false, why: 'money' };
  p.gear.push(gearId);
  return { ok: true, item: g };
}

export function payInside(s, loc) {
  const p = planFor(s, loc.id);
  if (p.bribed) return { ok: false, have: true };
  const amt = bribeFor(loc.bank);
  if (!spend(s, amt, 'Cash to a bank manager', { street: true })) return { ok: false, why: 'money' };
  p.bribed = true;
  return { ok: true, amount: amt };
}

export function setApproach(s, bankId, id) { if (APPROACHES[id]) planFor(s, bankId).approach = id; }

const nightNow = s => { const hr = (s.time.min / 60) % 24; return hr < 4; };

// Everything still missing before you can go. [] means ready.
export function missing(s, loc) {
  const p = planFor(s, loc.id), out = [];
  if (lockedDown(s, loc.id)) out.push(`The bank is on lockdown until day ${ensureHeists(s).lockdown[loc.id]}`);
  if (p.intel < 1) out.push('Case the bank at least once');
  const A = APPROACHES[p.approach];
  if (!A) { out.push('Pick an approach'); return out; }
  for (const r of A.roles) if (!p.crew[r]) out.push(`Hire ${r === 'muscle' ? 'muscle' : 'a ' + ROLES[r].name.toLowerCase()}`);
  for (const g of A.gear) if (!p.gear.includes(g)) out.push(`Buy ${GEAR_BY_ID[g].name.toLowerCase()}`);
  if (A.bribe && !p.bribed) out.push('Pay the inside man');
  if (A.night && !nightNow(s)) out.push('Wait for midnight to 4 AM');
  return out;
}

// ---------------------------------------------------------------- the job
// Each phase: what you see and what you can do. ui/heist.js shows it and
// passes the choice to step().
export function startJob(s, loc, rng = Math.random) {
  const p = planFor(s, loc.id), t = tierOf(loc);
  return {
    bank: loc.id, name: loc.name, tier: loc.bank || 'branch', approach: p.approach, plan: p,
    phase: 0, min: 0, alarm: false, alarmAt: null, outside: false,
    drawers: 0, vault: 0, hurt: 0, over: false, log: [],
    response: t.response + (p.gear.includes('jammer') ? 2 : 0) + (p.gear.includes('scanner') ? 0.5 : 0),
    seed: rng(),
  };
}

// The phases of each approach, in order.
export const PHASES = {
  loud: ['lobby', 'drawers', 'vault', 'out'],
  quiet: ['entry', 'vault', 'out'],
  inside: ['delivery', 'vault', 'out'],
};
export const phaseId = job => PHASES[job.approach][job.phase];

// The choices for the current phase: [{ id, label, hint }]
export function choices(job) {
  const p = job.plan, t = BANK_TIERS[job.tier];
  switch (phaseId(job)) {
    case 'lobby': return [
      { id: 'calm', label: 'Calm and quick', hint: '"Everybody on the floor, nobody gets hurt." The guard might try something.' },
      { id: 'ceiling', label: 'Warning shots into the ceiling', hint: 'Everyone freezes, the guard included. The alarm goes off for sure.' },
    ];
    case 'drawers': return [
      { id: 'vault', label: 'Drawers, then the vault', hint: 'The real money is downstairs.' },
      { id: 'run', label: 'Just the drawers, go now', hint: 'Out before anybody shows up.' },
    ];
    case 'vault': return job.approach === 'loud' ? [
      ...(t.lock ? [p.gear.includes('drill') ? { id: 'drill', label: 'Drill the time lock', hint: 'Four loud minutes.' } : null,
        skillOf(p, 'hacker') ? { id: 'hack', label: 'Hacker beats the time lock', hint: `About ${7 - skillOf(p, 'hacker')} minutes.` } : null,
        { id: 'wait', label: 'Wait out the time lock', hint: 'Ten minutes. Long enough for anybody to show up.' }]
        : [{ id: 'manager', label: 'Have the manager open it', hint: 'Two minutes and a shaking hand on the dial.' }]),
      { id: 'skip', label: 'Forget the vault, go', hint: 'Keep what you have.' },
    ].filter(Boolean) : [
      { id: 'all', label: 'Fill every bag', hint: 'All of it. Takes longer.' },
      { id: 'half', label: 'Grab what you can carry and go', hint: 'Half the vault, half the time.' },
    ];
    case 'entry': return [
      { id: 'roof', label: 'Through the roof', hint: 'Slow and careful. Less chance of tripping the alarm.' },
      { id: 'door', label: 'Pick the back door', hint: 'Fast. The door contact is on the alarm.' },
    ];
    case 'delivery': return [
      { id: 'walk', label: 'Walk in with the delivery', hint: 'Clipboard, uniform, a dolly of cash bags. Act bored.' },
      { id: 'early', label: 'Show up an hour early', hint: 'Fewer people in the lobby, but the real truck could show.' },
    ];
    case 'out': return [
      { id: 'front', label: 'Out the front to the car', hint: p.crew.driver ? `${CREW_BY_ID[p.crew.driver].name.split(' ')[0]} has it at the curb.` : 'Your car is where you left it.' },
      { id: 'back', label: 'Out the back, through the alley', hint: 'Away from the street the cops come down.' },
    ];
  }
  return [];
}

const tick = (job, m) => { job.min += m; if (job.alarm && !job.outside && job.min - job.alarmAt >= job.response) job.outside = true; };
const trip = job => { if (!job.alarm) { job.alarm = true; job.alarmAt = job.min; } };

// Resolve the current phase with the player's choice. Returns the line for the screen.
export function step(s, job, choice, rng = Math.random) {
  const p = job.plan, t = BANK_TIERS[job.tier], intel = p.intel * 0.05;
  const armor = p.gear.includes('armor') ? 0.5 : 1;
  let line = '';
  switch (phaseId(job)) {
    case 'lobby': {
      tick(job, 2);
      if (choice === 'ceiling') { trip(job); line = 'Three shots into the ceiling tiles. Everybody hits the floor, the guard too. The alarm is ringing.'; break; }
      const resist = clamp(t.guards * 0.12 - skillOf(p, 'muscle') * 0.04 - intel, 0.02, 0.5);
      if (rng() < resist) {
        trip(job);
        job.hurt += Math.round((18 + rng() * 25) * armor);
        line = `The guard went for his gun. ${CREW_BY_ID[p.crew.muscle]?.name.split(' ')[0] || 'Your muscle'} put him down, but you caught one${armor < 1 ? ' in the vest' : ''}. The alarm is ringing.`;
      } else {
        if (rng() < clamp(0.45 - (p.gear.includes('jammer') ? 0.3 : 0) - intel, 0.05, 0.9)) { trip(job); line = 'The lobby is yours, but a teller hit the silent alarm under her counter.'; }
        else line = 'The lobby is yours. Everybody is face down and quiet. No alarm yet.';
      }
      break;
    }
    case 'drawers': {
      tick(job, 2);
      job.drawers = between(t.drawers, rng);
      // a dye pack in a drawer ruins part of it
      if (rng() < 0.3) { job.drawers = Math.round(job.drawers * 0.6); line = `You emptied the teller line: $${job.drawers.toLocaleString()}. A dye pack went off in one bag; that part is ruined.`; }
      else line = `You emptied the teller line: $${job.drawers.toLocaleString()}.`;
      if (!job.alarm && rng() < 0.25) { trip(job); line += ' Somebody hit the alarm while you were busy.'; }
      if (choice === 'run') { job.phase++; line += ' You leave the vault alone.'; }
      break;
    }
    case 'vault': {
      if (job.approach === 'loud') {
        if (choice === 'skip') { line = 'You leave the vault alone.'; break; }
        const mins = { drill: 4, hack: 7 - skillOf(p, 'hacker'), wait: 10, manager: 2 }[choice] || 4;
        if (choice === 'drill') trip(job);
        tick(job, mins);
        job.vault = between(t.vault, rng);
        line = `${choice === 'drill' ? 'The drill screams through the lock.' : choice === 'hack' ? 'The time lock clicks open.' : choice === 'wait' ? 'You wait out the time lock. The longest ten minutes of your life.' : 'The manager opens the vault with a shaking hand.'} $${job.vault.toLocaleString()} into the bags.`;
      } else {
        const all = choice === 'all';
        tick(job, (job.approach === 'quiet' ? 5 : 3) + (all ? 3 : 0));
        job.vault = Math.round(between(t.vault, rng) * (all ? 1 : 0.5) * (job.approach === 'inside' ? 0.8 : 1));
        line = job.approach === 'quiet' ? `The lance burns through the vault wall. $${job.vault.toLocaleString()} into the bags.` : `The manager unlocks the vault and goes to lunch. $${job.vault.toLocaleString()} goes out on the dolly.`;
        if (all && rng() < (job.approach === 'quiet' ? 0.12 : 0.1)) { trip(job); line += ' It took too long; an alarm went off.'; }
      }
      break;
    }
    case 'entry': {
      tick(job, choice === 'roof' ? 6 : 2);
      const odds = clamp(0.35 - skillOf(p, 'hacker') * 0.06 - intel + (choice === 'door' ? 0.15 : 0) - (p.gear.includes('jammer') ? 0.1 : 0), 0.02, 0.8);
      if (rng() < odds) { trip(job); line = `${choice === 'roof' ? 'Down through the roof hatch' : 'The back door opens'}, but a motion sensor ${CREW_BY_ID[p.crew.hacker]?.name || 'your hacker'} missed trips the alarm.`; }
      else line = `${choice === 'roof' ? 'Down through the roof hatch.' : 'The back door opens.'} The alarm panel is dark and the cameras are looping yesterday.`;
      break;
    }
    case 'delivery': {
      tick(job, 2);
      const odds = clamp(0.2 - intel - (choice === 'early' ? 0.05 : 0), 0.03, 0.6);
      if (rng() < odds || (choice === 'early' && rng() < 0.12)) {
        trip(job);
        if (rng() < 0.4) job.hurt += Math.round((12 + rng() * 20) * armor);
        line = choice === 'early' && rng() < 0.5 ? 'The real armored truck pulls in behind you. The guards draw. It\'s loud now.' : 'A guard asks for the route number and doesn\'t like the answer. It\'s loud now.';
      } else line = 'The guard holds the door for you. The manager nods once and doesn\'t look at you again.';
      break;
    }
    case 'out': {
      tick(job, 1);
      job.over = true;
      line = choice === 'back' ? 'Out the back door and down the alley.' : 'Out the front door.';
      job.exit = choice;
      break;
    }
  }
  job.log.push(line);
  if (!job.over) job.phase++;
  if (job.phase >= PHASES[job.approach].length) job.over = true;
  return line;
}

// How hot it is when you hit the street: the starting heat level (0 = nobody's coming).
export function getawayHeat(job) {
  if (!job.alarm) return 0;
  const p = job.plan;
  let heat = job.approach === 'loud' ? 3.5 : 2.5;
  if (job.outside) heat += 1;
  if (job.exit === 'back') heat -= 0.5;
  heat -= skillOf(p, 'driver') >= 3 ? 1 : skillOf(p, 'driver') ? 0.5 : 0;
  if (p.gear.includes('scanner')) heat -= 0.5;
  return clamp(heat, 1, 5.5);
}

// Count the money, pay the crew, close out the plan. The money is dirty.
export function settle(s, job) {
  const h = ensureHeists(s), p = job.plan;
  const gross = job.drawers + job.vault;
  const cuts = Math.round(gross * crewCut(p));
  const net = gross - cuts;
  s.cash += net; s.dirty = (s.dirty || 0) + net;
  s.stats.heists = (s.stats.heists || 0) + 1;
  s.stats.stolen = (s.stats.stolen || 0) + net;
  h.lockdown[job.bank] = s.time.day + LOCKDOWN_DAYS;
  delete h.plans[job.bank];
  h.log.unshift({ day: s.time.day, bank: job.name, net, approach: job.approach });
  if (h.log.length > 20) h.log.length = 20;
  // an inside man is a weak link once the FBI starts asking
  if (job.approach === 'inside') h.flips.push({ bank: job.name, day: s.time.day });
  ensureFeds(s);
  bumpFeds(s, gross ? Math.min(40, 12 + gross / 25000) : 8, `Bank robbery at ${job.name}: the FBI opened a case`);
  const masked = p.gear.includes('masks') || job.approach === 'inside' || (job.approach === 'quiet' && !job.alarm);
  return {
    gross, cuts, net, heat: getawayHeat(job),
    record: { kind: 'bank_robbery', text: `Bank robbery — ${job.name}.`, fine: 25000, conceal: masked ? 0.85 : 0 },
  };
}

// Once a day: an inside man the FBI is squeezing might give you up.
export function heistDay(s, rng = Math.random) {
  const h = ensureHeists(s), notes = [];
  const fed = ensureFeds(s).heat;
  h.flips = h.flips.filter(f => {
    if (s.time.day - f.day > 30) return false;
    if (rng() < 0.04 + fed / 600) {
      addWarrant(s, { kind: 'bank_robbery', text: `Bank robbery — ${f.bank}.`, fine: 25000, felony: true, evidence: 'The bank manager flipped and named you' });
      notes.push({ from: 'fbi', text: `The branch manager at ${f.bank} is cooperating with the FBI. A federal warrant is out for you for bank robbery.` });
      return false;
    }
    return true;
  });
  return notes;
}
