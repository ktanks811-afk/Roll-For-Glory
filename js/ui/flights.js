// The airport counter: fly between Texas (Alliance Airport) and Atlanta, Los
// Angeles and Miami (data/states.js). Your car rides along on the cargo plane
// if you pull up in it; World.fly does the trip.

import { openPanel, bind, esc } from './dom.js';
import { game, fmtMoney } from '../core/state.js';
import { LOC_BY_ID } from '../data/world.js';
import { STATES, TEXAS, stateAt, stateById } from '../data/states.js';

const DEST = [TEXAS, ...Object.values(STATES)];
const BLURB = { tx: 'Home. Fort Worth, Dallas, Denton, the ranches and your traps.' };

export function openAirport(loc, app) {
  const s = game.s, w = app.world;
  openPanel((root, h) => {
    const here = stateAt(loc.x, loc.z);
    const rows = DEST.filter(st => st.id !== here).map(st => {
      const air = LOC_BY_ID[st.airport], plan = w?.flightPlan ? w.flightPlan(st.airport) : null, q = plan?.quote;
      const hrs = q ? `${Math.floor(q.minutes / 60)} h ${q.minutes % 60 ? `${q.minutes % 60} min` : ''}`.trim() : '';
      return `<div class="card"><h3>✈ ${esc(st.city)}, ${esc(st.abbr)}<small class="muted"> · ${esc(air.name)}</small></h3>
        <p class="muted small">${esc(st.pitch || BLURB[st.id] || '')}</p>
        ${q ? `<div class="kv"><span>Ticket</span><span>${fmtMoney(q.ticket)}</span>${q.freight ? `<span>Your car (cargo)</span><span>${fmtMoney(q.freight)}</span>` : ''}<span>Door to door</span><span>${hrs}</span><span>Total</span><span><b>${fmtMoney(q.total)}</b></span></div>` : ''}
        <div class="row" style="margin-top:8px">${plan?.block ? `<span class="small bad">${esc(plan.block)}</span>` : `<button class="btn btn-primary" data-action="fly" data-id="${st.airport}">Fly to ${esc(st.city)} · ${fmtMoney(q.total)}</button>`}</div></div>`;
    }).join('');
    const withCar = w?.flightPlan ? w.flightPlan(DEST.find(st => st.id !== here).airport).withCar : false;
    root.innerHTML = `<div class="p-head"><h1>${esc(loc.name)}<small>${esc(stateById(here).city)}, ${esc(stateById(here).abbr)} · departures</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body" style="max-width:760px">
        <p class="muted">${withCar ? 'Your car goes on the cargo plane and is waiting at the curb when you land.' : 'You\'re flying alone: your car stays parked here. Pull up in it (or stand next to it) to bring it.'}</p>
        <div class="grid">${rows}</div>
        <p class="small muted">The clock moves on while you fly. No flights with the cops on you, in a stolen car, or in the middle of a job.</p>
      </div>`;
    bind(root, {
      close: () => h.close(),
      fly: d => { if (w?.fly(d.id)) h.close(); else h.refresh?.(); },
    });
  });
}
