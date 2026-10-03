// Phone app: Amazin' — a same-minute-delivery online store. Handguns (every
// Glock model), AR pistols, melee weapons, ammo and gear, plus your locker.
// Age gates and restricted items apply; deliveries land in your mailbox
// (straight into your inventory).

import { bind, esc, toast } from './dom.js';
import { fmtMoney, spend, tierOf } from '../core/state.js';
import { audio } from '../core/audio.js';
import { GLOCKS, ARPS, MELEE, GEAR, CAL, AMMO_BOX, ammoBoxPrice, WEAPON_BY_ID, ensureArms, buyWeapon, buyAmmo, minAge, canFrt, toggleFrt } from '../data/weapons.js';

const head = title => `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>${esc(title)}</h2></div>`;
const GLOCK_CALS = ['9mm', '.40 S&W', '10mm', '.45 ACP', '.380 ACP', '.357 SIG', '.45 GAP', '.22 LR'];

function specLine(d) {
  if (d.melee) return `${d.dmg} damage · reach ${d.reach} m`;
  const c = CAL[d.cal];
  return `${d.cal} · ${d.mag}-rd mag · ${c.dmg} dmg${d.auto ? ' · FULL AUTO' : ''} · ${d.year}`;
}

function card(d, s, tier) {
  const age = s.player.age < minAge(d);
  const locked = d.restricted && tier < d.restricted;
  const owned = ensureArms(s).guns.filter(g => g.id === d.id).length;
  return `<div class="li"><div class="grow"><div class="t">${esc(d.name)} ${owned ? `<span class="tag tag-green">Owned ${owned}</span>` : ''}${d.restricted ? '<span class="tag tag-red">Restricted</span>' : ''}</div>
    <div class="s">${esc(specLine(d))}</div>
    <div class="s"><b>${d.restricted && locked ? 'Not sold online' : fmtMoney(d.price)}</b>${age ? ` · <span class="bad">${minAge(d)}+ (ID check)</span>` : ''}${locked ? ` · <span class="bad">needs tier ${d.restricted}</span>` : ''}</div></div>
    <button class="btn btn-sm btn-primary" data-action="buy" data-id="${d.id}" ${age || locked ? 'disabled' : ''}>Buy</button></div>`;
}

export function renderShop(scr, ctx) {
  const s = ctx.s, a = ensureArms(s), tier = tierOf(s.rep).n;
  const st = ctx.st.shop ??= { tab: 'hand', cal: 'all', q: '', gen: 'all' };
  const tabs = [['hand', 'Handguns'], ['arp', 'AR Pistols'], ['melee', 'Melee'], ['ammo', 'Ammo'], ['gear', 'Gear'], ['mine', `My gear (${a.guns.length})`]];
  const done = r => { toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) audio.buy(); ctx.h.refresh(); };
  const tabBar = `<div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0">${tabs.map(([k, l]) => `<button class="btn btn-sm ${st.tab === k ? 'btn-primary' : ''}" data-action="tab" data-id="${k}">${l}</button>`).join('')}</div>`;
  const banner = `<div class="row" style="justify-content:space-between;align-items:center;background:#131a22;border-radius:8px;padding:8px 10px;margin-bottom:6px"><b style="color:#ff9900;font-size:18px">amazin'<span style="color:#ff9900">⌣</span></b><span class="small muted">same-minute delivery to your mailbox</span></div>`;
  let body = '';
  const listHtml = () => {
    const q = st.q.toLowerCase().trim();
    let list = st.tab === 'hand' ? GLOCKS : st.tab === 'arp' ? ARPS : MELEE;
    if (st.tab === 'hand' && st.cal !== 'all') list = list.filter(d => d.cal === st.cal);
    if (q) list = list.filter(d => (d.name + ' ' + d.cal + ' ' + d.year).toLowerCase().includes(q));
    return list.length ? list.map(d => card(d, s, tier)).join('') : '<div class="empty">Nothing matches.</div>';
  };
  if (st.tab === 'hand' || st.tab === 'arp' || st.tab === 'melee') {
    const chips = st.tab === 'hand' ? `<div class="row" style="gap:5px;flex-wrap:wrap;margin-bottom:6px">${['all', ...GLOCK_CALS].map(c => `<button class="btn btn-sm ${st.cal === c ? 'btn-primary' : ''}" data-action="cal" data-id="${c}">${c === 'all' ? 'All Glocks' : c}</button>`).join('')}</div>` : '';
    body = `<p class="small muted">${st.tab === 'hand' ? `Every Glock ever made — ${GLOCKS.length} models and generations. 21+ to buy; the full-auto Glock 18 is never sold online.` : st.tab === 'arp' ? 'AR-pattern pistols. They count as handguns: 21+.' : 'Melee weapons, 18+.'}</p>${chips}
      <input data-q class="field" placeholder="Search name, caliber, year…" value="${esc(st.q)}" style="width:100%;margin-bottom:6px"><div class="list" data-list>${listHtml()}</div>`;
  } else if (st.tab === 'ammo') {
    const cals = Object.keys(CAL);
    body = `<p class="small muted">Boxes of ${AMMO_BOX}. Your reserve: ${cals.filter(c => a.ammo[c]).map(c => `${a.ammo[c]} ${c}`).join(' · ') || 'none'}.</p>
      <div class="list">${cals.map(c => `<div class="li"><div class="grow"><div class="t">${c}</div><div class="s">${CAL[c].dmg} dmg · ${fmtMoney(ammoBoxPrice(c), true)} per box · you have ${a.ammo[c] || 0}</div></div>
        <button class="btn btn-sm btn-primary" data-action="ammo" data-cal="${c}" data-n="1">+1 box</button><button class="btn btn-sm" data-action="ammo" data-cal="${c}" data-n="5">+5</button></div>`).join('')}</div>`;
  } else if (st.tab === 'gear') {
    body = `<div class="list">${GEAR.map(g => {
      const have = g.id === 'vest' ? a.armor >= 1 : g.id === 'frt' ? false : a.holster;
      return `<div class="li"><div class="grow"><div class="t">${esc(g.name)}${have ? ' <span class="tag tag-green">Equipped</span>' : ''}</div><div class="s">${esc(g.blurb)}</div><div class="s"><b>${fmtMoney(g.price)}</b></div></div>
        <button class="btn btn-sm btn-primary" data-action="gear" data-id="${g.id}" ${have ? 'disabled' : ''}>${g.id === 'vest' && a.armor > 0 && a.armor < 1 ? 'Replace' : 'Buy'}</button></div>`;
    }).join('')}</div><p class="small muted">Health ${Math.round(a.hp)}/100 · Armor ${Math.round(a.armor * 100)}% · FRT kits in your mailbox: ${a.frtKits || 0}</p>`;
  } else {
    body = a.guns.length ? `<p class="small muted">Draw and holster with <b>G</b> (or the ARM button). Equip chooses what comes out. Robberies: draw a gun next to a gas station, diner or clothing store and press <b>E</b>.</p>
      <div class="list">${a.guns.map(g => {
        const d = WEAPON_BY_ID[g.id], eq = a.equipped === g.uid;
        return `<div class="li"><div class="grow"><div class="t">${esc(d.name)} ${eq ? '<span class="tag tag-green">Equipped</span>' : ''}${g.frt ? ' <span class="tag tag-red">FRT</span>' : ''}</div>
          <div class="s">${d.melee ? 'Melee' : `${g.loaded}/${d.mag} loaded · ${a.ammo[d.cal] || 0} ${d.cal} in reserve`}</div></div>
          <div style="text-align:right"><button class="btn btn-sm ${eq ? '' : 'btn-primary'}" data-action="equip" data-id="${g.uid}" ${eq ? 'disabled' : ''}>Equip</button>
          ${d.melee ? '' : `<button class="btn btn-sm" data-action="topoff" data-id="${g.uid}">Load</button>`}
          ${g.frt || canFrt(d) ? (g.frt ? `<button class="btn btn-sm" data-action="frt" data-id="${g.uid}">Remove FRT</button>` : `<button class="btn btn-sm" data-action="frt" data-id="${g.uid}" ${(a.frtKits || 0) ? '' : 'disabled'}>Install FRT</button>`) : ''}
          <button class="btn btn-sm" data-action="sell" data-id="${g.uid}">Sell ${fmtMoney(Math.round(d.price * 0.5))}</button></div></div>`;
      }).join('')}</div>` : '<div class="empty">No weapons yet. Browse Handguns or AR Pistols.</div>';
    body += `<p class="small muted">Stolen so far: ${fmtMoney(s.stats.stolen || 0)} in ${a.robberies} job${a.robberies === 1 ? '' : 's'}.</p>`;
  }
  scr.innerHTML = head("Amazin'") + `<div class="app-body">${banner}${tabBar}${body}</div>`;
  const rerender = () => { ctx.h.refresh(); };
  const handlers = {
    back: () => ctx.go(null),
    tab: d => { st.tab = d.id; st.q = ''; rerender(); },
    cal: d => { st.cal = d.id; rerender(); },
    buy: d => done(buyWeapon(s, d.id, tier, spend)),
    ammo: d => done(buyAmmo(s, d.cal, +d.n, spend)),
    gear: d => {
      const g = GEAR.find(x => x.id === d.id);
      if (g.id === 'frt' && s.player.age < 21) return done({ ok: false, text: 'FRT triggers are 21+.' });
      if (!spend(s, g.price, g.name)) return done({ ok: false, text: 'Not enough money.' });
      if (g.id === 'vest') a.armor = 1; else if (g.id === 'frt') a.frtKits = (a.frtKits || 0) + 1; else a.holster = true;
      done({ ok: true, text: `${g.name} delivered.` });
    },
    equip: d => { a.equipped = d.id; toast('Equipped.', 'good'); rerender(); },
    frt: d => {
      const r = toggleFrt(s, d.id);
      toast(r.text, r.ok ? (a.guns.find(x => x.uid === d.id)?.frt ? 'good' : 'info') : 'bad');
      rerender();
    },
    topoff: d => {
      const g = a.guns.find(x => x.uid === d.id), def = WEAPON_BY_ID[g.id];
      const put = Math.min(def.mag - g.loaded, a.ammo[def.cal] || 0);
      if (put <= 0) return toast(g.loaded >= def.mag ? 'Already full.' : `No ${def.cal} in reserve.`, 'bad');
      g.loaded += put; a.ammo[def.cal] -= put; audio.click(); rerender();
    },
    sell: d => {
      const g = a.guns.find(x => x.uid === d.id), def = WEAPON_BY_ID[g.id];
      a.guns = a.guns.filter(x => x.uid !== d.id);
      if (a.equipped === d.id) a.equipped = a.guns[0]?.uid || null;
      if (!def.melee) a.ammo[def.cal] = (a.ammo[def.cal] || 0) + g.loaded;
      s.cash += Math.round(def.price * 0.5);
      toast(`Sold for ${fmtMoney(Math.round(def.price * 0.5))}.`, 'good'); rerender();
    },
  };
  bind(scr, handlers);
  const q = scr.querySelector('[data-q]');
  if (q) q.addEventListener('input', () => { st.q = q.value; const l = scr.querySelector('[data-list]'); if (l) { l.innerHTML = listHtml(); bind(l, handlers); } });
}
