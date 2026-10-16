// Banks: the lobby (teller, case the place), the heist planner (approach,
// crew, gear, the inside man) and the job itself, a phase at a time.
// Rules: core/heist.js. Banks: data/banks.js.

import { openPanel, closeAllPanels, bind, esc, toast, modal, bar } from './dom.js';
import { game, fmtMoney, canAfford, addRep, activeCar } from '../core/state.js';
import { districtAt } from '../data/world.js';
import { BANK_TIERS } from '../data/banks.js';
import * as H from '../core/heist.js';
import { advanceTime } from './garage.js';
import { saveGame } from '../core/save.js';
import { sendMessage } from '../core/story.js';
import { audio } from '../core/audio.js';
import { ui } from '../main.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const tierName = loc => BANK_TIERS[loc.bank || 'branch'].name;

// ---------------------------------------------------------------- the lobby
export function openBank(loc, app) {
  const s = game.s;
  openPanel((root, h) => {
    const p = H.planFor(s, loc.id), locked = H.lockedDown(s, loc.id), lines = H.intelLines(loc, p.intel);
    const today = p.cased === s.time.day, full = p.intel >= H.MAX_INTEL;
    root.innerHTML = `${head(loc.name, `${tierName(loc)} · ${esc(districtAt(loc.x, loc.z) || '')} · FDIC insured`)}
      <div class="p-body" style="max-width:640px">
      <div class="card"><h3>🏦 Teller window</h3>
        <div class="kv"><span>Cash on you</span><span>${fmtMoney(s.cash)}${s.dirty ? ` <span class="warn small">(${fmtMoney(Math.min(s.dirty, s.cash))} dirty)</span>` : ''}</span><span>In the bank</span><span>${fmtMoney(s.bank)}</span></div>
        <div class="row" style="margin-top:8px"><button class="btn btn-primary" data-action="teller">Deposit or withdraw</button></div></div>
      <div class="card"><h3>👀 Case the place</h3>
        <div class="row" style="align-items:center;gap:8px"><span class="small muted">Intel</span>${bar(p.intel / H.MAX_INTEL * 100)}<b>${p.intel}/${H.MAX_INTEL}</b></div>
        ${lines.length ? `<ul class="small">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="small muted">You don\'t know anything about this bank yet.</p>'}
        <div class="row"><button class="btn" data-action="case" ${today || full ? 'disabled' : ''}>${full ? 'You know this bank inside out' : today ? 'You already looked around today' : 'Stand in line and look around (1 hour)'}</button></div></div>
      <div class="card"><h3>💰 The job</h3>
        ${locked ? `<p class="bad">On lockdown after the last robbery. Extra guards and an FBI car out front until day ${H.ensureHeists(s).lockdown[loc.id]}.</p>`
          : `<p class="small muted">The Professor draws up the plan, finds you a crew and sells you the gear. You pick how it goes down.</p>
             <div class="row"><button class="btn btn-danger" data-action="plan">Plan a heist</button></div>`}
      </div>
      <p class="small muted">Or draw your gun at the counter: a teller-line robbery is fast and small, the drawers have dye packs, and bank robbery is a federal case.</p>
      </div>`;
    bind(root, {
      close: () => h.close(),
      teller: () => { closeAllPanels(); ui.openPhone('bank'); },
      case: () => {
        const r = H.caseBank(s, loc);
        if (r.ok) {
          advanceTime(s, H.CASE_MINUTES);
          toast(`You fill out a deposit slip and watch. ${r.line}`, 'info');
          if (!s.contacts.includes('professor')) sendMessage(s, 'professor', `Heard you've been standing in line at ${loc.name} a lot. If you're thinking what I think you're thinking, come talk to me. I draw the plans, I know the people. Walk into any bank and ask for me.`);
        }
        h.refresh();
      },
      plan: () => openPlanner(loc, app),
    });
  });
}

// ---------------------------------------------------------------- the plan
export function openPlanner(loc, app) {
  const s = game.s;
  openPanel((root, h) => {
    const p = H.planFor(s, loc.id), A = H.APPROACHES[p.approach], miss = H.missing(s, loc), t = BANK_TIERS[loc.bank || 'branch'];
    const cut = H.crewCut(p);
    const appr = Object.entries(H.APPROACHES).map(([id, a]) => `<div class="li ${p.approach === id ? 'on' : ''}"><div class="grow"><div class="t">${esc(a.name)}: ${esc(a.title)}</div><div class="s">${esc(a.desc)}</div>
      <div class="s muted">Needs: ${[...a.roles.map(r => H.ROLES[r].name.toLowerCase()), ...a.gear.map(g => H.GEAR_BY_ID[g].name.toLowerCase()), a.bribe ? `the inside man (${fmtMoney(H.bribeFor(loc.bank || 'branch'))})` : '', a.night ? 'midnight to 4 AM' : ''].filter(Boolean).join(', ')}</div></div>
      <button class="btn btn-sm ${p.approach === id ? 'btn-primary' : ''}" data-action="approach" data-id="${id}">${p.approach === id ? '✓ The plan' : 'Pick'}</button></div>`).join('');
    const crew = Object.entries(H.ROLES).map(([role, r]) => `<div class="section-title">${esc(r.name)} <span class="small muted">· ${esc(r.does)}${A?.roles.includes(role) ? ' · <b class="warn">needed</b>' : ''}</span></div>
      <div class="list">${H.CREW.filter(c => c.role === role).map(c => `<div class="li"><div class="grow"><div class="t">${esc(c.name)} <span class="small muted">${'★'.repeat(c.skill)}${'☆'.repeat(5 - c.skill)}</span></div><div class="s">${esc(c.bio)} · takes ${Math.round(c.cut * 100)}%</div></div>
        <button class="btn btn-sm ${p.crew[role] === c.id ? 'btn-primary' : ''}" data-action="hire" data-id="${c.id}">${p.crew[role] === c.id ? '✓ Hired' : 'Hire'}</button></div>`).join('')}</div>`).join('');
    const gear = H.GEAR.map(g => { const have = p.gear.includes(g.id), need = A?.gear.includes(g.id);
      return `<div class="li"><span style="font-size:20px">${g.icon}</span><div class="grow"><div class="t">${esc(g.name)}${need ? ' <b class="warn small">needed</b>' : ''}</div><div class="s">${esc(g.desc)}</div></div>
        <button class="btn btn-sm" data-action="gear" data-id="${g.id}" ${have || !canAfford(s, g.price) ? 'disabled' : ''}>${have ? '✓ Got it' : fmtMoney(g.price)}</button></div>`; }).join('');
    const est = p.intel >= 2 ? `${fmtMoney(Math.round((t.drawers[0] + t.vault[0]) * (1 - cut)))}–${fmtMoney(Math.round((t.drawers[1] + t.vault[1]) * (1 - cut)))}` : 'case it more to find out';
    root.innerHTML = `${head(`Heist: ${loc.name}`, `${tierName(loc)} · intel ${p.intel}/${H.MAX_INTEL} · crew takes ${Math.round(cut * 100)}%`)}
      <div class="p-body" style="max-width:680px">
      <div class="card"><h3>${miss.length ? 'Before you can go' : 'Ready'}</h3>
        ${miss.length ? `<ul class="small">${miss.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p class="good">Everybody knows their job. The car is gassed up.</p>'}
        <div class="kv"><span>Your take, after the crew</span><span>${est}</span></div>
        <div class="row" style="margin-top:8px"><button class="btn btn-danger" data-action="go" ${miss.length ? 'disabled' : ''}>🔫 Go time</button></div></div>
      <div class="section-title">How it goes down</div><div class="list">${appr}</div>
      ${A?.bribe ? `<div class="card"><h3>The inside man</h3><p class="small">The assistant manager has gambling debts. ${fmtMoney(H.bribeFor(loc.bank || 'branch'))} cash up front and the vault is open on delivery day. If the FBI leans on him later, he might talk.</p>
        <button class="btn" data-action="bribe" ${p.bribed ? 'disabled' : ''}>${p.bribed ? '✓ Paid' : `Pay him ${fmtMoney(H.bribeFor(loc.bank || 'branch'))}`}</button></div>` : ''}
      <div class="section-title">The crew</div>${crew}
      <div class="section-title">Gear</div><div class="list">${gear}</div>
      <p class="small muted">Gear and the inside man are paid in cash, dirty money first. The crew gets paid out of the take.</p>
      </div>`;
    bind(root, {
      close: () => h.close(),
      approach: d => { H.setApproach(s, loc.id, d.id); h.refresh(); },
      hire: d => { H.hire(s, loc.id, d.id); h.refresh(); },
      gear: d => { const r = H.buyGear(s, loc.id, d.id); if (r.ok) { audio.buy(); toast(`Bought: ${r.item.name}`, 'good'); } else if (r.why === 'money') toast('Not enough cash.', 'bad'); h.refresh(); },
      bribe: () => { const r = H.payInside(s, loc); if (r.ok) toast(`${fmtMoney(r.amount)} in an envelope. He counts it in the bathroom.`, 'good'); else if (r.why === 'money') toast('Not enough cash.', 'bad'); h.refresh(); },
      go: () => runHeist(loc, app),
    });
  });
}

// ---------------------------------------------------------------- the job
const PHASE_TITLE = { lobby: 'The lobby', drawers: 'The teller line', vault: 'The vault', entry: 'Getting in', delivery: 'The delivery', out: 'Getting out' };
const PHASE_TEXT = {
  lobby: 'Masks down, through the front doors at 11:40 on a weekday. Six customers, three tellers, a guard by the door.',
  drawers: 'The tellers are pulling their drawers. Bags open.',
  vault: 'Down the hall behind the counter. The vault door is two feet of steel.',
  entry: '2:15 AM. The lot is empty and the street is quiet.',
  delivery: 'Thursday, 10 AM. You back a borrowed armored truck up to the side door.',
  out: 'Bags are full. Time to go.',
};

export async function runHeist(loc, app) {
  const s = game.s, w = app.world;
  if (H.missing(s, loc).length) return;
  closeAllPanels();
  if (w) w.paused = true;
  const job = H.startJob(s, loc);
  audio.radio();
  while (!job.over) {
    const id = H.phaseId(job), ch = H.choices(job);
    const status = job.alarm ? (job.outside ? '<p class="bad"><b>Police are outside.</b></p>' : `<p class="warn">Alarm went off ${Math.round(job.min - job.alarmAt)} min ago. Units are about ${Math.max(0, Math.round(job.response - (job.min - job.alarmAt)))} min out.</p>`) : '<p class="good">No alarm.</p>';
    const pick = await modal(PHASE_TITLE[id], `${job.log.length ? `<p>${esc(job.log[job.log.length - 1])}</p>` : ''}<p class="muted">${esc(PHASE_TEXT[id])}</p>${status}
      <p class="small muted">${job.min} min inside · ${fmtMoney(job.drawers + job.vault)} in the bags${job.hurt ? ` · you're hit (−${job.hurt} health)` : ''}</p>
      <ul class="small">${ch.map(c => `<li><b>${esc(c.label)}</b>: ${esc(c.hint)}</li>`).join('')}</ul>`,
      ch.map((c, i) => ({ label: c.label, value: c.id, primary: i === 0 })));
    H.step(s, job, pick ?? ch[0].id);
  }
  const res = H.settle(s, job);
  advanceTime(s, Math.max(10, Math.round(job.min)));
  addRep(s, 40 + Math.min(260, Math.round(res.gross / 5000)), 'Bank job');
  if (w?.combat && job.hurt) w.combat.arms.hp = Math.max(1, w.combat.arms.hp - job.hurt);
  await modal(res.heat ? 'Go, go, go!' : 'Clean', `<p>${esc(job.log[job.log.length - 1])}</p>
    <div class="kv"><span>In the bags</span><span>${fmtMoney(res.gross)}</span><span>The crew's cut</span><span>−${fmtMoney(res.cuts)}</span><span>Yours (dirty cash)</span><span class="good"><b>${fmtMoney(res.net)}</b></span></div>
    ${res.heat ? `<p class="bad">Every unit in the city is on the way. Lose them.</p>` : `<p class="good">${job.approach === 'quiet' ? 'Nobody knows until the morning shift opens the vault.' : 'The truck pulls out. Nobody looks twice.'}</p>`}
    <p class="small muted">Bank robbery is federal: the FBI opened a case and your federal heat went up. Wash the money before you put it in a bank.</p>`, [{ label: res.heat ? 'Run' : 'Drive off', primary: true }]);
  if (w) {
    w.paused = false;
    placeAfterJob(w, loc, job);
    if (res.heat) w.police.dispatchHeist(w, loc, res.heat, res.record);
  }
  if (!s.contacts.includes('fbi') || s.stats.heists === 1) sendMessage(s, 'fbi', `The FBI Dallas Field Office is investigating a robbery at ${loc.name}. Anyone with information is asked to call. A reward of up to $10,000 is offered.`);
  saveGame('auto', true);
  return res;
}

// Out on the sidewalk in front of the bank; a driver brings your car to the curb.
function placeAfterJob(w, loc, job) {
  const out = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[loc.side] || [0, 1];
  w.inCar = false;
  w.foot.x = loc.x + out[0] * 3; w.foot.z = loc.z + out[1] * 3; w.foot.h = Math.atan2(out[0], -out[1]);
  const car = activeCar(game.s);
  if (job.plan.crew.driver && car && !car.impound) {
    const h = loc.side === 'N' || loc.side === 'S' ? Math.PI / 2 : 0;
    w.placeCar(car, loc.x + out[0] * 9, loc.z + out[1] * 9, h);
    game.s.carPos = { x: loc.x + out[0] * 9, z: loc.z + out[1] * 9, h };
    toast(`${H.CREW_BY_ID[job.plan.crew.driver].name.split(' ')[0]} has your car at the curb. Get in.`, 'info');
  }
  if (w.cam) { w.cam.x = w.foot.x; w.cam.z = w.foot.z; }
}
