// Weekend car shows at the Stockyards: enter your build, look over everyone
// else's, cast your People's Choice vote, then watch the crowd's votes come
// in. Judging and voting live in core/carshow.js.

import { openPanel, bind, esc, toast, modal } from './dom.js';
import { game, fmtMoney, spend, earn, activeCar, modelOf, levels, tierOf, addRep, addFollowers, dayName } from '../core/state.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { drawThumb } from './marketplace.js';
import { drawSideCar } from '../gfx2d/sideCar.js';
import { judge, makeEntrants, crowdVote, tally, prizeFor, isShowTime, ENTRY_FEE, SHOW_OPEN, SHOW_CLOSE, THEME_NAMES } from '../core/carshow.js';
import { LOC_BY_ID } from '../data/world.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const PLACE = ['', '1st', '2nd', '3rd'];
const SCORE_LABELS = { paint: 'Paint', wheels: 'Wheels', body: 'Body & aero', details: 'Details', engine: 'Under the hood', cohesion: 'Hangs together', condition: 'Condition', rarity: 'Rarity' };

export function showRecord(s) { return (s.shows ??= { day: 0, entered: 0, trophies: [] }); }

export function openCarShow(loc, app) {
  const s = game.s;
  const rec = showRecord(s);
  const trophies = rec.trophies.length ? `<p class="small">Your trophies: ${rec.trophies.map(t => `🏆 ${PLACE[t.place]} · ${esc(t.car)}`).join('<br>')}</p>` : '';
  if (!isShowTime(s.time, dayName(s.time))) {
    modal(loc.name, `<p>The lot is empty. The show runs every <b>Saturday and Sunday, ${SHOW_OPEN} AM to ${SHOW_CLOSE - 12} PM</b>. Today is ${dayName(s.time)}.</p>
      <p class="small muted">Bring your cleanest build. The crowd votes, and the top three take home cash and a trophy. Vega Kustoms can get your car ready.</p>${trophies}`);
    return;
  }
  const car = activeCar(s);
  if (!car) { modal(loc.name, '<p>You walk the rows. Nice cars. You need one of your own to enter.</p>'); return; }
  if (rec.day === s.time.day) { modal(loc.name, `<p>You already showed today. Come back next weekend with something new.</p>${trophies}`); return; }
  const tier = tierOf(s.rep).n;
  const st = { phase: 'enter', tier, entrants: makeEntrants(tier), vote: null, result: null, shown: 0 };
  return openPanel((root, h) => render(root, h, app, st, s, car, loc), { onClose: () => clearInterval(st.timer) });
}

function entriesOf(st, s, car) {
  const me = { id: 'me', name: `${s.player.name} (you)`, modelId: car.modelId, year: car.year, visual: car.visual, cond: car.cond, levels: levels(car), me: true, parts: car.parts };
  return [...st.entrants, me];
}

function render(root, h, app, st, s, car, loc) {
  const m = modelOf(car);
  const entries = entriesOf(st, s, car);
  const sc = judge(m, car.visual, car.cond, levels(car));
  const p1 = prizeFor(1, st.tier);
  if (st.phase === 'enter') {
    root.innerHTML = head(loc.name, `Weekend car show · ${entries.length} cars · People's Choice`) + `<div class="p-body"><div class="garage"><div>
      <div class="showroom"><div class="sr-stage"><canvas data-side></canvas></div></div></div><div>
      <p>Park it on the lot, pop the hood and let the crowd decide. About 240 people walk the rows and every one of them votes for one car.</p>
      <div class="kv"><span>Entry</span><span>${fmtMoney(ENTRY_FEE)}</span><span>1st place</span><span>${fmtMoney(p1.cash)} · +${p1.rep} rep · trophy</span><span>2nd / 3rd</span><span>${fmtMoney(prizeFor(2, st.tier).cash)} / ${fmtMoney(prizeFor(3, st.tier).cash)}</span><span>Your show score</span><span><b>${sc.total}</b></span></div>
      <div class="ks-bars" style="margin-top:8px">${Object.entries(sc.parts).map(([k, v]) => `<div><span>${SCORE_LABELS[k]}</span><i style="width:${Math.max(0, Math.min(100, v * 5))}%" class="${v < 0 ? 'neg' : ''}"></i><b>${v}</b></div>`).join('')}</div>
      <p class="small muted">The crowd likes builds that hang together. Every voter has a taste, so the best score usually wins but not always.</p>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn btn-primary" data-action="enter">Enter · ${fmtMoney(ENTRY_FEE)}</button><button class="btn" data-action="kustoms">Fix it up at Vega Kustoms first</button></div>
      </div></div></div>`;
    drawSideCar(root.querySelector('[data-side]'), { model: m, visual: car.visual, levels: levels(car), cond: car.cond });
    bind(root, {
      close: () => h.close(),
      enter: () => {
        if (!spend(s, ENTRY_FEE, 'Car show entry')) return;
        const rec = showRecord(s);
        rec.day = s.time.day; rec.entered++;
        st.phase = 'vote'; h.refresh();
      },
      kustoms: () => { const l = LOC_BY_ID.vega_kustoms; app.world?.setGps(l.x, l.z, 'Vega Kustoms'); toast('GPS set to Vega Kustoms', 'info'); h.close(); },
    });
    return;
  }
  const votes = st.result ? tally(st.result.ballots.slice(0, st.shown), entries.length) : null;
  const max = Math.max(1, ...(votes || [1]));
  const done = st.result && st.shown >= st.result.ballots.length;
  const sub = st.phase === 'vote' ? 'Cast your People\'s Choice vote' : done ? 'Results' : 'The crowd is voting…';
  root.innerHTML = head(loc.name, sub) + `<div class="p-body">
    ${st.phase === 'vote' ? '<p>Walk the rows. Tap <b>Look</b> to see a build up close, then vote for your favorite. You can\'t vote for yourself.</p>' : ''}
    ${done ? resultsHtml(st, entries) : ''}
    <div class="cs-lineup">${entries.map((e, i) => {
      const em = CAR_BY_ID[e.modelId];
      return `<div class="cs-car ${e.me ? 'me' : ''} ${st.vote === i ? 'voted' : ''}"><canvas width="320" height="180" data-thumb="${i}"></canvas>
        <div class="t">${esc(e.name)}</div><div class="s">${esc(carName(em, e.year))}${e.theme ? ` · ${THEME_NAMES[e.theme]}` : ''}</div>
        ${votes ? `<div class="cs-votes"><div class="bar"><div data-bar="${i}" style="width:${votes[i] / max * 100}%"></div></div><b data-v="${i}">${votes[i]}</b></div>` : ''}
        <div class="row"><button class="btn btn-sm" data-action="look" data-i="${i}">Look</button>${st.phase === 'vote' && !e.me ? `<button class="btn btn-sm btn-primary" data-action="vote" data-i="${i}">Vote</button>` : ''}${st.vote === i ? '<span class="small">Your vote</span>' : ''}</div></div>`;
    }).join('')}</div>
    ${done ? '<div class="row" style="margin-top:12px"><button class="btn btn-primary" data-action="close">Done</button></div>' : ''}</div>`;
  entries.forEach((e, i) => drawThumb(root.querySelector(`[data-thumb="${i}"]`), CAR_BY_ID[e.modelId], e.visual, e.parts || {}, e.cond));
  bind(root, {
    close: () => h.close(),
    look: x => {
      const e = entries[+x.i], em = CAR_BY_ID[e.modelId];
      const j = judge(em, e.visual, e.cond, e.levels);
      const id = 'cs' + Math.random().toString(36).slice(2);
      const v = e.visual;
      modal(`${e.name}`, `<p class="muted small">${esc(carName(em, e.year))}</p><div class="showroom"><div class="sr-stage"><canvas id="${id}"></canvas></div></div>
        <div class="kv" style="margin-top:8px;text-transform:capitalize"><span>Paint</span><span>${esc(v.finish)} <span class="swatch" style="width:14px;height:14px;vertical-align:middle;background:${v.paint}"></span></span><span>Wheels</span><span>${esc(v.wheels)} ${esc(String(v.wheelSize || ''))}" ${esc(v.offset || '')}</span><span>Body</span><span>${esc(v.kit)} kit · ${esc(v.spoiler)} wing</span><span>Tint</span><span>${esc(v.tint)}</span><span>Graphics</span><span>${esc(v.decal)}</span></div>
        ${st.phase !== 'vote' ? `<p>Show score <b>${j.total}</b></p>` : ''}`);
      setTimeout(() => { const c = document.getElementById(id); if (c) drawSideCar(c, { model: em, visual: e.visual, levels: e.levels, cond: e.cond }); }, 0);
    },
    vote: x => {
      st.vote = +x.i;
      const ballots = crowdVote(entries);
      // your ballot lands somewhere in the middle of the count
      ballots.splice(Math.floor(Math.random() * ballots.length), 0, st.vote);
      const t = tally(ballots, entries.length);
      const order = entries.map((_, i) => i).sort((a, b) => t[b] - t[a]);
      const mine = order.indexOf(entries.length - 1) + 1;
      st.result = { ballots, totals: t, order, mine };
      st.phase = 'count'; st.shown = 0;
      award(s, st, entries);
      h.refresh();
      st.timer = setInterval(() => {
        st.shown = Math.min(ballots.length, st.shown + 6);
        const now = tally(ballots.slice(0, st.shown), entries.length), mx = Math.max(1, ...now);
        now.forEach((n, i) => { const b = root.querySelector(`[data-bar="${i}"]`), v = root.querySelector(`[data-v="${i}"]`); if (b) b.style.width = `${n / mx * 100}%`; if (v) v.textContent = n; });
        if (st.shown >= ballots.length) { clearInterval(st.timer); audio.buy(); h.refresh(); }
      }, 50);
    },
  });
}

// Prizes are paid the moment the votes are cast, so closing early loses nothing.
function award(s, st, entries) {
  const { mine, order } = st.result;
  const car = entries[entries.length - 1], m = CAR_BY_ID[car.modelId];
  const pz = prizeFor(mine <= 3 ? mine : 0, st.tier);
  if (pz.cash) earn(s, pz.cash, `Car show ${PLACE[mine]} place`);
  addRep(s, pz.rep, mine <= 3 ? `Car show ${PLACE[mine]}` : 'Car show');
  addFollowers(s, pz.followers);
  if (mine <= 3) showRecord(s).trophies.unshift({ place: mine, car: carName(m, car.year), day: s.time.day });
  st.goodEye = order[0] === st.vote;
  if (st.goodEye) addRep(s, 5, 'Picked the winner');
  st.prize = pz;
  emit('carShow', { place: mine, winner: mine === 1 });
}

function resultsHtml(st, entries) {
  const { mine, order, totals } = st.result;
  const pz = st.prize;
  return `<div class="card" style="margin-bottom:12px">
    <h3 style="margin-top:0">${mine <= 3 ? `🏆 You took ${PLACE[mine]} place` : `You finished ${mine}th of ${entries.length}`}</h3>
    ${order.slice(0, 3).map((i, k) => `<div style="margin:3px 0"><span class="cs-place">${PLACE[k + 1]}</span> ${esc(entries[i].name)} <span class="muted small">· ${esc(carName(CAR_BY_ID[entries[i].modelId], entries[i].year))} · ${totals[i]} votes</span></div>`).join('')}
    <p class="small" style="margin-bottom:0">${pz.cash ? `+${fmtMoney(pz.cash)} · ` : ''}+${pz.rep} rep · +${pz.followers} followers${st.goodEye ? ' · +5 rep for picking the winner' : ''}</p></div>`;
}
