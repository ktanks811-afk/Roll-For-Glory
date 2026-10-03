// Headless playthrough: title → new game → world → phone apps → buy a car
// → drive → garage → PartsHub → drag race → roll race. Fails on any console
// error or uncaught exception.
import { chromium } from 'playwright';
// ?auth=local: accounts kept in this browser instead of on Supabase (only honoured on localhost)
const URL = process.env.URL || 'http://localhost:8123/index.html?auth=local';
const OUT = process.env.OUT || '/tmp/claude-0/shots';
const shots = !!process.env.SHOTS;
import fs from 'fs'; if (shots) fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
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
await step('account required', async () => {
  // a career saved before accounts existed, to check it moves into the new account
  await p.evaluate(() => localStorage.setItem('rollforglory.save.slot3', JSON.stringify({ savedAt: 1, state: { player: { name: 'OldTimer' }, time: { day: 9 }, cash: 777, rep: 0, cars: [] } })));
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__rfg); await p.waitForTimeout(800);
  if (await p.isVisible('.menu button:has-text("New Game")')) throw new Error('title menu shown without an account');
  await snap('00-signup');
  if (!(await p.isVisible('.auth-legacy:has-text("OldTimer")'))) throw new Error('no note about the old save moving into the account');
  await p.fill('[name=username]', 'Tester'); await p.fill('[name=email]', 'tester@example.com'); await p.fill('[name=password]', '123');
  await p.click('.auth-go');
  if (!/at least 6/.test(await p.textContent('[data-err]'))) throw new Error('short password accepted');
  await p.fill('[name=password]', 'hunter22'); await p.click('.auth-go'); await p.waitForTimeout(400);
  if (!(await p.isVisible('.acct-chip:has-text("Tester")'))) throw new Error('not logged in after sign-up');
  const keys = await p.evaluate(() => Object.keys(localStorage));
  if (keys.includes('rollforglory.save.slot3') || !keys.some(k => /^rollforglory\.acct\..+\.save\.slot3$/.test(k))) throw new Error('old save did not move into the account: ' + keys.join(','));
  // stays logged in across launches
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__rfg); await p.waitForTimeout(600);
  if (!(await p.isVisible('.acct-chip:has-text("Tester")'))) throw new Error('logged out after reopening the game');
  // log out → log-in screen; wrong password refused; right one lets you back in with your saves
  await p.click('.acct-chip button'); await p.click('.modal button:has-text("Log out")'); await p.waitForTimeout(300);
  if (!(await p.isVisible('.auth-card'))) throw new Error('no log-in screen after logging out');
  await p.click('.auth-links button:has-text("Log in")');
  await p.fill('[name=email]', 'tester@example.com'); await p.fill('[name=password]', 'nope123'); await p.click('.auth-go'); await p.waitForTimeout(200);
  if (!/Wrong email or password/.test(await p.textContent('[data-err]'))) throw new Error('wrong password accepted');
  await p.fill('[name=password]', 'hunter22'); await p.click('.auth-go'); await p.waitForTimeout(400);
  if (!(await p.isVisible('.menu button:has-text("Load Game")'))) throw new Error('no title menu after logging in');
  const info = await p.evaluate(async () => (await import('./js/core/save.js')).slotInfo('slot3'));
  if (info?.name !== 'OldTimer') throw new Error('old save not available after logging back in');
  await p.evaluate(async () => (await import('./js/core/save.js')).deleteSlot('slot3'));
});
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
await step('helicopter circles instead of covering the car', async () => {
  // Drop Air One straight on top of the car mid-chase: it must back off to its
  // orbit and stay off the car while it drives.
  await p.evaluate(() => { const s = window.__rfg.game.s; s.time.min = 23 * 60; s.heat = 5.5; const w = window.__rfg.app.world; w.police.lastSeen = { x: w.vehicle.x, z: w.vehicle.z }; w.police.phase = 'chase'; });
  await p.waitForFunction(() => window.__rfg.app.world.police.heli, null, { timeout: 3000 });
  await p.evaluate(() => { const w = window.__rfg.app.world, h = w.police.heli; const v = w.vehicle; window.__heliFrom = { x: v.x, z: v.z, h: v.h }; h.x = w.vehicle.x + 1; h.z = w.vehicle.z; window.__heliMin = Infinity; window.__heliSpin = setInterval(() => { const ww = window.__rfg.app.world, hh = ww.police.heli; if (hh) window.__heliMin = Math.min(window.__heliMin, Math.hypot(hh.x - ww.vehicle.x, hh.z - ww.vehicle.z)); }, 16); });
  await p.waitForTimeout(150);
  await p.evaluate(() => { window.__heliMin = Infinity; });   // let the first frame push it out
  await p.keyboard.down('KeyW'); await p.waitForTimeout(3000); await p.keyboard.up('KeyW');
  await snap('10b-heli-orbit');
  const min = await p.evaluate(() => { clearInterval(window.__heliSpin); return window.__heliMin; });
  // put the car back where it was so the later steps (burnout marks need tarmac) start from the same spot
  await p.evaluate(() => { const w = window.__rfg.app.world, v = w.vehicle, f = window.__heliFrom; w.police.reset(w); v.x = f.x; v.z = f.z; v.h = f.h; v.vx = v.vz = 0; v.sim.v = 0; });
  if (!(min > 15)) throw new Error(`helicopter came within ${min.toFixed(1)} m of the car`);
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
await step('tuning: engine map, chassis setup, knock', async () => {
  const r = await p.evaluate(async () => {
    const { buildSpec, metrics } = await import('./js/sim/powertrain.js');
    const { CAR_BY_ID } = await import('./js/data/cars.js');
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels();
    const m = CAR_BY_ID.toyota_mr2_turbo_sw20_1991;
    const lv = { ecu: 3, turbo: 2, fuel: 3, suspension: 3, diff: 2 };
    const base = buildSpec(m, lv, {}, {}), boosted = buildSpec(m, lv, {}, { boost: 24 }), cooked = buildSpec(m, lv, {}, { boost: 31, timing: 8, afr: 13.5 });
    const drag = buildSpec(m, lv, {}, { pressR: 18, diffAccel: 90, rebF: 3, bumpR: 3 });
    const untouched = buildSpec(m, lv, {}, {}), legacy = buildSpec(m, lv, {}, { finalDrive: 1 });
    // the garage tab: change boost, save
    const s = window.__rfg.game.s, car = s.cars.find(c => c.uid === s.activeCar);
    const { openGarage } = await import('./js/ui/garage.js'); openGarage(window.__rfg.app, { mode: 'home', tab: 'tune' });
    await new Promise(r => setTimeout(r, 200));
    const groups = document.querySelectorAll('.tune-grp').length;
    const tp = document.querySelector('[data-k="pressR"]'); tp.value = 20; tp.dispatchEvent(new Event('input'));
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50)));
    const changed = document.querySelector('[data-chg="tires"]').textContent;
    document.querySelector('.tune [data-action="save"]').click();
    const saved = car.tune.pressR;
    closeAllPanels();
    return { base: base.hp, boosted: boosted.hp, knock0: base.knock, knock1: boosted.knock, knock2: cooked.knock, cookedHp: cooked.hp, trac: [base.trac, drag.trac], same: untouched.hp === legacy.hp && metrics(untouched).quarter === metrics(legacy).quarter, groups, changed, saved };
  });
  console.log('     tune', JSON.stringify(r));
  if (!(r.boosted > r.base)) throw new Error('more boost made no more power');
  if (r.knock0 !== 0 || !(r.knock2 > 0.5)) throw new Error('knock risk wrong');
  if (!(r.trac[1] > r.trac[0])) throw new Error('drag setup gave no extra launch traction');
  if (!r.same) throw new Error('an untouched tune changed the car');
  if (r.groups < 8 || !/changed/.test(r.changed) || r.saved !== 20) throw new Error('tune tab did not edit + save');
});
await step('part profiles + blowing the motor', async () => {
  const r = await p.evaluate(async () => {
    const st = await import('./js/core/state.js');
    const { engineStress } = await import('./js/sim/engine.js');
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels();
    const s = window.__rfg.game.s, car = s.cars.find(c => c.uid === s.activeCar);
    const saved = JSON.parse(JSON.stringify({ parts: car.parts, cond: car.cond }));
    // tap a part in Garage → Performance: its profile opens
    const { openGarage } = await import('./js/ui/garage.js'); openGarage(window.__rfg.app, { mode: 'home', tab: 'parts' });
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('.click-row[data-cat="turbo"]').click();
    await new Promise(r => setTimeout(r, 100));
    const prof = document.querySelector('.modal .pp');
    const profile = !!prof && /turbocharger/i.test(prof.textContent) && /Supporting mods/i.test(prof.textContent);
    document.querySelectorAll('.modal-back').forEach(m => m.remove()); closeAllPanels();
    // a big turbo with no tune / fuel / internals: stressed, then blown
    Object.assign(car.parts, { turbo: 4, ecu: null, fuel: null, engine: null, intercooler: null, supercharger: null });
    car.cond.engine = 100; delete car.engineBlown;
    const spec = st.carSpec(car);
    const evs = []; let t = 0;
    while (!car.engineBlown && t < 400) { const e = engineStress(car, spec, 1, spec.redline * 0.8, 0.05); if (e) evs.push(e); t += 0.05; }
    // stock: never hurt
    const stock = st.carSpec({ ...car, parts: {}, cond: { ...car.cond, engine: 100 } }).engineRisk;
    // rebuild at the repair shop
    const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js');
    s.cash += 50000;
    openPlace?.(LOC_BY_ID.second_chance, window.__rfg.app);
    await new Promise(r => setTimeout(r, 150));
    const shopTxt = document.querySelector('#panels')?.textContent || '';
    document.querySelector('[data-action="fix"][data-k="engine"]')?.click();
    await new Promise(r => setTimeout(r, 100));
    const after = { blown: !!car.engineBlown, eng: car.cond.engine };
    closeAllPanels();
    car.parts = saved.parts; car.cond = saved.cond; delete car.engineBlown; window.__rfg.app.world.refreshCar();
    return { profile, risk: spec.engineRisk, level: spec.engineLevel.id, evs, secs: +t.toFixed(1), stock, rebuildShown: /rebuild/i.test(shopTxt), after };
  });
  console.log('     engine', JSON.stringify(r));
  if (!r.profile) throw new Error('tapping a part did not open its profile');
  if (r.stock !== 0) throw new Error('a stock engine is at risk');
  if (r.level !== 'danger' || !r.evs.includes('stress') || !r.evs.includes('warn') || !r.evs.includes('blown')) throw new Error('unsupported big turbo did not warn and then blow');
  if (r.evs.indexOf('stress') > r.evs.indexOf('blown')) throw new Error('no warning before the engine blew');
  if (!r.rebuildShown || r.after.blown || r.after.eng !== 100) throw new Error('repair shop did not rebuild the blown engine');
});
await step('police dispatch: one line at a time', async () => {
  const r = await p.evaluate(async () => {
    const h = window.__rfg.app.world.hud;
    h.radioCur = null; h.radioLines.length = 0;
    h.radio('Dispatch: first call.'); h.radio('Dispatch: second call.'); h.radio('Dispatch: second call.');
    const e = document.querySelector('.hud-radio');
    await new Promise(r => setTimeout(r, 400));
    const b2 = e.getBoundingClientRect();
    return { text: e.textContent, queued: h.radioLines.length, top: b2.top, h: b2.height };
  });
  console.log('     radio', JSON.stringify(r));
  if (!/first call/.test(r.text) || /second/.test(r.text)) throw new Error('dispatch shows more than one call at once');
  if (r.queued !== 1) throw new Error('duplicate dispatch call was queued');
  if (r.top > 40 || r.h > 40) throw new Error('dispatch is not one line at the top');
});
await step('burnout: gas + brake, no 2-step', async () => {
  await p.evaluate(async () => {
    const st = await import('./js/core/state.js'); const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const w = window.__rfg.app.world, s = window.__rfg.game.s; const c = s.cars.find(c => c.uid === s.activeCar);
    const w0 = window.__rfg.app.world; try { w0.police.reset(w0); } catch {} document.querySelectorAll('.modal-back').forEach(m => m.remove()); w0.paused = false; { const s0 = window.__rfg.game.s; const c0 = s0.cars.find(c => c.uid === s0.activeCar); if (c0) c0.fuel = 1; }
    delete c.parts.twostep; w.vehicle.setSpec(st.carSpec(c)); w.inCar = true; w.paused = false;
    const v = w.vehicle; v.vx = v.vz = 0; v.sim.v = 0; v.rev = 0; w.skids.length = 0; w.smoke.length = 0; if (w.limiter) w.limiter.flames = 0;
  });
  await p.keyboard.down('KeyW'); await p.keyboard.down('KeyS'); await p.waitForTimeout(2200);
  const r = await p.evaluate(() => { const w = window.__rfg.app.world, v = w.vehicle; return { car: v.model.id, drive: v.spec.drive, fuel: +v.car.fuel.toFixed(2), rev: v.rev, ts: v.spec.twoStep, burning: v.burning, slip: +v.sim.slip.toFixed(2), speed: +v.speed.toFixed(2), skids: w.skids.length, smoke: w.smoke.length, flames: w.limiter?.flames || 0, rpm: Math.round(v.sim.rpm), redline: v.spec.redline }; });
  await snap('burnout');
  await p.keyboard.up('KeyS'); await p.keyboard.up('KeyW');
  console.log('     burnout', JSON.stringify(r));
  if (!r.burning || r.slip < 0.5) throw new Error('gas + brake did not start a burnout ' + JSON.stringify(r));
  if (r.skids < 10 || r.smoke < 3) throw new Error('burnout left no marks or smoke ' + JSON.stringify(r));
  if (r.flames !== 0) throw new Error('flames without a 2-step');
  if (r.speed > 4) throw new Error('burnout drove away at ' + r.speed);
  if (r.rpm < r.redline * 0.75) throw new Error('burnout rpm too low ' + r.rpm);
  await p.waitForTimeout(400);
});
await step('drive-in garage', async () => {
  const q = await p.evaluate(async () => {
    const st = await import('./js/core/state.js'); const { openPlace } = await import('./js/ui/places.js');
    const w0 = window.__rfg.app.world; try { w0.police.reset(w0); } catch {} document.querySelectorAll('.modal-back').forEach(m => m.remove()); w0.paused = false; { const s0 = window.__rfg.game.s; const c0 = s0.cars.find(c => c.uid === s0.activeCar); if (c0) c0.fuel = 1; }
    const w = window.__rfg.app.world, s = window.__rfg.game.s;
    for (const id of ['honda_s2000_ap2_2004', 'acura_nsx_type_s_2022']) s.cars.push(st.newCar(id));
    const g = w.map.garages.find(q => q.id === s.home);
    const sp = w.homeSpot(g.loc); const v = w.vehicle; v.x = sp.x; v.z = sp.z; v.h = sp.h; v.vx = v.vz = 0; v.sim.v = 0; v.rev = 0; v.yawRate = 0;
    w.inCar = true; w.paused = false; w.cam.zoom = 9;
    return { hint: null, roofBefore: g.roof.a };
  });
  await p.waitForTimeout(500);
  const outside = await p.evaluate(() => { const w = window.__rfg.app.world; return { hint: w.garageHint, prompt: document.querySelector('#hud-prompt, .prompt')?.textContent || '', roof: w.map.garages.find(g => g.id === window.__rfg.game.s.home).roof.a }; });
  await snap('garage-outside');
  await p.keyboard.down('KeyW');
  for (let i = 0; i < 30; i++) { await p.waitForTimeout(150); if (await p.evaluate(() => !!window.__rfg.app.world.inGarage)) break; }
  const inside = await p.evaluate(() => { const w = window.__rfg.app.world; const g = w.map.garages.find(g => g.id === window.__rfg.game.s.home); return { in: w.inGarage?.id === g.id, roof: g.roof.a, cars: w.garageCars.length, nearLoc: w.nearLoc?.id, x: w.vehicle.x }; });
  await p.waitForTimeout(700); await snap('garage-inside');
  await p.keyboard.up('KeyW');
  await p.keyboard.down('KeyS'); await p.waitForTimeout(300); await p.keyboard.up('KeyS');
  const roofIn = await p.evaluate(() => window.__rfg.app.world.map.garages.find(g => g.id === window.__rfg.game.s.home).roof.a);
  console.log('     garage', JSON.stringify({ outside, inside, roofIn }));
  if (!outside.hint || !/garage/i.test(outside.hint)) throw new Error('no drive-in prompt outside the garage ' + JSON.stringify(outside));
  if (outside.roof < 0.95) throw new Error('roof should be solid from outside');
  if (!inside.in) throw new Error('driving through the door did not put the car inside the garage ' + JSON.stringify(inside) + ' ' + JSON.stringify(await p.evaluate(() => { const v = window.__rfg.app.world.vehicle; return { car: v.model.id, x: v.x, z: v.z, h: v.h, sp: v.speed, fuel: v.car.fuel }; })));
  if (roofIn > 0.2) throw new Error('roof did not fade away inside the garage: ' + roofIn);
  if (inside.cars < 1) throw new Error('your other cars are not parked in the garage');
  // leave: roof comes back
  await p.evaluate(() => { const w = window.__rfg.app.world; const g = w.map.garages.find(g => g.id === window.__rfg.game.s.home); const sp = w.homeSpot(g.loc); w.vehicle.x = sp.x - g.inDir.x * 12; w.vehicle.z = sp.z - g.inDir.z * 12; w.vehicle.vx = w.vehicle.vz = 0; w.vehicle.sim.v = 0; });
  await p.waitForTimeout(1800);
  const roofOut = await p.evaluate(() => window.__rfg.app.world.map.garages.find(g => g.id === window.__rfg.game.s.home).roof.a);
  if (roofOut < 0.9) throw new Error('roof should return after leaving: ' + roofOut);
  // a place you don't own keeps its door shut
  const blocked = await p.evaluate(async () => {
    const w = window.__rfg.app.world, s = window.__rfg.game.s;
    const g = w.map.garages.find(q => !s.properties.includes(q.id));
    const sp = w.homeSpot(g.loc); const v = w.vehicle; v.x = sp.x; v.z = sp.z; v.h = sp.h; v.vx = v.vz = 0; v.sim.v = 0; v.rev = 0;
    return { id: g.id, ix: g.inner.x + g.inner.w / 2, iz: g.inner.z + g.inner.d / 2 };
  });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1800); await p.keyboard.up('KeyW');
  const stuck = await p.evaluate(() => { const w = window.__rfg.app.world; return { in: !!w.inGarage, d: 0 }; });
  if (stuck.in) throw new Error('drove into a garage you do not own: ' + blocked.id);
  await p.evaluate(() => { const w = window.__rfg.app.world; const g = w.map.garages.find(g => g.id === window.__rfg.game.s.home); const sp = w.homeSpot(g.loc); w.vehicle.x = sp.x; w.vehicle.z = sp.z; w.vehicle.vx = w.vehicle.vz = 0; w.vehicle.sim.v = 0; });
});
// ---------------- guns, shop, robbery ----------------
await step('Amazin\' shop + guns + robbery', async () => {
  const calm = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); const w = window.__rfg.app.world; try { w.police.reset(w); } catch {} w.paused = false; });
  await calm();
  await p.evaluate(async () => { const { openPhone } = await import('./js/ui/phone.js'); const s = window.__rfg.game.s; s.cash += 30000; s.player.age = 19; s.arms = undefined; openPhone('shop', window.__rfg.app); });
  await p.waitForTimeout(250);
  // 19: no handguns
  await p.fill('[data-q]', 'glock 19');
  if (!(await p.evaluate(() => document.querySelector('button[data-action="buy"][data-id="glock_19_g5"]').disabled))) throw new Error('a 19-year-old could buy a Glock');
  await p.evaluate(() => { window.__rfg.game.s.player.age = 25; });
  await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); const { openPhone } = await import('./js/ui/phone.js'); openPhone('shop', window.__rfg.app); });
  await p.waitForTimeout(200);
  const nGlocks = await p.evaluate(() => document.querySelectorAll('[data-list] .li').length);
  if (nGlocks < 50) throw new Error('shop shows only ' + nGlocks + ' Glocks');
  await p.click('button[data-action="tab"][data-id="arp"]');
  if ((await p.evaluate(() => document.querySelectorAll('[data-list] .li').length)) < 10) throw new Error('no AR pistols');
  await p.click('button[data-action="tab"][data-id="ammo"]');
  await p.click('button[data-action="ammo"][data-cal="9mm"][data-n="5"]');
  await p.click('button[data-action="tab"][data-id="hand"]');
  await p.fill('[data-q]', 'glock 19');
  await p.click('button[data-action="buy"][data-id="glock_19_g5"]');
  await p.click('button[data-action="tab"][data-id="mine"]');
  const arms0 = await p.evaluate(() => JSON.parse(JSON.stringify(window.__rfg.game.s.arms)));
  if (arms0.guns.length !== 1 || arms0.guns[0].loaded !== 15) throw new Error('purchase did not deliver a loaded Glock ' + JSON.stringify(arms0));
  await snap('30-shop');
  await calm();
  // go stand next to the gas station
  await p.evaluate(async () => { const { LOC_BY_ID } = await import('./js/data/world.js'); const w = window.__rfg.app.world; const l = LOC_BY_ID.gas_westbrook; w.inCar = false; w.foot.x = l.x - 3; w.foot.z = l.z; w.foot.h = Math.PI / 2; w.cam.x = w.foot.x; w.cam.z = w.foot.z; w.cam.zoom = 13; });
  await p.waitForTimeout(400);
  await p.keyboard.press('KeyG'); await p.waitForTimeout(200);
  if (!(await p.evaluate(() => window.__rfg.app.world.combat.armed))) throw new Error('G did not draw the gun');
  // shoot: a round leaves the mag, a tracer is drawn, the shot is heard
  const l0 = await p.evaluate(() => window.__rfg.app.world.combat.gun.g.loaded);
  await p.keyboard.down('KeyJ'); await p.waitForTimeout(150); await p.keyboard.up('KeyJ');
  const shot = await p.evaluate(() => { const c = window.__rfg.app.world.combat; return { loaded: c.gun.g.loaded, shots: c.shots || 0, gunHeat: window.__rfg.app.world.police.gunHeat }; });
  if (shot.loaded >= l0 || shot.shots < 1) throw new Error('firing did nothing ' + JSON.stringify(shot));
  await snap('31-gun');
  // semi-auto: holding the trigger only fires slowly
  await p.evaluate(() => { window.__rfg.app.world.combat.cd = 0; window.__rfg.app.world.combat.shots = 0; });
  await p.keyboard.down('KeyJ'); await p.waitForTimeout(1000); await p.keyboard.up('KeyJ');
  const semi = await p.evaluate(() => window.__rfg.app.world.combat.shots);
  if (semi < 1 || semi > 5) throw new Error('semi-auto should fire a few rounds per second held, fired ' + semi);
  // FRT: buy it, install it, hold the trigger = full auto; it can jam
  await p.evaluate(async () => { const { openPhone } = await import('./js/ui/phone.js'); openPhone('shop', window.__rfg.app); });
  await p.waitForTimeout(250);
  await p.click('button[data-action="tab"][data-id="gear"]');
  await p.click('button[data-action="gear"][data-id="frt"]');
  await p.click('button[data-action="tab"][data-id="mine"]');
  await p.click('button[data-action="frt"]');
  if (!(await p.evaluate(() => window.__rfg.game.s.arms.guns[0].frt))) throw new Error('FRT did not install on the Glock');
  await calm();
  await p.evaluate(() => { const w = window.__rfg.app.world; w.combat.cd = 0; w.combat.shots = 0; w.combat.jamChance = 0; w.combat.burstChance = 0; w.combat.gun.g.loaded = 15; w.combat.drawn = true; });
  await p.keyboard.down('KeyJ'); await p.waitForTimeout(1000); await p.keyboard.up('KeyJ');
  const auto = await p.evaluate(() => window.__rfg.app.world.combat.shots);
  if (auto < 9) throw new Error('an FRT Glock should dump rounds, only fired ' + auto);
  const rec = await p.evaluate(() => window.__rfg.app.world.police.record.some(r => r.kind === 'auto') || window.__rfg.game.s.heat > 0);
  if (!rec) throw new Error('police ignored full-auto fire');
  await calm();
  await p.evaluate(() => { const w = window.__rfg.app.world; w.combat.cd = 0; w.combat.jamChance = 1; w.combat.gun.g.loaded = 15; w.combat.reload = 0; });
  await p.keyboard.down('KeyJ'); await p.waitForTimeout(400); await p.keyboard.up('KeyJ');
  if (!(await p.evaluate(() => window.__rfg.app.world.combat.jammed))) throw new Error('the FRT never jammed');
  const jshots = await p.evaluate(() => window.__rfg.app.world.combat.shots);
  await p.keyboard.down('KeyJ'); await p.waitForTimeout(300); await p.keyboard.up('KeyJ');
  if ((await p.evaluate(() => window.__rfg.app.world.combat.shots)) !== jshots) throw new Error('a jammed gun still fired');
  await p.keyboard.press('KeyR'); await p.waitForTimeout(1500);
  if (await p.evaluate(() => window.__rfg.app.world.combat.jammed)) throw new Error('R did not clear the jam');
  await p.evaluate(() => { const c = window.__rfg.app.world.combat; c.jamChance = 0; c.burstChance = 1; c.cd = 0; c.shots = 0; c.gun.g.loaded = 15; });
  await p.keyboard.down('KeyJ'); await p.waitForTimeout(70); await p.keyboard.up('KeyJ'); await p.waitForTimeout(500);
  const burst = await p.evaluate(() => window.__rfg.app.world.combat.shots);
  if (burst < 3) throw new Error('burst-fire malfunction did not fire a burst: ' + burst);
  await p.evaluate(() => { const g = window.__rfg.game.s.arms.guns[0]; g.frt = false; const c = window.__rfg.app.world.combat; c.jamChance = undefined; c.burstChance = undefined; c.jammed = false; c.burstLeft = 0; c.gun.g.loaded = 15; });
  await calm();
  // reload
  await p.evaluate(() => { window.__rfg.app.world.combat.gun.g.loaded = 3; });
  await p.keyboard.press('KeyR'); await p.waitForTimeout(2300);
  if ((await p.evaluate(() => window.__rfg.app.world.combat.gun.g.loaded)) !== 15) throw new Error('reload did not fill the mag');
  await calm();
  // robbery: press E at the register; make the outcome deterministic
  const cash0 = await p.evaluate(() => window.__rfg.game.s.cash);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(150);
  if (!(await p.evaluate(() => !!window.__rfg.app.world.combat.rob))) throw new Error('E at a store with a gun out did not start a robbery');
  await p.evaluate(() => { const r = window.__rfg.app.world.combat.rob; r.fightAt = 0; r.alarm = true; r.alarmAt = 1; r.dur = 3; r.pay = 500; });
  await p.waitForTimeout(1500);
  await snap('32-robbery');
  await p.waitForTimeout(2400);
  const rob = await p.evaluate(() => { const w = window.__rfg.app.world, s = window.__rfg.game.s; return { cash: s.cash, rob: !!w.combat.rob, heat: s.heat, phase: w.police.phase, n: s.arms.robberies, rec: w.police.record.map(r => r.kind) }; });
  if (rob.rob || !(rob.cash > cash0 + 200) || rob.n < 1) throw new Error('robbery did not pay out ' + JSON.stringify(rob));
  if (rob.phase !== 'chase' || rob.heat < 1) throw new Error('the silent alarm did not send the cops ' + JSON.stringify(rob));
  if (!rob.rec.includes('robbery')) throw new Error('robbery not on the record');
  // same store is on alert for a day
  await calm();
  await p.keyboard.press('KeyE'); await p.waitForTimeout(150);
  if (await p.evaluate(() => !!window.__rfg.app.world.combat.rob)) throw new Error('could rob the same store twice in a day');
  // mugging a pedestrian
  await p.evaluate(async () => { const { LOCATIONS } = await import('./js/data/world.js'); const w = window.__rfg.app.world; const f = w.foot; for (const [x, z] of [[0, 75], [150, 225], [-300, 75], [300, -75], [0, -225], [-150, 375]]) if (LOCATIONS.every(l => Math.hypot(l.x - x, l.z - z) > 30)) { f.x = x; f.z = z; break; } w.cam.x = f.x; w.cam.z = f.z; w.traffic.peds.length = 0; w.traffic.peds.push({ x0: f.x, z0: f.z - 2.2, size: 1, t: 0, sp: 0, dir: 1, color: '#c41b1b', dodge: 0, dx: 0, dz: 0, x: f.x, z: f.z - 2.2, hp: 40 }); f.h = 0; });
  await calm();
  await p.waitForTimeout(100);
  const m0 = await p.evaluate(() => window.__rfg.game.s.cash);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(150);
  if (!(await p.evaluate(() => !!window.__rfg.app.world.combat.mug))) {
    const dbg = await p.evaluate(() => { const w = window.__rfg.app.world, c = w.combat; return { armed: c.armed, drawn: c.drawn, gun: !!c.gun, inCar: w.inCar, rob: !!c.rob, prompt: c.robPrompt(), foot: [w.foot.x | 0, w.foot.z | 0, w.foot.h], peds: w.traffic.peds.map(q => [q.x | 0, q.z | 0, q.down, q.mugged]), near: c.pedNear(5) ? 1 : 0, nearLoc: w.nearLoc?.id }; });
    throw new Error('could not mug a pedestrian ' + JSON.stringify(dbg));
  }
  await p.waitForTimeout(2600);
  if (!((await p.evaluate(() => window.__rfg.game.s.cash)) > m0)) throw new Error('mugging paid nothing');
  // a ped that gets shot goes down
  await p.evaluate(() => { const w = window.__rfg.app.world, f = w.foot; w.traffic.peds.length = 0; w.traffic.peds.push({ x0: f.x, z0: f.z - 4, size: 1, t: 0, sp: 0, dir: 1, color: '#1b4fc4', dodge: 0, dx: 0, dz: 0, x: f.x, z: f.z - 4, hp: 20 }); w.combat.cd = 0; f.h = 0; });
  await calm();
  for (let i = 0; i < 3; i++) { await p.keyboard.down('KeyJ'); await p.waitForTimeout(120); await p.keyboard.up('KeyJ'); await p.waitForTimeout(160); }
  if (!(await p.evaluate(() => window.__rfg.app.world.traffic.peds.some(q => q.down)))) throw new Error('shooting a pedestrian did nothing');
  // busted after a robbery: the gun is confiscated
  await p.evaluate(() => { const w = window.__rfg.app.world; w.police.record = [{ kind: 'robbery', text: 'Armed robbery', fine: 6000 }]; w.police.phase = 'chase'; w.police.busted(w); });
  await p.waitForSelector('.modal h2:has-text("BUSTED")');
  const after = await p.evaluate(() => ({ guns: window.__rfg.game.s.arms.guns.length, drawn: window.__rfg.app.world.combat.drawn }));
  if (after.guns !== 0 || after.drawn) throw new Error('gun not confiscated ' + JSON.stringify(after));
  await p.click('.modal button'); await calm();
});

// ---------------- carjacking ----------------
await step('carjacking', async () => {
  const calm = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); const w = window.__rfg.app.world; try { w.police.reset(w); } catch {} window.__rfg.game.s.heat = 0; w.paused = false; });
  // sitting at a stop on a city street, an hour into the career
  const sit = () => p.evaluate(() => {
    const w = window.__rfg.app.world, s = window.__rfg.game.s, v = w.vehicle;
    const r = w.map.roads.nearestOnRoad(120, -60);
    v.x = r.x; v.z = r.z; v.h = Math.atan2(r.edge.dx, -r.edge.dz); v.vx = v.vz = 0; v.sim.v = 0;
    w.inCar = true; w.cam.x = v.x; w.cam.z = v.z; s.playTime = Math.max(s.playTime, 3600); s.carjack = { lastDay: -99, n: 0 };
    w.carjacks.jack = null; w.carjacks.rng = Math.random;
  });
  await calm(); await sit(); await p.waitForTimeout(200);
  if (!(await p.evaluate(async () => (await import('./js/data/carjack.js')).canCarjack(window.__rfg.app.world.carjacks.context())))) {
    throw new Error('a carjacking is not allowed stopped in the city ' + JSON.stringify(await p.evaluate(() => window.__rfg.app.world.carjacks.context())));
  }
  // he walks up to the window, then you choose
  await p.evaluate(() => window.__rfg.app.world.carjacks.start());
  if (!(await p.evaluate(() => !!window.__rfg.app.world.carjacks.jack))) throw new Error('carjacker did not appear');
  await p.waitForSelector('.modal h2:has-text("Carjacking")', { timeout: 6000 });
  await snap('40-carjack');
  const labels = await p.$$eval('.modal-actions button', bs => bs.map(b => b.textContent));
  if (labels.join() !== 'Give it up,Floor it,Fight him for it') throw new Error('carjack choices: ' + labels.join());
  // give it up: the car drives off and is gone until the cops find it
  const uid = await p.evaluate(() => window.__rfg.game.s.activeCar);
  await p.click('.modal button:has-text("Give it up")');
  await p.waitForSelector('.modal h2:has-text("Carjacked")');
  const gone = await p.evaluate(uid => { const w = window.__rfg.app.world, c = window.__rfg.game.s.cars.find(c => c.uid === uid); return { veh: !!w.vehicle, inCar: w.inCar, stolen: !!c.stolen, away: !!w.carjacks.away, body: c.cond.body }; }, uid);
  if (gone.veh || gone.inCar || !gone.stolen || !gone.away) throw new Error('car not taken ' + JSON.stringify(gone));
  await p.click('.modal button'); await p.waitForTimeout(600);
  await snap('41-carjack-driveoff');
  await p.keyboard.press('KeyF'); await p.waitForTimeout(100);
  if (await p.evaluate(() => window.__rfg.app.world.inCar)) throw new Error('got into a stolen car');
  // the cops find it: back on the street, GPS set, a text from Brenner, beat up
  await p.evaluate(uid => { window.__rfg.game.s.cars.find(c => c.uid === uid).stolen.foundAt = 0; }, uid);
  await p.waitForTimeout(1300);
  const found = await p.evaluate(uid => { const w = window.__rfg.app.world, s = window.__rfg.game.s, c = s.cars.find(c => c.uid === uid); return { veh: w.vehicle?.car === c, stolen: !!c.stolen, gps: s.gps?.label, msg: s.messages[0]?.from, body: c.cond.body, fuel: c.fuel }; }, uid);
  if (!found.veh || found.stolen || !/stolen/i.test(found.gps || '') || found.msg !== 'brenner' || !(found.body < gone.body) || !(found.fuel <= 0.15)) throw new Error('stolen car not recovered ' + JSON.stringify(found));
  // fight him for it (rigged to win): you keep the car and get rep
  await calm(); await sit();
  const rep0 = await p.evaluate(() => window.__rfg.game.s.rep);
  await p.evaluate(() => { const c = window.__rfg.app.world.carjacks; c.rng = () => 0.1; c.start(); });
  await p.waitForSelector('.modal h2:has-text("Carjacking")', { timeout: 6000 });
  await p.click('.modal button:has-text("Fight him for it")');
  await p.waitForSelector('.modal h2:has-text("You kept your car")');
  const kept = await p.evaluate(() => { const w = window.__rfg.app.world; return { veh: !!w.vehicle, inCar: w.inCar, rep: window.__rfg.game.s.rep, runner: !!w.carjacks.runner }; });
  if (!kept.veh || !kept.inCar || !(kept.rep > rep0) || !kept.runner) throw new Error('won the fight but lost the car ' + JSON.stringify(kept));
  // pull off before he reaches the window: no confrontation
  await calm(); await sit();
  await p.evaluate(() => window.__rfg.app.world.carjacks.start());
  await p.evaluate(() => { const v = window.__rfg.app.world.vehicle; v.vx = Math.sin(v.h) * 12; v.vz = -Math.cos(v.h) * 12; v.sim.v = 12; });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(500); await p.keyboard.up('KeyW');
  if (await p.evaluate(() => !!window.__rfg.app.world.carjacks.jack || !!document.querySelector('.modal h2'))) throw new Error('driving off did not shake the carjacker');
  // it is still rare: the gap between carjackings holds
  if (await p.evaluate(async () => (await import('./js/data/carjack.js')).canCarjack(window.__rfg.app.world.carjacks.context()))) throw new Error('another carjacking allowed the same day');
  await p.evaluate(() => { const w = window.__rfg.app.world; window.__rfg.game.s.gps = null; w.gpsPath = null; });   // later steps expect no route
  await calm();
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

// ---------------- online crews (permanent, database-backed; two tabs, local database) ----------------
await step('online crews', async () => {
  const setup = async (pg, uid) => pg.evaluate(async uid => {
    const r = window.__rfg; r.online.kindOverride = 'local'; const s = r.game.s;
    s.onlineCrew = null; s.crewPending = null; s.cash += 20000; s.uid = uid; s.crewKey = uid + 'key';
    r.app.world.paused = false;
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    localStorage.removeItem('rfg-localcrews');
  }, uid);
  const mk = async name => {
    const pg = await p.context().newPage(); pg.setDefaultTimeout(8000);
    pg.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await pg.goto(URL, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.__rfg, null, { timeout: 15000 });
    await pg.waitForTimeout(500);
    await pg.click('.menu button:has-text("Continue")');
    await pg.waitForTimeout(800);
    return pg;
  };
  const q = await mk('crewB');
  await setup(p, 'uidAAAAAAA1'); await setup(q, 'uidBBBBBBB2');
  const openApp = pg => pg.evaluate(async () => { const { openPhone } = await import('./js/ui/phone.js'); openPhone('ocrew', window.__rfg.app); });
  const crewOf = pg => pg.evaluate(() => { const c = window.__rfg.game.s.onlineCrew; return c && { n: c.name, r: c.role, open: c.open }; });
  const db = (pg, fn, ...a) => pg.evaluate(async ([fn, a]) => { const { crewdb } = await import('./js/net/crewdb.js'); const s = window.__rfg.game.s; const r = await crewdb()[fn]({ uid: s.uid, tok: s.crewKey, name: s.player.name, rep: 0 }, ...a); return r ?? null; }, [fn, a]);
  const refresh = pg => pg.evaluate(async () => (await import('./js/ui/ocrew.js')).refreshCrew({ chat: true }));
  // tab A founds a crew from the phone app
  await openApp(p);
  await p.waitForSelector('button[data-action="tab"][data-id="create"]').catch(async e => { throw new Error('crew app did not render: ' + (await p.evaluate(() => document.body.innerText.slice(0, 300).replace(/\s+/g, ' ')))); });
  await p.click('button[data-action="tab"][data-id="create"]');
  await p.fill('[data-f="name"]', 'Night Shift'); await p.fill('[data-f="tag"]', 'nsft'); await p.fill('[data-f="motto"]', 'We only go left');
  await p.click('button[data-action="create"]');
  await p.waitForFunction(() => window.__rfg.game.s.onlineCrew?.role === 'leader');
  // the crew is permanent: it is still listed with nobody online (A's live link closed)
  await p.evaluate(async () => (await import('./js/net/crews.js')).lobby.disconnect());
  const list = await db(q, 'list');
  if (!list.some(g => g.tag === 'NSFT' && g.members === 1)) throw new Error('crew not stored ' + JSON.stringify(list));
  // duplicate name / tag are refused
  const dup = await q.evaluate(async () => { const { crewdb } = await import('./js/net/crewdb.js'); const s = window.__rfg.game.s; try { await crewdb().create({ uid: s.uid, tok: s.crewKey, name: 'B', rep: 0 }, { id: 'zzzzzzzz', name: 'night shift', tag: 'QQ', color: '#fff', motto: '', open: true }); return 'created'; } catch (e) { return e.message; } });
  if (!/taken/i.test(dup)) throw new Error('duplicate crew name allowed: ' + dup);
  // tab B opens the app, sees it and joins (open crew)
  await openApp(q);
  await q.waitForSelector('button[data-action="join"]');
  await q.click('button[data-action="join"]');
  await q.waitForFunction(() => window.__rfg.game.s.onlineCrew?.role === 'member');
  // crew chat is saved and readable by the other member later
  await q.evaluate(async () => { const { crewdb } = await import('./js/net/crewdb.js'); const s = window.__rfg.game.s; await crewdb().say({ uid: s.uid, tok: s.crewKey, name: s.player.name, rep: 0 }, 'yo crew'); });
  const hist = await db(p, 'chat');
  if (!hist.some(m => m.text === 'yo crew')) throw new Error('chat history not saved');
  // a stranger's wrong key cannot act as the leader
  const bad = await p.evaluate(async () => { const { crewdb } = await import('./js/net/crewdb.js'); const s = window.__rfg.game.s; try { await crewdb().kick({ uid: s.uid, tok: 'WRONG', name: 'x', rep: 0 }, 'uidBBBBBBB2'); return 'ok'; } catch (e) { return e.message; } });
  if (bad === 'ok') throw new Error('kick with a wrong key worked');
  const members = await p.evaluate(async () => { const { crewdb } = await import('./js/net/crewdb.js'); return crewdb().members(window.__rfg.game.s.onlineCrew.id); });
  if (members.length !== 2) throw new Error('expected 2 members, got ' + members.length);
  // leader goes invite-only; B leaves, then has to ask; the leader accepts
  await db(p, 'edit', 'We only go left', false);
  await db(q, 'leave'); await refresh(q);
  if (await crewOf(q)) throw new Error('B still shows a crew after leaving');
  const cid = (await db(q, 'list')).find(g => g.tag === 'NSFT').id;
  const joinErr = await q.evaluate(async cid => { const { crewdb } = await import('./js/net/crewdb.js'); const s = window.__rfg.game.s; try { await crewdb().join({ uid: s.uid, tok: s.crewKey, name: 'B', rep: 0 }, cid); return 'joined'; } catch (e) { return e.message; } }, cid);
  if (!/invite/i.test(joinErr)) throw new Error('joined an invite-only crew: ' + joinErr);
  await db(q, 'request', cid); await refresh(q);
  if (await q.evaluate(() => window.__rfg.game.s.crewPending) !== cid) throw new Error('pending request not tracked');
  await refresh(p);
  const pend = await db(p, 'pending');
  if (pend.length !== 1) throw new Error('leader sees ' + pend.length + ' requests');
  await db(p, 'decide', pend[0].uid, true); await refresh(q);
  if ((await crewOf(q))?.n !== 'Night Shift') throw new Error('accepted member did not get the crew');
  // kick, then rejoin, then disband
  await db(p, 'kick', 'uidBBBBBBB2'); await refresh(q);
  if (await crewOf(q)) throw new Error('kicked member still in the crew');
  await db(q, 'request', cid); await db(p, 'decide', 'uidBBBBBBB2', true); await refresh(q);
  if (!(await crewOf(q))) throw new Error('could not rejoin');
  await db(p, 'disband'); await refresh(q); await refresh(p);
  if ((await crewOf(q)) || (await crewOf(p))) throw new Error('disband left people in the crew');
  if ((await db(q, 'list')).some(g => g.tag === 'NSFT')) throw new Error('disbanded crew still listed');
  // the name and tag are free again
  await q.evaluate(async () => { const { crewdb } = await import('./js/net/crewdb.js'); const s = window.__rfg.game.s; await crewdb().create({ uid: s.uid, tok: s.crewKey, name: 'B', rep: 0 }, { id: 'newcrew1', name: 'Night Shift', tag: 'NSFT', color: '#fff', motto: '', open: true }); });
  await p.evaluate(() => localStorage.removeItem('rfg-localcrews'));
  await p.evaluate(async () => { (await import('./js/net/crews.js')).lobby.disconnect(); });
  await q.evaluate(async () => { (await import('./js/net/crews.js')).lobby.disconnect(); });
  await q.close();
});

// ---------------- minimap ----------------
await step('minimap', async () => {
  await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); const w = window.__rfg.app.world; w.paused = false; try { w.police.reset(w); } catch {} w.police.patrols.length = 0; });
  await p.waitForTimeout(500);
  const px = () => p.evaluate(() => { const c = document.querySelector('.hud-mini canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0, red = 0; for (let i = 0; i < d.length; i += 16) { if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; if (d[i] > 200 && d[i + 1] < 90) red++; } return { lit, red, w: c.width }; });
  const a = await px();
  console.log('     minimap', JSON.stringify(a));
  if (a.w < 220) throw new Error('minimap canvas is too small');
  if (a.lit < 1500) throw new Error('minimap is nearly empty');
  // sharp tiles are built around you (not just the blurry overview)
  const tiles = await p.evaluate(() => document.querySelector('.hud-mini') && window.__rfg.app.hud.minimap.tileCount());
  if (!(tiles >= 1)) throw new Error('no detailed map tiles were drawn');
  // tapping cycles the view
  const m0 = await p.evaluate(() => window.__rfg.app.hud.minimap.mode.name);
  await p.dispatchEvent('.hud-mini', 'pointerdown'); await p.waitForTimeout(200);
  const m1 = await p.evaluate(() => window.__rfg.app.hud.minimap.mode.name);
  if (m0 === m1) throw new Error('tapping the minimap did not change the view');
  for (let i = 0; i < 4; i++) await p.dispatchEvent('.hud-mini', 'pointerdown');
  if ((await p.evaluate(() => window.__rfg.app.hud.minimap.mode.name)) !== m1) throw new Error('minimap views should loop');
  // a destination shows up as a route + flag/arrow
  await p.evaluate(async () => { const { LOC_BY_ID } = await import('./js/data/world.js'); const l = LOC_BY_ID.pier9; const w = window.__rfg.app.world; w.paused = false; w.setGps(l.x, l.z, 'Pier 9'); });
  for (let i = 0; i < 30; i++) { await p.waitForTimeout(100); if (await p.evaluate(() => (window.__rfg.app.world.gpsPath || []).length > 1)) break; }
  await p.waitForTimeout(600);
  const b = await px(); const route = await p.evaluate(() => (window.__rfg.app.world.gpsPath || []).length);
  if (route < 2 || b.red < a.red - 3) throw new Error('GPS route not drawn on the minimap ' + JSON.stringify({ a, b, route }));
  await p.evaluate(() => { window.__rfg.game.s.gps = null; window.__rfg.app.world.gpsPath = null; });
});

// ---------------- phone Map app: browse places, tap, GPS ----------------
await step('phone map (places + GPS)', async () => {
  await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); const w = window.__rfg.app.world; window.__rfg.game.s.gps = null; w.gpsPath = null; const { openPhone } = await import('./js/ui/phone.js'); openPhone('map', window.__rfg.app); });
  await p.waitForSelector('[data-map]'); await p.waitForTimeout(800);
  const total = await p.evaluate(async () => (await import('./js/data/world.js')).LOCATIONS.length);
  const rows = await p.$$eval('.mapapp .li[data-loc]', e => e.length);
  if (rows !== total) throw new Error(`the map lists ${rows} of ${total} places`);
  // the picture is real (not blank) and has pins on it
  const lit = await p.evaluate(() => { const c = document.querySelector('[data-map]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 40) if (d[i] + d[i + 1] + d[i + 2] > 150) n++; return n; });
  if (lit < 800) throw new Error('the map canvas is nearly empty');
  await snap('30-phone-map');
  // filters + search narrow the list
  await p.click('.mapapp [data-cat="fuel"]'); await p.waitForTimeout(100);
  const fuel = await p.$$eval('.mapapp .li[data-loc]', e => e.length);
  if (!(fuel > 0 && fuel < total)) throw new Error('the Gas & food filter did nothing');
  await p.click('.mapapp [data-cat="all"]');
  await p.fill('.mapapp [data-q]', 'torque'); await p.waitForTimeout(100);
  if ((await p.$$eval('.mapapp .li[data-loc]', e => e.length)) !== 1) throw new Error('search did not find Torque Temple');
  // tap a place: the card says what it is and how far; Set GPS makes the route
  await p.click('.mapapp .li[data-loc="torque_temple"]'); await p.waitForTimeout(300);
  const txt = await p.textContent('.map-card');
  if (!/Torque Temple/.test(txt) || !/by road/.test(txt)) throw new Error('place card is missing details: ' + txt.slice(0, 80));
  await p.click('.map-card [data-gps]'); await p.waitForTimeout(300);
  const g = await p.evaluate(() => { const s = window.__rfg.game.s, w = window.__rfg.app.world; return { label: s.gps?.label, path: w.gpsPath?.length || 0 }; });
  if (!/Torque Temple/.test(g.label || '') || g.path < 2) throw new Error('GPS / route not set: ' + JSON.stringify(g));
  if (!(await p.$('.map-card [data-go]'))) throw new Error('no Start driving button after setting GPS');
  await snap('31-phone-map-gps');
  // tapping empty ground drops a pin you can navigate to
  await p.fill('.mapapp [data-q]', ''); await p.dispatchEvent('.mapapp [data-q]', 'input');
  await p.click('.map-card [data-clear]'); await p.waitForTimeout(100);
  const box = await (await p.$('[data-map]')).boundingBox();
  await p.mouse.click(box.x + 6, box.y + box.height - 40); await p.waitForTimeout(300);
  if (!/Dropped pin/.test(await p.textContent('.map-card'))) throw new Error('tapping the map did not drop a pin');
  await p.click('.map-card [data-gps]'); await p.waitForTimeout(200);
  if (!(await p.evaluate(() => /Dropped pin/.test(window.__rfg.game.s.gps?.label || '')))) throw new Error('could not navigate to a dropped pin');
  // zoom buttons work
  const k0 = await p.evaluate(() => 0); await p.click('.map-tools [data-z="1"]'); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__rfg.game.s.gps = null; window.__rfg.app.world.gpsPath = null; });
  await p.keyboard.press('Escape');
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
  await p.evaluate(() => { window.__rfg.app.world.police.noiseAtt = 1.15; });
  await p.keyboard.down('KeyW'); await p.keyboard.down('KeyS');     // rev it in place: loud, but not speeding
  let got = null;
  for (let i = 0; i < 40 && !got; i++) { await p.waitForTimeout(100); const s = await W(); if (s.phase === 'notice') got = s; }
  await p.keyboard.up('KeyS'); await p.keyboard.up('KeyW');
  console.log('     police reaction', JSON.stringify(got));
  if (!got) throw new Error('police never noticed the straight-piped car ' + JSON.stringify(await p.evaluate(() => { const w = window.__rfg.app.world; return { phase: w.police.phase, heat: window.__rfg.game.s.heat, att: w.police.noiseAtt, db: w.liveDb, inCar: w.inCar, sp: w.vehicle.speed, patrols: w.police.patrols.length, susp: w.police.suspicion, paused: w.paused }; })));
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
  if (quiet.att > 0.05 || quiet.phase !== 'none') throw new Error('a street-legal car should not draw attention for noise ' + JSON.stringify(quiet));
});

// ---------------- warrants: escape → plate hit → arrest; unpaid ticket → warrant ----------------
await step('warrants', async () => {
  const R = () => p.evaluate(() => { const s = window.__rfg.game.s, w = window.__rfg.app.world; return { warrants: (s.warrants || []).map(x => x.kind + (x.felony ? '!' : '')), citations: (s.citations || []).length, phase: w.police.phase, tag: document.querySelector('[data-warrant]')?.className + ':' + document.querySelector('[data-warrant]')?.textContent }; });
  const clearModals = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
  // 1. outrun a level-2 pursuit: a felony evading warrant goes out
  await p.evaluate(() => {
    const s = window.__rfg.game.s, w = window.__rfg.app.world;
    s.warrants = []; s.citations = []; s.cash = 50000; w.police.reset(w); w.paused = false;
    s.heat = 2.3; w.police.startChase(w, true); w.police.eyesOn = true;
    w.police.note({ kind: 'speeding', text: 'Speeding — 88 in a 45.', fine: 700 });
    w.police.escaped(w);
  });
  await p.waitForTimeout(250);
  let r = await R();
  if (!r.warrants.includes('evading!') || !r.warrants.includes('speeding')) throw new Error('escaping a pursuit did not put out a warrant ' + JSON.stringify(r));
  if (/hidden/.test(r.tag) || !/felony/.test(r.tag) || !/WARRANT/.test(r.tag)) throw new Error('HUD does not show the warrant ' + JSON.stringify(r));
  // the warrant is in the save, so it follows the account to the next session
  const saved = await p.evaluate(async () => { const { saveGame, loadGame } = await import('./js/core/save.js'); saveGame('auto', true); return (loadGame('auto')?.warrants || []).length; });
  if (saved < 2) throw new Error('warrants were not saved: ' + saved);
  await snap('25-warrant-hud');
  // 2. a patrol next to you runs your plate: felony stop
  const hit = await p.evaluate(() => {
    const s = window.__rfg.game.s, w = window.__rfg.app.world, pl = w.playerState();
    w.police.reset(w); s.heat = 0;
    const fake = { x: pl.x + 4, z: pl.z, police: true };
    w.police.patrols.push(fake);
    for (let i = 0; i < 4 && w.police.phase === 'none'; i++) w.police.recognition(1, w, true);
    w.police.patrols = w.police.patrols.filter(c => c !== fake);
    return { phase: w.police.phase, heat: s.heat, radio: document.querySelector('.hud-radio')?.textContent || '' };
  });
  if (hit.phase !== 'chase' || hit.heat < 2) throw new Error('a patrol next to a wanted car did not recognise it ' + JSON.stringify(hit));
  // 3. pulling over with a warrant is an arrest, and it serves the warrant
  await p.evaluate(() => { const w = window.__rfg.app.world; w.police.phase = 'notice'; w.police.busted(w); });
  await p.waitForSelector('.modal h2:has-text("BUSTED")');
  if (!/active warrant/.test(await p.textContent('.modal')) || !/warrants? served/.test(await p.textContent('.modal'))) throw new Error('arrest modal does not mention the warrant');
  await clearModals(); await p.evaluate(() => { window.__rfg.app.world.paused = false; }); await p.waitForTimeout(250);
  r = await R();
  if (r.warrants.length || !/hidden/.test(r.tag)) throw new Error('arrest did not clear the warrants ' + JSON.stringify(r));
  // 4. sign a ticket instead of paying, miss the due date: warrant
  await p.evaluate(() => { const w = window.__rfg.app.world; w.police.reset(w); w.police.phase = 'notice'; w.police.note({ kind: 'speeding', text: 'Speeding — 61 in a 40.', fine: 330 }); w.police.busted(w); });
  await p.waitForSelector('.modal h2:has-text("Traffic stop")');
  await p.click('.modal button:has-text("pay within")');
  await p.waitForSelector('.modal h2:has-text("Citation signed")');
  await clearModals();
  if ((await R()).citations !== 1) throw new Error('signed ticket not on the record');
  await p.evaluate(() => { const s = window.__rfg.game.s; s.time.day += 4; window.__rfg.app.world.ui.onNewDay(); });
  r = await R();
  if (!r.warrants.includes('fta') || r.citations) throw new Error('an overdue ticket did not become a warrant ' + JSON.stringify(r));
  if (!(await p.evaluate(() => window.__rfg.game.s.messages[0]?.from === 'brenner'))) throw new Error('no message about the new warrant');
  // 5. FWPD phone app lists it and pays it
  await clearModals();
  await key('KeyP'); await p.waitForTimeout(250);
  await p.click('.app:has-text("FWPD")'); await p.waitForTimeout(200);
  if (!/Failure to pay/.test(await p.textContent('.phone-screen'))) throw new Error('FWPD app does not list the warrant');
  await snap('26-fwpd-app');
  await p.click('.phone-screen button:has-text("Pay $")'); await p.waitForTimeout(200);
  if ((await R()).warrants.length) throw new Error('paying in the app did not clear a misdemeanour warrant');
  await clearModals();
  // 6. a felony can't be paid off; turning yourself in at a precinct clears it
  await p.evaluate(async () => {
    const { warrantForEscape } = await import('./js/core/warrants.js'); const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js');
    const s = window.__rfg.game.s; warrantForEscape(s, [{ kind: 'robbery', text: 'Armed robbery — test.', fine: 6000 }], 3);
    openPlace(LOC_BY_ID.pspd_central, window.__rfg.app);
  });
  await p.waitForTimeout(250);
  await snap('27-precinct');
  await p.click('button:has-text("Turn yourself in")');
  await p.click('.modal button:has-text("Turn myself in")');
  await p.waitForTimeout(200);
  if ((await R()).warrants.length) throw new Error('turning yourself in did not clear the felony warrant');
  await clearModals();
});

// ---------------- traffic stop: 10 s to pull over, officer walks up, drive off = chase ----------------
await step('traffic stop: pull over, walk-up, drive off', async () => {
  const P = () => p.evaluate(() => { const w = window.__rfg.app.world, po = w.police; return { phase: po.phase, pullT: +po.pullT.toFixed(1), step: po.stop?.step || null, officer: po.officer ? { x: po.officer.x, z: po.officer.z } : null, rec: po.record.map(r => r.kind), heat: +window.__rfg.game.s.heat.toFixed(2), title: document.querySelector('[data-ptitle]')?.textContent || '' }; });
  // lit up while sitting still, with the unit already close behind
  const light = () => p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const { Unit } = await import('./js/world2d/police.js'); const { CAR_BY_ID } = await import('./js/data/cars.js');
    const w = window.__rfg.app.world, s = window.__rfg.game.s, v = w.vehicle, po = w.police;
    po.reset(w); po.patrols.length = 0; po.units.length = 0; s.heat = 0; s.warrants = []; w.paused = false; w.inCar = true;
    // parked on a long straight downtown, facing along the road
    const e = w.map.roads.edges.filter(e => e.len > 160).sort((a, b) => Math.hypot(a.ax, a.az) - Math.hypot(b.ax, b.az))[0];
    v.x = e.ax + e.dx * 110 - e.dz * 2.5; v.z = e.az + e.dz * 110 + e.dx * 2.5; v.h = Math.atan2(e.dx, -e.dz);
    v.vx = v.vz = 0; v.sim.v = 0; v.rev = 0; v.yawRate = 0; w.traffic.cars.length = 0;
    const fx = Math.sin(v.h), fz = -Math.cos(v.h);
    po.units.push(new Unit(CAR_BY_ID.ford_crown_victoria_police_interceptor_2003, v.x - fx * 30, v.z - fz * 30, v.h));
    po.note({ kind: 'speeding', text: 'Speeding — 52 mph in a 35.', fine: 300 });
    po.startChase(w);
  });
  await light();
  const lit = await P();
  console.log('     lit up', JSON.stringify(lit));
  if (lit.phase !== 'notice' || !(lit.pullT > 9)) throw new Error('no 10 second pull-over countdown ' + JSON.stringify(lit));
  if (!/PULL OVER — 1?\d+s/.test(lit.title)) throw new Error('HUD does not count down the pull-over: ' + lit.title);
  await snap('28-pull-over');
  // sitting still counts as pulling over; the unit parks behind and the officer walks to the window
  let walk = null;
  for (let i = 0; i < 80 && !walk; i++) { await p.waitForTimeout(100); const s = await P(); if (s.step === 'walk' && s.officer) walk = s; }
  if (!walk) throw new Error('officer never got out ' + JSON.stringify(await P()) + JSON.stringify(await p.evaluate(() => { const w = window.__rfg.app.world, u = w.police.stop?.unit, v = w.vehicle; return { u: u && { x: u.x, z: u.z, h: u.h, v: u.v }, v: { x: v.x, z: v.z, h: v.h }, st: w.police.stop && { x: w.police.stop.x, z: w.police.stop.z, h: w.police.stop.h, t: w.police.stop.t } }; })));
  const parked = await p.evaluate(() => { const w = window.__rfg.app.world, u = w.police.stop.unit, v = w.vehicle; const fx = Math.sin(v.h), fz = -Math.cos(v.h); return { behind: -((u.x - v.x) * fx + (u.z - v.z) * fz), side: Math.abs((u.x - v.x) * Math.cos(v.h) + (u.z - v.z) * Math.sin(v.h)) }; });
  console.log('     unit parked', JSON.stringify(parked));
  if (!(parked.behind > 5 && parked.behind < 11 && parked.side < 2)) throw new Error('unit did not park behind the car ' + JSON.stringify(parked));
  await p.waitForTimeout(900);
  await snap('29-officer-walking');
  await p.waitForSelector('.modal h2:has-text("Traffic stop")', { timeout: 12000 });
  const win = await p.evaluate(() => { const w = window.__rfg.app.world, o = w.police.officer, v = w.vehicle; const rx = Math.cos(v.h), rz = Math.sin(v.h); return { left: -((o.x - v.x) * rx + (o.z - v.z) * rz), d: Math.hypot(o.x - v.x, o.z - v.z) }; });
  console.log('     officer at window', JSON.stringify(win));
  if (!(win.left > 0.8 && win.d < 3)) throw new Error('officer is not at the driver window ' + JSON.stringify(win));
  await snap('30-ticket-at-window');
  await p.click('.modal button:has-text("Accept the citation")');
  await p.waitForSelector('.modal h2:has-text("Citation issued")'); await p.click('.modal button');
  const done = await P();
  if (done.phase !== 'none' || done.heat !== 0) throw new Error('stop did not end after taking the ticket ' + JSON.stringify(done));

  // driving off while the officer walks up: chase
  await light();
  for (let i = 0; i < 80; i++) { await p.waitForTimeout(100); if ((await P()).step === 'walk') break; }
  await p.keyboard.down('KeyW'); await p.waitForTimeout(900); await p.keyboard.up('KeyW');
  const ran = await P();
  console.log('     drove off', JSON.stringify(ran));
  if (ran.phase !== 'chase' || !ran.rec.includes('evading')) throw new Error('driving off the stop did not start a chase ' + JSON.stringify(ran));
  if (await p.isVisible('.modal-back')) throw new Error('ticket shown after driving off');

  // pulling off from the window instead of taking the ticket: chase
  await light();
  await p.waitForSelector('.modal h2:has-text("Traffic stop")', { timeout: 12000 });
  await p.click('.modal button:has-text("Pull off")');
  const off = await P();
  if (off.phase !== 'chase' || !off.rec.includes('evading')) throw new Error('pulling off from the window did not start a chase ' + JSON.stringify(off));

  // never stopping: the countdown runs out and it's a pursuit
  await light();
  await p.evaluate(() => { window.__rfg.app.world.police.pullT = 0.6; });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW');
  const fail = await P();
  console.log('     failed to yield', JSON.stringify(fail));
  if (fail.phase !== 'chase') throw new Error('not pulling over in time did not start a chase ' + JSON.stringify(fail));
  await p.evaluate(() => { const w = window.__rfg.app.world; w.police.reset(w); w.police.units.length = 0; });
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
  if (a.w !== 990 || a.solid < 20000) throw new Error('showroom Mustang did not draw');
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
  await p.waitForSelector('[data-side]');
  const civic = await hash();
  if (civic.w !== 1320 || civic.solid < 40000 || civic.h === f2.h) throw new Error('a Civic should get its own HD side view: ' + JSON.stringify(civic));
  await snap('29-showroom-civic');
  await p.click('[data-layer="wheels"]'); const civicNoWheels = await hash(); if (civicNoWheels.h === civic.h) throw new Error('Civic wheels layer does nothing');
  await p.keyboard.press('Escape');
});

// ---------------- every car: own side view + overhead sprite ----------------
await step('every car draws (side view + overhead)', async () => {
  const r = await p.evaluate(async () => {
    const { CARS } = await import('./js/data/cars.js'); const { drawSideCar } = await import('./js/gfx2d/sideCar.js'); const { carSprite } = await import('./js/gfx2d/carSprite.js');
    const bad = [], sig = new Set(); let n = 0;
    for (const m of CARS) {
      const v = { paint: '#c41b1b', finish: 'gloss', wheels: 'five', wheelColor: '#c0c4c8', tint: 'light', spoiler: 'none', headlights: 'led', taillights: 'stock' };
      try {
        const c = document.createElement('canvas'); drawSideCar(c, { model: m, visual: v, levels: {}, cond: {} });
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let solid = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) solid++;
        const sp = carSprite(m, v, {}, null); const sd = sp.canvas.getContext('2d').getImageData(0, 0, sp.canvas.width, sp.canvas.height).data; let ss = 0; for (let i = 3; i < sd.length; i += 4) if (sd[i] > 200) ss++;
        if (solid < 30000 || ss < 1500) bad.push(m.id + ' side ' + solid + ' top ' + ss);
        sig.add(Math.round(solid / 500) + ':' + sp.canvas.width + 'x' + sp.canvas.height); n++;
      } catch (e) { bad.push(m.id + ': ' + e.message); }
    }
    return { n, bad: bad.slice(0, 5), distinct: sig.size };
  });
  console.log('     all cars', JSON.stringify(r));
  if (r.bad.length) throw new Error('cars failed to draw: ' + r.bad.join('; '));
  if (r.distinct < 60) throw new Error('cars look too alike: ' + r.distinct + ' distinct silhouettes');
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

// ---------------- real account server (Supabase Auth, mocked) ----------------
await step('supabase accounts', async () => {
  const actx = await b.newContext({ viewport: { width: 844, height: 390 } });
  const a = await actx.newPage(); a.setDefaultTimeout(8000);
  a.on('pageerror', e => errs.push('auth pageerror: ' + e.message));
  await a.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const calls = []; let refreshOk = true;
  const user = { id: 'u-123', email: 'kim@example.com', user_metadata: { username: 'Kimari' } };
  const sess = n => ({ access_token: 'at' + n, refresh_token: 'rt' + n, expires_in: 3600, token_type: 'bearer', user });
  await a.route(/supabase\.co\/auth\/v1\//, async r => {
    const u = new globalThis.URL(r.request().url()), path = u.pathname.split('/auth/v1/')[1] + u.search, body = r.request().postDataJSON?.() || {};
    calls.push(path.split('&')[0]);
    const json = (status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
    if (path.startsWith('signup')) return json(200, { id: 'u-123', email: body.email, user_metadata: body.data });   // email confirmation on: no session
    if (path.startsWith('token?grant_type=password')) return body.password === 'hunter22' ? json(200, sess(1)) : json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    if (path.startsWith('token?grant_type=refresh_token')) return refreshOk ? json(200, sess(2)) : json(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    if (path.startsWith('logout')) return r.fulfill({ status: 204 });
    return json(404, { msg: 'not mocked: ' + path });
  });
  const open = async () => { await a.goto(URL.replace(/\?.*$/, ''), { waitUntil: 'domcontentloaded' }); await a.waitForFunction(() => window.__rfg, null, { timeout: 15000 }); await a.waitForTimeout(600); };
  await open();
  if (await a.evaluate(() => window.__rfg.auth.kind) !== 'supabase') throw new Error('not using Supabase without ?auth=local');
  await a.fill('[name=username]', 'Kimari'); await a.fill('[name=email]', 'Kim@Example.com'); await a.fill('[name=password]', 'hunter22');
  await a.click('.auth-go'); await a.waitForTimeout(300);
  if (!(await a.isVisible('h1:has-text("Check your email")'))) throw new Error('no "check your email" after signing up');
  await a.click('.auth-go');   // → log in
  await a.fill('[name=email]', 'kim@example.com'); await a.fill('[name=password]', 'wrong12'); await a.click('.auth-go'); await a.waitForTimeout(300);
  if (!/Wrong email or password/.test(await a.textContent('[data-err]'))) throw new Error('bad password not reported');
  await a.fill('[name=password]', 'hunter22'); await a.click('.auth-go'); await a.waitForTimeout(400);
  if (!(await a.isVisible('.acct-chip:has-text("Kimari")'))) throw new Error('not logged in with Supabase');
  await snap('00-title-logged-in');
  await open();   // reopening refreshes the session and stays logged in
  if (!(await a.isVisible('.acct-chip:has-text("Kimari")')) || !calls.some(c => c.startsWith('token?grant_type=refresh_token'))) throw new Error('session not kept / refreshed: ' + calls.join(' '));
  if ((await a.evaluate(() => window.__rfg.auth.session.refresh_token)) !== 'rt2') throw new Error('refreshed session not stored');
  refreshOk = false; await open();   // the server says the session is dead → back to log in
  if (!(await a.isVisible('.auth-card'))) throw new Error('dead session still let you in');
  await actx.close();
});

// ---------------- phone controls (separate touch context) ----------------
await step('phone controls', async () => {
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  // like iPhone Safari: no orientation lock, so portrait gets the rotate screen
  // (Chromium's headless shell grants the lock, which would hide it)
  await mctx.addInitScript(() => { if (screen.orientation) screen.orientation.lock = () => Promise.reject(new DOMException('not supported', 'NotSupportedError')); });
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
  await m.fill('[name=username]', 'Phone'); await m.fill('[name=email]', 'phone@example.com'); await m.fill('[name=password]', 'hunter22'); await m.tap('.auth-go'); await m.waitForTimeout(300);
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
  // steering wheel mode: arrows swap for a wheel you drag round; it springs back and the car turns
  await fire('#touch [data-steermode]', 'pointerdown', 6); await fire('#touch [data-steermode]', 'pointerup', 6);
  expect(await m.evaluate(async () => (await import('./js/core/save.js')).settings.steerMode) === 'wheel', 'STEER MODE button did not switch to the wheel');
  expect(await vis('#touch .tc-wheel') && !(await vis('#touch .tc-arrow')), 'wheel mode should show the wheel and hide the arrows');
  await m.evaluate(() => { const w = window.__rfg.app.world; const v = w.vehicle; v.x = 0; v.z = 150; v.vx = 0; v.vz = 0; v.sim.v = 0; v.h = 0; v.yawRate = 0; v.rev = 0; w.cam.x = 0; w.cam.z = 150; });
  a = await st();
  await fire('#touch .tc-gas', 'pointerdown', 1);
  await m.waitForTimeout(500);
  const wr = await m.evaluate(() => { const r = document.querySelector('[data-wheel]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.4 }; });
  const wfire = (type, x, y) => m.evaluate(([type, x, y]) => document.querySelector('[data-wheel]').dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 8, pointerType: 'touch', clientX: x, clientY: y })), [type, x, y]);
  await wfire('pointerdown', wr.x, wr.y - wr.R);
  for (let t = 0; t <= 1.0; t += 0.1) await wfire('pointermove', wr.x + Math.sin(t) * wr.R, wr.y - Math.cos(t) * wr.R);
  const steerNow = await m.evaluate(async () => (await import('./js/core/input.js')).input.steer());
  expect(steerNow > 0.4, 'dragging the wheel clockwise should steer right, got ' + steerNow);
  await m.waitForTimeout(800);
  b2 = await st();
  expect(b2.h > a.h + 0.15, 'the wheel did not turn the car right (' + a.h + ' -> ' + b2.h + ')');
  await wfire('pointerup', wr.x, wr.y);
  await m.waitForTimeout(500);
  expect(Math.abs(await m.evaluate(async () => (await import('./js/core/input.js')).input.steer())) < 0.05, 'the wheel did not spring back to centre');
  // drag the other way
  await wfire('pointerdown', wr.x, wr.y - wr.R);
  for (let t = 0; t >= -1.0; t -= 0.1) await wfire('pointermove', wr.x + Math.sin(t) * wr.R, wr.y - Math.cos(t) * wr.R);
  expect(await m.evaluate(async () => (await import('./js/core/input.js')).input.steer()) < -0.4, 'dragging the wheel anticlockwise should steer left');
  await wfire('pointerup', wr.x, wr.y);
  await fire('#touch .tc-gas', 'pointerup', 1);
  await fire('#touch [data-steermode]', 'pointerdown', 6); await fire('#touch [data-steermode]', 'pointerup', 6);
  expect(await vis('#touch .tc-arrow') && !(await vis('#touch .tc-wheel')), 'switching back should show the arrows');
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
  // a long press on the gas pedal is a held pedal, not a text selection / copy menu
  {
    await m.setViewportSize({ width: 844, height: 390 }); await m.waitForTimeout(300);   // landscape, the way it's played
    const cdp = await mctx.newCDPSession(m);
    if (!(await m.evaluate(() => window.__rfg.app.world.inCar))) { await fire('.tc-foot-btns [data-tap="enterExit"]', 'pointerdown'); await fire('.tc-foot-btns [data-tap="enterExit"]', 'pointerup'); await m.waitForTimeout(400); }
    await m.evaluate(() => { window.__cm = []; document.addEventListener('contextmenu', e => window.__cm.push(e.defaultPrevented)); });
    const g = await m.evaluate(() => { const e = document.querySelector('#touch .tc-gas'); if (!e || e.offsetParent === null) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    expect(g, 'gas pedal not on screen for the long-press test');
    {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.x, y: g.y, id: 7 }] });
      await m.waitForTimeout(1200);
      const held = await m.evaluate(([x, y]) => ({ at: document.elementFromPoint(x, y)?.className, sel: String(window.getSelection()), on: document.querySelector('#touch .tc-gas').classList.contains('on'), cm: window.__cm }), [g.x, g.y]);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      console.log('     long-press gas', JSON.stringify(held));
      expect(held.sel === '', 'long-pressing the gas selected text');
      expect(held.on, 'gas pedal let go during a long press');
      expect(held.cm.every(Boolean), 'long press opened a context menu');
    }
    const css = await m.evaluate(() => { const cs = getComputedStyle(document.querySelector('#touch .tc-gas span')); return cs.webkitUserSelect || cs.userSelect; });
    expect(css === 'none', 'pedal label is selectable');
  }
  // GPS while driving: the route follows the roads, a turn banner shows the next turn
  {
    await m.evaluate(() => { const w = window.__rfg.app.world; const v = w.vehicle; v.x = 4; v.z = 300; v.vx = v.vz = 0; v.sim.v = 0; v.h = 0; w.cam.x = 4; w.cam.z = 300; });
    await m.evaluate(async () => { const { LOC_BY_ID } = await import('./js/data/world.js'); const l = LOC_BY_ID.torque_temple; window.__rfg.app.world.setGps(l.x, l.z, l.name); });
    await m.waitForTimeout(400);
    const nav = await m.evaluate(() => {
      const w = window.__rfg.app.world, path = w.gpsPath, roads = w.map.roads, e = document.querySelector('[data-nav]');
      const offRoad = path.slice(1, -1).filter(([x, z]) => !roads.onRoad(x, z)).length;
      return { pts: path.length, offRoad, info: w.navInfo(), shown: !!e && e.offsetParent !== null && !e.classList.contains('hidden'), text: e?.textContent || '' };
    });
    console.log('     gps nav', JSON.stringify({ pts: nav.pts, offRoad: nav.offRoad, text: nav.text }));
    expect(nav.pts > 3 && nav.offRoad === 0, 'GPS route does not follow the roads');
    expect(nav.shown && /Turn (left|right)|U-turn/.test(nav.text) && /\d/.test(nav.text), 'no turn-by-turn banner while driving with GPS set: ' + nav.text);
    const box = await m.evaluate(() => { const r = document.querySelector('[data-nav]').getBoundingClientRect(), q = document.querySelector('.hud-tr').getBoundingClientRect(); return { r: r.right, l: q.left }; });
    expect(box.r <= box.l + 1, 'turn banner overlaps the money / dash column');
    await m.evaluate(() => { window.__rfg.game.s.gps = null; window.__rfg.app.world.gpsPath = null; });
  }
  await mctx.close();
});

console.log(errs.length ? '\nERRORS:\n' + errs.join('\n') : '\nno errors');
await b.close();
process.exit(errs.length ? 1 : 0);
