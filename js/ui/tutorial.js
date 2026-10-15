// First-play tour: a small coach card that walks a new player through the
// basics (moving, the HUD, the phone, Marketplace, doors, driving, heat).
// It never pauses the game. Steps that ask you to do something move on by
// themselves once you've done it; every step also has Next, and Skip ends it.
//
// Shows once per profile on its first new career (settings.tutorialSeen);
// players who already had careers never get it unasked. Replay it from the
// pause menu.

import { $, el, esc, panelOpen, modalOpen } from './dom.js';
import { settings, saveSettings } from '../core/save.js';
import { touchUi } from './touch.js';
import { pad, padPressed } from '../core/gamepad.js';
import { audio } from '../core/audio.js';

const dev = () => pad.inUse ? 'pad' : touchUi.active ? 'touch' : 'keys';
const pick = o => o[dev()] ?? o.keys;
const shown = sel => { const n = sel && document.querySelector(sel); if (!n) return null; const r = n.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !n.closest('.hidden') ? n : null; };
const phoneOpen = () => !!shown('#panels .phone-panel:not(.hidden) .phone');
const footPos = w => w.inCar && w.vehicle ? { x: w.vehicle.x, z: w.vehicle.z } : { x: w.foot?.x ?? 0, z: w.foot?.z ?? 0 };

const STEPS = [
  { title: 'Welcome to Murda Worth',
    text: () => 'You just landed in Fort Worth with $4,500, a phone and a studio apartment in Eastgate. No car yet. This quick tour takes about a minute.',
    next: "Let's go" },
  { title: 'Get moving',
    text: () => pick({ touch: 'Drag the joystick at the bottom left to walk. Tap RUN to jog.', keys: 'Walk with W A S D. Hold Shift to run.', pad: 'Walk with the left stick. Hold B to run.' }),
    target: () => dev() === 'touch' ? '[data-stick]' : null,
    start: (t, w) => { t.from = footPos(w); },
    done: (t, w) => { const p = footPos(w); return Math.hypot(p.x - t.from.x, p.z - t.from.z) > 5; } },
  { title: 'Cash and REP',
    text: () => 'Top right is your cash, with your bank balance under it, then your REP. Win races and finish jobs to climb tiers. Each tier opens new racers, bigger bets and new spots.',
    target: () => '.hud-money' },
  { title: 'What to do next',
    text: () => 'Your current goal sits here, over the minimap. Story texts, jobs and GPS routes keep it up to date.',
    target: () => shown('[data-obj]') ? '[data-obj]' : '.hud-mini' },
  { title: 'Eat and sleep',
    text: () => 'Food 🌮 and energy ⚡. Grab food at taco spots and gas stations, and sleep at a place you own. Sleeping also saves your game.',
    target: () => '[data-needs]' },
  { title: 'Open your phone',
    text: () => pick({ touch: 'Tap the ☎ button at the top right.', keys: 'Press P, or click ☎ at the top right.', pad: 'Press View to pull out your phone.' }),
    target: () => '[data-tp="phone"]',
    done: () => phoneOpen() },
  { title: 'Your whole life is in here',
    text: () => 'Marketplace sells used cars, Map has GPS and fast travel, Messages is where racers challenge you, and Hustle is quick side money. Open Marketplace now.',
    target: () => !phoneOpen() ? '[data-tp="phone"]' : shown('.phone .app[data-id="marketplace"]') ? '.phone .app[data-id="marketplace"]' : '.phone',
    done: () => !!shown('.phone .mp') },
  { title: 'Your first car',
    text: () => 'Cheap, high-mileage cars show up here all the time. Check the mileage, title and problems, haggle with the seller, then GPS to them and pick it up. Keep some cash for gas and insurance.',
    target: () => phoneOpen() ? '.phone' : null },
  { title: 'Put the phone away',
    text: () => pick({ touch: 'Tap the bar at the bottom of the phone to go home, then again to close it.', keys: 'Press Esc, or click the bar at the bottom of the phone twice.', pad: 'Press View or B to put the phone away.' }),
    target: () => phoneOpen() ? '[data-phone-home]' : null,
    done: () => !phoneOpen() },
  { title: 'Shops, doors and races',
    text: () => pick({ touch: 'Walk up to a marked spot (shops, your apartment, gas stations, race starts) and tap USE to go in.', keys: 'Walk up to a marked spot (shops, your apartment, gas stations, race starts) and press E to go in.', pad: 'Walk up to a marked spot (shops, your apartment, gas stations, race starts) and press A to go in.' }),
    target: () => dev() === 'touch' ? '.tc-foot .tc-use' : null },
  { title: 'Behind the wheel',
    text: () => pick({ touch: 'Stand next to your car and tap GET IN. Steer with the arrows on the left, GAS and BRAKE on the right. Drag the shift knob to change gears.', keys: 'Stand next to your car and press F. W is gas, S brakes, A and D steer, Space is the e-brake and N is nitrous.', pad: 'Stand next to your car and press Y. RT is gas, LT brakes, the left stick steers and X is nitrous.' }) },
  { title: 'Watch the heat',
    text: () => 'These bars are police heat. Speeding, street racing and crimes fill them up. Lose the cops, or pay off tickets at a precinct before they turn into warrants.',
    target: () => '[data-heat]' },
  { title: "You're all set",
    text: () => 'Texts on your phone will point you to what\'s next. Replay this tour any time from the ☰ menu, under Tutorial.',
    next: 'Hit the streets' },
];

let cur = null;   // { i, card, ring, timer, world, state }

export function tutorialActive() { return !!cur; }

// First new career on this profile: show the tour once.
export function maybeStartTutorial(app, { veteran = false } = {}) {
  if (settings.tutorialSeen) return;
  settings.tutorialSeen = true;
  saveSettings();
  if (!veteran) startTutorial(app);
}

export function startTutorial(app) {
  stopTutorial();
  const card = el(`<div class="coach" role="dialog" aria-live="polite"></div>`);
  const ring = el(`<div class="coach-ring hidden"></div>`);
  document.body.append(ring, card);
  cur = { i: -1, card, ring, app, t: {} };
  card.addEventListener('click', e => {
    const a = e.target.closest('[data-coach]')?.dataset.coach;
    if (!a) return;
    e.stopPropagation();
    audio.click();
    if (a === 'skip') stopTutorial();
    else go(cur.i + 1);
  });
  // keep the card off the joystick and pedals, and away from what it points at
  card.addEventListener('pointerdown', e => e.stopPropagation());
  cur.timer = setInterval(tick, 200);
  go(0);
}

export function stopTutorial() {
  if (!cur) return;
  clearInterval(cur.timer);
  cur.card.remove(); cur.ring.remove();
  cur = null;
}

function go(i) {
  if (!cur) return;
  if (i >= STEPS.length) { stopTutorial(); return; }
  cur.i = i;
  cur.t = {};
  const st = STEPS[i], w = cur.app.world;
  if (st.start && w) st.start(cur.t, w);
  render();
}

function render() {
  const st = STEPS[cur.i];
  const last = cur.i === STEPS.length - 1;
  cur.text = st.text();
  cur.card.innerHTML = `<div class="coach-top"><small>Tour · ${cur.i + 1} of ${STEPS.length}</small>${last ? '' : '<button class="coach-skip" data-coach="skip">Skip tour</button>'}</div>
    <h3>${esc(st.title)}</h3><p>${esc(cur.text)}</p>
    <div class="coach-foot">${st.done ? '<span class="coach-wait">Do it, or</span>' : ''}<button class="btn btn-primary btn-sm" data-coach="next">${esc(st.next || (st.done ? 'Skip step' : 'Next'))}</button></div>
    <div class="coach-dots">${STEPS.map((_, j) => `<i class="${j < cur.i ? 'on' : j === cur.i ? 'now' : ''}"></i>`).join('')}</div>`;
  place();
}

function tick() {
  if (!cur) return;
  const app = cur.app, w = app.world;
  // the career ended (quit to title, jail, a race): put the tour away
  if (app.mode === 'title' || !w) { stopTutorial(); return; }
  // stay out of the way of dialogs and races
  const hide = modalOpen() || app.mode === 'race';
  cur.card.classList.toggle('hidden', hide);
  if (hide) { cur.ring.classList.add('hidden'); return; }
  const st = STEPS[cur.i];
  if (st.done && st.done(cur.t, w)) { audio.buy?.(); go(cur.i + 1); return; }
  // the text follows what you're holding (touch / keys / controller)
  if (st.text() !== cur.text) { render(); return; }
  place();
}

// Controller: D-pad right is Next while you're walking around (padnav owns it in menus).
export function tutorialPad() {
  if (!cur || panelOpen() || modalOpen()) return;
  if (padPressed('RIGHT')) go(cur.i + 1);
}

function rectOf(n) { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
function overlap(a, b) { return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); }

// Spotlight the target, then put the card wherever it covers the least of it,
// the open phone and the thumb controls.
function place() {
  const st = STEPS[cur.i], card = cur.card, ring = cur.ring;
  const sel = st.target?.();
  const tgt = shown(sel);
  // a phone app below the fold: scroll it into view once
  if (tgt && tgt !== cur.scrolled && tgt.closest('.phone-screen')) { cur.scrolled = tgt; tgt.scrollIntoView({ block: 'nearest' }); }
  if (tgt) {
    const r = rectOf(tgt), pad = 6;
    Object.assign(ring.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + pad * 2 + 'px', height: r.h + pad * 2 + 'px' });
    ring.classList.remove('hidden');
  } else ring.classList.add('hidden');

  const W = window.innerWidth, H = window.innerHeight, m = 10;
  const phoneEl = shown('#panels .phone-panel:not(.hidden) .phone');
  const ph = phoneEl ? rectOf(phoneEl) : null;
  const avoid = [phoneEl, shown('[data-stick]'), shown('.tc-pedals'), shown('.tc-foot-btns'), shown('.hud-tl'), shown('.hud-tr'), shown('.hud-btns'), shown('[data-obj]')]
    .filter(Boolean).map(rectOf);
  if (tgt) avoid.unshift(rectOf(tgt));
  // narrower when the phone is up in landscape, so it fits beside it
  let cw = Math.min(320, W - m * 2);
  if (ph) { const side = Math.max(ph.x, W - ph.x - ph.w) - m * 2; if (side >= 180) cw = Math.min(cw, side); }
  card.style.width = cw + 'px';
  const ch = card.offsetHeight;
  const cx = (W - cw) / 2;
  const spots = [
    { x: cx, y: Math.max(m, H * 0.18) },           // upper middle
    { x: cx, y: (H - ch) / 2 },                    // middle
    { x: cx, y: H - ch - m },                      // bottom middle
    { x: m, y: (H - ch) / 2 }, { x: W - cw - m, y: (H - ch) / 2 },   // sides
    { x: m, y: H - ch - m }, { x: W - cw - m, y: H - ch - m },
    { x: m, y: m }, { x: W - cw - m, y: m },
  ];
  let best = spots[0], bestCost = Infinity;
  spots.forEach((s, k) => {
    s.y = Math.max(m, Math.min(H - ch - m, s.y));
    const box = { x: s.x, y: s.y, w: cw, h: ch };
    // the spotlit thing counts double; ties go to the earlier (more central) spot
    const cost = avoid.reduce((t, a, j) => t + overlap(box, a) * (j === 0 && tgt ? 3 : 1), 0) + k;
    if (cost < bestCost) { bestCost = cost; best = s; }
  });
  card.style.left = Math.round(best.x) + 'px';
  card.style.top = Math.round(best.y) + 'px';
}

window.addEventListener('resize', () => { if (cur) place(); });
