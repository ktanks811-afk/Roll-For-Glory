// Boot, main loop and mode switching (title → character → world ⇄ race).

import { game, fmtMoney, activeCar, carValue, spend, hourOf, dayName } from './core/state.js';
import { MEET_NIGHTS, MEET_LOC } from './core/nightmeet.js';
import { on, emit } from './core/events.js';
import { input } from './core/input.js';
import { touchUi } from './ui/touch.js';
import { padNav } from './ui/padnav.js';
import { audio } from './core/audio.js';
import { saveGame, settings } from './core/save.js';
import { initStory, maybeChallenge, sendMessage } from './core/story.js';
import { offerMission } from './core/missions.js';
import { newDay as hustleDay, ensure as ensureHustle } from './core/hustle.js';
import { drugsDay } from './core/drugs.js';
import { fedsDay } from './core/bank.js';
import { chopDay, PARTS_CHARGE } from './core/chop.js';
import { raidWhileAway } from './world2d/trap.js';
import { citationsDue, addWarrant } from './core/warrants.js';
import { courtTick, openCase, probationDay, courtName, fmtCourt } from './core/justice.js';
import { book } from './ui/court.js';
import { wakeAtHospital } from './ui/hospital.js';
import { heal, healthDay, INJURIES, HOSPITAL } from './core/health.js';
import { $, toast, modal, panelOpen, setPanelListener, closePanel, topPanel, modalOpen } from './ui/dom.js';
import { Hud } from './ui/hud.js';
import { initOnline } from './ui/online.js';
import { initCrews } from './ui/ocrew.js';
import { initTurf } from './core/turf.js';
import { initGangs } from './core/gangs.js';
import { initFeed, feedHour } from './core/feed.js';
import { initOrientation } from './ui/orientation.js';
import { initGameFeel } from './ui/gameFeel.js';
import { online } from './net/online.js';
import { auth } from './net/auth.js';
import { showAuth } from './ui/account.js';
import { World, getMap } from './world2d/world.js';
import { MenuBackdrop, showTitle, openPause } from './ui/menu.js';
import { openPhone } from './ui/phone.js';
import { openPlace } from './ui/places.js';
import { generateListings, makeListing, buyerOffer } from './data/market.js';
import { ITEM_BY_ID } from './data/catalog.js';
import { contactInfo } from './data/npcs.js';
import { loadCarArt } from './gfx2d/carArt.js';

const canvas = $('#game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, settings.quality === 'low' ? 1 : settings.quality === 'high' ? 2 : 1.5);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
}
window.addEventListener('resize', resize);
resize();

export const app = {
  mode: 'title',
  world: null,
  race: null,
  backdrop: null,
  hud: null,
};

// Everything the world and screens need from the shell.
export const ui = {
  get hud() { return app.hud; },
  toast, modal,
  openPhone: appId => openPhone(appId, app),
  openPause: () => openPause(app),
  openPlace: (loc, world) => openPlace(loc, app),
  onNewDay() { newDay(); },
  onMorning() { morning(); },
  onHour() { hourly(); },
  book: c => book(app, c),
  hospital: o => wakeAtHospital(app, o),
};

// ---------------- mode switching ----------------
export function enterWorld() {
  if (app.race) { app.race.destroy(); app.race = null; }
  app.mode = 'world';
  if (!app.hud) app.hud = new Hud();
  app.hud.show(true);
  if (!app.world) app.world = new World(ui);
  else app.world.refreshCar();
  app.world.paused = false;
  $('#screen').innerHTML = '';
  const away = ensureHustle(game.s).away;
  if (away) { game.s.hustle.away = null; modal('Welcome back', `<p>While you were away (${away.hours} h), your side hustles earned <b>${fmtMoney(away.net)}</b>. It's in your bank.</p>`); }
  touchUi.show(true);
  audio.music(null);
}

export function leaveWorld() {
  online.leave();
  if (app.world) { app.world.destroy(); app.world = null; }
  if (app.hud) app.hud.show(false);
  touchUi.show(false);
}

export function startRace(RaceClass, opts) {
  if (app.world) { app.world.paused = true; if (app.world.engine) { app.world.engine.stop(); app.world.engine = null; } }
  if (app.hud) app.hud.show(false);
  app.race = new RaceClass(opts, result => {
    app.race = null;
    if (app.world) app.mode = 'world';
    if (opts.onDone) opts.onDone(result);
  });
  app.mode = 'race';
}

export function toTitle() {
  leaveWorld();
  if (app.race) { app.race.destroy(); app.race = null; }
  game.s = null;
  app.mode = 'title';
  showTitle(app);
}

// ---------------- time-based events ----------------
function hourly() {
  const s = game.s;
  if (!s) return;
  // injuries heal by the hour
  for (const j of heal(s, 60)) toast(`${INJURIES[j.kind]?.icon || '✚'} Your ${INJURIES[j.kind]?.name.toLowerCase() || 'injury'} has healed.`, 'good');
  // the docket closed and you weren't in the courtroom
  const fta = courtTick(s, addWarrant);
  if (fta) sendMessage(s, 'clerk', `You failed to appear in ${courtName(fta.case)} (Cause No. ${fta.case.cause}). The judge issued a warrant for your arrest for bail jumping${fta.forfeited ? ` and your ${fmtMoney(fta.forfeited)} bail is forfeited` : ''}. Turn yourself in at the courthouse or a precinct.`, { action: { type: 'gps', loc: 'courthouse' } });
  maybeChallenge(s);
  offerMission(s);
  feedHour(s);
  // buyers message you about cars you have listed
  for (const ml of s.myListings) {
    const car = s.cars.find(c => c.uid === ml.carUid);
    if (!car) continue;
    const offer = buyerOffer(carValue(car), ml.asking);
    if (offer) {
      ml.offers.push({ ...offer, id: Math.random().toString(36).slice(2) });
      sendMessage(s, 'marketplace', `${offer.name}: "${offer.msg} ${fmtMoney(offer.amount)}" — re: your ${car.year} listing`, { action: { type: 'offer', carUid: car.uid } });
    }
  }
  // a fresh listing now and then
  if (Math.random() < 0.5) { s.listings.unshift(makeListing()); if (s.listings.length > 40) s.listings.pop(); }
}

function morning() {
  const s = game.s;
  // court today
  const c = openCase(s);
  if (c && !c.fta && !c.held && c.date.day === s.time.day) sendMessage(s, 'clerk', `Reminder: you're on today's docket in ${courtName(c)}, ${fmtCourt(c.date)}, Tarrant County Courthouse. Doors close at 5 PM.`, { action: { type: 'gps', loc: 'courthouse' } });
  // deliveries
  const arrived = s.orders.filter(o => o.arriveDay <= s.time.day);
  if (arrived.length) {
    for (const o of arrived) for (const pid of o.items) s.partsBin.push({ pid, uid: Math.random().toString(36).slice(2) });
    s.orders = s.orders.filter(o => o.arriveDay > s.time.day);
    const names = arrived.flatMap(o => o.items).map(pid => ITEM_BY_ID[pid]?.name).slice(0, 3).join(', ');
    sendMessage(s, 'partshub', `📦 Delivered to your door: ${names}${arrived.flatMap(o => o.items).length > 3 ? ' and more' : ''}. Install them at home (DIY) or at Torque Temple.`);
  }
}

function newDay() {
  const s = game.s;
  // the weekend night meet: Dre texts the spot on Friday and Saturday
  if (MEET_NIGHTS.includes(dayName(s.time))) sendMessage(s, 'kingpin', `Meet tonight at La Gran Plaza, 9 PM till 3. Crews are pulling up. Bring something clean.`, { action: { type: 'gps', loc: MEET_LOC } });
  hustleDay(s);
  // trap houses: workers sell, the heat cools off, SWAT hits a house you weren't at
  const dr = drugsDay(s);
  for (const n of dr.notes) toast(n, 'info');
  for (const r of dr.raids) raidWhileAway(s, r);
  // your businesses wash what you dropped off; the feds cool off or close in
  for (const n of fedsDay(s)) toast(n, 'info');
  // the chop shop cools off, or the task force sweeps it while you're not there
  const ch = chopDay(s);
  if (ch?.swept) {
    if (ch.talked) addWarrant(s, { ...PARTS_CHARGE, fine: Math.max(2000, PARTS_CHARGE.fine), felony: true, evidence: 'Junior Marchetti\'s statement to the task force' });
    sendMessage(s, 'junior', `Task force hit the yard this morning. They took everything off the shelf${ch.took.parts ? ` (${ch.took.parts} of your parts)` : ''} and chained the gate. ${ch.talked ? 'They had me in a room for six hours. I\'m sorry, man. They know your name.' : 'I didn\'t say nothing.'} Lay low for a few days.`);
  }
  // marketplace churn
  s.listings = s.listings.filter(() => Math.random() > 0.3);
  while (s.listings.length < 30) s.listings.push(makeListing());
  // weekly bills
  if (s.time.day % 7 === 0) {
    if (s.insurance) {
      const prem = Math.round(40 + s.cars.reduce((a, c) => a + carValue(c), 0) * 0.0022);
      if (!spend(s, prem, 'Weekly insurance premium')) { s.insurance = false; sendMessage(s, 'insurance', 'Your policy lapsed — the payment bounced.'); }
    }
    const upkeep = s.properties.length > 1 ? 120 * (s.properties.length - 1) : 0;
    if (upkeep) spend(s, upkeep, 'Property taxes & utilities');
  }
  // unpaid tickets past their due date become warrants
  const late = citationsDue(s);
  if (late.length) sendMessage(s, 'brenner', `You didn't pay your ticket${late.length > 1 ? 's' : ''}. There's a warrant out for you now (${fmtMoney(late.reduce((t, w) => t + w.fine, 0))} with the late fee). Pay it at a precinct or in the FWPD app before one of my officers runs your plate.`);
  // medical bills: plan payments, past due, collections, garnishment
  for (const n of healthDay(s)) sendMessage(s, n.from, n.text, n.from === 'jps' ? { action: { type: 'gps', loc: HOSPITAL } } : {});
  // probation runs out
  const pr = probationDay(s);
  if (pr?.done) sendMessage(s, 'clerk', pr.deferred ? 'You completed deferred adjudication. Your case is dismissed and there is no conviction on your record.' : 'You completed your probation. Your supervision is discharged.');
  // sponsor deals expire
  if (s.sponsor && s.sponsor.until < s.time.day) { sendMessage(s, s.sponsor.contact || 'kingpin', `Your ${s.sponsor.name} sponsorship ended.`); s.sponsor = null; }
  saveGame('auto', true);
}

// ---------------- notifications ----------------
on('toast', t => toast(t.text, t.kind));
on('money', m => { if (Math.abs(m.amount) >= 1) toast(`${m.amount > 0 ? '+' : ''}${fmtMoney(m.amount)}${m.dirty ? ' 💵' : ''} · ${m.label}`, m.amount > 0 ? 'money' : 'info'); if (m.amount > 0) audio.buy(); });
on('rep', r => { if (Math.abs(r.amount) >= 5) toast(`${r.amount > 0 ? '+' : ''}${r.amount} REP · ${r.reason}`, r.amount > 0 ? 'good' : 'bad'); });
on('tierUp', ({ tier }) => { audio.win(); modal(`Tier ${tier.n}: ${tier.name}`, `<p>Your name is getting around. New racers will take your calls, bigger wagers are on the table, and new spots open up.</p>`); });
on('message', m => {
  if (!game.s) return;
  if (app.world?.downed) return;   // laid up at JPS: the texts wait in your phone (ui/hospital.js)
  audio.phone();
  const who = m.from === 'marketplace' ? 'Marketplace' : m.from === 'partshub' ? 'PartsHub' : m.from === 'insurance' ? 'Insurance' : contactInfo(m.from).name;
  toast(`📱 ${who}: ${m.text.slice(0, 70)}${m.text.length > 70 ? '…' : ''}`, 'info');
});

setPanelListener(n => {
  input.setEnabled(true);
  if (app.world) app.world.paused = n > 0;
});

window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && panelOpen() && !modalOpen()) { e.preventDefault(); closePanel(topPanel()); }
});

// Swiping home or taking a call on iPhone: iOS may never bring the app back,
// so save right away, and let go of every held pedal / wheel / key so the car
// isn't still flooring it when you return.
function onBackground() {
  touchUi.releaseAll?.();
  window.dispatchEvent(new Event('blur'));
  if (app.mode === 'world' && app.world && game.s) saveGame('auto', true);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) onBackground(); });
window.addEventListener('pagehide', onBackground);

// ---------------- loop ----------------
let last = performance.now();
let fpsT = 0, frames = 0, fps = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  input.pollPad(padNav);   // controller: menus first, then the game
  // which control scheme is live: walking, driving, racing, or none
  input.setContext(app.mode === 'race' ? 'race' : app.mode === 'world' && app.world ? (app.world.inCar && app.world.vehicle ? 'car' : 'foot') : 'menu');
  try {
    if (app.mode === 'world' && app.world) {
      if (!panelOpen() && !modalOpen()) app.world.update(dt);
      app.world.draw(ctx, W, H, dt);
    } else if (app.mode === 'race' && app.race) {
      app.race.update(dt);
      app.race.draw(ctx, W, H, dt);
    } else if (app.backdrop) {
      app.backdrop.update(dt);
      app.backdrop.draw(ctx, W, H, dt);
    }
  } catch (err) {
    console.error(err);
    if (!frame.errShown) { frame.errShown = true; toast('Something broke: ' + err.message, 'bad'); }
  }
  frames++; fpsT += dt;
  if (fpsT > 1) { fps = frames; frames = 0; fpsT = 0; }
  if (settings.showFps) { ctx.fillStyle = '#0f0'; ctx.font = '12px monospace'; ctx.fillText(`${fps} fps`, W - 60, H - 8); }
  input.endFrame();
  requestAnimationFrame(frame);
}

// ---------------- boot ----------------
// Fill the loading bar, keep the loading art up for a beat (tap skips), then fade it out.
const BOOT_MIN_MS = 1600;
function hideBoot() {
  const el = $('#boot');
  clearInterval(window.__bootTick);
  $('#boot-fill').style.width = '100%';
  $('#boot-msg').textContent = 'Ready';
  let gone = false;
  const go = () => {
    if (gone) return; gone = true;
    el.classList.add('done');
    setTimeout(() => { el.style.display = 'none'; }, 400);
  };
  el.addEventListener('pointerdown', go, { once: true });
  setTimeout(go, Math.max(300, BOOT_MIN_MS - performance.now()));
}
async function boot() {
  try {
    getMap();
    await loadCarArt();
    initGameFeel();
    touchUi.mount($('#touch'));
    initStory();
    app.backdrop = new MenuBackdrop();
    const signedIn = await auth.restore();
    if (signedIn.recovery) showAuth(app, { mode: 'newpass', onDone: () => showTitle(app) });
    else if (signedIn.linkError) showAuth(app, { mode: 'login', note: signedIn.linkError, onDone: () => showTitle(app) });
    else showTitle(app);
    // Logged out from somewhere else (password changed, etc.): back to the log-in screen once off the streets.
    auth.onChange(u => { if (!u && app.mode === 'title') showTitle(app); });
    hideBoot();
    requestAnimationFrame(frame);
    window.__rfg = { app, game, ui, online, auth };
    initOnline(app);
    initCrews(app);
    initTurf(app);
    initGangs();
    initFeed();
    initOrientation();
  } catch (e) {
    console.error(e);
    $('#boot-msg').textContent = 'Failed to start: ' + e.message;
  }
}
boot();
