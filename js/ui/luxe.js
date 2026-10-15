// Luxe: the phone app for spending real money. Watches, ice, designer, art,
// collectibles, toys for the house, helicopters and jets. Some of it is an
// investment (watches, art and cards move with their market), some of it is
// a flex, and the aircraft change how you get around. Rules: core/luxury.js.

import { openPanel, bind, esc, toast, confirm } from './dom.js';
import { game, fmtMoney, spend, earn, canAfford } from '../core/state.js';
import { LUX, LUX_BY_ID, LUX_CATS } from '../data/luxury.js';
import { ensureLux, priceOf, valueOf, buyLux, sellLux, luxTotal, luxPerks, marketTrend, flexOf } from '../core/luxury.js';
import { fleet, resaleOf, boatName } from '../core/boats.js';
import { saveGame } from '../core/save.js';
import { audio } from '../core/audio.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const ICON = Object.fromEntries(LUX_CATS.map(c => [c.id, c.icon]));
// a different backdrop per category so the grid reads at a glance
const BG = { watch: 'linear-gradient(135deg,#1a1a1d,#3a3326)', jewelry: 'linear-gradient(135deg,#0e1a2a,#2a4a6a)', fashion: 'linear-gradient(135deg,#2a1a12,#5a3a22)', art: 'linear-gradient(135deg,#2a0e2a,#5a1a4a)', collect: 'linear-gradient(135deg,#0e2a1a,#1a5a3a)', home: 'linear-gradient(135deg,#2a2a12,#4a4a1a)', air: 'linear-gradient(135deg,#0e1e2e,#3a6a9a)' };

export function openLuxe(app, tab0 = 'watch') {
  const s = game.s;
  ensureLux(s);
  let tab = tab0;
  openPanel((root, h) => {
    const mine = s.lux.items, perks = luxPerks(s);
    let body = '';
    if (tab === 'mine') {
      const boats = fleet(s).reduce((t, b) => t + resaleOf(s, b), 0);
      body = `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
          <div class="card"><div class="small muted">Collection</div><h3>${fmtMoney(luxTotal(s))}</h3></div>
          <div class="card"><div class="small muted">Boats</div><h3>${fmtMoney(boats)}</h3></div>
          <div class="card"><div class="small muted">Cash + bank</div><h3>${fmtMoney(s.cash + s.bank)}</h3></div></div>
        ${perks.heli || perks.jet ? `<div class="section-title">Perks</div><p class="small">${perks.heli ? '🚁 Your helicopter: teleports are free and take a third of the time.<br>' : ''}${perks.jet ? `🛩 Your jet: flights are free and twice as fast${perks.carFree ? ', and your car rides free' : ''}.` : ''}</p>` : ''}
        <div class="section-title">What you own</div>
        ${mine.length ? `<div class="list">${mine.map(o => { const it = LUX_BY_ID[o.id], v = valueOf(s, o), pl = v - o.paid; return `<div class="li"><div style="font-size:26px">${ICON[it.cat]}</div><div class="grow"><div class="t">${esc(it.brand)} ${esc(it.name)}</div><div class="s">Paid ${fmtMoney(o.paid)} · worth ${fmtMoney(v)} <b class="${pl >= 0 ? 'good' : 'bad'}">${pl >= 0 ? '+' : ''}${fmtMoney(pl)}</b></div></div><button class="btn btn-sm" data-action="sell" data-uid="${o.uid}">Sell</button></div>`; }).join('')}</div>` : '<p class="muted">Nothing yet. Go shopping.</p>'}
        ${fleet(s).length ? `<div class="section-title">Boats</div><div class="list">${fleet(s).map(b => `<div class="li"><div style="font-size:26px">🛥</div><div class="grow"><div class="t">${esc(boatName(b))}</div><div class="s">Worth about ${fmtMoney(resaleOf(s, b))}</div></div></div>`).join('')}</div>` : ''}`;
    } else {
      const tr = marketTrend(s, tab), list = LUX.filter(x => x.cat === tab);
      const moves = ['watch', 'art', 'collect'].includes(tab);
      body = `${moves ? `<p class="small muted">This market is ${tr > 0.004 ? '<b class="good">up</b>' : tr < -0.004 ? '<b class="bad">down</b>' : 'flat'} this week. Prices move every Monday; pieces you hold ${tab === 'watch' ? 'hold their value' : 'can climb over time'}.</p>` : tab === 'air' ? '<p class="small muted">Aircraft change how you travel: a helicopter makes teleports free and fast, a jet makes flights free and fast.</p>' : '<p class="small muted">Every buy gets posted. Followers love a flex.</p>'}
        <div class="grid">${list.map(it => { const p = priceOf(s, it), n = mine.filter(o => o.id === it.id).length; return `<div class="card">
          <div style="height:86px;border-radius:8px;background:${BG[it.cat]};display:flex;align-items:center;justify-content:center;font-size:46px;margin-bottom:8px">${ICON[it.cat]}</div>
          <div class="small muted">${esc(it.brand)}</div><h3>${esc(it.name)}</h3><p class="muted small">${esc(it.desc || '')}</p>
          <p class="small">+${flexOf(it).toLocaleString()} followers${n ? ` · <b class="good">you own ${n}</b>` : ''}</p>
          <div class="row" style="justify-content:space-between;margin-top:8px"><b>${fmtMoney(p)}</b>
          <button class="btn btn-sm btn-primary" data-action="buy" data-id="${it.id}" ${canAfford(s, p) ? '' : 'disabled'}>Buy</button></div></div>`; }).join('')}</div>`;
    }
    root.innerHTML = head('Luxe', 'For when the money stops meaning anything') + `<div class="chips" style="padding:8px 12px 4px">${[...LUX_CATS.map(c => [c.id, `${c.icon} ${c.name}`]), ['mine', '💼 My collection']].map(([id, l]) => `<button class="chip ${tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${l}</button>`).join('')}</div>
      <div class="p-body" style="max-width:1000px;padding-top:6px">${body}</div>`;
    bind(root, {
      close: () => h.close(),
      tab: d => { tab = d.id; h.refresh(); },
      buy: async d => {
        const it = LUX_BY_ID[d.id], p = priceOf(s, it);
        if (!await confirm(`${it.brand} ${it.name}`, `<p>${fmtMoney(p)}.${it.perk ? ` <b>${esc(it.desc)}</b>` : ''}</p><p class="small muted">Resells for about ${Math.round(it.keep * 100)}% to start${it.grow ? ', and it can appreciate' : ''}.</p>`, 'Buy it')) return;
        const r = buyLux(s, d.id, spend);
        if (!r.ok) { toast(r.text, 'bad'); audio.error?.(); return; }
        audio.buy?.();
        toast(`💎 ${it.brand} ${it.name}. +${r.flex.toLocaleString()} followers off the post.`, 'good');
        s.feed?.unshift?.({ id: 'post' + Date.now().toString(36), mine: true, day: s.time.day, t: '', text: `Just copped the ${it.brand} ${it.name} ${ICON[it.cat]}`, likes: Math.round(r.flex * 3), comments: [] });
        saveGame('auto', true); h.refresh();
      },
      sell: async d => {
        const o = s.lux.items.find(x => x.uid === d.uid), it = LUX_BY_ID[o.id];
        if (!await confirm(`Sell the ${it.brand} ${it.name}?`, `<p>A buyer pays <b>${fmtMoney(valueOf(s, o))}</b> today.</p>`, 'Sell', true)) return;
        const r = sellLux(s, d.uid, earn);
        if (r.ok) { toast(`Sold for ${fmtMoney(r.paid)}.`, 'good'); saveGame('auto', true); h.refresh(); }
      },
    });
  });
}
