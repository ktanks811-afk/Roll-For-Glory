// The smartphone. The home screen shows your FWPD status, the mission you're
// on and your GPS at a glance. Apps: Messages, Contacts, Map, Missions, Bank, Marketplace,
// PartsHub, Throttle (social), Races, Ryde (rideshare), Crew, Garage,
// Journal, Settings.

import { openPanel, closePanel, bind, esc, toast, modal, confirm, prompt, bar } from './dom.js';
import { game, fmtMoney, gameTimeStr, dayName, tierOf, nextTier, racingLevel, activeCar, carValue, carMetrics, deposit, withdraw, spend, earn, addRep, addFollowers, modelOf, hourOf, isNight } from '../core/state.js';
import { LOCATIONS, LOC_BY_ID, PROPERTIES, ROADS, districtAt } from '../data/world.js';
import { STREET_RACE_BY_ID, fmtRaceTime } from '../data/streetRaces.js';
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
import { renderShop } from './shop.js';
import { renderOcrew } from './ocrew.js';
import { renderTurf } from './turf.js';
import { renderGang } from './gang.js';
import { myHoods } from '../core/turf.js';
import { renderMap } from './mapapp.js';
import { recordHtml } from './record.js';
import { hasWarrant, hasFelony, payableTotal, payFines } from '../core/warrants.js';
import { wx } from '../core/weather.js';
import { BREAKDOWNS, MECHANIC_COST, roadsideFix } from '../core/upkeep.js';
import { ensure as ensureMissions, now as missionNow, offerById, acceptMission, declineMission, abandonMission, pointGps, currentStop, stopLabel, timeLeft, fmtLeft } from '../core/missions.js';

const APPS = [
  { id: 'messages', name: 'Messages', icon: '💬', bg: '#2bd96b' },
  { id: 'contacts', name: 'Contacts', icon: '👤', bg: '#6b6e78' },
  { id: 'map', name: 'Map', icon: '🗺', bg: '#2a7bff' },
  { id: 'missions', name: 'Missions', icon: '📦', bg: '#e8641a' },
  { id: 'bank', name: 'Bank', icon: '🏦', bg: '#1f8f3a' },
  { id: 'marketplace', name: 'Marketplace', icon: '🏪', bg: '#1877f2' },
  { id: 'partshub', name: 'PartsHub', icon: '🔧', bg: '#e0192e' },
  { id: 'social', name: 'Throttle', icon: '📸', bg: 'linear-gradient(135deg,#a01aff,#ff1a6a)' },
  { id: 'races', name: 'Races', icon: '🏁', bg: '#111' },
  { id: 'ryde', name: 'Ryde', icon: '🚕', bg: '#e8c21a' },
  { id: 'hustle', name: 'Hustle', icon: '💼', bg: '#0f6b4f' },
  { id: 'shop', name: "Amazin'", icon: '📦', bg: '#ff9900' },
  { id: 'crew', name: 'Crew', icon: '👥', bg: '#3a3d46' },
  { id: 'ocrew', name: 'Online Crew', icon: '🌐', bg: '#2a7bff' },
  { id: 'turf', name: 'Turf', icon: '🚩', bg: '#7a1414' },
  { id: 'gang', name: 'Gang', icon: '✊', bg: '#4a1a6b' },
  { id: 'garage', name: 'My Cars', icon: '🚗', bg: '#c0c4cc' },
  { id: 'journal', name: 'Journal', icon: '📓', bg: '#7a4b3a' },
  { id: 'fwpd', name: 'FWPD', icon: '🚔', bg: '#1b4fc4' },
  { id: 'settings', name: 'Settings', icon: '⚙', bg: '#2a2c33' },
];

export function openPhone(appId, app) {
  const st = { app: appId || null, sub: null };
  const ph = openPanel((root, h) => {
    const s = game.s;
    root.innerHTML = `<div class="phone">
      <div class="phone-status"><span>${gameTimeStr(s.time)}</span><span>${dayName(s.time)} · ${s.weather !== 'clear' ? wx(s).icon : isNight(s.time) ? '🌙' : '☀'} · 5G ▮▮▮</span></div>
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
  const s = ctx.s, ms = ensureMissions(s);
  const unread = s.messages.filter(m => !m.read).length;
  const t = tierOf(s.rep);
  const offers = ms.offers.filter(o => o.expires > missionNow(s)).length;
  const badge = { messages: unread, fwpd: hasWarrant(s) ? s.warrants.length : 0, missions: ms.active ? '!' : offers };
  // lock-screen style cards: where you stand with FWPD, the job you're on, where the GPS is taking you
  const warr = hasWarrant(s), cites = s.citations?.length || 0;
  const a = ms.active, stop = currentStop(s);
  const latest = s.messages.find(m => !m.read);
  scr.innerHTML = `<div class="phone-wall"><div class="who">${esc(s.player.name)}</div>
    <div class="sub">${fmtMoney(s.cash)} cash · ${fmtMoney(s.bank)} bank · ${t.name} · ${s.followers.toLocaleString()} followers</div></div>
    <div class="phone-widgets">
      <button class="pw ${warr ? 'pw-bad' : 'pw-ok'}" data-action="open" data-id="fwpd"><small>🚔 FWPD status</small><b>${warr ? `${s.warrants.length} warrant${s.warrants.length > 1 ? 's' : ''}${hasFelony(s) ? ' · felony' : ''}` : 'No warrants'}</b><span>${warr ? 'Patrols are running your plate' : cites ? `${cites} unpaid ticket${cites > 1 ? 's' : ''}` : 'You\'re clean'}</span></button>
      <button class="pw ${a ? (a.hot ? 'pw-hot' : 'pw-job') : ''}" data-action="open" data-id="missions"><small>📦 Mission</small><b>${a ? esc(a.title) : offers ? `${offers} offer${offers > 1 ? 's' : ''}` : 'No job'}</b><span>${a ? `${fmtLeft(timeLeft(s))} · ${esc(stop?.name || '')}` : offers ? 'Tap to see who\'s asking' : 'Jobs come by text'}</span></button>
      <button class="pw ${latest ? '' : 'pw-wide'}" data-action="open" data-id="map"><small>🗺 GPS</small><b>${s.gps ? esc(s.gps.label) : 'Not set'}</b><span>${s.gps ? 'Tap for the route' : 'Tap to pick a place'}</span></button>
      ${latest ? `<button class="pw" data-action="text" data-id="${esc(latest.from)}"><small>💬 ${esc(whoIs(latest.from).name)}</small><span>${esc(latest.text)}</span></button>` : ''}
    </div>
    <div class="phone-home">${APPS.map(ap => `<button class="app" data-action="open" data-id="${ap.id}"><i style="background:${ap.bg}">${ap.icon}</i>${ap.name}${badge[ap.id] ? `<span class="badge">${badge[ap.id]}</span>` : ''}</button>`).join('')}</div>`;
  bind(scr, {
    open: d => {
      if (d.id === 'partshub') { ctx.h.close(); openPartsHub(ctx.app); return; }
      if (d.id === 'settings') { openSettings(ctx.app); return; }
      ctx.go(d.id);
    },
    text: d => ctx.go('messages', d.id),
  });
}

const RENDER = {};
RENDER.hustle = renderHustle;
RENDER.shop = renderShop;
RENDER.ocrew = renderOcrew;
RENDER.turf = renderTurf;
RENDER.gang = renderGang;

// ---------------- messages ----------------
// Conversations, one per sender, newest first. Open one to read the thread as
// chat bubbles; offers (races, missions, sponsors) answer right in the thread.
const whoIs = id => id === 'marketplace' ? { name: 'Marketplace', color: '#1877f2' } : id === 'partshub' ? { name: 'PartsHub', color: '#e0192e' } : id === 'insurance' ? { name: 'Cowtown Mutual Insurance', color: '#1f8f3a' } : id === 'hustle' ? { name: 'Hustle', color: '#0f6b4f' } : contactInfo(id);
function msgAction(s, m) {
  const a = m.action;
  if (!a) return '';
  if (a.type === 'gps') return `<button class="btn btn-sm" data-action="gps" data-loc="${a.loc}">📍 Set GPS</button>`;
  if (a.type === 'challenge') {
    const ch = a.challenge;
    return ch.expires < s.time.day ? '<span class="tag">Expired</span>' : s.challenge?.id === ch.id ? '<span class="tag tag-green">Accepted — go to the spot</span>'
      : `<button class="btn btn-sm btn-primary" data-action="accept" data-id="${m.id}">Accept</button> <button class="btn btn-sm" data-action="decline" data-id="${m.id}">Decline</button>`;
  }
  if (a.type === 'mission') {
    const ms = ensureMissions(s);
    if (ms.active?.id === a.id) return `<span class="tag tag-green">On it · ${fmtLeft(timeLeft(s))} left</span> <button class="btn btn-sm" data-action="mgps">📍 GPS</button>`;
    const o = offerById(s, a.id);
    if (!o || o.expires <= missionNow(s)) return '<span class="tag">Closed</span>';
    return `<button class="btn btn-sm btn-primary" data-action="maccept" data-id="${a.id}" ${ms.active ? 'disabled' : ''}>Take the job</button> <button class="btn btn-sm" data-action="mdecline" data-id="${a.id}">Pass</button>${ms.active ? '<div class="small muted" style="margin-top:4px">Finish your current job first.</div>' : ''}`;
  }
  if (a.type === 'offer') return '<button class="btn btn-sm" data-action="offers">View offers</button>';
  if (a.type === 'sponsor' && !a.done) return `<button class="btn btn-sm btn-primary" data-action="sponsor" data-id="${m.id}">Sign deal</button>`;
  return '';
}
RENDER.messages = (scr, ctx) => {
  const s = ctx.s;
  const handlers = {
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
    maccept: d => takeMission(s, d.id, ctx),
    mdecline: d => { declineMission(s, d.id); ctx.h.refresh(); },
    mgps: () => { pointGps(s, ctx.app.world); ctx.h.close(); },
    offers: () => ctx.go('marketplace', 'selling'),
    sponsor: d => {
      const m = s.messages.find(x => x.id === d.id);
      s.sponsor = { ...m.action.deal, until: s.time.day + m.action.deal.days };
      m.action.done = true;
      toast(`Signed with ${m.action.deal.name}: ${fmtMoney(m.action.deal.perWin)} per win`, 'good');
      ctx.h.refresh();
    },
  };
  if (ctx.st.sub) {
    const from = ctx.st.sub, w = whoIs(from);
    const thread = s.messages.filter(m => m.from === from).reverse();
    scr.innerHTML = `<div class="app-head"><button class="back" data-action="back">‹ Back</button><span class="avatar" style="background:${w.color}">${esc(w.name[0])}</span><h2>${esc(w.name)}</h2></div>
      <div class="app-body chat">${thread.map((m, i) => {
        const day = i === 0 || thread[i - 1].day !== m.day ? `<div class="chat-day">Day ${m.day}</div>` : '';
        const act = msgAction(s, m);
        return `${day}<div class="bubble ${m.read ? '' : 'unread'}"><p>${esc(m.text)}</p>${act ? `<div class="row bubble-act">${act}</div>` : ''}<small>${m.t}</small></div>`;
      }).join('') || '<div class="empty">No messages.</div>'}</div>`;
    thread.forEach(m => { m.read = true; });
    wire(scr, ctx, handlers);
    const body = scr.querySelector('.chat'); scr.scrollTop = scr.scrollHeight; if (body) body.lastElementChild?.scrollIntoView?.({ block: 'end' });
    return;
  }
  const convos = [];
  for (const m of s.messages) {
    let c = convos.find(x => x.from === m.from);
    if (!c) convos.push(c = { from: m.from, last: m, unread: 0, offer: false });
    if (!m.read) c.unread++;
    if (msgAction(s, m).includes('btn-primary')) c.offer = true;
  }
  scr.innerHTML = head('Messages') + `<div class="app-body">${convos.length ? `<div class="list">${convos.map(c => {
    const w = whoIs(c.from);
    return `<div class="li click convo ${c.unread ? 'unread' : ''}" data-action="open" data-id="${esc(c.from)}"><span class="avatar" style="background:${w.color}">${esc(w.name[0])}</span><div class="grow"><div class="t">${esc(w.name)}${c.offer ? ' <span class="tag tag-yellow">Offer</span>' : ''}</div><div class="s">${esc(c.last.text)}</div></div><div class="convo-meta"><small>${c.last.day === s.time.day ? c.last.t : 'Day ' + c.last.day}</small>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div></div>`;
  }).join('')}</div>` : '<div class="empty">No messages yet.</div>'}</div>`;
  wire(scr, ctx, { open: d => ctx.go('messages', d.id) });
};

function takeMission(s, id, ctx) {
  const r = acceptMission(s, id, ctx.app.world);
  if (!r.ok) { toast(r.why, 'bad'); ctx.h.refresh(); return; }
  const l = currentStop(s);
  toast(`Job on: ${r.mission.title}. First stop ${l.name}. ${fmtLeft(r.mission.limit)} on the clock.`, 'good');
  ctx.h.close();
}

// ---------------- missions ----------------
RENDER.missions = (scr, ctx) => {
  const s = ctx.s, ms = ensureMissions(s);
  ms.offers = ms.offers.filter(o => o.expires > missionNow(s));
  const a = ms.active, l = currentStop(s);
  const stopsHtml = o => o.stops.map((id, i) => `<div class="mstop ${a && a.id === o.id ? (i < a.stage ? 'done' : i === a.stage ? 'now' : '') : ''}"><b>${i + 1}</b><span>${esc(LOC_BY_ID[id].name)}</span></div>`).join('');
  scr.innerHTML = head('Missions') + `<div class="app-body">
    ${a ? `<div class="section-title">On the job</div>
      <div class="mission on ${a.hot ? 'hot' : ''}"><div class="row"><span class="avatar" style="background:${whoIs(a.from).color}">${esc(whoIs(a.from).name[0])}</span><div class="grow"><b>${esc(a.title)}${a.hot ? ' 🔥' : ''}</b><div class="small muted">for ${esc(whoIs(a.from).name)} · ${fmtMoney(a.pay)}</div></div><div class="mclock ${timeLeft(s) < 5 ? 'bad' : ''}">${fmtLeft(timeLeft(s))}</div></div>
        <div class="small" style="margin:6px 0">▶ ${esc(stopLabel(a))} at <b>${esc(l?.name || '')}</b></div>
        ${stopsHtml(a)}
        ${a.hot ? '<p class="small bad">The package is hot. Drive clean; getting busted ends the job.</p>' : ''}
        <div class="row" style="gap:6px;margin-top:8px"><button class="btn btn-sm btn-primary" data-action="mgps">📍 GPS to next stop</button><button class="btn btn-sm btn-danger" data-action="quit">Bail on it</button></div></div>` : ''}
    <div class="section-title">Offers (${ms.offers.length})</div>
    ${ms.offers.length ? ms.offers.map(o => `<div class="mission ${o.hot ? 'hot' : ''}"><div class="row"><span class="avatar" style="background:${whoIs(o.from).color}">${esc(whoIs(o.from).name[0])}</span><div class="grow"><b>${esc(o.title)}${o.hot ? ' 🔥' : ''}</b><div class="small muted">${esc(whoIs(o.from).name)} · closes in ${fmtLeft(o.expires - missionNow(s))}</div></div><b class="good">${fmtMoney(o.pay)}</b></div>
        <p class="small">${esc(o.text)}</p>${stopsHtml(o)}
        <div class="row" style="gap:6px;margin-top:8px"><button class="btn btn-sm btn-primary" data-action="maccept" data-id="${o.id}" ${a ? 'disabled' : ''}>Take the job</button><button class="btn btn-sm" data-action="mdecline" data-id="${o.id}">Pass</button></div></div>`).join('')
      : `<p class="muted small">${s.activeCar ? 'No offers right now. People you know text you jobs every few hours.' : 'Get a car first. Nobody texts a job to someone without wheels.'}</p>`}
    <div class="section-title">Record</div>
    <div class="kv"><span>Jobs done</span><span>${ms.done}</span><span>Failed</span><span>${ms.failed}</span><span>Earned</span><span>${fmtMoney(ms.earned)}</span></div>
    ${ms.log.length ? `<div class="list" style="margin-top:6px">${ms.log.slice(0, 8).map(e => `<div class="li"><span>${e.ok ? '✅' : '❌'}</span><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${esc(whoIs(e.from).name)} · Day ${e.day} · ${e.t}${e.ok ? '' : ' · ' + ({ late: 'out of time', busted: 'busted', quit: 'bailed' }[e.why] || e.why)}</div></div>${e.ok ? `<b class="good">+${fmtMoney(e.pay)}</b>` : ''}</div>`).join('')}</div>` : ''}</div>`;
  wire(scr, ctx, {
    maccept: d => takeMission(s, d.id, ctx),
    mdecline: d => { declineMission(s, d.id); ctx.h.refresh(); },
    mgps: () => { pointGps(s, ctx.app.world); ctx.h.close(); },
    quit: async () => { if (await confirm('Bail on the job?', `<p>${esc(whoIs(a.from).name)} won't be happy. You lose some rep.</p>`, 'Bail', true)) { abandonMission(s, ctx.app.world); ctx.h.refresh(); } },
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
  scr.innerHTML = head('Cowtown Credit Union') + `<div class="app-body">
    <div class="stats-row"><div><div class="stat-lbl">Cash</div><div class="stat-big">${fmtMoney(s.cash)}</div></div><div><div class="stat-lbl">Checking</div><div class="stat-big">${fmtMoney(s.bank)}</div></div></div>
    <div class="row" style="margin:10px 0"><button class="btn btn-sm" data-action="dep">Deposit</button><button class="btn btn-sm" data-action="wd">Withdraw</button></div>
    <div class="stats-row"><div><div class="stat-lbl">Earned</div><b class="good">${fmtMoney(s.stats.earnings)}</b></div><div><div class="stat-lbl">Spent</div><b class="bad">${fmtMoney(s.stats.expenses)}</b></div><div><div class="stat-lbl">Net worth</div><b>${fmtMoney(s.cash + s.bank + s.cars.reduce((a, c) => a + carValue(c), 0))}</b></div></div>
    <div class="section-title">Insurance</div>
    <div class="li"><div class="grow"><div class="t">Cowtown Mutual — Full coverage</div><div class="s">${fmtMoney(ins)}/week. Covers 70% of repairs and 25% of police impound fines.</div></div>
      <button class="btn btn-sm ${s.insurance ? '' : 'btn-primary'}" data-action="ins">${s.insurance ? 'Cancel' : 'Buy'}</button></div>
    <div class="section-title">Roadside</div>
    <div class="li"><div class="grow"><div class="t">Gas delivery (2 gal)</div><div class="s">$45 — when you're stranded</div></div><button class="btn btn-sm" data-action="gas" ${car ? '' : 'disabled'}>Call</button></div>
    <div class="li"><div class="grow"><div class="t">Mobile mechanic</div><div class="s">${fmtMoney(MECHANIC_COST)} — ${car?.broken ? (BREAKDOWNS[car.broken].roadside ? `<b class="bad">${BREAKDOWNS[car.broken].name}.</b> Tops up the oil and gets it running` : `<b class="bad">${BREAKDOWNS[car.broken].name}.</b> Can't fix that on the side of the road. Tow it.`) : 'when your car breaks down'}</div></div><button class="btn btn-sm ${car?.broken && BREAKDOWNS[car.broken].roadside ? 'btn-primary' : ''}" data-action="mech" ${car?.broken && BREAKDOWNS[car.broken].roadside ? '' : 'disabled'}>Call</button></div>
    <div class="li"><div class="grow"><div class="t">Tow to Second Chance Collision</div><div class="s">$185 flat rate</div></div><button class="btn btn-sm" data-action="tow" ${car ? '' : 'disabled'}>Call</button></div>
    <div class="section-title">Recent activity</div>
    <div class="list">${s.ledger.slice(0, 40).map(l => `<div class="li"><div class="grow"><div class="t">${esc(l.label)}</div><div class="s">Day ${l.day} · ${l.t}</div></div><b class="${l.amount > 0 ? 'good' : l.amount < 0 ? 'bad' : ''}">${l.amount ? (l.amount > 0 ? '+' : '') + fmtMoney(l.amount, true) : ''}</b></div>`).join('') || '<div class="empty">Nothing yet</div>'}</div></div>`;
  wire(scr, ctx, {
    dep: async () => { const v = await prompt('Deposit', `<p>Cash on hand: ${fmtMoney(s.cash)}</p>`, 'Amount', String(Math.floor(s.cash))); if (v) { deposit(s, +v.replace(/\D/g, '')); ctx.h.refresh(); } },
    wd: async () => { const v = await prompt('Withdraw', `<p>Checking: ${fmtMoney(s.bank)}</p>`, 'Amount', String(Math.floor(s.bank))); if (v) { withdraw(s, +v.replace(/\D/g, '')); ctx.h.refresh(); } },
    ins: () => { s.insurance = !s.insurance; toast(s.insurance ? 'Insured. First premium due at the end of the week.' : 'Policy cancelled', 'info'); ctx.h.refresh(); },
    gas: () => { if (spend(s, 45, 'Roadside gas delivery')) { const c = activeCar(s); c.fuel = Math.min(1, c.fuel + 2 / 14); toast('Gas delivered. Find a station soon.', 'good'); ctx.h.refresh(); } },
    mech: () => {
      const c = activeCar(s);
      if (!c?.broken || !spend(s, MECHANIC_COST, 'Mobile mechanic')) return;
      roadsideFix(c); s.time.min += 30; ctx.app.world?.refreshCar();
      toast('Mechanic got it running. Get an oil change and a real repair soon.', 'good'); ctx.h.refresh();
    },
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
  { at: 3000, name: 'Cowtown Tire & Wheel', perWin: 450, days: 14, contact: 'kingpin' },
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
  const spots = LOCATIONS.filter(l => l.type === 'roll' || l.type === 'drag' || l.type === 'meet' || l.type === 'sprint');
  scr.innerHTML = head('Races') + `<div class="app-body">
    <div class="stats-row"><div><div class="stat-lbl">Record</div><b>${s.stats.wins}W – ${s.stats.losses}L</b></div><div><div class="stat-lbl">Racing level</div><b>${racingLevel(s.xp)}</b></div><div><div class="stat-lbl">Best ET</div><b>${s.stats.bestEt ? s.stats.bestEt.toFixed(3) + 's' : '—'}</b></div></div>
    ${s.challenge ? `<div class="section-title">Accepted</div><div class="li"><div class="grow"><div class="t">${esc(RACER_BY_ID[s.challenge.npcId].name)} — ${s.challenge.type === 'drag' ? 'Drag' : s.challenge.roll + '-roll'} for ${fmtMoney(s.challenge.wager)}</div><div class="s">${esc(LOC_BY_ID[s.challenge.loc].name)}</div></div><button class="btn btn-sm" data-action="gps" data-loc="${s.challenge.loc}">📍</button></div>` : ''}
    <div class="section-title">Challenges (${open.length})</div>
    ${open.length ? open.map(m => `<div class="li"><div class="grow"><div class="t">${esc(RACER_BY_ID[m.action.challenge.npcId].name)}</div><div class="s">${esc(m.text)}</div></div></div>`).join('') + '<p class="small muted">Accept them in Messages.</p>' : '<p class="muted small">No open challenges. Win races and they\'ll come to you.</p>'}
    <div class="section-title">Spots</div>
    <div class="list">${spots.map(l => {
      const locked = (l.tier || 1) > tier;
      return `<div class="li click" data-action="gps" data-loc="${l.id}"><div class="grow"><div class="t">${esc(l.name)} ${locked ? `<span class="tag tag-red">Tier ${l.tier}</span>` : ''}</div><div class="s">${l.type === 'meet' ? (l.weekend ? 'Weekend night meet · Fri & Sat, 9 PM to 3 AM · crews, spotlight, races' : 'Street meet · after 8 PM') : l.type === 'drag' ? 'Sanctioned drag strip · test & tune, bracket races' : l.type === 'sprint' ? `Street race · ${STREET_RACE_BY_ID[l.race].kind === 'circuit' ? 'circuit' : 'sprint'} · ${s.streetRecords?.[l.race] ? 'your best ' + fmtRaceTime(s.streetRecords[l.race]) : 'cash or pink slips'}` : 'Roll racing · ' + esc(ROADS[l.road]?.desc || '')}</div></div><span>📍</span></div>`;
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
      <div class="row" style="gap:6px"><button class="btn btn-sm btn-primary" data-action="turf">🚩 Turf · ${myHoods(s).length} hood${myHoods(s).length === 1 ? '' : 's'}</button><button class="btn btn-danger btn-sm" data-action="leave">Leave crew</button></div></div>`;
    wire(scr, ctx, {
      turf: () => ctx.go('turf'),
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
    return `<div class="li"><div class="grow"><div class="t">${esc(carName(m, c.year))} ${c.stolen ? '<span class="tag tag-red">Stolen</span>' : c.uid === s.activeCar ? '<span class="tag tag-green">Driving</span>' : ''}</div><div class="s">${Math.round(c.miles).toLocaleString()} mi · ${mt.cls} ${mt.pi} · worth ~${fmtMoney(carValue(c))}</div></div></div>`;
  }).join('') || '<div class="empty">No cars yet. Try Marketplace.</div>'}</div>
  <p class="small muted">Switch cars, install parts and tune at your home garage. Torque Temple and Vega Kustoms can install anything.</p>
  <div class="row"><button class="btn btn-sm" data-action="home">📍 Home</button><button class="btn btn-sm" data-action="view" ${s.cars.length ? '' : 'disabled'}>View specs</button></div></div>`;
  wire(scr, ctx, {
    home: () => { const l = LOC_BY_ID[s.home]; ctx.app.world?.setGps(l.x, l.z, 'Home'); ctx.h.close(); },
    view: () => openGarage(ctx.app, { readOnly: true }),
  });
};

// ---------------- FWPD: your record, pay tickets ----------------
RENDER.fwpd = (scr, ctx) => {
  const s = ctx.s, w = ctx.app.world;
  const due = payableTotal(s), chase = !!w?.police.active;
  scr.innerHTML = head('FWPD') + `<div class="app-body">
    <div class="warrant-status ${hasWarrant(s) ? 'on' : ''}">${hasWarrant(s) ? `${s.warrants.length} OPEN WARRANT${s.warrants.length > 1 ? 'S' : ''}${hasFelony(s) ? ' · FELONY' : ''}` : 'NO WARRANTS'}</div>
    <p class="small muted">Fort Worth Police Department · online citation payments</p>
    ${recordHtml(s)}
    ${due ? `<button class="btn btn-primary" style="width:100%;margin-top:10px" data-action="pay" ${chase ? 'disabled' : ''}>Pay ${fmtMoney(due)}</button>` : ''}
    ${chase ? '<p class="small bad">Payments are closed while you\'re being pursued.</p>' : ''}
    ${hasFelony(s) ? '<p class="small muted">Felony warrants can\'t be paid online. Turn yourself in at a precinct (25% off the fines), or wait to get arrested.</p>' : hasWarrant(s) ? '<p class="small muted">While a warrant is open, patrols run your plate and recognise you on sight. A traffic stop becomes an arrest.</p>' : ''}
    <button class="btn" style="width:100%;margin-top:6px" data-action="gps">📍 Nearest precinct</button></div>`;
  wire(scr, ctx, {
    pay: () => { const r = payFines(s); if (r.ok) { toast(`Paid ${fmtMoney(r.total)} to FWPD`, 'good'); ctx.h.refresh(); } },
    courtgps: () => { const l = LOC_BY_ID.courthouse; w?.setGps(l.x, l.z, l.name); ctx.h.close(); },
    gps: () => {
      const p = w?.playerState(); if (!p) return;
      const l = ['pspd_central', 'pspd_harbor'].map(id => LOC_BY_ID[id]).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      w.setGps(l.x, l.z, l.name); ctx.h.close();
    },
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
