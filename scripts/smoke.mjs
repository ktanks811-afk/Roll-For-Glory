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
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
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
  await p.click('text=Place order');
  await p.click('.modal button');
  await p.keyboard.press('Escape');
  // deliver + install at a shop
  await p.evaluate(() => { const s = window.__rfg.game.s; s.time.day += 1; window.__rfg.ui.onMorning(); });
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
await step('save + reload', async () => {
  await p.evaluate(async () => { const { saveGame } = await import('./js/core/save.js'); saveGame('slot1'); });
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__rfg); await p.waitForTimeout(500);
  await p.click('.menu button:has-text("Continue")');
  await p.waitForTimeout(800);
  const ok = await p.evaluate(() => window.__rfg.game.s?.player.name);
  if (ok !== 'Tester') throw new Error('save did not load');
});
console.log(errs.length ? '\nERRORS:\n' + errs.join('\n') : '\nno errors');
await b.close();
process.exit(errs.length ? 1 : 0);
