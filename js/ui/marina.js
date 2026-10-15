// The marina: the boat dealer, your boats (take one out, haul it, charter it,
// throw a party on it, sell it) and the yacht customizer. Rules are
// core/boats.js, the catalog data/boats.js, the art gfx2d/boatArt.js.

import { openPanel, bind, esc, toast, confirm, modal } from './dom.js';
import { game, fmtMoney, spend, earn, canAfford, isNight } from '../core/state.js';
import { BOATS, BOAT_BY_ID, MARINAS, MARINA_BY_ID, KIND_NAME, HULL_COLORS, FINISHES, WRAPS, DECKS, TINTS, INTERIORS, UPHOLSTERY, GLOWS, FONTS, FLAGS, HORNS, SOUND, ENGINES, DRIVES, AMENITIES, CREW, ft, knots, isBig, defaultCustom } from '../data/boats.js';
import { ensureBoats, fleet, defOf, boatName, canBerth, buyBoat, sellBoat, resaleOf, customLines, applyCustom, boatSpec, luxScore, haulQuote, haulBoat, launchBlock, repairCost, slipFee, crewWages, charterRate, partyQuote, throwParty } from '../core/boats.js';
import { drawBoatSide } from '../gfx2d/boatArt.js';
import { saveGame } from '../core/save.js';
import { audio } from '../core/audio.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const mph = ms => Math.round(ms * 2.237);
const kn = ms => Math.round(knots(ms));

// draw side views into every <canvas data-boat> in root
function paintThumbs(root, getLook) {
  root.querySelectorAll('canvas[data-boat]').forEach(c => {
    const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(200, r.width || 280), h = Math.max(90, r.height || 120);
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const [def, cu] = getLook(c.dataset.boat);
    drawBoatSide(g, def, cu, w, h, { night: isNight(game.s.time) });
  });
}

export function openMarina(loc, app, tab0) {
  const s = game.s;
  ensureBoats(s);
  const m = MARINA_BY_ID[loc.id];
  let tab = tab0 || (fleet(s).some(b => b.marina === m.id) ? 'mine' : 'dealer');
  openPanel((root, h) => {
    const here = fleet(s).filter(b => b.marina === m.id), away = fleet(s).filter(b => b.marina !== m.id);
    const tabs = [['dealer', 'Boat dealer'], ['mine', `My boats${fleet(s).length ? ` (${fleet(s).length})` : ''}`]];
    const sub = `${m.area} · ${m.deep ? 'deep water, takes superyachts' : 'boats up to 80 ft'}`;
    let body = '';
    if (tab === 'dealer') {
      body = `<p class="muted small">${esc(m.blurb)} Boats you buy here keep their slip here. Haul them to another marina any time.</p>
      ${['pwc', 'small', 'yacht', 'superyacht'].map(grp => {
        const list = BOATS.filter(d => grp === 'pwc' ? d.kind === 'pwc' : grp === 'small' ? !['pwc', 'yacht', 'superyacht'].includes(d.kind) : d.kind === grp);
        return `<div class="section-title">${{ pwc: 'Jet skis', small: 'Boats', yacht: 'Yachts', superyacht: 'Superyachts' }[grp]}</div><div class="grid">${list.map(d => {
          const ok = canBerth(d, m);
          return `<div class="card"><canvas data-boat="${d.id}" style="width:100%;height:120px;display:block;border-radius:8px;margin-bottom:8px"></canvas>
          <h3>${esc(d.name)}</h3><p class="muted small">${esc(d.desc)}</p>
          <p class="small">${KIND_NAME[d.kind]} · ${ft(d.L)} ft · ${kn(d.top)} knots (${mph(d.top)} mph) · ${d.seats} aboard</p>
          ${ok ? '' : '<p class="small bad">Too big for this marina. Deep-water marinas: Trinity Harbor, Lewisville, Miami.</p>'}
          <div class="row" style="justify-content:space-between;margin-top:8px"><b>${fmtMoney(d.price)}</b>
          <button class="btn btn-sm btn-primary" data-action="buy" data-id="${d.id}" ${ok && canAfford(s, d.price) ? '' : 'disabled'}>Buy</button></div></div>`;
        }).join('')}</div>`;
      }).join('')}`;
    } else {
      const row = b => {
        const d = defOf(b), why = launchBlock(s, b);
        return `<div class="card"><canvas data-boat="${b.uid}" style="width:100%;height:120px;display:block;border-radius:8px;margin-bottom:8px"></canvas>
          <h3>${esc(boatName(b))}</h3><p class="small muted">${b.custom.name ? `${esc(d.name)} · ` : ''}${ft(d.L)} ft · ${kn(boatSpec(b).top)} knots · hull ${Math.round(b.cond ?? 100)}% · ${Math.round(b.hours || 0)} engine hours</p>
          <p class="small">${b.marina === m.id ? 'In its slip here.' : `At ${esc(MARINA_BY_ID[b.marina]?.name || '?')}.`} Slip ${fmtMoney(slipFee(b))}/day${crewWages(b) ? ` · crew ${fmtMoney(crewWages(b))}/day` : ''}${b.charter ? ` · <b class="good">on charter, ${fmtMoney(charterRate(s, b))}/day</b>` : ''}${b.owed ? ` · <b class="bad">owes ${fmtMoney(b.owed)}</b>` : ''}</p>
          <div class="row" style="margin-top:8px">
            ${b.marina === m.id ? `<button class="btn btn-sm btn-primary" data-action="launch" data-uid="${b.uid}" ${why ? 'disabled' : ''}>Take it out</button>` : ''}
            <button class="btn btn-sm" data-action="custom" data-uid="${b.uid}">Customize</button>
            ${(b.cond ?? 100) < 99 ? `<button class="btn btn-sm" data-action="repair" data-uid="${b.uid}">Repair ${fmtMoney(repairCost(b))}</button>` : ''}
            ${b.owed ? `<button class="btn btn-sm" data-action="payowed" data-uid="${b.uid}">Pay ${fmtMoney(b.owed)}</button>` : ''}
            ${b.marina === m.id && d.L >= 9 ? `<button class="btn btn-sm" data-action="party" data-uid="${b.uid}">🎉 Party</button>` : ''}
            <button class="btn btn-sm" data-action="charter" data-uid="${b.uid}">${b.charter ? 'End charter' : 'Charter it out'}</button>
            ${b.marina !== m.id ? `<button class="btn btn-sm" data-action="haul" data-uid="${b.uid}">Haul it here</button>` : `<button class="btn btn-sm" data-action="haulto" data-uid="${b.uid}">Haul to…</button>`}
            <button class="btn btn-sm" data-action="sell" data-uid="${b.uid}">Sell ${fmtMoney(resaleOf(s, b))}</button>
          </div>${why && b.marina === m.id ? `<p class="small bad" style="margin-top:6px">${esc(why)}</p>` : ''}</div>`;
      };
      body = here.length || away.length ? `${here.length ? `<div class="section-title">Here at ${esc(m.name)}</div><div class="grid">${here.map(row).join('')}</div>` : ''}
        ${away.length ? `<div class="section-title">At other marinas</div><div class="grid">${away.map(row).join('')}</div>` : ''}`
        : '<p class="muted">No boats yet. The dealer has jet skis from under $10k and superyachts for the real ones.</p>';
    }
    root.innerHTML = head(m.name, sub) + `<div class="tabs">${tabs.map(([id, l]) => `<button class="${tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${l}</button>`).join('')}</div><div class="p-body" style="max-width:1000px">${body}</div>`;
    requestAnimationFrame(() => paintThumbs(root, id => { const b = fleet(s).find(x => x.uid === id); return b ? [defOf(b), b.custom] : [BOAT_BY_ID[id], defaultCustom(BOAT_BY_ID[id])]; }));
    const byUid = d => fleet(s).find(b => b.uid === d.uid);
    bind(root, {
      close: () => h.close(),
      tab: d => { tab = d.id; h.refresh(); },
      buy: async d => {
        const def = BOAT_BY_ID[d.id];
        if (!await confirm(`Buy the ${def.name}?`, `<p>${fmtMoney(def.price)}. It keeps a slip here at ${esc(m.name)} for ${fmtMoney(Math.round(ft(def.L) * (m.state === 'fl' ? 9 : m.deep ? 5 : 3)))} a day.</p><p class="muted small">Customize it after: paint, wraps, interior, lights, engines, a name on the back.</p>`, 'Buy')) return;
        const r = buyBoat(s, d.id, m.id, spend);
        if (!r.ok) { toast(r.text, 'bad'); audio.error?.(); return; }
        audio.buy?.();
        toast(`🛥 The ${def.name} is yours. It's in its slip.`, 'good');
        saveGame('auto', true); tab = 'mine'; h.refresh();
      },
      launch: d => {
        const b = byUid(d), w = app.world;
        if (!w) return;
        const r = w.boats.launch(b);
        if (!r.ok) { toast(r.text, 'bad'); return; }
        h.close();
        toast(`🌊 ${boatName(b)} is off the dock. Gas to go, brake to back up. Tie up at any marina on this water.`, 'good');
      },
      custom: d => openCustomizer(app, byUid(d), () => h.refresh()),
      repair: d => {
        const b = byUid(d), c = repairCost(b);
        if (!spend(s, c, `Boat repair: ${boatName(b)}`)) { toast('You\'re short for that.', 'bad'); return; }
        b.cond = 100; toast('Hull patched and polished. Good as new.', 'good'); saveGame('auto', true); h.refresh();
      },
      payowed: d => { const b = byUid(d); if (spend(s, b.owed, `Marina fees: ${boatName(b)}`)) { b.owed = 0; toast('Paid up. The marina let it go.', 'good'); h.refresh(); } else toast('You\'re short for that.', 'bad'); },
      charter: d => {
        const b = byUid(d);
        b.charter = !b.charter;
        toast(b.charter ? `On charter: about ${fmtMoney(charterRate(s, b))} a day while it's out. ${b.custom.crew.includes('captain') ? '' : 'Hire a captain and it books better.'}` : 'Off charter. It\'s yours to use.', 'good');
        saveGame('auto', true); h.refresh();
      },
      party: async d => {
        const b = byUid(d), q = partyQuote(b);
        if (!await confirm(`Throw a party on ${boatName(b)}?`, `<p>Bottles, a DJ, food, the whole marina watching. <b>${fmtMoney(q.cost)}</b>.</p><p class="small muted">About +${q.followers.toLocaleString()} followers and +${q.rep} rep. The nicer the boat (interior, amenities, crew, sound), the bigger the turnout. Luxury score: ${luxScore(b)}.</p>`, 'Party')) return;
        const r = throwParty(s, b, spend);
        if (!r.ok) { toast(r.text, 'bad'); return; }
        audio.buy?.();
        toast(`🎉 The party went crazy. +${r.followers.toLocaleString()} followers, +${r.rep} rep.`, 'good');
        s.feed?.unshift?.({ id: 'post' + Date.now().toString(36), mine: true, day: s.time.day, t: '', text: `Yacht party on ${b.custom.name || defOf(b).name} 🛥🍾 ${m.area}`, likes: Math.round(r.followers * 2.5), comments: [] });
        saveGame('auto', true); h.refresh();
      },
      haul: async d => { await doHaul(byUid(d), m.id); h.refresh(); },
      haulto: async d => {
        const b = byUid(d);
        const opts = MARINAS.filter(x => x.id !== b.marina).map(x => { const q = haulQuote(b, x.id); return { label: q?.block ? `${x.name} (too small)` : `${x.name} · ${fmtMoney(q.fee)}`, value: q?.block ? '' : x.id }; });
        const to = await modal(`Haul ${boatName(b)}`, '<p>Where to? Small boats go on a trailer the same day; big ones take a day on a heavy-haul truck. Miami is by ship.</p>', [...opts, { label: 'Cancel', value: '' }]);
        if (to) { await doHaul(b, to); h.refresh(); }
      },
      sell: async d => {
        const b = byUid(d);
        if (!await confirm(`Sell ${boatName(b)}?`, `<p>The broker pays <b>${fmtMoney(resaleOf(s, b))}</b>${b.owed ? `, minus ${fmtMoney(b.owed)} you owe the marina` : ''}.</p>`, 'Sell', true)) return;
        const r = sellBoat(s, b.uid, earn);
        if (r.ok) { toast(`Sold for ${fmtMoney(r.paid)}.`, 'good'); saveGame('auto', true); h.refresh(); }
      },
    });
  });
}

async function doHaul(b, toId) {
  const s = game.s, q = haulQuote(b, toId);
  if (!q || q.block) { toast(q?.block || 'Already there.', 'bad'); return; }
  if (!await confirm(`Haul it to ${MARINA_BY_ID[toId].name}?`, `<p>${fmtMoney(q.fee)}. ${q.days ? `It gets there in ${q.days} day${q.days > 1 ? 's' : ''}.` : 'It\'s there today.'}</p>`, 'Haul it')) return;
  const r = haulBoat(s, b, toId, spend);
  toast(r.ok ? `On its way to ${MARINA_BY_ID[toId].name}.` : r.text, r.ok ? 'good' : 'bad');
  if (r.ok) saveGame('auto', true);
}

// ---------------------------------------------------------------- the customizer
const SECTIONS = [
  ['paint', '🎨 Paint'], ['graphics', '🔥 Graphics'], ['top', '🛳 Upper decks'], ['inside', '🛋 Deck & interior'], ['lights', '💡 Lights'],
  ['name', '✍ Name'], ['flag', '🏴 Flag, horn, sound'], ['perf', '⚙ Engines'], ['amen', '🚁 Amenities'], ['crew', '👨‍✈️ Crew'],
];

export function openCustomizer(app, boat, onDone) {
  const s = game.s, def = defOf(boat);
  let cu = JSON.parse(JSON.stringify(boat.custom)), sec = 'paint', raf = 0, scrollY = 0;
  openPanel((root, h) => {
    const yacht = def.L >= 15;
    const sw = (key, list) => `<div class="row" style="gap:8px">${list.map(([c, n]) => `<button class="swatch ${cu[key] === c ? 'on' : ''}" title="${esc(n)}" style="background:${c === 'none' ? 'repeating-linear-gradient(45deg,#333 0 4px,#111 4px 8px)' : c === 'rainbow' ? 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' : c}" data-action="set" data-k="${key}" data-v="${c}"></button>`).join('')}
      ${list === HULL_COLORS || list === UPHOLSTERY ? `<label class="swatch" title="Any color" style="background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);position:relative;overflow:hidden"><input type="color" data-k="${key}" value="${/^#[0-9a-f]{6}$/i.test(cu[key]) ? cu[key] : '#ffffff'}" style="opacity:0;position:absolute;inset:0;width:100%;height:100%"></label>` : ''}</div>`;
    const chips = (key, list, label = x => x.name) => `<div class="row" style="gap:6px">${list.map(x => `<button class="chip ${cu[key] === x.id ? 'on' : ''}" data-action="set" data-k="${key}" data-v="${x.id}">${esc(label(x))}</button>`).join('')}</div>`;
    const area = def.L * def.W;
    let body = '';
    if (sec === 'paint') body = `<div class="section-title">Hull color</div>${sw('hull', HULL_COLORS)}
      <div class="section-title">Finish</div>${chips('finish', FINISHES, x => x.per ? `${x.name} +${fmtMoney(area * x.per)}` : x.name)}`;
    else if (sec === 'graphics') body = `<div class="section-title">Wrap / graphics</div>${chips('wrap', WRAPS)}
      <div class="section-title">Graphics color</div>${sw('hull2', HULL_COLORS)}<div class="section-title">Stripe color</div>${sw('stripe', HULL_COLORS)}`;
    else if (sec === 'top') body = `<div class="section-title">Superstructure color</div>${sw('sup', HULL_COLORS)}<div class="section-title">Window tint</div>${chips('tint', TINTS)}`;
    else if (sec === 'inside') body = `<div class="section-title">Decking</div>${chips('deck', DECKS)}
      <div class="section-title">Interior theme</div><div class="list">${INTERIORS.map(x => `<div class="li click ${cu.interior === x.id ? 'on' : ''}" data-action="set" data-k="interior" data-v="${x.id}" style="${cu.interior === x.id ? 'border-color:var(--red)' : ''}"><div class="grow"><div class="t">${esc(x.name)}${x.lux ? ` <small class="muted">+${x.lux} luxury</small>` : ''}</div><div class="s">${esc(x.desc)}</div></div></div>`).join('')}</div>
      <div class="section-title">Upholstery</div>${sw('uph', UPHOLSTERY)}`;
    else if (sec === 'lights') body = `<div class="section-title">Underwater lights</div>${sw('under', GLOWS)}<p class="small muted">Lights up the water under the hull at night.</p>
      <div class="section-title">Deck LED strips</div>${sw('accent', GLOWS)}`;
    else if (sec === 'name') body = `<div class="section-title">Boat name</div><input class="input" maxlength="22" data-text="name" value="${esc(cu.name)}" placeholder="Name it (painted on the stern)">
      <div class="section-title">Hailing port</div><input class="input" maxlength="26" data-text="port" value="${esc(cu.port)}" placeholder="FORT WORTH, TX">
      <div class="section-title">Lettering</div>${chips('font', FONTS)}<div class="section-title">Lettering color</div>${sw('nameColor', [['#c9a45a', 'Gold'], ['#f4f4f2', 'White'], ['#0d0d10', 'Black'], ['#c41b1b', 'Red'], ['#21b8d8', 'Teal'], ['#9aa0a8', 'Silver'], ['#ff3aa8', 'Pink']])}`;
    else if (sec === 'flag') body = `<div class="section-title">Flag</div>${chips('flag', FLAGS)}<div class="section-title">Horn</div>${chips('horn', HORNS, x => x.price ? `${x.name} ${fmtMoney(x.price)}` : x.name)}
      <div class="section-title">Sound system</div>${chips('sound', SOUND, x => x.price ? `${x.name} ${fmtMoney(x.price * Math.max(1, def.L / 10))}` : x.name)}`;
    else if (sec === 'perf') { const sp = boatSpec({ ...boat, custom: cu }); body = `<div class="section-title">Engines</div><div class="list">${ENGINES.map(e => `<div class="li click" data-action="set" data-k="engine" data-v="${e.n}" style="${cu.engine === e.n ? 'border-color:var(--red)' : ''}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${kn(def.top * e.top)} knots top · ${e.cost ? fmtMoney(def.price * e.cost) : 'stock'}</div></div></div>`).join('')}</div>
      <div class="section-title">Drive</div>${chips('drive', DRIVES, x => x.cost ? `${x.name} ${fmtMoney(def.price * x.cost)}` : x.name)}
      <p class="small" style="margin-top:10px">With this setup: <b>${kn(sp.top)} knots</b> (${mph(sp.top)} mph).</p>`; }
    else if (sec === 'amen') body = yacht ? `<p class="small muted">Add-ons go in for good. Bigger boats fit more.</p><div class="list">${AMENITIES.map(a => { const fits = def.L >= a.min, on = cu.amen.includes(a.id), had = boat.custom.amen.includes(a.id); return `<div class="li ${fits && !had ? 'click' : ''}" ${fits && !had ? `data-action="amen" data-id="${a.id}"` : ''} style="${on ? 'border-color:var(--red)' : ''};${fits ? '' : 'opacity:.45'}"><div class="grow"><div class="t">${on ? '✓ ' : ''}${esc(a.name)}</div><div class="s">${had ? 'Installed' : fits ? `${fmtMoney(a.price)} · +${a.lux} luxury` : `Needs a boat ${ft(a.min)} ft or longer`}</div></div></div>`; }).join('')}</div>` : '<p class="muted">Amenities fit boats 50 ft and up.</p>';
    else if (sec === 'crew') body = yacht ? `<p class="small muted">Crew get paid every morning. A captain makes your boat book better on charter.</p><div class="list">${CREW.map(c => { const fits = def.L >= c.min, on = cu.crew.includes(c.id); return `<div class="li ${fits ? 'click' : ''}" ${fits ? `data-action="crew" data-id="${c.id}"` : ''} style="${on ? 'border-color:var(--red)' : ''};${fits ? '' : 'opacity:.45'}"><div class="grow"><div class="t">${on ? '✓ ' : ''}${esc(c.name)}</div><div class="s">${fits ? `${fmtMoney(c.wage)} a day · +${c.lux} luxury` : `Needs a boat ${ft(c.min)} ft or longer`}</div></div></div>`; }).join('')}</div>` : '<p class="muted">Crew is for boats 50 ft and up.</p>';

    const lines = customLines(def, boat.custom, cu), total = lines.reduce((t, l) => t + l.cost, 0);
    const crewChanged = JSON.stringify(cu.crew) !== JSON.stringify(boat.custom.crew);
    root.innerHTML = head(`Customize ${boatName(boat)}`, `${def.name} · ${ft(def.L)} ft · luxury ${luxScore({ ...boat, custom: cu })}`) + `
      <div class="p-body yc-body">
        <canvas class="yc-side"></canvas>
        <div class="chips">${SECTIONS.map(([id, l]) => `<button class="chip ${sec === id ? 'on' : ''}" data-action="sec" data-id="${id}">${l}</button>`).join('')}</div>
        <div class="yc-opts">${body}</div>
        ${lines.length ? `<div class="section-title">The bill</div><div class="small muted">${lines.map(l => `${esc(l.label)} · ${fmtMoney(l.cost)}`).join('<br>')}</div>` : ''}
      </div>
      <div class="yc-foot"><div class="grow">${lines.length ? `${lines.length} change${lines.length > 1 ? 's' : ''}` : crewChanged ? 'Crew changes are free. Wages start tomorrow.' : 'Tap anything to try it on. Nothing is charged until you apply.'}</div>
        <button class="btn btn-sm" data-action="reset" ${lines.length || crewChanged ? '' : 'disabled'}>Reset</button>
        <button class="btn btn-primary" data-action="apply" ${(lines.length || crewChanged) && canAfford(s, total) ? '' : 'disabled'}>${total ? `Apply · ${fmtMoney(total)}` : 'Apply'}</button></div>`;
    // keep your place in the list when a tap redraws the panel
    const scroller = root.querySelector('.yc-body');
    scroller.scrollTop = scrollY;
    scroller.addEventListener('scroll', () => { scrollY = scroller.scrollTop; }, { passive: true });
    // the live preview, rocking on the water
    const cv = root.querySelector('.yc-side');
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const frame = () => {
      if (!cv.isConnected) return;
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBoatSide(g, def, cu, r.width, r.height, { t: (performance.now() - t0) / 1000, night: isNight(s.time), crewColor: s.crew?.color });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    root.querySelectorAll('input[type=color]').forEach(inp => inp.addEventListener('change', () => { cu[inp.dataset.k] = inp.value; h.refresh(); }));
    root.querySelectorAll('input[data-text]').forEach(inp => inp.addEventListener('change', () => { cu[inp.dataset.text] = inp.value.trim().slice(0, 26); h.refresh(); }));
    bind(root, {
      close: () => { cancelAnimationFrame(raf); h.close(); onDone?.(); },
      sec: d => { sec = d.id; h.refresh(); },
      set: d => { cu[d.k] = d.k === 'engine' ? +d.v : d.v; h.refresh(); },
      amen: d => { const i = cu.amen.indexOf(d.id); if (i >= 0) cu.amen.splice(i, 1); else cu.amen.push(d.id); h.refresh(); },
      crew: d => { const i = cu.crew.indexOf(d.id); if (i >= 0) cu.crew.splice(i, 1); else cu.crew.push(d.id); h.refresh(); },
      reset: () => { cu = JSON.parse(JSON.stringify(boat.custom)); h.refresh(); },
      apply: () => {
        const r = applyCustom(s, boat, cu, spend);
        if (!r.ok) { toast(r.text, 'bad'); audio.error?.(); return; }
        audio.buy?.();
        toast(r.cost ? `Done. ${fmtMoney(r.cost)} of work on ${boatName(boat)}.` : 'Saved.', 'good');
        app.world?.boats && (app.world.boats.active?.rec === boat) && (app.world.boats.active.spec = boatSpec(boat));
        saveGame('auto', true); h.refresh();
      },
    });
  });
}

// The "Boats" phone app: every boat you own and where it is.
export function openBoatsApp(app) {
  const s = game.s;
  ensureBoats(s);
  openPanel((root, h) => {
    const list = fleet(s);
    root.innerHTML = head('My Boats', 'Your fleet and the marinas') + `<div class="p-body" style="max-width:800px">
      ${list.length ? `<div class="grid">${list.map(b => `<div class="card"><canvas data-boat="${b.uid}" style="width:100%;height:110px;display:block;border-radius:8px;margin-bottom:8px"></canvas><h3>${esc(boatName(b))}</h3>
        <p class="small muted">${esc(defOf(b).name)} · at ${esc(MARINA_BY_ID[b.marina]?.name || '?')}${b.charter ? ' · on charter' : ''}</p>
        <div class="row" style="margin-top:6px"><button class="btn btn-sm" data-action="gps" data-id="${b.marina}">GPS to it</button><button class="btn btn-sm" data-action="custom" data-uid="${b.uid}">Customize</button></div></div>`).join('')}</div>`
        : '<p class="muted">You don\'t own a boat. Every marina has a dealer: jet skis, bass boats, wake boats, go-fasts, yachts and superyachts.</p>'}
      <div class="section-title">Marinas</div><div class="list">${MARINAS.map(m => `<div class="li"><div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${esc(m.area)}${m.state === 'fl' ? ' · Miami (fly there)' : ''}${m.deep ? ' · deep water' : ''}</div></div>${m.state === 'fl' ? '' : `<button class="btn btn-sm" data-action="gps" data-id="${m.id}">GPS</button>`}</div>`).join('')}</div>
    </div>`;
    requestAnimationFrame(() => paintThumbs(root, id => { const b = fleet(s).find(x => x.uid === id); return [defOf(b), b.custom]; }));
    bind(root, {
      close: () => h.close(),
      gps: d => { const m = MARINA_BY_ID[d.id]; app.world?.setGps(m.x, m.z, m.name); toast(`GPS set: ${m.name}`, 'info'); h.close(); },
      custom: d => openCustomizer(app, fleet(s).find(b => b.uid === d.uid), () => h.refresh()),
    });
  });
}

