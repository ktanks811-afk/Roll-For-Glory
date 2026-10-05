// Getting hurt. Get shot down or crash out and you don't just respawn: MedStar
// takes you to John Peter Smith Hospital (JPS), the county trauma center on
// Main St. You lose the hours (or days) you spent in a bed, you walk out with
// injuries that take game days to heal, and a bill.
//
// The bill: pay it, apply for JPS Connection (the county's financial
// assistance, if you're broke), or set up a weekly payment plan. Ignore it and
// it goes past due, then to a collection agency (+20%), then they sue you in
// justice court and garnish your bank account. Cash on you can't be garnished.
// While an account is past due JPS only treats emergencies: no follow-up
// visits, so your injuries heal at their own slow pace.
//
// Save key s.health = { injuries, bills, visits }. Rules only; the screens
// are in ui/hospital.js.

import { fmtMoney, uid, canAfford, spend } from './state.js';
import { emit } from './events.js';

export const HOSPITAL = 'jps';             // location id (data/world.js)
export const DUE_DAYS = 5;                 // statement due date, game days after discharge
export const COLLECTIONS_AFTER = 3;        // days past due before it's sold to collections
export const COLLECTION_FEE = 0.2;
export const SUIT_AFTER = 4;               // days in collections before they sue
export const SUIT_COSTS = 54;              // justice court filing fee, added to the judgment
export const GARNISH_EVERY = 7;            // a writ of garnishment hits the bank account weekly
export const CONNECTION_LIMIT = 5000;      // JPS Connection: cash + bank under this
export const CONNECTION_SHARE = 0.1;       // ...and you pay 10% of the bill
export const PLAN_WEEKS = 4;
export const PLAN_DOWN = 0.1;
export const FOLLOWUP_COST = 150;          // clinic copay
export const PIP = 2500;                   // Texas auto policies carry personal injury protection

export const INJURIES = {
  gsw_leg:   { name: 'Gunshot wound, leg', short: 'Leg GSW', icon: '🦵', hours: 72, speed: 0.6, noRun: true, cap: 80, care: 'Physical therapy' },
  gsw_arm:   { name: 'Gunshot wound, arm', short: 'Arm GSW', icon: '💪', hours: 60, aim: 2.2, cap: 85, care: 'Wound check and PT' },
  gsw_torso: { name: 'Gunshot wound, abdomen', short: 'Gut GSW', icon: '🩸', hours: 108, speed: 0.8, cap: 55, regen: 0.3, care: 'Surgical follow-up' },
  fracture:  { name: 'Broken leg', short: 'Broken leg', icon: '🦴', hours: 120, speed: 0.5, noRun: true, cap: 80, care: 'Ortho clinic and PT' },
  ribs:      { name: 'Broken ribs', short: 'Ribs', icon: '🩻', hours: 72, speed: 0.8, cap: 70, regen: 0.5, care: 'Pain management' },
  concussion:{ name: 'Concussion', short: 'Concussion', icon: '🤕', hours: 36, aim: 1.6, cap: 90, care: 'Neuro check' },
  whiplash:  { name: 'Whiplash', short: 'Whiplash', icon: '🦴', hours: 30, cap: 90, care: 'Muscle relaxers' },
};

export function ensureHealth(s) {
  s.health ??= { injuries: [], bills: [], visits: 0 };
  const h = s.health;
  h.injuries ??= []; h.bills ??= []; h.visits ??= 0;
  return h;
}

// What your injuries do to you right now.
export function healthMods(s) {
  const out = { speed: 1, aim: 1, cap: 100, regen: 1, noRun: false };
  for (const j of s?.health?.injuries || []) {
    const d = INJURIES[j.kind];
    if (!d) continue;
    out.speed = Math.min(out.speed, d.speed ?? 1);
    out.aim = Math.max(out.aim, d.aim ?? 1);
    out.cap = Math.min(out.cap, d.cap ?? 100);
    out.regen = Math.min(out.regen, d.regen ?? 1);
    out.noRun ||= !!d.noRun;
  }
  return out;
}
export const injured = s => !!s?.health?.injuries?.length;

// What sent you in. cause: 'shot' | 'crash'. sev 0..1. Returns the chart:
// injuries, how long you're in, and the itemized bill.
export function diagnose(cause, sev, rng = Math.random) {
  sev = Math.max(0, Math.min(1, sev));
  const kinds = [];
  if (cause === 'shot') {
    const r = rng();
    kinds.push(r < 0.4 ? 'gsw_leg' : r < 0.7 ? 'gsw_arm' : 'gsw_torso');
    if (sev > 0.7 && rng() < 0.5) kinds.push('ribs');
  } else {
    kinds.push(sev > 0.6 ? (rng() < 0.5 ? 'fracture' : 'ribs') : 'whiplash');
    if (sev > 0.3 && rng() < 0.6) kinds.push('concussion');
  }
  const surgery = kinds.some(k => k.startsWith('gsw') || k === 'fracture');
  const stayH = Math.round((cause === 'shot' ? 18 + sev * 30 : 6 + sev * 36) + (surgery ? 6 : 0));
  const nights = Math.max(0, Math.floor(stayH / 24));
  const items = [
    ['MedStar ambulance transport', 950],
    [cause === 'shot' ? 'Trauma team activation' : 'Emergency department, level 5', cause === 'shot' ? 2200 : 1400],
    ['CT scan', 900],
    surgery && [kinds.includes('fracture') ? 'Orthopedic surgery (rod and screws)' : 'Surgery (wound repair)', Math.round(2500 + sev * 3500)],
    stayH >= 12 && [`Inpatient room · ${Math.max(1, nights)} night${nights > 1 ? 's' : ''}`, 750 * Math.max(1, nights)],
    ['Pharmacy', 120],
  ].filter(Boolean);
  return { cause, sev, kinds, stayH, items, total: items.reduce((t, [, v]) => t + v, 0) };
}

// You're discharged: the injuries start healing and the bill goes on file.
// pip: an auto insurance payout that comes off the top.
export function admit(s, chart, { pip = 0 } = {}) {
  const h = ensureHealth(s);
  h.visits++;
  for (const kind of chart.kinds) {
    const d = INJURIES[kind], have = h.injuries.find(j => j.kind === kind);
    const mins = Math.round(d.hours * 60 * (0.7 + chart.sev * 0.6));
    if (have) { have.left += Math.round(mins * 0.6); have.total = Math.max(have.total, have.left); have.followUp = false; }   // hurt again before it healed
    else h.injuries.push({ kind, left: mins, total: mins, followUp: false });
  }
  const amount = Math.max(0, chart.total - pip);
  const bill = { id: uid('jps'), acct: 'JPS-' + String(100000 + Math.floor(Math.random() * 900000)), day: s.time.day, due: s.time.day + DUE_DAYS,
    total: chart.total, pip, balance: amount, items: chart.items, status: amount ? 'open' : 'paid', plan: null, connection: false };
  h.bills.unshift(bill);
  if (h.bills.length > 12) h.bills.length = 12;
  return bill;
}

export const openBills = s => (s?.health?.bills || []).filter(b => b.status !== 'paid' && b.balance > 0);
export const medicalDebt = s => openBills(s).reduce((t, b) => t + b.balance, 0);
export const pastDue = s => openBills(s).some(b => b.status === 'late' || b.status === 'collections' || b.status === 'judgment');
export const inCollections = b => b.status === 'collections' || b.status === 'judgment';
export const canConnect = (s, b) => !b.connection && !inCollections(b) && s.cash + s.bank < CONNECTION_LIMIT;
export const statusLabel = b => ({ open: 'Due', plan: 'Payment plan', late: 'PAST DUE', collections: 'IN COLLECTIONS', judgment: 'JUDGMENT · GARNISHING', paid: 'Paid' }[b.status] || b.status);

export function payBill(s, b, amount = b.balance) {
  amount = Math.min(Math.round(amount), b.balance);
  if (amount <= 0 || !spend(s, amount, inCollections(b) ? 'Lone Star Recovery (JPS debt)' : `JPS Health Network · ${b.acct}`)) return false;
  const was = b.status;
  b.balance -= amount;
  if (b.balance <= 0) { b.balance = 0; b.status = 'paid'; b.plan = null; }
  // paid by the due date or on the plan: that's an on-time payment on your credit (core/credit.js)
  if (was === 'plan' || (was === 'open' && b.status === 'paid')) emit('credit', { s, kind: 'ontime' });
  emit('health', { paid: amount });
  return true;
}

// JPS Connection: Tarrant County residents under the income line pay a sliver.
export function applyConnection(s, b) {
  if (!canConnect(s, b)) return false;
  b.connection = true;
  b.balance = Math.round(b.balance * CONNECTION_SHARE);
  if (b.plan) b.plan.per = Math.ceil(b.balance / Math.max(1, b.plan.left));
  if (b.status === 'late') { b.status = 'open'; b.due = s.time.day + DUE_DAYS; }
  return true;
}

// Interest-free: 10% down today, the rest auto-paid weekly.
export function startPlan(s, b) {
  if (inCollections(b) || b.plan) return false;
  const down = Math.max(25, Math.round(b.balance * PLAN_DOWN));
  if (!payBill(s, b, down)) return false;
  if (b.status === 'paid') return true;
  b.plan = { per: Math.ceil(b.balance / PLAN_WEEKS), left: PLAN_WEEKS, next: s.time.day + 7 };
  b.status = 'plan';
  return true;
}

// One game day passes. Returns notices for the shell to text you.
export function healthDay(s) {
  const h = ensureHealth(s), day = s.time.day, notes = [];
  for (const b of openBills(s)) {
    if (b.status === 'plan') {
      if (day < b.plan.next) continue;
      const amt = Math.min(b.plan.per, b.balance);
      if (canAfford(s, amt) && payBill(s, b, amt)) {
        b.plan && (b.plan.left--, b.plan.next = day + 7);
        notes.push({ from: 'jps', text: b.status === 'paid' ? `Your JPS account ${b.acct} is paid in full. Thank you.` : `Payment plan: ${fmtMoney(amt)} paid on ${b.acct}. ${fmtMoney(b.balance)} left.` });
      } else {
        b.plan = null; b.status = 'late'; b.due = day;
        emit('credit', { s, kind: 'bill_late', text: `JPS ${b.acct}` });
        notes.push({ from: 'jps', text: `Your payment plan installment on ${b.acct} bounced, so the plan is cancelled. ${fmtMoney(b.balance)} is now past due.` });
      }
    } else if (b.status === 'open' && day > b.due) {
      b.status = 'late';
      emit('credit', { s, kind: 'bill_late', text: `JPS ${b.acct}` });
      notes.push({ from: 'jps', text: `Your JPS bill (${b.acct}) is past due: ${fmtMoney(b.balance)}. Pay it, set up a payment plan, or apply for JPS Connection in the JPS Health app. Unpaid accounts go to collections.` });
    } else if (b.status === 'late' && day > b.due + COLLECTIONS_AFTER) {
      b.status = 'collections'; b.sold = day; b.plan = null;
      b.balance = Math.round(b.balance * (1 + COLLECTION_FEE));
      emit('credit', { s, kind: 'collections', text: `JPS ${b.acct}` });
      notes.push({ from: 'collections', text: `This is Lone Star Recovery Services, a debt collector. JPS placed account ${b.acct} with us. You owe ${fmtMoney(b.balance)} (includes a ${Math.round(COLLECTION_FEE * 100)}% collection fee). Pay now to avoid legal action.` });
    } else if (b.status === 'collections' && day > b.sold + SUIT_AFTER) {
      b.status = 'judgment'; b.balance += SUIT_COSTS; b.garnish = day;
      emit('credit', { s, kind: 'judgment', text: `JPS ${b.acct}` });
      notes.push({ from: 'collections', text: `You were sued in Tarrant County Justice Court, Precinct 1, and didn't answer. Default judgment: ${fmtMoney(b.balance)}. A writ of garnishment has been served on your bank account.` });
      notes.push(...garnish(s, b));
    } else if (b.status === 'judgment' && day >= b.garnish + GARNISH_EVERY) {
      b.garnish = day;
      notes.push(...garnish(s, b));
    }
  }
  return notes;
}

// The writ freezes and takes what's in the bank. Cash in your pocket is safe.
function garnish(s, b) {
  const take = Math.min(Math.max(0, Math.floor(s.bank)), b.balance);
  if (take <= 0) return [{ from: 'collections', text: `Garnishment on ${b.acct}: your bank account was empty. ${fmtMoney(b.balance)} still owed. We'll try again next week.` }];
  s.bank -= take; s.stats.expenses += take; b.balance -= take;
  emit('money', { amount: -take, label: 'Bank garnishment (JPS judgment)' });
  if (b.balance <= 0) { b.balance = 0; b.status = 'paid'; }
  return [{ from: 'collections', text: `Garnishment: ${fmtMoney(take)} taken from your bank account for ${b.acct}.${b.balance ? ` ${fmtMoney(b.balance)} still owed.` : ' Judgment satisfied.'}` }];
}

// Healing. minutes of game time pass.
export function heal(s, minutes) {
  const h = s?.health;
  if (!h?.injuries?.length) return [];
  const healed = [];
  for (const j of h.injuries) j.left -= minutes;
  h.injuries = h.injuries.filter(j => { if (j.left > 0) return true; healed.push(j); return false; });
  return healed;
}

// Clinic visit at JPS: a copay, and the injury heals twice as fast from here.
// Not while your account is past due (the ER still takes you).
export function followUp(s, j) {
  if (j.followUp || pastDue(s)) return false;
  if (!spend(s, FOLLOWUP_COST, `JPS clinic · ${INJURIES[j.kind].care}`)) return false;
  j.followUp = true;
  j.left = Math.round(j.left / 2);
  return true;
}

export const fmtLeft = mins => mins >= 1440 ? `${(mins / 1440).toFixed(mins >= 2880 ? 0 : 1)} days` : `${Math.max(1, Math.round(mins / 60))} h`;
