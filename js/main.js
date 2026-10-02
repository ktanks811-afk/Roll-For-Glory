// Boot, main loop and mode switching (title → character → world ⇄ race).

import { game, fmtMoney, activeCar, carValue, spend, hourOf } from './core/state.js';
import { on, emit } from './core/events.js';
import { input } from './core/input.js';
import { touchUi } from './ui/touch.js';
import { audio } from './core/audio.js';
import { saveGame, settings } from './core/save.js';
import { initStory, maybeChallenge, sendMessage } from './core/story.js';
import { $, toast, modal, panelOpen, setPanelListener, closePanel, topPanel, modalOpen } from './ui/dom.js';
import { Hud } from './ui/hud.js';
import { initOnline } from './ui/online.js';
import { initOrientation } from './ui/orientation.js';
import { online } from './net/online.js';
import { World, getMap } from './world2d/world.js';
import { MenuBackdrop, showTitle, openPause } from './ui/menu.js';
import { openPhone } from './ui/phone.js';
import { openPlace } from './ui/places.js';
import { generateListings, makeListing, buyerOffer } from './data/market.js';
import { ITEM_BY_ID } from './data/catalog.js';
import { contactInfo } from './data/npcs.js';

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
  maybeChallenge(s);
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
  // sponsor deals expire
  if (s.sponsor && s.sponsor.until < s.time.day) { sendMessage(s, s.sponsor.contact || 'kingpin', `Your ${s.sponsor.name} sponsorship ended.`); s.sponsor = null; }
  saveGame('auto', true);
}

// ---------------- notifications ----------------
on('toast', t => toast(t.text, t.kind));
on('money', m => { if (Math.abs(m.amount) >= 1) toast(`${m.amount > 0 ? '+' : ''}${fmtMoney(m.amount)} · ${m.label}`, m.amount > 0 ? 'money' : 'info'); if (m.amount > 0) audio.buy(); });
on('rep', r => { if (Math.abs(r.amount) >= 5) toast(`${r.amount > 0 ? '+' : ''}${r.amount} REP · ${r.reason}`, r.amount > 0 ? 'good' : 'bad'); });
on('tierUp', ({ tier }) => { audio.win(); modal(`Tier ${tier.n}: ${tier.name}`, `<p>Your name is getting around. New racers will take your calls, bigger wagers are on the table, and new spots open up.</p>`); });
on('message', m => {
  if (!game.s) return;
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

// ---------------- loop ----------------
let last = performance.now();
let fpsT = 0, frames = 0, fps = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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
async function boot() {
  try {
    getMap();
    touchUi.mount($('#touch'));
    initStory();
    app.backdrop = new MenuBackdrop();
    showTitle(app);
    $('#boot').style.display = 'none';
    requestAnimationFrame(frame);
    window.__rfg = { app, game, ui, online };
    initOnline(app);
    initOrientation();
  } catch (e) {
    console.error(e);
    $('#boot-msg').textContent = 'Failed to start: ' + e.message;
  }
}
boot();
