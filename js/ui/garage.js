// Garage: car overview, installed parts, install from the parts bin (DIY at
// home or paid labor at a shop), dyno, tuning and the car collection.

import { BREAKDOWNS, needsOil, oilInterval } from '../core/upkeep.js';
import { openPanel, bind, esc, toast, modal, confirm, prompt, bar } from './dom.js';
import { game, fmtMoney, spend, earn, activeCar, carSpec, carMetrics, carValue, modelOf, levels, uid, carMpg, tankGallons, getCar } from '../core/state.js';
import { ITEM_BY_ID, CATEGORY_NAMES, fits, fitNote, LABOR_RATE } from '../data/catalog.js';
import { PERF, partLabel, FX, PAINT_SWATCHES, WHEEL_COLORS, NITROUS_REFILL, partLevels } from '../data/parts.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { buildSpec, dynoCurve, metrics, MPH } from '../sim/powertrain.js';
import { launchRpmSetting } from '../sim/twostep.js';
import { tuneSchema, tuneValue, PRESETS } from '../sim/tuning.js';
import { openPartProfile } from './partProfile.js';
import { drawSideCar } from '../gfx2d/sideCar.js';
import { shapeOf } from '../data/carShapes.js';
import { soundProfile, noiseDb, LEGAL_DB } from '../sim/sound.js';
import { emit } from '../core/events.js';
import { drawThumb, sellCar } from './marketplace.js';
import { PROPERTIES, LOC_BY_ID } from '../data/world.js';
import { audio } from '../core/audio.js';
import { ui } from '../main.js';

const SHOP_ONLY = new Set(['paint', 'kit', 'interior']);

// mode: 'home' | 'perf' | 'visual' | 'readOnly'
export function openGarage(app, opts = {}) {
  const st = { tab: opts.tab || 'overview', mode: opts.mode || 'readOnly', carUid: game.s.activeCar };
  return openPanel((root, h) => render(root, h, app, st));
}

export function advanceTime(s, minutes) {
  let left = minutes;
  while (left > 0) {
    const step = Math.min(left, 60 - (s.time.min % 60) || 60);
    const beforeHour = Math.floor(s.time.min / 60);
    s.time.min += step; left -= step;
    if (s.time.min >= 1440) { s.time.min -= 1440; s.time.day++; ui.onNewDay(); }
    const h = Math.floor(s.time.min / 60);
    if (h !== beforeHour) { ui.onHour(); if (h === 8) ui.onMorning(); }
  }
}

export async function pickColorFor(p) {
  if (!['paint', 'wheels', 'decal'].includes(p.cat) || p.rim) return undefined;
  const list = p.cat === 'wheels' ? WHEEL_COLORS : PAINT_SWATCHES;
  return new Promise(resolve => {
    const id = 'c' + Math.random().toString(36).slice(2);
    const html = `<p>${p.cat === 'paint' ? `Pick a color for the ${esc(p.name)}.` : p.cat === 'wheels' ? 'Wheel finish:' : 'Graphics color:'}</p>
      <div class="opts" id="${id}">${list.map(c => `<span class="swatch" style="background:${c}" data-c="${c}"></span>`).join('')}</div>
      <label class="field" style="margin-top:10px"><span>Custom</span><input type="color" id="${id}x" value="${p.color || list[0]}" class="input" style="height:42px;padding:2px"></label>`;
    let chosen = p.color || list[0];
    modal('Choose color', html, [{ label: 'Cancel', value: null }, { label: 'Use this color', primary: true, value: 'ok' }]).then(v => resolve(v === 'ok' ? chosen : null));
    setTimeout(() => {
      const box = document.getElementById(id), cust = document.getElementById(id + 'x');
      box?.querySelectorAll('.swatch').forEach(sw => sw.onclick = () => { chosen = sw.dataset.c; box.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', x === sw)); cust.value = chosen; });
      if (cust) cust.oninput = () => { chosen = cust.value; };
    }, 0);
  });
}

export function installPart(s, car, pid, { color, app } = {}) {
  const p = ITEM_BY_ID[pid];
  if (p.visual) {
    if (p.cat === 'paint') { car.visual.finish = p.value; if (color) car.visual.paint = color; }
    else if (p.cat === 'wheels') { car.visual.wheels = p.value; car.visual.rim = p.rim || null; car.visual.wheelColor = p.rim ? p.color : color || p.color; }
    else car.visual[p.cat] = p.value;
    if (p.cat === 'decal' && color) car.visual.decalColor = color;
  } else {
    const old = car.parts[p.cat];
    if (typeof old === 'string' && old) s.partsBin.push({ pid: old, uid: uid('b') });
    car.parts[p.cat] = pid;
    const other = p.cat === 'turbo' ? 'supercharger' : p.cat === 'supercharger' ? 'turbo' : null;
    if (other && car.parts[other]) {
      if (typeof car.parts[other] === 'string') s.partsBin.push({ pid: car.parts[other], uid: uid('b') });
      car.parts[other] = null;
      toast(`Removed the ${other} — you can't run both`, 'info');
    }
    if (p.cat === 'nitrous') car.nos = FX.nitrous.secs[p.stage];
    if (p.cat === 'tires') car.cond.tires = 100;
  }
  audio.buy();
  emit('partInstalled', { pid, cat: p.cat });
  app?.world?.refreshCar();
  toast(`Installed: ${p.brand} ${p.name}`, 'good');
  // warn straight away if the build is now hurting the motor
  if (!p.visual) {
    const sp = carSpec(car), lvl = sp.engineLevel;
    if (lvl && (lvl.id === 'high' || lvl.id === 'danger')) setTimeout(() => toast(`⚠ Engine reliability: ${lvl.label}. Needs: ${(sp.engineReasons || []).map(r => r.fix).join(', ')}`, 'bad'), 400);
  }
}

function render(root, h, app, st) {
  const s = game.s;
  const car = getCar(s, st.carUid) || activeCar(s) || s.cars[0];
  const titleByMode = { home: 'Home Garage', perf: 'Torque Temple — Service Bay', visual: 'Vega Kustoms — Booth', readOnly: 'Garage' };
  if (!car) {
    root.innerHTML = `<div class="p-head"><h1>${titleByMode[st.mode]}</h1><button class="btn x" data-action="close">×</button></div><div class="p-body"><div class="empty">You don't own a car yet.<br>Open <b>Marketplace</b> on your phone (P) to find a cheap first car.</div></div>`;
    bind(root, { close: () => h.close() });
    return;
  }
  st.carUid = car.uid;
  const m = modelOf(car);
  const tabs = [['overview', 'Overview'], ['parts', 'Performance'], ['install', `Install (${s.partsBin.length})`], ['looks', 'Looks'], ['showroom', 'Showroom'], ['dyno', 'Dyno'], ['tune', 'Tune'], ['collection', `Cars (${s.cars.length})`]];
  root.innerHTML = `<div class="p-head"><h1>${esc(carName(m, car.year))}<small>${titleByMode[st.mode]}${st.mode === 'readOnly' ? ' · view only — go home or to a shop to work on it' : ''}</small></h1><button class="btn x" data-action="close">×</button></div>
    <div class="tabs">${tabs.map(([id, l]) => `<button class="${st.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${l}</button>`).join('')}</div>
    <div class="p-body" data-body></div>`;
  bind(root.querySelector('.p-head'), { close: () => h.close() });
  bind(root.querySelector('.tabs'), { tab: d => { st.tab = d.id; h.refresh(); } });
  const body = root.querySelector('[data-body]');
  ({ overview, parts, install, looks, showroom, dyno, tune, collection })[st.tab](body, h, app, st, s, car, m);
}

function overview(body, h, app, st, s, car, m) {
  const spec = carSpec(car), mt = carMetrics(car);
  const stock = metrics(buildSpec(m, {}, {}));
  const delta = (a, b, lowerBetter) => { if (a == null || b == null) return ''; const d = a - b; if (Math.abs(d) < 0.005) return ''; const good = lowerBetter ? d < 0 : d > 0; return `<small class="${good ? 'good' : 'bad'}"> ${d > 0 ? '+' : ''}${d.toFixed(2)}</small>`; };
  body.innerHTML = `<div class="garage"><div>
      <div class="garage-view"><canvas width="640" height="360" data-car></canvas></div>
      <div class="stats-row" style="margin-top:10px">
        <div><div class="stat-lbl">Class</div><div class="pi"><b>${mt.cls}</b>${mt.pi}</div></div>
        <div><div class="stat-lbl">Power</div><div class="stat-big">${spec.hp}<small style="font-size:14px"> hp</small></div></div>
        <div><div class="stat-lbl">Torque</div><div class="stat-big">${spec.tq}<small style="font-size:14px"> lb-ft</small></div></div>
        <div><div class="stat-lbl">Weight</div><div class="stat-big">${Math.round(spec.mass * 2.2046).toLocaleString()}<small style="font-size:14px"> lb</small></div></div>
      </div>
      <div class="stats-row" style="margin-top:8px">
        <div><div class="stat-lbl">0-60</div><b>${mt.zero60?.toFixed(2)}s</b>${delta(mt.zero60, stock.zero60, true)}</div>
        <div><div class="stat-lbl">1/4 mile</div><b>${mt.quarter?.toFixed(2)}s @ ${Math.round(mt.quarterTrap)}</b>${delta(mt.quarter, stock.quarter, true)}</div>
        <div><div class="stat-lbl">1/2 mile</div><b>${mt.half?.toFixed(2)}s @ ${Math.round(mt.halfTrap)}</b></div>
        <div><div class="stat-lbl">Top speed</div><b>${Math.round(mt.topSpeed)} mph</b></div>
      </div></div>
    <div>
      <div class="kv">
        <span>Engine</span><span>${esc(m.engine)}</span><span>Transmission</span><span>${esc(m.trans)}</span><span>Drivetrain</span><span>${m.drive}</span>
        <span>Aspiration</span><span>${{ na: 'Naturally aspirated', turbo: 'Turbocharged', sc: 'Supercharged', ev: 'Electric' }[spec.asp]}</span>
        <span>Exhaust noise</span><span>${(() => { const db = noiseDb(m, car.parts); return `${Math.round(db)} dB at full throttle · ${db > LEGAL_DB ? '<b class="bad">over the 95 dB street limit — expect tickets</b>' : 'street legal'}`; })()}</span>
        <span>Redline</span><span>${spec.asp === 'ev' ? '—' : spec.redline.toLocaleString() + ' rpm'}</span>
        ${spec.asp === 'ev' ? '' : `<span>Engine</span><span class="click-row" data-action="engine">${car.engineBlown ? '<b class="bad">💥 BLOWN — needs a rebuild</b>' : `<b style="color:${spec.engineLevel.color}">${esc(spec.engineLevel.label)}</b> · health ${Math.round(car.cond.engine)}%`} <i class="pp-i">i</i></span>`}
        <span>Odometer</span><span>${Math.round(car.miles).toLocaleString()} mi</span><span>Title</span><span class="${car.title !== 'Clean' ? 'bad' : ''}">${car.title}</span>
        <span>Fuel economy</span><span>${carMpg(car).toFixed(0)} ${m.asp === 'ev' ? 'MPGe' : 'mpg'}</span>
        <span>Fuel</span><span>${(car.fuel * tankGallons(car)).toFixed(1)} / ${tankGallons(car)} ${m.asp === 'ev' ? 'kWh' : 'gal'}</span>
        ${spec.nosSecs ? `<span>Nitrous</span><span>${(car.nos ?? 0).toFixed(1)} / ${spec.nosSecs}s</span>` : ''}
        <span>Market value</span><span>${fmtMoney(carValue(car))}</span><span>Paid</span><span>${fmtMoney(car.paid || 0)}</span>
        <span>Record</span><span>${car.stats.wins}W – ${car.stats.losses}L${car.stats.bestEt ? ` · best ${car.stats.bestEt.toFixed(3)}s` : ''}</span>
      </div>
      ${spec.fuelLimited ? '<p class="warn small">⚠ Fuel-limited: your injectors/pump can\'t feed this much boost. Upgrade the fuel system.</p>' : ''}
      <div class="section-title">Condition</div>
      ${car.broken ? `<p class="bad small">🛠 <b>${esc(BREAKDOWNS[car.broken]?.name || 'Broken down')}.</b> ${esc(BREAKDOWNS[car.broken]?.text || '')} Bank → Roadside on your phone.</p>` : ''}
      ${needsOil(car) ? `<div class="cond"><span>Oil life</span>${bar(car.oil ?? 100, (car.oil ?? 100) < 20 ? 'red' : (car.oil ?? 100) < 45 ? 'yellow' : 'green')}<span>${Math.round(car.oil ?? 100)}%</span></div>` : ''}
      ${['engine', 'trans', 'body', 'tires', 'lights'].map(k => `<div class="cond"><span>${{ engine: 'Engine', trans: 'Transmission', body: 'Body', tires: 'Tires', lights: 'Lights' }[k]}</span>${bar(car.cond[k], car.cond[k] < 40 ? 'red' : car.cond[k] < 70 ? 'yellow' : 'green')}<span>${Math.round(car.cond[k])}%</span></div>`).join('')}
      <p class="small muted">Repairs: Second Chance Collision. Oil changes: any gas station${needsOil(car) ? `, every ~${oilInterval(spec)} mi on this build` : ''}. Old oil wears the engine; worn engines and gearboxes break down. Tires wear with every mile and bald ones blow out.</p>
      ${spec.nosSecs && st.mode !== 'readOnly' && st.mode !== 'visual' ? `<button class="btn btn-sm" data-action="refill" ${car.nos >= spec.nosSecs ? 'disabled' : ''}>Refill nitrous bottle (${fmtMoney(NITROUS_REFILL)})</button>` : ''}
    </div></div>`;
  drawThumb(body.querySelector('[data-car]'), m, car.visual, car.parts, car.cond);
  bind(body, { engine: () => openPartProfile({ cat: 'engine', car }), refill: () => { if (spend(s, NITROUS_REFILL, 'Nitrous refill')) { car.nos = carSpec(car).nosSecs; app.world?.refreshCar(); h.refresh(); } } });
}

function parts(body, h, app, st, s, car, m) {
  const canWork = st.mode === 'home' || st.mode === 'perf';
  body.innerHTML = `<div class="list">${PERF.map(p => {
    const v = car.parts[p.id];
    const it = typeof v === 'string' ? ITEM_BY_ID[v] : null;
    const lvl = partLevels(car.parts)[p.id];
    return `<div class="li click-row" data-action="profile" data-cat="${p.id}"><div style="width:130px" class="muted small">${p.name} <i class="pp-i">i</i></div><div class="grow"><div class="t">${esc(partLabel(car.parts, p.id))}</div><div class="s">${lvl ? `<span class="stage stage-${lvl}">STAGE ${lvl}</span>` : 'Factory'}</div></div>
      ${it && canWork ? `<button class="btn btn-sm" data-action="remove" data-cat="${p.id}">Remove${st.mode === 'perf' ? ` (${fmtMoney(it.labor * LABOR_RATE * 0.6)})` : ''}</button>` : ''}</div>`;
  }).join('')}</div>
  <p class="small muted">Removed parts go back in your parts bin. Buy more on PartsHub (phone) — ${canWork ? 'install them in the Install tab.' : 'install at home or at Torque Temple.'}</p>`;
  bind(body, {
    profile: d => openPartProfile({ cat: d.cat, car }),
    remove: async d => {
      const it = ITEM_BY_ID[car.parts[d.cat]];
      if (st.mode === 'home' && it.labor > 6) { modal('Too big a job', `<p>Pulling the ${esc(it.name)} is a ${it.labor}-hour job that needs a lift. Take it to Torque Temple.</p>`); return; }
      if (st.mode === 'perf' && !spend(s, it.labor * LABOR_RATE * 0.6, `Labor: remove ${it.name}`)) return;
      if (st.mode === 'home') advanceTime(s, it.labor * 60 * 0.6);
      s.partsBin.push({ pid: car.parts[d.cat], uid: uid('b') });
      car.parts[d.cat] = null;
      app.world?.refreshCar();
      h.refresh();
    },
  });
}

function install(body, h, app, st, s, car, m) {
  const mode = st.mode;
  body.innerHTML = s.partsBin.length ? `<div class="list">${s.partsBin.map(b => {
    const p = ITEM_BY_ID[b.pid];
    const ok = fits(p, m);
    const shopOnly = SHOP_ONLY.has(p.cat) || p.labor > 6;
    const allowed = ok && (mode === 'perf' && !p.visual || mode === 'visual' && p.visual || mode === 'perf' && p.visual && !SHOP_ONLY.has(p.cat) || mode === 'home' && !shopOnly);
    const why = !ok ? fitNote(p, m) : mode === 'readOnly' ? 'Go home or to a shop to install' : mode === 'home' && shopOnly ? (SHOP_ONLY.has(p.cat) ? 'Needs a paint/body shop (Vega Kustoms)' : `${p.labor}h job — needs a lift (Torque Temple)`) : !allowed ? (p.visual ? 'Vega Kustoms installs this' : 'Torque Temple installs this') : '';
    const cost = mode === 'home' ? `DIY · ${p.labor}h of your time` : `${fmtMoney(p.labor * LABOR_RATE)} labor`;
    return `<div class="li click-row" data-action="profile" data-id="${p.id}"><div class="grow"><div class="t">${esc(p.brand)} ${esc(p.name)} <i class="pp-i">i</i></div><div class="s">${CATEGORY_NAMES[p.cat]}${p.visual ? '' : ` · Stage ${p.stage}`} · ${why ? `<span class="bad">${esc(why)}</span>` : cost}</div></div>
      <button class="btn btn-sm btn-primary" data-action="inst" data-uid="${b.uid}" ${allowed && mode !== 'readOnly' ? '' : 'disabled'}>Install</button>
      <button class="btn btn-sm" data-action="sell" data-uid="${b.uid}" title="Sell used">Sell ${fmtMoney(p.price * 0.45)}</button></div>`;
  }).join('')}</div>` : '<div class="empty">Your parts bin is empty. Order parts on PartsHub — they arrive at home the next morning.</div>';
  bind(body, {
    profile: d => openPartProfile({ pid: d.id, car }),
    inst: async d => {
      const b = s.partsBin.find(x => x.uid === d.uid);
      const p = ITEM_BY_ID[b.pid];
      const color = await pickColorFor(p);
      if (color === null) return;
      if (mode === 'home') {
        if (!(await confirm('Install it yourself?', `<p>${esc(p.name)} — about ${p.labor} hours in the carport.</p>`, 'Get to work'))) return;
        advanceTime(s, p.labor * 60);
      } else if (!spend(s, p.labor * LABOR_RATE, `Labor: ${p.name}`)) return;
      s.partsBin = s.partsBin.filter(x => x !== b);
      installPart(s, car, p.id, { color, app });
      h.refresh();
    },
    sell: async d => {
      const b = s.partsBin.find(x => x.uid === d.uid);
      const p = ITEM_BY_ID[b.pid];
      if (!(await confirm('Sell used part?', `<p>Sell your ${esc(p.brand)} ${esc(p.name)} for ${fmtMoney(p.price * 0.45)}?</p>`, 'Sell'))) return;
      s.partsBin = s.partsBin.filter(x => x !== b);
      earn(s, p.price * 0.45, `Sold used ${p.name}`);
      h.refresh();
    },
  });
}

function looks(body, h, app, st, s, car, m) {
  const v = car.visual;
  const rows = [['Paint', `${v.finish} <span class="swatch" style="width:16px;height:16px;vertical-align:middle;background:${v.paint}"></span>`], ['Wheels', `${v.wheels} <span class="swatch" style="width:16px;height:16px;vertical-align:middle;background:${v.wheelColor}"></span>`], ['Tint', v.tint], ['Body kit', v.kit], ['Front', v.frontBumper], ['Rear', v.rearBumper], ['Skirts', v.skirts], ['Spoiler', v.spoiler], ['Hood', v.hood], ['Exhaust tips', v.exhaustTips], ['Headlights', v.headlights], ['Taillights', v.taillights], ['Graphics', v.decal], ['Underglow', v.neon === 'none' ? 'none' : `<span class="swatch" style="width:16px;height:16px;vertical-align:middle;background:${v.neon}"></span>`], ['Interior', `<span class="swatch" style="width:16px;height:16px;vertical-align:middle;background:${v.interior}"></span>`], ['Plate', esc(v.plate)]];
  body.innerHTML = `<div class="garage"><div class="garage-view"><canvas width="640" height="360" data-car></canvas></div><div>
    <div class="kv">${rows.map(([k, val]) => `<span>${k}</span><span style="text-transform:capitalize">${val}</span>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn btn-sm" data-action="plate">Custom plate ($75 DMV fee)</button>
    ${st.mode === 'visual' ? '<button class="btn btn-sm btn-primary" data-action="shop">Browse paint, wheels & body</button>' : ''}</div>
    <p class="small muted">Visual parts come from PartsHub or the Vega Kustoms counter. Paint, wraps, body kits and interiors need Vega Kustoms; bolt-ons (wheels, lights, wings, tint) you can do at home.</p></div></div>`;
  drawThumb(body.querySelector('[data-car]'), m, car.visual, car.parts, car.cond);
  bind(body, {
    plate: async () => {
      const t = await prompt('Custom plate', '<p>Up to 7 characters. Keep it clean, the DMV reads these.</p>', 'ROLL4G', v.plate);
      if (!t) return;
      const clean = t.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 7);
      if (!clean) return;
      if (!spend(s, 75, 'DMV personalized plate')) return;
      v.plate = clean; app.world?.refreshCar(); h.refresh();
    },
    shop: async () => { const { openPartsHub } = await import('./partshub.js'); openPartsHub(app, { store: 'visual' }); },
  });
}

// ---------------- showroom: side-view car built from layers (every car) ----------------
function showroom(body, h, app, st, s, car, m) {
  const v = car.visual, lv = levels(car);
  const can = st.mode !== 'readOnly';
  st.layers ??= {};
  const swatch = c => `<span class="swatch" style="width:14px;height:14px;vertical-align:middle;background:${c}"></span>`;
  const part = id => { const it = ITEM_BY_ID[car.parts?.[id]]; return it ? `${it.brand} ${it.name}` : 'Stock'; };
  const nameOf = (k, val) => (!val || val === 'none' || val === 'stock') ? 'Stock' : esc(String(val));
  const rows = [
    ['body', 'Base body', esc(carName(m, car.year)), null],
    ['paint', 'Paint / material', `${esc(v.finish)} ${swatch(v.paint)}`, 'paint'],
    ['wheels', 'Front wheels', `${esc(v.wheels)} ${swatch(v.wheelColor)} ${v.wheelSize || shapeOf(m).rim || 19}"`, 'wheels'],
    ['wheels', 'Rear wheels', `${esc(v.wheels)} ${swatch(v.wheelColor)} ${v.wheelSize || shapeOf(m).rim || 19}"`, 'wheels'],
    ['calipers', 'Brake calipers', `${['Stock grey', 'Grey', 'Red', 'Yellow', 'Orange'][Math.min(4, lv.brakes || 0)]} · ${esc(part('brakes'))}`, 'brakes'],
    ['exhaust', 'Exhaust', `${esc(part('exhaust'))} · ${esc(v.exhaustTips)} tips`, 'exhaust'],
    ['spoiler', 'Spoiler', nameOf('spoiler', v.spoiler), 'spoiler'],
    ['front', 'Front bumper', nameOf('f', v.frontBumper), 'frontBumper'],
    ['rear', 'Rear bumper', nameOf('r', v.rearBumper), 'rearBumper'],
    ['skirts', 'Side skirts', nameOf('s', v.skirts), 'skirts'],
    ['lights', 'Headlights / taillights', `${esc(v.headlights)} / ${esc(v.taillights)}`, 'headlights'],
    ['windows', 'Windows / tint', nameOf('t', v.tint), 'tint'],
    ['hood', 'Hood', nameOf('h', v.hood), 'hood'],
    ['suspension', 'Suspension / ride height', `${esc(part('suspension'))}${lv.suspension ? ` · −${[0, 9, 16, 22, 26][Math.min(4, lv.suspension)] * 0.4 | 0} mm` : ''}`, 'suspension'],
    ['engine', 'Engine upgrades', `Engine S${lv.engine || 0} · ${lv.turbo ? 'turbo S' + lv.turbo + ' · ' : ''}${lv.supercharger ? 'supercharger S' + lv.supercharger + ' · ' : ''}ECU S${lv.ecu || 0}`, 'engine'],
    ['decals', 'Decals / livery', nameOf('d', v.decal), 'decal'],
    ['underglow', 'Underglow', v.neon && v.neon !== 'none' ? swatch(v.neon) : 'None', 'neon'],
  ];
  const layerKey = k => k === 'calipers' ? 'wheels' : k;
  body.innerHTML = `<div class="showroom"><div class="sr-stage"><canvas data-side></canvas></div>
    <div class="row" style="gap:8px;margin:10px 0;flex-wrap:wrap">
      <button class="btn btn-sm ${st.engineView ? 'btn-primary' : ''}" data-action="engine">${st.engineView ? '🔧 Close the hood' : '🔧 Open the hood'}</button>
      <span class="small muted">Wheel size</span>${[17, 18, 19, 20, 21, 22].map(n => `<button class="btn btn-sm ${(+v.wheelSize || shapeOf(m).rim || 19) === n ? 'btn-primary' : ''}" data-action="wsize" data-n="${n}" ${can ? '' : 'disabled'}>${n}"</button>`).join('')}
      <span class="small muted">Offset</span>${['stock', 'flush', 'poke'].map(o => `<button class="btn btn-sm ${(v.offset || 'flush') === o ? 'btn-primary' : ''}" data-action="offset" data-o="${o}" ${can ? '' : 'disabled'}>${o}</button>`).join('')}
    </div>
    <p class="small muted">Wheel size and offset are a $180 wheel-and-tire fitting each time. Tick a layer to show or hide it; Change opens the parts shop for that part.</p>
    <div class="list">${rows.map(([key, label, val, cat], i) => `<div class="li"><label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer"><input type="checkbox" data-layer="${layerKey(key)}" ${st.layers[layerKey(key)] === false ? '' : 'checked'}><span class="grow"><span class="t">${label}</span><br><span class="s">${val}</span></span></label>
      ${cat ? `<button class="btn btn-sm" data-action="change" data-cat="${cat}">Change</button>` : ''}</div>`).join('')}</div></div>`;
  const cv = body.querySelector('[data-side]');
  const draw = () => drawSideCar(cv, { model: m, visual: car.visual, levels: levels(car), cond: car.cond, showEngine: !!st.engineView, layers: st.layers });
  draw();
  body.querySelectorAll('[data-layer]').forEach(cb => cb.onchange = () => { st.layers[cb.dataset.layer] = cb.checked; draw(); });
  const fit = async (what, apply) => { if (!spend(s, 180, 'Wheel & tire fitting')) return; apply(); app.world?.refreshCar(); h.refresh(); };
  bind(body, {
    engine: () => { st.engineView = !st.engineView; h.refresh(); },
    wsize: d => { if ((+v.wheelSize || shapeOf(m).rim || 19) !== +d.n) fit('size', () => { v.wheelSize = String(d.n); }); },
    offset: d => { if ((v.offset || 'flush') !== d.o) fit('offset', () => { v.offset = d.o; }); },
    change: async d => { const { openPartsHub } = await import('./partshub.js'); openPartsHub(app, { cat: d.cat }); },
  });
}

function dyno(body, h, app, st, s, car, m) {
  const spec = carSpec(car);
  const stockSpec = buildSpec(m, {}, {});
  body.innerHTML = `<div class="dyno"><div class="row" style="margin-bottom:8px"><b class="grow">Chassis dyno — ${esc(carName(m, car.year))}</b><button class="btn btn-primary btn-sm" data-action="run">Run a pull</button></div>
    <canvas width="900" height="420" data-dyno></canvas>
    <div class="stats-row" style="margin-top:8px"><div><div class="stat-lbl">Peak power</div><b data-p>—</b></div><div><div class="stat-lbl">Peak torque</div><b data-t>—</b></div><div><div class="stat-lbl">Stock</div><b>${stockSpec.hp} hp / ${stockSpec.tq} lb-ft</b></div><div><div class="stat-lbl">Gain</div><b class="good">+${spec.hp - stockSpec.hp} hp</b></div></div>
    <p class="small muted">Crank figures. Grey lines are the factory curve. ${spec.asp === 'turbo' ? 'Note the turbo spooling up — bigger turbos make more top end and arrive later.' : spec.asp === 'ev' ? 'Electric motors make full torque from zero rpm.' : ''}</p></div>`;
  const cv = body.querySelector('[data-dyno]');
  drawDyno(cv, spec, stockSpec, 1);
  bind(body, {
    run: () => {
      audio.engine && audio.beep(440, 0.1);
      const eng = audio.engine({ profile: soundProfile(m, levels(car), car.parts) });
      let t = 0;
      const tick = () => {
        t += 1 / 60 / 3.2;
        drawDyno(cv, spec, stockSpec, Math.min(1, t));
        const rpm = 1500 + (spec.redline - 1500) * Math.min(1, t);
        eng?.update({ rpm, throttle: 1, boost: spec.asp === 'turbo' ? Math.min(1, t * 1.6) : 0, turbo: spec.asp === 'turbo' });
        if (t < 1) requestAnimationFrame(tick);
        else {
          eng?.stop();
          body.querySelector('[data-p]').textContent = `${spec.hp} hp @ ${spec.hpRpm.toLocaleString()}`;
          body.querySelector('[data-t]').textContent = `${spec.tq} lb-ft @ ${spec.tqRpm.toLocaleString()}`;
        }
      };
      tick();
    },
  });
}

function drawDyno(cv, spec, stock, prog) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, L = 60, R = 60, T = 20, B = 40;
  g.fillStyle = '#08090b'; g.fillRect(0, 0, W, H);
  const cur = dynoCurve(spec, 100), base = dynoCurve(stock, 100);
  const maxRpm = Math.max(spec.redline, stock.redline);
  const maxV = Math.max(...cur.map(p => Math.max(p.hp, p.tq)), ...base.map(p => Math.max(p.hp, p.tq))) * 1.1;
  const x = r => L + (r / maxRpm) * (W - L - R), y = v => H - B - v / maxV * (H - T - B);
  g.strokeStyle = '#1e2026'; g.lineWidth = 1; g.fillStyle = '#6b6e78'; g.font = '13px Rajdhani, sans-serif';
  for (let r = 0; r <= maxRpm; r += 1000) { g.beginPath(); g.moveTo(x(r), T); g.lineTo(x(r), H - B); g.stroke(); g.fillText(r / 1000 + 'k', x(r) - 8, H - B + 18); }
  const step = maxV > 1200 ? 200 : maxV > 600 ? 100 : 50;
  for (let v = 0; v <= maxV; v += step) { g.beginPath(); g.moveTo(L, y(v)); g.lineTo(W - R, y(v)); g.stroke(); g.fillText(v, 18, y(v) + 4); }
  g.fillText('RPM', W - R + 10, H - B + 18);
  const line = (pts, key, col, w, upto = Infinity) => {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath();
    let first = true;
    for (const p of pts) { if (p.rpm > upto) break; first ? g.moveTo(x(p.rpm), y(p[key])) : g.lineTo(x(p.rpm), y(p[key])); first = false; }
    g.stroke();
  };
  line(base, 'hp', 'rgba(150,150,160,0.5)', 1.5); line(base, 'tq', 'rgba(150,150,160,0.3)', 1.5);
  const upto = 1500 + (spec.redline - 1500) * prog;
  line(cur, 'tq', '#c0c4cc', 3, upto); line(cur, 'hp', '#e0192e', 3.5, upto);
  g.fillStyle = '#e0192e'; g.fillText('■ Horsepower', L + 10, T + 14); g.fillStyle = '#c0c4cc'; g.fillText('■ Torque (lb-ft)', L + 120, T + 14);
}

// What each part of the setup costs to change: [shop $, DIY minutes]
const TUNE_COST = {
  engine: [300, 60, 'ECU map'], tc: [0, 15, 'Traction control'], gearing: [650, 240, 'Ring & pinion'], gears: [1400, 480, 'Gear set'],
  susp: [180, 120, 'Suspension setup'], align: [140, 90, 'Alignment'], tires: [0, 10, 'Tire pressures'], brakes: [0, 15, 'Brake bias'],
  diff: [250, 120, 'Diff setup'], aero: [0, 15, 'Wing angle'],
};

function tune(body, h, app, st, s, car, m) {
  const can = st.mode === 'home' || st.mode === 'perf';
  const lv = levels(car);
  const spec0 = carSpec(car);
  const baseRl = buildSpec(m, lv, car.cond, {}, car.visual).redline;
  const schema = tuneSchema(m, lv, car.visual, baseRl);
  if (!st.draft || st.draft.uid !== car.uid) st.draft = { uid: car.uid, t: JSON.parse(JSON.stringify(car.tune || {})) };
  const draft = st.draft.t;
  const val = (it) => tuneValue(draft, it);
  const row = (grp, it) => {
    const v = val(it);
    return `<label class="tune-row"><span class="tune-l">${esc(it.label)}<b data-v="${it.k}">${it.fmt(v)}</b><small>${esc(it.unit)}${it.ratio ? '' : ` · stock ${it.fmt(it.def)}`}</small></span>
      <input type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}" data-k="${it.k}" class="input" ${can && !grp.lock ? '' : 'disabled'}></label>`;
  };
  const open = st.tuneOpen || (st.tuneOpen = new Set(['engine', 'gearing']));
  const groupsHtml = schema.map(grp => `<details class="tune-grp" data-g="${grp.id}" ${open.has(grp.id) ? 'open' : ''}>
      <summary>${grp.lock ? '🔒 ' : ''}${esc(grp.name)}<span class="tune-chg" data-chg="${grp.id}"></span></summary>
      ${grp.lock ? `<p class="small muted">${esc(grp.lock)}</p>` : `<p class="small muted">${esc(grp.note)}</p>${grp.items.map(it => row(grp, it)).join('')}`}
    </details>`).join('');
  body.innerHTML = `<div class="tune">
    <div class="tune-out" data-out></div>
    <div data-warn></div>
    <div class="tune-presets"><span class="small muted">Start from</span>${Object.entries(PRESETS).map(([id, p]) => `<button class="btn btn-sm" data-action="preset" data-id="${id}" ${can ? '' : 'disabled'}>${id === 'street' ? 'Stock' : p.label}</button>`).join('')}</div>
    ${groupsHtml}
    <details class="tune-grp" ${open.has('launch') ? 'open' : ''} data-g="launch"><summary>Launch control</summary>
    <p class="small">${lv.twostep ? `✅ 2-step installed (stage ${lv.twostep}). Hold gas + brake and it holds your launch rpm — and throws flames out the exhaust. Works on the drag strip, at meets and when you're stopped on the street.` : lv.ecu >= 2 ? '✅ Launch control enabled (ECU stage 2+). The drag strip holds your rpm on the line. Add a 2-step (PartsHub → Power Adders) for tighter holds and flames.' : '❌ No launch control. Install a 2-step (PartsHub → Power Adders) or get a Stage 2 tune for a rev limiter on the line. Plain gas + brake just revs — flames only come from a 2-step.'}</p>
    ${lv.twostep && m.asp !== 'ev' ? `<label class="field"><span>2-step launch rpm — <b data-ts-val></b></span>
      <input type="range" min="2000" max="${Math.round(m.redline * 0.92)}" step="100" value="${Math.round(launchRpmSetting(spec0, car))}" data-ts class="input" ${can ? '' : 'disabled'}></label>
      <p class="small muted">Higher rpm = harder launch but easier to spin the tires. Turbo cars want it up where boost builds; stage ${lv.twostep} holds it within ±${FX.twostep.tol[lv.twostep]} rpm.</p>` : ''}</details>
    <div class="tune-save">
      <p class="small muted" data-cost></p>
      <div class="row"><button class="btn" data-action="revert" ${can ? '' : 'disabled'}>Undo changes</button><button class="btn btn-primary" data-action="save" ${can ? '' : 'disabled'}>Save tune</button></div>
      ${can ? '' : '<p class="small muted">View only. Go home or to Torque Temple to change the setup.</p>'}
    </div></div>`;
  body.querySelectorAll('details[data-g]').forEach(d => d.addEventListener('toggle', () => { d.open ? open.add(d.dataset.g) : open.delete(d.dataset.g); }));

  const ts = body.querySelector('[data-ts]');
  if (ts) {
    const show = () => { body.querySelector('[data-ts-val]').textContent = `${ts.value} rpm`; };
    ts.oninput = () => { car.tune.twoStepRpm = +ts.value; draft.twoStepRpm = +ts.value; show(); };
    show();
  }

  // which groups differ from what's saved on the car
  const changed = () => {
    const out = [];
    for (const grp of schema) {
      if (grp.lock) continue;
      const diff = grp.items.filter(it => Math.abs(val(it) - tuneValue(car.tune, it)) > 1e-9);
      if (!diff.length) continue;
      if (grp.id === 'gearing') {
        if (diff.some(it => it.k === 'finalDrive')) out.push('gearing');
        if (diff.some(it => it.k !== 'finalDrive')) out.push('gears');
      } else out.push(grp.id);
    }
    return out;
  };
  const cost = ch => ch.reduce((a, id) => ({ $: a.$ + TUNE_COST[id][0], min: a.min + TUNE_COST[id][1] }), { $: 0, min: 0 });

  let raf = 0;
  const out = () => {
    raf = 0;
    const sp = buildSpec(m, lv, car.cond, draft, car.visual);
    const mt = metrics(sp), m0 = carMetrics(car);
    const d = (a, b, lowerBetter, dp = 2) => { if (a == null || b == null) return ''; const x = a - b; if (Math.abs(x) < Math.pow(10, -dp) / 2) return ''; const good = lowerBetter ? x < 0 : x > 0; return ` <small class="dl" style="color:${good ? 'var(--green)' : 'var(--red2)'}">${x > 0 ? '+' : ''}${x.toFixed(dp)}</small>`; };
    const bal = Math.max(-1, Math.min(1, (sp.balance || 0) * 4));
    const balTxt = bal > 0.15 ? 'Oversteer' : bal < -0.15 ? 'Understeer' : 'Neutral';
    const kn = sp.knock || 0;
    body.querySelector('[data-out]').innerHTML = `
      <div class="tune-figs">
        <div><small>Power</small><b>${sp.hp}</b> hp${d(sp.hp, spec0.hp, false, 0)}</div>
        <div><small>Torque</small><b>${sp.tq}</b> lb-ft${d(sp.tq, spec0.tq, false, 0)}</div>
        <div><small>0-60</small><b>${mt.zero60?.toFixed(2) ?? '—'}</b>s${d(mt.zero60, m0.zero60, true)}</div>
        <div><small>¼ mile</small><b>${mt.quarter?.toFixed(2) ?? '—'}</b>s${d(mt.quarter, m0.quarter, true)}</div>
        <div><small>Top</small><b>${Math.round(mt.topSpeed)}</b> mph${d(mt.topSpeed, m0.topSpeed, false, 0)}</div>
        <div><small>Grip</small><b>${(sp.handling / (spec0.handling || 1) * 100).toFixed(0)}</b>%</div>
      </div>
      <div class="tune-meters">
        <div><small>Balance · <b>${balTxt}</b></small><div class="tune-bal"><i style="left:${50 + bal * 50}%"></i></div></div>
        <div><small>Knock risk · <b style="color:${kn > 0.4 ? 'var(--red2)' : kn > 0 ? 'var(--yellow)' : 'var(--green)'}">${kn > 0.4 ? 'HIGH' : kn > 0 ? 'Some' : 'Safe'}</b>${sp.boostPsi ? ` · ${sp.boostPsi.toFixed(1)} psi` : ''} · limiter ${Math.round(sp.redline).toLocaleString()} rpm</small>${bar(kn * 100, kn > 0.4 ? 'hot' : '')}</div>
      </div>`;
    body.querySelector('[data-warn]').innerHTML = `${(sp.tuneWarnings || []).concat(sp.fuelLimited ? ['Injectors are maxed out. More boost won\'t make more power until you upgrade the fuel system.'] : []).map(w => `<p class="tune-warn">⚠ ${esc(w)}</p>`).join('')}`;
    const ch = changed(), c = cost(ch);
    body.querySelectorAll('[data-chg]').forEach(n => { n.textContent = ch.includes(n.dataset.chg) || (n.dataset.chg === 'gearing' && ch.includes('gears')) ? ' • changed' : ''; });
    body.querySelector('[data-cost]').textContent = !ch.length ? 'No changes yet.' : `${ch.map(id => TUNE_COST[id][2]).join(', ')} — ${st.mode === 'perf' ? (c.$ ? `${fmtMoney(c.$)} at the shop` : 'free') : `DIY, ${c.min >= 60 ? `${(c.min / 60).toFixed(c.min % 60 ? 1 : 0)}h` : `${c.min} min`} of your time`}.`;
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(out); };
  body.querySelectorAll('[data-k]').forEach(inp => {
    const it = schema.flatMap(g => g.items).find(x => x.k === inp.dataset.k);
    inp.oninput = () => {
      draft[it.k] = +inp.value;
      // single-adjustable dampers move bump and rebound together
      if ((lv.suspension || 0) < 3 && (it.k === 'bumpF' || it.k === 'bumpR')) draft[it.k === 'bumpF' ? 'rebF' : 'rebR'] = +inp.value;
      body.querySelector(`[data-v="${it.k}"]`).textContent = it.fmt(+inp.value);
      queue();
    };
  });
  out();
  bind(body, {
    preset: dd => {
      const p = PRESETS[dd.id];
      for (const grp of schema) for (const it of grp.items) {
        if (grp.lock) continue;
        const keep = dd.id !== 'street' && (grp.id === 'engine' || /^g\d/.test(it.k));   // chassis presets leave your engine map and gear set alone
        draft[it.k] = Math.max(it.min, Math.min(it.max, p.vals[it.k] ?? (keep ? val(it) : it.def)));
      }
      h.refresh();
      toast(dd.id === 'street' ? 'Back to the stock setup. Save to keep it.' : `${p.label} setup loaded. Fine-tune it, then save.`, 'info');
    },
    revert: () => { st.draft = null; h.refresh(); },
    save: () => {
      const ch = changed();
      if (!ch.length) { toast('Nothing changed', 'info'); return; }
      const c = cost(ch);
      if (st.mode === 'perf') { if (c.$ && !spend(s, c.$, `Tuning: ${ch.map(id => TUNE_COST[id][2]).join(', ')}`)) return; }
      else advanceTime(s, c.min);
      car.tune = JSON.parse(JSON.stringify(draft));
      st.draft = null;
      app.world?.refreshCar();
      toast('Tune saved', 'good');
      h.refresh();
    },
  });
}

function collection(body, h, app, st, s, car, m) {
  const atHome = st.mode === 'home';
  const cap = s.properties.reduce((n, id) => n + (PROPERTIES[id]?.slots || 0), 0);
  body.innerHTML = `<p class="muted small">${s.cars.length} / ${cap} garage spaces. ${atHome ? 'Pick a car to drive.' : 'Switch cars at home.'}</p>
    <div class="grid">${s.cars.map(c => {
      const mm = modelOf(c), mt = carMetrics(c);
      return `<div class="card ${c.uid === st.carUid ? '' : 'click'}" data-action="view" data-uid="${c.uid}"><canvas width="320" height="180" data-thumb="${c.uid}" class="carthumb"></canvas>
        <h3>${esc(carName(mm, c.year))}</h3><div class="muted small">${Math.round(c.miles).toLocaleString()} mi · <span class="pi"><b>${mt.cls}</b>${mt.pi}</span> · ${fmtMoney(carValue(c))}</div>
        <div class="row" style="margin-top:8px">${c.stolen ? '<span class="tag tag-red">Stolen — cops are looking</span>' : `${c.uid === s.activeCar ? '<span class="tag tag-green">Driving</span>' : atHome ? `<button class="btn btn-sm btn-primary" data-action="drive" data-uid="${c.uid}">Drive this</button>` : ''}
        <button class="btn btn-sm" data-action="tradein" data-uid="${c.uid}">Sell to dealer ${fmtMoney(carValue(c) * 0.7)}</button>`}</div></div>`;
    }).join('')}</div>`;
  body.querySelectorAll('[data-thumb]').forEach(cv => { const c = getCar(s, cv.dataset.thumb); drawThumb(cv, modelOf(c), c.visual, c.parts, c.cond); });
  bind(body, {
    view: d => { st.carUid = d.uid; st.tab = 'overview'; h.refresh(); },
    drive: d => {
      s.activeCar = d.uid; s.carPos = null;
      const w = app.world;
      if (w) { const home = LOC_BY_ID[s.home]; w.vehicle = null; const hs = w.homeSpot(home); w.placeCar(getCar(s, d.uid), hs.x, hs.z, hs.h); }
      toast(`Now driving your ${modelOf(getCar(s, d.uid)).model}`, 'good');
      h.refresh();
    },
    tradein: async d => {
      const c = getCar(s, d.uid);
      if (!(await confirm('Sell to a dealer?', `<p>A dealer will give you <b>${fmtMoney(carValue(c) * 0.7)}</b> (private sale on Marketplace usually gets more).</p>`, 'Sell', true))) return;
      sellCar(s, c, carValue(c) * 0.7, app);
      st.carUid = s.activeCar;
      h.refresh();
    },
  });
}
