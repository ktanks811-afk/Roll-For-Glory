// The Joshua Livestock Auction, and the stock-trailer block on the ranch
// screen. Rules: core/livestock.js.

import { openPanel, bind, esc, toast } from './dom.js';
import { game, fmtMoney, spend, earn, canAfford } from '../core/state.js';
import { LOC_BY_ID } from '../data/world.js';
import { HAULED, COMMISSION, stockOn, headOn, stockRig, roomOn, haulBlock, loadStock, unloadStock, buyPrice, sellPrice, marketRate, sellStock, buyStock } from '../core/livestock.js';
import { herd, penCount, penCap } from '../core/estate.js';
import { saveGame } from '../core/save.js';
import { audio } from '../core/audio.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const pic = '<div style="background:#111;border-radius:8px;padding:8px;margin-bottom:8px"><img src="img/trailers/stock-gooseneck-side.png" alt="" style="width:100%;max-height:110px;object-fit:contain;display:block"></div>';

// Is the truck with the stock trailer out in the world near this place?
// (Without a world, as in tests, any place counts.)
export function rigNear(app, loc, r = 160) {
  const v = app?.world?.vehicle;
  if (!app?.world) return true;
  if (!v || !loc) return false;
  const L = loc.lot;
  const dx = L ? Math.max(L.x0 - v.x, 0, v.x - L.x1) : v.x - loc.x, dz = L ? Math.max(L.z0 - v.z, 0, v.z - L.z1) : v.z - loc.z;
  return Math.hypot(dx, dz) < r;
}

const trend = f => f >= 1.15 ? '<b class="good">▲ high</b>' : f <= 0.95 ? '<b class="bad">▼ low</b>' : '<span class="muted">steady</span>';
const done = (r, h) => {
  if (!r.ok) { toast(r.text, 'bad'); audio.error?.(); return false; }
  toast(r.text, 'good'); audio.buy?.(); saveGame('auto', true); h.refresh(); return true;
};

export function openSaleBarn(loc, app) {
  const s = game.s;
  openPanel((root, h) => {
    const rig = stockRig(s), why = haulBlock(s), here = rigNear(app, loc), st = stockOn(s), room = roomOn(s);
    const ready = rig && here;
    root.innerHTML = head(loc.name, 'Sale every day · Johnson County') + `<div class="p-body" style="max-width:820px">
      ${pic}
      <p class="muted small">"Back her up to the chute." Today's prices come off the board. Selling, the barn keeps ${Math.round(COMMISSION * 100)}%. Bring cattle in on a stock trailer, or buy here and haul them home.</p>
      ${ready ? `<div class="stats-row"><div><div class="stat-lbl">On your trailer</div><b>${headOn(s)} / ${rig.def.head} head</b></div><div><div class="stat-lbl">Room</div><b>${room}</b></div></div>`
        : `<div class="li"><span>🚚</span><div class="grow"><div class="t">${why ? esc(why) : 'Pull your truck and stock trailer up to the barn.'}</div><div class="s">Buy the 24 ft stock trailer at Cowtown Trailer &amp; Truck Sales and hitch it to a truck or the Peterbilt at home.</div></div></div>`}
      <div class="section-title">Today's board</div>
      <div class="list">${HAULED.map(A => {
        const k = st[A.id] || 0, f = marketRate(s, A.id), buy = buyPrice(s, A.id), sell = sellPrice(s, A.id);
        return `<div class="li"><span style="font-size:22px">${A.icon}</span><div class="grow"><div class="t">${esc(A.name)}${k ? ` <span class="tag">${k} on the trailer</span>` : ''}</div>
          <div class="s">Buy ${fmtMoney(buy)} · you get ${fmtMoney(sell)} a head · ${trend(f)} <span class="muted">(ranch sells back at ${fmtMoney(Math.round(A.price * 0.6))})</span></div></div>
          <div style="text-align:right;white-space:nowrap">${k && ready ? `<button class="btn btn-sm btn-primary" data-action="sell" data-id="${A.id}" data-n="${k}">Sell ${k} · ${fmtMoney(sell * k)}</button> ` : ''}${ready ? `<button class="btn btn-sm" data-action="buy" data-id="${A.id}" data-n="1" ${room && canAfford(s, buy) ? '' : 'disabled'}>Buy 1</button> <button class="btn btn-sm" data-action="buy" data-id="${A.id}" data-n="${Math.min(5, room) || 5}" ${room && canAfford(s, buy * Math.min(5, room)) ? '' : 'disabled'}>Buy ${Math.min(5, room) || 5}</button>` : ''}</div></div>`;
      }).join('')}</div>
      <p class="small muted">Prices move every day. Haul when the board says high, buy when it says low.</p></div>`;
    bind(root, {
      close: () => h.close(),
      sell: d => done(sellStock(s, d.id, +d.n, earn), h),
      buy: d => done(buyStock(s, d.id, +d.n, spend), h),
    });
  });
}

// The stock-trailer block on the ranch screen: '' unless your rig is here.
export function ranchTrailerHtml(s, app, landId) {
  const rig = stockRig(s);
  if (!rig || !rigNear(app, LOC_BY_ID[landId])) return '';
  const st = stockOn(s), hd = herd(s, landId), room = roomOn(s), pen = penCap(s, landId) - penCount(s, landId);
  const rows = HAULED.filter(A => (hd[A.id] || 0) || (st[A.id] || 0)).map(A => {
    const inPen = hd[A.id] || 0, on = st[A.id] || 0;
    return `<div class="li"><span style="font-size:22px">${A.icon}</span><div class="grow"><div class="t">${esc(A.name)}</div><div class="s">${inPen} in the pasture · ${on} on the trailer</div></div>
      <div style="text-align:right;white-space:nowrap">${inPen && room ? `<button class="btn btn-sm btn-primary" data-action="haulload" data-id="${A.id}" data-n="${Math.min(inPen, room)}">Load ${Math.min(inPen, room)}</button>` : ''}${on && pen > 0 ? ` <button class="btn btn-sm" data-action="haulunload" data-id="${A.id}">Turn out ${Math.min(on, pen)}</button>` : ''}</div></div>`;
  }).join('');
  return `<div class="section-title">🚚 Stock trailer</div>
    <p class="muted small">Your ${esc(rig.def.name)} is backed up to the gate: ${headOn(s)} of ${rig.def.head} head on board. Haul them to the Joshua Livestock Auction on FM 4 to sell at today's price.</p>
    <div class="list">${rows || '<div class="empty">Nothing to load. Buy cattle here or at the sale barn.</div>'}</div>`;
}
export const ranchTrailerActions = (s, landId, h) => ({
  haulload: d => done(loadStock(s, landId, d.id, +d.n), h),
  haulunload: d => done(unloadStock(s, landId, d.id), h),
});
