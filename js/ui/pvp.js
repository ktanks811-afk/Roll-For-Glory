// Racing real players: the challenge screen, the invite you get, and handing
// both cars to the race scene. Rules and transport are in net/pvp.js.

import { openPanel, closeAllPanels, bind, esc, toast, modal } from './dom.js';
import { game, fmtMoney, activeCar, carSpec, modelOf, levels, tierOf } from '../core/state.js';
import { carName } from '../data/cars.js';
import { ROADS } from '../data/world.js';
import { buildSpec } from '../sim/powertrain.js';
import { Race } from '../race2d/race.js';
import { online } from '../net/online.js';
import { pvp, RaceLink, PVP_ROLLS, PVP_DISTS, PVP_WAGERS } from '../net/pvp.js';
import { audio } from '../core/audio.js';

const DIST_NAME = { eighth: '1/8 mile', quarter: '1/4 mile', half: '1/2 mile' };
export const describe = c => c.type === 'drag' ? `${DIST_NAME[c.dist]} drag race` : `${c.roll} mph roll race, ${DIST_NAME[c.dist]}`;
const stakes = c => c.wager ? `for ${fmtMoney(c.wager)}` : 'for bragging rights';

// Can you race right now? null = yes, else why not.
function cantRace(app, wager = 0) {
  const s = game.s, car = activeCar(s), w = app.world;
  if (!s || !w) return 'Get out on the map first.';
  if (app.race || app.mode === 'race') return 'You\'re already racing.';
  if (!car) return 'You need a car.';
  if (!w.inCar) return 'Get in your car first.';
  if (w.police?.active) return 'Lose the cops first.';
  if (car.fuel < 0.05) return 'You\'re out of gas.';
  if (car.broken || car.engineBlown) return 'Your car is broken down.';
  if (wager > (s.cash || 0) + (s.bank || 0)) return `You can't cover ${fmtMoney(wager)}.`;
  return null;
}

export function initPvp(app) {
  pvp.busy = () => !!app.race || app.mode === 'race';
  pvp.on(async (ev, d) => {
    if (ev === 'invite') {
      audio.horn?.();
      const why = cantRace(app, d.cfg.wager);
      const peer = online.peers.get(d.from);
      const ride = peer?.model ? ` in a ${carName(peer.model)}` : '';
      const ok = await modal(`${d.name} wants to race`, `<p><b>${esc(d.name)}</b>${esc(ride)} is calling you out: <b>${esc(describe(d.cfg))}</b> ${esc(stakes(d.cfg))}.</p>${why ? `<p class="small warn">${esc(why)}</p>` : '<p class="small muted">Winner takes the wager. Jump the start or leave mid-race and you lose.</p>'}`,
        why ? [{ label: 'Pass', value: false }] : [{ label: 'Pass', value: false }, { label: 'Run it', primary: true, value: true }]);
      if (!pvp.inbox.has(d.rid)) { if (ok) toast(`${d.name}'s offer ran out.`, 'bad'); return; }
      const now = cantRace(app, d.cfg.wager);
      const p = online.peers.get(d.from);
      if (!ok || now || !p?.model) { pvp.answer(d, false); if (ok) toast(now || 'They left.', 'bad'); return; }
      pvp.answer(d, true);
      start(app, p, d.cfg, d.rid, false);
    } else if (ev === 'accepted') {
      const p = online.peers.get(d.to);
      const why = cantRace(app, d.cfg.wager);
      if (!p?.model || why) { toast(why || `${d.name} left the server.`, 'bad'); return; }
      toast(`${d.name} accepted. Line it up!`, 'good');
      start(app, p, d.cfg, d.rid, true);
    } else if (ev === 'declined') toast(`${d.name} passed.`, 'info');
    else if (ev === 'busy') toast(`${d.name} is busy right now.`, 'info');
    else if (ev === 'expired') toast(`${d.name} never answered.`, 'info');
  });
}

// Pick the race and call them out.
export function openChallenge(app, peer) {
  const s = game.s;
  const st = { type: 'roll', roll: 40, dist: 'half', wager: 0 };
  openPanel((root, h) => {
    const dists = PVP_DISTS[st.type];
    if (!dists.includes(st.dist)) st.dist = dists[dists.length - 1];
    const car = activeCar(s);
    root.innerHTML = `<div class="p-head"><h1>Race ${esc(peer.name)}<small>${esc(carName(peer.model))} · tier ${peer.tier}</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body" style="max-width:560px;margin:0 auto">
        <p class="small muted">You in your ${car ? esc(carName(modelOf(car), car.year)) : 'car'}. They get ${25} seconds to answer. Each of you drives your own car; whoever is quicker on their own clock wins.</p>
        <label class="field"><span>Race</span><div class="opts"><button class="${st.type === 'roll' ? 'on' : ''}" data-action="type" data-v="roll">Roll race</button><button class="${st.type === 'drag' ? 'on' : ''}" data-action="type" data-v="drag">Drag race</button></div></label>
        ${st.type === 'roll' ? `<label class="field"><span>Roll speed</span><div class="opts">${PVP_ROLLS.map(v => `<button class="${st.roll === v ? 'on' : ''}" data-action="roll" data-v="${v}">${v} mph</button>`).join('')}</div></label>` : ''}
        <label class="field"><span>Distance</span><div class="opts">${dists.map(v => `<button class="${st.dist === v ? 'on' : ''}" data-action="dist" data-v="${v}">${DIST_NAME[v]}</button>`).join('')}</div></label>
        <label class="field"><span>Wager</span><div class="opts">${PVP_WAGERS.map(v => `<button class="${st.wager === v ? 'on' : ''}" data-action="wager" data-v="${v}" ${v > s.cash + s.bank ? 'disabled' : ''}>${v ? fmtMoney(v) : 'None'}</button>`).join('')}</div></label>
        <p class="small muted">${st.type === 'drag' ? 'On the Ironline strip: burnout, stage, watch the tree.' : 'On Loop 820, traffic and all. Third honk is GO; jump it and you lose.'}</p>
        <div class="row" style="margin-top:12px"><button class="btn btn-primary" data-action="go" style="flex:1">${pvp.out ? 'Waiting for an answer…' : 'Send the challenge'}</button></div>
      </div>`;
    bind(root, {
      close: () => h.close(),
      type: d => { st.type = d.v; h.refresh(); },
      roll: d => { st.roll = +d.v; h.refresh(); },
      dist: d => { st.dist = d.v; h.refresh(); },
      wager: d => { st.wager = +d.v; h.refresh(); },
      go: () => {
        const why = cantRace(app, st.wager);
        if (why) { toast(why, 'bad'); return; }
        if (!online.peers.has(peer.id)) { toast(`${peer.name} left the server.`, 'bad'); return; }
        if (pvp.out) { toast('Wait for your last challenge to get answered.', 'info'); return; }
        pvp.challenge(peer, { ...st });
        toast(`Challenge sent to ${peer.name}.`, 'good');
        closeAllPanels();
      },
    });
  });
}

async function start(app, peer, cfg, rid, host) {
  const s = game.s, car = activeCar(s);
  closeAllPanels();
  const link = new RaceLink(rid, host, peer.name);
  try { await link.open(); } catch (e) { toast(`Couldn't open the race: ${e.message}`, 'bad'); return; }
  const roadKey = cfg.type === 'drag' ? 'strip' : 'highway';
  const road = ROADS[roadKey];
  const tier = tierOf(s.rep).n;
  // keep showing up on the server while we're on the race screen
  const alive = setInterval(() => online.sendHello(), 2500);
  const npc = { id: 'online', name: peer.name, nick: peer.name, tier: peer.tier, generic: true, color: '#2a6bff', money: cfg.wager,
    lines: { theyLost: 'GG. Run it back sometime.', theyWon: 'Too easy. Good race though.' } };
  const resultCfg = { type: cfg.type, roadKey, road, loc: { name: `Online · ${online.serverName}` }, npc, roll: cfg.roll, dist: cfg.dist, wager: cfg.wager };
  const { startRace, enterWorld } = await import('../main.js');
  const { results } = await import('./raceSetup.js');
  startRace(Race, {
    type: cfg.type, road: roadKey, dist: cfg.dist, roll: cfg.roll, wager: cfg.wager, tier,
    trafficDensity: cfg.type === 'drag' ? 0 : 0.3,
    player: { name: s.player.name, car, model: modelOf(car), spec: carSpec(car), visual: car.visual, levels: levels(car), cond: car.cond, skill: 1 },
    npc: { name: peer.name, car: null, model: peer.model, spec: buildSpec(peer.model, peer.levels, {}), visual: peer.visual, levels: peer.levels, cond: {}, skill: 0 },
    link,
    onDone: r => {
      clearInterval(alive);
      link.close();
      if (r.reason === 'noshow') { toast(`${peer.name} never pulled up. No race.`, 'info'); enterWorld(); return; }
      if (r.forfeit && r.won) toast(`${peer.name} dropped out. The win is yours.`, 'good');
      results(app, resultCfg, r);
    },
  });
}
