// The rest of Hogs & Dogs, one panel with tabs: dog shows, the bay pen and
// trials, the county fair, the Hog Pin, horses, the ranch (gear, trail cams,
// traps, landowner jobs), the breed and discovery books, and the wall
// (ribbons, trophies, the memorial, the pack). Opened from the Bay Pen in Rio
// Vista, the Expo Center in Cleburne, and the kennel.

import { openPanel, bind, esc, toast, confirm, prompt } from './dom.js';
import { game, fmtMoney } from '../core/state.js';
import { HOGS, HUNT_GROUNDS, GROUND_BY_ID } from '../data/dogs.js';
import { LAND } from '../data/estate.js';
import { BREED_FACTS } from '../data/hdref.js';
import * as DG from '../core/dogs.js';
import * as HD from '../core/hd.js';
import * as HK from '../core/hdkennel.js';
import * as HT from '../core/hdtrials.js';
import * as HP from '../core/hogpin.js';
import * as HO from '../core/horses.js';
import * as RN from '../core/hdranch.js';
import { HOGG, HOG_RATION, hydrateHogs, showHogs } from '../gfx2d/hogArt.js';
import { HG, hydrateHorses, showHorses } from '../gfx2d/horseArt.js';
import { dogImg, hydrateDogs } from '../gfx2d/dogArt.js';
import { audio } from '../core/audio.js';
import { saveGame } from '../core/save.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const say = r => { toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) { audio.buy?.(); saveGame('auto', true); } else audio.error?.(); return r.ok; };
const medal = p => ['🥇', '🥈', '🥉'][p - 1] || `#${p}`;
const opt = (list, sel, label) => list.map(x => `<option value="${esc(x.id)}" ${x.id === sel ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
const sexIcon = x => x.sex === 'F' ? '<b style="color:#ff7ab0">♀</b>' : '<b style="color:#6ab0ff">♂</b>';
const dogLbl = d => `${d.name} · ${DG.breedName(d)}${HT.titles(d) ? ' · ' + HT.titles(d) : ''}`;
const fieldTable = (field, fmt = x => x.s) => `<div class="list">${field.slice(0, 6).map((x, i) => `<div class="li" style="${x.me ? 'font-weight:700;color:var(--yellow)' : ''}"><b style="min-width:30px">${medal(i + 1)}</b><div class="grow">${esc(x.n)}</div><span>${esc(String(fmt(x)))}</span></div>`).join('')}</div>`;

export const TABS = [['shows', '🏅 Shows'], ['trials', '🐗 Bay pen'], ['fair', '🎡 Fair'], ['pin', '🐷 Hog Pin'], ['horses', '🐎 Horses'], ['ranch', '🧰 Ranch'], ['books', '📖 Books'], ['wall', '🏆 Wall']];

export function openRanch(app, tab = 'shows', sub = '') {
  const s = game.s, k = DG.ensureKennel(s);
  HD.ensureHd(s);
  const ui = { tab, show: {}, ring: { gait: 'steady', stack: 'hand', bait: 'bait', pro: false }, res: null, bay: null, cls: 'one', bayIds: [], pinB: '', pinS: '', hS: '', hD: '', hsel: null, book: sub || 'breeds' };
  let timer = 0;
  const handle = openPanel((root, h) => {
    const day = s.time.day;
    let body = '';
    const adults = k.dogs.filter(d => d.age >= 12);
    if (ui.tab === 'shows') {
      const wk = HT.showsThisWeek(day);
      ui.show.tier ??= wk[0];
      if (!wk.includes(ui.show.tier)) ui.show.tier = wk[0];
      const T = HT.SHOW.TIERS[ui.show.tier], J = HT.showJudge(day, ui.show.tier), pool = k.dogs.filter(d => d.age >= 6);
      const d = pool.find(x => x.id === ui.show.dog) || pool[0];
      const prep = d ? HT.showPrep(s, d) : {}, R = ui.res;
      body = `<p class="small muted">Shows every week at the Cleburne Expo Center: a local show, a regional every 4th week and the National every 12th. Win your class for points; 15 points with 2 majors makes a Champion (CH), 25 more and 3 Best of Breed a Grand Champion (GCH).</p>
        <div class="chips">${wk.map(t => `<button class="chip ${ui.show.tier === t ? 'on' : ''}" data-action="tier" data-id="${t}">${esc(HT.SHOW.TIERS[t].n)} · ${fmtMoney(HT.SHOW.TIERS[t].fee)}</button>`).join('')}</div>
        <div class="card"><b>Judge: ${esc(J.n)}</b><div class="small muted">${esc(J.say)}.</div></div>
        ${pool.length ? `<div class="card" style="margin-top:8px"><label class="stat-lbl">Your entry</label><select class="input" data-pick="showdog">${opt(pool, d?.id, dogLbl)}</select>
          ${d ? `<div class="row" style="gap:10px;margin-top:8px;align-items:flex-start"><div class="dogpic" style="width:140px">${dogImg(d, 140)}</div><div class="grow small">
            <div><b>${esc(HT.showClass(d))}</b> · ${esc(HT.showGroup(d))} group · ${esc(HT.buildGrade(d).label)}</div>
            <div>Show points ${HT.showRec(d).pts} · majors ${HT.showRec(d).majors} · BOB ${HT.showRec(d).bob}${HT.showTitle(d) ? ` · <b class="good">${HT.showTitle(d)}</b>` : ''}</div>
            <div>Ring skill ${Math.round(d.ring || 20)} · health ${Math.round(d.health)} · energy ${Math.round(d.energy)}</div>
            ${HK.merleBarred(d) ? '<div class="bad">Merle is a disqualification in this breed.</div>' : ''}</div></div>
          <div class="section-title">Get ready</div><div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(HT.SHOW.PREP).map(([key, P]) => `<button class="btn btn-sm" data-action="prep" data-k="${key}" ${prep[key] ? 'disabled' : ''}>${P.ic} ${esc(P.n)}${P.cost ? ' ' + fmtMoney(P.cost) : ''}${prep[key] ? ' ✓' : ''}</button>`).join('')}</div>
          <div class="section-title">In the ring</div>
          ${[['gait', [['slow', 'Slow walk'], ['steady', 'Steady trot'], ['brisk', 'Brisk trot']]], ['stack', [['hand', 'Hand stack'], ['free', 'Free stack']]], ['bait', [['bait', 'Liver bait'], ['toy', 'Squeaky toy'], ['none', 'No bait']]]].map(([key, L]) => `<div class="chips">${L.map(([v, n]) => `<button class="chip ${ui.ring[key] === v ? 'on' : ''}" data-action="ring" data-k="${key}" data-id="${v}">${n}</button>`).join('')}</div>`).join('')}
          <label class="row small" style="gap:6px"><input type="checkbox" data-pick="pro" ${ui.ring.pro ? 'checked' : ''}> Hire a pro handler (${fmtMoney(HT.SHOW.HANDLER)})</label>
          <div class="row" style="margin-top:8px"><button class="btn btn-primary" data-action="enterShow">Enter ${esc(T.n.toLowerCase())} · ${fmtMoney(T.fee + (ui.ring.pro ? HT.SHOW.HANDLER : 0))}</button></div>` : ''}</div>` : '<div class="empty">You need a dog at least 6 months old to show.</div>'}
        ${R?.kind === 'show' ? `<div class="card" style="margin-top:8px"><h3>${medal(R.res.place)} ${esc(R.dog.name)}: ${HD.ordinal(R.res.place)} in ${esc(R.res.cls)}</h3>
          <div class="small">${esc(R.res.notes)}</div><div class="small muted">${esc(R.res.ring.join(', '))}.</div>
          <div class="small">${Object.entries(R.res.c).map(([a, v]) => `${a} ${v}`).join(' · ')} · total ${R.res.score}</div>
          ${R.res.rounds.length ? `<div class="small">${R.res.rounds.map(([n, ok]) => `${ok ? '✅' : '❌'} ${esc(n)}`).join(' · ')}</div>` : ''}
          ${R.res.won ? `<div class="good"><b>Won ${fmtMoney(R.res.won)}</b>${R.res.pts ? ` · ${R.res.pts} points` : ''}</div>` : ''}${R.res.title ? `<div class="good"><b>${esc(R.dog.name)} is now a ${R.res.title === 'CH' ? 'Champion' : 'Grand Champion'}!</b></div>` : ''}</div>` : ''}`;
    } else if (ui.tab === 'trials') {
      const B = ui.bay;
      if (B) {
        body = `<div class="card"><h3>${esc(B.name)} in the pen</h3><canvas class="baypen-cv" width="320" height="220" style="width:100%;max-width:420px;display:block;margin:0 auto;background:#3d3022;border-radius:10px"></canvas>
          <div class="small" style="margin-top:6px"><b data-bt>${B.t}s</b> / ${B.champ ? HT.BAYC.SECS : HT.BAYT.SECS}s${B.champ ? ` · score <b data-bs>${HT.sanctionedScore(B).toFixed(2)}</b>` : ''}</div>
          <div class="small" data-bl>${B.log.slice(0, 4).map(esc).join('<br>')}</div></div>
          ${B.done ? `<div class="card" style="margin-top:8px"><h3>${B.champ?.dq ? 'Disqualified' : `${medal(B.place)} ${HD.ordinal(B.place)} place`}${B.prize ? ` · ${fmtMoney(B.prize)}` : ''}</h3>
            ${B.M ? `<div class="small">Grit ${B.M.grit} · control ${B.M.ctl} · voice ${B.M.voice} · pressure ${B.M.press} = <b>${B.tot}/40</b></div>` : `<div class="small">Judges' average: <b>${B.tot.toFixed(2)}</b> / 10${B.champ.faults.length ? ` · ${B.champ.faults.length} faults` : ' · clean run'}</div>`}
            ${(B.newT || []).map(t => `<div class="good"><b>${esc(t.name)} is now a ${t.title === 'BCH' ? 'Bay Champion' : 'Grand Bay Champion'}!${t.dual ? ' ' + esc(t.dual) + '!' : ''}</b></div>`).join('')}
            ${fieldTable(B.field, x => typeof x.s === 'number' ? (B.champ ? x.s.toFixed(2) : x.s) : x.s)}<div class="row" style="margin-top:8px"><button class="btn btn-primary" data-action="bayDone">Back to the trials</button></div></div>`
          : `<div class="row" style="margin-top:8px"><button class="btn" data-action="baySkip">⏩ Skip to the end</button></div>`}`;
      } else {
        const ch = HT.champSeason(day), C = HT.BAYC.CLASSES, cls = C[ui.cls], ok = adults.concat(k.dogs.filter(d => d.age >= 6 && d.age < 12));
        const hp = HT.highPointRace(s), cw = HT.catchThisWeek(s), cpool = HT.catchPool(s);
        body = `<p class="small muted">The Rio Vista Bay Pen: one hog in a round pen, your dog bays it, and judges score grit, control, voice and pressure. Grabbing the hog costs you. Win 5 sanctioned trials for Bay Champion (BCH); 8 more and a championship win for Grand Bay Champion (GBCH).</p>
          <div class="card"><h3>🐗 Practice trial · ${fmtMoney(HT.BAYT.FEE)}</h3><div class="small muted">60 seconds, one dog, ribbons and ${HT.BAYT.PRIZE.map(fmtMoney).join(' / ')} for the top three. Once a day per dog.</div>
            ${adults.length ? `<div class="row" style="gap:6px;margin-top:6px"><select class="input" data-pick="baydog" style="flex:1">${opt(adults, ui.bayDog, d => `${d.name} · ${DG.breedName(d)}${HT.bayOk(s, d) ? '' : ' (not today)'}`)}</select><button class="btn btn-primary" data-action="bayGo">Run</button></div>` : '<div class="small muted">No grown dogs.</div>'}</div>
          <div class="card" style="margin-top:8px"><h3>🏁 ${ch ? 'Bay Championship (February & March)' : 'Sanctioned bay trial'} · ${fmtMoney(ch ? HT.BAYC.FEE.champ : HT.BAYC.FEE.week)}</h3>
            <div class="small muted">Five judges take a tenth off for every fault. Hold the hog 5 seconds and you're out. Prizes ${(ch ? HT.BAYC.PRIZE.champ : HT.BAYC.PRIZE.week).map(fmtMoney).join(' / ')}.</div>
            <div class="chips">${Object.entries(C).filter(([c]) => c !== 'bob' || ch).map(([c, x]) => `<button class="chip ${ui.cls === c ? 'on' : ''}" data-action="cls" data-id="${c}">${esc(x.n)}</button>`).join('')}</div>
            <div class="small">${esc(cls.d)}</div>
            <div class="dpicks">${ok.map(d => { const why = HT.bayClassWhy(s, d, ui.cls), can = HT.bayClassOk(s, d, ui.cls); return `<button class="dpick ${ui.bayIds.includes(d.id) ? 'on' : ''}" data-action="bayPick" data-id="${esc(d.id)}" ${can ? '' : 'disabled'}>${dogImg(d, 110)}<b>${esc(d.name)}</b><span>${HT.bayTitle(d) || DG.ageStr(d.age)}</span><span class="muted">${can ? 'Ready' : esc(why || 'Not today')}</span></button>`; }).join('')}</div>
            <div class="row"><button class="btn btn-primary" data-action="sancGo" ${ui.bayIds.length === cls.dogs ? '' : 'disabled'}>Run ${esc(cls.n)}</button></div>
            ${hp.length ? `<div class="small" style="margin-top:6px">High Point race: ${hp.map(x => `${esc(x.name)} ${x.p}`).join(' · ')} (top dog with 17+ points wins ${fmtMoney(HT.BAYC.HP)})</div>` : ''}</div>
          <div class="card" style="margin-top:8px"><h3>🐕 Catch trial · ${fmtMoney(HT.CTRIAL.FEE)}</h3><div class="small muted">Once a week: three judges score how fast and how hard your catch dog takes hold, and how it lets go. ${HT.CTRIAL.PRIZE.map(fmtMoney).join(' / ')}.</div>
            ${cw.res ? `<div class="small"><b>${esc(cw.res.dog)}: ${HD.ordinal(cw.res.place)}</b> (${cw.res.judges.join(' / ')})</div>${fieldTable(cw.res.field)}` : cpool.length ? `<div class="row" style="gap:6px;margin-top:6px"><select class="input" data-pick="catchdog" style="flex:1">${opt(cpool, ui.catchDog, dogLbl)}</select><button class="btn btn-primary" data-action="catchGo">Enter</button></div>` : '<div class="small muted">No catch dogs ready.</div>'}</div>`;
      }
    } else if (ui.tab === 'fair') {
      const open = HO.fairOpen(day), F = HO.fairState(s);
      body = open ? `<p class="small muted">The ${esc(HO.fairName(day))} is in town at the Johnson County Fairgrounds today. One entry per event (${fmtMoney(HO.FAIR_FEE)}); the top three win cash and a ribbon.</p>
        ${Object.entries(HO.FAIR_EV).map(([key, E]) => { const done = F.entered[key], pool = E.pool(s);
          return `<div class="card" style="margin-bottom:8px"><div class="row" style="justify-content:space-between"><b>${E.icon} ${esc(E.name)}</b><span class="small">${E.prize.map(fmtMoney).join(' / ')}</span></div><div class="small muted">${esc(E.how)}</div>
            ${done ? `<div class="small"><b>${esc(done.who)}: ${HD.ordinal(done.place)}</b></div>${fieldTable(done.field.map(x => ({ ...x, n: x.me ? `You (${x.who})` : x.n, s: '' })))}`
            : pool.length ? `<div class="row" style="gap:6px;margin-top:6px"><select class="input" data-fair="${key}" style="flex:1">${pool.map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${Math.round(E.score(x))}</option>`).join('')}</select><button class="btn btn-sm btn-primary" data-action="fairGo" data-k="${key}">Enter</button></div>`
            : `<div class="small muted">No ${E.kind === 'dog' ? 'grown dogs' : E.kind === 'horse' ? 'grown horses' : 'hogs in your Hog Pin'} to enter.</div>`}</div>`; }).join('')}
        <div class="card"><div class="row" style="justify-content:space-between"><b>🐄 Cattle auction</b><span class="small">${fmtMoney(HO.FAIR_HEAD)} a head</span></div><div class="small muted">Fair buyers pay more than the sale barn, up to 5 head, straight off your pasture.</div><button class="btn btn-sm" style="margin-top:6px" data-action="auction" ${F.sold < 5 ? '' : 'disabled'}>Sell cattle</button></div>`
        : `<div class="empty">🎡 The county fair isn't in town. It comes once a season (January, April, July and October; one game day is a month). Next fair in ${HO.fairNext(s)} day${HO.fairNext(s) === 1 ? '' : 's'}.</div>
          <p class="small">Events: ${Object.values(HO.FAIR_EV).map(e => `${e.icon} ${esc(e.name)}`).join(' · ')} · 🐄 Cattle auction</p>`;
    } else if (ui.tab === 'pin') {
      const hogs = HP.pinHogs(s), cap = HP.pinCap(s), pin = HD.ensureHd(s).hogPin, boars = hogs.filter(x => x.sex === 'M'), sows = hogs.filter(x => x.sex === 'F');
      const b = boars.find(x => x.id === ui.pinB), so = sows.find(x => x.id === ui.pinS), pr = b && so ? HP.canBreedHogs(s, b, so) : [];
      body = `<div class="stats-row"><div><div class="stat-lbl">Hogs</div><b>${hogs.length} / ${cap}</b></div><div><div class="stat-lbl">Feed</div><b>${fmtMoney(HP.feedNeed(s))} a day</b></div><div><div class="stat-lbl">Tagged loose</div><b>${HP.tagged(s).length}</b></div></div>
        ${cap ? '' : '<div class="empty">The Hog Pin goes on land you own: 20 hogs on each piece of country acreage, 4 on a city lot. Keep hogs off a hunt from the results screen, or set a corral trap.</div>'}
        <div class="chips">${Object.entries(HOG_RATION).map(([key, R0]) => `<button class="chip ${pin.ration === key ? 'on' : ''}" data-action="ration" data-id="${key}">${esc(R0.name)} ration</button>`).join('')}</div>
        ${hogs.length ? `<div class="grid dgrid">${hogs.map(g => `<div class="card"><div style="text-align:center">${HOGG.art(g, 170)}</div><h3>${esc(g.name)} ${sexIcon(g)}</h3>
          <div class="small muted">${esc(g.type || g.key)} · ${esc(g.coat || '')} · ${Math.round(g.w)} lb · ${g.age} mo</div>
          <div class="small">${g.preg ? `<span class="good">Bred, piglets day ${g.preg.due}</span>` : g.nurse > 0 ? 'Nursing' : `Health ${Math.round(g.health)} · condition ${Math.round(g.bc ?? 100)}`}</div>
          <div class="row" style="gap:4px;margin-top:6px;flex-wrap:wrap"><button class="btn btn-sm" data-action="hogSell" data-id="${esc(g.id)}" data-k="live">Live ${fmtMoney(Math.max(g.price || 0, HP.livePrice({ ...g, kind: g.key })))}</button><button class="btn btn-sm" data-action="hogSell" data-id="${esc(g.id)}" data-k="proc">Processor</button><button class="btn btn-sm" data-action="hogName" data-id="${esc(g.id)}">✏️</button></div></div>`).join('')}</div>` : ''}
        ${boars.length && sows.length ? `<div class="section-title">Breed hogs</div><div class="row" style="gap:6px;flex-wrap:wrap"><select class="input" data-pick="pinB" style="flex:1"><option value="">Boar</option>${opt(boars, ui.pinB, x => `${x.name} · ${Math.round(x.w)} lb`)}</select><select class="input" data-pick="pinS" style="flex:1"><option value="">Sow</option>${opt(sows, ui.pinS, x => `${x.name} · ${Math.round(x.w)} lb`)}</select></div>
          ${pr.length ? `<p class="small bad">${esc(pr[0])}</p>` : b && so ? `<div class="row" style="margin-top:6px"><button class="btn btn-primary" data-action="hogBreed">Breed ${esc(so.name)} to ${esc(b.name)}</button></div>` : ''}` : ''}
        <p class="small muted">Hogs eat out of the bank every morning and grow toward what their genes allow. Sows farrow in 4 days; piglets inherit coat, size and tusks from both sides. The live buyer at the Joshua auction pays more for a big boar than the processor does.</p>`;
    } else if (ui.tab === 'horses') {
      const mine = HO.horses(s), mk = HO.horseMarket(s), st = HO.stalls(s), mares = mine.filter(x => x.sex === 'F'), studs = mine.filter(x => x.sex === 'M');
      showHorses(mk);
      const x = ui.hsel && [...mine, ...mk].find(q => q.id === ui.hsel);
      const sire = studs.find(q => q.id === ui.hS), dam = mares.find(q => q.id === ui.hD), pr = sire && dam ? HO.canBreedHorses(s, sire, dam) : [];
      const card = (q, own) => `<div class="card click" data-action="horse" data-id="${esc(q.id)}"><div style="text-align:center">${HG.art(q, 170)}</div><h3>${esc(q.name)} ${sexIcon(q)}</h3><div class="small muted">${esc(q.breed)} · ${esc(q.coat)} · ${Math.floor(q.age / 12)} yr</div>
        <div class="small">Speed ${q.spd} · agility ${q.agi} · work ${q.wrk}</div>${own ? '' : `<b class="price">${fmtMoney(HO.horsePrice(q))}</b>`}</div>`;
      body = x ? `<div class="card"><div style="text-align:center">${HG.art(x, 320)}</div><h3>${esc(x.name)} ${sexIcon(x)} <span class="muted small">${esc(x.gid || '')}</span></h3>
          <div class="small">${esc(x.breed)} · ${esc(x.coat)}${x.face && x.face !== 'None' ? ' · ' + esc(x.face) : ''} · ${Math.floor(x.age / 12)} yr ${x.age % 12} mo · bond ${Math.round(x.bond)}</div>
          <div class="list">${HO.HSTATS.map(([key, n]) => `<div class="li"><div class="grow"><div class="t">${n} <span class="muted small">${x[key]} / ${x.pot[key]}</span></div><div class="dstat"><i class="pot" style="width:${x.pot[key]}%"></i><i class="cur" style="width:${x[key]}%"></i></div></div>${mine.includes(x) ? `<button class="btn btn-sm" data-action="htrain" data-k="${key}" ${x.lastTrain === day || x[key] >= x.pot[key] ? 'disabled' : ''}>Train ${fmtMoney(HO.trainCost(s))}</button>` : ''}</div>`).join('')}</div>
          <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${mine.includes(x) ? `<button class="btn btn-sm" data-action="hname">✏️ Rename</button><button class="btn btn-sm" data-action="hdna">🧬 DNA test ${fmtMoney(HO.HORSE_DNA)}</button><button class="btn btn-sm btn-danger" data-action="hsell">Sell ${fmtMoney(HO.horsePrice(x) * 0.8)}</button>` : `<button class="btn btn-primary" data-action="hbuy">Buy ${fmtMoney(HO.horsePrice(x))}</button>`}<button class="btn btn-sm" data-action="hback">Back</button></div></div>`
        : `<div class="stats-row"><div><div class="stat-lbl">Horses</div><b>${mine.length} / ${st}</b></div><div><div class="stat-lbl">Feed</div><b>${fmtMoney(mine.length * 12)} a day</b></div></div>
        ${st ? '' : '<div class="empty">Horses need country land: 6 stalls on every piece of Johnson County acreage.</div>'}
        ${mine.length ? `<div class="section-title">Your barn</div><div class="grid dgrid">${mine.map(q => card(q, true)).join('')}</div>` : ''}
        ${HD.ensureHd(s).hpreg.length ? `<p class="small good">${HD.ensureHd(s).hpreg.map(p => `${esc(mine.find(q => q.id === p.dam)?.name || '?')} × ${esc(p.sire.name)}: foal day ${p.due}`).join(' · ')}</p>` : ''}
        ${studs.length && mares.length ? `<div class="section-title">Breed (same breed only, 3 years and up)</div><div class="row" style="gap:6px;flex-wrap:wrap"><select class="input" data-pick="hS" style="flex:1"><option value="">Stallion</option>${opt(studs, ui.hS, q => `${q.name} · ${q.breed}`)}</select><select class="input" data-pick="hD" style="flex:1"><option value="">Mare</option>${opt(mares, ui.hD, q => `${q.name} · ${q.breed}`)}</select></div>
          ${pr.length ? `<p class="small bad">${esc(pr[0])}</p>` : sire && dam ? `<p class="small">Likely coats: ${HO.foalOdds(sire, dam).colors.slice(0, 4).map(([c, p]) => `${esc(c)} ${p}%`).join(' · ')}</p><button class="btn btn-primary" data-action="hbreed">Breed · ${fmtMoney(HO.STUD_FEE)}</button>` : ''}` : ''}
        <div class="section-title">For sale at the Expo Center barn</div><div class="grid dgrid">${mk.map(q => card(q, false)).join('')}</div>
        <p class="small muted">Every horse carries real coat genetics: bays, blacks, chestnuts, the creams, duns, roans, grays, Appaloosa patterns. Barrel race and cut cattle at the county fair.</p>`;
    } else if (ui.tab === 'ranch') {
      const J = RN.jobs(s), board = RN.jobBoard(s), cams = RN.cams(s), traps = RN.traps(s), lands = Object.keys(s.estate?.land || {}).filter(id => s.estate.land[id]?.owned && LAND[id]);
      body = `<div class="section-title">Hunting gear</div><div class="list">${Object.entries(RN.GEAR).map(([key, G]) => `<div class="li"><span>${G.icon}</span><div class="grow"><div class="t">${esc(G.name)}</div><div class="s">${esc(G.desc)}</div></div><button class="btn btn-sm ${RN.hasGear(s, key) ? '' : 'btn-primary'}" data-action="gear" data-k="${key}" ${RN.hasGear(s, key) ? 'disabled' : ''}>${RN.hasGear(s, key) ? 'Owned' : fmtMoney(G.price)}</button></div>`).join('')}</div>
        <div class="section-title">Landowner jobs</div>
        ${J.active.length ? `<div class="list">${J.active.map(j => `<div class="li"><span>📋</span><div class="grow"><div class="t">${esc(j.who)}: ${j.got} / ${j.need} hogs</div><div class="s">${esc(GROUND_BY_ID[j.ground].name)} · by day ${j.due} · lease fee waived</div></div><b class="good">${fmtMoney(j.pay)}</b></div>`).join('')}</div>` : ''}
        <div class="list">${board.map(j => `<div class="li"><span>🐗</span><div class="grow"><div class="t">${esc(j.who)} wants ${j.need} hogs gone</div><div class="s">${esc(GROUND_BY_ID[j.ground].name)} · ${j.days} days</div></div><button class="btn btn-sm" data-action="job" data-id="${esc(j.id)}">Take it · ${fmtMoney(j.pay)}</button></div>`).join('')}</div>
        <div class="section-title">Trail cams</div><div class="list">${HUNT_GROUNDS.map(g => { const c = cams[g.id], last = c?.shots?.[0];
          return `<div class="li"><span>📷</span><div class="grow"><div class="t">${esc(g.name)}${RN.giantSeen(s, g.id) ? ' <span class="tag tag-red">Giant boar!</span>' : ''}</div><div class="s">${c ? last ? `Day ${last.day}: ${Object.entries(last.seen).map(([kk, n]) => `${n} ${HOGS[kk].name.toLowerCase()}`).join(', ')}` : 'No pictures yet.' : 'No camera.'}</div></div>${c ? '' : `<button class="btn btn-sm" data-action="cam" data-id="${g.id}">${fmtMoney(RN.CAM_PRICE)}</button>`}</div>`; }).join('')}</div>
        <div class="section-title">Corral traps</div>${lands.length ? `<div class="list">${lands.map(id => `<div class="li"><span>🪤</span><div class="grow"><div class="t">${esc(LAND[id].name)}</div><div class="s">${traps[id] ? `${traps[id].caught} caught so far` : 'No trap.'}</div></div>${traps[id] ? '' : `<button class="btn btn-sm" data-action="trap" data-id="${id}">${fmtMoney(RN.TRAP_PRICE)}</button>`}</div>`).join('')}</div>` : '<p class="small muted">Buy land to set corral traps. Trapped hogs go to the Hog Pin or the processor.</p>'}`;
    } else if (ui.tab === 'books') {
      const B = HK.mixBook(s), found = Object.keys(B).length;
      body = `<div class="chips"><button class="chip ${ui.book === 'breeds' ? 'on' : ''}" data-action="book" data-id="breeds">Breed book</button><button class="chip ${ui.book === 'mixes' ? 'on' : ''}" data-action="book" data-id="mixes">Discovery book ${found} / ${HK.MIXES.length}</button></div>
        ${ui.book === 'breeds' ? `<div class="list">${Object.entries(BREED_FACTS).map(([n, F]) => `<div class="li"><div class="grow"><div class="t">${esc(n)} <span class="muted small">${esc(F.reg || '')}</span></div><div class="s">${esc(F.role || '')} · ${esc(F.m || '')} · nose ${esc(F.nose || '?')} · ${esc(F.mouth || '')}</div><div class="s">${esc(F.note || '')}</div></div></div>`).join('')}</div>`
        : `<p class="small muted">Cross the right breeds (and sometimes the right coats) and a litter comes out as a named breed. Each one you make goes in the book.</p>
          <div class="list">${HK.MIXES.map(m => { const got = B[m.id]; return `<div class="li"><b style="min-width:34px">#${m.id}</b><div class="grow"><div class="t" style="color:${got ? HK.MIX_RAR_COLOR[m.rarity] || 'inherit' : 'var(--dim)'}">${got ? esc(m.name) : '???'}</div><div class="s">${got ? `${esc(m.A)} × ${esc(m.B)}${m.need.length ? ' · ' + m.need.map(t => HK.TRAIT_WORDS[t] || t).join(', ') : ''} · first bred day ${got.day} (${esc(got.dog)})` : `${esc(m.rarity)} · gen ${m.gen}`}</div></div></div>`; }).join('')}</div>`}`;
    } else {
      const H0 = HD.ensureHd(s), rib = H0.ribbons, tro = RN.trophies(s), mem = H0.memorial || [], rank = HK.packRank(s), alpha = HK.alphaDog(s);
      const mounts = tro.map((t, i) => RN.mount(t, i)); showHogs(mounts.filter(Boolean));
      body = `<div class="section-title">Trophies</div>${tro.length ? `<div class="grid dgrid">${tro.map((t, i) => `<div class="card" style="text-align:center">${mounts[i] ? HOGG.art(mounts[i], 170) : `<div style="font-size:52px">${HOGS[t.kind]?.icon || '🐗'}</div>`}<h3>${t.w} lb ${esc(t.name)}</h3><div class="small muted">${esc(t.ground || '')} · day ${t.day}${t.dogs ? ' · ' + esc(t.dogs) : ''}</div></div>`).join('')}</div>` : '<p class="small muted">Hogs over 250 lb, ghost and giant boars, cats and bears go on the wall.</p>'}
        <div class="section-title">Ribbons</div>${rib.length ? `<div class="list">${rib.slice(0, 20).map(r => `<div class="li"><b>${medal(r.place)}</b><div class="grow"><div class="t">${esc(r.who)}</div><div class="s">${esc(r.at)}${r.ev && r.ev !== r.at ? ' · ' + esc(r.ev) : ''} · day ${r.day}</div></div></div>`).join('')}</div>` : '<p class="small muted">Place at a show, a trial or the fair.</p>'}
        <div class="section-title">The pack</div><p class="small">${alpha ? `👑 <b>${esc(alpha.name)}</b> leads the yard.` : 'No alpha yet.'} ${rank.slice(0, 5).map(d => esc(d.name)).join(' › ')}</p>
        ${mem.length ? `<div class="section-title">🕊️ Memorial</div><div class="list">${mem.map(m => `<div class="li"><div class="grow"><div class="t">${esc(m.name)} <span class="muted small">${esc(m.breed)}</span></div><div class="s">${esc(m.why)} · day ${m.day} · ${m.hunt?.n || 0} hunts</div></div></div>`).join('')}</div>` : ''}
        ${H0.log.length ? `<div class="section-title">Ranch log</div><div class="small">${H0.log.slice(0, 12).map(l => `<div>Day ${l.day}: ${esc(l.text)}</div>`).join('')}</div>` : ''}`;
    }
    root.innerHTML = head('Hogs & Dogs', `${HD.monthName(day)} · ${HD.seasonOf(day)}`) + `<div class="p-body" style="max-width:980px">
      <div class="tabs" style="margin:0 -12px 10px;overflow-x:auto">${TABS.map(([id, label]) => `<button class="${ui.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${label}</button>`).join('')}</div>${body}</div>`;
    const done = r => { if (say(r)) h.refresh(); return r.ok; };
    bind(root, {
      close: () => h.close(),
      tab: d => { if (ui.bay && !ui.bay.done) return; ui.tab = d.id; ui.res = null; ui.hsel = null; h.refresh(); },
      tier: d => { ui.show.tier = d.id; h.refresh(); },
      ring: d => { ui.ring[d.k] = d.id; h.refresh(); },
      prep: d => done(HT.doShowPrep(s, ui.show.dog || k.dogs.find(x => x.age >= 6)?.id, d.k)),
      enterShow: () => { const id = ui.show.dog || k.dogs.find(x => x.age >= 6)?.id, r = HT.enterShow(s, id, ui.show.tier, ui.ring); if (say(r)) { ui.res = { kind: 'show', ...r }; h.refresh(); } },
      bayGo: () => { const r = HT.startBayPractice(s, ui.bayDog || adults[0]?.id); if (!r.ok) return say(r); ui.bay = r.B; saveGame('auto', true); h.refresh(); runBay(); },
      cls: d => { ui.cls = d.id; ui.bayIds = []; h.refresh(); },
      bayPick: d => { const L = ui.bayIds, i = L.indexOf(d.id), n = HT.BAYC.CLASSES[ui.cls].dogs; if (i >= 0) L.splice(i, 1); else { if (L.length >= n) L.shift(); L.push(d.id); } h.refresh(); },
      sancGo: () => { const r = HT.startSanctioned(s, ui.cls, ui.bayIds); if (!r.ok) return say(r); ui.bay = r.B; ui.bayIds = []; saveGame('auto', true); h.refresh(); runBay(); },
      baySkip: () => { finishBay(true); },
      bayDone: () => { ui.bay = null; h.refresh(); },
      catchGo: () => done(HT.enterCatchTrial(s, ui.catchDog || HT.catchPool(s)[0]?.id)),
      fairGo: d => { const sel = root.querySelector(`select[data-fair="${d.k}"]`); done(HO.enterFair(s, d.k, sel?.value)); },
      auction: () => done(HO.fairAuction(s)),
      ration: d => done(HP.setRation(s, d.id)),
      hogSell: async d => { const g = HP.pinHogs(s).find(x => x.id === d.id); if (g && await confirm(`Sell ${g.name}?`, `<p>${d.k === 'live' ? 'The live buyer at the Joshua auction' : 'Joshua Wild Game Processing'} takes ${esc(g.name)}.</p>`, 'Sell')) done(HP.sellPinHog(s, d.id, d.k)); },
      hogName: async d => { const g = HP.pinHogs(s).find(x => x.id === d.id); const n = g && await prompt('Rename', '', 'Name', g.name); if (n != null) done(HP.renameHog(s, d.id, n)); },
      hogBreed: () => done(HP.breedHogs(s, ui.pinB, ui.pinS)),
      horse: d => { ui.hsel = d.id; h.refresh(); },
      hback: () => { ui.hsel = null; h.refresh(); },
      htrain: d => done(HO.trainHorse(s, ui.hsel, d.k)),
      hname: async () => { const x = HO.horses(s).find(q => q.id === ui.hsel); const n = x && await prompt('Rename', '', 'Name', x.name); if (n != null) done(HO.renameHorse(s, ui.hsel, n)); },
      hdna: () => done(HO.dnaTest(s, ui.hsel)),
      hsell: async () => { const x = HO.horses(s).find(q => q.id === ui.hsel); if (x && await confirm(`Sell ${x.name}?`, `<p>${fmtMoney(HO.horsePrice(x) * 0.8)}</p>`, 'Sell', true) && done(HO.sellHorse(s, ui.hsel))) { ui.hsel = null; h.refresh(); } },
      hbuy: () => { if (done(HO.buyHorse(s, ui.hsel))) { ui.hsel = null; h.refresh(); } },
      hbreed: () => done(HO.breedHorses(s, ui.hS, ui.hD)),
      gear: d => done(RN.buyGear(s, d.k)),
      job: d => done(RN.takeJob(s, d.id)),
      cam: d => done(RN.buyCam(s, d.id)),
      trap: d => done(RN.buyTrap(s, d.id)),
      book: d => { ui.book = d.id; h.refresh(); },
    });
    root.querySelectorAll('select[data-pick]').forEach(sel => sel.addEventListener('change', () => {
      const p = sel.dataset.pick;
      if (p === 'showdog') { ui.show.dog = sel.value; ui.res = null; } else if (p === 'baydog') ui.bayDog = sel.value; else if (p === 'catchdog') ui.catchDog = sel.value; else ui[p] = sel.value;
      h.refresh();
    }));
    root.querySelector('input[data-pick=pro]')?.addEventListener('change', e => { ui.ring.pro = e.target.checked; h.refresh(); });
    if (ui.bay) drawPen(root, ui.bay);
    hydrateDogs(root, k.dogs);
    hydrateHogs(); hydrateHorses();
  }, { cls: 'kennel-panel', onClose: () => { clearInterval(timer); if (ui.bay && !ui.bay.done) finishBay(false); } });

  // the pen runs at 4 seconds of trial a real second
  function runBay() {
    clearInterval(timer);
    timer = setInterval(() => {
      const B = ui.bay; if (!B || B.done) { clearInterval(timer); return; }
      tick(B);
      if (over(B)) { finishBay(true); return; }
      const root = handle.inner; drawPen(root, B);
      const bt = root.querySelector('[data-bt]'), bs = root.querySelector('[data-bs]'), bl = root.querySelector('[data-bl]');
      if (bt) bt.textContent = `${B.t}s`; if (bs) bs.textContent = HT.sanctionedScore(B).toFixed(2); if (bl) bl.innerHTML = B.log.slice(0, 4).map(esc).join('<br>');
      if (B.charge === 4) audio.squeal?.(); else if (B.t % 3 === 0) audio.bark?.(0.6);
    }, 250);
  }
  const tick = B => (B.champ ? HT.sanctionedTick(B) : HT.bayTick(B));
  const over = B => (B.champ ? HT.sanctionedOver(B) : B.t >= HT.BAYT.SECS);
  function finishBay(show) {
    const B = ui.bay; if (!B || B.done) return;
    clearInterval(timer);
    while (!over(B)) tick(B);
    if (B.champ) HT.finishSanctioned(s, B); else HT.finishBayPractice(s, B);
    saveGame('auto', true);
    if (show) handle.refresh();
  }
}

function drawPen(root, B) {
  const cv = root.querySelector('.baypen-cv'); if (!cv) return;
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R0 = Math.min(W, H) / 2 - 10;
  x.fillStyle = '#3d3022'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#7a6244'; x.beginPath(); x.arc(cx, cy, R0, 0, 7); x.fill();
  x.strokeStyle = '#c8b48a'; x.lineWidth = 3; x.stroke();
  for (let a = 0; a < 6.28; a += 0.4) { x.fillStyle = '#5a4630'; x.fillRect(cx + Math.cos(a) * R0 - 2, cy + Math.sin(a) * R0 - 2, 4, 4); }
  // the hog in the middle, facing the dog
  const da = B.ang, dr = R0 * B.rad / 100, dx = cx + Math.cos(da) * dr, dy = cy + Math.sin(da) * dr;
  x.save(); x.translate(cx, cy); x.rotate(da);
  x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(2, 3, 18, 10, 0, 0, 7); x.fill();
  x.fillStyle = B.charge > 0 ? '#5a2a20' : '#2e2622'; x.beginPath(); x.ellipse(0, 0, 18, 10, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(16, 0, 8, 6, 0, 0, 7); x.fill();
  x.strokeStyle = '#eee6d0'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, -4); x.lineTo(25, -7); x.moveTo(20, 4); x.lineTo(25, 7); x.stroke();
  x.restore();
  (B.ids || [B.dog]).forEach((id, i) => {
    const a = da + i * 0.5, px = i ? cx + Math.cos(a) * dr : dx, py = i ? cy + Math.sin(a) * dr : dy;
    x.save(); x.translate(px, py); x.rotate(a + Math.PI);
    x.fillStyle = B.grab > 0 ? '#e0192e' : '#c8913a'; x.beginPath(); x.ellipse(0, 0, 11, 6, 0, 0, 7); x.fill(); x.beginPath(); x.arc(10, 0, 5, 0, 7); x.fill();
    x.restore();
    if (B.t % 2 === 0) { x.strokeStyle = 'rgba(255,230,120,.7)'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, 14, 0, 7); x.stroke(); }
  });
}
