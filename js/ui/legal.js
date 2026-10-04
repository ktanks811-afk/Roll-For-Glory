// Lawyers and snitches on screen: picking a defense attorney (at booking, at
// your hearing or from the phone) and the Lawyer phone app, which shows your
// case and who's defending it, your retainer, your people sitting in county
// and who's been talking. Rules live in core/legal.js.

import { bind, esc, toast, modal } from './dom.js';
import { fmtMoney, canAfford } from '../core/state.js';
import { LAWYERS, LAWYER_IDS } from '../data/lawyers.js';
import { CLASSES, openCase, lawyerOf, courtName, fmtCourt, topClass, bailFor } from '../core/justice.js';
import * as LG from '../core/legal.js';

const pct = n => `${Math.round(n * 100)}%`;
// What a lawyer does for you, in one line.
export function perks(L) {
  return [`bail ${pct(L.bail)} lower`, L.reduce ? 'pleads the top charge down a class' : 'a better plea deal', `${Math.round(L.trial * 100)} pts better odds at trial`, L.discovery && 'finds out who snitched', L.bond && 'can get you a bond when you\'re held'].filter(Boolean).join(' · ');
}

// The lawyers who could take this case (better than the one you have).
export const upgrades = c => LAWYER_IDS.filter(id => !lawyerOf(c) || LAWYERS[id].fee > lawyerOf(c).fee);

// Pick a lawyer for the case. Resolves the lawyer id hired, or null.
export async function pickLawyer(s, c, title = 'Call a lawyer') {
  const ids = upgrades(c);
  if (!ids.length) return null;
  const pick = await modal(title, `<p class="small muted">Cause No. ${c.cause} · top charge: ${CLASSES[topClass(c.charges)].short}</p>
    <div class="list">${ids.map(id => { const L = LAWYERS[id]; return `<div class="li"><span>⚖</span><div class="grow"><div class="t">${esc(L.name)} · ${fmtMoney(LG.caseFee(s, c, id))}</div><div class="s">${esc(L.firm)}, ${esc(L.where)}. ${esc(L.blurb)}</div><div class="s good">${esc(perks(L))}</div></div></div>`; }).join('')}</div>
    <p class="small muted">The fee is for this case, paid up front. Keep a lawyer on retainer in the Lawyer app and they take new cases for free.</p>`,
    [...ids.filter(id => canAfford(s, LG.caseFee(s, c, id))).map(id => ({ label: `Hire ${LAWYERS[id].name} · ${fmtMoney(LG.caseFee(s, c, id))}`, primary: false, value: id })), { label: 'Never mind', value: null }]);
  if (!pick) return null;
  const e = LG.hireForCase(s, c, pick);
  if (e) { toast(e, 'bad'); return null; }
  toast(`${LAWYERS[pick].name} is on your case.`, 'good');
  return pick;
}

const head = title => `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>${esc(title)}</h2></div>`;

export function renderLegal(scr, ctx) {
  const s = ctx.s, c = openCase(s), L = lawyerOf(c), n = LG.ensureInformants(s);
  const ret = LG.retainerActive(s), disc = LG.discoveryLawyer(s);
  const named = c && disc ? LG.informantsOn(c) : [];
  const caseHtml = c ? `<div class="li"><span>⚖</span><div class="grow"><div class="t">${esc(courtName(c))} · Cause No. ${c.cause}</div>
      <div class="s">${c.charges.length} charge${c.charges.length > 1 ? 's' : ''}, top: ${CLASSES[topClass(c.charges)].short} · ${c.fta ? '<b class="bad">you missed court</b>' : `court ${fmtCourt(c.date)}`}</div>
      <div class="s">Defense: <b>${L ? `${esc(L.name)}${c.retained ? ' (on retainer)' : ''}` : 'public defender'}</b>${c.bond?.type === 'cash' && !L ? ' · a lawyer can get your cash bail reduced' : ''}</div>
      ${c.charges.some(x => x.ci) ? `<div class="s warn">Part of the case comes from an informant${named.length ? `: <b>${named.map(esc).join(', ')}</b>` : '. A lawyer with discovery can find out who'}.</div>` : ''}</div></div>
      ${upgrades(c).length ? `<button class="btn btn-primary btn-sm" data-action="hire">${L ? 'Trade up your lawyer' : 'Hire a lawyer for this case'}</button>` : ''}`
    : '<p class="small muted">No open case. Keep it that way, or keep a lawyer on call.</p>';
  const retHtml = LAWYER_IDS.map(id => {
    const X = LAWYERS[id], on = ret?.id === id;
    return `<div class="li" ${on ? 'style="border-color:#ffc21a"' : ''}><div class="grow"><div class="t">${esc(X.name)} · ${fmtMoney(X.retainer)}/week</div><div class="s">${esc(X.firm)} · ${esc(perks(X))}</div>${on ? `<div class="s good">On retainer through day ${ret.until}. Renews from your account.</div>` : ''}</div>
      ${on ? '<button class="btn btn-sm" data-action="drop">Drop</button>' : `<button class="btn btn-sm" data-action="retain" data-id="${id}">Retain</button>`}</div>`;
  }).join('');
  const heldHtml = n.held.length ? n.held.map(e => `<div class="li" data-held="${e.id}"><span>🔒</span><div class="grow"><div class="t">${esc(e.name)} <span class="tag">${CLASSES[e.cls]?.short || ''}</span></div>
      <div class="s">${e.kind === 'worker' ? `Your trap worker · in on ${esc(e.why)}` : e.codef ? 'Booked with you' : `Your homie · in on ${esc(e.why)}`} · out day ${e.out}</div>
      <div class="s">${e.decided ? 'Detectives already sat him down. He held it down.' : `Detectives sit him down ${e.talkAt <= s.time.day ? 'today' : 'tomorrow morning'}. ${LG.talkChance(s, e) >= 0.35 ? '<b class="bad">He sounds shook.</b>' : LG.talkChance(s, e) >= 0.18 ? 'He sounds nervous.' : 'He sounds solid.'}`}${e.lawyer ? ' · has a lawyer' : ''}${e.books ? ` · $${e.books * LG.BOOKS} on his books` : ''}</div>
      <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn btn-sm btn-primary" data-action="bail" data-id="${e.id}">Bail out · ${fmtMoney(LG.bailCost(e))}</button>
      ${e.lawyer ? '' : `<button class="btn btn-sm" data-action="lawyer" data-id="${e.id}">Send a lawyer · ${fmtMoney(LG.lawyerCost(e))}</button>`}
      ${e.books < LG.BOOKS_MAX ? `<button class="btn btn-sm" data-action="books" data-id="${e.id}">Books · ${fmtMoney(LG.BOOKS)}</button>` : ''}</div></div></div>`).join('')
    : '<p class="small muted">Nobody of yours is locked up.</p>';
  const talkHtml = n.talked.length ? n.talked.slice(0, 6).map(t => `<div class="li"><span>🐀</span><div class="grow"><div class="t">${t.heard || disc ? esc(t.name) : 'Somebody'} talked</div><div class="s">Day ${t.day} · ${t.what.map(esc).join(' ')}</div></div></div>`).join('') : '';
  scr.innerHTML = head('Lawyer') + `<div class="app-body">
    <div class="section-title">Your case</div>${caseHtml}
    <div class="section-title">Locked up · ${n.held.length}</div><div class="list">${heldHtml}</div>
    ${talkHtml ? `<div class="section-title">Who talked</div><div class="list">${talkHtml}</div>${disc ? '' : '<p class="small muted">A lawyer with discovery would tell you who.</p>'}` : ''}
    <div class="section-title">Retainer</div><div class="list">${retHtml}</div>
    ${n.marked ? '<p class="small bad">The streets know you cooperated with the DA.</p>' : ''}
    <p class="small muted">Your homies and trap workers know what you've done. When one gets booked, detectives lean on him the next morning. Bail him out and he comes home; a lawyer and money on his books make him less likely to fold. If he talks, there's a felony warrant with your name on it.</p></div>`;
  const run = fn => d => { const e = fn(s, d.id); if (e) toast(e, 'bad'); ctx.h.refresh(); };
  bind(scr, {
    back: () => ctx.go(null),
    hire: async () => { await pickLawyer(s, c); ctx.h.refresh(); },
    retain: run(LG.setRetainer),
    drop: () => { LG.dropRetainer(s); ctx.h.refresh(); },
    bail: run(LG.bailOut),
    lawyer: run(LG.sendLawyer),
    books: run(LG.putOnBooks),
  });
}

// For the magistrate: the line about your lawyer.
export function bailLawyerLine(s, c) {
  const L = lawyerOf(c);
  if (!L) return '';
  const b = bailFor(s, c);
  return `<p class="small good">${esc(L.name)} is standing next to you${c.retained ? ' (on retainer)' : ''}${b.hearing ? ' and argued you into a bond' : ''}: bail ${pct(L.bail)} lower.</p>`;
}
