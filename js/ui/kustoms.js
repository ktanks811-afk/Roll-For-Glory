// Vega Kustoms design studio: try paint, rims, tint, body kits, aero, lights
// and graphics on your car with a live preview, see what the show judges
// would think, then pay once and drive out with all of it.

import { openPanel, bind, esc, toast, confirm } from './dom.js';
import { game, fmtMoney, spend, activeCar, modelOf, levels } from '../core/state.js';
import { VISUAL_CATALOG, ITEM_BY_ID, CATEGORY_NAMES, LABOR_RATE, SALES_TAX, fits } from '../data/catalog.js';
import { PAINT_SWATCHES, WHEEL_COLORS } from '../data/parts.js';
import { shapeOf } from '../data/carShapes.js';
import { carName } from '../data/cars.js';
import { drawSideCar } from '../gfx2d/sideCar.js';
import { drawThumb } from './marketplace.js';
import { judge } from '../core/carshow.js';
import { RIM_BY_ID, RIM_COLS } from '../data/rims.js';
import { onRimsReady } from '../gfx2d/rimSprites.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';

export const TABS = [
  ['paint', 'Paint', ['paint']],
  ['rims', 'Rims', ['wheels']],
  ['tint', 'Tint', ['tint']],
  ['kit', 'Body kits', ['kit', 'frontBumper', 'rearBumper', 'skirts']],
  ['aero', 'Wings & hoods', ['spoiler', 'hood']],
  ['lights', 'Lights & glow', ['headlights', 'taillights', 'neon', 'exhaustTips']],
  ['graphics', 'Graphics', ['decal']],
  ['interior', 'Interior', ['interior']],
];
// Services that aren't a new part.
export const POWDER_COAT = { name: 'Powder-coat wheels', price: 450 };
export const FITTING = { name: 'Wheel & tire fitting (size/offset)', price: 180 };
export const REPRINT = { name: 'Reprint graphics in a new color', price: 250 };
const WHEEL_SIZES = [17, 18, 19, 20, 21, 22];
const SCORE_LABELS = { paint: 'Paint', wheels: 'Wheels', body: 'Body & aero', details: 'Details', engine: 'Under the hood', cohesion: 'Hangs together', condition: 'Condition', rarity: 'Rarity' };

// Put a catalog product on a visual (same rules as installing it in the garage).
export function applyVisual(v, p, color) {
  if (p.cat === 'paint') { v.finish = p.value; if (color) v.paint = color; }
  else if (p.cat === 'wheels') { v.wheels = p.value; v.rim = p.rim || null; v.wheelColor = p.rim ? p.color : color || p.color; }
  else v[p.cat] = p.value;
  if (p.cat === 'decal' && color) v.decalColor = color;
}

// Everything the draft costs compared with the car as it is now.
export function quote(car, draft, picks) {
  const cur = car.visual;
  const lines = [];
  const all = { ...picks };
  // a new colour is a respray: use the cheapest one in the chosen finish
  if (!all.paint && (draft.paint !== cur.paint || draft.finish !== cur.finish)) {
    const resp = VISUAL_CATALOG.filter(p => p.cat === 'paint' && p.value === draft.finish).sort((a, b) => a.price - b.price)[0];
    if (resp) all.paint = resp.id;
  }
  for (const pid of Object.values(all)) {
    const p = ITEM_BY_ID[pid];
    lines.push({ name: `${p.brand} ${p.name}`, part: p.price, labor: p.labor * LABOR_RATE, hours: p.labor, cat: p.cat });
  }
  if (!all.wheels && draft.wheelColor !== cur.wheelColor) lines.push({ name: POWDER_COAT.name, part: 0, labor: POWDER_COAT.price, hours: 4 });
  if ((draft.wheelSize || '') !== (cur.wheelSize || '') || (draft.offset || 'flush') !== (cur.offset || 'flush')) lines.push({ name: FITTING.name, part: 0, labor: FITTING.price, hours: 1 });
  if (!all.decal && draft.decal !== 'none' && draft.decalColor !== cur.decalColor) lines.push({ name: REPRINT.name, part: 0, labor: REPRINT.price, hours: 2 });
  const parts = lines.reduce((a, l) => a + l.part, 0);
  const labor = lines.reduce((a, l) => a + l.labor, 0);
  const tax = Math.round(parts * SALES_TAX * 100) / 100;
  return { lines, parts, labor, tax, total: Math.round((parts + labor + tax) * 100) / 100, hours: lines.reduce((a, l) => a + l.hours, 0), picks: all };
}

export function openKustoms(app) {
  const s = game.s;
  const car = activeCar(s);
  const st = { tab: 'paint', draft: { ...car.visual }, picks: {}, view: 'side' };
  const h = openPanel((root, hh) => render(root, hh, app, st, s, car), { cls: 'kustoms' });
  // redraw the preview once the rim pack art has loaded
  onRimsReady(() => { const cv = h.root.querySelector('[data-side]'); if (cv) drawSideCar(cv, { model: modelOf(car), visual: st.draft, levels: levels(car), tune: car.tune, cond: car.cond }); });
  return h;
}

function render(root, h, app, st, s, car) {
  const m = modelOf(car);
  const d = st.draft;
  const q = quote(car, d, st.picks);
  const sc = judge(m, d, car.cond, levels(car));
  const was = judge(m, car.visual, car.cond, levels(car)).total;
  const tab = TABS.find(t => t[0] === st.tab);
  const swatch = (c, on, act, extra = '') => `<span class="swatch ${on ? 'on' : ''}" style="background:${c}" data-action="${act}" data-c="${c}" ${extra}></span>`;
  const optList = cat => {
    const items = VISUAL_CATALOG.filter(p => p.cat === cat && fits(p, m));
    const curVal = car.visual[cat];
    return `<div class="section-title">${esc(CATEGORY_NAMES[cat])}</div><div class="ks-opts">
      <button class="ks-opt ${!st.picks[cat] ? 'on' : ''}" data-action="keep" data-cat="${cat}"><b>Keep what's on it</b><small>${esc(String(curVal ?? 'stock'))}</small></button>
      ${cat === 'wheels' ? '' : items.map(p => `<button class="ks-opt ${st.picks[cat] === p.id ? 'on' : ''}" data-action="pick" data-id="${p.id}"><b>${esc(p.brand.startsWith('(') ? p.name : p.brand)}</b><small>${esc(p.brand.startsWith('(') ? '' : p.name)}</small><span>${fmtMoney(p.price)}${p.labor > 1 ? ` + ${p.labor}h` : ''}</span></button>`).join('')}
    </div>${cat === 'wheels' ? wheelLists(items) : ''}`;
  };
  const opt = p => `<button class="ks-opt ${st.picks[p.cat] === p.id ? 'on' : ''}" data-action="pick" data-id="${p.id}"><b>${esc(p.brand.startsWith('(') ? p.name : p.brand)}</b><small>${esc(p.brand.startsWith('(') ? '' : p.name)}</small><span>${fmtMoney(p.price)}${p.labor > 1 ? ` + ${p.labor}h` : ''}</span></button>`;
  const rimOpt = p => { const r = RIM_BY_ID[p.rim]; return `<button class="ks-opt ks-rim ${st.picks.wheels === p.id ? 'on' : ''}" data-action="pick" data-id="${p.id}"><i style="background-position:${-(r.i % RIM_COLS) * 56}px ${-Math.floor(r.i / RIM_COLS) * 56}px"></i><small>${esc(r.name)}</small><span>${fmtMoney(p.price)}</span></button>`; };
  const wheelLists = items => `<div class="section-title">Glitch rim pack</div><div class="ks-opts ks-rims">${items.filter(p => p.rim).map(rimOpt).join('')}</div>
    <div class="section-title">More wheels</div><div class="ks-opts">${items.filter(p => !p.rim).map(opt).join('')}</div>`;
  const extras = {
    paint: `<div class="section-title">Color</div><div class="opts">${PAINT_SWATCHES.map(c => swatch(c, d.paint === c, 'paint')).join('')}</div>
      <label class="field" style="margin-top:8px"><span>Any color</span><input type="color" data-color="paint" value="${d.paint}" class="input" style="height:40px;padding:2px"></label>
      <p class="small muted">A new color is a respray. Pick a paint or wrap below, or Manny uses the cheapest one in the finish you have.</p>`,
    wheels: d.rim ? '<p class="small muted">Glitch rims come in their own finish. Pick a different wheel to choose a color.</p>' + sizeHtml() : `<div class="section-title">Wheel color</div><div class="opts">${WHEEL_COLORS.map(c => swatch(c, d.wheelColor === c, 'wcolor')).join('')}</div>
      <p class="small muted">${st.picks.wheels ? 'New wheels come in this color.' : `Keeping your wheels? A new color is a ${fmtMoney(POWDER_COAT.price)} powder coat.`}</p>` + sizeHtml(),
    decal: d.decal !== 'none' ? `<div class="section-title">Graphics color</div><div class="opts">${PAINT_SWATCHES.map(c => swatch(c, d.decalColor === c, 'dcolor')).join('')}</div>` : '',
  };
  function sizeHtml() {
    return `<div class="section-title">Size & stance</div><div class="opts">${WHEEL_SIZES.map(n => `<button class="${(+d.wheelSize || shapeOf(m).rim || 19) === n ? 'on' : ''}" data-action="wsize" data-n="${n}">${n}"</button>`).join('')}</div>
      <div class="opts" style="margin-top:6px">${['stock', 'flush', 'poke'].map(o => `<button class="${(d.offset || 'flush') === o ? 'on' : ''}" data-action="offset" data-o="${o}">${o}</button>`).join('')}</div>`;
  }
  root.innerHTML = `<div class="p-head"><h1>Design studio<small>Vega Kustoms · ${esc(carName(m, car.year))}</small></h1><button class="btn x" data-action="close">×</button></div>
    <div class="tabs">${TABS.map(([id, l]) => `<button class="${st.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${l}</button>`).join('')}</div>
    <div class="p-body"><div class="garage ks"><div class="ks-preview">
      <div class="${st.view === 'side' ? 'showroom' : 'garage-view'}">${st.view === 'side' ? '<div class="sr-stage"><canvas data-side></canvas></div>' : '<canvas width="640" height="360" data-top></canvas>'}</div>
      <div class="row" style="margin:8px 0;gap:6px;flex-wrap:wrap"><button class="btn btn-sm" data-action="view">${st.view === 'side' ? 'Top view' : 'Side view'}</button><button class="btn btn-sm" data-action="reset" ${q.lines.length ? '' : 'disabled'}>Start over</button>
        <span class="grow"></span><span class="ks-score" title="What car show judges would give it">Show score <b>${sc.total}</b>${sc.total !== was ? ` <small class="${sc.total > was ? 'good' : 'bad'}">${sc.total > was ? '+' : ''}${sc.total - was}</small>` : ''}</span></div>
      <div class="ks-bars">${Object.entries(sc.parts).filter(([k]) => k !== 'rarity').map(([k, v]) => `<div><span>${SCORE_LABELS[k]}</span><i style="width:${Math.max(0, Math.min(100, v * 5))}%" class="${v < 0 ? 'neg' : ''}"></i><b>${v}</b></div>`).join('')}</div>
      <div class="ks-cart">${q.lines.length ? `${q.lines.map(l => `<div><span>${esc(l.name)}</span><b>${fmtMoney(l.part + l.labor)}</b></div>`).join('')}
        <div class="muted small"><span>Parts ${fmtMoney(q.parts)} · labor ${fmtMoney(q.labor)} · tax ${fmtMoney(q.tax)}</span></div>
        <div class="ks-total"><span>Total</span><b>${fmtMoney(q.total)}</b></div>
        <button class="btn btn-primary" data-action="book" style="width:100%">Build it · ${fmtMoney(q.total)}</button>` : '<p class="small muted" style="margin:0">Pick anything on the right to try it on. Nothing is charged until you build it.</p>'}</div>
    </div><div class="ks-pick">${tab[2].map(cat => (extras[cat] || '') + optList(cat)).join('')}</div></div></div>`;
  if (st.view === 'side') drawSideCar(root.querySelector('[data-side]'), { model: m, visual: d, levels: levels(car), tune: car.tune, cond: car.cond });
  else drawThumb(root.querySelector('[data-top]'), m, d, car.parts, car.cond);
  const keepScroll = fn => { const b = root.querySelector('.ks-pick'), y = b?.scrollTop || 0, py = root.querySelector('.p-body')?.scrollTop || 0; fn(); h.refresh(); const b2 = root.querySelector('.ks-pick'); if (b2) b2.scrollTop = y; const p2 = root.querySelector('.p-body'); if (p2) p2.scrollTop = py; };
  const restore = cat => {   // undo a pick: put the car's current look back for that slot
    const cur = car.visual;
    if (cat === 'paint') { d.finish = cur.finish; }
    else if (cat === 'wheels') { d.wheels = cur.wheels; d.wheelColor = cur.wheelColor; d.rim = cur.rim; }
    else d[cat] = cur[cat];
    if (cat === 'decal') d.decalColor = cur.decalColor;
  };
  root.querySelector('[data-color="paint"]')?.addEventListener('change', e => keepScroll(() => { d.paint = e.target.value; }));
  bind(root, {
    close: () => h.close(),
    tab: x => { st.tab = x.id; h.refresh(); },
    view: () => { st.view = st.view === 'side' ? 'top' : 'side'; h.refresh(); },
    reset: () => { st.draft = { ...car.visual }; st.picks = {}; h.refresh(); },
    keep: x => keepScroll(() => { delete st.picks[x.cat]; restore(x.cat); }),
    pick: x => keepScroll(() => {
      const p = ITEM_BY_ID[x.id];
      st.picks[p.cat] = p.id;
      applyVisual(d, p, p.cat === 'paint' ? d.paint : p.cat === 'wheels' ? (d.wheelColor !== car.visual.wheelColor ? d.wheelColor : p.color) : p.cat === 'decal' ? d.decalColor : undefined);
    }),
    paint: x => keepScroll(() => { d.paint = x.c; }),
    wcolor: x => keepScroll(() => { d.wheelColor = x.c; }),
    dcolor: x => keepScroll(() => { d.decalColor = x.c; }),
    wsize: x => keepScroll(() => { d.wheelSize = String(x.n); }),
    offset: x => keepScroll(() => { d.offset = x.o; }),
    book: async () => {
      const qq = quote(car, d, st.picks);
      if (!(await confirm('Build it?', `<p>Manny's crew does all of it today${qq.hours > 12 ? ' (they stay late)' : ''}.</p><p><b>${fmtMoney(qq.total)}</b> for ${qq.lines.length} job${qq.lines.length === 1 ? '' : 's'}.</p>`, 'Pay & build'))) return;
      if (!spend(s, qq.total, 'Vega Kustoms build')) return;
      Object.assign(car.visual, d);
      for (const pid of Object.values(qq.picks)) emit('partInstalled', { pid, cat: ITEM_BY_ID[pid].cat });
      emit('kustomBuild', { total: qq.total, jobs: qq.lines.length });
      audio.buy();
      app?.world?.refreshCar();
      toast(`Manny: "Now that's a car." · ${qq.lines.length} job${qq.lines.length === 1 ? '' : 's'} done`, 'good');
      st.draft = { ...car.visual }; st.picks = {};
      h.refresh();
    },
  });
}
