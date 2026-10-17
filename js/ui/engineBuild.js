// Engine Build at the mechanic shops: pick a crate motor, build the inside,
// add a blower, turbos or nitrous, headers and a tune, watch it on the shop
// dyno, then have the shop swap it into the car you're driving.

import { openPanel, bind, esc, toast, confirm } from './dom.js';
import { game, fmtMoney, spend, activeCar, carSpec, carMetrics, uid } from '../core/state.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { partLevels } from '../data/parts.js';
import { buildSpec, dynoCurve, metrics } from '../sim/powertrain.js';
import { soundProfile } from '../sim/sound.js';
import { resetEngineWarnings } from '../sim/engine.js';
import { audio } from '../core/audio.js';
import { ENGINES, INSIDE, SLOTS, POWER, FUELS, TUNERS, HEADERS, PIPES, TRANS, fixBuild, powerDef, isTurbo, calcBuild, buildCost, swapKit, swapRecord, swapModel, unswapCost } from '../data/engineBuild.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const n = v => Math.round(v).toLocaleString('en-US');
// Bolt-ons that come off with the old motor (they go in your parts bin).
const MOTOR_PARTS = ['engine', 'turbo', 'supercharger', 'intercooler', 'ecu', 'intake', 'exhaust', 'fuel', 'nitrous'];
const TABS = [['motor', 'Motor'], ['inside', 'Inside'], ['boost', 'Boost'], ['exhaust', 'Exhaust'], ['tune', 'Tune'], ['swap', 'Swap']];

// The car with this build swapped in, as the sim would drive it.
function projected(car, b) {
  const base = CAR_BY_ID[car.modelId];
  const sw = swapRecord(b, base);
  const parts = { ...car.parts }; MOTOR_PARTS.forEach(k => { parts[k] = null; });
  const spec = buildSpec(swapModel(base, sw), partLevels(parts), { ...car.cond, engine: 100 }, car.tune, car.visual);
  return { sw, spec, met: metrics(spec) };
}

const chips = (action, list, cur) => `<div class="chips eb-chips">${list.map(([key, label, sub]) => `<button class="chip ${key === cur ? 'on' : ''}" data-action="${action}" data-k="${key}">${esc(label)}${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div>`;
const price = p => p ? fmtMoney(p) : 'included';

export function openEngineBuild(loc, app) {
  const s = game.s, rate = loc.rate || 1;
  const st = { tab: 'motor', scroll: 0 };
  openPanel((root, h) => {
    const car = activeCar(s);
    if (!car) { root.innerHTML = head('Engine Build') + '<div class="p-body"><div class="empty">Bring a car. The motor goes in the car you\'re driving.</div></div>'; bind(root, { close: () => h.close() }); return; }
    const b = s.engineDraft = fixBuild(s.engineDraft);
    const base = CAR_BY_ID[car.modelId], kit = swapKit(base);
    const c = calcBuild(b), cost = buildCost(b, base, rate), P = powerDef(b), E = ENGINES[b.eng];
    const now = carSpec(car), pj = kit.ok ? projected(car, b) : null, metNow = carMetrics(car);
    const status = c.det ? `<b class="bad">💥 Detonation: ${c.P.type === 'n2o' ? `a ${c.shot} shot` : `${c.psi} psi`} is too much for ${esc(c.F.label)}</b>`
      : c.blowAt ? `<b class="bad">💥 Rods let go at ${n(c.blowAt)} rpm: ${n(c.peakHp)} hp on parts that hold ${n(c.lim)}</b>`
      : `<b class="good">Safe · bottom end holds ${n(c.lim)} hp</b>`;
    const fix = c.det ? 'Turn it down, or run E85 / race gas, or a tuner with better knock control (Tune tab).'
      : c.blowAt ? 'Forged pistons, rods and a crank (Inside tab), or less boost (Tune tab).' : '';
    const blocked = !kit.ok ? kit.why : car.stolen || car.hot ? 'Not on a stolen car.' : c.blowAt ? 'Fix the build first. The shop won\'t put in a motor that blows on the dyno.' : '';
    const oldMotor = car.swap ? `${car.swap.label} swap (${n(car.swap.hp)} hp)` : `${base.engine}, ${n(base.hp)} hp`;

    let tab = '';
    if (st.tab === 'motor') {
      tab = chips('eng', Object.entries(ENGINES).map(([k, e]) => [k, e.label, `${n(e.hp)} hp · ${fmtMoney(e.price)}`]), b.eng)
        + `<p class="muted">${esc(E.maker)} ${esc(E.label)}: ${esc(E.note)} Stock bottom end holds ${n(E.limit)} hp, revs to ${n(E.red)}, ${n(E.kg * 2.2)} lb dressed.</p>`;
    } else if (st.tab === 'inside') {
      tab = SLOTS.map(sl => `<div class="section-title">${INSIDE[sl].label}</div>` + chips('in-' + sl, INSIDE[sl].opts.map(o => [o.key, o.name, [o.lim ? `holds ${n(o.lim)}` : '', o.k ? `+${Math.round(o.k * 100)}%` : '', o.stroke ? 'stroker' : '', o.price ? fmtMoney(o.price) : 'stock'].filter(Boolean).join(' · ')]), b[sl])).join('')
        + '<p class="muted">The weakest of the pistons, rods and crank sets how much power the motor holds.</p>';
    } else if (st.tab === 'boost') {
      const list = Object.entries(POWER).filter(([k]) => k !== 'factory' || E.factory).filter(([k]) => k !== 'na' || !E.factory)
        .map(([k, p]) => [k, k === 'factory' ? E.factory.name : p.label, k === 'na' || k === 'factory' ? 'no charge' : fmtMoney(p.price)]);
      tab = chips('pow', list, b.pow) + `<p class="muted">${esc(P.note || '')}</p>`;
    } else if (st.tab === 'exhaust') {
      tab = (isTurbo(b) ? '<p class="muted">Turbo kits bring their own hot-side manifolds and downpipes.</p>'
        : '<div class="section-title">Long tube headers</div>' + chips('hdr', HEADERS.map(x => [x.key, x.name, x.price ? `+${x.hp} hp · ${fmtMoney(x.price)}` : 'cast iron']), b.hdr))
        + '<div class="section-title">Mid-pipe</div>' + chips('pipe', Object.entries(PIPES).map(([k, x]) => [k, x.label, `${x.hp ? `+${x.hp} hp · ` : ''}${fmtMoney(x.price)}`]), b.pipe);
    } else if (st.tab === 'tune') {
      tab = (P.levels ? `<div class="section-title">${P.type === 'n2o' ? 'Nitrous shot' : 'Boost'}</div>` + chips('lvl', P.levels.map((v, i) => [String(i), P.type === 'n2o' ? `${v} shot` : `${v} psi`, i ? '' : P.factory ? 'factory' : 'base']), String(b.lvl)) : '<p class="muted">No boost to turn up. Add a blower, turbos or nitrous on the Boost tab.</p>')
        + '<div class="section-title">Fuel</div>' + chips('fuel', Object.entries(FUELS).map(([k, f]) => [k, f.label, `safe to ${f.psi} psi / ${f.shot} shot${f.price ? ' · ' + fmtMoney(f.price) : ''}`]), b.fuel)
        + '<div class="section-title">Tuner</div>' + chips('tuner', Object.entries(TUNERS).map(([k, t]) => [k, t.label, `${t.knock > 1 ? 'better knock control · ' : ''}${fmtMoney(t.price)}`]), b.tuner);
    } else {
      tab = kit.ok ? `<div class="section-title">Transmission</div>` + chips('trans', Object.entries(TRANS).map(([k, t]) => [k, k === 'keep' ? `Keep the ${base.trans}` : t.label, t.price ? fmtMoney(t.price) : 'adapter plate']), b.trans)
        + `<div class="kv" style="margin-top:8px"><span>Comes out</span><span>${esc(oldMotor)}</span><span>Goes in</span><span>${esc(pj.sw.engine)}, ${n(pj.spec.hp)} hp${c.shot ? ` (+${c.shot} on the bottle)` : ''}</span>
          <span>Swap kit</span><span>${esc(kit.kit)}</span><span>Weight</span><span>${pj.sw.kgDelta >= 0 ? '+' : ''}${n(pj.sw.kgDelta * 2.2)} lb</span></div>
          <p class="muted">Your old bolt-ons (internals, turbo or blower kit, intake, exhaust, tune, fuel, nitrous) come off with the old motor and go in your parts bin.</p>`
        : `<p class="bad">${esc(kit.why)}</p>`;
    }

    const body = root.querySelector('.p-body'); if (body) st.scroll = body.scrollTop;
    root.innerHTML = head('Engine Build', `${esc(loc.name)} · build a motor and swap it in`) + `<div class="p-body" style="max-width:820px">
      <p class="muted">Going into your <b>${esc(carName(base, car.year))}</b> · now: ${esc(oldMotor)}</p>
      <canvas class="eb-dyno" data-dyno></canvas>
      <div class="stats-row" style="margin:8px 0">
        <div><div class="stat-lbl">Peak power</div><b>${n(c.peakHp)} hp</b> <small class="muted">@ ${n(c.hpRpm)}</small></div>
        <div><div class="stat-lbl">Peak torque</div><b>${n(c.peakTq)} lb-ft</b> <small class="muted">@ ${n(c.tqRpm)}</small></div>
        <div><div class="stat-lbl">${c.shot ? 'Nitrous' : 'Boost'}</div><b>${c.shot ? c.shot + ' shot' : c.psi ? c.psi + ' psi' : 'none'}</b></div>
        ${pj ? `<div><div class="stat-lbl">¼ mile</div><b>${metNow.quarter?.toFixed(2) ?? '—'} → ${pj.met.quarter?.toFixed(2) ?? '—'}s</b></div><div><div class="stat-lbl">0-60</div><b>${metNow.zero60?.toFixed(2) ?? '—'} → ${pj.met.zero60?.toFixed(2) ?? '—'}s</b></div>` : ''}
      </div>
      <p style="margin:4px 0">${status}</p>${fix ? `<p class="muted" style="margin:2px 0 8px">${fix}</p>` : ''}
      <div class="tabs">${TABS.map(([id, l]) => `<button class="${st.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${l}</button>`).join('')}</div>
      <div style="padding:10px 0">${tab}</div>
      <div class="section-title">The bill</div>
      <div class="kv">${cost.items.map(([k, v]) => `<span>${esc(k)}</span><span>${fmtMoney(v)}</span>`).join('')}<span><b>Total</b></span><span>${fmtMoney(cost.total)}</span></div>
      ${blocked ? `<p class="bad">${esc(blocked)}</p>` : ''}
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="btn" data-action="pull">Run it on the dyno</button><div class="grow"></div>
        ${car.swap ? `<button class="btn" data-action="unswap">Factory motor back · ${fmtMoney(unswapCost(base, rate))}</button>` : ''}
        <button class="btn btn-primary" data-action="install" ${blocked ? 'disabled' : ''}>Swap it in · ${fmtMoney(cost.total)}</button></div>
    </div>`;
    const nb = root.querySelector('.p-body'); nb.scrollTop = st.scroll;
    const cv = root.querySelector('[data-dyno]');
    const nowCurve = dynoCurve(now, 100);
    drawSheet(cv, c, nowCurve, 1);

    const set = (k, v) => { s.engineDraft = fixBuild({ ...b, [k]: v }); h.refresh(); };
    const handlers = {
      close: () => h.close(),
      tab: d => { st.tab = d.id; h.refresh(); },
      eng: d => { const f = !!ENGINES[d.k].factory; s.engineDraft = fixBuild({ ...b, eng: d.k, pow: f ? 'factory' : b.pow === 'factory' ? 'na' : b.pow, lvl: 0 }); h.refresh(); },
      pow: d => { s.engineDraft = fixBuild({ ...b, pow: d.k, lvl: 0 }); h.refresh(); },
      lvl: d => set('lvl', +d.k),
      fuel: d => set('fuel', d.k), tuner: d => set('tuner', d.k), hdr: d => set('hdr', d.k), pipe: d => set('pipe', d.k), trans: d => set('trans', d.k),
      pull: () => pull(cv, c, nowCurve, base, b),
      install: async () => {
        if (blocked) return;
        if (!(await confirm('Swap it in?', `<p><b>${esc(pj.sw.engine)}</b>, ${n(pj.spec.hp)} hp, into your ${esc(carName(base, car.year))} for <b>${fmtMoney(cost.total)}</b>.</p>`, 'Swap it'))) return;
        if (!spend(s, cost.total, `Engine swap: ${E.label}`)) return;
        for (const k of MOTOR_PARTS) { if (typeof car.parts[k] === 'string') s.partsBin.push({ pid: car.parts[k], uid: uid('b') }); car.parts[k] = null; }
        car.swap = { ...pj.sw, cost: cost.total, at: s.time.day };
        car.cond.engine = 100; car.engineBlown = false; car.broken = null; car.oil = 100;
        if (c.shot) car.nos = 8;
        resetEngineWarnings(car);
        audio.buy();
        app.world?.refreshCar();
        toast(`${E.label} is in. ${n(carSpec(car).hp)} hp. Go let it eat.`, 'good');
        h.refresh();
      },
      unswap: async () => {
        const p = unswapCost(base, rate);
        if (!(await confirm('Put the factory motor back?', `<p>The ${esc(car.swap.label)} comes out and the ${esc(base.engine)} goes back in for <b>${fmtMoney(p)}</b>. The swapped motor doesn't come back.</p>`, 'Put it back'))) return;
        if (!spend(s, p, 'Factory motor back in')) return;
        car.swap = null; car.cond.engine = 100; car.engineBlown = false; resetEngineWarnings(car);
        app.world?.refreshCar(); toast('Factory motor is back in.', 'good'); h.refresh();
      },
    };
    SLOTS.forEach(sl => { handlers['in-' + sl] = d => set(sl, d.k); });
    bind(root, handlers);
  });
}

// The shop's dyno sheet: the build in color, the car's current motor in grey.
function drawSheet(cv, c, nowCurve, prog, blownAt = null) {
  const g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 900, H = cv.clientHeight || 300, L = 46, R = 12, T = 14, B = 26;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#08090b'; g.fillRect(0, 0, W, H);
  const maxRpm = Math.max(c.red, nowCurve.length ? nowCurve[nowCurve.length - 1].rpm : 0);
  const maxV = Math.max(...c.hp, ...c.tq, ...nowCurve.map(p => Math.max(p.hp, p.tq))) * 1.1;
  const x = r => L + (r / maxRpm) * (W - L - R), y = v => H - B - v / maxV * (H - T - B);
  g.strokeStyle = '#1e2026'; g.lineWidth = 1; g.fillStyle = '#6b6e78'; g.font = '13px Rajdhani, sans-serif';
  for (let r = 0; r <= maxRpm; r += 1000) { g.beginPath(); g.moveTo(x(r), T); g.lineTo(x(r), H - B); g.stroke(); g.fillText(r / 1000 + 'k', x(r) - 8, H - B + 18); }
  const step = [100, 200, 400, 500, 1000].find(v => v / maxV * (H - T - B) >= 24) || 1000;   // grid lines at least 24 px apart
  for (let v = 0; v <= maxV; v += step) { g.beginPath(); g.moveTo(L, y(v)); g.lineTo(W - R, y(v)); g.stroke(); g.fillText(v, 12, y(v) + 4); }
  const line = (rpm, vals, col, w, upto) => {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath();
    let first = true;
    rpm.forEach((r, i) => { if (r > upto) return; if (first) { g.moveTo(x(r), y(vals[i])); first = false; } else g.lineTo(x(r), y(vals[i])); });
    g.stroke();
  };
  line(nowCurve.map(p => p.rpm), nowCurve.map(p => p.hp), '#4a4d55', 2, Infinity);
  line(nowCurve.map(p => p.rpm), nowCurve.map(p => p.tq), '#33353c', 2, Infinity);
  const upto = blownAt ?? (2000 + (c.red - 2000) * prog);
  line(c.rpm, c.tq, '#c0c4cc', 2.5, upto);
  line(c.rpm, c.hp, '#e0192e', 3, upto);
  g.font = 'bold 14px Rajdhani, sans-serif';
  g.fillStyle = '#e0192e'; g.fillText('HP', W - R - 70, T + 14);
  g.fillStyle = '#c0c4cc'; g.fillText('LB-FT', W - R - 44, T + 14);
  g.fillStyle = '#6b6e78'; g.fillText('your motor now', L + 8, T + 14);
  if (blownAt) { g.fillStyle = '#ff3346'; g.font = 'bold 18px Rajdhani, sans-serif'; g.fillText('💥 ROD THROUGH THE BLOCK', Math.max(L + 6, Math.min(W - R - 210, x(blownAt) - 200)), T + 40); }
}

// A pull on the shop dyno, with the motor's sound. A build that blows lets
// go right where the sheet said (the shop dyno is a sim: nothing is lost).
let pulling = false;
function pull(cv, c, nowCurve, base, b) {
  if (pulling) return;
  pulling = true;
  const m = swapModel(base, swapRecord(b, base));
  const eng = audio.engine({ profile: soundProfile(m, {}, null) });
  const end = c.blowAt || c.red;
  let t = 0;
  const tick = () => {
    if (!cv.isConnected) { eng?.stop(); pulling = false; return; }
    t += 1 / 60 / 3.2;
    const rpm = 2000 + (c.red - 2000) * Math.min(1, t);
    const done = rpm >= end;
    drawSheet(cv, c, nowCurve, Math.min(1, t), done && c.blowAt ? c.blowAt : null);
    eng?.update({ rpm: Math.min(rpm, end), throttle: 1, boost: c.psi ? Math.min(1, t * 1.6) : 0, turbo: c.asp === 'turbo' });
    if (!done) { requestAnimationFrame(tick); return; }
    eng?.stop(); pulling = false;
    if (c.blowAt) { audio.crash?.(1); toast(`💥 It let go at ${n(c.blowAt)} rpm. Good thing it was on the shop's dyno sim. Fix the build.`, 'bad'); }
    else toast(`${n(c.peakHp)} hp @ ${n(c.hpRpm)} · ${n(c.peakTq)} lb-ft @ ${n(c.tqRpm)}`, 'good');
  };
  tick();
}
