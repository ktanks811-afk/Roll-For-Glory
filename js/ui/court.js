// The justice system on screen: booking and bail after an arrest, the
// courthouse (your hearing, the plea deal, trial, the verdict) and the jail
// sim that runs your time. Rules live in core/justice.js.

import { openPanel, bind, esc, toast, modal, confirm } from './dom.js';
import { game, fmtMoney, earn, spend, canAfford, activeCar, addRep } from '../core/state.js';
import { LOC_BY_ID } from '../data/world.js';
import { advanceTime } from './garage.js';
import { sendMessage } from '../core/story.js';
import { saveGame } from '../core/save.js';
import { ensure as ensureHustle } from '../core/hustle.js';
import {
  CLASSES, BOND_FEE, DOCKET, STORAGE_PER_DAY, FACILITY, IMPOUND_LOT, impoundFee,
  ensureJustice, openCase, topClass, isFelonyCase, priorScore, courtName, fmtCourt, bailFor, postBond, courtStatus,
  pleaOffer, convictChance, lawyerFee, dismissChance, resolveCase, describe, payFine, gameMinutes, realDaysFor, fmtDays,
} from '../core/justice.js';

const COURT = () => LOC_BY_ID.courthouse;
const JUDGES = ['Hon. Raymond Okafor', 'Hon. Patricia Delgado', 'Hon. Wade Hollister', 'Hon. Renee Castillo', 'Hon. Curtis Bell'];
const judgeOf = c => JUDGES[c.cause % JUDGES.length];
const style = (s, c) => `<i>The State of Texas v. ${esc(s.player.name)}</i> · Cause No. ${c.cause}`;
export const chargesHtml = c => `<div class="charges">${c.charges.map(x => `<div class="charge"><span>⚖ ${esc(x.text)}</span><b class="${CLASSES[x.cls].felony ? 'bad' : 'warn'}">${CLASSES[x.cls].short}</b></div>`).join('')}</div>`;

// ---------------------------------------------------------------- booking
// Right after the arrest: the magistrate reads the charges, sets bail and a
// court date. Bond out, or wait in jail until court.
export async function book(app, c) {
  const s = game.s;
  if (!c || !ensureJustice(s).cases.includes(c)) return;
  const b = bailFor(s, c);
  for (;;) {
    const opts = b.held ? [{ label: 'Wait in jail for court', primary: true, value: 'held' }] : [
      b.pr && { label: 'Sign a personal bond (free)', primary: true, value: 'pr' },
      canAfford(s, b.amount) && { label: `Post cash bail · ${fmtMoney(b.amount)}`, primary: !b.pr, value: 'cash' },
      canAfford(s, Math.round(b.amount * BOND_FEE)) && { label: `Call a bondsman · ${fmtMoney(Math.round(b.amount * BOND_FEE))}`, primary: !b.pr && !canAfford(s, b.amount), value: 'surety' },
      { label: 'Sit in jail until court', value: 'held' },
    ].filter(Boolean);
    const pick = await modal('Magistrate', `<p class="small muted">Tarrant County Jail · magistrate's warning</p>
      <p>"You're charged with the following. You have the right to remain silent and the right to a lawyer; if you can't afford one, the court will appoint one."</p>
      ${chargesHtml(c)}
      ${b.held ? `<p><b class="bad">Held without bond.</b> ${esc(b.why)}</p>` : `<p>Bail is set at <b>${fmtMoney(b.amount)}</b>.${b.pr ? ' Since it\'s your first time, you can sign a personal bond and walk out for free.' : ''}</p>
      <p class="small muted">Cash bail comes back when you show up to court. A bondsman charges 10% and keeps it. If you can't pay, you sit in jail until your court date, and the time counts toward any sentence.</p>`}
      <p>Court date: <b>${fmtCourt(c.date)}</b>, ${courtName(c)}, Tarrant County Courthouse.</p>`, opts);
    if (pick === 'held') { postBond(s, c, 'held'); await holdForCourt(app, c); return; }
    if (postBond(s, c, pick).ok) break;
  }
  advanceTime(s, 3 * 60);   // fingerprints, mugshot, property, release
  await release(app, { hours: 3, booking: true });
  sendMessage(s, 'clerk', `Notice to appear: ${courtName(c)}, Tarrant County Courthouse, ${fmtCourt(c.date)}. Cause No. ${c.cause}. Doors open at 8 AM and the docket closes at 5 PM. If you don't appear, a warrant will be issued for your arrest${c.bond.type === 'cash' ? ' and your bail will be forfeited' : ''}.`, { action: { type: 'gps', loc: 'courthouse' } });
  saveGame('auto', true);
}

// Couldn't (or wouldn't) make bail: the clock runs in a cell until the
// morning of court, then the bailiffs walk you over.
async function holdForCourt(app, c) {
  const s = game.s;
  const mins = Math.max(60, (c.date.day - s.time.day) * 1440 + c.date.hour * 60 - s.time.min);
  await serveTime(app, { minutes: mins, facility: 'holding', title: 'Awaiting court', label: `Court ${fmtCourt(c.date)}` });
  c.heldMin = (c.heldMin || 0) + mins;
  custodyCosts(s, mins);
  await hearing(app, c, { custody: true });
}

// ---------------------------------------------------------------- courthouse
export function openCourthouse(loc, app) {
  const s = game.s;
  openPanel((root, h) => {
    const j = ensureJustice(s), c = openCase(s), st = c && courtStatus(s, c);
    const hr = (s.time.min / 60) % 24, open = hr >= DOCKET[0] && hr < DOCKET[1];
    root.innerHTML = `<div class="p-head"><h1>Tarrant County Courthouse<small>100 W Weatherford St · Criminal District Courts · open 8 AM – 5 PM</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body court" style="max-width:720px">
      ${c ? `<div class="docket ${st === 'today' ? 'on' : st === 'missed' || st === 'late' || c.fta ? 'missed' : ''}">
          <div class="small muted">${style(s, c)}</div>
          <div class="t">${courtName(c)} · ${judgeOf(c)}</div>
          ${chargesHtml(c)}
          <div class="s">${c.fta ? `<b class="bad">You missed your court date (${fmtCourt(c.date)}).</b> There's a warrant out for bail jumping. Turn yourself in to the court and the judge will hear your case now, but you won't get bail.`
            : st === 'today' ? `<b>Your case is on today's docket.</b> Check in with the bailiff.`
            : st === 'early' ? `Your court date is <b>${fmtCourt(c.date)}</b>. Come back then${c.date.day === s.time.day ? ' (the doors open at 8)' : ''}.`
            : `The docket closed at 5 PM.`}</div>
          <div class="small muted">Bond: ${{ pr: 'personal bond', cash: `cash bail ${fmtMoney(c.bond.paid)} (refunded when you appear)`, surety: `bondsman (${fmtMoney(c.bond.amount)} bond)`, pending: 'released pending court', forfeited: 'forfeited', held: 'held' }[c.bond.type] || c.bond.type}</div>
          ${st === 'today' && !c.fta ? '<button class="btn btn-primary" style="width:100%;margin-top:10px" data-action="hearing">Check in for your hearing</button>' : ''}
          ${c.fta ? `<button class="btn btn-primary" style="width:100%;margin-top:10px" data-action="surrender" ${open ? '' : 'disabled'}>Turn yourself in to the court</button>${open ? '' : '<p class="small muted">The courtroom is closed. Come back at 8 AM, or turn yourself in at a precinct.</p>'}` : ''}
        </div>` : `<div class="docket"><div class="t">No cases on the docket for you.</div><div class="s">Keep it that way.</div></div>`}
      ${recordHtml(s)}
      <p class="small muted">Arrests for anything more than a ticket get filed here. Show up on your court date or a warrant goes out. First-timers on misdemeanours usually get deferred adjudication (probation, and the case is dismissed when it's done). Felonies mean state jail or prison, and priors make everything worse.</p>
      </div>`;
    bind(root, {
      close: () => h.close(),
      hearing: async () => { h.close(); await hearing(app, c, { custody: false }); },
      surrender: async () => {
        if (!(await confirm('Turn yourself in?', '<p>The bailiff takes you into custody and the judge hears your case today. You won\'t get bail, and bail jumping is now one of the charges.</p>', 'Turn myself in'))) return;
        const w = app.world;
        if (w?.police.active) w.police.reset(w);
        s.warrants = (s.warrants || []).filter(x => x.kind !== 'bailjump' || x.caseId !== c.id);
        h.close();
        await hearing(app, c, { custody: true });
      },
    });
  });
}

// Convictions, probation, the open case. Shared with the FWPD app and precincts.
export function recordHtml(s) {
  const j = ensureJustice(s), p = j.probation;
  return `${p ? `<div class="section-title">Probation</div><div class="li"><span>📋</span><div class="grow"><div class="t">${p.deferred ? 'Deferred adjudication' : 'Probation'}: ${esc(p.text)}</div><div class="s">Until day ${p.until} · $60 a week · another conviction before then revokes it (${fmtDays(p.suspended.days)} suspended)</div></div></div>` : ''}
    ${j.convictions.length ? `<div class="section-title">Criminal history</div>${j.convictions.slice(-6).reverse().map(x => `<div class="li"><span>${CLASSES[x.cls]?.felony ? '🟥' : '🟨'}</span><div class="grow"><div class="t">${esc(x.text)}</div><div class="s">Day ${x.day} · ${CLASSES[x.cls]?.short || ''} · ${esc(x.sentence)}</div></div></div>`).join('')}` : ''}`;
}

// The case on your record, if any, as one line for the FWPD app / precinct.
export function caseLine(s) {
  const c = openCase(s);
  if (!c) return '';
  return `<div class="section-title">Court</div><div class="li"><span>⚖</span><div class="grow"><div class="t">${c.fta ? '<b class="bad">Missed court</b> · ' : ''}${courtName(c)} · Cause No. ${c.cause}</div><div class="s">${c.charges.length} charge${c.charges.length > 1 ? 's' : ''}, top: ${CLASSES[topClass(c.charges)].short} · ${c.fta ? 'warrant out for bail jumping' : `court ${fmtCourt(c.date)}`}</div></div><button class="btn btn-sm" data-action="courtgps">📍</button></div>`;
}

// ---------------------------------------------------------------- the hearing
export async function hearing(app, c, { custody = false } = {}) {
  const s = game.s;
  const credit = realDaysFor(c.heldMin || 0);
  await modal('All rise', `<p class="small muted">${courtName(c)} · ${judgeOf(c)} presiding</p>
    <p>${style(s, c)}</p>${chargesHtml(c)}
    ${custody ? '<p class="small muted">You\'re brought in from the holding cell in county orange.</p>' : ''}
    ${priorScore(s) ? `<p class="small muted">The State has your record: ${ensureJustice(s).convictions.length} prior conviction${ensureJustice(s).convictions.length > 1 ? 's' : ''}.</p>` : ''}
    ${ensureJustice(s).probation ? '<p class="small bad">You\'re on probation. The State has filed a motion to revoke it.</p>' : ''}`, [{ label: 'Approach the bench', primary: true }]);
  // weak misdemeanour cases get dropped
  if (!ensureJustice(s).probation && Math.random() < dismissChance(c)) {
    const r = resolveCase(s, c, c.charges.map(ch => ({ charge: ch, guilty: false })));
    if (r.refund) earn(s, r.refund, 'Cash bail refunded');
    await modal('Case dismissed', `<p>The prosecutor stands up: "Your Honor, the State moves to dismiss for insufficient evidence."</p><p><b>Dismissed.</b> You're free to go.${r.refund ? ` Your ${fmtMoney(r.refund)} bail comes back.` : ''}</p>`);
    return after(app, custody, null);
  }
  const offer = pleaOffer(s, c);
  const fee = lawyerFee(c);
  const pick = await modal('Plea', `<p>The prosecutor's offer if you plead guilty:</p>
    <div class="offer"><b>${esc(describe(offer))}</b>${offer.fine ? ` + ${fmtMoney(offer.fine)} fine and court costs` : ''}${offer.kind === 'jail' ? `<div class="small muted">You'd serve about ${fmtDays(Math.max(0, offer.served - credit))}${credit ? ` after ${fmtDays(credit)} credit for time served` : ''}.</div>` : ''}${offer.kind === 'deferred' ? `<div class="small muted">Finish ${offer.probationDays} days of probation and the case is dismissed. No conviction.</div>` : ''}</div>
    <p class="small muted">Or plead not guilty and go to trial. The State's case looks <b>${(ev => ev >= 0.8 ? 'strong' : ev >= 0.65 ? 'decent' : 'thin')(Math.max(...c.charges.map(ch => ch.evidence)))}</b>. Your public defender has a big caseload; a private attorney (${fmtMoney(fee)}) has a much better shot. If the jury convicts, the judge won't be as generous as the deal.</p>`,
    [{ label: 'Take the deal', primary: true, value: 'plea' }, { label: 'Trial with a public defender', value: 'pd' }, ...(canAfford(s, fee) ? [{ label: `Hire a lawyer (${fmtMoney(fee)}) and go to trial`, value: 'lawyer' }] : [])]);
  let verdicts, plea = pick === 'plea';
  if (plea) verdicts = c.charges.map(ch => ({ charge: ch, guilty: true }));
  else {
    if (pick === 'lawyer') spend(s, fee, 'Defense attorney');
    verdicts = c.charges.map(ch => ({ charge: ch, guilty: Math.random() < convictChance(s, ch, pick === 'lawyer') }));
    advanceTime(s, 5 * 60);   // jury selection, testimony, deliberation
    await modal('Verdict', `<p class="small muted">The jury was out ${2 + Math.floor(Math.random() * 4)} hours.</p><p>"On the following counts, we the jury find the defendant..."</p>
      <div class="charges">${verdicts.map(v => `<div class="charge"><span>${esc(v.charge.text)}</span><b class="${v.guilty ? 'bad' : 'good'}">${v.guilty ? 'GUILTY' : 'NOT GUILTY'}</b></div>`).join('')}</div>`, [{ label: verdicts.some(v => v.guilty) ? 'Sentencing' : 'Walk out', primary: true }]);
  }
  const r = resolveCase(s, c, verdicts, { plea, served: credit });
  if (r.refund) earn(s, r.refund, 'Cash bail refunded');
  const sent = r.sentence;
  const f = sent.fine ? payFine(s, sent.fine) : { paid: 0, layout: 0 };
  if (!r.guilty.length) {
    await modal('Not guilty', `<p><b>Acquitted on every count.</b> The judge discharges you.${r.refund ? ` Your ${fmtMoney(r.refund)} bail comes back.` : ''}</p>`);
    return after(app, custody, null);
  }
  const jailDays = (sent.kind === 'jail' ? sent.served : 0) + f.layout;
  await modal('Sentence', `<p>"${plea ? 'The court accepts your plea.' : 'Having been found guilty,'} I sentence you to..."</p>
    <div class="offer"><b>${esc(describe(sent))}</b>${sent.fine ? ` + ${fmtMoney(sent.fine)} fine and costs` : ''}</div>
    ${r.revoked ? `<p class="bad">Probation revoked: you also serve the ${fmtDays(r.revoked.days)} that was suspended for ${esc(r.revoked.text)}</p>` : ''}
    ${sent.kind === 'deferred' ? `<p>Deferred adjudication: ${sent.probationDays} days of probation. Stay out of trouble and the case is dismissed. Get convicted of anything before then and you're sentenced on this one too.</p>` : ''}
    ${sent.kind === 'probation' ? `<p>${fmtDays(sent.days)} suspended: ${sent.probationDays} days of probation instead. Another conviction before it's done and you serve it.</p>` : ''}
    ${sent.kind === 'jail' ? `<p>With ${sent.facility === 'prison' ? (sent.tg ? 'parole at half time (aggravated offense)' : 'parole') : sent.facility === 'county' ? 'good-time credit' : 'state jail credit'}${r.credit ? ` and ${fmtDays(r.credit)} for time served` : ''}, you'll do about <b>${fmtDays(sent.served)}</b>.</p>` : ''}
    ${f.layout ? `<p class="bad">You can't cover the ${fmtMoney(sent.fine)} fine. You'll sit out the rest in jail: ${f.layout} day${f.layout > 1 ? 's' : ''} at ${fmtMoney(150)} a day.</p>` : ''}
    ${r.refund ? `<p class="small muted">Your ${fmtMoney(r.refund)} cash bail is refunded${sent.fine ? ' (applied to the fine first)' : ''}.</p>` : ''}`,
    [{ label: jailDays ? 'Go with the bailiff' : 'Leave the courtroom', primary: true }]);
  if (jailDays) {
    const facility = sent.kind === 'jail' ? sent.facility : 'county';
    const mins = gameMinutes(jailDays);
    await serveTime(app, { minutes: mins, facility, title: facility === 'county' ? 'County jail' : facility === 'statejail' ? 'State jail' : 'Prison', label: describe(sent.kind === 'jail' ? sent : { kind: 'jail', facility: 'county', days: f.layout }), realDays: jailDays });
    custodyCosts(s, mins);
    if (facility !== 'county') addRep(s, 40, 'Did a bid');   // the streets respect it
    return after(app, true, sent);
  }
  return after(app, custody, sent);
}

async function after(app, custody, sent) {
  const s = game.s;
  if (custody) await release(app, { courthouse: true });
  saveGame('auto', true);
  if (sent && sent.kind !== 'jail') toast(sent.kind === 'deferred' ? 'Deferred adjudication. Stay clean.' : sent.kind === 'probation' ? 'On probation. Stay clean.' : 'Fine paid. Case closed.', 'info');
}

// ---------------------------------------------------------------- jail sim
const LOG = {
  common: [
    'Count time: 4 AM, 11 AM, 4 PM, 10 PM. You learn the routine.',
    'Chow hall: bologna sandwich, an orange and a carton of milk. Again.',
    'Commissary day. Ramen and stamps are the money in here.',
    'Rec yard for an hour. Somebody\'s running a spades tournament.',
    'Mail call. Jojo sent a letter: "Hold your head. The car\'s fine."',
    'Lockdown after a fight on the next pod. You stayed on your bunk.',
    'Your cellie snores like a straight-piped V8.',
    'Somebody in the dayroom swears he used to race Loop 820. He did not.',
    'Lights out. The fluorescent buzz never really stops.',
    'You read a Haynes manual from the book cart cover to cover.',
    'Phone time. Fifteen minutes, and the call costs more than gas.',
    'Shower shoes, a thin mattress, a wool blanket. Home for now.',
  ],
  county: ['Booked into a pod on the 4th floor of the Belknap St tower.', 'Your public defender\'s office sends a form letter.', 'Trustee on the meal cart slides you an extra cookie.'],
  holding: ['Holding cell, then a pod. Your court date can\'t come soon enough.', 'Your public defender comes by for five minutes. "Just sit tight."', 'A bondsman\'s flyer is taped to the phone.'],
  statejail: ['The chain bus to Jacksboro takes all morning.', 'Assigned to the kitchen. Up at 3 AM making biscuits.', 'GED class in the education building.'],
  prison: ['Transferred to Huntsville on the chain bus. White uniform now.', 'Field squad: hoe in hand, under the Texas sun. The State doesn\'t pay you for it.', 'Your TDCJ number is on everything you own.', 'Parole board sends your review date.', 'Weight pile in the yard. You\'re getting bigger.', 'Somebody fixed a Monte Carlo in the vocational shop. You helped.'],
};

// Runs time forward in a cell. minutes: game minutes to serve. Resolves once
// you walk out (or the panel is closed, which serves the rest instantly).
export function serveTime(app, { minutes, facility = 'county', title = 'Jail', label = '', realDays = 0 }) {
  const s = game.s, F = FACILITY[facility] || FACILITY.county;
  const start = { day: s.time.day, min: s.time.min };
  const total = Math.max(1, Math.round(minutes));
  const inmate = (facility === 'prison' || facility === 'statejail' ? 'TDCJ #' : 'CID #') + String(2400000 + (s.player.name.length * 7919 + total) % 900000);
  const pool = [...LOG.common, ...(LOG[facility] || [])];
  const log = [LOG[facility]?.[0] || pool[0]];
  let done = 0, timer = null, out = false;
  // a game day every ~0.7 s; the whole thing never takes more than ~20 s
  const perTick = Math.max(30, Math.ceil(total / Math.min(80, Math.max(8, total / 1440 * 3))));
  return new Promise(resolve => {
    const finish = () => {
      if (timer) { clearInterval(timer); timer = null; }
      if (done < total) { advanceTime(s, total - done); done = total; }
    };
    const h = openPanel((root, hh) => {
      const days = Math.ceil(total / 1440), day = Math.min(days, Math.floor(done / 1440) + 1);
      const pct = done / total * 100;
      root.innerHTML = `<div class="p-head jail-head"><h1>${esc(title)}<small>${esc(F.name)} · ${esc(F.where)}</small></h1></div>
        <div class="p-body jail">
          <div class="jail-id"><div class="mug">${esc(s.player.name.slice(0, 1).toUpperCase())}</div><div><b>${esc(s.player.name)}</b><div class="small muted">${inmate}</div><div class="small">${esc(label)}</div></div></div>
          <div class="jail-clock">${done >= total ? 'RELEASED' : `DAY ${day} OF ${days}`}</div>
          <div class="bar ${done >= total ? 'green' : 'red'}"><div style="width:${pct}%"></div></div>
          <div class="small muted" style="margin:4px 0 10px">${realDays ? `${fmtDays(realDays)} inside · ` : ''}${done >= total ? 'time served' : `${Math.ceil((total - done) / 60)} hours of game time left`}</div>
          <div class="jail-log">${log.slice(-7).reverse().map(t => `<div>${esc(t)}</div>`).join('')}</div>
        </div>
        <div class="p-foot">${done >= total ? '<button class="btn btn-primary" data-action="out">Walk out</button>' : '<button class="btn" data-action="skip">Skip to release</button>'}</div>`;
      bind(root, {
        skip: () => { finish(); log.push(pool[Math.floor(Math.random() * pool.length)]); hh.refresh(); },
        out: () => { out = true; hh.close(); },
      });
    }, { cls: 'jail-panel', onClose: () => { finish(); resolve({ start, minutes: total }); } });
    timer = setInterval(() => {
      const step = Math.min(perTick, total - done);
      const dayBefore = Math.floor(done / 1440);
      advanceTime(s, step); done += step;
      if (Math.floor(done / 1440) !== dayBefore || Math.random() < 0.08) log.push(pool[Math.floor(Math.random() * pool.length)]);
      if (done >= total) { clearInterval(timer); timer = null; }
      h.refresh();
    }, 250);
  });
}

// Out of custody: on foot in front of the courthouse (the jail is next door),
// car on the impound lot behind the Central Precinct until you pay to get it out.
export async function release(app, { booking = false } = {}) {
  const s = game.s, w = app.world;
  if (w) {
    w.police.reset(w);
    const l = COURT();
    const car = activeCar(s);
    if (car) {
      const sp = w.homeSpot(car.impound ? LOC_BY_ID[IMPOUND_LOT] : LOC_BY_ID[s.home] || LOC_BY_ID.eastgate_studio);
      w.placeCar(car, sp.x, sp.z, sp.h);
      s.carPos = { x: sp.x, z: sp.z, h: sp.h };
    }
    w.inCar = false;
    w.foot.x = l.x; w.foot.z = l.z + 4; w.foot.h = l.face;
    w.restartEngineSound?.();
    if (w.cam) { w.cam.x = w.foot.x; w.cam.z = w.foot.z; }
  }
  s.heat = 0;
  const held = activeCar(s)?.impound ? ` Your car is in the impound lot at the Central Precinct (${fmtMoney(impoundFee(s))} to get it out).` : '';
  toast((booking ? 'Released on bond.' : 'Released.') + (held || (booking ? ' Your car was towed home.' : ' Your car is back at home.')), 'info');
}

// What being locked up cost you: storage on the impounded car, and jobs
// that didn't wait. minutes: game time inside.
export function custodyCosts(s, minutes) {
  const days = Math.floor(minutes / 1440);
  const out = { storage: 0, fired: [] };
  if (days >= 1 && activeCar(s)) {
    out.storage = days * STORAGE_PER_DAY;
    if (!spend(s, out.storage, 'Impound storage')) { s.bank -= Math.max(0, out.storage - s.cash - s.bank); s.cash = 0; }
  }
  if (days >= 2) {
    const h = ensureHustle(s);
    out.fired = h.jobs.splice(0);
    if (out.fired.length) sendMessage(s, 'hustle', `You missed ${days} days of shifts while you were locked up. You've been let go${out.fired.length > 1 ? ' from all your jobs' : ''}.`);
  }
  return out;
}
