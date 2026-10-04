// JPS on screen: waking up in the trauma unit after you're shot down or crash
// out (the stay runs the clock forward), the discharge desk with the bill,
// the hospital itself on Main St (clinic follow-ups, urgent care, billing),
// and the JPS Health phone app. Rules live in core/health.js.

import { openPanel, bind, esc, toast, modal } from './dom.js';
import { game, fmtMoney, spend, canAfford, activeCar } from '../core/state.js';
import { LOC_BY_ID } from '../data/world.js';
import { advanceTime } from './garage.js';
import { sendMessage } from '../core/story.js';
import { saveGame } from '../core/save.js';
import { ensure as ensureHustle } from '../core/hustle.js';
import { input } from '../core/input.js';
import { takeWarrants, hasWarrant } from '../core/warrants.js';
import { charge, fileCase, openCase } from '../core/justice.js';
import {
  HOSPITAL, INJURIES, PIP, FOLLOWUP_COST, CONNECTION_LIMIT, PLAN_WEEKS, PLAN_DOWN, DUE_DAYS,
  ensureHealth, healthMods, diagnose, admit, openBills, medicalDebt, pastDue, inCollections, canConnect, statusLabel,
  payBill, applyConnection, startPlan, followUp, fmtLeft,
} from '../core/health.js';

const JPS = () => LOC_BY_ID[HOSPITAL];
const URGENT_COST = 250;

const LOG = {
  shot: ['MedStar has you on the stretcher before you know what happened.', 'Trauma bay 3. Somebody is cutting your shirt off.', 'They roll you into the OR. Count back from ten.', 'You wake up in recovery with a drain in your side and a mouth like sand.', 'An FWPD officer stops by to take a report. Hospitals have to call in gunshot wounds.', 'Nurse wakes you at 4 AM for vitals. Again.'],
  crash: ['The fire department cuts the door off to get you out.', 'MedStar runs lights and sirens down I-30.', 'CT scan. Hold still. Breathe in.', 'An orthopedic resident explains the X-ray like it\'s good news.', 'A chaplain asks if there\'s anyone you want called.', 'Jell-O and a paper cup of ice chips.'],
  common: ['The TV in your room only gets the local news.', 'Your roommate snores through the whole night shift.', 'Physical therapy walks you to the end of the hall and back.', 'A social worker leaves a JPS Connection brochure on the tray table.', 'Discharge paperwork takes three hours. It always does.'],
};

// ---------------------------------------------------------------- wake up
// Called by the world when you go down. cause: 'shot' | 'crash'. sev 0..1.
export async function wakeAtHospital(app, { cause = 'shot', sev = 0.5, why = '' } = {}) {
  const s = game.s, w = app.world;
  if (!s || w?.downed) return;
  const P = w?.police;
  // you went down in the middle of a pursuit: they'll be at your bedside
  const pursuit = !!P && ['chase', 'search', 'stop'].includes(P.phase) && P.eyesOn !== false;
  const record = pursuit ? P.record.slice() : [];
  const level = P?.level || 1;
  if (w) {
    w.downed = true;
    w.races?.cancel?.('crash');
    if (w.gigs?.job) w.gigs.cancel(cause === 'crash' ? 'You crashed out on the job. Shift cancelled, clean-shift streak reset.' : 'You got hurt on the job. Shift cancelled, clean-shift streak reset.');
    const c = w.combat;
    if (c) { c.rob = null; c.mug = null; c.drawn = false; }
    const wasIn = w.inCar;
    const hot = wasIn && w.thefts?.busted();   // a stolen car goes back to its owner
    if (wasIn && !hot && !pursuit) {
      // your own wreck gets towed home
      const car = activeCar(s);
      if (car && w.vehicle?.car === car) {
        const sp = w.homeSpot(LOC_BY_ID[s.home] || LOC_BY_ID.eastgate_studio);
        w.placeCar(car, sp.x, sp.z, sp.h);
        s.carPos = { x: sp.x, z: sp.z, h: sp.h };
      }
    }
    w.inCar = false;
    input.setContext('foot');
    if (w.engine) { w.engine.stop(); w.engine = null; }
    if (!pursuit) P?.reset(w);
    const l = JPS();
    w.foot.x = l.x; w.foot.z = l.z + 3; w.foot.h = l.face;
    if (w.cam) { w.cam.x = w.foot.x; w.cam.z = w.foot.z; }
  }
  const chart = diagnose(cause, sev);
  const unread0 = s.messages.filter(m => !m.read).length;
  await stay(chart, why);
  const pip = cause === 'crash' && s.insurance ? Math.min(PIP, chart.total) : 0;
  const bill = admit(s, chart, { pip });
  const mods = healthMods(s);
  if (w?.combat) w.combat.arms.hp = Math.round(mods.cap * 0.7);
  // the time you lost
  const lost = [];
  if (chart.stayH >= 24) {
    const h = ensureHustle(s);
    const gone = h.jobs.pop();
    if (gone) { lost.push(`You missed your shifts. ${esc(gone.name || 'Your job')} let you go.`); sendMessage(s, 'hustle', `You missed ${Math.floor(chart.stayH / 24)} day${chart.stayH >= 48 ? 's' : ''} of shifts while you were in the hospital. You've been let go.`); }
  }
  await dischargeDesk(s, chart, bill, lost);
  if (w) w.downed = false;
  const missed = s.messages.filter(m => !m.read).length - unread0;
  if (missed > 0) toast(`📱 ${missed} new text${missed > 1 ? 's' : ''} while you were in the hospital`, 'info');
  // gunshot wounds get reported; crashing out of a chase gets you cuffed to the bed
  if (pursuit && w) {
    const items = record.some(r => r.kind === 'evading') ? record : [...record, { kind: 'evading', text: 'Evading arrest (in a vehicle).' }];
    w.onBusted(400 * level + 250 * (level - 1) ** 2, false, items);
    P.reset(w);
  } else if (cause === 'shot' && hasWarrant(s)) bedsideWarrants(app, s);
  saveGame('auto', true);
}

// The stay: the clock runs while you're in a bed. Skip to the end any time.
function stay(chart, why) {
  const s = game.s;
  const total = chart.stayH * 60;
  const pool = [...LOG[chart.cause], ...LOG.common];
  const log = [LOG[chart.cause][0]];
  let done = 0, timer = null;
  const perTick = Math.max(20, Math.ceil(total / 60));
  return new Promise(resolve => {
    const finish = () => {
      if (timer) { clearInterval(timer); timer = null; }
      if (done < total) { advanceTime(s, total - done); done = total; }
    };
    const h = openPanel((root, hh) => {
      const pct = done / total * 100, left = total - done;
      root.innerHTML = `<div class="p-head jps-head"><h1>JPS Trauma Center<small>John Peter Smith Hospital · 1500 S Main St</small></h1></div>
        <div class="p-body jail jps">
          ${why ? `<p class="small muted">${esc(why)}</p>` : ''}
          <div class="jail-id"><div class="mug jps-mug">✚</div><div><b>${esc(s.player.name)}</b><div class="small muted">${chart.cause === 'shot' ? 'Gunshot wound' : 'Motor vehicle crash'} · Level I trauma</div>
            <div class="small">${chart.kinds.map(k => `${INJURIES[k].icon} ${esc(INJURIES[k].name)}`).join(' · ')}</div></div></div>
          <div class="jail-clock jps-clock">${done >= total ? 'CLEARED FOR DISCHARGE' : `ADMITTED · ${fmtLeft(left)} TO GO`}</div>
          <div class="bar ${done >= total ? 'green' : 'red'}"><div style="width:${pct}%"></div></div>
          <div class="small muted" style="margin:4px 0 10px">${chart.stayH} hours in a hospital bed. The city didn't wait for you.</div>
          <div class="jail-log">${log.slice(-6).reverse().map(t => `<div>${esc(t)}</div>`).join('')}</div>
        </div>
        <div class="p-foot">${done >= total ? '<button class="btn btn-primary" data-action="out">Go to discharge</button>' : '<button class="btn" data-action="skip">Skip to discharge</button>'}</div>`;
      bind(root, {
        skip: () => { finish(); log.push('Discharge paperwork takes three hours. It always does.'); hh.refresh(); },
        out: () => hh.close(),
      });
    }, { cls: 'jail-panel jps-panel', onClose: () => { finish(); resolve(); } });
    let li = 1;
    timer = setInterval(() => {
      const step = Math.min(perTick, total - done);
      advanceTime(s, step); done += step;
      if (li < pool.length && Math.random() < 0.25) log.push(pool[li++]);
      if (done >= total) { clearInterval(timer); timer = null; }
      h.refresh();
    }, 200);
  });
}

const itemsHtml = b => `<div class="charges jps-items">${b.items.map(([t, v]) => `<div class="charge"><span>${esc(t)}</span><b>${fmtMoney(v)}</b></div>`).join('')}
  ${b.pip ? `<div class="charge"><span>Auto insurance (PIP)</span><b class="good">−${fmtMoney(b.pip)}</b></div>` : ''}</div>`;

async function dischargeDesk(s, chart, b, lost) {
  const mods = healthMods(s);
  const effects = [mods.speed < 1 && `you move at ${Math.round(mods.speed * 100)}% speed${mods.noRun ? ' and can\'t run' : ''}`, mods.aim > 1 && 'your aim is shaky', mods.cap < 100 && `health tops out at ${mods.cap}`].filter(Boolean);
  for (;;) {
    if (b.status === 'paid' || b.plan || b.status === 'plan') break;
    const opts = [
      canAfford(s, b.balance) && { label: `Pay in full · ${fmtMoney(b.balance)}`, primary: true, value: 'pay' },
      canConnect(s, b) && { label: 'Apply for JPS Connection', primary: !canAfford(s, b.balance), value: 'connect' },
      { label: `Payment plan · ${fmtMoney(Math.max(25, Math.round(b.balance * PLAN_DOWN)))} down`, value: 'plan' },
      { label: 'Bill me later', value: 'later' },
    ].filter(Boolean);
    const pick = await modal('Discharged', `<p class="small muted">JPS Health Network · patient financial services · account ${esc(b.acct)}</p>
      <p>You walk out of JPS on your own feet. ${chart.kinds.map(k => esc(INJURIES[k].name)).join(' and ')}: ${effects.length ? effects.join(', ') : 'sore'} until it heals. ${lost.join(' ')}</p>
      ${itemsHtml(b)}
      <p>You owe <b>${fmtMoney(b.balance)}</b>${b.connection ? ' after JPS Connection' : ''}, due day ${b.due}.</p>
      <p class="small muted">${canConnect(s, b) ? `You have under ${fmtMoney(CONNECTION_LIMIT)} to your name, so you qualify for JPS Connection: Tarrant County pays 90%. ` : ''}A plan is interest-free, ${PLAN_WEEKS} weekly payments from your account. Ignore the bill and it goes to collections, then court, then they garnish your bank account.</p>`, opts);
    if (pick === 'later') break;
    if (pick === 'pay') { payBill(s, b); continue; }
    if (pick === 'connect') { applyConnection(s, b); toast(`JPS Connection approved. You owe ${fmtMoney(b.balance)}.`, 'good'); if (!b.balance) b.status = 'paid'; continue; }
    if (pick === 'plan') { if (startPlan(s, b)) toast(`Payment plan set: ${fmtMoney(b.plan?.per || 0)} a week`, 'good'); continue; }
  }
  if (b.status === 'open') sendMessage(s, 'jps', `Your statement for account ${b.acct}: ${fmtMoney(b.balance)} due by day ${b.due}. Pay, set up a plan, or apply for JPS Connection in the JPS Health app.`, { action: { type: 'gps', loc: HOSPITAL } });
}

// Gunshot wounds get reported. The officer runs your name.
async function bedsideWarrants(app, s) {
  const wr = takeWarrants(s);
  const old = charge(wr.items, 0.6);
  const tickets = old.tickets.reduce((t, r) => t + (r.fine || 0), 0) + wr.tickets;
  if (tickets && !spend(s, tickets, 'FWPD warrants + tickets')) { s.bank -= Math.max(0, tickets - s.cash - s.bank); s.cash = 0; }
  const c = old.charges.length || openCase(s)?.fta ? fileCase(s, old.charges) : null;
  await modal('FWPD at your bedside', `<p class="muted">"Hospital called in the gunshot wound. I ran your name. You've got ${wr.n > 1 ? 'warrants' : 'a warrant'}."</p>
    ${tickets ? `<p>Fines and tickets: <b>${fmtMoney(tickets)}</b>.</p>` : ''}${c ? `<p>You're booked into the Tarrant County Jail on:</p><div class="charges">${c.charges.map(x => `<div>⚖ ${esc(x.text)}</div>`).join('')}</div>` : '<p class="small muted">Misdemeanors only. Paid off, you\'re free to go.</p>'}`,
    [{ label: c ? 'See the magistrate' : 'OK', primary: true }]);
  if (c) app.world?.ui?.book?.(c);
}

// ---------------------------------------------------------------- JPS itself
const injuryRows = (s, here) => ensureHealth(s).injuries.map((j, i) => {
  const d = INJURIES[j.kind], pct = 100 - j.left / j.total * 100;
  return `<div class="li"><span style="font-size:20px">${d.icon}</span><div class="grow"><div class="t">${esc(d.name)}</div>
    <div class="s">Healed in ${fmtLeft(j.left)}${j.followUp ? ' · follow-up done' : ''}</div><div class="bar thin green"><div style="width:${pct}%"></div></div></div>
    ${here && !j.followUp ? `<button class="btn btn-sm btn-primary" data-action="follow" data-i="${i}" ${pastDue(s) ? 'disabled' : ''}>${esc(d.care)} · ${fmtMoney(FOLLOWUP_COST)}</button>` : ''}</div>`;
}).join('');

const billRows = s => openBills(s).map(b => `<div class="li jps-bill ${inCollections(b) ? 'bad-b' : b.status === 'late' ? 'warn-b' : ''}"><div class="grow">
    <div class="t">${inCollections(b) ? 'Lone Star Recovery · ' : ''}${esc(b.acct)} · ${fmtMoney(b.balance)}</div>
    <div class="s"><b class="${inCollections(b) || b.status === 'late' ? 'bad' : ''}">${statusLabel(b)}</b> · ${b.plan ? `${fmtMoney(b.plan.per)} a week, next day ${b.plan.next}` : b.status === 'open' ? `due day ${b.due}` : b.status === 'judgment' ? 'your bank account is garnished weekly' : inCollections(b) ? 'they sue if you don\'t pay' : 'goes to collections soon'}${b.connection ? ' · JPS Connection' : ''}</div></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn btn-sm btn-primary" data-action="pay" data-id="${b.id}" ${canAfford(s, b.balance) ? '' : 'disabled'}>Pay</button>
      ${canConnect(s, b) ? `<button class="btn btn-sm" data-action="connect" data-id="${b.id}">JPS Connection</button>` : ''}
      ${!b.plan && !inCollections(b) ? `<button class="btn btn-sm" data-action="plan" data-id="${b.id}">Plan</button>` : ''}
    </div></div>`).join('');

function billHandlers(s, refresh) {
  const find = id => openBills(s).find(b => b.id === id);
  return {
    pay: d => { const b = find(d.id); if (b && payBill(s, b)) { toast(inCollections(b) ? 'Paid off. Lone Star Recovery closes the account.' : 'Paid in full. Thank you.', 'good'); saveGame('auto', true); refresh(); } },
    connect: d => { const b = find(d.id); if (b && applyConnection(s, b)) { if (!b.balance) b.status = 'paid'; toast(`JPS Connection approved. You owe ${fmtMoney(b.balance)}.`, 'good'); refresh(); } },
    plan: d => { const b = find(d.id); if (b && startPlan(s, b)) { toast(b.plan ? `Payment plan set: ${fmtMoney(b.plan.per)} a week` : 'Paid in full.', 'good'); refresh(); } },
  };
}

export function openHospital(loc, app) {
  const s = game.s;
  openPanel((root, h) => {
    const w = app.world, a = w?.combat?.arms, mods = healthMods(s);
    const hurt = a && a.hp < mods.cap - 1;
    const inj = ensureHealth(s).injuries;
    root.innerHTML = `<div class="p-head jps-head"><h1>${esc(loc.name)}<small>JPS Health Network · Tarrant County's public hospital</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body" style="max-width:640px">
        <div class="li"><span style="font-size:20px">❤</span><div class="grow"><div class="t">Urgent care</div><div class="s">${hurt ? `Health ${Math.round(a.hp)}/${mods.cap}. Get stitched up and walk out at ${mods.cap}.` : `Health ${Math.round(a?.hp ?? 100)}/${mods.cap}. Nothing to patch.`}</div></div>
          <button class="btn btn-sm btn-primary" data-action="urgent" ${hurt ? '' : 'disabled'}>Patch up · ${fmtMoney(URGENT_COST)}</button></div>
        <div class="section-title">Injuries</div>
        ${inj.length ? injuryRows(s, true) + `<p class="small muted">A follow-up at the clinic halves what's left of the healing.${pastDue(s) ? ' <b class="bad">Your account is past due: the clinic won\'t see you until you pay or set up a plan. The ER still will.</b>' : ''}</p>` : '<p class="muted">Nothing wrong with you. Keep it that way.</p>'}
        <div class="section-title">Patient financial services</div>
        ${openBills(s).length ? billRows(s) : '<p class="muted">No balance. You\'re all paid up.</p>'}
        <p class="small muted">JPS Connection: if you have under ${fmtMoney(CONNECTION_LIMIT)}, the county covers 90% of a bill (not once it's in collections). Plans are interest-free over ${PLAN_WEEKS} weeks. Unpaid bills go to collections ${DUE_DAYS > 0 ? 'a few days after the due date' : ''}, then they sue and garnish your bank account. Cash in your pocket can't be garnished.</p>
      </div>`;
    bind(root, {
      close: () => h.close(),
      urgent: () => { if (spend(s, URGENT_COST, 'JPS urgent care')) { a.hp = mods.cap; toast('Stitched up and taped. Try not to do that again.', 'good'); h.refresh(); } },
      follow: d => { const j = inj[+d.i]; if (j && followUp(s, j)) { toast(`${INJURIES[j.kind].care} done. Healing twice as fast now.`, 'good'); h.refresh(); } },
      ...billHandlers(s, () => h.refresh()),
    });
  }, { cls: 'jps-panel' });
}

// ---------------------------------------------------------------- phone app
export function renderJps(scr, ctx) {
  const s = ctx.s, debt = medicalDebt(s);
  scr.innerHTML = `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>JPS Health</h2></div>
    <div class="app-body">
      <div class="warrant-status ${pastDue(s) ? 'on' : ''}">${debt ? `${fmtMoney(debt)} OWED${pastDue(s) ? ' · PAST DUE' : ''}` : 'NO BALANCE'}</div>
      <div class="section-title">Injuries</div>
      ${ensureHealth(s).injuries.length ? injuryRows(s, false) + '<p class="small muted">Book a follow-up in person at JPS on Main St to heal twice as fast.</p>' : '<p class="muted small">You\'re healthy.</p>'}
      <div class="section-title">Bills</div>
      ${openBills(s).length ? billRows(s) : '<p class="muted small">Nothing owed.</p>'}
      <button class="btn btn-sm" data-action="gps" style="margin-top:10px">📍 GPS to JPS</button>
    </div>`;
  bind(scr, {
    back: () => ctx.go(null),
    gps: () => { const l = JPS(); ctx.app.world?.setGps(l.x, l.z, l.name); ctx.h.close(); },
    ...billHandlers(s, () => ctx.h.refresh()),
  });
}
