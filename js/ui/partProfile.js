// Tap any part (Garage → Performance, PartsHub, My Parts, Install) and its
// profile opens: what it is, how it works, the stages, the supporting mods
// it needs, and what it would do to your car, including whether the engine
// will survive it.

import { modal, esc } from './dom.js';
import { fmtMoney, modelOf, levels } from '../core/state.js';
import { ITEM_BY_ID, CATEGORY_NAMES, fits, fitNote } from '../data/catalog.js';
import { PERF_IDS, partLabel } from '../data/parts.js';
import { PART_INFO, PART_ICONS, supportCheck } from '../data/partInfo.js';
import { buildSpec, launchCheck } from '../sim/powertrain.js';
import { launchRpmSetting } from '../sim/twostep.js';

const NEED_NAMES = { dragpack: 'Drag pack', ecu: 'Tune / ECU', fuel: 'Fuel system', intercooler: 'Intercooler', engine: 'Forged internals (Engine stage 2+)' };

export function partProfileHtml({ cat, pid, car }) {
  const it = pid ? ITEM_BY_ID[pid] : null;
  cat = cat || it?.cat;
  const info = PART_INFO[cat] || { what: CATEGORY_NAMES[cat] || cat };
  const m = car ? modelOf(car) : null;
  const lv = car ? levels(car) : {};
  const perf = PERF_IDS.includes(cat);
  const stage = it?.stage || (perf ? lv[cat] : 0);
  const sec = (t, body) => body ? `<div class="pp-sec"><div class="pp-h">${t}</div>${body}</div>` : '';
  let html = `<div class="pp">`;
  if (it) html += `<div class="pp-prod"><div><div class="brand">${esc(it.brand)}</div><div class="name">${esc(it.name)}</div></div>
      <div class="pp-tags">${it.visual ? '' : `<span class="stage stage-${it.stage}">STAGE ${it.stage}</span>`}<b>${fmtMoney(it.price)}</b><span class="muted small">${it.labor}h install</span></div></div>
      ${m ? `<p class="small ${fits(it, m) ? 'good' : 'bad'}">${fits(it, m) ? `✓ Fits your ${esc(m.model)}` : `✕ ${esc(fitNote(it, m))}`}${car.parts?.[cat] === pid ? ' · <span class="tag tag-green">Installed</span>' : ''}</p>` : ''}`;
  else if (car && perf) html += `<p class="small muted">On your car: <b>${esc(partLabel(car.parts, cat))}</b>${stage ? ` <span class="stage stage-${stage}">STAGE ${stage}</span>` : ''}</p>`;
  html += sec('What it is', `<p>${esc(info.what)}</p>`);
  html += sec('How it works', info.how && `<p>${esc(info.how)}</p>`);
  html += sec('Stages', info.stages && `<ol class="pp-stages">${info.stages.map((t, i) => `<li class="${stage === i + 1 ? 'on' : ''}">${esc(t)}</li>`).join('')}</ol>`);
  html += sec('In the game', info.game && `<p>${esc(info.game)}</p>`);
  if (info.danger) html += `<div class="pp-danger">💥 ${esc(info.danger)}</div>`;
  if (car && m) {
    const sup = supportCheck(cat, lv, m);
    html += sec('Supporting mods', sup.length && `<div class="pp-needs">${sup.map(x => `<div class="${x.ok ? 'good' : 'bad'}">${x.ok ? '✅' : '❌'} ${NEED_NAMES[x.cat] || CATEGORY_NAMES[x.cat]}${x.ok ? ` <span class="muted small">· ${esc(partLabel(car.parts, x.cat))}</span>` : ''}</div>`).join('')}</div>`);
    // what this part does to your car, engine included
    if (perf && m.asp !== 'ev') {
      const now = buildSpec(m, lv, car.cond, car.tune, car.visual);
      const lv2 = it ? { ...lv, [cat]: it.stage, ...(cat === 'turbo' ? { supercharger: 0 } : cat === 'supercharger' ? { turbo: 0 } : {}) } : lv;
      const sp = it && fits(it, m) ? buildSpec(m, lv2, car.cond, car.tune, car.visual) : now;
      const d = sp.hp - now.hp;
      const L = sp.engineLevel;
      const reasons = sp.engineReasons || [];
      html += sec(it ? 'On your car' : 'Your engine', `<div class="pp-eng">
        <div><small>Power</small><b>${sp.hp} hp</b>${d ? ` <span class="${d > 0 ? 'good' : 'bad'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</div>
        <div><small>Engine reliability</small><b style="color:${L.color}">${esc(L.label)}</b></div>
        <div><small>Engine health</small><b>${car.engineBlown ? '💥 BLOWN' : `${Math.round(car.cond.engine)}%`}</b></div></div>
        ${reasons.length ? `<ul class="pp-reasons">${reasons.map(r => `<li>${r.nos ? '<b>On nitrous:</b> ' : ''}${esc(r.text)}<br><span class="muted">Fix: ${esc(r.fix)}</span></li>`).join('')}</ul>` : '<p class="small good">The motor will live with this build.</p>'}`);
    }
  }
  if (car && m && (cat === 'dragpack' || cat === 'wheeliebar' || cat === 'tires')) html += launchHtml(cat, it, car, m, lv);
  return html + '</div>';
}

// Launch check: run this car (with the part, if it's a product) off the line
// at full throttle and say whether it hooks, spins or wheelies.
const VERDICT = {
  hooks: ['good', 'Hooks clean', 'Leaves straight and flat.'],
  spin: ['bad', 'Spins the tires', 'More power than grip off the line.'],
  wheelie: ['good', 'Small wheelie', 'Front comes up a few inches. That\'s the fast way to leave.'],
  big: ['warn', 'Big wheelie', 'Nose is way up and it\'s losing time. Tune it out.'],
  stands: ['bad', 'Stands up', 'Way too much. You have to lift or it stands on the bumper.'],
};
function launchHtml(cat, it, car, m, lv) {
  const lv2 = it && fits(it, m) ? { ...lv, [cat]: it.stage } : lv;
  const sp = buildSpec(m, lv2, car.cond, car.tune, car.visual);
  const r = launchCheck(sp, sp.twoStep ? launchRpmSetting(sp, car) : null);
  const [cls, label, why] = VERDICT[r.verdict];
  const color = cls === 'good' ? 'var(--green)' : cls === 'warn' ? '#ff8a1a' : 'var(--red2)';
  const tip = r.verdict === 'big' || r.verdict === 'stands' ? (m.drive === 'RWD' && !lv2.wheeliebar ? ' Add wheelie bars, or stiffen the shocks / cut 1st-gear power in Garage → Tune → Drag launch.' : ' Garage → Tune → Drag launch: stiffer shocks, less power in 1st, or lower the bars.')
    : r.verdict === 'spin' ? (lv2.dragpack ? ' Loosen the drag shocks or drop rear tire pressure for more bite.' : ' A drag pack fixes that.') : '';
  return `<div class="pp-sec"><div class="pp-h">Launch check${it ? ' with this part' : ''}</div><div class="pp-eng">
    <div><small>Off the line</small><b style="color:${color}">${label}</b></div>
    <div><small>Front end</small><b>${r.inches ? `${r.inches}" up` : 'Down'}</b></div>
    <div><small>60 ft</small><b>${r.sixtyFt ? r.sixtyFt.toFixed(2) + 's' : '—'}</b></div></div>
    <p class="small muted">${esc(why + tip)}</p></div>`;
}

export function openPartProfile(opts) {
  const it = opts.pid ? ITEM_BY_ID[opts.pid] : null;
  const cat = opts.cat || it?.cat;
  return modal(`${PART_ICONS[cat] || '🔧'} ${CATEGORY_NAMES[cat] || cat}`, partProfileHtml({ ...opts, cat }), [{ label: 'Close', primary: true }]);
}
