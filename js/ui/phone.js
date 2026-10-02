// The smartphone. Apps: Messages, Contacts, Map, Bank, Marketplace,
// PartsHub, Throttle (social), Races, Ryde (rideshare), Crew, Garage,
// Journal, Settings.

import { openPanel, closePanel, bind, esc, toast, modal, confirm, prompt, bar } from './dom.js';
import { game, fmtMoney, gameTimeStr, dayName, tierOf, nextTier, racingLevel, activeCar, carValue, carMetrics, deposit, withdraw, spend, earn, addRep, addFollowers, modelOf, hourOf, isNight } from '../core/state.js';
import { LOCATIONS, LOC_BY_ID, PROPERTIES, ROADS, districtAt } from '../data/world.js';
import { RACER_BY_ID, CREWS, RACERS, PEOPLE, contactInfo } from '../data/npcs.js';
import { CHAPTERS, currentStep } from '../data/story.js';
import { carName, CAR_BY_ID } from '../data/cars.js';
import { sendMessage } from '../core/story.js';
import { emit } from '../core/events.js';
import { openMarketplace } from './marketplace.js';
import { openPartsHub } from './partshub.js';
import { openGarage } from './garage.js';
import { openSettings, openSlots } from './menu.js';
import { audio } from '../core/audio.js';
import { renderHustle } from './hustle.js';
import { renderMap } from './mapapp.js';

const APPS = [
  { id: 'messages', name: 'Messages', icon: '💬', bg: '#2bd96b' },
  { id: 'contacts', name: 'Contacts', icon: '👤', bg: '#6b6e78' },
  { id: 'map', name: 'Map', icon: '🗺', bg: '#2a7bff' },
  { id: 'bank', name: 'Bank', icon: '🏦', bg: '#1f8f3a' },
  { id: 'marketplace', name: 'Marketplace', icon: '🏪', bg: '#1877f2' },
  { id: 'partshub', name: 'PartsHub', icon: '🔧', bg: '#e0192e' },
  { id: 'social', name: 'Throttle', icon: '📸', bg: 'linear-gradient(135deg,#a01aff,#ff1a6a)' },
  { id: 'races', name: 'Races', icon: '🏁', bg: '#111' },
  { id: 'ryde', name: 'Ryde', icon: '🚕', bg: '#e8c21a' },
  { id: 'hustle', name: 'Hustle', icon: '💼', bg: '#0f6b4f' },
  { id: 'crew', name: 'Crew', icon: '👥', bg: '#3a3d46' },
  { id: 'garage', name: 'My Cars', icon: '🚗', bg: '#c0c4cc' },
  { id: 'journal', name: 'Journal', icon: '📓', bg: '#7a4b3a' },
  { id: 'settings', name: 'Settings', icon: '⚙', bg: '#2a2c33' },
];

export function openPhone(appId, app) {
  const st = { app: appId || null, sub: null };
  const ph = openPanel((root, h) => {
    const s = game.s;
    root.innerHTML = `<div class="phone">
      <div class="phone-status"><span>${gameTimeStr(s.time)}</span><span>${dayName(s.time)} · ${s.weather === 'rain' ? '🌧' : s.weather === 'fog' ? '🌫' : isNight(s.time) ? '🌙' : '☀'} · 5G ▮▮▮</span></div>
      <div class="phone-screen" data-screen></div>
      <div class="phone-bar"><button data-phone-home title="Home"></button></div></div>`;
    const scr = root.querySelector('[data-screen]');
    const go = (id, sub = null) => { st.app = id; st.sub = sub; h.refresh(); };
    const ctx = { s, app, h, go, st };
    if (!st.app) renderHome(scr, ctx);
    else if (st.app === 'marketplace') { openMarketplace(scr, ctx); }
    else (RENDER[st.app] || renderHome)(scr, ctx);
    root.querySelector('[data-phone-home]').onclick = () => { if (st.app) go(null); else h.close(); };
  }, { cls: 'phone-panel' });
  ph.root.addEventListener('click', e => { if (e.target === ph.root) ph.close(); });
  return ph;
}

function head(title, back = true) {
  return `<div class="app-head">${back ? '<button class="back" data-action="back">‹ Back</button>' : ''}<h2>${esc(title)}</h2></div>`;
}
function wire(scr, ctx, handlers) {
  bind(scr, { back: () => ctx.go(ctx.st.sub ? ctx.st.app : null), ...handlers });
}

// ---------------- home ----------------
function renderHome(scr, ctx) {
  const s = ctx.s;
  const unread = s.messages.filter(m => !m.read).length;
  const t = tierOf(s.rep);
  scr.innerHTML = `<div class="phone-wall"><div class="who">${esc(s.player.name)}</div>
    <div class="sub">${fmtMoney(s.cash)} cash · ${fmtMoney(s.bank)} bank · ${t.name} · ${s.followers.toLocaleString()} followers</div></div>
    <div class="phone-home">${APPS.map(a => `<button class="app" data-action="open" data-id="${a.id}"><i style="background:${a.bg}">${a.icon}</i>${a.name}${a.id === 'messages' && unread ? `<span class="badge">${unread}</span>` : ''}</button>`).join('')}</div>`;
  bind(scr, { open: d => {
    if (d.id === 'partshub') { ctx.h.close(); openPartsHub(ctx.app); return; }
    if (d.id === 'settings') { openSettings(ctx.app); return; }
    ctx.go(d.id);
  } });
}

const RENDER = {};
RENDER.hustle = renderHustle;

// ---------------- messages ----------------
RENDER.messages = (scr, ctx) => {
  const s = ctx.s;
  const who = id => id === 'marketplace' ? { name: 'Marketplace', color: '#1877f2' } : id === 'partshub' ? { name: 'PartsHub', color: '#e0192e' } : id === 'insurance' ? { name: 'Solace Mutual Insurance', color: '#1f8f3a' } : id === 'hustle' ? { name: 'Hustle', color: '#0f6b4f' } : contactInfo(id);
  scr.innerHTML = head('Messages') + `<div class="app-body">${s.messages.length ? s.messages.map(m => {
    const w = who(m.from);
    let action = '';
    if (m.action?.type === 'gps') action = `<button class="btn btn-sm" data-action="gps" data-loc="${m.action.loc}">📍 Set GPS</button>`;
    if (m.action?.type === 'challenge') {
      const ch = m.action.challenge;
      const expired = ch.expires < s.time.day;
      action = expired ? '<span class="tag">Expired</span>' : s.challenge?.id === ch.id ? '<span class="tag tag-green">Accepted — go to the spot</span>'
        : `<button class="btn btn-sm btn-primary" data-action="accept" data-id="${m.id}">Accept</button> <button class="btn btn-sm" data-action="decline" data-id="${m.id}">Decline</button>`;
    }
    if (m.action?.type === 'offer') action = `<button class="btn btn-sm" data-action="offers">View offers</button>`;
    if (m.action?.type === 'sponsor' && !m.action.done) action = `<button class="btn btn-sm btn-primary" data-action="sponsor" data-id="${m.id}">Sign deal</button>`;
    return `<div class="msg ${m.read ? '' : 'unread'}"><div class="from"><span>${esc(w.name)}</span><small>Day ${m.day} · ${m.t}</small></div><p>${esc(m.text)}</p>${action ? `<div class="row" style="margin-top:6px">${action}</div>` : ''}</div>`;
  }).join('') : '<div class="empty">No messages yet.</div>'}</div>`;
  s.messages.forEach(m => { m.read = true; });
  wire(scr, ctx, {
    gps: d => { const l = LOC_BY_ID[d.loc]; ctx.app.world?.setGps(l.x, l.z, l.name); ctx.h.close(); },
    accept: d => {
      const m = s.messages.find(x => x.id === d.id); const ch = m.action.challenge;
      s.challenge = ch;
      const l = LOC_BY_ID[ch.loc];
      ctx.app.world?.setGps(l.x, l.z, `${RACER_BY_ID[ch.npcId].nick} @ ${l.name}`);
      sendMessage(s, ch.npcId, RACER_BY_ID[ch.npcId].lines.greet);
      toast(`Challenge accepted — meet ${RACER_BY_ID[ch.npcId].nick} at ${l.name}`, 'good');
      ctx.h.close();
    },
    decline: d => { const m = s.messages.find(x => x.id === d.id); m.action.challenge.expires = -1; addRep(s, -10, 'Ducked a challenge'); ctx.h.refresh(); },
    offers: () => ctx.go('marketplace', 'selling'),
    sponsor: d => {
      const m = s.messages.find(x => x.id === d.id);
      s.sponsor = { ...m.action.deal, until: s.time.day + m.action.deal.days };
      m.action.done = true;
      toast(`Signed with ${m.action.deal.name}: ${fmtMoney(m.action.deal.perWin)} per win`, 'good');
      ctx.h.refresh();
    },
  });
};

// ---------------- contacts ----------------
RENDER.contacts = (scr, ctx) => {
  const s = ctx.s;
  if (ctx.st.sub) {
    const c = contactInfo(ctx.st.sub);
    const r = RACER_BY_ID[ctx.st.sub];
    const mem = s.npc[ctx.st.sub];
    scr.innerHTML = head(c.name) + `<div class="app-body">
      <div class="row"><span class="avatar" style="background:${c.color}">${esc(c.name[0])}</span><div class="grow"><b>${esc(c.name)}</b><div class="muted small">${esc(c.role)}</div></div></div>
      <p class="muted">${esc(c.bio)}</p>
      ${r ? `<div class="kv"><span>Drives</span><span>${esc(carName(CAR_BY_ID[r.car.model], r.car.year))}</span><span>Specialty</span><span>${esc(r.focus)} · ${r.style}</span>
        <span>Tier</span><span>${r.tier}</span><span>Your record vs them</span><span>${mem ? `${mem.wins}W – ${mem.losses}L` : 'Never raced'}</span>
        <span>Relationship</span><span>${mem ? relWord(mem.rel) : 'Stranger'}</span></div>
        <p class="small muted">To race, meet them at a race spot or a meet. They'll also text you challenges.</p>` : ''}
      ${PEOPLE[ctx.st.sub] && ctx.st.sub === 'rosa' ? '<button class="btn btn-sm" data-action="gpsloc" data-loc="torque_temple">📍 Torque Temple</button>' : ''}
      ${ctx.st.sub === 'sal' ? '<button class="btn btn-sm" data-action="gpsloc" data-loc="rusty_used">📍 Rusty\'s Used Autos</button>' : ''}
      ${ctx.st.sub === 'manny' ? '<button class="btn btn-sm" data-action="gpsloc" data-loc="vega_kustoms">📍 Vega Kustoms</button>' : ''}
      ${ctx.st.sub === 'kingpin' ? '<button class="btn btn-sm" data-action="gpsloc" data-loc="pier9">📍 Pier 9 meet</button>' : ''}
    </div>`;
    wire(scr, ctx, { gpsloc: d => { const l = LOC_BY_ID[d.loc]; ctx.app.world?.setGps(l.x, l.z, l.name); ctx.h.close(); } });
    return;
  }
  const ids = [...new Set([...s.contacts, ...Object.keys(s.npc)])].filter(id => contactInfo(id).name !== id);
  scr.innerHTML = head('Contacts') + `<div class="app-body"><div class="list">${ids.map(id => {
    const c = contactInfo(id);
    return `<div class="li click" data-action="open" data-id="${id}"><span class="avatar" style="background:${c.color}">${esc(c.name[0])}</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.role)}</div></div></div>`;
  }).join('')}</div></div>`;
  wire(scr, ctx, { open: d => ctx.go('contacts', d.id) });
};
function relWord(r) { return r > 60 ? 'Friend' : r > 25 ? 'Respect' : r > -10 ? 'Neutral' : r > -40 ? 'Rival' : 'Bad blood'; }

// ---------------- map ----------------
RENDER.map = renderMap;

// ---------------- bank ----------------
RENDER.bank = (scr, ctx) => {
  const s = ctx.s;
  const car = activeCar(s);
  const ins = Math.round(40 + s.cars.reduce((a, c) => a + carValue(c), 0) * 0.0022);
  scr.innerHTML = head('Solace Credit Union') + `<div class="app-body">
    <div class="stats-row"><div><div class="stat-lbl">Cash</div><div class="stat-big">${fmtMoney(s.cash)}</div></div><div><div class="stat-lbl">Checking</div><div class="stat-big">${fmtMoney(s.bank)}</div></div></div>
    <div class="row" style="margin:10px 0"><button class="btn btn-sm" data-action="dep">Deposit</button><button class="btn btn-sm" data-action="wd">Withdraw</button></div>
    <div class="stats-row"><div><div class="stat-lbl">Earned</div><b class="good">${fmtMoney(s.stats.earnings)}</b></div><div><div class="stat-lbl">Spent</div><b class="bad">${fmtMoney(s.stats.expenses)}</b></div><div><div class="stat-lbl">Net worth</div><b>${fmtMoney(s.cash + s.bank + s.cars.reduce((a, c) => a + carValue(c), 0))}</b></div></div>
    <div class="section-title">Insurance</div>
    <div class="li"><div class="grow"><div class="t">Solace Mutual — Full coverage</div><div class="s">${fmtMoney(ins)}/week. Covers 70% of repairs and 25% of police impound fines.</div></div>
      <button class="btn btn-sm ${s.insurance ? '' : 'btn-primary'}" data-action="ins">${s.insurance ? 'Cancel' : 'Buy'}</button></div>
    <div class="section-title">Roadside</div>
    <div class="li"><div class="grow"><div class="t">Gas delivery (2 gal)</div><div class="s">$45 — when you're stranded</div></div><button class="btn btn-sm" data-action="gas" ${car ? '' : 'disabled'}>Call</button></div>
    <div class="li"><div class="grow"><div class="t">Tow to Second Chance Collision</div><div class="s">$185 flat rate</div></div><button class="btn btn-sm" data-action="tow" ${car ? '' : 'disabled'}>Call</button></div>
    <div class="section-title">Recent activity</div>
    <div class="list">${s.ledger.slice(0, 40).map(l => `<div class="li"><div class="grow"><div class="t">${esc(l.label)}</div><div class="s">Day ${l.day} · ${l.t}</div></div><b class="${l.amount > 0 ? 'good' : l.amount < 0 ? 'bad' : ''}">${l.amount ? (l.amount > 0 ? '+' : '') + fmtMoney(l.amount, true) : ''}</b></div>`).join('') || '<div class="empty">Nothing yet</div>'}</div></div>`;
  wire(scr, ctx, {
    dep: async () => { const v = await prompt('Deposit', `<p>Cash on hand: ${fmtMoney(s.cash)}</p>`, 'Amount', String(Math.floor(s.cash))); if (v) { deposit(s, +v.replace(/\D/g, '')); ctx.h.refresh(); } },
    wd: async () => { const v = await prompt('Withdraw', `<p>Checking: ${fmtMoney(s.bank)}</p>`, 'Amount', String(Math.floor(s.bank))); if (v) { withdraw(s, +v.replace(/\D/g, '')); ctx.h.refresh(); } },
    ins: () => { s.insurance = !s.insurance; toast(s.insurance ? 'Insured. First premium due at the end of the week.' : 'Policy cancelled', 'info'); ctx.h.refresh(); },
    gas: () => { if (spend(s, 45, 'Roadside gas delivery')) { const c = activeCar(s); c.fuel = Math.min(1, c.fuel + 2 / 14); toast('Gas delivered. Find a station soon.', 'good'); ctx.h.refresh(); } },
    tow: () => {
      if (!spend(s, 185, 'Tow truck')) return;
      const l = LOC_BY_ID.second_chance;
      const w = ctx.app.world;
      if (w?.vehicle) { w.vehicle.x = l.x; w.vehicle.z = l.z + 8; w.vehicle.vx = w.vehicle.vz = 0; w.inCar = false; w.foot.x = l.x + 3; w.foot.z = l.z; s.time.min += 40; }
      toast('Towed to Second Chance Collision', 'good'); ctx.h.close();
    },
  });
};

// ---------------- social ----------------
const SPONSORS = [
  { at: 800, name: 'Volt Energy Drink', perWin: 150, days: 10, contact: 'kingpin' },
  { at: 3000, name: 'Port Solace Tire & Wheel', perWin: 450, days: 14, contact: 'kingpin' },
  { at: 12000, name: 'Nitro Brew Coffee Co.', perWin: 1200, days: 14, contact: 'kingpin' },
  { at: 50000, name: 'Apex Lubricants', perWin: 4500, days: 21, contact: 'kingpin' },
];
RENDER.social = (scr, ctx) => {
  const s = ctx.s;
  const car = activeCar(s);
  const postedToday = s.lastPostDay === s.time.day;
  scr.innerHTML = head('Throttle') + `<div class="app-body">
    <div class="row"><span class="avatar" style="background:linear-gradient(135deg,#a01aff,#ff1a6a)">${esc(s.player.name[0])}</span><div class="grow"><b>@${esc(s.player.name.toLowerCase().replace(/\W+/g, ''))}</b><div class="muted small">${s.followers.toLocaleString()} followers · ${s.stats.wins} wins</div></div></div>
    <p class="small muted">Followers come from wins, big wagers, meets, escapes and clean builds. Sponsors find you at ${SPONSORS.map(x => x.at.toLocaleString()).join(', ')} followers.</p>
    ${s.sponsor ? `<div class="li"><div class="grow"><div class="t">Sponsored by ${esc(s.sponsor.name)}</div><div class="s">${fmtMoney(s.sponsor.perWin)} per win · until day ${s.sponsor.until}</div></div></div>` : ''}
    <button class="btn btn-primary" data-action="post" ${!car || postedToday ? 'disabled' : ''} style="width:100%;margin:8px 0">${postedToday ? 'Posted today — come back tomorrow' : car ? `📸 Post your ${esc(modelOf(car).model)}` : 'Get a car to post'}</button>
    <div class="list">${s.feed.slice(0, 40).map(p => `<div class="msg"><div class="from"><span>${esc(p.who || '@' + s.player.name)}</span><small>Day ${p.day}</small></div><p>${esc(p.text)}</p><div class="small muted">♥ ${p.likes.toLocaleString()}</div></div>`).join('') || '<div class="empty">No posts yet</div>'}</div></div>`;
  wire(scr, ctx, {
    post: () => {
      const c = activeCar(s);
      const m = modelOf(c);
      const mods = Object.values(c.visual).filter(v => v && !['none', 'stock', 'single', 'halogen', 'gloss', '#111111', 'steel'].includes(v)).length;
      const gain = Math.round((10 + mods * 6 + m.rarity * 18 + carMetrics(c).pi / 20) * (0.7 + Math.random() * 0.8) * (1 + s.followers / 5000));
      s.lastPostDay = s.time.day;
      addFollowers(s, gain);
      s.feed.unshift({ day: s.time.day, text: pickCaption(c), likes: Math.round(gain * (3 + Math.random() * 6)) });
      toast(`+${gain} followers`, 'good');
      checkSponsors(s);
      ctx.h.refresh();
    },
  });
};
function pickCaption(c) {
  const m = modelOf(c);
  const caps = [`${c.year} ${m.model} doing ${m.model} things.`, `Night drive. ${m.model} ☾`, `New mods, who dis. #${m.make}`, `${carMetrics(c).quarter?.toFixed(2) || '??'} quarter on paper. Let's see it on the street.`, `She ain't pretty but she's fast. ${m.model}`, `${c.miles.toLocaleString(undefined, { maximumFractionDigits: 0 })} miles and still pulling.`];
  return caps[Math.floor(Math.random() * caps.length)];
}
export function checkSponsors(s) {
  s.sponsorOffers ??= [];
  for (const sp of SPONSORS) {
    if (s.followers >= sp.at && !s.sponsorOffers.includes(sp.name)) {
      s.sponsorOffers.push(sp.name);
      sendMessage(s, 'kingpin', `${sp.name} saw your page and wants to sponsor you: ${fmtMoney(sp.perWin)} every race you win for ${sp.days} days. Sign in Messages.`, { action: { type: 'sponsor', deal: sp } });
    }
  }
}

// ---------------- races ----------------
RENDER.races = (scr, ctx) => {
  const s = ctx.s;
  const tier = tierOf(s.rep).n;
  const open = s.messages.filter(m => m.action?.type === 'challenge' && m.action.challenge.expires >= s.time.day);
  const spots = LOCATIONS.filter(l => l.type === 'roll' || l.type === 'drag' || l.type === 'meet');
  scr.innerHTML = head('Races') + `<div class="app-body">
    <div class="stats-row"><div><div class="stat-lbl">Record</div><b>${s.stats.wins}W – ${s.stats.losses}L</b></div><div><div class="stat-lbl">Racing level</div><b>${racingLevel(s.xp)}</b></div><div><div class="stat-lbl">Best ET</div><b>${s.stats.bestEt ? s.stats.bestEt.toFixed(3) + 's' : '—'}</b></div></div>
    ${s.challenge ? `<div class="section-title">Accepted</div><div class="li"><div class="grow"><div class="t">${esc(RACER_BY_ID[s.challenge.npcId].name)} — ${s.challenge.type === 'drag' ? 'Drag' : s.challenge.roll + '-roll'} for ${fmtMoney(s.challenge.wager)}</div><div class="s">${esc(LOC_BY_ID[s.challenge.loc].name)}</div></div><button class="btn btn-sm" data-action="gps" data-loc="${s.challenge.loc}">📍</button></div>` : ''}
    <div class="section-title">Challenges (${open.length})</div>
    ${open.length ? open.map(m => `<div class="li"><div class="grow"><div class="t">${esc(RACER_BY_ID[m.action.challenge.npcId].name)}</div><div class="s">${esc(m.text)}</div></div></div>`).join('') + '<p class="small muted">Accept them in Messages.</p>' : '<p class="muted small">No open challenges. Win races and they\'ll come to you.</p>'}
    <div class="section-title">Spots</div>
    <div class="list">${spots.map(l => {
      const locked = (l.tier || 1) > tier;
      return `<div class="li click" data-action="gps" data-loc="${l.id}"><div class="grow"><div class="t">${esc(l.name)} ${locked ? `<span class="tag tag-red">Tier ${l.tier}</span>` : ''}</div><div class="s">${l.type === 'meet' ? 'Street meet · after 8 PM' : l.type === 'drag' ? 'Sanctioned drag strip · test & tune, bracket races' : 'Roll racing · ' + esc(ROADS[l.road]?.desc || '')}</div></div><span>📍</span></div>`;
    }).join('')}</div></div>`;
  wire(scr, ctx, { gps: d => { const l = LOC_BY_ID[d.loc]; ctx.app.world?.setGps(l.x, l.z, l.name); ctx.h.close(); } });
};

// ---------------- rideshare ----------------
RENDER.ryde = (scr, ctx) => {
  const s = ctx.s;
  const w = ctx.app.world;
  const p = w?.playerState();
  const night = isNight(s.time);
  const fare = l => Math.round((3.5 + Math.hypot(l.x - p.x, l.z - p.z) * 1.3 / 1609 * 1.95) * (night ? 1.4 : 1) * 100) / 100;
  scr.innerHTML = head('Ryde') + `<div class="app-body">
    ${w?.inCar ? '<p class="warn">You\'re driving. Get out of your car first.</p>' : ''}
    <p class="small muted">${night ? '🌙 Late-night pricing (1.4×).' : 'Standard pricing.'} Your car stays where you parked it.</p>
    <div class="list">${LOCATIONS.map(l => `<div class="li"><div class="grow"><div class="t">${esc(l.name)}</div><div class="s">${esc(districtAt(l.x, l.z))} · ${(Math.hypot(l.x - p.x, l.z - p.z) * 1.3 / 1609).toFixed(1)} mi</div></div>
      <button class="btn btn-sm" data-action="ride" data-loc="${l.id}" ${w?.inCar ? 'disabled' : ''}>${fmtMoney(fare(l), true)}</button></div>`).join('')}
    ${w?.vehicle ? `<div class="li"><div class="grow"><div class="t">Back to your car</div><div class="s">${esc(districtAt(w.vehicle.x, w.vehicle.z))}</div></div><button class="btn btn-sm" data-action="ride" data-loc="__car" ${w.inCar ? 'disabled' : ''}>${fmtMoney(fare({ x: w.vehicle.x, z: w.vehicle.z }), true)}</button></div>` : ''}
    </div></div>`;
  wire(scr, ctx, {
    ride: d => {
      const l = d.loc === '__car' ? { x: w.vehicle.x + 4, z: w.vehicle.z, name: 'your car' } : LOC_BY_ID[d.loc];
      const f = fare(l);
      if (!spend(s, f, `Ryde to ${l.name}`)) return;
      const dist = Math.hypot(l.x - p.x, l.z - p.z);
      s.time.min += Math.round(dist / 15);
      if (s.time.min >= 1440) { s.time.min -= 1440; s.time.day++; }
      w.foot.x = l.x; w.foot.z = l.z;
      w.cam.x = l.x; w.cam.z = l.z;
      toast(`Dropped off at ${l.name}. ★★★★★`, 'good');
      ctx.h.close();
    },
  });
};

// ---------------- crew ----------------
RENDER.crew = (scr, ctx) => {
  const s = ctx.s;
  const tier = tierOf(s.rep).n;
  if (s.crew) {
    const members = s.crew.members.map(id => RACER_BY_ID[id]).filter(Boolean);
    const recruitable = Object.entries(s.npc).filter(([id, m]) => m.wins >= 2 && m.rel > 20 && !s.crew.members.includes(id) && RACER_BY_ID[id] && !RACER_BY_ID[id].crew).map(([id]) => RACER_BY_ID[id]);
    const rivals = Object.entries(CREWS).filter(([id]) => id !== s.crew.npcCrew);
    scr.innerHTML = head(s.crew.name) + `<div class="app-body">
      <div class="row"><span class="avatar" style="background:${s.crew.color}">${esc(s.crew.logo)}</span><div class="grow"><b>${esc(s.crew.name)}</b><div class="muted small">${s.crew.npcCrew ? 'Member' : 'Founder'} · Crew rep ${s.crew.rep.toLocaleString()}</div></div></div>
      ${s.crew.npcCrew ? `<p class="muted small">${esc(CREWS[s.crew.npcCrew].style)}</p>` : ''}
      <div class="section-title">Members</div>
      <div class="list"><div class="li"><div class="grow"><div class="t">${esc(s.player.name)} (you)</div></div></div>${members.map(r => `<div class="li"><div class="grow"><div class="t">${esc(r.name)} "${esc(r.nick)}"</div><div class="s">${esc(carName(CAR_BY_ID[r.car.model]))}</div></div></div>`).join('')}</div>
      ${!s.crew.npcCrew ? `<div class="section-title">Recruit</div>${recruitable.length ? recruitable.map(r => `<div class="li"><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">You've beaten them ${s.npc[r.id].wins}×</div></div><button class="btn btn-sm btn-primary" data-action="recruit" data-id="${r.id}">Invite</button></div>`).join('') : '<p class="muted small">Unaffiliated racers you\'ve beaten twice (and get along with) can be recruited.</p>'}` : ''}
      <div class="section-title">Crew standings</div>
      <div class="list">${[{ name: s.crew.name, rep: s.crew.rep, color: s.crew.color, me: true }, ...rivals.map(([, c]) => c)].sort((a, b) => b.rep - a.rep).map((c, i) => `<div class="li"><b>#${i + 1}</b><span class="avatar" style="background:${c.color};width:18px;height:18px"></span><div class="grow"><div class="t">${esc(c.name)}${c.me ? ' (yours)' : ''}</div></div><b>${c.rep.toLocaleString()}</b></div>`).join('')}</div>
      <p class="small muted">Crew rep grows when you or your members win races. Beat rival crew members to take their rep.</p>
      <button class="btn btn-danger btn-sm" data-action="leave">Leave crew</button></div>`;
    wire(scr, ctx, {
      recruit: d => { s.crew.members.push(d.id); toast(`${RACER_BY_ID[d.id].name} joined ${s.crew.name}`, 'good'); ctx.h.refresh(); },
      leave: async () => { if (await confirm('Leave crew?', '<p>You lose crew rep and members.</p>', 'Leave', true)) { s.crew = null; ctx.h.refresh(); } },
    });
    return;
  }
  scr.innerHTML = head('Crew') + `<div class="app-body">
    <p class="muted">Crews race together, rep together and back each other at meets.</p>
    <div class="section-title">Join a crew</div>
    <div class="list">${Object.entries(CREWS).map(([id, c]) => {
      const need = Math.round(c.rep * 0.25);
      const beat = RACERS.filter(r => r.crew === id).some(r => (s.npc[r.id]?.wins || 0) > 0);
      const ok = s.rep >= need && beat;
      return `<div class="li"><span class="avatar" style="background:${c.color}">${esc(c.name[0])}</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.style)}<br>Needs ${need.toLocaleString()} rep ${s.rep >= need ? '✓' : '✗'} · beat one of their members ${beat ? '✓' : '✗'}</div></div>
        <button class="btn btn-sm ${ok ? 'btn-primary' : ''}" data-action="join" data-id="${id}" ${ok ? '' : 'disabled'}>Join</button></div>`;
    }).join('')}</div>
    <div class="section-title">Start your own</div>
    <p class="small muted">$2,500 to get the jackets made. Needs Tier 2.</p>
    <button class="btn btn-primary" data-action="found" ${tier >= 2 ? '' : 'disabled'}>Start a crew</button></div>`;
  wire(scr, ctx, {
    join: d => { const c = CREWS[d.id]; s.crew = { name: c.name, color: c.color, logo: c.name[0], rep: c.rep, members: RACERS.filter(r => r.crew === d.id).map(r => r.id), npcCrew: d.id }; emit('crewJoined', { id: d.id }); toast(`Welcome to ${c.name}`, 'good'); ctx.h.refresh(); },
    found: async () => {
      const name = await prompt('Crew name', '<p>What are they going to call you?</p>', 'e.g. Night Shift');
      if (!name || !name.trim()) return;
      if (!spend(s, 2500, 'Crew jackets & decals')) return;
      const colors = ['#e0192e', '#2a7bff', '#2bd96b', '#ffc21a', '#a01aff', '#13b3c4', '#ff6a1a', '#f2f2f2'];
      s.crew = { name: name.trim().slice(0, 24), color: colors[Math.floor(Math.random() * colors.length)], logo: name.trim()[0].toUpperCase(), rep: 0, members: [], npcCrew: null };
      emit('crewJoined', { own: true });
      ctx.h.refresh();
    },
  });
};

// ---------------- my cars ----------------
RENDER.garage = (scr, ctx) => {
  const s = ctx.s;
  scr.innerHTML = head('My Cars') + `<div class="app-body"><div class="list">${s.cars.map(c => {
    const m = modelOf(c), mt = carMetrics(c);
    return `<div class="li"><div class="grow"><div class="t">${esc(carName(m, c.year))} ${c.uid === s.activeCar ? '<span class="tag tag-green">Driving</span>' : ''}</div><div class="s">${Math.round(c.miles).toLocaleString()} mi · ${mt.cls} ${mt.pi} · worth ~${fmtMoney(carValue(c))}</div></div></div>`;
  }).join('') || '<div class="empty">No cars yet. Try Marketplace.</div>'}</div>
  <p class="small muted">Switch cars, install parts and tune at your home garage. Torque Temple and Vega Kustoms can install anything.</p>
  <div class="row"><button class="btn btn-sm" data-action="home">📍 Home</button><button class="btn btn-sm" data-action="view" ${s.cars.length ? '' : 'disabled'}>View specs</button></div></div>`;
  wire(scr, ctx, {
    home: () => { const l = LOC_BY_ID[s.home]; ctx.app.world?.setGps(l.x, l.z, 'Home'); ctx.h.close(); },
    view: () => openGarage(ctx.app, { readOnly: true }),
  });
};

// ---------------- journal ----------------
RENDER.journal = (scr, ctx) => {
  const s = ctx.s;
  const step = currentStep(s.story);
  scr.innerHTML = head('Journal') + `<div class="app-body">
    ${s.story.enabled ? CHAPTERS.map((ch, ci) => `<div class="section-title">${esc(ch.title)}</div><p class="small muted">${esc(ch.blurb)}</p>
      ${ch.steps.map((st, si) => {
        const done = s.story.done.includes(st.id);
        const cur = step && step.id === st.id;
        return `<div class="li"><span>${done ? '✅' : cur ? '▶' : '○'}</span><div class="grow"><div class="t ${done ? 'muted' : ''}">${esc(st.objective)}</div></div>${cur && st.where ? `<button class="btn btn-sm" data-action="gps" data-loc="${st.where}">📍</button>` : ''}</div>`;
      }).join('')}`).join('') : '<p class="muted">Free roam — no story. Make your own legend.</p>'}
    <div class="section-title">Career</div>
    <div class="kv"><span>Rep</span><span>${s.rep.toLocaleString()} (${tierOf(s.rep).name})</span><span>Next tier</span><span>${nextTier(s.rep) ? nextTier(s.rep).rep.toLocaleString() + ' rep' : 'Maxed'}</span>
      <span>Races</span><span>${s.stats.races} (${s.stats.wins} W)</span><span>Pursuits escaped</span><span>${s.stats.pursuitsEscaped}</span><span>Busted</span><span>${s.stats.busted}</span>
      <span>Meets attended</span><span>${s.stats.meets}</span><span>Miles driven</span><span>${Math.round(s.stats.miles).toLocaleString()}</span><span>Play time</span><span>${Math.round(s.playTime / 60)} min</span></div></div>`;
  wire(scr, ctx, { gps: d => { const l = LOC_BY_ID[d.loc]; ctx.app.world?.setGps(l.x, l.z, l.name); ctx.h.close(); } });
};
