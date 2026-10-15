// "Ship to Texas": send Colorado weed across the state line (core/traffick.js).
// Opened from a dispensary, a grow farm's vault, or the Mile High app.

import { openPanel, bind, esc, toast, bar } from './dom.js';
import { game, fmtMoney } from '../core/state.js';
import { STRAIN_BY_ID } from '../data/weed.js';
import { METHODS, METHOD_BY_ID, SURVEIL, DECAY, stageOf, lbText } from '../data/traffick.js';
import * as T from '../core/traffick.js';
import { total, ozText } from '../core/weed.js';
import { audio } from '../core/audio.js';

const AMOUNTS = [10, 25, 50, 100, 250, 500, 1000, 1600];
const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;

// The DEA case as a card, shared with the Mile High app.
export function caseCard(s) {
  const d = T.ensureDea(s), st = stageOf(d.heat);
  return `<div class="card"><h3>🕶 The DEA case</h3>
    ${bar(d.heat, st.color === 'good' ? 'good' : st.color === 'warn' ? 'warn' : 'bad')}
    <p><b class="${st.color}">${d.hunt ? 'INDICTED' : esc(st.name)}</b> <span class="small muted">${Math.round(d.heat)}/100</span></p>
    <p class="small">${d.hunt ? 'A federal warrant is out. SWAT can box your car in anywhere, and agents can hit your house while you\'re inside. Turn yourself in at the courthouse, or keep moving.' : esc(st.blurb)}</p>
    ${!d.hunt && d.heat >= SURVEIL ? '<p class="small bad">Stay out of your houses, or be clean when you\'re in them. A raid comes in while you\'re home.</p>' : ''}
    <p class="small muted">${lbText(d.shipped)} delivered on this case · ${fmtMoney(d.earned)} from Texas · ${lbText(d.seized)} seized on the road. It cools off ${DECAY} points a day you don't send a load.</p></div>`;
}

export function openShipping(app, from = null) {
  const s = game.s;
  let src = from, oz = 50, method = 'mule', dest = 'connect';
  openPanel((root, h) => {
    const d = T.ensureDea(s), srcs = T.sources(s);
    if (!srcs.includes(src)) src = srcs.find(x => total(T.jarOf(s, x)) >= 1) || srcs[0] || null;
    const dests = T.destinations(s);
    if (!dests.includes(dest)) dest = 'connect';
    const m = METHOD_BY_ID[method], have = src ? Math.floor(total(T.jarOf(s, src))) : 0;
    const send = Math.min(oz, m.max, have);
    const q = src ? T.quote(s, src, send) : { value: 0, mix: {} };
    let body;
    if (!srcs.length) body = '<p class="muted">You don\'t own a grow farm or a dispensary in Colorado yet. Fly to Denver and buy one.</p>';
    else body = `
      <p class="muted">Legal in Colorado. A felony the second it crosses into Texas. Every load builds a federal case, and some get taken on the road.</p>
      <div class="section-title">From</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${srcs.map(x => `<button class="btn btn-sm ${x === src ? 'btn-primary' : ''}" data-action="src" data-id="${x}">${esc(T.sourceName(x))} · ${ozText(total(T.jarOf(s, x)))}</button>`).join('')}</div>
      <div class="section-title">How it travels</div>
      <div class="list">${METHODS.map(x => `<div class="li"><div class="grow"><div class="t">${x.icon} ${esc(x.name)} ${x.id === method ? '<b class="good">✓</b>' : ''}</div>
        <div class="s">${esc(x.blurb)}<br>Up to ${lbText(x.max)} · ${x.days === 1 ? 'overnight' : `${x.days} days`} · about ${Math.round(T.catchOdds(s, x.id) * 100)}% chance it gets taken</div></div>
        <button class="btn btn-sm ${x.id === method ? 'btn-primary' : ''}" data-action="method" data-id="${x.id}">Use</button></div>`).join('')}</div>
      <div class="section-title">How much</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${AMOUNTS.filter(n => n <= m.max).map(n => `<button class="btn btn-sm ${n === oz ? 'btn-primary' : ''}" data-action="oz" data-n="${n}">${lbText(n)}</button>`).join('')}
        <button class="btn btn-sm" data-action="oz" data-n="${Math.max(1, Math.min(m.max, have))}">All it holds</button></div>
      <div class="section-title">Who gets it</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${dests.map(x => `<button class="btn btn-sm ${x === dest ? 'btn-primary' : ''}" data-action="dest" data-id="${x}">${esc(T.destName(x))}</button>`).join('')}</div>
      <p class="small muted">${dest === 'connect' ? 'Primo pays cash the day it lands. Dirty cash: wash it through a business.' : 'It goes in the stash. Sell it out of the trap yourself for street prices.'}</p>
      <div class="card"><div class="kv">
        <span>Load</span><span><b>${ozText(send)}</b>${send ? ` (${esc(Object.entries(q.mix).map(([k, n]) => `${n} ${STRAIN_BY_ID[k].name}`).join(', '))})` : ''}</span>
        <span>Texas pays</span><span class="good">${fmtMoney(q.value)}</span>
        <span>Costs to send</span><span>${fmtMoney(send ? T.shipFee(method, send) : 0)}</span>
        <span>DEA attention</span><span class="bad">+${send ? T.shipHeat(method, send) : 0}</span>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn btn-danger" data-action="ship" ${send && !d.hunt ? '' : 'disabled'}>Send it · ${ozText(send)}</button></div>
      ${d.hunt ? '<p class="small bad">Nobody will move a load for you while you\'re under federal indictment.</p>' : ''}</div>`;
    const road = d.loads.length ? `<div class="section-title">On the road</div><div class="list">${d.loads.map(l => `<div class="li"><div class="grow"><div class="t">${METHOD_BY_ID[l.method].icon} ${lbText(l.oz)} → ${esc(T.destName(l.dest))}</div><div class="s">Lands day ${l.arrive}${l.dest === 'connect' ? ` · ${fmtMoney(l.value)}` : ''}</div></div></div>`).join('')}</div>` : '';
    const log = d.log.length ? `<div class="section-title">What's happened</div><div class="list">${d.log.slice(0, 8).map(e => `<div class="li"><div class="grow"><div class="s">Day ${e.day}: ${esc(e.text)}</div></div></div>`).join('')}</div>` : '';
    root.innerHTML = head('Ship to Texas', 'Colorado weed, Texas prices') + `<div class="p-body" style="max-width:760px">${caseCard(s)}${body}${road}${log}</div>`;
    bind(root, {
      close: () => h.close(),
      src: dd => { src = dd.id; h.refresh(); },
      method: dd => { method = dd.id; h.refresh(); },
      oz: dd => { oz = +dd.n; h.refresh(); },
      dest: dd => { dest = dd.id; h.refresh(); },
      ship: () => {
        const r = T.ship(s, { from: src, oz: send, method, dest });
        toast(r.text, r.ok ? 'good' : 'bad');
        if (r.ok) audio.buy(); else audio.error();
        h.refresh();
      },
    });
  });
}

