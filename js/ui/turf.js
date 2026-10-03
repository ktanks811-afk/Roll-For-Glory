// Phone app: Turf. Who runs each Fort Worth neighborhood, your crew's hold on
// its own, the street tax it pays, and the buttons to claim open turf or start
// a turf war on a rival's. Rules live in core/turf.js.

import { bind, esc, toast } from './dom.js';
import { fmtMoney } from '../core/state.js';
import { RACER_BY_ID } from '../data/npcs.js';
import { HOODS, HOOD_BY_ID, ensureTurf, myKey, ownerInfo, dailyTake, myHoods, warBlocked, startWar, hoodOf, CLAIM_SECS } from '../core/turf.js';

const head = title => `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>${esc(title)}</h2></div>`;

function map(s, here, me) {
  const t = ensureTurf(s);
  const cells = HOODS.map(h => {
    const [x0, x1, z0, z1] = h.box, st = t.hoods[h.id], o = ownerInfo(s, st.owner);
    const hot = t.war?.hood === h.id || t.attack?.hood === h.id;
    const label = (h.short || h.id).toUpperCase(), tall = z1 - z0 > 2 * (x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, size = Math.round(Math.min(150, ((tall ? z1 - z0 : x1 - x0) - 60) / (label.length * 0.72)));
    return `<rect x="${x0}" y="${z0}" width="${x1 - x0}" height="${z1 - z0}" fill="${o.color}" fill-opacity="${st.owner ? 0.25 + st.hold / 250 : 0.12}" stroke="${hot ? '#ff2a3a' : here === h.id ? '#fff' : '#0b0c0f'}" stroke-width="${hot || here === h.id ? 36 : 18}"${hot ? ' stroke-dasharray="80 50"' : ''}/>
      <text x="${cx}" y="${cz}" fill="#fff" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="middle"${tall ? ` transform="rotate(-90 ${cx} ${cz})"` : ''}>${esc(label)}</text>`;
  }).join('');
  return `<svg viewBox="-2700 -1000 5400 3000" style="width:100%;height:auto;background:#101114;border:1px solid #2a2c33;border-radius:6px;display:block" role="img" aria-label="Turf map">
    <rect x="1000" y="190" width="1700" height="860" fill="#123a5c"/><text x="1850" y="620" fill="#7fa8c9" font-size="110" text-anchor="middle">LAKE WORTH</text>
    ${cells}${me ? `<circle cx="${me.x}" cy="${me.z}" r="60" fill="#ff2a3a" stroke="#fff" stroke-width="18"/>` : ''}</svg>`;
}

export function renderTurf(scr, ctx) {
  const s = ctx.s, w = ctx.app.world;
  const t = ensureTurf(s), k = myKey(s);
  const p = w ? w.playerState() : null, here = p ? hoodOf(p.x, p.z)?.id : null;
  const mine = myHoods(s);
  const alert = [];
  if (t.attack) {
    const a = t.attack, r = RACER_BY_ID[a.npcId];
    alert.push(`<div class="li" style="border-color:#ff2a3a"><div class="grow"><div class="t">⚠ ${esc(ownerInfo(s, a.crew).name)} are moving on ${esc(a.hood)}</div><div class="s">Beat ${esc(r.name)} "${esc(r.nick)}" by Day ${a.expires} or they take it. Accept their text in Messages.</div></div><button class="btn btn-sm btn-primary" data-action="msgs">Messages</button></div>`);
  }
  if (t.war) {
    const wr = t.war, r = RACER_BY_ID[wr.npcId];
    alert.push(`<div class="li" style="border-color:#ffc21a"><div class="grow"><div class="t">Turf war: ${esc(wr.hood)} (${t.hoods[wr.hood].hold}% held by ${esc(ownerInfo(s, wr.crew).name)})</div><div class="s">Next up: ${esc(r.name)} "${esc(r.nick)}", by Day ${wr.expires}. Each win knocks their hold down by half.</div></div><button class="btn btn-sm btn-primary" data-action="msgs">Messages</button></div>`);
  }
  const summary = k
    ? `<p class="small"><b style="color:${esc(ownerInfo(s, k).color)}">${esc(ownerInfo(s, k).name)}</b> holds ${mine.length} of ${HOODS.length} hoods${mine.length ? ` · ${fmtMoney(dailyTake(s))} a day${s.crew.npcCrew ? ' (your cut)' : ''} in street tax` : ''}.</p>`
    : '<p class="small warn">You need a crew to claim turf. Join one or start your own in the Crew app.</p>';
  const rows = HOODS.map(h => {
    const st = t.hoods[h.id], o = ownerInfo(s, st.owner);
    const why = warBlocked(s, h.id);
    let btn;
    if (o.mine) btn = '<span class="tag tag-green">Yours</span>';
    else if (!st.owner) btn = `<button class="btn btn-sm ${k ? 'btn-primary' : ''}" data-action="claim" data-id="${esc(h.id)}" ${k ? '' : 'disabled'}>Claim</button>`;
    else btn = `<button class="btn btn-sm ${why ? '' : 'btn-primary'}" data-action="war" data-id="${esc(h.id)}" ${why ? 'disabled' : ''}>Turf war</button>`;
    const status = !st.owner ? (st.claim > 0 && k ? `Open · you've repped it ${Math.floor(st.claim)}%` : 'Open, nobody runs it') : `${esc(o.name)} · ${st.hold}% hold`;
    return `<div class="li" data-hood="${esc(h.id)}"><span class="avatar" style="background:${esc(o.color)};width:22px;height:22px"></span><div class="grow"><div class="t">${esc(h.id)}${h.aka ? ` <span class="muted small">(${esc(h.aka)})</span>` : ''}${here === h.id ? ' 📍' : ''}</div>
      <div class="s">${status} · ${fmtMoney(h.take)}/day${why && st.owner && !o.mine && k ? ` · ${esc(why)}` : ''}</div></div>${btn}</div>`;
  }).join('');
  scr.innerHTML = head('Turf') + `<div class="app-body">${map(s, here, p)}${summary}${alert.join('')}
    <div class="section-title">Neighborhoods</div><div class="list">${rows}</div>
    <p class="small muted">Open turf: drive around in it for about ${CLAIM_SECS} seconds with your crew behind you. Rival turf: start a turf war and beat their members in challenge races until their hold breaks. Rivals will come for yours too, so answer their texts.</p></div>`;
  bind(scr, {
    back: () => ctx.go(null),
    msgs: () => ctx.go('messages'),
    claim: d => {
      const h = HOOD_BY_ID[d.id];
      if (w) { w.setGps(h.c[0], h.c[1], `Claim ${h.id}`); ctx.h.close(); } else toast(`Drive into ${h.id} to claim it.`, 'info');
    },
    war: d => {
      const why = startWar(s, d.id);
      if (why) toast(why, 'bad');
      ctx.h.refresh();
    },
  });
}
