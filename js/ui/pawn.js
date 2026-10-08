// Cash Cow Pawn & Gold on East Lancaster. Two ways to get paid for what you
// stole: the front counter (better money, but Marcus runs every serial
// number and a hot item gets flagged to FWPD) and Dre in the back room (cash,
// no questions, pays less and less the hotter you are). The counter also
// buys your own guns legally.

import { openPanel, bind, esc, toast, confirm, modal } from './dom.js';
import { game, fmtMoney, earn } from '../core/state.js';
import { LOOT_BY_ID, LOOT_KINDS, PAWN } from '../data/loot.js';
import { WEAPON_BY_ID, ensureArms } from '../data/weapons.js';
import { ensureLoot, lootTotal, lootKind, hotness, flagChance, counterOffer, fenceShare, fenceOffer, sellToFence, pawnItem, ownGunOffer, sellOwnGun } from '../core/loot.js';
import { saveGame } from '../core/save.js';
import { audio } from '../core/audio.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const pct = x => `${Math.round(x * 100)}%`;
const risk = p => p >= 0.5 ? '<span class="bad">High</span>' : p >= 0.25 ? '<span style="color:#f0a020">Medium</span>' : p >= 0.08 ? 'Low' : 'Very low';
const heatWord = h => h >= 4 ? 'every cop in Fort Worth wants you' : h >= 3 ? 'very hot' : h >= 2 ? 'hot' : h >= 1 ? 'warm' : 'cool';

export function openPawn(loc, app) {
  const s = game.s;
  const w = app.world;
  if (w?.police?.phase === 'chase') { modal(loc.name, '<p>Marcus flips the sign to CLOSED when he sees the lights behind you. "Not today."</p>'); return; }
  let tab = 'fence';
  const picked = new Set();
  openPanel((root, h) => {
    const heat = s.heat || 0, share = fenceShare(s, heat);
    const items = ensureLoot(s).slice().sort((a, b) => b.value - a.value);
    for (const u of [...picked]) if (!items.some(i => i.uid === u)) picked.delete(u);
    const tabs = [['fence', 'Back room (Dre)'], ['counter', 'Pawn counter'], ['guns', 'Sell my guns']];
    const itemRow = (i, right) => `<div class="li"><span style="font-size:20px">${LOOT_BY_ID[i.id]?.icon || '📦'}</span><div class="grow"><div class="t">${esc(i.name)}</div>
      <div class="s">${LOOT_KINDS[lootKind(i)]} · street value ${fmtMoney(i.value)} · ${hotness(s, i) >= 0.8 ? '<span class="bad">hot</span>' : hotness(s, i) > 0.3 ? 'cooling off' : 'cold'} (${i.from ? `from ${esc(i.from)}, ` : ''}day ${i.day})</div></div>${right}</div>`;
    let body = '';
    if (tab === 'fence') {
      const sel = items.filter(i => picked.has(i.uid)), selPay = sel.reduce((t, i) => t + fenceOffer(s, i, heat), 0);
      body = share == null
        ? `<div class="card"><h3>Dre won't come out</h3><p class="muted">"You got the whole department on you. I ain't buying nothing from you till that dies down." Lose the heat first (lay low, or sleep it off at home).</p></div>`
        : `<p class="muted small">Dre pays cash and never asks. He's paying <b>${pct(share)}</b> of street value right now${heat >= 1 || (s.warrants || []).length ? ` (you're ${heatWord(heat)}${(s.warrants || []).length ? ', with a warrant out' : ''}, so he's cutting his price: at zero heat and no warrants he pays ${pct(PAWN.fence)})` : ''}.</p>
          ${items.length ? `<div class="list">${items.map(i => itemRow(i, `<label class="row" style="gap:6px;align-items:center"><b>${fmtMoney(fenceOffer(s, i, heat))}</b><input type="checkbox" data-action="pick" data-id="${i.uid}" ${picked.has(i.uid) ? 'checked' : ''} style="width:22px;height:22px"></label>`)).join('')}</div>
          <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-primary" data-action="fence" ${sel.length ? '' : 'disabled'}>Sell ${sel.length || ''} picked${sel.length ? ` for ${fmtMoney(selPay)}` : ''}</button>
            <button class="btn" data-action="fenceall">Sell everything for ${fmtMoney(items.reduce((t, i) => t + fenceOffer(s, i, heat), 0))}</button>
          </div>` : emptyBag}`;
    } else if (tab === 'counter') {
      body = `<p class="muted small">Marcus pays <b>${pct(PAWN.counter)}</b> of street value, but every phone, laptop, watch and gun goes into LeadsOnline while you wait. If it comes back stolen he keeps it and calls FWPD, and a warrant goes out for you. Gold with no serial is safe. Hot items cool off over about a week.</p>
        ${items.length ? `<div class="list">${items.map(i => itemRow(i, `<div style="text-align:right"><button class="btn btn-sm btn-primary" data-action="pawn" data-id="${i.uid}">Pawn ${fmtMoney(counterOffer(i))}</button><div class="s small">Flag risk: ${risk(flagChance(s, i))}</div></div>`)).join('')}</div>` : emptyBag}`;
    } else {
      const a = ensureArms(s);
      body = `<p class="muted small">Legal sale with paperwork: Marcus buys your own guns at ${pct(PAWN.ownGun)} of retail. Loaded rounds go back in your ammo. He won't touch a gun with an FRT or a switch in it.</p>
        ${a.guns.filter(g => !WEAPON_BY_ID[g.id]?.melee).length ? `<div class="list">${a.guns.filter(g => !WEAPON_BY_ID[g.id]?.melee).map(g => { const def = WEAPON_BY_ID[g.id]; return `<div class="li"><span style="font-size:20px">🔫</span><div class="grow"><div class="t">${esc(def.name)}${g.frt ? ' <small class="bad">FRT</small>' : ''}${g.sw ? ' <small class="bad">SWITCH</small>' : ''}${a.equipped === g.uid ? ' <span class="tag">Equipped</span>' : ''}</div><div class="s">Retail ${fmtMoney(def.price)}</div></div><button class="btn btn-sm" data-action="gun" data-id="${g.uid}" ${g.frt || g.sw ? 'disabled' : ''}>Sell ${fmtMoney(ownGunOffer(g))}</button></div>`; }).join('')}</div>` : '<p class="muted">You don\'t own any guns.</p>'}`;
    }
    root.innerHTML = head(loc.name, `East Lancaster · "We buy gold, guns &amp; electronics"`) + `<div class="p-body" style="max-width:720px">
      <div class="tabs" style="margin:0 -12px 10px">${tabs.map(([id, label]) => `<button class="${tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${label}</button>`).join('')}</div>
      <p class="small muted">On you: <b>${items.length}</b> stolen item${items.length === 1 ? '' : 's'}${items.length ? ` worth about ${fmtMoney(lootTotal(s))} on the street` : ''}. Get arrested with them and they're evidence.</p>
      ${body}</div>`;
    const sold = r => { if (!r.ok) { toast(r.text, 'bad'); audio.error?.(); return; } audio.buy?.(); saveGame('auto', true); h.refresh(); };
    bind(root, {
      close: () => h.close(),
      tab: d => { tab = d.id; h.refresh(); },
      pick: d => { picked.has(d.id) ? picked.delete(d.id) : picked.add(d.id); h.refresh(); },
      fence: () => { const r = sellToFence(s, [...picked], earn, heat); if (r.ok) toast(`Dre counts out ${fmtMoney(r.paid)}. "Pleasure."`, 'good'); picked.clear(); sold(r); },
      fenceall: async () => {
        if (!await confirm('Sell everything to Dre?', `<p>${items.length} item${items.length === 1 ? '' : 's'} for <b>${fmtMoney(items.reduce((t, i) => t + fenceOffer(s, i, heat), 0))}</b> cash.</p>`, 'Sell')) return;
        const r = sellToFence(s, items.map(i => i.uid), earn, heat); if (r.ok) toast(`Dre counts out ${fmtMoney(r.paid)}. "Pleasure."`, 'good'); picked.clear(); sold(r);
      },
      pawn: async d => {
        const i = items.find(x => x.uid === d.id); if (!i) return;
        const p = flagChance(s, i);
        if (p >= 0.25 && !await confirm(`Pawn the ${i.name}?`, `<p>Marcus will run the serial. There's a <b>${pct(p)}</b> chance it comes back stolen and he calls it in. Dre in the back would give you ${fmtMoney(fenceOffer(s, i, heat))} with no check.</p>`, `Pawn for ${fmtMoney(counterOffer(i))}`)) return;
        const r = pawnItem(s, i.uid, earn);
        if (r.flagged) {
          audio.error?.();
          if (w?.police) { w.police.s.heat = Math.max(w.police.s.heat, 1); w.police.decayHold = 30; }
          saveGame('auto', true);
          await modal('Serial number hit', `<p class="muted">Marcus looks at the screen a little too long. "Gonna need to hold onto this one."</p><p>The ${esc(i.name)} came back stolen. He keeps it and calls FWPD. A warrant is out for you: <b>${esc(r.warrant.text)}</b></p><p class="small muted">Pay it off or turn yourself in at a precinct${r.warrant.felony ? ' (it\'s a felony, so it goes to court)' : ''}. Next time, sell hot stuff to Dre in the back.</p>`);
          h.refresh();
          return;
        }
        toast(`Pawned the ${i.name} for ${fmtMoney(r.paid)}. Clean.`, 'good'); sold(r);
      },
      gun: async d => {
        const g = ensureArms(s).guns.find(x => x.uid === d.id); if (!g) return;
        const def = WEAPON_BY_ID[g.id];
        if (!await confirm(`Sell your ${def.name}?`, `<p>Marcus pays <b>${fmtMoney(ownGunOffer(g))}</b>.</p>`, 'Sell')) return;
        const r = sellOwnGun(s, d.id, earn); if (r.ok) toast(`Sold the ${def.name} for ${fmtMoney(r.paid)}.`, 'good'); sold(r);
      },
    });
  });
}

const emptyBag = `<p class="muted">You've got nothing to sell. Mug someone, rob a store, or check the glovebox of a car you steal: phones, jewelry, electronics and guns all end up here.</p>`;
