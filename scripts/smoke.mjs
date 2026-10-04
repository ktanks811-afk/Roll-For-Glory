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
await step('weather + night shift', async () => {
  const r = await p.evaluate(async () => {
    const W = await import('./js/core/weather.js');
    const w = window.__rfg.app.world, s = window.__rfg.game.s;
    const saved = { weather: s.weather, min: s.time.min };
    s.weather = 'storm'; s.time.min = 60;   // 1 AM in a thunderstorm
    document.querySelectorAll('.modal-back').forEach(m => m.remove()); w.paused = false;
    await new Promise(r => setTimeout(r, 500)); const hud = document.querySelector('[data-day]')?.textContent || '';
    const out = { hud, grip: W.wx(s).grip, patrols: W.extraPatrols(s.time), night: W.nightShift(s.time), dark: w.darkness() };
    s.time.min = 12 * 60; out.noon = W.nightShift(s.time);
    out.chain = Array.from({ length: 200 }, () => W.nextWeather('clear')).every(x => W.WEATHER[x]);
    Object.assign(s, { weather: saved.weather }); s.time.min = saved.min;
    return out;
  });
  if (!(/Thunderstorm.*Night shift/.test(r.hud) && r.grip < 0.7 && r.patrols === 2 && r.night === 2 && r.noon === 0 && r.dark > 0.7 && r.chain)) throw new Error('weather/night rules off: ' + JSON.stringify(r));
});
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
await step('street races: 1v1 for cash, pink slips, time trial', async () => {
  const w0 = await p.evaluate(() => { const w = window.__rfg.app.world, v = w.vehicle, s = window.__rfg.game.s; return { x: v.x, z: v.z, h: v.h, uid: s.activeCar }; });
  const toStart = id => p.evaluate(async id => {
    const { LOC_BY_ID } = await import('./js/data/world.js'); const l = LOC_BY_ID[id]; const w = window.__rfg.app.world, v = w.vehicle;
    window.__rfg.game.s.heat = 0; w.police.reset?.(w);
    v.x = l.x; v.z = l.z; v.h = l.face; v.vx = v.vz = 0; v.sim.v = 0; w.inCar = true; w.cam.x = l.x; w.cam.z = l.z; w.paused = false;
  }, id);
  // through every checkpoint (the driving itself is covered by the other steps)
  const runIt = async () => { for (let k = 0; k < 12; k++) { if (await p.evaluate(() => { const w = window.__rfg.app.world, r = w.races.race; if (!r) return true; if (r.phase !== 'race') return false; const c = r.route.checkpoints[r.next], v = w.vehicle; v.x = c.x; v.z = c.z; v.vx = v.vz = 0; return false; })) break; await p.waitForTimeout(250); } };
  const waitStart = () => p.waitForFunction(() => window.__rfg.app.world.races.race?.phase === 'race', null, { timeout: 6000 });
  // the start line is a place: Enter opens the setup
  await toStart('sr_sundance'); await p.waitForTimeout(250);
  await p.keyboard.press('Enter'); await p.waitForSelector('.p-head h1:has-text("Sundance Square Sprint")');
  await p.click('[data-action=pick] >> nth=0');
  await p.evaluate(() => { const r = document.querySelector('[data-wager]'); r.value = 200; r.oninput(); });
  // story steps pay out for beating some racers (Tiny: $300), so keep the story out of the payout check
  const cash0 = await p.evaluate(() => { const s = window.__rfg.game.s; window.__storyWas = s.story.enabled; s.story.enabled = false; return s.cash + s.bank; });
  await p.click('text=Line up');
  // countdown: the car is held on the grid, the rival is beside you
  await p.waitForTimeout(1200); await snap('21-street-countdown');
  const grid = await p.evaluate(() => { const w = window.__rfg.app.world, r = w.races.race; return { phase: r.phase, held: w.vehicle.speed < 0.1, rival: !!r.rival, hud: !!document.querySelector('.sr-hud') }; });
  if (grid.phase !== 'count' || !grid.held || !grid.rival || !grid.hud) throw new Error('no countdown on the grid ' + JSON.stringify(grid));
  await waitStart();
  await p.waitForFunction(() => window.__rfg.app.world.races.race?.rival.s > 5, null, { timeout: 8000 }).catch(async () => { throw new Error('the rival never left the line ' + JSON.stringify(await p.evaluate(() => { const w = window.__rfg.app.world, r = w.races.race; return { s: r?.rival.s, v: r?.rival.sim.v, paused: w.paused, panels: document.querySelectorAll('#panels > *').length, modal: document.querySelector('.modal h2')?.textContent }; }))); });
  await snap('22-street-race');
  await runIt();
  await p.waitForSelector('.p-head h1:has-text("YOU WIN")'); await snap('23-street-win');
  const won = await p.evaluate(() => ({ story: (window.__rfg.game.s.story.enabled = window.__storyWas), money: window.__rfg.game.s.cash + window.__rfg.game.s.bank, best: window.__rfg.game.s.streetRecords?.sr_sundance, hud: !!document.querySelector('.sr-hud') }));
  if (won.money !== cash0 + 200 || !won.best || won.hud) throw new Error('cash race payout wrong ' + JSON.stringify({ cash0, ...won }));
  await p.click('text=Back to the street');
  // pink slips, on a second car the rival's own model: lose it and it's gone
  const keysModel = await p.evaluate(async () => (await import('./js/data/npcs.js')).RACER_BY_ID.keys.car.model);
  await p.evaluate(async m => { const S = await import('./js/core/state.js'); const s = window.__rfg.game.s; if (!s.properties.includes('westside_house')) s.properties.push('westside_house'); const c = S.newCar(m); s.cars.push(c); s.activeCar = c.uid; const w = window.__rfg.app.world; w.inCar = false; w.vehicle = null; w.refreshCar(); }, keysModel);
  await toStart('sr_magnolia'); await p.waitForTimeout(250);
  await p.evaluate(async () => { const { openStreetRace } = await import('./js/ui/streetRaceSetup.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); openStreetRace(window.__rfg.app, LOC_BY_ID.sr_magnolia, { npcId: 'keys' }); });
  await p.click('[data-v=pinks]'); await snap('24-pink-slips');
  if (!(await p.isVisible('text=Winner keeps both cars'))) throw new Error('pink slips not on offer against an even car');
  const pinkUid = await p.evaluate(() => window.__rfg.game.s.activeCar);
  await p.click('text=Line up'); await waitStart();
  await p.evaluate(() => { const r = window.__rfg.app.world.races.race; r.rival.s = r.route.length - 1; });
  await p.waitForSelector('.p-head h1:has-text("YOU LOST")', { timeout: 10000 });
  const lost = await p.evaluate(uid => { const s = window.__rfg.game.s, w = window.__rfg.app.world; return { gone: !s.cars.some(c => c.uid === uid), onFoot: !w.inCar, active: s.activeCar }; }, pinkUid);
  if (!lost.gone || !lost.onFoot || lost.active !== w0.uid) throw new Error('lost the pink slip but kept the car ' + JSON.stringify(lost));
  await p.click('text=Back to the street');
  // back in your own car where it was, then a solo run at the course record
  await p.evaluate(w0 => { const w = window.__rfg.app.world, s = window.__rfg.game.s; s.activeCar = w0.uid; w.refreshCar(); const v = w.vehicle; v.x = w0.x; v.z = w0.z; v.h = w0.h; w.inCar = true; w.restartEngineSound(); }, w0);
  await toStart('sr_stockyards'); await p.waitForTimeout(250);
  await p.evaluate(async () => { const { openStreetRace } = await import('./js/ui/streetRaceSetup.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); openStreetRace(window.__rfg.app, LOC_BY_ID.sr_stockyards); });
  await p.click('[data-v=trial]');
  if (!(await p.isVisible('text=Course record'))) throw new Error('no course record on the time trial');
  await p.click('text=Start the clock'); await waitStart(); await runIt();
  await p.waitForSelector('.p-head h1:has-text("NEW RECORD")');
  await p.click('text=Back to the street');
  await p.evaluate(w0 => { const w = window.__rfg.app.world, v = w.vehicle, s = window.__rfg.game.s; v.x = w0.x; v.z = w0.z; v.h = w0.h; v.vx = v.vz = 0; v.sim.v = 0; s.heat = 0; w.police.reset?.(w); s.gps = null; w.gpsPath = null; }, w0);
});
await step('places', async () => {
  for (const id of ['eastgate_studio', 'auto_row', 'halo_exotics', 'rusty_used', 'torque_temple', 'vega_kustoms', 'second_chance', 'gas_westbrook', 'luckys', 'threadline', 'bayline', 'pspd_central', 'pier9']) {
    await p.evaluate(async id => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); window.__rfg.game.s.rep = 40000; openPlace(LOC_BY_ID[id], window.__rfg.app); }, id);
    await p.waitForTimeout(250);
    if (['auto_row', 'pier9', 'halo_exotics'].includes(id)) await snap('20-' + id);
    await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
  }
});
await step('hellcat widebody art', async () => {
  const r = await p.evaluate(async () => {
    // checked from data, not by opening the lot, so no game time passes here
    const { LOC_BY_ID } = await import('./js/data/world.js');
    const { CAR_BY_ID: C, soldNew } = await import('./js/data/cars.js');
    const hc = C.dodge_charger_srt_hellcat_widebody_2020;
    const listed = !!hc && soldNew(hc) && LOC_BY_ID.auto_row.makes.includes(hc.make);
    const { hasArt } = await import('./js/gfx2d/carArt.js');
    const { drawSideCar } = await import('./js/gfx2d/sideCar.js');
    const { carSprite } = await import('./js/gfx2d/carSprite.js');
    const { CAR_BY_ID } = await import('./js/data/cars.js');
    const m = CAR_BY_ID.dodge_charger_srt_hellcat_widebody_2020;
    const red = cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 120 && d[i + 1] < 60 && d[i + 2] < 60) n++; return n; };
    const side = document.createElement('canvas'); drawSideCar(side, { model: m, visual: { paint: '#c41b1b', wheels: 'five' }, levels: {} });
    const top = carSprite(m, { paint: '#c41b1b' }, {}, null).canvas;
    return { listed, art: hasArt(m.id), side: red(side), top: red(top) };
  });
  if (!r.listed) throw new Error('Hellcat Widebody not on the Cowtown Auto Row lot');
  if (!r.art) throw new Error('Hellcat Widebody art did not load');
  if (r.side < 20000 || r.top < 1500) throw new Error('Hellcat Widebody paint not showing: ' + JSON.stringify(r));
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
await step('upkeep: oil, tread, breakdowns, roadside', async () => {
  const r = await p.evaluate(async () => {
    const up = await import('./js/core/upkeep.js');
    const st = await import('./js/core/state.js');
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels();
    document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const w = window.__rfg.app.world, s = window.__rfg.game.s, car = s.cars.find(c => c.uid === s.activeCar);
    const saved = JSON.parse(JSON.stringify({ cond: car.cond, oil: car.oil, fuel: car.fuel }));
    s.cash += 5000;
    // miles wear the oil and the tread
    car.oil = 100; car.cond.tires = 100;
    for (let i = 0; i < 300; i++) up.wearTick(car, 0.1, { spec: st.carSpec(car) });
    const worn = { oil: car.oil, tires: car.cond.tires };
    // run out of oil and it overheats; the car makes no power
    car.oil = 0; car.cond.engine = 90; delete car.broken;
    let ev = null; for (let i = 0; i < 200 && !ev?.match?.(/overheat|stall/); i++) ev = up.wearTick(car, 0.1, { spec: st.carSpec(car) }) || ev;
    const broke = car.broken;
    w.paused = false;
    await new Promise(r => setTimeout(r, 250));
    const hud = document.querySelector('[data-carname]')?.textContent || '';
    // the repair shop shows the oil change and the breakdown
    const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js');
    openPlace(LOC_BY_ID.second_chance, window.__rfg.app);
    await new Promise(r => setTimeout(r, 150));
    const shop = document.querySelector('#panels')?.textContent || '';
    const oilBtn = !!document.querySelector('#panels [data-action="oil"]:not([disabled])');
    closeAllPanels();
    // old saves (no oil field, no breakdowns) load with fresh oil
    const { importSave } = await import('./js/core/save.js');
    const old = JSON.parse(JSON.stringify(s)); for (const c of old.cars) { delete c.oil; delete c.broken; }
    const mig = importSave(JSON.stringify({ game: 'roll-for-glory', state: old })).cars.every(c => c.oil === 100 && !c.broken);
    return { worn, ev, broke, hud, shopBreak: /Overheated|Stalled/.test(shop), shopOil: /Oil change/.test(shop), oilBtn, mig, saved };
  });
  console.log('     upkeep', JSON.stringify({ ...r, saved: undefined }));
  if (!(r.worn.oil < 60 && r.worn.tires < 95)) throw new Error('driving did not wear the oil and tires');
  if (!r.broke) throw new Error('no oil did not break the car down');
  if (!/OVERHEATED|STALLED/.test(r.hud)) throw new Error('HUD does not say the car broke down: ' + r.hud);
  if (!r.shopBreak || !r.shopOil || !r.oilBtn) throw new Error('repair shop missing the breakdown / oil change');
  if (!r.mig) throw new Error('old saves did not get fresh oil');
  // the car won't drive while broken down
  const x0 = await p.evaluate(() => { const v = window.__rfg.app.world.vehicle; v.vx = v.vz = 0; return [v.x, v.z]; });
  if (await p.evaluate(() => window.__rfg.app.world.inCar)) {
    await key('KeyW', 500);
    const moved = await p.evaluate(x0 => { const v = window.__rfg.app.world.vehicle; return Math.hypot(v.x - x0[0], v.z - x0[1]); }, x0);
    if (moved > 1.5) throw new Error('a broken-down car still drove ' + moved.toFixed(1) + ' m');
  }
  // the mobile mechanic gets it running from the phone
  await key('KeyP'); await p.waitForTimeout(250);
  await p.click('.app:has-text("Bank")'); await p.waitForTimeout(200);
  await p.click('[data-action="mech"]'); await p.waitForTimeout(150);
  const fixed = await p.evaluate(() => { const s = window.__rfg.game.s, c = s.cars.find(c => c.uid === s.activeCar); return { broken: c.broken || null, oil: c.oil }; });
  await p.click('.phone-bar button').catch(() => {}); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(150);
  if (fixed.broken) throw new Error('mobile mechanic did not fix the breakdown');
  // gas station: oil change at the pump
  const gas = await p.evaluate(async saved => {
    const s = window.__rfg.game.s, car = s.cars.find(c => c.uid === s.activeCar), w = window.__rfg.app.world;
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels();
    const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js');
    const loc = LOC_BY_ID.gas_westbrook;
    w.vehicle.x = loc.x; w.vehicle.z = loc.z; car.oil = 10;
    openPlace(loc, window.__rfg.app);
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('#panels [data-action="oil"]')?.click();
    await new Promise(r => setTimeout(r, 100));
    const oil = car.oil;
    closeAllPanels();
    Object.assign(car, { cond: saved.cond, oil: saved.oil ?? 100, fuel: saved.fuel }); delete car.broken; w.refreshCar();
    return { oil };
  }, r.saved);
  if (gas.oil !== 100) throw new Error('gas station oil change did not work ' + JSON.stringify(gas));
});
await step('drag pack: hooks, wheelies, tune it out', async () => {
  // a 1000+ hp build on a drag pack, no wheelie bars
  const setup = await p.evaluate(async () => {
    const { CATALOG, fits } = await import('./js/data/catalog.js');
    const { CAR_BY_ID } = await import('./js/data/cars.js');
    const st = await import('./js/core/state.js');
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels();
    const s = window.__rfg.game.s;
    const car = st.newCar('chevrolet_camaro_ss_2016'); s.cars.push(car);
    window.__dragSaved = s.activeCar; window.__dragInCar = window.__rfg.app.world.inCar; s.activeCar = car.uid;
    const pick = (cat, stage) => CATALOG.find(p => p.cat === cat && p.stage === stage && fits(p, CAR_BY_ID.chevrolet_camaro_ss_2016))?.id;
    Object.assign(car.parts, { turbo: pick('turbo', 4), ecu: pick('ecu', 3), fuel: pick('fuel', 4), engine: pick('engine', 4), intercooler: pick('intercooler', 3), dragpack: pick('dragpack', 4) });
    window.__rfg.app.world.refreshCar();
    // tap the drag pack in Garage → Performance: profile + launch check
    const { openGarage } = await import('./js/ui/garage.js'); openGarage(window.__rfg.app, { mode: 'home', tab: 'parts' });
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('.click-row[data-cat="dragpack"]').click();
    await new Promise(r => setTimeout(r, 120));
    return { prof: document.querySelector('.modal .pp')?.textContent || '', spec: st.carSpec(car).launchGrip };
  });
  await snap('drag-pack-profile');
  if (!/drag radials/i.test(setup.prof) || !/Launch check/.test(setup.prof)) throw new Error('drag pack profile missing its launch check');
  if (!/wheelie|Stands up/i.test(setup.prof)) throw new Error('launch check did not warn a 1000 hp drag pack car will wheelie: ' + setup.prof.slice(-200));
  // Garage → Tune has the Drag launch group with drag shocks + boost by gear
  const tune = await p.evaluate(async () => {
    document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels();
    const { openGarage } = await import('./js/ui/garage.js'); openGarage(window.__rfg.app, { mode: 'home', tab: 'tune' });
    await new Promise(r => setTimeout(r, 200));
    const g = document.querySelector('.tune-grp[data-g="drag"]'); if (g) { g.open = true; g.scrollIntoView(); }
    return { has: !!g, keys: [...(g?.querySelectorAll('[data-k]') || [])].map(e => e.dataset.k) };
  });
  await snap('drag-pack-tune');
  if (!tune.has || !['frontExt', 'rearComp', 'pwr1', 'pwr2'].every(k => tune.keys.includes(k))) throw new Error('Drag launch tune group missing settings: ' + tune.keys.join(','));
  await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); });
  // drag strip: it wheelies on the launch
  const restore = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); window.__rfg.app.world.paused = false; const s = window.__rfg.game.s; if (!window.__dragSaved) return; s.cars = s.cars.filter(c => c.uid !== s.activeCar); s.activeCar = window.__dragSaved; window.__dragSaved = null; const w = window.__rfg.app.world; w.refreshCar(); w.inCar = window.__dragInCar; });
  try {
  await p.evaluate(async () => { const { openRaceSetup } = await import('./js/ui/raceSetup.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); const w = window.__rfg.app.world; try { w.police.reset(w); } catch {} w.inCar = true; w.paused = false; window.__rfg.game.s.cash += 5000; openRaceSetup(window.__rfg.app, { type: 'drag', loc: LOC_BY_ID.ironline }); });
  await p.waitForTimeout(300);
  await p.click('.li.click >> nth=0');
  await p.click('button:has-text("Make a pass")');
  await p.waitForTimeout(500);
  await p.keyboard.down('KeyW');
  for (let i = 0; i < 80; i++) { const staged = await p.evaluate(() => window.__rfg.app.race?.p.staged); if (staged) break; await p.waitForTimeout(50); }
  await p.keyboard.up('KeyW');
  await p.keyboard.down('KeyS'); await p.keyboard.down('KeyW');
  for (let i = 0; i < 100; i++) { const g = await p.evaluate(() => window.__rfg.app.race?.tree?.green); if (g) break; await p.waitForTimeout(30); }
  await p.keyboard.up('KeyS');
  var maxPitch = 0, slip = '';
  for (let i = 0; i < 30; i++) {
    const pt = await p.evaluate(() => window.__rfg.app.race?.p.sim.pitch || 0);
    if (pt > maxPitch) maxPitch = pt;
    if (pt > 0.35 && i > 2) { await snap('drag-pack-wheelie'); break; }
    await p.waitForTimeout(50);
  }
  for (let i = 0; i < 200; i++) { const r = await p.evaluate(() => !window.__rfg.app.race); if (r) break; await p.waitForTimeout(100); }
  await p.keyboard.up('KeyW');
  await p.waitForTimeout(400); await snap('drag-pack-timeslip');
  slip = await p.textContent('.results').catch(() => '');
  await p.click('text=Back to the street');
  } finally { await p.keyboard.up('KeyW'); await p.keyboard.up('KeyS'); await restore(); await p.waitForTimeout(200); }
  console.log('     dragpack', JSON.stringify({ maxPitch: +maxPitch.toFixed(2), wheelieRow: /Wheelie/.test(slip) }));
  if (!(maxPitch > 0.2)) throw new Error('1000 hp car on a drag pack did not wheelie at the strip');
  if (!/Wheelie/.test(slip)) throw new Error('timeslip has no wheelie row');
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
  // skid marks are laid per frame, so a slow runner needs a moment longer
  await p.waitForFunction(() => { const w = window.__rfg.app.world; return w.skids.length >= 10 && w.smoke.length >= 3; }, null, { timeout: 3000 }).catch(() => {});
  const r = await p.evaluate(() => { const w = window.__rfg.app.world, v = w.vehicle; return { car: v.model.id, drive: v.spec.drive, fuel: +v.car.fuel.toFixed(2), rev: v.rev, ts: v.spec.twoStep, burning: v.burning, slip: +v.sim.slip.toFixed(2), speed: +v.speed.toFixed(2), skids: w.skids.length, smoke: w.smoke.length, flames: w.limiter?.flames || 0, rpm: Math.round(v.sim.rpm), redline: v.spec.redline }; });
  await snap('burnout');
  await p.keyboard.up('KeyS'); await p.keyboard.up('KeyW');
  console.log('     burnout', JSON.stringify(r));
  if (!r.burning || r.slip < 0.5) throw new Error('gas + brake did not start a burnout ' + JSON.stringify(r));
  if (r.skids < 3 || r.smoke < 3) throw new Error('burnout left no marks or smoke ' + JSON.stringify(r));
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
  // robbery: press E at the register; make the outcome deterministic. Midday, so
  // the clock can't roll past midnight and lift the store's alert mid-test.
  const cash0 = await p.evaluate(() => { const s = window.__rfg.game.s; s.time.min = 12 * 60; return s.cash; });
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
  await p.evaluate(() => { window.__rfg.game.s.justice.cases = []; });   // the court step covers what happens next
  // the car is on the impound lot, locked until you sign it out at the Central Precinct (free)
  const lot = await p.evaluate(() => { const w = window.__rfg.app.world; const v = w.vehicle; w.foot.x = v.x + 2; w.foot.z = v.z; return { held: !!v.car.impound }; });
  if (!lot.held) throw new Error('busted car was not impounded');
  await key('KeyF'); await p.waitForTimeout(200);
  if (await p.evaluate(() => window.__rfg.app.world.inCar)) throw new Error('drove an impounded car');
  await p.evaluate(async () => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); openPlace(LOC_BY_ID.pspd_central, window.__rfg.app); });
  const lotCash = await p.evaluate(() => window.__rfg.game.s.cash);
  await p.click('button[data-action="release"]');
  if (await p.evaluate(c => window.__rfg.game.s.cash !== c, lotCash)) throw new Error('getting a car out of impound cost money');
  if (await p.evaluate(() => !!window.__rfg.app.world.vehicle.car.impound)) throw new Error('signing out the car did not free it');
  await calm();
  await key('KeyF'); await p.waitForTimeout(200);
  if (!(await p.evaluate(() => window.__rfg.app.world.inCar))) throw new Error('could not get in the car after paying the impound');
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
    if (v.car) v.car.cond.body = 100;   // earlier steps can leave it wrecked (body floors at 5), then the recovery damage can't show
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

// ---------------- stealing cars (GTA style) ----------------
await step('stealing cars', async () => {
  const calm = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); const w = window.__rfg.app.world; try { w.police.reset(w); } catch {} window.__rfg.game.s.heat = 0; w.paused = false; });
  await calm();
  // park your own car on a city street and get out
  const ownUid = await p.evaluate(() => {
    const w = window.__rfg.app.world, s = window.__rfg.game.s, v = w.vehicle;
    const r = w.map.roads.nearestOnRoad(120, -60);
    v.x = r.x; v.z = r.z; v.h = Math.atan2(r.edge.dx, -r.edge.dz); v.vx = v.vz = 0; v.sim.v = 0;
    w.inCar = false; w.foot.x = v.x + 3; w.foot.z = v.z + 3; w.cam.x = v.x; w.cam.z = v.z;
    if (v.car.impound) delete v.car.impound;
    return s.activeCar;
  });
  await p.evaluate(async () => (await import('./js/core/input.js')).input.setContext('foot'));
  // a civilian car stopped at a light: walk up to the driver's door
  const yank = () => p.evaluate(() => {
    const w = window.__rfg.app.world, c = w.traffic.cars.find(c => !c.police);
    if (!c) return false;
    c.stun = 6; c.v = 0;
    w.foot.x = c.x - Math.cos(c.h) * 2; w.foot.z = c.z - Math.sin(c.h) * 2; w.cam.x = c.x; w.cam.z = c.z;
    window.__stealTarget = c;
    return true;
  });
  if (!(await yank())) throw new Error('no traffic to steal from');
  await p.waitForTimeout(150);
  const prompt = await p.evaluate(() => ({ t: window.__rfg.app.world.thefts.target?.kind, hud: document.querySelector('.hud-prompt, [data-q="prompt"]')?.textContent || document.body.innerText.includes('Pull the driver out'), touch: document.getElementById('touch')?.classList.contains('can-steal') }));
  if (prompt.t !== 'driver' || !prompt.touch) throw new Error('no steal prompt next to a stopped car ' + JSON.stringify(prompt));
  await key('KeyT'); await p.waitForTimeout(1300);
  await snap('42-carjack-npc');
  const took = await p.evaluate(ownUid => { const w = window.__rfg.app.world, t = w.thefts; return { inCar: w.inCar, hot: w.vehicle?.car?.hot?.kind, own: t.own?.vehicle?.car?.uid === ownUid, gone: !w.traffic.cars.includes(window.__stealTarget), driver: t.drivers.length, stolen: window.__rfg.game.s.stats.carsStolen }; }, ownUid);
  if (!took.inCar || took.hot !== 'carjack' || !took.own || !took.gone || !took.driver || !took.stolen) throw new Error('pulling the driver out failed ' + JSON.stringify(took));
  // the 911 call comes in: units respond, it's on your record
  await p.evaluate(() => { window.__rfg.app.world.vehicle.car.hot.callAt = 0; });
  await p.waitForTimeout(300);
  const call = await p.evaluate(() => { const w = window.__rfg.app.world; return { phase: w.police.phase, rec: w.police.record.map(r => r.kind), heat: window.__rfg.game.s.heat, reported: w.vehicle.car.hot.reported }; });
  if (call.phase !== 'chase' || !call.rec.includes('carjack') || !(call.heat >= 2) || !call.reported) throw new Error('carjacking was never called in ' + JSON.stringify(call));
  const cls = await p.evaluate(async () => (await import('./js/core/justice.js')).classify({ kind: 'carjack', text: 'Carjacking (robbery of a motor vehicle).' }).cls);
  if (cls !== 'F2') throw new Error('carjacking charge class ' + cls);
  await calm();
  // get out, walk back to your own car: the stolen one gets dumped
  await p.evaluate(() => { const v = window.__rfg.app.world.vehicle; v.vx = v.vz = 0; v.sim.v = 0; });
  await key('KeyF'); await p.waitForTimeout(150);
  // the car you stole can be anywhere on the map, and dumped cars over 500 m away get
  // cleaned up, so bring your own car to the curb here instead of walking across town
  await p.evaluate(() => { const w = window.__rfg.app.world, o = w.thefts.own.vehicle; o.x = w.vehicle.x + 6; o.z = w.vehicle.z; w.foot.x = o.x + 2; w.foot.z = o.z; });
  await p.waitForTimeout(100);
  await key('KeyF'); await p.waitForTimeout(200);
  const back = await p.evaluate(ownUid => { const w = window.__rfg.app.world; return { inCar: w.inCar, mine: w.vehicle?.car?.uid === ownUid, own: !!w.thefts.own, dumped: w.thefts.dumped.length }; }, ownUid);
  if (!back.inCar || !back.mine || back.own || !back.dumped) throw new Error('could not get back in your own car ' + JSON.stringify(back));
  // a car parked at the curb: break in and drive off
  await key('KeyF'); await p.waitForTimeout(150);
  const parked = () => p.evaluate(() => {
    const w = window.__rfg.app.world, me = w.thefts.own?.vehicle || w.vehicle;
    const cs = w.map.colliders.filter(c => c.b?.kind === 'parked' && !c.off && Math.max(c.b.w, c.b.d) < 6.5 && Math.abs(c.b.x) < 900 && Math.abs(c.b.z) < 900);
    cs.sort((a, b) => Math.hypot(a.b.x - me.x, a.b.z - me.z) - Math.hypot(b.b.x - me.x, b.b.z - me.z));
    const c = cs[0]; if (!c) return null;
    const b = c.b, along = b.w > b.d;
    w.foot.x = along ? b.x + b.w / 2 : b.x - 0.6; w.foot.z = along ? b.z - 0.6 : b.z + b.d / 2; w.cam.x = w.foot.x; w.cam.z = w.foot.z;
    window.__stealCol = c;
    return { x: b.x, z: b.z };
  });
  if (!(await parked())) throw new Error('no parked cars in the city');
  await p.waitForTimeout(150);
  if (!(await p.evaluate(() => window.__rfg.app.world.thefts.target?.kind === 'parked'))) throw new Error('no steal prompt next to a parked car ' + JSON.stringify(await p.evaluate(() => window.__rfg.app.world.thefts.target?.kind || null)));
  await key('KeyT'); await p.waitForTimeout(1900);
  await snap('43-steal-parked');
  const hw = await p.evaluate(() => { const w = window.__rfg.app.world; return { inCar: w.inCar, hot: w.vehicle?.car?.hot?.kind, off: window.__stealCol.off, gone: window.__stealCol.b.gone, carname: document.body.innerText.includes('STOLEN') }; });
  if (!hw.inCar || hw.hot !== 'parked' || !hw.off || !hw.gone || !hw.carname) throw new Error('stealing a parked car failed ' + JSON.stringify(hw));
  // a reported plate: a patrol close by runs it and lights you up
  await calm();
  await p.evaluate(() => { const w = window.__rfg.app.world, v = w.vehicle, h = v.car.hot; h.quiet = true; h.callAt = 0; });
  await p.waitForTimeout(200);
  await p.evaluate(() => { const w = window.__rfg.app.world, v = w.vehicle; w.police.phase = 'none'; w.thefts.plate = 0.99; const c = w.traffic.spawnNear(v.x, v.z, 0, 2000, {}); if (c) { c.police = true; c.stun = 5; w.police.patrols = [c]; v.x = c.x - Math.sin(c.h) * 9; v.z = c.z + Math.cos(c.h) * 9; v.h = c.h; v.vx = v.vz = 0; v.sim.v = 0; } });
  await p.waitForTimeout(400);
  const ran = await p.evaluate(() => { const w = window.__rfg.app.world; return { phase: w.police.phase, rec: w.police.record.map(r => r.kind), reported: w.vehicle.car.hot.reported }; });
  if (!ran.reported || ran.phase !== 'chase' || !ran.rec.includes('gta')) throw new Error('reported plate never got run ' + JSON.stringify(ran));
  await calm();
  // Sal buys it at Rusty's, no questions asked
  const cash0 = await p.evaluate(async () => {
    const w = window.__rfg.app.world, v = w.vehicle, { LOC_BY_ID } = await import('./js/data/world.js'), l = LOC_BY_ID.rusty_used;
    v.x = l.x + 4; v.z = l.z; v.vx = v.vz = 0; v.sim.v = 0;
    return window.__rfg.game.s.cash;
  });
  await p.evaluate(async () => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); openPlace(LOC_BY_ID.rusty_used, window.__rfg.app); });
  await p.waitForSelector('.modal button:has-text("Sell it")');
  await snap('44-sal-fence');
  await p.click('.modal button:has-text("Sell it")');
  await p.waitForTimeout(200);
  const sold = await p.evaluate(ownUid => { const w = window.__rfg.app.world; return { cash: window.__rfg.game.s.cash, inCar: w.inCar, mine: w.vehicle?.car?.uid === ownUid }; }, ownUid);
  if (!(sold.cash > cash0) || sold.inCar || !sold.mine) throw new Error('Sal did not buy the stolen car ' + JSON.stringify({ cash0, ...sold }));
  // busted in a stolen car: it goes back to its owner, yours isn't towed
  await calm();
  if (!(await yank())) throw new Error('no traffic for the bust test');
  await p.waitForTimeout(100);
  await key('KeyT'); await p.waitForTimeout(1300);
  if (!(await p.evaluate(() => !!window.__rfg.app.world.vehicle?.car?.hot))) throw new Error('second carjack failed');
  await p.evaluate(() => window.__rfg.app.world.impound());
  const bust = await p.evaluate(ownUid => { const w = window.__rfg.app.world, c = window.__rfg.game.s.cars.find(c => c.uid === ownUid); return { mine: w.vehicle?.car === c, impound: !!c.impound, inCar: w.inCar }; }, ownUid);
  if (!bust.mine || bust.impound || bust.inCar) throw new Error('busted in a stolen car impounded yours ' + JSON.stringify(bust));
  // back in your own car for the steps after this one
  await calm();
  await p.evaluate(() => { const w = window.__rfg.app.world; w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; });
  await key('KeyF'); await p.waitForTimeout(200);
  if (!(await p.evaluate(() => window.__rfg.app.world.inCar))) throw new Error('could not get back in your car');
});

await step('save + reload', async () => {
  // saved while sitting in the car, so loading it back must start the engine sound
  await p.evaluate(() => { const w = window.__rfg.app.world; if (!w.inCar) { w.vehicle.vx = w.vehicle.vz = 0; w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; } });
  if (!(await p.evaluate(() => window.__rfg.app.world.inCar))) { await key('KeyF'); await p.waitForTimeout(200); }
  if (!(await p.evaluate(() => window.__rfg.app.world.inCar))) throw new Error('could not get in the car before saving');
  await p.evaluate(async () => { const { saveGame } = await import('./js/core/save.js'); saveGame('slot1'); });
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__rfg); await p.waitForTimeout(500);
  await p.click('.menu button:has-text("Continue")');
  await p.waitForTimeout(800);
  const ok = await p.evaluate(() => window.__rfg.game.s?.player.name);
  if (ok !== 'Tester') throw new Error('save did not load');
  const w = await p.evaluate(() => { const w = window.__rfg.app.world; return { inCar: w.inCar, engine: !!w.engine }; });
  if (w.inCar && !w.engine) throw new Error('loaded a save sat in the car but the engine is silent');
  if (!w.inCar) throw new Error('save made in the car loaded on foot');
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
  const db = async (pg, fn, ...a) => { const r = await pg.evaluate(async ([fn, a]) => { const { crewdb } = await import('./js/net/crewdb.js'); const s = window.__rfg.game.s; const r = await crewdb()[fn]({ uid: s.uid, tok: s.crewKey, name: s.player.name, rep: 0 }, ...a); return r ?? null; }, [fn, a]); await pg.waitForTimeout(250); return r; };
  const refresh = async pg => { await pg.evaluate(async () => (await import('./js/ui/ocrew.js')).refreshCrew({ chat: true })); await pg.waitForTimeout(250); };  // localStorage reaches other tabs a few ms late
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
  if ((await db(q, 'list')).find(g => g.tag === 'NSFT')?.open !== false) throw new Error('invite-only edit was not stored');
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
// ---------------- phone: status cards, texted missions, chat threads ----------------
await step('phone missions (text offer → stops → paid)', async () => {
  const reset = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
  await reset();
  // Rosa texts a parts run
  const o = await p.evaluate(async () => {
    const { offerMission, ensure } = await import('./js/core/missions.js');
    const s = window.__rfg.game.s, w = window.__rfg.app.world; ensure(s).active = null; ensure(s).offers = []; s.gps = null; w.gpsPath = null;
    if (w.vehicle) w.inCar = true;
    const o = offerMission(s, { force: true, kind: 'parts' });
    return { id: o.id, from: s.messages[0].from, act: s.messages[0].action };
  });
  if (o.from !== 'rosa' || o.act?.type !== 'mission') throw new Error('no mission text from Rosa ' + JSON.stringify(o));
  // home screen shows the offer + FWPD status
  await key('KeyP'); await p.waitForTimeout(250);
  const home = await p.textContent('.phone-widgets');
  if (!/FWPD status/.test(home) || !/1 offer/.test(home)) throw new Error('home status cards missing: ' + home);
  await snap('32-phone-home-cards');
  // Messages is a list of conversations; Rosa's thread has the job
  await p.click('.app:has-text("Messages")'); await p.waitForTimeout(200);
  await p.click('.convo:has-text("Rosa")'); await p.waitForTimeout(200);
  if (!(await p.$('.bubble [data-action="maccept"]'))) throw new Error('no Take the job button in the thread');
  await snap('33-messages-thread');
  await p.click('.bubble [data-action="maccept"]'); await p.waitForTimeout(200);
  let r = await p.evaluate(() => { const s = window.__rfg.game.s; return { a: s.missions.active, gps: s.gps?.label, obj: document.querySelector('[data-obj]')?.textContent || '' }; });
  if (!r.a || r.a.stage !== 0 || !/Parts run/.test(r.gps || '')) throw new Error('accepting did not start the job / set GPS ' + JSON.stringify(r));
  await p.waitForTimeout(300);
  r.obj = await p.evaluate(() => document.querySelector('[data-obj]')?.textContent || '');
  if (!/Parts run/.test(r.obj)) throw new Error('HUD does not show the mission: ' + r.obj);
  // the Missions app and the map both show it
  await key('KeyP'); await p.waitForTimeout(200);
  await p.click('.app:has-text("Missions")'); await p.waitForTimeout(200);
  if (!/On the job/.test(await p.textContent('.phone-screen'))) throw new Error('Missions app does not show the active job');
  await snap('34-missions-app');
  await reset();
  // drive to each stop: pickup, then Torque Temple
  const cash0 = await p.evaluate(() => window.__rfg.game.s.cash);
  for (let i = 0; i < 2; i++) {
    await p.evaluate(async () => {
      const { currentStop } = await import('./js/core/missions.js');
      const s = window.__rfg.game.s, w = window.__rfg.app.world, l = currentStop(s), v = w.vehicle;
      v.x = l.x; v.z = l.z; v.vx = v.vz = 0; w.cam.x = l.x; w.cam.z = l.z;
    });
    await p.waitForTimeout(300);
  }
  r = await p.evaluate(() => { const s = window.__rfg.game.s; return { a: s.missions.active, done: s.missions.done, cash: s.cash, last: s.messages[0] }; });
  if (r.a || r.done !== 1 || !(r.cash > cash0) || r.last.from !== 'rosa') throw new Error('finishing the run did not pay ' + JSON.stringify({ a: !!r.a, done: r.done, d: r.cash - cash0, from: r.last.from }));
  // a run that runs out of time fails
  await p.evaluate(async () => {
    const { offerMission, acceptMission } = await import('./js/core/missions.js');
    const s = window.__rfg.game.s, o = offerMission(s, { force: true, kind: 'ride' }); acceptMission(s, o.id, window.__rfg.app.world);
    s.missions.active.deadline = s.time.day * 1440 + s.time.min - 1;
  });
  await p.waitForTimeout(200);
  r = await p.evaluate(() => { const s = window.__rfg.game.s; return { a: !!s.missions.active, failed: s.missions.failed }; });
  if (r.a || r.failed !== 1) throw new Error('a late mission did not fail ' + JSON.stringify(r));
  await p.evaluate(() => { window.__rfg.game.s.gps = null; window.__rfg.app.world.gpsPath = null; });
});

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
    s.warrants = []; s.citations = []; s.justice.cases = []; s.cash = 50000; w.police.reset(w); w.paused = false;
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
  if (!/Evading arrest/.test(await p.textContent('.modal'))) throw new Error('the felony warrant should be booked as a charge');
  await clearModals(); await p.evaluate(() => { window.__rfg.app.world.paused = false; window.__rfg.game.s.justice.cases = []; }); await p.waitForTimeout(250);
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
  // the felony goes to court: booked with a court date
  await p.waitForSelector('.modal h2:has-text("Magistrate")');
  if (!(await p.evaluate(() => window.__rfg.game.s.justice.cases[0]?.surrender))) throw new Error('turning yourself in on a felony should file a case');
  await clearModals();
  await p.evaluate(() => { window.__rfg.game.s.justice.cases = []; });
});

// ---------------- courts: booking, bail, court date, plea / trial, jail sim, missing court ----------------
await step('courts + jail', async () => {
  await p.evaluate(() => { for (const c of window.__rfg.game.s.cars) delete c.impound; });   // an earlier arrest impounded the car
  const clear = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); window.__rfg.app.world.paused = false; });
  const J = () => p.evaluate(() => { const s = window.__rfg.game.s, w = window.__rfg.app.world; return { day: s.time.day, cases: s.justice.cases.map(c => ({ date: c.date, bond: c.bond.type, fta: c.fta, cls: c.charges.map(x => x.cls) })), conv: s.justice.convictions.length, probation: s.justice.probation, warrants: s.warrants.map(x => x.kind), inCar: w.inCar, foot: [Math.round(w.foot.x), Math.round(w.foot.z)], court: document.querySelector('[data-court]')?.className + ':' + document.querySelector('[data-court]')?.textContent }; });
  const openCourt = () => p.evaluate(async () => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); openPlace(LOC_BY_ID.courthouse, window.__rfg.app); });
  await clear();
  // 1. busted after an armed robbery: booked, the magistrate sets bail and a court date
  await p.evaluate(() => {
    const s = window.__rfg.game.s, w = window.__rfg.app.world;
    s.justice = { cases: [], convictions: [], probation: null }; s.warrants = []; s.citations = []; s.cash = 200000; s.time.min = 10 * 60;
    w.police.reset(w); s.heat = 3; w.police.startChase(w, true); w.police.eyesOn = true;
    w.police.record = [{ kind: 'robbery', text: 'Armed robbery — Amazin\' Mart.', fine: 6000 }, { kind: 'speeding', text: 'Speeding — 88 in a 45.', fine: 700 }];
    w.police.busted(w);
  });
  await p.waitForSelector('.modal h2:has-text("BUSTED")');
  if (!/Aggravated robbery/.test(await p.textContent('.modal'))) throw new Error('BUSTED modal does not list the charges');
  await p.click('.modal button:has-text("See the magistrate")');
  await p.waitForSelector('.modal h2:has-text("Magistrate")');
  const mag = await p.textContent('.modal');
  if (!/Bail is set at \$[\d,]+/.test(mag) || !/Court date: day \d+, 9:00 AM/.test(mag) || /personal bond/.test(mag)) throw new Error('magistrate modal: ' + mag.slice(0, 200));
  await snap('28-magistrate');
  const cash0 = await p.evaluate(() => window.__rfg.game.s.cash);
  await p.click('.modal button:has-text("bondsman")'); await p.waitForTimeout(300);
  let j = await J();
  if (j.cases.length !== 1 || j.cases[0].bond !== 'surety' || !j.cases[0].cls.includes('F1') || j.cases[0].cls.includes('C')) throw new Error('case not filed right: ' + JSON.stringify(j));
  if (j.inCar || Math.hypot(j.foot[0] + 75, j.foot[1] + 163) > 12) throw new Error('not released on foot at the courthouse: ' + JSON.stringify(j));
  if (/hidden/.test(j.court) || !/COURT/.test(j.court)) throw new Error('HUD does not show the court date ' + j.court);
  if ((await p.evaluate(() => window.__rfg.game.s.messages[0]?.from)) !== 'clerk') throw new Error('no notice to appear from the clerk');
  if (cash0 - (await p.evaluate(() => window.__rfg.game.s.cash)) < 7000) throw new Error('the bondsman should charge 10% of the bail');
  // 2. too early: come back on the day
  await openCourt(); await p.waitForTimeout(200);
  if (!/Your court date is/.test(await p.textContent('.panel'))) throw new Error('courthouse should say when to come back');
  await clear();
  // 3. court day: hearing, take the plea, prison, the jail sim runs the time
  await p.evaluate(() => { const s = window.__rfg.game.s; const c = s.justice.cases[0]; s.time.day = c.date.day; s.time.min = 9 * 60; });
  await p.waitForTimeout(150);
  if (!/COURT TODAY/.test((await J()).court)) throw new Error('HUD should flag court today');
  await openCourt(); await p.waitForTimeout(200);
  await snap('29-courthouse');
  await p.click('button:has-text("Check in for your hearing")');
  await p.click('.modal button:has-text("Approach the bench")');
  await p.waitForSelector('.modal h2:has-text("Plea")');
  if (!/years TDCJ/.test(await p.textContent('.modal'))) throw new Error('aggravated robbery offer should be prison');
  await snap('30-plea');
  const day0 = (await J()).day;
  await p.click('.modal button:has-text("Take the deal")');
  await p.waitForSelector('.modal h2:has-text("Sentence")');
  await p.click('.modal button:has-text("bailiff")');
  await p.waitForSelector('.jail-clock'); await p.waitForTimeout(800);
  await snap('31-jail');
  await p.click('button:has-text("Skip to release")');
  await p.click('button:has-text("Walk out")'); await p.waitForTimeout(250);
  j = await J();
  if (j.cases.length || j.conv < 2 || j.day - day0 < 5) throw new Error('prison: case closed, convictions on record, time passed ' + JSON.stringify(j));
  if (j.inCar || Math.hypot(j.foot[0] + 75, j.foot[1] + 163) > 12) throw new Error('not released at the courthouse');
  // 4. a misdemeanour with priors now: no free bond; miss court and it's a bail-jumping warrant
  await p.evaluate(() => { const w = window.__rfg.app.world; w.police.reset(w); w.onBusted(400, false, [{ kind: 'hitrun', text: 'Hit-and-run collision.', fine: 650 }]); });
  await p.click('.modal button:has-text("See the magistrate")');
  await p.waitForSelector('.modal h2:has-text("Magistrate")');
  if (/personal bond/.test(await p.textContent('.modal'))) throw new Error('felony priors should not get a personal bond');
  await p.click('.modal button:has-text("Post cash bail")'); await p.waitForTimeout(250);
  await p.evaluate(() => { const s = window.__rfg.game.s; const c = s.justice.cases[0]; s.time.day = c.date.day; s.time.min = 16 * 60 + 59; window.__rfg.ui.onHour(); s.time.min = 17 * 60 + 1; window.__rfg.ui.onHour(); });
  j = await J();
  if (!j.cases[0]?.fta || j.cases[0].bond !== 'forfeited' || !j.warrants.includes('bailjump')) throw new Error('missing court: ' + JSON.stringify(j));
  // the court warrant can't be paid off in the app
  const payable = await p.evaluate(async () => (await import('./js/core/warrants.js')).payableTotal(window.__rfg.game.s));
  if (payable) throw new Error('a court warrant should not be payable');
  // 5. turn yourself in to the court: no bail, heard today; go to trial with a public defender
  await p.evaluate(() => { const s = window.__rfg.game.s; s.time.day++; s.time.min = 10 * 60; });
  await openCourt(); await p.waitForTimeout(200);
  await snap('32-missed-court');
  await p.click('button:has-text("Turn yourself in to the court")');
  await p.click('.modal button:has-text("Turn myself in")');
  await p.click('.modal button:has-text("Approach the bench")');
  const plea = await p.waitForSelector('.modal h2:has-text("Plea"), .modal h2:has-text("Case dismissed")');
  if (/Plea/.test(await plea.textContent())) {
    await p.click('.modal button:has-text("Trial with a public defender")');
    await p.waitForSelector('.modal h2:has-text("Verdict")');
    await p.click('.modal button');
    await p.waitForSelector('.modal h2:has-text("Sentence"), .modal h2:has-text("Not guilty")');
    await p.click('.modal button');
    if (await p.isVisible('.jail-clock')) { await p.click('button:has-text("Skip to release")'); await p.click('button:has-text("Walk out")'); }
  } else await p.click('.modal button');
  await p.waitForTimeout(250);
  j = await J();
  if (j.cases.length || j.warrants.length) throw new Error('court case should be over: ' + JSON.stringify(j));
  // 6. the record shows in the FWPD app
  await clear();
  await p.evaluate(() => window.__rfg.ui.openPhone('fwpd')); await p.waitForTimeout(250);
  if (!/Criminal history/.test(await p.textContent('.phone-screen'))) throw new Error('FWPD app should show the criminal history');
  await clear();
  await p.evaluate(() => { const s = window.__rfg.game.s; s.justice = { cases: [], convictions: [], probation: null }; s.warrants = []; });
});

// ---------------- drugs, trap houses, land you build on ----------------
await step('plug + trap house + SWAT + land', async () => {
  const clear = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); const w = window.__rfg.app.world; w.paused = false; w.knocking = false; });
  const place = id => p.evaluate(async id => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); openPlace(LOC_BY_ID[id], window.__rfg.app); }, id);
  await clear();
  await p.evaluate(() => { const s = window.__rfg.game.s, w = window.__rfg.app.world; w.police.reset(w); s.heat = 0; s.cash = 2e6; s.rep = 40000; s.time.min = 13 * 60; s.justice = { cases: [], convictions: [], probation: null }; s.warrants = []; for (const c of s.cars) delete c.impound; });
  // Bayline Realty: a trap house and a lot
  await place('bayline');
  await p.click('.tabs button:has-text("Trap houses")'); await p.click('[data-action=buy][data-id=trap_stopsix]'); await p.click('.modal button:has-text("Buy")');
  await p.click('.tabs button:has-text("Land")'); await p.click('[data-action=buyland][data-id=land_stopsix]'); await p.click('.modal button:has-text("Buy")');
  await snap('estate-realty');
  await clear();
  // the plug
  await place('plug');
  await p.click('[data-action=buy][data-id=percs][data-n="5"]');
  await snap('estate-plug');
  if (await p.evaluate(() => window.__rfg.game.s.drugs.bag.percs) !== 5) throw new Error('bought nothing from the plug');
  await clear();
  // stand in the trap house: a customer knocks, you serve them
  await p.evaluate(() => { const w = window.__rfg.app.world, g = w.map.garages.find(g => g.id === 'trap_stopsix'); w.inCar = false; w.foot.x = g.center.x; w.foot.z = g.center.z; w.knockT = 0.5; });
  await p.waitForSelector('.modal:has-text("Knock knock")', { timeout: 15000 });
  await snap('estate-knock');
  const cash0 = await p.evaluate(() => window.__rfg.game.s.cash);
  await p.click('.modal button:has-text("Serve")'); await p.waitForTimeout(200);
  const after = await p.evaluate(() => ({ cash: window.__rfg.game.s.cash, sold: window.__rfg.game.s.drugs.sold }));
  if (!(after.cash > cash0) || after.sold < 1) throw new Error('serving a customer paid nothing ' + JSON.stringify(after));
  await clear();
  // SWAT: get down, booked on delivery
  await p.evaluate(async () => { const { raid } = await import('./js/world2d/trap.js'); raid(window.__rfg.app.world, 'trap_stopsix'); });
  await p.waitForSelector('.modal:has-text("SWAT RAID")'); await snap('estate-swat');
  await p.click('.modal button:has-text("Get on the ground")'); await p.waitForTimeout(250);
  const j = await p.evaluate(() => ({ cases: window.__rfg.game.s.justice.cases.map(c => c.charges.map(x => x.cls + ' ' + x.text)), closed: window.__rfg.game.s.estate.traps.trap_stopsix.closed }));
  if (!j.cases.length || !/delivery/i.test(j.cases[0].join())) throw new Error('raid did not file a delivery case ' + JSON.stringify(j));
  if (!(j.closed > 0)) throw new Error('raided house is not boarded up');
  await clear();
  await p.evaluate(() => { const s = window.__rfg.game.s; s.justice = { cases: [], convictions: [], probation: null }; s.warrants = []; for (const c of s.cars) delete c.impound; });
  // land: build a house, skip ahead, it stands on the map with a garage
  await place('land_stopsix');
  await p.click('[data-action=build][data-id=starter]'); await p.click('.modal button:has-text("Break ground")');
  await clear();
  await p.evaluate(() => { window.__rfg.game.s.time.day += 2; });
  await p.waitForFunction(() => window.__rfg.app.world.map.garages.some(g => g.id === 'land_stopsix'), null, { timeout: 5000 });
  await p.evaluate(() => { const w = window.__rfg.app.world, g = w.map.garages.find(g => g.id === 'land_stopsix'); w.foot.x = g.park.x; w.foot.z = g.park.z; });
  await p.waitForTimeout(400); await snap('estate-built');
  await clear();
});

// ---------------- traffic stop: 10 s to pull over, officer walks up, drive off = chase ----------------
await step('traffic stop: pull over, walk-up, drive off', async () => {
  await p.evaluate(() => { for (const c of window.__rfg.game.s.cars) delete c.impound; });   // an earlier arrest impounded the car
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

// ---------------- ski mask + blackout fit: buy, pull down, rob unseen, get stopped ----------------
await step('ski mask + blackout fit', async () => {
  await p.evaluate(() => { for (const c of window.__rfg.game.s.cars) delete c.impound; });   // an earlier arrest impounded the car
  const clearModals = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
  await p.evaluate(async () => {
    const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js');
    const s = window.__rfg.game.s, w = window.__rfg.app.world;
    s.cash = 50000; s.warrants = []; s.citations = []; w.police.reset(w);
    if (w.inCar) { w.vehicle.vx = w.vehicle.vz = 0; w.toggleCar(); }
    if (w.inCar) throw new Error('could not get out of the car');
    openPlace(LOC_BY_ID.surplus, window.__rfg.app);
  });
  await p.waitForTimeout(250);
  if (!/Riverside Army Surplus/.test(await p.textContent('.p-head')) || !/Vortex Black Ski Mask/.test(await p.textContent('.p-body'))) throw new Error('surplus store does not sell the ski mask');
  if (/Leather Racing Jacket/.test(await p.textContent('.p-body'))) throw new Error('surplus store shows Threadline stock');
  await p.click('button:has-text("Buy the fit")'); await p.waitForTimeout(200);
  let look = await p.evaluate(() => ({ ...window.__rfg.game.s.player.look, owned: window.__rfg.game.s.player.outfits }));
  if (!look.owned.includes('skimask_black') || look.top !== 'fleece_black' || look.shoes !== 'kicks_blackout' || look.mask === 'skimask_black') throw new Error('blackout fit not bought/worn right ' + JSON.stringify(look));
  await snap('28-surplus');
  await clearModals(); await p.evaluate(() => { window.__rfg.app.world.paused = false; });
  // V pulls the mask down; the HUD says how recognisable you are
  await key('KeyV'); await p.waitForTimeout(300);
  const tag = await p.evaluate(() => ({ mask: window.__rfg.game.s.player.look.mask, tag: document.querySelector('[data-disguise]')?.className + ':' + document.querySelector('[data-disguise]')?.textContent }));
  if (tag.mask !== 'skimask_black' || /hidden/.test(tag.tag) || !/MASKED/.test(tag.tag)) throw new Error('mask toggle / HUD tag ' + JSON.stringify(tag));
  await snap('29-masked');
  // a masked robbery the witness can't ID: no robbery warrant; the same robbery unmasked: warrant
  const rob = await p.evaluate(() => {
    const s = window.__rfg.game.s, w = window.__rfg.app.world, r0 = Math.random;
    const go = () => { w.police.reset(w); s.heat = 1.5; w.police.startChase(w, true); w.police.dispatchRobbery(w, { name: 'Gas-N-Go', x: w.foot.x, z: w.foot.z }); w.police.escaped(w); return s.warrants.map(x => x.kind); };
    Math.random = () => 0.4;
    try {
      w.police.disguise = 0.8; const masked = go(); s.warrants = [];
      w.police.disguise = 0; const bare = go(); s.warrants = [];
      return { masked, bare };
    } finally { Math.random = r0; w.police.reset(w); }
  });
  if (rob.masked.includes('robbery') || !rob.bare.includes('robbery')) throw new Error('mask should keep a robbery off your record ' + JSON.stringify(rob));
  // a patrol watching a masked person walk around stops them and the mask comes off
  await p.evaluate(() => {
    const w = window.__rfg.app.world, s = window.__rfg.game.s;
    s.player.look.mask = 'skimask_black'; w.police.maskStopAt = -99; w.police.maskSus = 0;
    const fake = { x: w.foot.x + 6, z: w.foot.z, police: true, id: 31 };
    w.police.patrols.push(fake);
    for (let i = 0; i < 6 && s.player.look.mask !== 'no_mask'; i++) w.police.maskWatch(1, w, s.player.look);
    w.police.patrols = w.police.patrols.filter(c => c !== fake);
  });
  await p.waitForSelector('.modal h2:has-text("Stopped and questioned")');
  if ((await p.evaluate(() => window.__rfg.game.s.player.look.mask)) !== 'no_mask') throw new Error('mask stop did not take the mask off');
  await clearModals(); await p.evaluate(() => { const w = window.__rfg.app.world; w.police.reset(w); w.paused = false; });
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

// ---------------- Vega Kustoms design studio + weekend car show ----------------
await step('kustoms studio + car show', async () => {
  const clear = () => p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
  await clear();
  await p.evaluate(async () => {
    const { newCar } = await import('./js/core/state.js'); const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js');
    const r = window.__rfg, s = r.game.s; const c = newCar('honda_civic_ex_1996'); s.cars.push(c); s.activeCar = c.uid; s.cash = 60000; r.app.world.refreshCar();
    openPlace(LOC_BY_ID.vega_kustoms, r.app);
  });
  await p.click('[data-action="studio"]');
  await p.waitForSelector('.ks [data-side]');
  const score0 = +(await p.textContent('.ks-score b'));
  // try on a color, rims and a widebody: nothing is charged until you build it
  const cash0 = await p.evaluate(() => window.__rfg.game.s.cash);
  await p.click('.ks-pick [data-action="paint"][data-c="#6b2bd1"]');
  await p.click('.tabs button[data-id="rims"]'); await p.click('.ks-pick .ks-rim >> nth=27'); await p.click('.ks-pick [data-action="wsize"][data-n="18"]');
  await p.click('.tabs button[data-id="kit"]'); await p.click('.ks-pick .ks-opt:has-text("Pandem")');
  await p.click('.tabs button[data-id="tint"]'); await p.click('.ks-pick .ks-opt:has-text("LLumar")');
  const mid = await p.evaluate(() => ({ cash: window.__rfg.game.s.cash, paint: window.__rfg.game.s.cars.find(c => c.uid === window.__rfg.game.s.activeCar).visual.paint }));
  if (mid.cash !== cash0 || mid.paint === '#6b2bd1') throw new Error('trying parts on should not charge or change the car');
  const score1 = +(await p.textContent('.ks-score b'));
  if (!(score1 > score0 + 20)) throw new Error(`the show score should climb with the build (${score0} -> ${score1})`);
  if (!/Respray|Basecoat|Wrap|Kandy|Metallic/i.test(await p.textContent('.ks-cart'))) throw new Error('a new color should add a respray to the bill');
  await snap('30-kustoms-studio');
  await p.click('[data-action="book"]'); await p.click('.modal button:has-text("Pay & build")'); await p.waitForTimeout(150);
  const after = await p.evaluate(() => { const s = window.__rfg.game.s, v = s.cars.find(c => c.uid === s.activeCar).visual; return { cash: s.cash, paint: v.paint, kit: v.kit, tint: v.tint, size: v.wheelSize, rim: v.rim }; });
  if (after.rim !== 'gw27' || after.paint !== '#6b2bd1' || after.kit !== 'wide' || after.tint !== 'medium' || after.size !== '18' || !(after.cash < cash0 - 6000)) throw new Error('build did not land: ' + JSON.stringify(after));
  await clear();
  // the show only runs on weekends
  await p.evaluate(async () => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); const s = window.__rfg.game.s; s.time.day = 10; s.time.min = 12 * 60; openPlace(LOC_BY_ID.stockyards_show, window.__rfg.app); });
  await p.waitForSelector('.modal h2:has-text("Stockyards Car Show")');
  if (!/Saturday and Sunday/.test(await p.textContent('.modal-body'))) throw new Error('weekday visit should give the show times');
  await clear();
  await p.evaluate(async () => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); const s = window.__rfg.game.s; s.time.day = 13; s.time.min = 12 * 60; openPlace(LOC_BY_ID.stockyards_show, window.__rfg.app); });
  await p.click('[data-action="enter"]');
  await p.waitForSelector('.cs-lineup canvas');
  await snap('31-car-show-lineup');
  await p.click('[data-action="vote"] >> nth=0');
  await p.waitForSelector('.cs-place', { timeout: 8000 });
  await snap('32-car-show-results');
  const res = await p.evaluate(() => { const s = window.__rfg.game.s; return { day: s.shows?.day, entered: s.shows?.entered, votes: [...document.querySelectorAll('[data-v]')].reduce((a, n) => a + +n.textContent, 0) }; });
  if (res.day !== 13 || res.entered !== 1 || res.votes !== 241) throw new Error('car show did not run: ' + JSON.stringify(res));
  await clear();
  await p.evaluate(async () => { const { openPlace } = await import('./js/ui/places.js'); const { LOC_BY_ID } = await import('./js/data/world.js'); openPlace(LOC_BY_ID.stockyards_show, window.__rfg.app); });
  if (!/already showed today/.test(await p.textContent('.modal-body'))) throw new Error('one show per day');
  await clear();
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
  await p.click('button[data-action="tab"][data-id="jobs"]');   // opens on Shifts
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

// ---------------- dirty money: bank, washing it, the feds ----------------
await step('bank: dirty cash, CTRs, washing through a business', async () => {
  await p.setViewportSize({ width: 844, height: 390 });   // iPhone landscape
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const { earn } = await import('./js/core/state.js');
    const s = window.__rfg.game.s;
    s.feds = null; s.wash = {}; s.rep = Math.max(s.rep, 2000);
    s.hustle.biz.laundromat = { level: 1, since: s.time.day };
    earn(s, 30000, 'Trap money', { dirty: true });
    const { openPhone } = await import('./js/ui/phone.js'); openPhone('bank', window.__rfg.app);
  });
  await p.waitForTimeout(250);
  const stats = await p.textContent('[data-bank-stats]');
  if (!/Dirty cash/.test(stats) || !/30,000/.test(stats)) throw new Error('bank does not show the dirty cash: ' + stats);
  await snap('27b-bank');
  // deposit $12,000 of it: a CTR gets filed and the feds notice
  await p.click('button[data-action="depd"]');
  await p.fill('.modal input', '12000'); await p.click('.modal [data-ok]');
  await p.waitForTimeout(200);
  const f = await p.evaluate(() => ({ ...window.__rfg.game.s.feds, dirty: window.__rfg.game.s.dirty }));
  if (f.ctrs !== 1 || !(f.heat > 0)) throw new Error('no CTR on a $12,000 dirty deposit: ' + JSON.stringify(f));
  // the rest goes into the laundromat's books
  await p.click('button[data-action="tab"][data-id="wash"]');
  await p.click('button[data-action="drop"][data-id="laundromat"]');
  await p.fill('.modal input', '18000'); await p.click('.modal [data-ok]');
  await p.waitForTimeout(200);
  await snap('27c-wash');
  const bank0 = await p.evaluate(() => window.__rfg.game.s.bank);
  await p.evaluate(async () => { const B = await import('./js/core/bank.js'); const s = window.__rfg.game.s; s.time.day += 1; B.fedsDay(s); });
  const after = await p.evaluate(() => ({ bank: window.__rfg.game.s.bank, q: window.__rfg.game.s.wash.laundromat.queue, dirty: window.__rfg.game.s.dirty }));
  if (after.bank - bank0 !== 3400 || after.q !== 14000 || after.dirty !== 0) throw new Error('washing did not pay out: ' + JSON.stringify(after));
  await p.click('button[data-action="tab"][data-id="feds"]');
  await p.waitForTimeout(150);
  if (!(await p.$('[data-fed-stage]'))) throw new Error('no federal attention screen');
  await snap('27d-feds');
  // nothing on screen spills off a phone
  const wide = await p.evaluate(() => { const b = document.querySelector('.phone-screen'); return b.scrollWidth - b.clientWidth; });
  if (wide > 2) throw new Error('bank app scrolls sideways on a phone: ' + wide);
  await p.keyboard.press('Escape');
  await p.evaluate(() => { const s = window.__rfg.game.s; s.feds = null; s.wash = {}; delete s.hustle.biz.laundromat; });
  await p.setViewportSize({ width: 1280, height: 760 });
});

// ---------------- gig shifts: delivery runs, Ryde riders, tow calls ----------------
await step('gig shifts (delivery, ride, tow)', async () => {
  const W = 'window.__rfg.app.world';
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const s = window.__rfg.game.s, w = window.__rfg.app.world;
    s.warrants = []; s.heat = 0; w.police.reset?.(w); s.gigs = null;
    if (!w.inCar) { w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; w.toggleCar(); }
    const { openPhone } = await import('./js/ui/phone.js'); openPhone('hustle', window.__rfg.app);
  });
  await p.waitForTimeout(250);
  await snap('27-shifts');
  if ((await p.$$('button[data-action="gig"]:not([disabled])')).length !== 3) throw new Error('no shifts to start: ' + await p.textContent('.app-body'));
  const park = (x, z) => p.evaluate(([x, z]) => { const w = window.__rfg.app.world, v = w.vehicle; v.x = x; v.z = z; v.vx = v.vz = 0; v.sim.v = 0; w.cam.x = x; w.cam.z = z; }, [x, z]);
  const job = () => p.evaluate(() => { const g = window.__rfg.app.world.gigs, j = g.job; return j && { stage: j.stage, left: j.left, pick: j.pickup, drop: j.drop, quoted: j.quoted, tow: g.towCar && { x: g.towCar.x, z: g.towCar.z, hooked: g.towCar.hooked }, rider: g.rider && { in: !!g.rider.in } }; });
  const money = () => p.evaluate(() => window.__rfg.game.s.bank + window.__rfg.game.s.cash);
  // delivery: pick up at the diner, the clock starts, drop at the door
  await p.click('button[data-action="gig"][data-id="delivery"]');
  await p.waitForTimeout(200);
  let j = await job();
  if (!j || j.stage !== 'pickup' || !/Pick up the order/.test(j.pick.label)) throw new Error('delivery did not start ' + JSON.stringify(j));
  if (!(await p.evaluate(() => !!window.__rfg.game.s.gps?.gig))) throw new Error('no GPS to the pickup');
  if (!/Slice Brothers/.test(await p.textContent('[data-gig]'))) throw new Error('no shift box on the HUD');
  await park(j.pick.x, j.pick.z); await p.waitForTimeout(1700);
  j = await job();
  if (j?.stage !== 'drop' || !(j.left > 0)) throw new Error('order not picked up ' + JSON.stringify(j));
  await snap('28-delivery');
  let m0 = await money();
  await park(j.drop.x, j.drop.z); await p.waitForTimeout(1500);
  if (await job()) throw new Error('delivery not finished');
  let st = await p.evaluate(() => window.__rfg.game.s.gigs);
  if (!(await money() > m0) || st.streak !== 1 || st.done !== 1) throw new Error('delivery not paid ' + JSON.stringify(st));
  // ride: the rider walks to the car and gets in
  const r = await p.evaluate(() => window.__rfg.app.world.gigs.start('ride'));
  if (!r.ok) throw new Error('ride: ' + r.text);
  j = await job();
  await park(j.pick.x + 4, j.pick.z); await p.waitForTimeout(3500);
  j = await job();
  if (j?.stage !== 'drop' || !j.rider?.in) throw new Error('rider did not get in ' + JSON.stringify(j));
  m0 = await money();
  await park(j.drop.x, j.drop.z); await p.waitForTimeout(1300);
  if (await job()) throw new Error('ride not finished');
  if (!(await money() > m0)) throw new Error('ride not paid');
  // tow: stop next to the broken-down car, it hooks on and follows you to the yard
  const t = await p.evaluate(() => window.__rfg.app.world.gigs.start('tow'));
  if (!t.ok) throw new Error('tow: ' + t.text);
  j = await job();
  await park(j.tow.x + 3, j.tow.z + 3); await p.waitForTimeout(2600);
  j = await job();
  if (j?.stage !== 'drop' || !j.tow?.hooked) throw new Error('tow not hooked ' + JSON.stringify(j));
  await park(j.tow.x + 30, j.tow.z); await p.waitForTimeout(300);
  const gap = await p.evaluate(() => { const w = window.__rfg.app.world, c = w.gigs.towCar, v = w.vehicle; return Math.hypot(c.x - v.x, c.z - v.z); });
  if (!(gap > 3 && gap < 9)) throw new Error('towed car is not trailing behind: ' + gap);
  await snap('29-tow');
  m0 = await money();
  await park(j.drop.x, j.drop.z); await p.waitForTimeout(1500);
  if (await job()) throw new Error('tow not finished');
  st = await p.evaluate(() => window.__rfg.game.s.gigs);
  if (!(await money() > m0) || st.streak !== 3) throw new Error('tow not paid ' + JSON.stringify(st));
  // stay legit: a warrant keeps you off the schedule, an arrest suspends you and wipes the streak
  const why = await p.evaluate(async () => { const { addWarrant } = await import('./js/core/warrants.js'); const s = window.__rfg.game.s; addWarrant(s, { kind: 'fta', text: 'Failure to appear', fine: 300 }); const r = window.__rfg.app.world.gigs.start('delivery'); s.warrants = []; return r; });
  if (why.ok || !/warrant/.test(why.text)) throw new Error('a warrant did not block the shift: ' + why.text);
  const sus = await p.evaluate(async () => { const w = window.__rfg.app.world; w.gigs.start('delivery'); const { emit } = await import('./js/core/events.js'); window.__rfg.game.s.stats.busted++; emit('busted', { fine: 500 }); w.gigs.update(0.016); return { job: !!w.gigs.job, g: window.__rfg.game.s.gigs, why: w.gigs.blocked() }; });
  if (sus.job || sus.g.streak !== 0 || !/Suspended/.test(sus.why || '')) throw new Error('an arrest did not suspend you ' + JSON.stringify(sus));
  await p.evaluate(() => { window.__rfg.game.s.gigs.suspended = 0; const w = window.__rfg.app.world, v = w.vehicle; v.vx = v.vz = 0; v.sim.v = 0; if (w.inCar) w.toggleCar(); });   // back on foot for the next step
});

// ---------------- crew turf: claim open hoods, turf wars, defending, street tax ----------------
await step('crew turf', async () => {
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const s = window.__rfg.game.s;
    s.crew = { name: 'Night Shift', color: '#2a7bff', logo: 'N', rep: 0, members: [], npcCrew: null };
    const { openPhone } = await import('./js/ui/phone.js'); openPhone('turf', window.__rfg.app);
  });
  await p.waitForTimeout(250);
  await snap('27-turf');
  if (!(await p.$('.phone svg[aria-label="Turf map"]'))) throw new Error('no turf map');
  if ((await p.$$('[data-hood]')).length !== 10) throw new Error('expected 10 neighborhoods');
  if (!(await p.$('[data-hood="Stop Six"] button[data-action="claim"]'))) throw new Error('Stop Six is not open to claim');
  if (!(await p.isVisible('[data-hood="Stockyards"]:has-text("Iron Saints")'))) throw new Error('Stockyards should start as Iron Saints turf');
  // Claim: set the GPS, then rep the hood by driving in it
  await p.click('[data-hood="Stop Six"] button[data-action="claim"]');
  if (!/Stop Six/.test(await p.evaluate(() => window.__rfg.game.s.gps?.label || ''))) throw new Error('claim did not set GPS');
  // the real thing: sitting in your car in Stop Six builds the claim, and the HUD says so
  const pos = await p.evaluate(() => { const w = window.__rfg.app.world; w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; return { x: w.vehicle.x, z: w.vehicle.z }; });
  await p.waitForTimeout(150); await key('KeyF'); await p.waitForTimeout(200);
  await p.evaluate(() => { const v = window.__rfg.app.world.vehicle; v.x = 1700; v.z = -400; v.vx = v.vz = v.speed = 0; });
  await p.waitForTimeout(1600);
  const live = await p.evaluate(() => ({ inCar: window.__rfg.app.world.inCar, claim: window.__rfg.game.s.turf.hoods['Stop Six'].claim, hud: document.querySelector('[data-hud="place"], .hud-place')?.textContent || '' }));
  console.log('     turf live', JSON.stringify(live));
  if (!live.inCar || !(live.claim > 0)) throw new Error('driving in Stop Six did not build the claim');
  if (!/Stop Six · claiming/.test(live.hud)) throw new Error('HUD does not show the claim: ' + live.hud);
  await p.evaluate(({ x, z }) => { const v = window.__rfg.app.world.vehicle; v.x = x; v.z = z; window.__rfg.game.s.turf.hoods['Stop Six'].claim = 0; }, pos);
  const r = await p.evaluate(async () => {
    const T = await import('./js/core/turf.js'); const s = window.__rfg.game.s, out = {};
    T.presence(s, { x: 1700, z: -400, inCar: true }, 10);
    out.part = s.turf.hoods['Stop Six'].claim;
    out.label = T.turfLabel(s, 1700, -400);
    T.presence(s, { x: 1700, z: -400, inCar: true }, 60);
    out.owner = s.turf.hoods['Stop Six'].owner;
    out.label2 = T.turfLabel(s, 1700, -400);
    // on foot doesn't count
    T.presence(s, { x: -1500, z: 450, inCar: false }, 60);
    out.foot = s.turf.hoods['Benbrook Hills'].claim;
    // turf war on Arlington Heights (Velvet Ghosts): two wins break their hold
    out.block = T.warBlocked(s, 'Arlington Heights');
    out.start = T.startWar(s, 'Arlington Heights');
    const w = s.turf.war; out.war = !!w;
    out.msg = s.messages[0]?.action?.challenge?.turf;
    const { emit } = await import('./js/core/events.js');
    emit('raceFinished', { won: true, npcId: w.npcId, wager: 0, type: 'roll', dist: 'half' });
    out.hold = s.turf.hoods['Arlington Heights'].hold;
    emit('raceFinished', { won: true, npcId: s.turf.war.npcId, wager: 0, type: 'roll', dist: 'half' });
    out.ah = s.turf.hoods['Arlington Heights'].owner;
    // a rival moves on Stop Six and you lose the race: it's theirs
    const a = T.attack(s, 'Stop Six'); out.attacker = a?.crew;
    emit('raceFinished', { won: false, npcId: a.npcId, wager: 0, type: 'roll', dist: 'half' });
    out.lost = s.turf.hoods['Stop Six'].owner;
    // the morning take: Arlington Heights pays its street tax
    const money0 = s.cash + s.bank; s.time.day += 1; T.catchUp(s); out.take = s.cash + s.bank - money0;
    return out;
  });
  console.log('     turf', JSON.stringify(r));
  if (!(r.part > 0 && r.part < 100) || !/claiming/.test(r.label)) throw new Error('claim progress not tracked');
  if (r.owner !== 'me' || r.label2 !== 'your turf') throw new Error('Stop Six not claimed');
  if (r.foot !== 0) throw new Error('claimed on foot');
  if (r.block || r.start || !r.war || r.msg !== 'Arlington Heights') throw new Error('turf war did not start: ' + r.block + r.start);
  if (r.hold !== 50 || r.ah !== 'me') throw new Error('turf war wins did not take the hood');
  if (!r.attacker || r.lost !== r.attacker) throw new Error('losing the defense did not lose the hood');
  if (r.take !== 700) throw new Error('street tax wrong: ' + r.take);
  // the app shows it all
  await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); const { openPhone } = await import('./js/ui/phone.js'); openPhone('turf', window.__rfg.app); });
  await p.waitForTimeout(200);
  await snap('28-turf-held');
  if (!(await p.$('[data-hood="Arlington Heights"] .tag-green'))) throw new Error('Arlington Heights not shown as yours');
  // leaving the crew gives your turf up
  const after = await p.evaluate(async () => { const T = await import('./js/core/turf.js'); const s = window.__rfg.game.s; s.crew = null; T.ensureTurf(s); return s.turf.hoods['Arlington Heights'].owner; });
  if (after !== null) throw new Error('turf kept after leaving the crew');
  await p.keyboard.press('Escape');
});

// ---------------- gangs: jumped in, homies, rival corners, a hit, a drive-by, getting slid on ----------------
await step('gangs', async () => {
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const w = window.__rfg.app.world, s = window.__rfg.game.s;
    if (w.inCar) w.toggleCar();
    w.police.reset(w); s.warrants = [];
    s.gang = undefined; s.arms.hp = 100; s.time.min = 12 * 60;
    w.foot.x = -450; w.foot.z = -450;
    const { openPhone } = await import('./js/ui/phone.js'); openPhone('gang', window.__rfg.app);
  });
  await p.waitForTimeout(250);
  await snap('29-gangs');
  if ((await p.$$('[data-gang]')).length !== 5) throw new Error('expected 5 sets');
  await p.click('[data-gang="six_block"] [data-action="jump"]');
  await p.click('.modal-back .btn-primary');
  await p.waitForTimeout(200);
  await snap('30-gang-member');
  const joined = await p.evaluate(() => ({ set: window.__rfg.game.s.gang.set, hp: window.__rfg.game.s.arms.hp }));
  if (joined.set !== 'six_block' || joined.hp > 60) throw new Error('jumping in did not work ' + JSON.stringify(joined));
  await p.keyboard.press('Escape'); await p.evaluate(async () => { const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); });
  // the homie follows you around
  await p.waitForTimeout(500);
  const homie = await p.evaluate(() => { const w = window.__rfg.app.world, h = w.gangs.homies[0]; return h && { friend: h.friend, d: Math.hypot(h.x - w.foot.x, h.z - w.foot.z), inPeds: w.traffic.peds.includes(h) }; });
  if (!homie || !homie.friend || homie.d > 6 || !homie.inPeds) throw new Error('no homie riding with you ' + JSON.stringify(homie));
  // walk up on Hemphill (Six Block's rivals): they open up, your homie shoots back
  await p.evaluate(() => { const w = window.__rfg.app.world, c = w.gangs.corners.hemphill; w.foot.x = c.x + c.ax * 12; w.foot.z = c.z + c.az * 12; w.combat.arms.hp = 100; w.combat.arms.armor = 1; });
  await p.waitForTimeout(3500);
  await snap('31-gang-shootout');
  const fight = await p.evaluate(() => { const w = window.__rfg.app.world, set = w.gangs.sets.hemphill; return { peds: set?.peds.length, enemy: set && !set.peds[0].friend, shots: w.gangs.shots || 0, hp: w.combat.arms.hp, armor: w.combat.arms.armor }; });
  console.log('     gang fight', JSON.stringify(fight));
  if (fight.peds !== 4 || !fight.enemy) throw new Error('Hemphill corner did not post up');
  if (!(fight.shots >= 3)) throw new Error('nobody shot: ' + fight.shots);
  // the hit: drop their people, get paid
  const hit = await p.evaluate(async () => {
    const G = await import('./js/core/gangs.js'); const w = window.__rfg.app.world, s = window.__rfg.game.s;
    w.police.reset(w);
    s.gang.job = { ...G.makeJob(s, 'hit', 'hemphill'), deadline: 1e9 };
    s.gang.job.got = 0;
    const cash = s.cash, respect = s.gang.respect;
    for (const pd of w.gangs.sets.hemphill.peds) if (!pd.down) w.combat.hurtPed(pd, 100);
    await new Promise(r => setTimeout(r, 300));
    return { job: s.gang.job, paid: s.cash - cash, respect: s.gang.respect - respect, beef: s.gang.beef.hemphill };
  });
  console.log('     gang hit', JSON.stringify({ ...hit, job: !!hit.job }));
  if (hit.job || !(hit.paid >= 700) || !(hit.respect >= 80)) throw new Error('the hit did not pay off');
  // a drive-by on the Rydaz: sit in the car next to their corner, the homie hangs out the window
  await p.evaluate(() => { const w = window.__rfg.app.world; w.police.reset(w); w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; w.combat.arms.hp = 100; });
  await p.waitForTimeout(150); await key('KeyF'); await p.waitForTimeout(200);
  const db = await p.evaluate(async () => {
    const G = await import('./js/core/gangs.js'); const w = window.__rfg.app.world, s = window.__rfg.game.s;
    s.gang.job = { ...G.makeJob(s, 'driveby', 'riverside'), deadline: 1e9 };
    const c = w.gangs.corners.riverside, v = w.vehicle;
    v.x = c.x + c.az * 7; v.z = c.z - c.ax * 7; v.vx = v.vz = v.speed = 0;
    const shots = w.gangs.shots || 0;
    await new Promise(r => setTimeout(r, 2500));
    return { inCar: w.inCar, set: !!w.gangs.sets.riverside, shots: (w.gangs.shots || 0) - shots, got: s.gang.job?.got ?? 'done', down: w.gangs.sets.riverside?.peds.filter(q => q.down).length, heat: w.police.level, phase: w.police.phase };
  });
  console.log('     drive-by', JSON.stringify(db));
  if (!db.inCar || !db.set || !(db.shots >= 2)) throw new Error('no drive-by from the car');
  // getting slid on: a Hemphill car comes down your street
  await snap('32-drive-by');
  const slid = await p.evaluate(async () => {
    const w = window.__rfg.app.world, s = window.__rfg.game.s;
    w.toggleCar(); w.police.reset(w);
    w.foot.x = -450 + 10; w.foot.z = -375;
    s.gang.hit = { gang: 'hemphill', at: 0 };
    await new Promise(r => setTimeout(r, 400));
    const car = w.gangs.hitCar;
    return { car: !!car, color: car?.color, d: car && Math.hypot(car.x - w.foot.x, car.z - w.foot.z), pending: !!s.gang.hit };
  });
  console.log('     slid on', JSON.stringify(slid));
  if (!slid.car || slid.pending || !(slid.d < 100)) throw new Error('the rival hit car never came');
  await p.evaluate(async () => {
    const w = window.__rfg.app.world, s = window.__rfg.game.s, { openPhone } = await import('./js/ui/phone.js');
    openPhone('gang', window.__rfg.app);
  });
  await p.waitForTimeout(200);
  await snap('33-gang-app');
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels();
    const w = window.__rfg.app.world, s = window.__rfg.game.s;
    s.gang = undefined; w.gangs.hitCar = null; w.police.reset(w); s.warrants = []; w.combat.arms.hp = 100;
    w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; if (!w.inCar) w.toggleCar();   // later steps expect you back in the car
  });
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
  // button layout editor: drag the gas pedal somewhere else and make it bigger, save, reset
  {
    await m.evaluate(async () => { const { openSettings } = await import('./js/ui/menu.js'); openSettings(window.__rfg.app); });
    await m.tap('text=Edit button layout');
    expect(await m.evaluate(() => document.getElementById('touch').classList.contains('editing')), 'layout editor did not open');
    const before = await m.evaluate(() => { const r = document.querySelector('#touch .tc-gas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
    await fire('#touch .tc-gas', 'pointerdown', 3);
    const pressed = await m.evaluate(() => document.querySelector('#touch .tc-gas').classList.contains('on'));
    await m.evaluate(() => { const t = document.getElementById('touch'); t.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 3, pointerType: 'touch', clientX: 150, clientY: 400 })); t.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3, pointerType: 'touch', clientX: 150, clientY: 400 })); });
    await m.evaluate(() => { const r = document.querySelector('[data-esize]'); r.value = '1.3'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await m.tap('#touch [data-eact="save"]');
    const after = await m.evaluate(() => { const r = document.querySelector('#touch .tc-gas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, saved: JSON.parse(localStorage.getItem('rollforglory.settings')).touchLayout, editing: document.getElementById('touch').classList.contains('editing') }; });
    console.log('     layout editor', JSON.stringify({ before, after }));
    expect(!pressed, 'dragging in the editor pressed the gas');
    expect(!after.editing, 'editor did not close on Save');
    expect(Math.abs(after.x - before.x) > 40 && after.w > before.w * 1.2, 'gas pedal did not move / grow');
    expect(after.saved && Object.values(after.saved)[0]?.gas?.s === 1.3, 'layout not saved');
    await m.evaluate(() => window.__rfg.app && document.querySelector('#panels .panel') && import('./js/ui/dom.js').then(d => d.closeAllPanels()));
    await m.evaluate(async () => { const { touchUi } = await import('./js/ui/touch.js'); touchUi.edit(); });
    await m.tap('#touch [data-eact="reset"]'); await m.tap('#touch [data-eact="save"]');
    const reset = await m.evaluate(() => { const r = document.querySelector('#touch .tc-gas').getBoundingClientRect(); return { x: r.left, w: r.width }; });
    expect(Math.abs(reset.x - before.x) < 2 && Math.abs(reset.w - before.w) < 2, 'Reset did not put the gas pedal back');
  }
  await mctx.close();
});

// ---------------- third-person (chase) camera ----------------
await step('JPS hospital: crash out, shot down, bills, injuries', async () => {
  const reset = () => p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
  });
  await reset();
  // crash out: a 100 mph hit into a wall
  const before = await p.evaluate(() => {
    const r = window.__rfg, w = r.app.world, s = r.game.s; w.paused = false; w.police.reset(w); w.police.patrols.length = 0;
    s.warrants = []; s.citations = []; s.health = undefined; s.cash = 200; s.bank = 1000; s.insurance = false; w.combat.arms.hp = 100; w.downed = false;
    if (!w.inCar) w.toggleCar();
    w.lastCrashT = -9; w.onCrash(45, 'wall');
    return { day: s.time.day, min: s.time.min };
  });
  await p.waitForSelector('.jps-panel [data-action="skip"]');
  await snap('41-jps-stay');
  await p.click('.jps-panel [data-action="skip"]');
  await p.click('.jps-panel [data-action="out"]');
  await p.waitForSelector('.modal-back button:has-text("JPS Connection")');
  await snap('42-jps-discharge');
  await p.click('.modal-back button:has-text("JPS Connection")');
  await p.click('.modal-back button:has-text("Pay in full")');
  await p.waitForTimeout(150);
  const a = await p.evaluate(async () => {
    const r = window.__rfg, w = r.app.world, s = r.game.s, { LOC_BY_ID } = await import('./js/data/world.js'), H = await import('./js/core/health.js');
    const l = LOC_BY_ID.jps, b = s.health.bills[0];
    return { inCar: w.inCar, downed: w.downed, d: Math.hypot(w.foot.x - l.x, w.foot.z - l.z), inj: s.health.injuries.map(j => j.kind), status: b.status, conn: b.connection, total: b.total, day: s.time.day, min: s.time.min, hp: w.combat.arms.hp, cap: H.healthMods(s).cap, modal: !!document.querySelector('.modal-back') };
  });
  if (a.inCar || a.downed || a.d > 8) throw new Error('did not wake up on foot at JPS ' + JSON.stringify(a));
  if (!a.inj.length || a.status !== 'paid' || !a.conn) throw new Error('crash injuries / JPS Connection bill ' + JSON.stringify(a));
  if ((a.day - before.day) * 1440 + a.min - before.min < 6 * 60) throw new Error('the stay did not cost any time ' + JSON.stringify([before, a]));
  if (a.hp > a.cap || a.modal) throw new Error('health over the injury cap, or a modal left open ' + JSON.stringify(a));
  // shot down on foot, with a bill you leave for later; the HUD shows the injury
  await p.evaluate(() => { const w = window.__rfg.app.world; w.combat.arms.hp = 5; w.combat.arms.armor = 0; w.combat.hurt(40, 'Test shooter'); });
  await p.click('.jps-panel [data-action="skip"]');
  await p.click('.jps-panel [data-action="out"]');
  await p.click('.modal-back button:has-text("Bill me later")');
  await p.waitForTimeout(250);
  const b = await p.evaluate(() => { const s = window.__rfg.game.s; return { bills: s.health.bills.length, open: s.health.bills[0].status, msg: s.messages[0]?.from, hud: document.querySelector('[data-injury]')?.textContent, hidden: document.querySelector('[data-injury]')?.classList.contains('hidden') }; });
  if (b.bills !== 2 || b.open !== 'open' || b.msg !== 'jps') throw new Error('shot: bill for later + statement text ' + JSON.stringify(b));
  if (b.hidden || !/·/.test(b.hud || '')) throw new Error('HUD does not show the injury ' + JSON.stringify(b));
  // the hospital: urgent care + a follow-up visit
  await p.evaluate(async () => { const r = window.__rfg, { LOC_BY_ID } = await import('./js/data/world.js'); r.game.s.cash = 5000; window.__rfg.app.world.combat.arms.hp = 10; const { openPlace } = await import('./js/ui/places.js'); openPlace(LOC_BY_ID.jps, r.app); });
  await p.waitForSelector('.jps-panel [data-action="follow"]');
  await snap('43-jps-hospital');
  const left0 = await p.evaluate(() => window.__rfg.game.s.health.injuries[0].left);
  await p.click('.jps-panel [data-action="follow"]');
  await p.click('.jps-panel [data-action="urgent"]');
  const c = await p.evaluate(async () => { const s = window.__rfg.game.s, H = await import('./js/core/health.js'); return { j: s.health.injuries[0], hp: window.__rfg.app.world.combat.arms.hp, cap: H.healthMods(s).cap }; });
  if (!c.j.followUp || c.j.left > left0 / 2 + 1 || c.hp !== c.cap) throw new Error('follow-up / urgent care ' + JSON.stringify({ c, left0 }));
  await reset();
  // the phone app
  await p.evaluate(async () => { window.__rfg.game.s.cash = 50000; const { openPhone } = await import('./js/ui/phone.js'); openPhone('jps', window.__rfg.app); });
  await p.waitForSelector('.warrant-status:has-text("OWED")');
  await snap('44-jps-app');
  await p.click('.phone [data-action="pay"]');
  const d = await p.evaluate(async () => (await import('./js/core/health.js')).medicalDebt(window.__rfg.game.s));
  if (d !== 0) throw new Error('paying in the app left a balance ' + d);
  await reset();
  // back in the car for the next step
  await p.evaluate(() => { const w = window.__rfg.app.world, s = window.__rfg.game.s; s.health = undefined; w.combat.arms.hp = 100; w.foot.x = w.vehicle.x + 2; w.foot.z = w.vehicle.z; if (!w.inCar) w.toggleCar(); });
});

await step('third-person camera', async () => {
  await p.evaluate(async () => {
    const { closeAllPanels } = await import('./js/ui/dom.js'); closeAllPanels(); document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const r = window.__rfg, w = r.app.world; w.paused = false; try { w.police.reset(w); } catch {} w.police.patrols.length = 0;
    if (!w.inCar) w.toggleCar();
    const v = w.vehicle; v.x = 0; v.z = 150; v.vx = 0; v.vz = 0; v.sim.v = 0; v.h = 1.0; v.yawRate = 0; w.cam.x = 0; w.cam.z = 150;
  });
  await p.keyboard.press('KeyV'); await p.waitForTimeout(1800);
  const a = await p.evaluate(async () => { const w = window.__rfg.app.world; const { settings } = await import('./js/core/save.js'); return { mode: settings.camMode, rot: w.cam.rot, h: w.vehicle.h, inCar: w.inCar }; });
  if (a.mode !== 'chase') throw new Error('V did not switch to the third-person camera ' + JSON.stringify(a));
  const d = Math.atan2(Math.sin(a.rot + a.h), Math.cos(a.rot + a.h));
  if (Math.abs(d) > 0.08) throw new Error('camera is not behind the car ' + JSON.stringify(a));
  // no empty corners while the world is turned
  const px = await p.evaluate(() => { const c = [...document.querySelectorAll('canvas')].sort((x, y) => y.width * y.height - x.width * x.height)[0]; const g = c.getContext('2d'); const out = []; for (const [x, y] of [[3, 3], [c.width - 4, 3], [3, c.height - 4], [c.width - 4, c.height - 4]]) { const d = g.getImageData(x, y, 1, 1).data; out.push(d[0] + d[1] + d[2] + (255 - d[3])); } return out; });
  if (px.some(v => v === 0)) throw new Error('empty corner in the rotated view ' + JSON.stringify(px));
  await snap('40-chase-cam');
  // turn the car: the camera follows
  await p.evaluate(() => { const v = window.__rfg.app.world.vehicle; v.h = 2.4; });
  await p.waitForTimeout(1500);
  const b = await p.evaluate(() => { const w = window.__rfg.app.world; return { rot: w.cam.rot, h: w.vehicle.h }; });
  if (Math.abs(Math.atan2(Math.sin(b.rot + b.h), Math.cos(b.rot + b.h))) > 0.1) throw new Error('camera did not follow the turn ' + JSON.stringify(b));
  // back to top-down
  await p.keyboard.press('KeyV'); await p.waitForTimeout(1800);
  const c = await p.evaluate(() => window.__rfg.app.world.cam.rot);
  if (Math.abs(c) > 0.05) throw new Error('top-down camera did not level out ' + c);
});

console.log(errs.length ? '\nERRORS:\n' + errs.join('\n') : '\nno errors');
await b.close();
process.exit(errs.length ? 1 : 0);
