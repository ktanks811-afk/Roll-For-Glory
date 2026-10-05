// Cowtown Pay: send money to another player on your server through the bank.
//
// Money lives in each player's own save, so the server is just a mailbox
// (supabase/rfg_bank.sql): your game takes the money out of your checking
// account and leaves a transfer there; theirs picks it up the next time it
// checks (right away if they're online on the server, otherwise when they
// next play) and puts it in their checking. A transfer nobody picks up in 7
// days comes back to you. `?net=local` swaps in a same-browser copy.

import { game, fmtMoney, gameTimeStr } from '../core/state.js';
import { emit } from '../core/events.js';
import { sendMessage } from '../core/story.js';
import { online, SERVER_BY_ID } from './online.js';
import { rpc, me, deeds } from './deeds.js';

export const PAY_MAX = 1000000;
const CHECK_EVERY = 45000;   // ms between mailbox checks while you play
const cleanName = n => String(n ?? '').replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || 'Racer';
const cleanMemo = m => String(m ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);

const remote = {
  roster: server => rpc('rfg_server_roster', { p_server: server }).then(r => (Array.isArray(r) ? r : [])),
  send: (u, to, amount, memo) => rpc('rfg_pay_send', { p_uid: u.uid, p_tok: u.tok, p_to: to, p_amount: amount, p_memo: memo }),
  inbox: u => rpc('rfg_pay_inbox', { p_uid: u.uid, p_tok: u.tok }),
};

// Same rules in localStorage (members come from the local deed registry).
const LKEY = 'rfg-localpay', DKEY = 'rfg-localdeeds';
const local = {
  load() { try { return { list: [], n: 0, ...JSON.parse(localStorage.getItem(LKEY) || '{}') }; } catch { return { list: [], n: 0 }; } },
  save(d) { localStorage.setItem(LKEY, JSON.stringify(d)); },
  members() { try { return JSON.parse(localStorage.getItem(DKEY) || '{}').members || {}; } catch { return {}; } },
  async roster(server) { return Object.values(this.members()).filter(m => m.server === server).map(({ uid, name }) => ({ uid, name })); },
  async send(u, to, amount, memo) {
    const ms = this.members(), m = ms[u.uid], r = ms[to];
    if (!m || m.tok !== u.tok) throw new Error('Pick a home server first');
    if (to === u.uid) throw new Error('You can\'t send money to yourself');
    if (!r || r.server !== m.server) throw new Error('That player isn\'t on your server');
    const d = this.load();
    d.list.push({ id: ++d.n, from_uid: u.uid, from_name: m.name, to_uid: to, to_name: r.name, amount, memo, status: 'sent', at: Date.now() });
    this.save(d);
    return { ok: true, id: d.n, to: r.name };
  },
  async inbox(u) {
    const m = this.members()[u.uid];
    if (!m || m.tok !== u.tok) return { in: [], back: [] };
    const d = this.load(), got = [], back = [];
    for (const t of d.list) {
      if (t.status !== 'sent') continue;
      if (t.to_uid === u.uid) { t.status = 'claimed'; got.push(t); }
      else if (t.from_uid === u.uid && Date.now() - t.at > 7 * 864e5) { t.status = 'returned'; back.push(t); }
    }
    this.save(d);
    return { in: got, back };
  },
};

function ensurePay(s) {
  s.pay ??= {};
  s.pay.log ??= [];     // { day, t, dir: 'in' | 'out' | 'back', name, amount, memo }
  return s.pay;
}
function logPay(s, e) {
  const p = ensurePay(s);
  p.log.unshift({ day: s.time.day, t: gameTimeStr(s.time), ...e });
  if (p.log.length > 30) p.log.length = 30;
}
function toBank(s, amount, label) {
  s.bank += amount;
  s.ledger.unshift({ day: s.time.day, t: gameTimeStr(s.time), label, amount });
  if (s.ledger.length > 100) s.ledger.length = 100;
}

class Pay {
  constructor() {
    this.busy = false;
    this.roster = [];
    this.timer = null;
    online.on((ev, m) => { if (ev === 'pay' && game.s && m?.u === game.s.uid) this.check(game.s); });
  }
  get db() { return online.kind === 'local' ? local : remote; }

  // Players on your server you can pay (not you).
  async players(s) {
    if (!s.homeServer || !SERVER_BY_ID[s.homeServer]) return [];
    me(s);
    const rows = await this.db.roster(s.homeServer);
    this.roster = rows.filter(r => r && r.uid !== s.uid).map(r => ({ uid: String(r.uid).slice(0, 16), name: cleanName(r.name) }));
    return this.roster;
  }

  // Send `amount` from your checking to player `to` ({ uid, name }).
  async send(s, to, amount, memo = '') {
    amount = Math.round(amount);
    memo = cleanMemo(memo);
    if (!s.homeServer) return { ok: false, text: 'Pick a home server in Online first. You can pay players on your server.' };
    if (!to?.uid) return { ok: false, text: 'Pick who to pay.' };
    if (!(amount >= 1)) return { ok: false, text: 'Enter an amount.' };
    if (amount > PAY_MAX) return { ok: false, text: `Cowtown Pay tops out at ${fmtMoney(PAY_MAX)} a transfer.` };
    if (amount > s.bank) return { ok: false, text: `You only have ${fmtMoney(s.bank)} in checking. Deposit cash first.` };
    // take it out first so a double tap can't spend it twice
    s.bank -= amount;
    try {
      let r;
      try { r = await this.db.send(me(s), to.uid, amount, memo); }
      catch (e) {
        // not registered on the server yet (new install): check in and try once more
        if (!/home server/i.test(e.message)) throw e;
        const j = await deeds.join(s, s.homeServer);
        if (!j.ok || j.offline) throw e;
        r = await this.db.send(me(s), to.uid, amount, memo);
      }
      const name = cleanName(r?.to || to.name);
      s.stats.expenses += amount;
      s.ledger.unshift({ day: s.time.day, t: gameTimeStr(s.time), label: `Cowtown Pay to ${name}${memo ? ` · ${memo}` : ''}`, amount: -amount });
      logPay(s, { dir: 'out', name, amount, memo });
      online.send({ k: 'pay', u: to.uid });
      emit('money', { amount: -amount, label: `Sent to ${name}` });
      return { ok: true, text: `Sent ${fmtMoney(amount)} to ${name}.` };
    } catch (e) {
      s.bank += amount;
      return { ok: false, text: e.message || 'The transfer didn\'t go through.' };
    }
  }

  // Pick up money sent to you, and anything of yours that bounced back.
  async check(s) {
    if (!s?.homeServer || this.busy || !s.uid || !s.crewKey) return [];
    this.busy = true;
    const out = [];
    try {
      const r = await this.db.inbox(me(s));
      for (const t of Array.isArray(r?.in) ? r.in : []) {
        const amount = Math.round(+t.amount);
        if (!(amount > 0 && amount <= PAY_MAX)) continue;
        const name = cleanName(t.from_name), memo = cleanMemo(t.memo);
        toBank(s, amount, `Cowtown Pay from ${name}${memo ? ` · ${memo}` : ''}`);
        s.stats.earnings += amount;
        logPay(s, { dir: 'in', name, amount, memo });
        sendMessage(s, 'cowpay', `${name} sent you ${fmtMoney(amount)}${memo ? `: "${memo}"` : ''}. It's in your checking account.`);
        emit('money', { amount, label: `Cowtown Pay from ${name}` });
        out.push({ dir: 'in', name, amount });
      }
      for (const t of Array.isArray(r?.back) ? r.back : []) {
        const amount = Math.round(+t.amount);
        if (!(amount > 0 && amount <= PAY_MAX)) continue;
        const name = cleanName(t.to_name);
        toBank(s, amount, `Cowtown Pay returned (${name} never picked it up)`);
        s.stats.expenses -= amount;
        logPay(s, { dir: 'back', name, amount, memo: cleanMemo(t.memo) });
        sendMessage(s, 'cowpay', `${name} didn't pick up the ${fmtMoney(amount)} you sent in 7 days, so it's back in your checking account.`);
        out.push({ dir: 'back', name, amount });
      }
    } catch { /* offline: try again next time */ }
    finally { this.busy = false; }
    return out;
  }

  // Check the mailbox now and then while a career is loaded.
  start() {
    if (this.timer) return;
    const tick = () => { if (game.s) this.check(game.s); };
    this.timer = setInterval(tick, CHECK_EVERY);
    setTimeout(tick, 3000);
  }
}

export const pay = new Pay();
export { ensurePay };
