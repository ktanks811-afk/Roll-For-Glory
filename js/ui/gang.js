// Phone app: Gang. Get put on with a Fort Worth set (or start your own), your
// rank and respect, the work your big homie has for you, the homies riding
// with you, and who you have beef with. Rules live in core/gangs.js; the
// corners, drive-bys and shootouts are in world2d/gangs.js.

import { bind, esc, toast, confirm, prompt, bar } from './dom.js';
import { fmtMoney } from '../core/state.js';
import { GANGS, GANG_IDS, FOUND_COST, GANG_CONTACTS } from '../data/gangs.js';
import { HOODS } from '../core/turf.js';
import * as G from '../core/gangs.js';

const head = (title, back = 'back') => `<div class="app-head"><button class="back" data-action="${back}">‹ Back</button><h2>${esc(title)}</h2></div>`;
const dot = (c, size = 22) => `<span class="avatar" style="background:${esc(c)};width:${size}px;height:${size}px"></span>`;
const COLORS = ['#ff2a3a', '#2a7bff', '#2bd96b', '#ff9900', '#f2f2f2', '#13b3c4', '#d12a8a', '#111'];

function beefRow(s, id) {
  const g = G.ensureGang(s), gg = GANGS[id], b = g.beef[id];
  const hot = G.hostile(s, id), truce = (g.truce[id] || 0) >= s.time.day;
  const label = truce ? 'Truce' : G.rivalsOf(s).includes(id) && b < G.HOSTILE_AT ? 'Rivals' : G.beefLabel(b);
  const canSquash = !truce && (b > 0 || G.rivalsOf(s).includes(id));
  return `<div class="li">${dot(gg.color)}<div class="grow"><div class="t">${esc(gg.name)} <span class="tag" style="${hot ? 'border-color:#ff2a3a;color:#ff5a5a' : ''}">${label}</span></div>
    <div class="s">${esc(gg.hood)}${hot ? ' · shoots on sight' : ''}</div>${bar(b, hot ? 'bar-red' : '')}</div>
    ${canSquash ? `<button class="btn btn-sm" data-action="squash" data-id="${id}">Squash ${fmtMoney(G.squashCost(s, id))}</button>` : ''}</div>`;
}

function jobCard(s, j, mine) {
  const left = G.jobLeft(s);
  return `<div class="li" ${mine ? 'style="border-color:#ffc21a"' : ''}><div class="grow"><div class="t">${esc(j.title)}</div>
    <div class="s">${esc(j.where)} · ${fmtMoney(j.pay)}${j.init ? '' : ` · +${j.respect} respect`}${mine ? ` · ${j.got}/${j.need}${Number.isFinite(left) ? ` · ${Math.max(0, Math.floor(left / 60))}h ${Math.max(0, Math.floor(left % 60))}m left` : ''}` : ''}</div></div>
    ${mine ? '<button class="btn btn-sm btn-primary" data-action="gps">GPS</button> <button class="btn btn-sm" data-action="drop">Drop</button>' : `<button class="btn btn-sm btn-primary" data-action="take" data-id="${j.id}">Take</button>`}</div>`;
}

const HOW = '<p class="small muted">Hits: drop their people on their corner. Drive-bys: roll past their corner slow with homies in the car. Rival sets shoot on sight, and when the beef runs hot they come looking for you. Gunfire brings FWPD.</p>';

function renderFound(scr, ctx) {
  const s = ctx.s, why = G.foundBlocked(s);
  const taken = id => GANG_IDS.find(g => GANGS[g].hood === id);
  scr.innerHTML = head('Start a set', 'home') + `<div class="app-body">
    <p class="small">${fmtMoney(FOUND_COST)} gets the straps, the phones and the first two homies. You're the big homie. Every homie kicks up ${fmtMoney(120)} a day.</p>
    ${why ? `<p class="small warn">${esc(why)}</p>` : ''}
    <div class="section-title">Pick your hood</div><div class="list">${HOODS.map(h => {
      const t = taken(h.id);
      return `<div class="li"><div class="grow"><div class="t">${esc(h.id)}</div><div class="s">${t ? `${esc(GANGS[t].name)} run it. They will want smoke.` : 'Nobody claims it.'}</div></div>
        <button class="btn btn-sm ${why ? '' : 'btn-primary'}" data-action="pick" data-id="${esc(h.id)}" ${why ? 'disabled' : ''}>Here</button></div>`;
    }).join('')}</div></div>`;
  bind(scr, {
    home: () => ctx.go('gang'),
    pick: async d => {
      const name = await prompt('Name your set', `<p>Home: <b>${esc(d.id)}</b>. What do they call y'all?</p>`, 'e.g. Rosedale Gang');
      if (!name || !name.trim()) return;
      const err = G.found(s, name, d.id, COLORS[Math.floor(Math.random() * COLORS.length)]);
      if (err) toast(err, 'bad'); else ctx.go('gang');
    },
  });
}

export function renderGang(scr, ctx) {
  const s = ctx.s, g = G.ensureGang(s), w = ctx.app?.world;
  if (ctx.st.sub === 'found') return renderFound(scr, ctx);
  const set = G.mySet(s);
  const gps = () => { if (w?.gangs) { w.gangs.gpsFor(); ctx.h.close(); } else toast('Head out into the city first.', 'info'); };
  const common = {
    back: () => ctx.go(null),
    gps,
    drop: async () => { if (await confirm('Drop the job?', '<p>Your set will remember you didn\'t handle it.</p>', 'Drop it', true)) { G.dropJob(s); ctx.h.refresh(); } },
    squash: d => { const e = G.squash(s, d.id); if (e) toast(e, 'bad'); ctx.h.refresh(); },
  };

  if (!set) {
    const init = g.init && GANGS[g.init];
    scr.innerHTML = head('Gang') + `<div class="app-body">
      <p class="muted small">Every side of Fort Worth has a set on the corner. Get put on with one, or start your own.</p>
      ${g.job ? `<div class="section-title">Initiation · ${esc(init?.name || '')}</div>${jobCard(s, g.job, true)}` : ''}
      <div class="section-title">Sets</div><div class="list">${GANG_IDS.map(id => {
        const gg = GANGS[id], why = G.joinBlocked(s, id);
        return `<div class="li" data-gang="${id}">${dot(gg.color, 28)}<div class="grow"><div class="t">${esc(gg.name)}</div>
          <div class="s">${esc(gg.hood)} · big homie ${esc(GANG_CONTACTS[gg.boss].name)}<br>${esc(gg.style)}${why && !g.job ? `<br><span class="warn">${esc(why)}</span>` : ''}</div>
          <div class="row" style="gap:6px;margin-top:6px"><button class="btn btn-sm ${why ? '' : 'btn-primary'}" data-action="jump" data-id="${id}" ${why ? 'disabled' : ''}>Get jumped in</button><button class="btn btn-sm" data-action="work" data-id="${id}" ${why ? 'disabled' : ''}>Put in work</button></div></div></div>`;
      }).join('')}</div>
      <div class="section-title">Start your own</div>
      <p class="small muted">${fmtMoney(FOUND_COST)} and Tier 2. You pick the hood.</p>
      <button class="btn btn-primary" data-action="found">Start a set</button>
      ${GANG_IDS.some(id => g.beef[id] > 0) ? `<div class="section-title">Beef</div><div class="list">${GANG_IDS.filter(id => g.beef[id] > 0).map(id => beefRow(s, id)).join('')}</div>` : ''}
      ${HOW}</div>`;
    bind(scr, {
      ...common,
      jump: async d => {
        if (!(await confirm(`Get jumped in by ${GANGS[d.id].short}?`, '<p>Thirteen seconds, no swinging back. You\'ll walk out hurting, but you\'ll walk out family.</p>', 'Do it'))) return;
        const e = G.jumpIn(s, d.id); if (e) toast(e, 'bad'); ctx.h.refresh();
      },
      work: d => { const e = G.workIn(s, d.id); if (e) toast(e, 'bad'); ctx.h.refresh(); },
      found: () => ctx.go('gang', 'found'),
    });
    return;
  }

  const r = G.rankOf(s), cap = G.homieCap(s);
  const pct = r.next ? (g.respect - (r.respect || 0)) / (r.next.respect - (r.respect || 0)) * 100 : 100;
  const alerts = [];
  if (g.hit) alerts.push(`<div class="li" style="border-color:#ff2a3a"><div class="grow"><div class="t">⚠ ${esc(GANGS[g.hit.gang].name)} are looking for you</div><div class="s">Keep your homies close and your eyes on the street. Or squash it below.</div></div></div>`);
  const bag = g.set === 'own' ? G.readyHomies(s).length * 120 : r.bag;
  scr.innerHTML = head(set.name) + `<div class="app-body">
    <div class="row">${dot(set.color, 34)}<div class="grow"><b>${esc(set.name)}</b><div class="muted small">${esc(r.name)} · ${g.respect.toLocaleString()} respect · home: ${esc(set.hood)}</div></div></div>
    ${r.next ? `<div class="small muted" style="margin-top:6px">Next: ${esc(r.next.name)} at ${r.next.respect.toLocaleString()}</div>${bar(pct)}` : ''}
    <p class="small">${fmtMoney(bag)} a day ${g.set === 'own' ? 'in dues' : 'in your bag'} · ${g.stats.jobs} jobs · ${g.stats.drops} dropped · ${g.stats.driveBys} drive-bys</p>
    ${alerts.join('')}
    ${g.job ? `<div class="section-title">On it</div>${jobCard(s, g.job, true)}` : ''}
    <div class="section-title">Put in work</div><div class="list">${g.offers.length ? g.offers.map(o => jobCard(s, o, false)).join('') : '<p class="small muted">Nothing today. Check back in the morning.</p>'}</div>
    <div class="section-title">Homies · ${g.homies.length}/${cap}</div><div class="list">${g.homies.map(h => {
      const out = h.out > s.time.day;
      return `<div class="li" data-homie="${h.id}">${dot(set.color)}<div class="grow"><div class="t">${esc(h.nick)}</div><div class="s">${out ? `At JPS till day ${h.out}` : h.rolling ? 'Riding with you' : 'On the block'}</div></div>
        ${out ? '' : `<button class="btn btn-sm ${h.rolling ? '' : 'btn-primary'}" data-action="roll" data-id="${h.id}">${h.rolling ? 'Stay' : 'Ride'}</button>`}</div>`;
    }).join('')}</div>
    <button class="btn btn-sm btn-primary" data-action="recruit" ${G.recruitBlocked(s) ? 'disabled' : ''}>Put somebody on · ${fmtMoney(G.recruitCost(s))}</button>
    ${G.recruitBlocked(s) && g.homies.length >= cap ? `<p class="small muted">${esc(G.recruitBlocked(s))}</p>` : ''}
    <div class="section-title">Other sets</div><div class="list">${GANG_IDS.filter(id => id !== g.set).map(id => beefRow(s, id)).join('')}</div>
    ${HOW}
    <button class="btn btn-danger btn-sm" data-action="leave">${g.set === 'own' ? 'Shut it down' : 'Leave the set'}</button></div>`;
  bind(scr, {
    ...common,
    take: d => { const e = G.takeJob(s, d.id); if (e) toast(e, 'bad'); else gps(); if (!e && !w?.gangs) ctx.h.refresh(); },
    roll: d => { const e = G.toggleRoll(s, d.id); if (e) toast(e, 'bad'); ctx.h.refresh(); },
    recruit: () => { const e = G.recruit(s); if (e) toast(e, 'bad'); ctx.h.refresh(); },
    leave: async () => {
      const own = g.set === 'own';
      if (!(await confirm(own ? 'Shut it down?' : 'Leave the set?', own ? '<p>Your homies scatter and the set is done.</p>' : '<p>You don\'t just walk away. Your old set will want smoke.</p>', own ? 'Shut it down' : 'Leave', true))) return;
      G.leave(s); ctx.h.refresh();
    },
  });
}
