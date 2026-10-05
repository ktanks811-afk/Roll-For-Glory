// The kennel: your dogs (Hogs & Dogs profiles: picture painted from the
// genes, stats against potential, temperament, the genotype, parents and the
// hunting record), breeding with coat odds, and the dog market at Cross
// Timbers Hog Dogs. Rules: core/dogs.js.

import { openPanel, bind, esc, toast, confirm, prompt, closeAllPanels } from './dom.js';
import { game, fmtMoney } from '../core/state.js';
import { LOC_BY_ID } from '../data/world.js';
import { STATS, TRAIN, TEMP_FX, LOCI, BREEDS, RARITY, VET_VISIT, VEST_PRICE, COLLAR_PRICE, FEED_PER_DOG, LITTER_DAYS } from '../data/dogs.js';
import * as DG from '../core/dogs.js';
import { dogImg, hydrateDogs } from '../gfx2d/dogArt.js';
import { audio } from '../core/audio.js';
import { saveGame } from '../core/save.js';

export const KENNEL_LOC = 'dog_kennel';
const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const say = r => { toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) { audio.buy?.(); saveGame('auto', true); } else audio.error?.(); return r.ok; };
const sexIcon = d => d.sex === 'F' ? '<b style="color:#ff7ab0">♀</b>' : '<b style="color:#6ab0ff">♂</b>';
const rarTag = d => { const [n, c] = RARITY[DG.rarTier(d)]; return `<span class="tag" style="border-color:${c};color:${c}">${n}</span>`; };
const roleTag = d => DG.roleOf(d) === 'bay' ? `<span class="tag">Bay ${Math.round(DG.bayScore(d))}</span>` : `<span class="tag tag-red">Catch ${Math.round(DG.catchScore(d))}</span>`;
const hpBar = d => `<div class="bar thin ${d.health < 40 ? 'red' : d.health < 75 ? 'yellow' : 'green'}"><div style="width:${d.health}%"></div></div>`;
const statBar = (cur, pot) => `<div class="dstat"><i class="pot" style="width:${pot}%"></i><i class="cur" style="width:${cur}%"></i></div>`;
const gps = (app, id) => { const l = LOC_BY_ID[id]; app.world?.setGps(l.x, l.z, l.name); closeAllPanels(); toast(`GPS set: ${l.name}`, 'info'); };
const atKennel = app => { const v = app?.world?.playerState?.(), l = LOC_BY_ID[KENNEL_LOC]; return !app?.world || (v && l && Math.hypot(v.x - l.x, v.z - l.z) < 120); };

function dogCard(d, extra = '') {
  return `<div class="card click dogcard" data-action="dog" data-id="${esc(d.id)}">
    <div class="dogpic">${dogImg(d, 150)}</div>
    <h3>${esc(d.name)} ${sexIcon(d)}</h3>
    <div class="small muted">${esc(DG.breedName(d))} · ${DG.ageStr(d.age)}${d.age < 12 ? ' · pup' : ''}</div>
    <div class="small">${esc(DG.coatName(d))}</div>
    <div class="row" style="gap:4px;margin:4px 0;flex-wrap:wrap">${roleTag(d)}${rarTag(d)}</div>
    ${hpBar(d)}${extra}</div>`;
}

// ---------------------------------------------------------------- the kennel
// opts.tab: dogs | breed | buy. opts.shop: you're standing at Cross Timbers.
export function openKennel(app, opts = {}) {
  const s = game.s, k = DG.ensureKennel(s);
  const st = { tab: opts.tab || 'dogs', home: opts.home || 'all', sire: '', dam: '' };
  openPanel((root, h) => {
    const shop = opts.shop || atKennel(app);
    const homes = DG.dogHomes(s), dogs = k.dogs.filter(d => st.home === 'all' || d.home === st.home);
    const tabs = [['dogs', `My dogs (${k.dogs.length})`], ['breed', 'Breed'], ['buy', 'Buy dogs']];
    let body = '';
    if (st.tab === 'dogs') {
      body = `<div class="stats-row"><div><div class="stat-lbl">Dogs</div><b>${k.dogs.length} / ${DG.totalRoom(s)}</b></div><div><div class="stat-lbl">Feed</div><b>${fmtMoney(k.dogs.length * FEED_PER_DOG)} a day</b></div><div><div class="stat-lbl">Hogs caught</div><b>${k.st.hogs}</b></div><div><div class="stat-lbl">Biggest</div><b>${k.st.best ? `${k.st.best} lb` : '—'}</b></div></div>
        ${homes.length > 1 ? `<div class="chips">${[['all', 'All'], ...homes.map(x => [x.id, `${x.name} ${DG.dogsAt(s, x.id).length}/${x.room}`])].map(([id, n]) => `<button class="chip ${st.home === id ? 'on' : ''}" data-action="home" data-id="${esc(id)}">${esc(n)}</button>`).join('')}</div>` : ''}
        ${k.preg.length ? `<p class="small">🍼 ${k.preg.map(p => `${esc(k.dogs.find(d => d.id === p.dam)?.name || '?')} × ${esc(p.sire.name)}: pups day ${p.due}`).join(' · ')}</p>` : ''}
        ${dogs.length ? `<div class="grid dgrid">${dogs.map(d => dogCard(d, DG.pregnancy(s, d.id) ? '<div class="small good">Expecting</div>' : '')).join('')}</div>`
          : `<div class="empty">No dogs yet. Cross Timbers Hog Dogs in Johnson County sells curs, hounds, bulldogs and catch dogs.</div><div class="row"><button class="btn btn-primary" data-action="tab" data-id="buy">Buy a dog</button></div>`}
        <p class="small muted">Dogs live at your places: up to 30 on country acreage, 12 on a lot, 6 at a house, 2 at the apartment. They eat ${fmtMoney(FEED_PER_DOG)} a day each, heal overnight and age a month every game day. Take them hog hunting at the Nolan River lease.</p>`;
    } else if (st.tab === 'breed') {
      const sires = k.dogs.filter(DG.canSire), dams = k.dogs.filter(d => DG.canDam(s, d));
      const sire = sires.find(d => d.id === st.sire), dam = dams.find(d => d.id === st.dam);
      const opt = (arr, sel) => `<option value="">Pick one</option>` + arr.map(d => `<option value="${esc(d.id)}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)} · ${esc(DG.breedName(d))}</option>`).join('');
      const odds = sire && dam ? DG.predictCoats(sire, dam).slice(0, 6) : [];
      const avgPot = (a, b) => Math.round(STATS.reduce((t, [x]) => t + (a.pot[x] + b.pot[x]) / 2, 0) / STATS.length);
      body = `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="card"><label class="stat-lbl">Sire ♂</label><select class="input" data-pick="sire">${opt(sires, st.sire)}</select>${sire ? `<div class="dogpic">${dogImg(sire, 200)}</div><div class="small gt">${Object.keys(LOCI).map(L => DG.genoText(sire, L, '')).join(' ')}</div>` : ''}</div>
        <div class="card"><label class="stat-lbl">Dam ♀</label><select class="input" data-pick="dam">${opt(dams, st.dam)}</select>${dam ? `<div class="dogpic">${dogImg(dam, 200)}</div><div class="small gt">${Object.keys(LOCI).map(L => DG.genoText(dam, L, '')).join(' ')}</div>` : ''}</div></div>
        ${sire && dam ? `<div class="section-title">What the pups could look like</div><div class="list">${odds.map(o => `<div class="li"><div class="grow"><div class="t">${esc(o.n)}</div></div><span class="tag" style="border-color:${RARITY[Math.min(4, o.rar)][1]};color:${RARITY[Math.min(4, o.rar)][1]}">${RARITY[Math.min(4, o.rar)][0]}</span><b style="min-width:44px;text-align:right">${Math.round(o.p * 100)}%</b></div>`).join('')}</div>
          <p class="small">${sire.breed === dam.breed && !sire.cross && !dam.cross ? `Purebred ${esc(sire.breed)} pups.` : `A cross: ${esc(DG.crossName(sire, dam))}.`} Average potential about <b>${avgPot(sire, dam)}</b>. ${esc(dam.name)} whelps in ${LITTER_DAYS} days, 2 to 7 pups.</p>
          <div class="row"><button class="btn btn-primary" data-action="breed">Breed ${esc(dam.name)} to ${esc(sire.name)}</button></div>` : ''}
        <p class="small muted">Grown dogs only (12 months). A dam rests 6 days after a litter. Pups take after both parents: genes come one from each side, potentials average out with some luck, and once in a while a pup mutates into something new.</p>`;
    } else {
      const mk = DG.refreshMarket(s);
      body = shop ? `<p class="muted small">"Every dog here has been on hogs." Stock turns over every morning. The featured dogs are proven and come from rare lines.</p>
        <div class="grid dgrid">${mk.map(d => dogCard(d, `<div class="row" style="justify-content:space-between;margin-top:6px"><b class="price">${fmtMoney(d.price)}</b>${d.featured ? '<span class="tag tag-yellow">Featured</span>' : ''}</div>`)).join('')}</div>
        <div class="section-title">Gear</div><div class="list">
          <div class="li"><span>📡</span><div class="grow"><div class="t">GPS tracking collars</div><div class="s">See every bay dog on the hunt map, even out of sight.</div></div><button class="btn btn-sm ${k.collar ? '' : 'btn-primary'}" data-action="collar" ${k.collar ? 'disabled' : ''}>${k.collar ? 'Owned' : `Buy ${fmtMoney(COLLAR_PRICE)}`}</button></div>
          <div class="li"><span>🦺</span><div class="grow"><div class="t">Cut vests</div><div class="s">Kevlar for a catch dog: ${fmtMoney(VEST_PRICE)} each. Buy one from the dog's profile.</div></div></div></div>`
        : `<div class="empty">Dogs are for sale at <b>Cross Timbers Hog Dogs</b> on FM 4 in Johnson County.</div><div class="row"><button class="btn btn-primary" data-action="gps" data-id="${KENNEL_LOC}">📍 Set GPS</button></div>`;
    }
    root.innerHTML = head('Kennel', `${k.dogs.length} dog${k.dogs.length === 1 ? '' : 's'} · Hogs & Dogs`) + `<div class="p-body" style="max-width:980px">
      <div class="tabs" style="margin:0 -12px 10px">${tabs.map(([id, label]) => `<button class="${st.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${label}</button>`).join('')}</div>${body}</div>`;
    bind(root, {
      close: () => h.close(),
      tab: d => { st.tab = d.id; h.refresh(); },
      home: d => { st.home = d.id; h.refresh(); },
      gps: d => gps(app, d.id),
      dog: d => openDog(app, d.id, { shop, onChange: () => h.refresh() }),
      breed: async () => { if (say(DG.breed(s, st.sire, st.dam))) { st.sire = st.dam = ''; h.refresh(); } },
      collar: () => { if (say(DG.buyCollar(s))) h.refresh(); },
    });
    root.querySelectorAll('select[data-pick]').forEach(sel => sel.addEventListener('change', () => { st[sel.dataset.pick] = sel.value; h.refresh(); }));
    hydrateDogs(root, [...k.dogs, ...k.market]);
  }, { cls: 'kennel-panel' });
}

// ---------------------------------------------------------------- a dog's profile
export function openDog(app, id, { shop = false, onChange = null } = {}) {
  const s = game.s, k = DG.ensureKennel(s);
  openPanel((root, h) => {
    const d = DG.dogById(s, id);
    if (!d) { h.close(); return; }
    const mine = k.dogs.includes(d), b = BREEDS[d.breed], preg = DG.pregnancy(s, d.id);
    const trained = DG.trainedToday(s, d), homes = DG.dogHomes(s);
    root.innerHTML = head(d.name, `${esc(DG.breedName(d))} · ${d.sex === 'F' ? 'Female' : 'Male'} · ${DG.ageStr(d.age)}`) + `<div class="p-body dogprofile" style="max-width:860px">
      <div class="dp-top"><div class="dogpic big">${dogImg(d, 360)}</div>
        <div class="dp-info">
          <div class="row" style="gap:6px;flex-wrap:wrap">${roleTag(d)}${rarTag(d)}${d.mut ? '<span class="tag tag-yellow">Mutation</span>' : ''}${k.vests[d.id] ? '<span class="tag">Cut vest</span>' : ''}</div>
          <div class="kv" style="margin-top:8px">
            <span>Coat</span><span>${esc(DG.coatName(d))}</span>
            <span>Breed</span><span>${esc(DG.breedName(d))}${d.breed === 'Cross' ? ` <span class="muted small">(${esc(DG.short(d.build))} build)</span>` : ''}</span>
            <span>Weight</span><span>${d.kg} kg</span>
            <span>Temperament</span><span>${esc(d.temp)} <span class="muted small">${esc(TEMP_FX[d.temp] || '')}</span></span>
            <span>Health</span><span>${Math.round(d.health)} / ${d.hcap}${d.hcap < 100 ? ' <span class="muted small">(double merle)</span>' : ''}</span>
            <span>Energy</span><span>${Math.round(d.energy)}</span>
            <span>Generation</span><span>${d.gen ? `${d.gen}${d.gen === 1 ? 'st' : d.gen === 2 ? 'nd' : d.gen === 3 ? 'rd' : 'th'} generation` : 'Foundation stock'}</span>
            <span>Hunting</span><span>${d.hunt.n} hunt${d.hunt.n === 1 ? '' : 's'} · ${d.hunt.bays} bays · ${d.hunt.catches} catches</span>
            <span>${mine ? 'Worth' : 'Price'}</span><span><b>${fmtMoney(mine ? DG.dogValue(d) : d.price)}</b></span>
            ${mine ? `<span>Lives at</span><span>${esc(DG.homeName(s, d.home))}</span>` : ''}
            ${d.parents ? `<span>Parents</span><span>${d.parents.map(p => `${esc(p.name)} <span class="muted small">(${esc(p.breed)})</span>`).join(' × ')}</span>` : ''}
          </div>
          ${preg ? `<p class="good small">Bred to ${esc(preg.sire.name)}. Pups on day ${preg.due}.</p>` : d.cool > 0 ? `<p class="muted small">Resting ${d.cool} more day${d.cool > 1 ? 's' : ''} after her litter.</p>` : ''}
        </div></div>
      <div class="section-title">Stats <span class="muted small">bright = now, dim = potential</span></div>
      <div class="list">${STATS.map(([key, label]) => {
        const g = mine ? DG.trainGain(d, key) : 0;
        return `<div class="li dsrow"><div class="grow"><div class="t">${label} <span class="muted small">${d.stats[key]} / ${d.pot[key]}</span></div>${statBar(d.stats[key], d.pot[key])}</div>
          ${mine ? `<button class="btn btn-sm" data-action="train" data-k="${key}" ${trained || !g || d.energy < 30 || d.age < 6 ? 'disabled' : ''}>${TRAIN[key]}${g ? ` +${g}` : ''}</button>` : ''}</div>`;
      }).join('')}</div>
      ${mine ? `<p class="small muted">${trained ? `${esc(d.name)} worked today. Training again tomorrow.` : 'One training session a day. Smarter dogs and Eager ones learn faster.'}</p>` : ''}
      <div class="section-title">Genes</div>
      <div class="list">${Object.entries(LOCI).map(([L, o]) => `<div class="li"><div class="grow"><div class="t">${esc(o.name)}</div></div><b class="gt">${esc(DG.genoText(d, L, ' / '))}</b></div>`).join('')}</div>
      <p class="small muted">${esc(b?.short || 'Mix')} genetics, Hogs & Dogs rules: one allele from each parent at every locus, the first one listed is dominant. Merle on both sides makes a double merle with lower health.</p>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px">
        ${mine ? `<button class="btn btn-sm" data-action="rename">✏️ Rename</button>
          <button class="btn btn-sm" data-action="vet" ${d.health >= d.hcap ? 'disabled' : ''}>🩺 Vet ${fmtMoney(VET_VISIT)}</button>
          <button class="btn btn-sm" data-action="vest" ${k.vests[d.id] ? 'disabled' : ''}>🦺 ${k.vests[d.id] ? 'Has a vest' : `Cut vest ${fmtMoney(VEST_PRICE)}`}</button>
          ${homes.length > 1 ? `<select class="input" data-pick="move" style="width:auto">${homes.map(x => `<option value="${esc(x.id)}" ${x.id === d.home ? 'selected' : ''}>${esc(x.name)} (${DG.dogsAt(s, x.id).length}/${x.room})</option>`).join('')}</select>` : ''}
          <button class="btn btn-sm btn-danger" data-action="sell">Sell ${fmtMoney(Math.round(DG.dogValue(d) * DG.SELL_RATE))}</button>`
        : shop ? `<button class="btn btn-primary" data-action="buy">Buy ${esc(d.name)} ${fmtMoney(d.price)}</button>` : ''}
      </div></div>`;
    const done = r => { if (say(r)) { h.refresh(); onChange?.(); } };
    bind(root, {
      close: () => h.close(),
      train: x => done(DG.trainDog(s, d.id, x.k)),
      vet: () => done(DG.vet(s, d.id)),
      vest: () => done(DG.buyVest(s, d.id)),
      rename: async () => { const n = await prompt('Rename', `<p>What do you call ${esc(d.name)} now?</p>`, 'Name', d.name); if (n != null) done(DG.renameDog(s, d.id, n)); },
      sell: async () => { if (await confirm(`Sell ${d.name}?`, `<p>A buyer in Joshua will give you <b>${fmtMoney(Math.round(DG.dogValue(d) * DG.SELL_RATE))}</b>.</p>`, 'Sell', true)) { if (say(DG.sellDog(s, d.id))) { h.close(); onChange?.(); } } },
      buy: async () => { if (await confirm(`Buy ${d.name}?`, `<p>${esc(DG.breedName(d))}, ${esc(DG.coatName(d))}. ${fmtMoney(d.price)}.</p>`, 'Buy')) { if (say(DG.buyDog(s, d.id))) { h.close(); onChange?.(); } } },
    });
    root.querySelector('select[data-pick=move]')?.addEventListener('change', e => done(DG.moveDog(s, d.id, e.target.value)));
    hydrateDogs(root, [d]);
  }, { cls: 'kennel-panel' });
}
