// The TDCJ Wynne Unit: a walkable top-down compound where you actually do
// your time. Tap where to walk (or WASD), and the action button does whatever
// is in front of you: your bunk (sleep: a year goes by), chow, the weight
// pile, spades, the basketball court, the law library (appeals), commissary,
// visitation (money on your books), the chapel, your job and the back gate.
// Rules: core/prison.js. The courts hand you over from ui/court.js.

import { openPanel, bind, esc, toast, modal, confirm, closePanel } from './dom.js';
import { game, fmtMoney, canAfford, addRep } from '../core/state.js';
import * as PR from '../core/prison.js';
import { advanceTime } from './garage.js';
import { saveGame } from '../core/save.js';
import { sendMessage } from '../core/story.js';
import { release, custodyCosts } from './court.js';
import { ui } from '../main.js';

export const W = 140, H = 100;

// Buildings are solid; you use them from the door (the spot in front).
const BUILDINGS = [
  { id: 'cells', x: 10, y: 10, w: 46, h: 24, name: 'HOUSING · 12 BUILDING', roof: '#7d7a72' },
  { id: 'chow', x: 64, y: 10, w: 32, h: 18, name: 'CHOW HALL', roof: '#857a68' },
  { id: 'comm', x: 102, y: 10, w: 28, h: 12, name: 'COMMISSARY', roof: '#6f7a80' },
  { id: 'library', x: 104, y: 32, w: 26, h: 14, name: 'LAW LIBRARY', roof: '#6a6f86' },
  { id: 'shop', x: 104, y: 62, w: 26, h: 12, name: 'VOC. SHOP · FIELD GATE', roof: '#7a6a58' },
  { id: 'chapel', x: 10, y: 68, w: 18, h: 20, name: 'CHAPEL', roof: '#7a6460' },
  { id: 'visit', x: 34, y: 76, w: 24, h: 14, name: 'VISITATION', roof: '#6c7468' },
  { id: 'admin', x: 84, y: 80, w: 20, h: 12, name: 'ADMIN', roof: '#5f6670' },
];
const YARD = { x: 12, y: 40, w: 48, h: 22 };
const GATE = { x: 64, y: 94, w: 12 };

export const SPOTS = [
  { id: 'bunk', x: 33, y: 36.5, label: '🛏 Your bunk · sleep (1 year)' },
  { id: 'chow', x: 80, y: 30.5, label: '🍽 Chow hall' },
  { id: 'comm', x: 116, y: 24.5, label: '🛒 Commissary window' },
  { id: 'library', x: 117, y: 48.5, label: '⚖ Law library · fight your case' },
  { id: 'work', x: 117, y: 60, label: '🔧 Report to your job' },
  { id: 'chapel', x: 19, y: 65.5, label: '⛪ Chapel' },
  { id: 'visit', x: 46, y: 73.5, label: '👪 Visitation' },
  { id: 'admin', x: 94, y: 77.5, label: '📋 Job board (change jobs)' },
  { id: 'weights', x: 18, y: 46, label: '🏋 Weight pile' },
  { id: 'spades', x: 32, y: 52, label: '♠ Spades table' },
  { id: 'court', x: 52, y: 50, label: '🏀 Basketball court' },
  { id: 'hustle', x: 62, y: 62, label: '📦 Back of the yard (hustle)' },
  { id: 'gate', x: 70, y: 90.5, label: '🚪 Sally port' },
];
const REACH = 3.6;

let current = null;
export const activePrison = () => current;   // for the smoke test

// Hand the player to TDCJ (sent: the sentence) or pick a sentence back up
// from the save (no sent). Resolves once you walk out.
export function servePrison(app, sent = null, { crime = '', evidence = 0.85, cause = 0 } = {}) {
  const s = game.s;
  if (current) return current.done;
  if (sent) PR.enterPrison(s, sent, { crime, evidence, cause });
  if (!s.prison) return Promise.resolve(null);
  const p = s.prison;
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  const st = { x: SPOTS[0].x, y: SPOTS[0].y + 2, h: -Math.PI / 2, tx: null, ty: null, tap: null };
  const npcs = makeNpcs(p.tdcj);
  const keys = new Set();
  let raf = 0, last = 0, view = null, out = false, busy = false, hudT = 0, near = null;
  const say = (text, kind = '') => { p.log.push({ text, kind }); if (p.log.length > 30) p.log.splice(0, p.log.length - 30); };
  if (!p.log.length) say(`Chain bus to ${PR.UNITS[p.facility].name}. TDCJ #${p.tdcj}. Whites, a mattress and a bunk in 12 Building.`);
  const onKey = e => {
    if (document.querySelector('#modals .modal-back')) return;
    if (e.type === 'keydown') { if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) { act(); return; } keys.add(e.code); } else keys.delete(e.code);
  };

  const act = async () => {
    if (busy || !near || out) return;
    busy = true;
    try { await use(near.id); } finally { busy = false; }
  };

  // ---------------------------------------------------------------- the spots
  async function use(id) {
    const tick = mins => advanceTime(s, mins);
    switch (id) {
      case 'bunk': return sleep();
      case 'chow': { const r = PR.chow(s); say(r || 'Chow hall is closed till breakfast. You already ate today.'); if (r) tick(60); return; }
      case 'weights': { const r = PR.lift(s); say(r || 'You already hit the weights today. Your arms are jelly.'); if (r) tick(90); return; }
      case 'chapel': { const r = PR.chapel(s); say(r || 'Service is over for today.'); if (r) tick(60); return; }
      case 'work': { const r = PR.work(s); say(r || `You already worked your shift. ${PR.JOBS[p.job].name} is done for today.`); if (r) tick(5 * 60); return; }
      case 'spades': return spades();
      case 'court': return yard();
      case 'hustle': return hustle();
      case 'comm': return commissary();
      case 'visit': return visitation();
      case 'admin': return jobs();
      case 'library': return library();
      case 'gate': return gate();
    }
  }

  async function sleep() {
    const left = PR.yearsLeft(p);
    const ok = await confirm('Lights out?', `<p>Sleep in your bunk and <b>a year goes by</b>.</p><p class="small muted">${p.life ? (p.lwop ? 'Life without parole. Only an appeal gets you out.' : p.served >= p.paroleAt ? 'You\'re up for parole every year now.' : `Parole eligibility in ${p.paroleAt - p.served} year${p.paroleAt - p.served === 1 ? '' : 's'}.`) : `${left} year${left === 1 ? '' : 's'} left on your sentence.`}${p.appeal.pending ? ` Your ${esc(PR.appealAt(p.appeal.pending.stage).name.toLowerCase())} is pending.` : ''}</p>`, 'Sleep');
    if (!ok) return;
    const mins = ((24 + 6) * 60 - s.time.min) % 1440 || 1440;
    advanceTime(s, mins);
    const ev = PR.sleepYear(s);
    const lines = [];
    if (ev.appeal) lines.push(ev.appeal.won ? `<p class="good"><b>${esc(ev.appeal.court)}: REVERSED.</b> Your ${esc(ev.appeal.name.toLowerCase())} was granted. The conviction is thrown out.</p>` : `<p class="bad">${esc(ev.appeal.court)} denied your ${esc(ev.appeal.name.toLowerCase())}.</p>`);
    if (ev.parole) lines.push(ev.parole.granted ? '<p class="good"><b>Parole granted.</b> The board votes to release you.</p>' : '<p class="bad">Parole review: denied. Set off another year.</p>');
    lines.push(`<p class="small muted">${esc(MAIL[(p.served * 7 + p.tdcj) % MAIL.length])}</p>`);
    say(`Year ${p.served} done.${ev.appeal ? ev.appeal.won ? ' Appeal granted!' : ' Appeal denied.' : ''}`, ev.out ? 'good' : '');
    saveGame('auto', true);
    await modal(`Year ${ev.year}${p.life ? '' : ` of ${p.years}`}`, `<div class="jail-clock">${p.life ? `${ev.year} YEAR${ev.year === 1 ? '' : 'S'} DOWN` : ev.out ? 'TIME SERVED' : `${PR.yearsLeft(p)} TO GO`}</div>${lines.join('')}`, [{ label: ev.out ? 'Pack your things' : 'Get up', primary: true }]);
    if (ev.out) return walkOut(ev.out);
  }

  async function spades() {
    if (p.books < 1) { say('Nobody plays for free. Get some money on your books.'); return; }
    const bet = Math.min(p.books, Math.max(5, Math.round(p.books * 0.2)));
    const go = await confirm('Spades', `<p>Four at the table, soups on the line. Play a hand for <b>${fmtMoney(bet)}</b> of commissary?</p>`, 'Deal me in');
    if (!go) return;
    const r = PR.spades(s, bet);
    advanceTime(s, 45);
    say(r.win ? `Ran a Boston. Won ${fmtMoney(r.bet)} in soups.` : `Got set. Lost ${fmtMoney(r.bet)}.`, r.win ? 'good' : 'bad');
  }

  async function yard() {
    if (p.day.fought) { say('Rec is over for you today.'); return; }
    const go = await confirm('Basketball court', '<p>Somebody from the other dorm says you fouled him and keeps talking. Settle it?</p><p class="small muted">Win and the yard respects you. If the officers see it, it\'s a new case.</p>', 'Square up');
    if (!go) { say('You walk off. Some respect lost, nothing on your file.'); p.respect = Math.max(0, p.respect - 1); return; }
    const r = PR.fight(s);
    advanceTime(s, 30);
    say(r.win ? 'You won the fight. Nobody steps to you for a while.' : 'You lost that one. Bloody lip.', r.win ? 'good' : 'bad');
    if (r.caught) await caseModal(r);
  }

  async function hustle() {
    if (p.day.hustled) { say('You already moved product today. Don\'t get greedy.'); return; }
    const go = await confirm('The back of the yard', '<p>A guy from the kitchen has phone minutes and tobacco to move. Sell it for him?</p><p class="small muted">Good money on your books. Get caught and the DA files a new felony.</p>', 'Move it');
    if (!go) return;
    const r = PR.hustle(s);
    advanceTime(s, 60);
    if (!r.caught) say(`Moved it. ${fmtMoney(r.pay)} on your books.`, 'good');
    else await caseModal(r);
  }

  async function caseModal(r) {
    say(`Disciplinary case: ${r.charge}`, 'bad');
    await modal('Major case', `<p>The officer writes it up and the Walker County DA files it:</p><div class="charges"><div class="charge"><span>⚖ ${esc(r.charge)}</span><b class="bad">3rd-degree felony</b></div></div>
      <p>${r.added ? `<b>${r.added} more years</b> stacked on your sentence.` : 'Stacked on your life sentence. The parole board will see it.'} Your line class drops.</p>`);
  }

  function commissary() {
    openPanel((root, h) => {
      root.innerHTML = `<div class="p-head"><h1>Commissary<small>Trust fund: ${fmtMoney(p.books)} · TDCJ #${p.tdcj}</small></h1><button class="btn x" data-action="close">×</button></div>
        <div class="p-body" style="max-width:560px"><div class="list">${PR.COMMISSARY.map(it => `<div class="li"><span style="font-size:20px">${it.icon}</span><div class="grow"><div class="t">${esc(it.name)}</div><div class="s">${[it.food && `food +${it.food}`, it.energy && `energy +${it.energy}`, it.respect && 'respect'].filter(Boolean).join(' · ') || '&nbsp;'}</div></div>
          <button class="btn btn-sm" data-action="buy" data-id="${it.id}" ${p.books < it.price || (it.once && p.owned.includes(it.id)) ? 'disabled' : ''}>${it.once && p.owned.includes(it.id) ? 'Owned' : fmtMoney(it.price)}</button></div>`).join('')}</div>
        <p class="small muted">Money gets on your books from visitation. Soups are money in here.</p></div>`;
      bind(root, {
        close: () => h.close(),
        buy: d => { const r = PR.buy(s, d.id); if (r.ok) say(`Bought ${r.item.name}.`); h.refresh(); },
      });
    });
  }

  async function visitation() {
    const amts = [50, 200, 1000].filter(a => canAfford(s, a));
    const pick = await modal('Visitation', `<p>Your people came up to see you. Through the glass, they ask what you need.</p><p class="small muted">Money on your books comes out of your bank account. Your trust fund: <b>${fmtMoney(p.books)}</b>.</p>`,
      [...amts.map(a => ({ label: `Put ${fmtMoney(a)} on my books`, value: a, primary: a === 200 })), { label: 'Just talk', value: 0 }]);
    if (pick > 0 && PR.putOnBooks(s, pick)) say(`${fmtMoney(pick)} on your books.`, 'good');
    else if (pick === 0 && !p.day.visit) { p.day.visit = true; p.conduct = Math.min(100, p.conduct + 1); say('Good visit. They say everybody outside is holding it down.'); }
    advanceTime(s, 60);
  }

  async function jobs() {
    const pick = await modal('Job board', `<p>Classification can move you. You work ${esc(PR.JOBS[p.job].name.toLowerCase())} now.</p>${Object.entries(PR.JOBS).map(([k, j]) => `<p><b>${esc(j.name)}</b><br><span class="small muted">${esc(j.desc)}</span></p>`).join('')}`,
      [...Object.entries(PR.JOBS).filter(([k]) => k !== p.job).map(([k, j]) => ({ label: j.name, value: k })), { label: 'Stay put', value: null, primary: true }]);
    if (pick) { p.job = pick; say(`Reassigned: ${PR.JOBS[pick].name}.`); }
  }

  function library() {
    openPanel((root, h) => {
      const a = p.appeal, A = PR.appealAt(a.stage), pend = a.pending;
      const oddsL = PR.appealOdds(p, a.stage, true), oddsP = PR.appealOdds(p, a.stage, false);
      root.innerHTML = `<div class="p-head"><h1>Law library<small>${esc(p.crime || 'Your conviction')} · ${esc(p.sentence)}</small></h1><button class="btn x" data-action="close">×</button></div>
        <div class="p-body court" style="max-width:640px">
        <div class="docket ${pend ? 'on' : ''}"><div class="t">${pend ? `Pending: ${esc(PR.appealAt(pend.stage).name)}` : `Next: ${esc(A.name)}`}</div>
          <div class="s">${pend ? `${esc(PR.appealAt(pend.stage).court)}. A ruling comes down in ${pend.decide - p.served} year${pend.decide - p.served === 1 ? '' : 's'}${pend.lawyer ? ' (your attorney filed it)' : ' (you filed it yourself)'}.` : `${esc(A.court)}. Takes about ${A.years} year${A.years > 1 ? 's' : ''} to decide.`}</div>
          ${pend ? '' : `<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-primary" data-action="lawyer" ${canAfford(s, A.fee) ? '' : 'disabled'}>Hire an appellate lawyer · ${fmtMoney(A.fee)}</button>
            <button class="btn" data-action="prose">File it yourself (pro se)</button></div>
            <p class="small muted">Odds the court grants it: about ${Math.max(1, Math.round(oddsL * 100))}% with a lawyer, ${Math.max(1, Math.round(oddsP * 1000) / 10)}% on your own.${p.evidence < 0.7 ? ' The State\'s case was thin, which helps.' : ''}</p>`}
        </div>
        <div class="section-title">Your time</div>
        <div class="kv"><span>Served</span><span>${p.served} year${p.served === 1 ? '' : 's'}</span>
          <span>Sentence</span><span>${esc(p.sentence)}</span>
          <span>${p.life ? 'Parole' : 'Release'}</span><span>${p.life ? (p.lwop ? 'Never. Life without parole.' : p.served >= p.paroleAt ? 'Reviewed every year' : `Eligible after ${p.paroleAt} years`) : `After ${p.years} years (${PR.yearsLeft(p)} to go)`}</span>
          <span>Line class</span><span>${p.conduct >= 70 ? 'S3 · good' : p.conduct >= 40 ? 'L1' : 'L3 · trouble'}${p.infractions ? ` · ${p.infractions} major case${p.infractions > 1 ? 's' : ''}` : ''}</span></div>
        ${a.log.length ? `<div class="section-title">Rulings</div><div class="list">${a.log.slice().reverse().map(l => `<div class="li"><span>${l.won ? '✅' : '❌'}</span><div class="grow"><div class="t">${esc(l.name)}</div><div class="s">Year ${l.year} · ${esc(l.court)} · ${l.won ? 'granted' : 'denied'}</div></div></div>`).join('')}</div>` : ''}
        <p class="small muted">${p.life ? 'A life sentence never stops being appealable. When the big appeals are gone, you file successive writs, one after another, for as long as you live.' : 'You can fight any conviction. Win and it\'s thrown out and you walk.'}</p></div>`;
      bind(root, {
        close: () => h.close(),
        lawyer: () => { const r = PR.fileAppeal(s, true); if (r.ok) say(`Your lawyer filed the ${r.appeal.name.toLowerCase()}.`); h.refresh(); },
        prose: () => { const r = PR.fileAppeal(s, false); if (r.ok) { advanceTime(s, 3 * 60); say(`You filed the ${r.appeal.name.toLowerCase()} yourself, in pencil.`); } h.refresh(); },
      });
    });
  }

  async function gate() {
    const left = PR.yearsLeft(p);
    await modal('Sally port', `<p>The officer in the picket doesn't even look up.</p><p>${p.life ? (p.lwop ? '"Life without parole. You\'re not going anywhere, ' + esc(s.player.name.split(' ')[0]) + '."' : '"You\'re doing life. Talk to the parole board in ' + Math.max(0, p.paroleAt - p.served) + ' years."') : `"${left} more year${left === 1 ? '' : 's'}. Go to sleep."`}</p><p class="small muted">Every night in your bunk is a year. Win an appeal in the law library and you walk out of here.</p>`);
  }

  // ---------------------------------------------------------------- walking out
  async function walkOut(how) {
    out = true;
    const mins = Math.max(0, (s.time.day - p.startDay) * 1440);
    const yrs = p.served;
    PR.leavePrison(s, how);
    close();
    custodyCosts(s, mins);
    addRep(s, Math.min(200, 40 + yrs * 10), 'Did a bid');
    await release(app, {});
    sendMessage(s, 'clerk', how === 'appeal' ? `Your conviction was reversed on appeal. TDCJ has released you after ${yrs} year${yrs === 1 ? '' : 's'}. Your record no longer shows it.`
      : how === 'parole' ? `TDCJ Parole Division: you were released on parole after ${yrs} years. Stay out of trouble.` : `TDCJ: you discharged your sentence after ${yrs} year${yrs === 1 ? '' : 's'}. Welcome home.`);
    saveGame('auto', true);
    toast(`Out after ${yrs} year${yrs === 1 ? '' : 's'}. The bus drops you off downtown.`, 'good');
    resolveDone({ how, years: yrs });
  }

  // ---------------------------------------------------------------- the scene
  const handle = openPanel((root) => {
    root.innerHTML = `<div class="hunt pris">
      <canvas class="hunt-cv"></canvas>
      <div class="hunt-top"><button class="btn btn-sm" data-action="menu">☰</button><div class="hunt-hud"><b data-pt></b><span data-ps></span></div></div>
      <div class="hunt-log" data-pl></div>
      <div class="hunt-acts"><button class="btn btn-primary hunt-act" data-action="act" disabled>Walk around</button></div></div>`;
    const cv = root.querySelector('canvas');
    cv.addEventListener('pointerdown', e => {
      if (!view) return;
      const r = cv.getBoundingClientRect();
      st.tx = view.x0 + (e.clientX - r.left) / view.sc; st.ty = view.y0 + (e.clientY - r.top) / view.sc;
      st.tap = { x: st.tx, y: st.ty, t: 0.6 };
    });
    bind(root, { act, menu: () => ui.openPause() });
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }, { cls: 'hunt-panel', back: false, onClose: () => {
    cancelAnimationFrame(raf); raf = -1;
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKey);
    current = null;
    // Escape or a stray close doesn't get you out of prison
    if (!out) setTimeout(() => { if (game.s?.prison && game.s.prison.id === p.id && app.world) servePrison(app).then(resolveDone); }, 0);
  } });
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  function close() { closePanel(handle); }
  current = { done, state: p, player: st, use, sleep, walkOut, spots: SPOTS };

  function loop(now) {
    if (raf === -1) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    if (dx || dy) { st.tx = st.x + dx * 3; st.ty = st.y + dy * 3; }
    step(st, dt, 7);
    for (const n of npcs) npcStep(n, dt);
    if (st.tap) { st.tap.t -= dt; if (st.tap.t <= 0) st.tap = null; }
    near = SPOTS.find(sp => Math.hypot(sp.x - st.x, sp.y - st.y) < REACH) || null;
    const root = handle.inner, cv = root.querySelector('.hunt-cv');
    if (cv) {
      view = draw(cv, st, npcs, s, now / 1000, near);
      hudT -= dt;
      if (hudT <= 0) { hudT = 0.2; hud(root); }
    }
    raf = requestAnimationFrame(loop);
  }

  function hud(root) {
    const $ = q => root.querySelector(q);
    const hr = Math.floor(s.time.min / 60) % 24, mm = String(s.time.min % 60).padStart(2, '0');
    $('[data-pt]').textContent = p.life ? `${p.lwop ? 'LIFE W/O PAROLE' : 'LIFE'} · year ${p.served + 1}` : `YEAR ${Math.min(p.years, p.served + 1)} OF ${p.years}`;
    $('[data-ps]').textContent = `${PR.UNITS[p.facility].name} · #${p.tdcj} · ${hr % 12 || 12}:${mm} ${hr < 12 ? 'AM' : 'PM'} · books ${fmtMoney(p.books)} · respect ${p.respect}`;
    $('[data-pl]').innerHTML = p.log.slice(-3).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('');
    const b = $('.hunt-act');
    b.disabled = !near || busy;
    b.textContent = near ? near.label : 'Walk to a door';
    b.classList.toggle('pulse', !!near);
  }
  return done;
}

const MAIL = [
  'Mail call: a letter from your mama. She\'s praying for you.',
  'Your old crew sent a picture of your car. Somebody\'s been washing it.',
  'A magazine subscription shows up: Hot Rod, three months late.',
  'Nobody wrote this year.',
  'Your cellie made parole. The new one snores.',
  'The Fort Worth Star-Telegram ran a story about street racing on Loop 820.',
  'Somebody on the outside put your name in a song.',
  'Lockdown for two months after a stabbing on 8 Building.',
  'You got your GED. The chaplain shook your hand.',
  'Texas summer, no AC in the dorm. You made it through.',
];

// ---------------------------------------------------------------- movement
function blocked(x, y, r = 0.7) {
  if (x < 8 + r || x > W - 8 - r || y < 8 + r || y > H - 8 - r) return true;
  for (const b of BUILDINGS) if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  return false;
}
function step(a, dt, speed) {
  if (a.tx == null) return;
  const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
  if (d < 0.25) { a.tx = a.ty = null; a.moving = false; return; }
  const v = Math.min(d, speed * dt), nx = a.x + dx / d * v, ny = a.y + dy / d * v;
  a.h = Math.atan2(dy, dx); a.moving = true; a.walk = (a.walk || 0) + v;
  // slide along walls
  if (!blocked(nx, ny)) { a.x = nx; a.y = ny; }
  else if (!blocked(nx, a.y)) a.x = nx;
  else if (!blocked(a.x, ny)) a.y = ny;
  else { a.tx = a.ty = null; a.moving = false; }
}
function makeNpcs(seed) {
  const r = mulberry(seed), out = [];
  for (let i = 0; i < 18; i++) {
    let x, y;
    do { x = 10 + r() * (W - 20); y = 10 + r() * (H - 20); } while (blocked(x, y, 1));
    out.push({ x, y, h: 0, tx: null, ty: null, wait: r() * 4, co: i < 3, skin: ['#5a3a26', '#8a5a3a', '#c68e65', '#3e2a1e', '#e0b48c'][i % 5], r, speed: i < 3 ? 2.6 : 1.4 + r() * 1.2 });
  }
  return out;
}
function npcStep(n, dt) {
  if (n.tx == null) {
    n.wait -= dt; n.moving = false;
    if (n.wait > 0) return;
    // inmates drift to the yard and the doors; officers walk the lanes
    const sp = SPOTS[Math.floor(n.r() * SPOTS.length)];
    n.tx = n.co ? 30 + n.r() * 80 : sp.x + (n.r() - 0.5) * 8; n.ty = n.co ? [38, 58, 72][Math.floor(n.r() * 3)] : sp.y + (n.r() - 0.5) * 6;
    if (blocked(n.tx, n.ty, 1)) { n.tx = n.ty = null; n.wait = 0.5; return; }
    n.wait = 2 + n.r() * 6;
  }
  const before = n.tx;
  step(n, dt, n.speed);
  if (before != null && n.tx == null) n.wait = 2 + n.r() * 6;
}

// ---------------------------------------------------------------- drawing
function draw(cv, P, npcs, s, now, near) {
  const dpr = Math.min(2, devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sc = Math.max(Math.min(cw / W, ch / H), Math.min(cw, ch) / 55);
  const vw = cw / sc, vh = ch / sc;
  const x0 = vw >= W ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, P.x - vw / 2));
  const y0 = vh >= H ? (H - vh) / 2 : Math.max(0, Math.min(H - vh, P.y - vh / 2));
  const X = v => (v - x0) * sc, Y = v => (v - y0) * sc;
  // Walker County pasture outside the wire
  x.fillStyle = '#3c4a2a'; x.fillRect(0, 0, cw, ch);
  x.fillStyle = '#4a5636'; x.fillRect(X(-40), Y(-40), (W + 80) * sc, (H + 80) * sc);
  // the compound slab
  x.fillStyle = '#9a968c'; x.fillRect(X(4), Y(4), (W - 8) * sc, (H - 8) * sc);
  x.fillStyle = '#8c887e'; for (let i = 8; i < W - 8; i += 6) x.fillRect(X(i), Y(6), 0.15 * sc, (H - 12) * sc);
  // the yard: dirt track, grass, the court and the weight pile
  x.fillStyle = '#a08a62'; x.fillRect(X(YARD.x), Y(YARD.y), YARD.w * sc, YARD.h * sc);
  x.fillStyle = '#6a7a46'; x.fillRect(X(YARD.x + 3), Y(YARD.y + 3), (YARD.w - 18) * sc, (YARD.h - 6) * sc);
  x.fillStyle = '#7a6e66'; x.fillRect(X(45), Y(43), 13 * sc, 15 * sc);
  x.strokeStyle = '#e8e2d0'; x.lineWidth = Math.max(1, 0.15 * sc); x.strokeRect(X(46), Y(44), 11 * sc, 13 * sc); x.beginPath(); x.arc(X(51.5), Y(50.5), 1.8 * sc, 0, 7); x.stroke();
  x.fillStyle = '#4a4a50'; for (const [a, b] of [[15, 44], [18, 44], [21, 44], [15, 48], [21, 48]]) x.fillRect(X(a), Y(b), 1.6 * sc, 0.6 * sc);
  x.fillStyle = '#6a5a3a'; for (const [a, b] of [[28, 49], [34, 49], [28, 54], [34, 54]]) x.fillRect(X(a), Y(b), 3 * sc, 2 * sc);
  // buildings
  for (const b of BUILDINGS) {
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(X(b.x + 0.8), Y(b.y + 0.8), b.w * sc, b.h * sc);
    x.fillStyle = b.roof; x.fillRect(X(b.x), Y(b.y), b.w * sc, b.h * sc);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.strokeRect(X(b.x), Y(b.y), b.w * sc, b.h * sc);
    if (b.id === 'cells') { x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 1; i < 10; i++) x.fillRect(X(b.x + i * b.w / 10), Y(b.y), 0.25 * sc, b.h * sc); }
    if (b.id === 'chapel') { x.fillStyle = '#e8e2d0'; x.fillRect(X(b.x + b.w / 2 - 0.25), Y(b.y + 4), 0.5 * sc, 4 * sc); x.fillRect(X(b.x + b.w / 2 - 1.2), Y(b.y + 5), 2.4 * sc, 0.5 * sc); }
    x.fillStyle = '#f2eee2'; x.font = `700 ${Math.max(9, Math.min(14, sc * 1.6))}px sans-serif`; x.textAlign = 'center';
    x.fillText(b.name, X(b.x + b.w / 2), Y(b.y + b.h / 2) + 4);
  }
  // doors
  for (const sp of SPOTS) {
    const on = near && near.id === sp.id;
    x.fillStyle = on ? 'rgba(255,211,74,.9)' : 'rgba(255,255,255,.35)';
    x.beginPath(); x.arc(X(sp.x), Y(sp.y), (on ? 1.1 : 0.7) * sc, 0, 7); x.fill();
  }
  // double fence with razor wire, the gate and the towers
  for (const inset of [4, 6]) {
    x.strokeStyle = '#cfd3d6'; x.lineWidth = Math.max(1, 0.18 * sc); x.setLineDash([0.6 * sc, 0.4 * sc]);
    x.beginPath(); x.moveTo(X(GATE.x), Y(H - inset)); x.lineTo(X(inset), Y(H - inset)); x.lineTo(X(inset), Y(inset)); x.lineTo(X(W - inset), Y(inset)); x.lineTo(X(W - inset), Y(H - inset)); x.lineTo(X(GATE.x + GATE.w), Y(H - inset)); x.stroke();
  }
  x.setLineDash([]);
  x.strokeStyle = '#8a8f94'; x.lineWidth = Math.max(2, 0.4 * sc); x.beginPath(); x.moveTo(X(GATE.x), Y(H - 5)); x.lineTo(X(GATE.x + GATE.w), Y(H - 5)); x.stroke();
  for (const [a, b] of [[4, 4], [W - 4, 4], [4, H - 4], [W - 4, H - 4]]) {
    x.fillStyle = '#5a5e64'; x.fillRect(X(a - 2), Y(b - 2), 4 * sc, 4 * sc);
    x.fillStyle = '#2a2e34'; x.fillRect(X(a - 1.2), Y(b - 1.2), 2.4 * sc, 2.4 * sc);
  }
  // people
  for (const n of npcs) person(x, X(n.x), Y(n.y), n.h, sc, n.co ? '#3a4a5a' : '#f0eee6', n.skin, n.walk);
  if (P.tap) { x.strokeStyle = `rgba(255,255,255,${P.tap.t})`; x.lineWidth = 2; x.beginPath(); x.arc(X(P.tap.x), Y(P.tap.y), (2 - P.tap.t) * sc, 0, 7); x.stroke(); }
  x.strokeStyle = '#ffd34a'; x.lineWidth = 2; x.beginPath(); x.arc(X(P.x), Y(P.y), 1.2 * sc, 0, 7); x.stroke();
  person(x, X(P.x), Y(P.y), P.h, sc, '#ffffff', s.player.look?.skin || '#8a5a3a', P.walk);
  // night: dark, with the floodlights on
  const hr = (s.time.min / 60) % 24, night = hr >= 20 || hr < 6 ? 0.55 : hr >= 18 ? 0.25 : 0;
  if (night) {
    x.fillStyle = `rgba(8,12,30,${night})`; x.fillRect(0, 0, cw, ch);
    x.save(); x.globalCompositeOperation = 'lighter';
    for (const [a, b] of [[4, 4], [W - 4, 4], [4, H - 4], [W - 4, H - 4], [W / 2, H / 2]]) {
      const g = x.createRadialGradient(X(a), Y(b), 0, X(a), Y(b), 30 * sc);
      g.addColorStop(0, `rgba(255,240,200,${night * 0.35})`); g.addColorStop(1, 'rgba(255,240,200,0)');
      x.fillStyle = g; x.beginPath(); x.arc(X(a), Y(b), 30 * sc, 0, 7); x.fill();
    }
    x.restore();
  }
  return { x0, y0, sc };
}
function person(x, px, py, h, sc, cloth, skin, walk = 0) {
  const k = Math.max(0.6 * sc, 5), sw = Math.sin(walk * 2.4) * 0.35;
  x.save(); x.translate(px, py); x.rotate(h);
  x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(0.12 * k, 0.12 * k, 0.75 * k, 0.55 * k, 0, 0, 7); x.fill();
  x.fillStyle = cloth; x.beginPath(); x.ellipse(sw * k * 0.3, 0, 0.45 * k, 0.75 * k, 0, 0, 7); x.fill();
  x.fillStyle = skin; x.beginPath(); x.arc(0.1 * k, 0, 0.36 * k, 0, 7); x.fill();
  x.restore();
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

