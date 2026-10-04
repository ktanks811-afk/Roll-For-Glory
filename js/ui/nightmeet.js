// Weekend night meet at La Gran Plaza: a lot full of builds and crews. Walk
// the lot, pull into the spotlight for tips and rep, light up a burnout, take
// a crew callout, and set up street races that run on the real routes.
// Rules live in core/nightmeet.js.

import { openPanel, closeAllPanels, bind, esc, toast, modal, confirm, bar } from './dom.js';
import { game, fmtMoney, spend, earn, activeCar, carSpec, modelOf, levels, tierOf, addRep, addFollowers, dayName } from '../core/state.js';
import { RACERS, CREWS } from '../data/npcs.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { LOC_BY_ID } from '../data/world.js';
import { STREET_RACE_BY_ID } from '../data/streetRaces.js';
import { judge } from '../core/carshow.js';
import { meetNight, meetRecord, crowdSize, lineup, crewWithYou, spotlight, burnout, copsChance, meetRoute, callout, meetRaceBonus, CREW_POT, MAX_BURNOUTS, MEET_OPEN, MEET_CLOSE } from '../core/nightmeet.js';
import { carSprite } from '../gfx2d/carSprite.js';
import { checkSponsors } from './phone.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';

const RACER = id => RACERS.find(r => r.id === id);
const SCORE_LABELS = { paint: 'Paint', wheels: 'Wheels', body: 'Body & aero', details: 'Details', engine: 'Under the hood', cohesion: 'Hangs together', condition: 'Condition', rarity: 'Rarity' };

// One lineup per night, so leaving and coming back finds the same cars.
let tonight = null;

export function meetClosedHtml() {
  return `<p>Empty lot under the lights. The meet runs <b>Friday and Saturday nights, ${MEET_OPEN - 12} PM to ${MEET_CLOSE} AM</b>.</p>
    <p class="small muted">Crews pull in with their builds. Show yours off for tips and rep, and set up races from the lot. Tip: rest at home until night.</p>`;
}

export function openNightMeet(loc, app) {
  const s = game.s;
  const night = meetNight(s.time);
  if (!night) { modal(loc.name, meetClosedHtml()); return; }
  const car = activeCar(s);
  if (!car) { modal(loc.name, '<p>You can\'t pull up to a car meet on foot. Get a car.</p>'); return; }
  const rec = meetRecord(s);
  if (rec.busted === night) { modal(loc.name, '<p>Tape across the entrance and a cruiser parked sideways. The cops shut it down tonight. Try next weekend.</p>'); return; }
  const tier = tierOf(s.rep).n;
  if (!tonight || tonight.night !== night || tonight.tier !== tier) tonight = { night, tier, ...lineup(tier, { skip: s.crew?.npcCrew || null, mates: s.crew?.members || [] }) };
  const crowd = crowdSize(tier, night);
  const crew = crewWithYou(s);
  const st = { result: null, hype: 0 };
  s.stats.meets = (s.stats.meets || 0) + 1;
  emit('meetVisited', { loc: loc.id });
  audio.music('meet');
  let raf = 0, t = 0;
  const panel = openPanel((root, h) => render(root, h, app, loc, st, crowd, crew, tier, night), {
    cls: 'nm', onClose: () => { cancelAnimationFrame(raf); audio.music(null); },
  });
  const tick = () => {
    t += 1 / 60;
    const cv = panel.root.querySelector('[data-nmlot]');
    if (!cv) return;
    drawLot(cv, tonight.cars, activeCar(s), crew, t, !!meetRecord(s).shown);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return panel;
}

function render(root, h, app, loc, st, crowd, crew, tier, night) {
  const s = game.s;
  const rec = meetRecord(s);
  const car = activeCar(s);
  const m = modelOf(car);
  const mine = judge(m, car.visual, car.cond, levels(car)).total;
  const cars = [...tonight.cars].sort((a, b) => b.score - a.score);
  const call = !rec.called ? callout(s, tonight.cars) : null;
  const pot = CREW_POT[tier];
  const race = s.meetRace?.night === night ? s.meetRace : null;
  const crewNames = tonight.crews.map(c => CREWS[c].name).join(', ');
  root.innerHTML = `<div class="p-head"><h1>${esc(loc.name)}<small>Weekend night meet · ${dayName({ day: night })} night · ${crowd} people · ${cars.length + 1} builds · ${esc(crewNames)} rolled in</small></h1><button class="btn x" data-action="close">×</button></div>
    <canvas data-nmlot width="1200" height="300" style="width:100%;display:block;background:#0c0d10"></canvas>
    <div class="p-body"><div class="split"><div>
      <div class="section-title" style="margin-top:0">Tonight's lot</div>
      <div class="list nm-lot">${cars.map(e => {
        const r = e.racer ? RACER(e.racer) : null;
        const cr = e.crew ? CREWS[e.crew] : null;
        const raced = rec.raced.includes(e.racer);
        return `<div class="li"><span class="avatar" style="background:${e.color}">${esc(e.name[0])}</span><div class="grow"><div class="t">${esc(e.name)} ${cr ? `<span class="tag" style="border-color:${cr.color};color:${cr.color}">${esc(cr.name)}</span>` : ''}</div>
          <div class="s">${esc(carName(CAR_BY_ID[e.modelId], e.year))} · show score <b>${e.score}</b>${r ? ` · T${r.tier}` : ' · here to show'}</div></div>
          <span class="nm-btns"><button class="btn btn-sm" data-action="look" data-id="${e.id}">Look</button>${r ? `<button class="btn btn-sm btn-primary" data-action="run" data-id="${e.id}" ${raced || race ? 'disabled' : ''}>${raced ? 'Ran tonight' : 'Run it'}</button>` : ''}</span></div>`;
      }).join('')}</div>
    </div><div>
      ${race ? `<div class="card nm-race"><h3>🏁 Race set</h3><p class="small">${esc(RACER(race.npcId)?.nick || 'They')} is waiting at the start of the <b>${esc(STREET_RACE_BY_ID[race.race].name)}</b>${race.crew ? ` · crew pot ${fmtMoney(race.pot)}` : ''}. Pull up to the line and tap USE.</p><button class="btn btn-sm" data-action="gps">📍 GPS to the start</button></div>` : ''}
      <div class="section-title" ${race ? '' : 'style="margin-top:0"'}>Your crew</div>
      ${s.crew ? `<p class="small"><span class="avatar" style="background:${s.crew.color};width:16px;height:16px;display:inline-block;vertical-align:middle"></span> <b>${esc(s.crew.name)}</b> · ${crew.length ? `${crew.map(r => esc(r.nick)).join(', ')} parked next to you (+${crew.length * 6} hype)` : 'nobody rolled with you tonight'}</p>`
        : '<p class="small muted">Rolling solo. Start or join a crew in the phone\'s Crew app and they\'ll park with you, and rival crews will call you out.</p>'}
      ${call ? `<div class="card nm-call" style="border-color:${CREWS[call.crew].color}"><h3>📣 ${esc(CREWS[call.crew].name)} call you out</h3><p class="small">${esc(call.name)}: "${esc(RACER(call.racer).lines.taunt || RACER(call.racer).lines.greet)}" Crew against crew, ${fmtMoney(pot)} pot, crew rep on the line.</p>
        <div class="row"><button class="btn btn-sm btn-primary" data-action="accept" ${race ? 'disabled' : ''}>Accept</button><button class="btn btn-sm" data-action="duck">Duck it</button></div></div>` : ''}
      <div class="section-title">Spotlight</div>
      ${st.result ? resultHtml(st.result) : rec.shown ? '<p class="small">You already had the spotlight tonight.</p>' : `<p class="small muted">Pull your ${esc(m.model)} under the light. The crowd sizes it up against the lot and tips what they think it's worth. Your show score: <b>${mine}</b>.</p>
        <button class="btn btn-primary" data-action="spot" style="width:100%">Pull into the spotlight</button>`}
      <div class="section-title">Burnout</div>
      <p class="small muted">Light 'em up in the aisle. The crowd loves it and it adds hype to your spotlight, but every one makes it likelier somebody calls the cops.${s.heat >= 1 ? ' <b class="warn">You already have heat.</b>' : ''}</p>
      <button class="btn" data-action="burn" ${rec.burnouts >= MAX_BURNOUTS ? 'disabled' : ''}>🔥 Burnout (${rec.burnouts}/${MAX_BURNOUTS})</button>
      <p class="small muted">Cops show up: ${Math.round(copsChance(s.heat, rec.burnouts + 1) * 100)}% on the next one.</p>
    </div></div></div>`;

  const startRace = (e, crewRace) => {
    const ev = meetRoute(tier);
    const l = LOC_BY_ID[ev.id];
    s.meetRace = { npcId: e.racer, race: ev.id, night, crew: crewRace, pot: crewRace ? pot : 0, loc: loc.id };
    rec.raced.push(e.racer);
    app.world?.setGps(l.x, l.z, `Race ${e.nick} @ ${ev.name}`);
    toast(`${e.nick}: "${ev.name}. Follow me." GPS set`, 'good');
  };
  bind(root, {
    close: () => h.close(),
    look: d => {
      const e = tonight.cars.find(x => x.id === d.id);
      const j = judge(CAR_BY_ID[e.modelId], e.visual, e.cond, e.levels);
      const r = e.racer ? RACER(e.racer) : null;
      if (r) { const mem = s.npc[r.id] ??= { met: true, wins: 0, losses: 0, rel: 0 }; mem.rel += 1; if (!s.contacts.includes(r.id)) s.contacts.push(r.id); }
      modal(carName(CAR_BY_ID[e.modelId], e.year), `<p class="small">${esc(e.name)}${r ? ` · "${esc(r.lines.intro)}"` : ''}</p>
        <div class="kv">${Object.entries(j.parts).map(([k, v]) => `<span>${SCORE_LABELS[k]}</span><span>${v}</span>`).join('')}<span><b>Show score</b></span><span><b>${j.total}</b> (yours ${mine})</span></div>
        <p class="small muted">Vega Kustoms sells every piece on this build.</p>`);
    },
    run: d => {
      const e = tonight.cars.find(x => x.id === d.id);
      const r = RACER(e.racer);
      if (r.tier > tier + 1) { modal(r.name, `<p>"${esc(r.lines.taunt || 'Who are you?')}"</p><p class="muted small">They won't race you until you have more rep.</p>`); return; }
      startRace(e, false);
      h.close();
    },
    accept: async () => {
      if (s.cash + s.bank < pot) { toast(`You need ${fmtMoney(pot)} for the crew pot.`, 'bad'); return; }
      if (!(await confirm('Crew against crew', `<p>${esc(call.name)} runs for ${esc(CREWS[call.crew].name)}. Win and ${esc(s.crew.name)} takes the ${fmtMoney(pot)} pot and the crew rep. Lose and you pay it.</p>`, 'Run it'))) return;
      rec.called = true;
      startRace(call, true);
      h.close();
    },
    duck: () => { rec.called = true; addRep(s, -5 * tier, 'Ducked a crew callout'); if (s.crew) s.crew.rep = Math.max(0, s.crew.rep - 50 * tier); h.refresh(); },
    gps: () => { const l = LOC_BY_ID[race.race]; app.world?.setGps(l.x, l.z, `Race ${RACER(race.npcId)?.nick} @ ${STREET_RACE_BY_ID[race.race].name}`); toast('GPS set', 'info'); },
    spot: () => {
      const res = spotlight({ score: mine, lot: tonight.cars, tier, crowd, crew: crew.length, burnouts: rec.burnouts });
      rec.shown = true; rec.tips += res.tips;
      if (res.crown) rec.crowns++;
      earn(s, res.tips, 'Tips at the meet');
      addRep(s, res.rep, res.crown ? 'Best build at the meet' : 'Meet spotlight');
      addFollowers(s, res.followers);
      if (s.crew && crew.length) s.crew.rep += Math.round(res.rep * 0.5);
      if (res.crown) s.feed?.unshift({ day: s.time.day, text: `Best build at ${loc.name} tonight. ${m.model} under the lights.`, likes: res.followers * 3 });
      st.result = res;
      audio[res.hype >= 50 ? 'win' : 'buy']?.();
      checkSponsors(s);
      h.refresh();
    },
    burn: () => {
      const b = burnout({ hp: carSpec(car).hp });
      const chance = copsChance(s.heat, rec.burnouts + 1);
      rec.burnouts++;
      addFollowers(s, b.followers);
      s.heat = Math.min(5.99, s.heat + b.heat);
      car.cond.tires = Math.max(0, (car.cond.tires ?? 100) - 6);
      audio.pop?.();
      if (Math.random() < chance) {
        rec.busted = night;
        s.heat = Math.min(5.99, s.heat + 0.5);
        closeAllPanels();
        modal('Cops!', '<p>Two cruisers swing into the lot with the lights on. Everybody scatters. The meet is over tonight.</p><p class="small muted">Your heat went up. Lay low for a bit.</p>');
        return;
      }
      toast(`The crowd goes crazy · +${b.followers} followers`, 'good');
      h.refresh();
    },
  });
}

function resultHtml(r) {
  return `<div class="card nm-result"><h3>${r.crown ? '👑 Best build in the lot' : `#${r.rank} of ${r.of} on the lot`}</h3>
    <p class="small">Crowd hype ${r.hype}%</p>${bar(r.hype, r.hype >= 60 ? 'good' : '')}
    <div class="kv" style="margin-top:8px"><span>Tips</span><span class="good">+${fmtMoney(r.tips)}</span><span>Rep</span><span>+${r.rep}</span><span>Followers</span><span>+${r.followers}</span></div></div>`;
}

// Applied by the street race results when the race was set up at the meet:
// the whole lot watched it. Returns null for any other race.
export function settleMeetRace(s, { won, npcId, raceId }) {
  const mr = s.meetRace;
  if (!mr || mr.npcId !== npcId || mr.race !== raceId) return null;
  s.meetRace = null;
  const tier = tierOf(s.rep).n;
  const b = meetRaceBonus({ won, crew: mr.crew, tier, pot: mr.pot });
  if (b.cash > 0) earn(s, b.cash, 'Crew pot at the meet');
  if (b.cash < 0) spend(s, -b.cash, 'Lost the crew pot');
  if (b.rep) addRep(s, b.rep, won ? (mr.crew ? 'Won the crew callout' : 'Won in front of the meet') : 'Lost the crew callout');
  addFollowers(s, b.followers);
  if (s.crew && b.crewRep) s.crew.rep += b.crewRep;
  if (won) { const r = meetRecord(s); r.wins = (r.wins || 0) + 1; }
  return { ...b, crew: mr.crew, pot: mr.pot };
}

function drawLot(cv, lot, car, crew, t, shown) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  g.fillStyle = '#121317'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2;
  for (let x = 40; x < W; x += 110) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x, 110); g.moveTo(x, 190); g.lineTo(x, 284); g.stroke(); }
  // sodium lot lights
  for (let x = 150; x < W; x += 300) {
    const gr = g.createRadialGradient(x, 150, 0, x, 150, 220);
    gr.addColorStop(0, 'rgba(255,190,120,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - 220, 0, 440, H);
  }
  const cars = lot.slice(0, 9).map(e => ({ m: CAR_BY_ID[e.modelId], v: e.visual, lv: e.levels, cond: e.cond, crew: e.crew ? CREWS[e.crew].color : null }));
  if (car) cars.splice(4, 0, { m: modelOf(car), v: car.visual, lv: levels(car), cond: car.cond, mine: true });
  // the spotlight: on your car once you've pulled in, sweeping the lot before that
  const mineIdx = cars.findIndex(c => c.mine);
  const pos = i => ({ x: 95 + Math.floor(i / 2) * 220 + (i % 2 ? 110 : 0), y: i % 2 ? 236 : 64, top: i % 2 === 0 });
  const sx = shown && mineIdx >= 0 ? pos(mineIdx).x : W / 2 + Math.sin(t * 0.7) * W * 0.42;
  const sy = shown && mineIdx >= 0 ? pos(mineIdx).y : 150 + Math.cos(t * 0.9) * 90;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 90);
  sg.addColorStop(0, 'rgba(255,255,240,0.32)'); sg.addColorStop(1, 'rgba(255,255,240,0)');
  g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, 90, 0, Math.PI * 2); g.fill();
  cars.forEach((c, i) => {
    const { x, y, top } = pos(i);
    if (x > W - 40) return;
    const sp = carSprite(c.m, c.v, c.lv, c.cond);
    const k = 9 / sp.px;
    if (c.v.neon && c.v.neon !== 'none') {
      const gr = g.createRadialGradient(x, y, 0, x, y, 60);
      gr.addColorStop(0, c.v.neon); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.5 + Math.sin(t * 3 + i) * 0.1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, 60, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    }
    g.save(); g.translate(x, y); g.rotate(top ? Math.PI : 0); g.scale(k, k);
    g.drawImage(sp.canvas, -sp.canvas.width / 2, -sp.canvas.height / 2); g.restore();
    // crew flag on the windshield banner
    if (c.crew) { g.fillStyle = c.crew; g.fillRect(x - 22, top ? 112 : 182, 44, 5); }
    if (c.mine) { g.fillStyle = '#ff2a3a'; g.font = 'bold 15px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('YOU', x, top ? 130 : 176); }
    // people crowding the good ones
    const n = c.mine ? 3 + crew.length + (shown ? 4 : 0) : 2;
    for (let p = 0; p < n; p++) {
      const px = x + 38 + (p % 4) * 10, py = y + (top ? 44 : -44) + Math.floor(p / 4) * 10 * (top ? 1 : -1) + Math.sin(t * 2 + i + p) * 2;
      g.fillStyle = ['#c41b1b', '#e8e8e8', '#1b4fc4', '#222', '#e8c21a'][(i + p) % 5]; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a5a3c'; g.beginPath(); g.arc(px, py, 2.5, 0, Math.PI * 2); g.fill();
    }
  });
}
