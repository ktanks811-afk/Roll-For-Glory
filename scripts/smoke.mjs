// Headless playthrough: title → new game → world → phone apps → buy a car
// → drive → garage → PartsHub → drag race → roll race. Fails on any console
// error or uncaught exception.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8123/index.html';
const OUT = process.env.OUT || '/tmp/claude-0/shots';
const shots = !!process.env.SHOTS;
import fs from 'fs'; if (shots) fs.mkdirSync(OUT, { recursive: true });
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
const b = await chromium.launch({ executablePath: exe });
const mainCtx = await b.newContext({ viewport: { width: 1280, height: 760 } });   // shared by the online test's second tab
const p = await mainCtx.newPage();
p.setDefaultTimeout(8000);
const errs = [];
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
const snap = async n => { if (shots) await p.screenshot({ path: `${OUT}/${n}.png` }); };
const step = async (name, fn) => { try { await fn(); console.error('ok  ', name); } catch (e) { errs.push(`step ${name}: ${e.message}`); console.error('FAIL', name, e.message); } };
const key = async (k, ms = 80) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };

await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__rfg, null, { timeout: 15000 });
await p.waitForTimeout(800);
await snap('01-title');
await step('new game', async () => {
  await p.click('text=New Game');
  await p.fill('[data-name]', 'Tester');
  await snap('02-create');
  await p.click('text=Hit the streets');
  await p.waitForTimeout(1200);
  await snap('03-world');
});
await step('walk', async () => { await key('KeyW', 600); await key('KeyD', 300); });
await step('phone home', async () => { await key('KeyP'); await p.waitForTimeout(300); await snap('04-phone'); });
for (const app of ['Messages', 'Contacts', 'Map', 'Bank', 'Throttle', 'Races', 'Ryde', 'Crew', 'My Cars', 'Journal']) {
  await step('app ' + app, async () => {
    await p.click(`.app:has-text("${app}")`);
    await p.waitForTimeout(200);
    if (app === 'Map') await snap('05-map');
    await p.click('.phone-bar button');
    await p.waitForTimeout(100);
  });
}
await step('marketplace browse + buy', async () => {
  await p.click('.app:has-text("Marketplace")');
  await p.waitForTimeout(300);
  await p.click('.mp-filters button:has-text("Any price")');
  await snap('06-marketplace');
  await p.click('.mp-filters button:has-text("Under $5k")');
  await p.evaluate(() => { window.__rfg.game.s.cash += 20000; });   // the first listing might cost more than the starting cash
  await p.click('.mp-item >> nth=0');
  await p.waitForTimeout(200);
  await snap('07-listing');
  await p.click('text=Is this still available?');
  await p.click('text=Offer asking price');
  await p.click('button:has-text("& pick it up")');
  await p.waitForTimeout(300);
  await snap('08-bought');
  await p.click('.modal button');
});
await step('teleport to car + drive', async () => {
  await p.evaluate(() => { const w = window.__rfg.app.world; w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; });
  await p.waitForTimeout(200);
  await key('KeyF');
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2500);
  await p.keyboard.down('KeyA'); await p.waitForTimeout(600); await p.keyboard.up('KeyA');
  await p.keyboard.down('Space'); await p.waitForTimeout(300); await p.keyboard.up('Space');
  await p.keyboard.up('KeyW');
  await snap('09-driving');
  const st = await p.evaluate(() => { const w = window.__rfg.app.world; return { inCar: w.inCar, v: w.vehicle.speed, traffic: w.traffic.cars.length }; });
  console.log('     driving state', JSON.stringify(st));
  if (!st.inCar) throw new Error('not in car');
});
await step('walking vs driving controls', async () => {
  const ctxNow = () => p.evaluate(async () => (await import('./js/core/input.js')).input.context);
  const snapState = () => p.evaluate(() => { const w = window.__rfg.app.world; return { cx: w.vehicle.x, cz: w.vehicle.z, fx: w.foot.x, fz: w.foot.z, inCar: w.inCar }; });
  const moved = (a, b, k) => Math.hypot(a[k + 'x'] - b[k + 'x'], a[k + 'z'] - b[k + 'z']) > 0.3;
  const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
  // park the car and step out
  await p.evaluate(() => { const w = window.__rfg.app.world; w.vehicle.vx = w.vehicle.vz = 0; w.vehicle.sim.v = 0; });
  await p.waitForTimeout(150);
  expect(await ctxNow() === 'car', 'expected car controls while driving');
  await key('KeyF'); await p.waitForTimeout(250);
  expect(await ctxNow() === 'foot', 'expected foot controls after getting out');
  // on foot: car keys do nothing
  let a = await snapState();
  for (const k of ['KeyN', 'Space', 'KeyQ']) await key(k, 250);
  let b = await snapState();
  expect(!moved(a, b, 'f') && !moved(a, b, 'c'), 'car keys moved something while on foot');
  // on foot: W walks the player, not the car
  await key('KeyW', 600); b = await snapState();
  expect(moved(a, b, 'f'), 'W did not walk the player');
  expect(!moved(a, b, 'c'), 'W moved the parked car while on foot');
  // Shift while walking runs, and must not fire nitrous
  const nos0 = await p.evaluate(() => window.__rfg.app.world.vehicle.sim.nos);
  await p.keyboard.down('ShiftLeft'); await key('KeyW', 400); await p.keyboard.up('ShiftLeft');
  expect(await p.evaluate(() => window.__rfg.app.world.vehicle.sim.nos) === nos0, 'Shift used nitrous while on foot');
  // holding Shift (run) while climbing in must not fire nitrous
  await p.evaluate(() => { const w = window.__rfg.app.world; w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; });
  await p.keyboard.down('ShiftLeft'); await key('KeyF'); await p.waitForTimeout(150);
  expect(await ctxNow() === 'car', 'expected car controls after getting in');
  const heldWhileLatched = await p.evaluate(async () => (await import('./js/core/input.js')).input.held('nitrous'));
  expect(heldWhileLatched === false, 'Shift held from walking triggered nitrous in the car');
  await p.keyboard.up('ShiftLeft'); await p.keyboard.down('ShiftLeft');
  expect(await p.evaluate(async () => (await import('./js/core/input.js')).input.held('nitrous')) === true, 'nitrous key does not work in the car after re-pressing');
  await p.keyboard.up('ShiftLeft');
  // in the car: W drives the car, not the player
  a = await snapState();
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW');
  b = await snapState();
  expect(moved(a, b, 'c'), 'W did not drive the car');
  expect(!moved(a, b, 'f'), 'W walked the player while in the car');
});
await step('night + police chase', async () => {
  await p.evaluate(() => { const s = window.__rfg.game.s; s.time.min = 23 * 60; s.heat = 3.2; const w = window.__rfg.app.world; w.police.lastSeen = { x: w.vehicle.x, z: w.vehicle.z }; w.police.phase = 'chase'; });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(3000); await p.keyboard.up('KeyW');
  await snap('10-night-chase');
  await p.evaluate(() => { window.__rfg.app.world.police.reset(window.__rfg.app.world); });
});
await step('garage', async () => {
  await p.evaluate(async () => { const { openGarage } = await import('./js/ui/garage.js'); openGarage(window.__rfg.app, { mode: 'home' }); });
  await p.waitForTimeout(300); await snap('11-garage');
  for (const t of ['Performance', 'Install', 'Looks', 'Dyno', 'Tune', 'Cars']) { await p.click(`.tabs button:has-text("${t}")`); await p.waitForTimeout(150); if (t === 'Dyno') { await p.click('text=Run a pull'); await p.waitForTimeout(3500); await snap('12-dyno'); } }
  await p.keyboard.press('Escape');
});
await step('partshub buy', async () => {
  await p.evaluate(async () => { const { openPartsHub } = await import('./js/ui/partshub.js'); openPartsHub(window.__rfg.app); });
  await p.waitForTimeout(300);
  await p.click('.shop-side button:has-text("Tires")');
  await snap('13-partshub');
  await p.click('.prod >> nth=0 >> button');
  await p.click('.tabs button:has-text("Cart")');
  const binBefore = await p.evaluate(() => window.__rfg.game.s.partsBin.length);
  await p.click('text=Place order');
  await p.waitForTimeout(150);
  // instant delivery: the part is in the bin the moment the order is placed, no waiting for morning
  const binAfter = await p.evaluate(() => window.__rfg.game.s.partsBin.length), pending = await p.evaluate(() => window.__rfg.game.s.orders.length);
  if (binAfter !== binBefore + 1 || pending !== 0) throw new Error(`order was not instant (bin ${binBefore} -> ${binAfter}, pending ${pending})`);
  if (await p.$('.tabs button:has-text("Orders")')) throw new Error('there should be no Orders tab to wait on');
  await p.keyboard.press('Escape');
  // install at a shop
  await p.evaluate(async () => { const { openGarage } = await import('./js/ui/garage.js'); openGarage(window.__rfg.app, { mode: 'perf', tab: 'install' }); });
  await p.waitForTimeout(200);
  await p.click('button:has-text("Install") >> nth=1').catch(() => p.click('.li button.btn-primary'));
  await p.waitForTimeout(200);
  const n = await p.evaluate(() => window.__rfg.game.s.partsBin.length);
  console.log('     bin after install', n);
  await p.keyboard.press('Escape');
});
await step('drag race', async () => {
  await p.evaluate(async () => { const { openRaceSetup } = await import('./js/ui/raceSetup.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); window.__rfg.game.s.cash += 5000; openRaceSetup(window.__rfg.app, { type: 'drag', loc: LOC_BY_ID.ironline }); });
  await p.waitForTimeout(300); await snap('14-race-setup');
  await p.click('.li.click >> nth=1');
  await p.click('text=Line up');
  await p.waitForTimeout(500);
  // burnout
  await p.keyboard.down('KeyS'); await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW'); await p.keyboard.up('KeyS');
  await snap('15-burnout');
  // stage
  await p.keyboard.down('KeyW');
  for (let i = 0; i < 60; i++) { const staged = await p.evaluate(() => window.__rfg.app.race?.p.staged); if (staged) break; await p.waitForTimeout(50); }
  await p.keyboard.up('KeyW');
  // hold brake + gas until green, then release brake
  await p.keyboard.down('KeyS'); await p.keyboard.down('KeyW');
  for (let i = 0; i < 100; i++) { const g = await p.evaluate(() => window.__rfg.app.race?.tree?.green); if (g) break; await p.waitForTimeout(30); }
  await p.keyboard.up('KeyS');
  await p.waitForTimeout(2000); await snap('16-drag');
  for (let i = 0; i < 200; i++) { const r = await p.evaluate(() => !window.__rfg.app.race); if (r) break; await p.waitForTimeout(100); }
  await p.keyboard.up('KeyW');
  await p.waitForTimeout(400); await snap('17-timeslip');
  await p.click('text=Back to the street');
});
await step('roll race', async () => {
  await p.evaluate(async () => { const { openRaceSetup } = await import('./js/ui/raceSetup.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); const w = window.__rfg.app.world; w.inCar = true; openRaceSetup(window.__rfg.app, { type: 'roll', loc: LOC_BY_ID.glory_onramp }); });
  await p.waitForTimeout(300);
  await p.click('text=Line up the roll');
  await p.waitForTimeout(3800);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); await snap('18-roll');
  for (let i = 0; i < 300; i++) { const r = await p.evaluate(() => !window.__rfg.app.race); if (r) break; await p.waitForTimeout(100); }
  await p.keyboard.up('KeyW');
  await p.waitForTimeout(400); await snap('19-roll-result');
  await p.click('text=Back to the street');
});
await step('places', async () => {
  for (const id of ['eastgate_studio', 'auto_row', 'halo_exotics', 'rusty_used', 'torque_temple', 'vega_kustoms', 'second_chance', 'gas_westbrook', 'luckys', 'threadline', 'bayline', 'pspd_central', 'pier9']) {
    await p.evaluate(async id => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); window.__rfg.game.s.rep = 40000; openPlace(LOC_BY_ID[id], window.__rfg.app); }, id);
    await p.waitForTimeout(250);
    if (['auto_row', 'pier9', 'halo_exotics'].includes(id)) await snap('20-' + id);
    await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
  }
});
await step('2-step flames (street + meet)', async () => {
  const world = () => p.evaluate(() => { const w = window.__rfg.app.world; return { inCar: w.inCar, flame: w.flame, flames: w.limiter?.flames || 0, rpm: Math.round(w.vehicle.sim?.rpm || 0), sp: w.vehicle.speed }; });
  await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); const w = window.__rfg.app.world; w.inCar = true; w.vehicle.speed = 0; w.paused = false; });
  const rev = async ms => {
    await p.evaluate(() => { const v = window.__rfg.app.world.vehicle; v.vx = 0; v.vz = 0; v.rev = 0; if (v.sim) v.sim.v = 0; });   // stopped, like a car parked at the lights
    await p.keyboard.down('KeyW'); await p.keyboard.down('KeyS'); await p.waitForTimeout(ms); const r = await world(); await p.keyboard.up('KeyS'); await p.keyboard.up('KeyW'); await p.waitForTimeout(300); return r; };
  // 1. no 2-step: revs hard but never any flames
  await p.evaluate(() => { const s = window.__rfg.game.s; const c = s.cars.find(c => c.uid === s.activeCar); delete c.parts.twostep; });
  const plain = await rev(2500);
  console.log('     plain rev', JSON.stringify(plain));
  if (plain.rpm < 3000) throw new Error('plain gas + brake did not rev the engine');
  if (plain.flames !== 0 || plain.flame > 0) throw new Error('flames without a 2-step');
  // 2. install a 2-step: flames appear on gas + brake
  await p.evaluate(async () => { const { CATALOG, fits } = await import('./js/data/catalog.js'); const { CAR_BY_ID } = await import('./js/data/cars.js'); const s = window.__rfg.game.s; const c = s.cars.find(c => c.uid === s.activeCar); const it = CATALOG.find(p => p.cat === 'twostep' && fits(p, CAR_BY_ID[c.modelId])); if (!it) throw new Error('no 2-step fits the test car'); c.parts.twostep = it.id; window.__rfg.app.world.refreshCar?.(); });
  await p.waitForTimeout(200);
  const hot = await rev(3000);
  console.log('     2-step rev', JSON.stringify(hot));
  if (hot.flames < 1) throw new Error('2-step produced no flames on gas + brake');
  // gas alone with a 2-step: still no flames
  const before = (await world()).flames;
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW');
  if ((await world()).flames !== before) throw new Error('flames from gas alone');
  // 3. the meet: Rev it button
  await p.evaluate(async () => { const { openMeet } = await import('./js/ui/meet.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); const l = Object.values(LOC_BY_ID).find(l => l.type === 'meet' || /meet/i.test(l.id)); openMeet(l, window.__rfg.app); });
  await p.waitForTimeout(400);
  const lot = () => p.evaluate(() => { const c = document.querySelector('[data-lot]'); return { n: +c.dataset.flameCount, f: +c.dataset.flames, rev: c.dataset.revving }; });
  const idle = await lot(); if (idle.n !== 0) throw new Error('flames at a meet without revving');
  await p.dispatchEvent('[data-rev]', 'pointerdown');
  let on = await lot();
  for (let i = 0; i < 40 && on.n < 1; i++) { await p.waitForTimeout(200); on = await lot(); }   // slow frame rates need longer to wind up
  await snap('21-meet-flames');
  await p.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup')));
  console.log('     meet rev', JSON.stringify(on));
  if (on.rev !== '1' || on.n < 1) throw new Error('meet rev gave no flames with a 2-step');
  await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
  // 4. garage tune tab shows the rpm slider
  await p.evaluate(async () => { const { openGarage } = await import('./js/ui/garage.js'); openGarage(window.__rfg.app, { mode: 'home', tab: 'tune' }); });
  await p.waitForTimeout(250);
  if (!(await p.$('[data-ts]'))) throw new Error('no 2-step rpm slider in Garage → Tune');
  await p.keyboard.press('Escape');
});
await step('save + reload', async () => {
  await p.evaluate(async () => { const { saveGame } = await import('./js/core/save.js'); saveGame('slot1'); });
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__rfg); await p.waitForTimeout(500);
  await p.click('.menu button:has-text("Continue")');
  await p.waitForTimeout(800);
  const ok = await p.evaluate(() => window.__rfg.game.s?.player.name);
  if (ok !== 'Tester') throw new Error('save did not load');
});

// ---------------- online free roam (two tabs, same-browser transport) ----------------
await step('online free roam', async () => {
  const p2 = await p.context().newPage(); p2.setDefaultTimeout(8000);
  p2.on('pageerror', e => errs.push('p2 pageerror: ' + e.message));
  p2.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('p2 console: ' + m.text()); });
  await p2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p2.goto(URL, { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(() => window.__rfg, null, { timeout: 15000 });
  await p2.waitForTimeout(500);
  await p2.click('.menu button:has-text("Continue")');
  await p2.waitForTimeout(800);
  const join = pg => pg.evaluate(async () => {
    const { meFromGame } = await import('./js/ui/online.js');
    const r = window.__rfg; r.app.world.paused = false;
    const ok = await r.online.join('harbor', meFromGame(), 'local');
    return ok && r.online.active;
  });
  if (!(await join(p)) || !(await join(p2))) throw new Error('could not join the room');
  // put tab 2's car + body right next to tab 1's player
  await p.evaluate(() => { const w = window.__rfg.app.world; w.inCar = true; w.vehicle.speed = 0; window.__rfg.game.s.heat = 2.5; });
  const pos = await p.evaluate(() => { const v = window.__rfg.app.world.vehicle; return { x: v.x, z: v.z, h: v.h }; });
  await p2.evaluate(pos => { const w = window.__rfg.app.world; w.inCar = true; w.vehicle.x = pos.x + 9; w.vehicle.z = pos.z - 3; w.vehicle.h = pos.h; }, pos);
  // background tabs get no animation frames in headless Chrome: drive both tabs' network ticks ourselves
  const pump = pg => pg.evaluate(() => { clearInterval(window.__pump); window.__pump = setInterval(() => { const w = window.__rfg.app.world, v = w.vehicle; window.__rfg.online.tick(0.12, { x: v.x, z: v.z, h: v.h, speed: 0, inCar: true, flame: 0 }); }, 120); });
  await pump(p); await pump(p2);
  // compare against where tab 2's car really is (it may have been nudged out of a building)
  const near = async () => { const t = await p2.evaluate(() => { const v = window.__rfg.app.world.vehicle; return [v.x, v.z]; }); return p.evaluate(([px, pz]) => window.__rfg.online.list().map(o => ({ name: o.name, car: o.model.id, x: o.x, z: o.z, d: Math.hypot(o.x - px, o.z - pz) })), t); };
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); const l = await near(); if (l.length === 1 && l[0].d < 4) break; }
  const seen = await near();
  console.log('     tab1 sees', JSON.stringify(seen), 'me', JSON.stringify(pos));
  if (seen.length !== 1) throw new Error('tab 1 does not see exactly one other racer');
  if (!(seen[0].d < 4)) throw new Error('remote car is in the wrong place (' + seen[0].d.toFixed(1) + ' m off)');
  await snap('22-online');
  // police stay active online: heat is not wiped, and an offence still raises it
  const heat = await p.evaluate(() => window.__rfg.game.s.heat);
  if (!(heat > 2)) throw new Error('police heat was cleared while online');
  // the server browser counts players per server
  const counts = await p.evaluate(() => window.__rfg.online.census('local'));
  console.log('     server census', JSON.stringify(counts));
  if (counts.harbor !== 2 || counts.downtown !== 0) throw new Error('server census wrong: ' + JSON.stringify(counts));
  // chat + honk reach the other tab
  await p.evaluate(() => { window.__rfg.online.say('hello <b>there</b>'); window.__rfg.online.honk(); });
  await p2.waitForTimeout(400);
  const chat = await p2.evaluate(() => window.__rfg.online.chat.map(c => c.text));
  if (!chat.some(t => t.includes('hello'))) throw new Error('chat did not arrive');
  if (chat.some(t => t.includes('<'))) throw new Error('chat was not sanitised');
  // hostile packets must not break anything
  await p.evaluate(() => {
    const ch = new BroadcastChannel('rfg:harbor');
    ch.postMessage({ k: 'h', id: 'evil1', n: '<img src=x onerror=alert(1)>'.repeat(5), m: '__proto__', v: { paint: 'url(javascript:1)' } });
    ch.postMessage({ k: 'h', id: 'evil2', n: 'Eve', m: window.__rfg.game.s.cars[0].modelId, v: { paint: 'red;}</style><script>', plate: '<script>' }, l: { turbo: 99999 } });
    ch.postMessage({ k: 's', id: 'evil2', x: 'NaN', z: Infinity, h: {}, v: 1e99, c: 1, f: -5 });
    ch.postMessage(null); ch.postMessage('str'); ch.postMessage({ k: 's' });
  });
  await p.waitForTimeout(500);
  const evil = await p.evaluate(() => window.__rfg.online.list().filter(o => o.id === 'evil2').map(o => ({ paint: o.visual.paint, plate: o.visual.plate, t: o.levels.turbo, name: o.name })));
  console.log('     hostile peer sanitised to', JSON.stringify(evil));
  if (evil.length && (evil[0].paint.includes('<') || evil[0].plate.includes('<') || evil[0].t > 4)) throw new Error('hostile data got through');
  // the online panel opens and lists the other racer
  await p.evaluate(async () => { const { openOnline } = await import('./js/ui/online.js'); openOnline(window.__rfg.app); });
  await p.waitForTimeout(300);
  if (!(await p.$('[data-peers] .li'))) throw new Error('online panel lists nobody');
  await snap('23-online-panel');
  await p.keyboard.press('Escape');
  // leaving makes you vanish from the other tab
  await p2.evaluate(() => window.__rfg.online.leave());
  await p.waitForTimeout(300);
  const gone = await p.evaluate(() => window.__rfg.online.list().filter(o => o.name !== 'Eve').length);
  if (gone !== 0) throw new Error('left racer is still shown');
  await p.evaluate(() => window.__rfg.online.leave());
  // not connected: the panel is a server browser, not a code box
  await p.evaluate(async () => { const { openOnline } = await import('./js/ui/online.js'); window.__rfg.online.kindOverride = 'local'; openOnline(window.__rfg.app); });
  await p.waitForTimeout(300);
  if (await p.$('[data-room]')) throw new Error('there is still a room code box');
  const rows = await p.$$('.panel .li button[data-action="join"]');
  if (rows.length < 6) throw new Error('server browser lists only ' + rows.length + ' servers');
  await snap('25-servers');
  await p.keyboard.press('Escape');
  await p2.close();
});

// ---------------- loud exhaust → cops notice → traffic stop ----------------
await step('noise + traffic stop', async () => {
  const W = () => p.evaluate(() => { const w = window.__rfg.app.world; return { db: Math.round(w.liveDb), sdb: Math.round(w.staticDb), phase: w.police.phase, att: +w.police.noiseAtt.toFixed(2), rec: w.police.record.map(r => r.kind), cash: window.__rfg.game.s.cash }; });
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const { newCar } = await import('./js/core/state.js'); const { CATALOG } = await import('./js/data/catalog.js');
    const r = window.__rfg, s = r.game.s, w = r.app.world;
    const c = newCar('ford_mustang_gt_s650_2024'); s.cars.push(c); s.activeCar = c.uid; w.refreshCar();
    w.police.reset(w); s.heat = 0; w.paused = false;
    c.parts.exhaust = CATALOG.find(p => p.cat === 'exhaust' && p.name.includes('Off-Road Long Tubes')).id;
    w.refreshCar();
    w.inCar = false; w.vehicle.vx = 0; w.vehicle.vz = 0; w.vehicle.rev = 0; w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z;
  });
  await p.waitForTimeout(300);
  await key('KeyF'); await p.waitForTimeout(400);   // get in properly so the car controls are live
  if (!(await p.evaluate(() => window.__rfg.app.world.inCar))) await p.evaluate(() => window.__rfg.app.world.toggleCar());   // key press missed: fall back
  if (!(await p.evaluate(() => window.__rfg.app.world.inCar))) throw new Error('could not get into the Mustang: ' + JSON.stringify(await p.evaluate(async () => { const w = window.__rfg.app.world, { input } = await import('./js/core/input.js'); return { ctx: input.context, paused: w.paused, modal: !!document.querySelector('#modals .modal-back'), panels: document.querySelectorAll('#panels .panel').length, dist: Math.hypot(w.vehicle.x - w.foot.x, w.vehicle.z - w.foot.z), mode: window.__rfg.app.mode, speed: w.vehicle.speed }; })));
  const stock = await p.evaluate(async () => { const { noiseDb } = await import('./js/sim/sound.js'); const { CAR_BY_ID } = await import('./js/data/cars.js'); return Math.round(noiseDb(CAR_BY_ID.ford_mustang_gt_s650_2024, {})); });
  const loud = await W();
  console.log('     Mustang stock', stock, 'dB; with long tubes + straight pipes', loud.sdb, 'dB');
  if (!(loud.sdb > 95 && stock < 95)) throw new Error('straight-piped Mustang should be over 95 dB and stock under');
  // floor it: the noise gets noticed (a unit is dispatched or a patrol pulls us over)
  await p.evaluate(() => { window.__rfg.app.world.police.noiseAtt = 0.97; });
  await p.keyboard.down('KeyW'); await p.keyboard.down('KeyS');     // rev it in place: loud, but not speeding
  let got = null;
  for (let i = 0; i < 40 && !got; i++) { await p.waitForTimeout(100); const s = await W(); if (s.phase === 'notice') got = s; }
  await p.keyboard.up('KeyS'); await p.keyboard.up('KeyW');
  console.log('     police reaction', JSON.stringify(got));
  if (!got) throw new Error('police never noticed the straight-piped car');
  if (!got.rec.includes('noise')) throw new Error('no noise citation on the record');
  // pulled over: the officer's traffic stop
  const cash0 = got.cash;
  await p.evaluate(() => { const w = window.__rfg.app.world; w.police.busted(w); });
  await p.waitForSelector('.modal h2:has-text("Traffic stop")');
  const txt = await p.textContent('.modal');
  if (!/exhaust noise/i.test(txt)) throw new Error('traffic stop does not mention the noise');
  await snap('24-traffic-stop');
  await p.click('.modal button:has-text("Accept the citation")');
  await p.waitForSelector('.modal h2:has-text("Citation issued")');
  await p.click('.modal button');
  const after = await W();
  if (!(after.cash < cash0)) throw new Error('citation was not charged');
  if (after.phase !== 'none') throw new Error('police did not stand down after the stop');
  // a stock-exhaust car is not bothered
  await p.evaluate(() => { const s = window.__rfg.game.s, w = window.__rfg.app.world; const c = s.cars.find(c => c.uid === s.activeCar); delete c.parts.exhaust; w.refreshCar(); });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); const quiet = await W(); await p.keyboard.up('KeyW');
  if (quiet.att > 0.05 || quiet.phase !== 'none') throw new Error('a street-legal car should not draw attention for noise');
});

// ---------------- side-view showroom (layered Mustang) ----------------
await step('showroom (side-view Mustang)', async () => {
  const hash = () => p.evaluate(() => { const c = document.querySelector('[data-side]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, solid = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) solid++; h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3]) | 0; } return { h, solid, w: c.width, hgt: c.height }; });
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const { newCar } = await import('./js/core/state.js'); const { openGarage } = await import('./js/ui/garage.js');
    const r = window.__rfg, s = r.game.s; const c = newCar('ford_mustang_gt_s650_2024'); s.cars.push(c); s.activeCar = c.uid; s.cash += 5000; r.app.world.refreshCar();
    openGarage(r.app, { mode: 'home', tab: 'showroom' });
  });
  await p.waitForSelector('[data-side]');
  const a = await hash();
  console.log('     showroom canvas', JSON.stringify({ w: a.w, h: a.hgt, solid: a.solid }));
  if (a.w !== 330 || a.solid < 6000) throw new Error('showroom Mustang did not draw');
  await snap('27-showroom');
  // every layer is separate: hiding wheels changes the picture
  await p.click('[data-layer="wheels"]'); const b = await hash();
  if (b.h === a.h) throw new Error('hiding the wheels changed nothing'); await p.click('[data-layer="wheels"]');
  // wheel size costs a fitting fee and changes the car
  const cash0 = await p.evaluate(() => window.__rfg.game.s.cash + window.__rfg.game.s.bank);
  await p.click('button[data-action="wsize"][data-n="21"]'); await p.waitForTimeout(150);
  const c1 = await hash(), cash1 = await p.evaluate(() => window.__rfg.game.s.cash + window.__rfg.game.s.bank);
  if (c1.h === a.h || !(cash1 < cash0)) throw new Error('wheel size did not change the car / cost nothing');
  await p.click('button[data-action="offset"][data-o="poke"]'); await p.waitForTimeout(150);
  // engine view
  await p.click('button[data-action="engine"]'); await p.waitForTimeout(150);
  const e = await hash(); if (e.h === c1.h) throw new Error('open hood changed nothing');
  await snap('28-showroom-engine');
  // paint + parts show up: a different paint changes the picture
  await p.evaluate(() => { const s = window.__rfg.game.s, c = s.cars.find(x => x.uid === s.activeCar); c.visual.paint = '#1b4fc4'; c.visual.spoiler = 'gt'; c.parts.supercharger = 1; });
  await p.click('button[data-action="engine"]'); await p.waitForTimeout(150);
  const f2 = await hash(); if (f2.h === c1.h) throw new Error('paint + spoiler did not show');
  // other cars point you to the overhead view
  await p.evaluate(async () => { const { newCar } = await import('./js/core/state.js'); const s = window.__rfg.game.s; const c = newCar('honda_civic_ex_1996'); s.cars.push(c); s.activeCar = c.uid; });
  await p.keyboard.press('Escape');
  await p.evaluate(async () => { const { openGarage } = await import('./js/ui/garage.js'); openGarage(window.__rfg.app, { mode: 'home', tab: 'showroom' }); });
  await p.waitForTimeout(200);
  if (await p.$('[data-side]')) throw new Error('a Civic should not get the Mustang side view');
  await p.keyboard.press('Escape');
});

// ---------------- side hustles: passive income ----------------
await step('hustle (jobs, business, rentals)', async () => {
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const { openPhone } = await import('./js/ui/phone.js'); openPhone('hustle', window.__rfg.app);
  });
  await p.waitForTimeout(300);
  await snap('26-hustle');
  const bank0 = await p.evaluate(() => window.__rfg.game.s.bank);
  await p.click('button[data-action="hire"][data-id="pizza"]');
  await p.waitForTimeout(150);
  if (!(await p.evaluate(() => window.__rfg.game.s.hustle.jobs.includes('pizza')))) throw new Error('job not taken');
  await p.click('button[data-action="tab"][data-id="biz"]');
  if (!(await p.$('button[data-action="buy"][data-id="taco"]'))) throw new Error('no business list');
  // a day goes by: the paycheck lands in the bank
  await p.evaluate(async () => { const h = await import('./js/core/hustle.js'); window.__rfg.game.s.time.day += 1; h.newDay(window.__rfg.game.s); });
  const bank1 = await p.evaluate(() => window.__rfg.game.s.bank);
  if (!(bank1 > bank0)) throw new Error('the paycheck did not arrive: ' + bank0 + ' -> ' + bank1);
  // closing the game for a while: it keeps earning (reload path)
  const away = await p.evaluate(async () => { const h = await import('./js/core/hustle.js'); const s = window.__rfg.game.s; s.hustle.lastReal = Date.now() - 4 * 3600 * 1000; try { localStorage.removeItem('rollforglory.settled.' + s.player.name); } catch {} return h.settleAway(s); });
  console.log('     away income', JSON.stringify(away));
  if (!away || !(away.net > 0)) throw new Error('no income while away');
  await p.keyboard.press('Escape');
});

// ---------------- engine sounds: each car's note matches its engine ----------------
await step('engine sounds', async () => {
  const r = await p.evaluate(async () => {
    const { audio } = await import('./js/core/audio.js');
    const { CARS } = await import('./js/data/cars.js');
    const { soundProfile, firingHz } = await import('./js/sim/sound.js');
    const an = await audio.analyser();
    if (!an) return { skip: true };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const bins = new Float32Array(an.frequencyBinCount), sr = an.context.sampleRate;
    const res = { bad: [], built: 0 };
    // every car builds a voice and runs without throwing
    for (const c of CARS) {
      const v = audio.engine({ profile: soundProfile(c, { exhaust: 2, turbo: 0 }) });
      v.update({ rpm: 4000, throttle: 1, speed: 20, boost: 0.5 }); v.update({ rpm: 4000, throttle: 0, speed: 20 });
      v.stop(); res.built++;
    }
    // the loudest pitch is the firing frequency (rotary = 4-cyl equivalent, EV whine tracks speed)
    for (const [mk, md, ex] of [['ford', 'Mustang', 'Coyote'], ['mazda', 'RX-7', ''], ['toyota', 'Supra', '2JZ'], ['lamborghini', 'Huracán', ''], ['chevrolet', 'Corvette', 'LT6']]) {
      const c = CARS.find(x => x.make === mk && x.model.includes(md) && (!ex || (x.trim + x.engine).includes(ex)));
      const prof = soundProfile(c, {});
      const v = audio.engine({ profile: prof });
      for (let i = 0; i < 10; i++) { v.update({ rpm: 3000, throttle: 1, speed: 20 }); await wait(50); }
      await wait(300); an.getFloatFrequencyData(bins);
      let bi = 3; for (let i = 3; i < bins.length && i * sr / an.fftSize < 1500; i++) if (bins[i] > bins[bi]) bi = i;
      const f = bi * sr / an.fftSize, want = firingHz(prof, 3000);
      // the firing frequency must be one of the loudest tones (a bright rotary has many near-equal peaks)
      let at = Math.round(want * an.fftSize / sr), fire = -Infinity; for (let i = at - 2; i <= at + 2; i++) fire = Math.max(fire, bins[i]);
      if (fire < bins[bi] - 9) res.bad.push(`${mk} ${md}: firing ${want}Hz is ${Math.round(bins[bi] - fire)} dB below the loudest tone (${Math.round(f)}Hz)`);
      v.stop(); await wait(100);
    }
    return res;
  });
  if (r.skip) { console.error('     (no audio in this browser, skipped)'); return; }
  console.log('     voices built', r.built, r.bad.length ? r.bad : '');
  if (r.bad.length) throw new Error(r.bad.join('; '));
});

// ---------------- phone controls (separate touch context) ----------------
await step('phone controls', async () => {
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const m = await mctx.newPage(); m.setDefaultTimeout(6000);
  m.on('pageerror', e => errs.push('mobile pageerror: ' + e.message));
  m.on('console', x => { if (x.type() === 'error' && !/Failed to load resource/.test(x.text())) errs.push('mobile console: ' + x.text()); });
  await m.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await m.goto(URL, { waitUntil: 'domcontentloaded' });
  await m.waitForFunction(() => window.__rfg);
  // portrait on a phone shows the rotate screen; it can be skipped
  if (!(await m.evaluate(() => { const r = document.getElementById('rotate'); return !!r && !r.classList.contains('hidden'); }))) throw new Error('no rotate-your-phone screen in portrait');
  await m.tap('#rotate-skip');
  if (await m.evaluate(() => !document.getElementById('rotate').classList.contains('hidden'))) throw new Error('rotate screen did not dismiss');
  await m.tap('text=New Game'); await m.fill('[data-name]', 'Phone'); await m.tap('text=Hit the streets'); await m.waitForTimeout(600);
  const expect = (c, msg) => { if (!c) throw new Error(msg); };
  // pointer helper: fire at an element (centre by default, or an offset in px)
  const fire = (sel, type, id = 1, dx = 0, dy = 0) => m.evaluate(([sel, type, id, dx, dy]) => {
    const el = document.querySelector(sel), r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy }));
  }, [sel, type, id, dx, dy]);
  const st = () => m.evaluate(() => { const w = window.__rfg.app.world; return { inCar: w.inCar, fx: w.foot.x, fz: w.foot.z, cx: w.vehicle?.x, cz: w.vehicle?.z, h: w.vehicle?.h, v: w.vehicle?.speed, gear: w.vehicle?.sim.gear, ctx: document.getElementById('touch').dataset.ctx }; });
  const vis = sel => m.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.offsetParent !== null; }, sel);
  expect(await vis('#touch .tc-stick'), 'joystick not visible while walking');
  expect(!(await vis('#touch .tc-pedal')), 'pedals visible while walking');
  // give the player a car parked next to them
  await m.evaluate(async () => { const { newCar } = await import('./js/core/state.js'); const s = window.__rfg.game.s; const c = newCar('ford_mustang_gt_s650_2024'); s.cars.push(c); s.activeCar = c.uid; const w = window.__rfg.app.world; w.refreshCar(); w.vehicle.x = w.foot.x + 2; w.vehicle.z = w.foot.z; });
  // joystick pushes the player, not the car
  let a = await st();
  await fire('#touch .tc-stick', 'pointerdown', 1);
  await fire('#touch .tc-stick', 'pointermove', 1, 0, -40);
  await m.waitForTimeout(500);
  await fire('#touch .tc-stick', 'pointerup', 1, 0, -40);
  let b2 = await st();
  expect(Math.hypot(b2.fx - a.fx, b2.fz - a.fz) > 0.4, 'joystick did not walk the player');
  expect(Math.hypot(b2.cx - a.cx, b2.cz - a.cz) < 0.01, 'joystick moved the parked car');
  // get in
  await m.evaluate(() => { const w = window.__rfg.app.world; w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; });
  await fire('.tc-foot-btns [data-tap="enterExit"]', 'pointerdown'); await fire('.tc-foot-btns [data-tap="enterExit"]', 'pointerup');
  await m.waitForTimeout(300);
  let c = await st();
  expect(c.inCar && c.ctx === 'car', 'GET IN did not put the player in the car');
  expect(await vis('#touch .tc-pedal') && await vis('#touch .tc-arrow') && await vis('#touch .tc-shifter'), 'pedals / arrows / shift knob not visible in the car');
  expect(!(await vis('#touch .tc-stick')), 'joystick still visible in the car');
  // gas pedal drives; steering arrow turns it (two fingers at once)
  a = await st();
  await fire('#touch .tc-gas', 'pointerdown', 1);
  await m.waitForTimeout(700);
  await fire('#touch .tc-arrow:not(.tc-right)', 'pointerdown', 2);
  await m.waitForTimeout(700);
  await fire('#touch .tc-arrow:not(.tc-right)', 'pointerup', 2);
  b2 = await st();
  expect(b2.v > 3 && Math.hypot(b2.cx - a.cx, b2.cz - a.cz) > 2, 'gas pedal did not move the car');
  expect(Math.abs(b2.h - a.h) > 0.05, 'left arrow did not steer while gas was held');
  await fire('#touch .tc-gas', 'pointerup', 1);
  // brake pedal slows it
  const v0 = (await st()).v;
  await fire('#touch .tc-brake', 'pointerdown', 3); await m.waitForTimeout(900); await fire('#touch .tc-brake', 'pointerup', 3);
  expect((await st()).v < v0 - 1, 'brake pedal did not slow the car');
  // shift knob: manual mode, drag it up -> upshift
  await m.evaluate(async () => { (await import('./js/core/save.js')).settings.transmission = 'manual'; });
  await m.evaluate(() => { const w = window.__rfg.app.world; w.vehicle.vx = w.vehicle.vz = 0; w.vehicle.sim.v = 0; w.vehicle.sim.gear = 0; });
  const g0 = (await st()).gear;
  await fire('#touch .tc-shifter', 'pointerdown', 4);
  await fire('#touch .tc-shifter', 'pointermove', 4, 0, -30);
  await fire('#touch .tc-shifter', 'pointerup', 4, 0, -30);
  await m.waitForTimeout(700);
  expect((await st()).gear === g0 + 1, `shift knob drag up did not upshift (gear ${g0} -> ${(await st()).gear})`);
  // ... and tap the knob to flip auto/manual
  await fire('#touch [data-sknob]', 'pointerdown', 5); await fire('#touch [data-sknob]', 'pointerup', 5);
  expect(await m.evaluate(async () => (await import('./js/core/save.js')).settings.transmission) === 'auto', 'tapping the knob did not switch to automatic');
  // get out
  await m.evaluate(() => { const w = window.__rfg.app.world; w.vehicle.vx = w.vehicle.vz = 0; w.vehicle.sim.v = 0; });
  await fire('#touch .tc-row [data-tap="enterExit"]', 'pointerdown'); await fire('#touch .tc-row [data-tap="enterExit"]', 'pointerup');
  await m.waitForTimeout(300);
  c = await st();
  expect(!c.inCar && c.ctx === 'foot', 'GET OUT did not put the player on foot');
  expect(await vis('#touch .tc-stick') && !(await vis('#touch .tc-pedal')), 'controls did not switch back to walking');
  // rotating to landscape: no rotate screen
  await m.setViewportSize({ width: 844, height: 390 }); await m.waitForTimeout(300);
  expect(await m.evaluate(() => document.getElementById('rotate').classList.contains('hidden')), 'rotate screen shown in landscape');
  await m.setViewportSize({ width: 390, height: 844 }); await m.waitForTimeout(300);
  expect(await m.evaluate(() => !document.getElementById('rotate').classList.contains('hidden')), 'rotate screen did not come back after going portrait again');
  await mctx.close();
});

console.log(errs.length ? '\nERRORS:\n' + errs.join('\n') : '\nno errors');
await b.close();
process.exit(errs.length ? 1 : 0);
