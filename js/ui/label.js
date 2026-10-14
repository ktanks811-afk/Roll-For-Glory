// The Label app and the two studios: start a label, scout the scene, sign
// artists in person, book sessions, drop records with promo, and watch the
// streams, front shows and tours, work the monthly showcase, fend off rival
// labels and read the SoundScan numbers. Rules: core/label.js.

import { openPanel, bind, esc, toast, confirm, prompt, closeAllPanels } from './dom.js';
import { game, fmtMoney } from '../core/state.js';
import { LOC_BY_ID } from '../data/world.js';
import { LABEL_COST, MAX_ROSTER, STUDIOS, KINDS, KIND_IDS, PROMO, ARTIST_BY_ID, PRODUCERS, RIVALS, RIVAL_BY_ID, GIGS, GIG_BY_ID, LABEL_SHOW_SHARE } from '../data/label.js';
import * as LB from '../core/label.js';
import { audio } from '../core/audio.js';
import { saveGame } from '../core/save.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const say = r => { toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) { audio.buy?.(); saveGame('auto', true); } else audio.error?.(); return r.ok; };
const starRow = t => { const n = LB.stars(t); return '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') + '<span class="muted">' + '☆'.repeat(5 - Math.ceil(n)) + '</span>'; };
const pct = x => `${Math.round(x * 100)}%`;
const near = (app, locId) => { const v = app?.world?.playerState?.(), l = LOC_BY_ID[locId]; return !!(v && l && Math.hypot(v.x - l.x, v.z - l.z) < LB.MEET_RANGE); };
const gps = (app, id, label) => { const l = LOC_BY_ID[id]; if (!l) return; app.world?.setGps(l.x, l.z, label || l.name); closeAllPanels(); toast(`GPS set: ${label || l.name}`, 'info'); };
const avatar = a => `<span class="lb-av" style="background:hsl(${[...a.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 360} 60% 38%)">${esc(a.name.replace(/^(Lil|Big|The) /, '')[0])}</span>`;

// opts.tab: roster | scene | releases | shows | showcase | soundscan | studio. opts.studio: the studio you're standing in.
export function openLabel(app, opts = {}) {
  const s = game.s, L = LB.ensureLabel(s);
  const studio = opts.studio && STUDIOS[opts.studio] ? opts.studio : null;
  const st = { tab: opts.tab || (studio ? 'studio' : 'roster'), view: opts.artist || null };
  openPanel((root, h) => {
    const ready = LB.finished(s);
    const S = studio ? STUDIOS[studio] : null;
    let body = '';
    if (!L.name) body = startCard(studio);
    else if (st.view) body = artistView(s, app, st.view);
    else if (st.tab === 'scene') body = sceneTab(s, app);
    else if (st.tab === 'releases') body = releasesTab(s);
    else if (st.tab === 'shows') body = showsTab(s);
    else if (st.tab === 'showcase') body = showcaseTab(s, app);
    else if (st.tab === 'soundscan') body = soundscanTab(s, st);
    else if (st.tab === 'studio' && S) body = studioTab(s, studio);
    else body = rosterTab(s, ready);
    const sc = L.showcase, scLive = sc && !sc.done;
    const tabs = [['roster', `Roster ${L.roster.length}/${MAX_ROSTER}${ready.length || L.roster.some(r => r.demand || r.offer || r.jailed) ? ' •' : ''}`], ['scene', 'Scene'], ['releases', 'Drop Hits'], ['shows', 'Shows'], ['showcase', `Showcase${scLive && sc.day === s.time.day ? ' •' : ''}`], ['soundscan', 'SoundScan']];
    if (S) tabs.unshift(['studio', 'Studio']);
    root.innerHTML = head(S ? S.name : L.name || 'Label', S ? esc(S.tagline) : L.name ? `Clout ${Math.floor(L.clout)} · ${fmtMoney(L.earned)} earned · ${LB.fmtStreams(L.streams)} streams` : 'Start a record label') + `<div class="p-body" style="max-width:760px">
      ${L.name && !st.view ? `<div class="tabs" style="margin:0 -12px 10px">${tabs.map(([id, label]) => `<button class="${st.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${label}</button>`).join('')}</div>` : ''}
      ${body}</div>`;
    bind(root, {
      close: () => h.close(),
      tab: d => { st.tab = d.id; st.view = null; h.refresh(); },
      back: () => { st.view = null; h.refresh(); },
      view: d => { st.view = d.id; h.refresh(); },
      gps: d => gps(app, d.id, d.label),
      start: async () => {
        const name = await prompt('Name your label', `<p>${fmtMoney(LABEL_COST)} for the LLC, a logo, distribution and a desk over the studio.</p>`, 'Murda Worth Records');
        if (name == null) return;
        if (say(LB.startLabel(s, name))) h.refresh();
      },
      sign: async d => {
        const a = ARTIST_BY_ID[d.id], deal = LB.dealsFor(s, a)[d.deal];
        if (!await confirm(`Sign ${a.name}?`, `<p>${fmtMoney(deal.advance)} advance. ${esc(a.name)} keeps <b>${pct(deal.cut)}</b> of the royalties and your label keeps ${pct(1 - deal.cut)}.</p>`, 'Sign')) return;
        if (say(LB.signArtist(s, d.id, d.deal, near(app, a.hang)))) { audio.win?.(); h.refresh(); }
      },
      drop: async d => {
        if (!await confirm(`Drop ${LB.artistName(d.id)}?`, '<p>They leave the label. The records you already put out keep paying you.</p>', 'Drop')) return;
        if (say(LB.dropArtist(s, d.id))) { st.view = null; h.refresh(); }
      },
      bail: d => { if (say(LB.postBail(s, d.id))) h.refresh(); },
      demand: d => { say(LB.answerDemand(s, d.id, d.yes === '1')); h.refresh(); },
      offer: d => { const r = LB.answerOffer(s, d.id, d.yes === '1'); say(r); if (r.left) st.view = null; h.refresh(); },
      gig: async d => {
        const G = GIG_BY_ID[d.gig], r = LB.signed(s, d.id), f = LB.gigFront(r, G);
        if (!await confirm(`Book ${LB.artistName(d.id)}: ${G.name}?`, `<p>${esc(G.venue)}. ${G.nights > 1 ? `${G.nights} nights, ` : ''}${fmtMoney(G.front)} up front.</p>
          <p>${f.label ? `<b>You front ${fmtMoney(f.label)}</b>. It goes on their tab and comes out of their share of the door and their royalties.` : 'They cover it themselves.'}${f.own ? ` They put in ${fmtMoney(f.own)} of their own.` : ''}</p>
          <p class="small muted">A full house would bring about ${fmtMoney(LB.gigForecast(r, G))} with merch. The label keeps ${pct(LABEL_SHOW_SHARE)}.</p>`, 'Book it')) return;
        if (say(LB.bookGig(s, d.id, d.gig))) h.refresh();
      },
      sc_sign: async d => {
        const a = ARTIST_BY_ID[d.id], price = LB.showcasePrice(s, d.id);
        if (!await confirm(`Sign ${a.name}?`, `<p>${fmtMoney(price)} advance beats every offer in the room. They keep ${pct(LB.STANDARD_CUT)}.</p>`, 'Sign')) return;
        if (say(LB.signAtShowcase(s, d.id, near(app, s.label.showcase.loc)))) { audio.win?.(); h.refresh(); }
      },
      ss_week: d => { st.week = +d.i; h.refresh(); },
      book: async d => {
        const K = KINDS[d.kind], a = ARTIST_BY_ID[d.id];
        const producerId = root.querySelector('[data-producer-for="' + d.id + '"]')?.value || null;
        if (!await confirm(`${K.name} with ${a.name}?`, `<p>${K.tracks} track${K.tracks > 1 ? 's' : ''}, ${K.days} day${K.days > 1 ? 's' : ''} in the booth at ${esc(S.name)} for <b>${fmtMoney(LB.sessionCost(studio, d.kind))}</b>.</p>`, 'Book it')) return;
        if (say(LB.bookSession(s, studio, d.id, d.kind, producerId))) h.refresh();
      },
      drop_rel: async d => {
        const P = PROMO.find(p => p.id === d.promo);
        if (P.cost && !await confirm(`Drop it with ${P.name.toLowerCase()}?`, `<p>${fmtMoney(P.cost)} on promo.</p>`, 'Drop it')) return;
        const r = LB.release(s, d.id, d.promo);
        if (say(r)) { if (r.rel.viral) audio.win?.(); st.tab = 'releases'; h.refresh(); }
      },
    });
  }, { cls: 'label-panel' });
}

function startCard(studio) {
  return `<div class="card"><h3>🎤 Start a record label</h3>
    <p>Sign artists you find around Fort Worth and Dallas, cut their records at ${studio ? 'this studio' : 'Magnolia Sound, Trap House Studios, The Kitchen, Inner Circle or Deep Ellum Sound Lab'}, drop them, and the label gets paid on every stream. Artists play shows on the weekend and you take a cut.</p>
    <p class="small muted">Costs ${fmtMoney(LABEL_COST)}. Bigger names won't talk to you until your label has some clout, and clout comes from streams.</p>
    <button class="btn btn-primary" data-action="start">Start a label · ${fmtMoney(LABEL_COST)}</button></div>`;
}

function statusLine(s, r) {
  const L = s.label, ses = L.sessions.find(x => x.artist === r.id);
  if (r.jailed) return `<span class="bad">In jail · bail ${fmtMoney(r.jailed.bail)}</span>`;
  if (r.offer) return `<span class="bad">${esc(RIVAL_BY_ID[r.offer.rival]?.name)} wants them · answer by day ${r.offer.until}</span>`;
  if (r.demand) return `<span style="color:#f0a020">Wants ${LB.demandText(r.demand)}</span>`;
  if (r.gig) return `On the road · ${GIG_BY_ID[r.gig.id].name} till day ${r.gig.end}`;
  if (ses) return ses.ready <= s.time.day ? `<span class="good">"${esc(ses.title)}" is ready to drop</span>` : `In the studio · done day ${ses.ready}`;
  return 'Ready to record';
}

function rosterTab(s, ready) {
  const L = s.label;
  let html = '';
  if (ready.length) html += `<h3>Ready to drop</h3>` + ready.map(ses => {
    const a = ARTIST_BY_ID[ses.artist], r = LB.signed(s, ses.artist);
    return `<div class="card"><div class="row" style="gap:10px;align-items:center">${avatar(a)}<div class="grow"><b>"${esc(ses.title)}"</b> · ${esc(a.name)}
      <div class="small muted">${KINDS[ses.kind].name} · ${LB.gradeOf(ses.quality)} (${ses.quality}) · about ${LB.fmtStreams(LB.dayOne(ses.quality, r?.buzz || a.buzz, ses.kind))} streams day one with no promo</div></div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${PROMO.map(p => `<button class="btn btn-sm ${p.id === 'none' ? '' : 'btn-primary'}" data-action="drop_rel" data-id="${ses.id}" data-promo="${p.id}">${esc(p.name)}${p.cost ? ` · ${fmtMoney(p.cost)}` : ''}</button>`).join('')}</div></div>`;
  }).join('');
  html += `<h3>Your artists</h3>`;
  html += L.roster.length ? `<div class="list">${L.roster.map(r => { const a = ARTIST_BY_ID[r.id]; return `<div class="li click" data-action="view" data-id="${r.id}">${avatar(a)}<div class="grow"><div class="t">${esc(a.name)} <small class="muted">${esc(a.genre)}</small></div>
      <div class="s">${r.buzz.toLocaleString()} fans · keeps ${pct(r.cut)}${r.debt >= 1 ? ` · owes ${fmtMoney(Math.round(r.debt))}` : ''} · ${statusLine(s, r)}</div></div><span class="muted">›</span></div>`; }).join('')}</div>`
    : `<p class="muted">Nobody signed yet. Check the Scene tab, then go meet an artist where they hang out.</p>`;
  html += `<p class="small muted" style="margin-top:10px">The label pays into your bank every morning. Record at a studio:</p>
    <div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(STUDIOS).map(([id, S]) => `<button class="btn btn-sm" data-action="gps" data-id="${id}">📍 ${esc(S.name)}</button>`).join('')}</div>`;
  return html;
}

function sceneTab(s, app) {
  const L = s.label;
  const featured = Object.values(ARTIST_BY_ID).filter(a => a.featured).map(a => a.id);
  const list = [...new Set([...L.known, ...featured])].map(id => ARTIST_BY_ID[id]).filter(a => a && !LB.signed(s, a.id)).sort((a, b) => !!LB.rivalOf(s, a.id) - !!LB.rivalOf(s, b.id));
  return `<p class="small muted">Your A&amp;R texts you when she hears about somebody. To sign an artist you have to go where they hang out and talk to them in person.</p>
    <div class="list">${list.map(a => { const here = near(app, a.hang), need = LB.cloutNeeded(a); return `<div class="li click" data-action="view" data-id="${a.id}">${avatar(a)}<div class="grow"><div class="t">${esc(a.name)} <small class="muted">${esc(a.genre)} · ${esc(a.hood)}</small></div>
      <div class="s">${starRow(a.talent)} · ${LB.buzzOf(s, a.id).toLocaleString()} fans · ${LB.rivalOf(s, a.id) ? `<span class="bad">signed to ${esc(LB.rivalOf(s, a.id).name)}</span> · buyout ${fmtMoney(LB.buyoutOf(s, a))}` : `wants ${fmtMoney(LB.askOf(s, a))}`}${need > L.clout ? ` · <span class="bad">needs clout ${need}</span>` : ''}</div>
      <div class="s">${here ? '<b class="good">They\'re right here</b>' : `Hangs out at ${esc(LB.hangName(a))}`}</div></div><span class="muted">›</span></div>`; }).join('') || '<p class="muted">You\'ve signed everyone you know about. More names come in by text.</p>'}</div>`;
}

function artistView(s, app, id) {
  const a = ARTIST_BY_ID[id], r = LB.signed(s, id), L = s.label;
  const back = `<button class="btn btn-sm" data-action="back">‹ Back</button>`;
  let html = `${back}<div class="card" style="margin-top:8px"><div class="row" style="gap:12px;align-items:center">${avatar(a)}<div class="grow"><h3 style="margin:0">${esc(a.name)}</h3>
    <div class="small muted">${esc(a.real)} · ${esc(a.genre)} · ${esc(a.hood)}</div><div>${starRow(a.talent)}${r ? ` <small class="muted">talent ${a.talent}</small>` : ''}</div></div></div>
    <p>${esc(a.bio)}</p><div class="small">${LB.buzzOf(s, id).toLocaleString()} fans</div></div>`;
  if (r) {
    const recs = L.releases.filter(x => x.artist === id);
    const mood = r.mood ?? 70, moodWord = mood >= 75 ? 'Loyal' : mood >= 50 ? 'Content' : mood >= 30 ? 'Restless' : 'Ready to leave';
    html += `<div class="card"><h3>Contract</h3><p>Signed day ${r.signedDay} for ${fmtMoney(r.advance)}. They keep <b>${pct(r.cut)}</b> of royalties. ${r.shows} show${r.shows === 1 ? '' : 's'} played.</p>
      <div class="small">Mood: <b class="${mood < 45 ? 'bad' : mood >= 75 ? 'good' : ''}">${moodWord}</b> (${Math.round(mood)}) · Owes the label: <b class="${r.debt >= 1 ? 'bad' : ''}">${fmtMoney(Math.round(r.debt || 0))}</b> · Their own money: ${fmtMoney(Math.floor(r.wallet || 0))}</div>
      <p class="small muted">Bail you post and show money you front goes on their tab. It comes out of their royalties and their share of the door before they see a dollar.</p><p>${statusLine(s, r)}</p>
      ${r.jailed ? `<button class="btn btn-primary" data-action="bail" data-id="${id}">Post bail · ${fmtMoney(r.jailed.bail)} (on their tab)</button>` : ''}
      ${r.offer ? `<p><b>${esc(RIVAL_BY_ID[r.offer.rival].name)}</b> offered them a deal. Match it with a ${fmtMoney(r.offer.amount)} re-up bonus or they sign over there.</p><div class="row" style="gap:6px"><button class="btn btn-primary" data-action="offer" data-id="${id}" data-yes="1">Match · ${fmtMoney(r.offer.amount)}</button><button class="btn" data-action="offer" data-id="${id}" data-yes="0">Let them go</button></div>` : ''}
      ${r.demand ? `<p>They want <b>${LB.demandText(r.demand)}</b>. Say no and there's a ${pct(LB.leaveOdds(r))} chance they leave for a rival.</p><div class="row" style="gap:6px"><button class="btn btn-primary" data-action="demand" data-id="${id}" data-yes="1">${r.demand.bonus ? `Pay ${fmtMoney(r.demand.bonus)}` : `Give them ${pct(r.demand.cut)}`}</button><button class="btn" data-action="demand" data-id="${id}" data-yes="0">Say no (they might walk)</button></div>` : ''}
      <div style="margin-top:8px"><button class="btn btn-sm btn-danger" data-action="drop" data-id="${id}">Drop from the label</button></div></div>`;
    html += gigCard(s, r);
    if (recs.length) html += `<div class="card"><h3>Records</h3>${recs.map(relRow).join('')}</div>`;
    return html;
  }
  const rv = LB.rivalOf(s, id);
  if (rv) {
    const why = LB.signBlock(s, id, near(app, a.hang), 'buyout'), cost = LB.buyoutOf(s, a);
    return html + `<div class="card"><h3>Signed to ${esc(rv.name)}</h3><p class="small">Their deal runs till day ${L.rivalOf[id].until}. Buy them out and they're yours. Meet them at <b>${esc(LB.hangName(a))}</b>. <button class="btn btn-sm" data-action="gps" data-id="${a.hang}" data-label="${esc(a.name)} · ${esc(LB.hangName(a))}">📍 GPS</button></p>
      ${why ? `<p class="small ${/in person/.test(why) ? 'muted' : 'bad'}">${esc(why)}</p>` : ''}
      <button class="btn btn-primary" data-action="sign" data-id="${id}" data-deal="buyout" ${why ? 'disabled' : ''}>Buy out the deal · ${fmtMoney(cost)}<br><small>they keep ${pct(LB.STANDARD_CUT)}</small></button></div>`;
  }
  const why = LB.signBlock(s, id, near(app, a.hang)), deals = LB.dealsFor(s, a);
  html += `<div class="card"><h3>Sign ${esc(a.name)}</h3><p class="small">Hangs out at <b>${esc(LB.hangName(a))}</b>. <button class="btn btn-sm" data-action="gps" data-id="${a.hang}" data-label="${esc(a.name)} · ${esc(LB.hangName(a))}">📍 GPS</button></p>
    ${why ? `<p class="small ${/in person/.test(why) ? 'muted' : 'bad'}">${esc(why)}</p>` : ''}
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" data-action="sign" data-id="${id}" data-deal="standard" ${why ? 'disabled' : ''}>Big advance · ${fmtMoney(deals.standard.advance)}<br><small>they keep ${pct(deals.standard.cut)}</small></button>
      <button class="btn" data-action="sign" data-id="${id}" data-deal="cheap" ${why ? 'disabled' : ''}>Small advance · ${fmtMoney(deals.cheap.advance)}<br><small>they keep ${pct(deals.cheap.cut)}</small></button>
    </div></div>`;
  return html;
}

function relRow(rel) {
  const a = ARTIST_BY_ID[rel.artist], pos = LB.chartPos(rel.last || rel.daily);
  return `<div class="li"><span style="font-size:20px">${rel.viral ? '🔥' : '💿'}</span><div class="grow"><div class="t">"${esc(rel.title)}" <small class="muted">${esc(a?.name || '')} · ${KINDS[rel.kind].name}</small></div>
    <div class="s">${LB.gradeOf(rel.quality)} · day ${rel.day} · ${rel.last ? `${LB.fmtStreams(rel.last)} streams yesterday` : rel.total ? 'cooled off' : 'out today'}${pos ? ` · <b>#${pos}</b> on Throttle` : ''}</div>
    <div class="s">${LB.fmtStreams(rel.total)} total · label made ${fmtMoney(rel.earned)}</div></div></div>`;
}

function releasesTab(s) {
  const L = s.label;
  const ready = LB.finished(s);
  const readyHtml = ready.length ? `<h3>Ready to drop</h3><p class="small muted">Your finished records are here. Pick a promo plan and drop the hit.</p>${ready.map(ses => {
    const a = ARTIST_BY_ID[ses.artist], r = LB.signed(s, ses.artist);
    return `<div class="card"><div class="row" style="gap:10px;align-items:center">${avatar(a)}<div class="grow"><b>"${esc(ses.title)}"</b> · ${esc(a?.name || ses.artist)}<div class="small muted">${KINDS[ses.kind].name} · ${LB.gradeOf(ses.quality)} · about ${LB.fmtStreams(LB.dayOne(ses.quality, r?.buzz || a?.buzz || 0, ses.kind))} streams with no promo</div></div></div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${PROMO.map(p => `<button class="btn btn-sm ${p.id === 'none' ? '' : 'btn-primary'}" data-action="drop_rel" data-id="${ses.id}" data-promo="${p.id}">${esc(p.name)}${p.cost ? ` · ${fmtMoney(p.cost)}` : ''}</button>`).join('')}</div></div>`;
  }).join('')}` : '<p class="muted">No finished tracks yet. Sign an artist, book a studio session, then come back here to drop the hit.</p>';
  const catalog = L.releases.length ? `<h3>Released hits</h3><div class="list">${L.releases.map(relRow).join('')}</div>` : '';
  return readyHtml + catalog;
}

function studioTab(s, studio) {
  const L = s.label, S = STUDIOS[studio];
  const rows = L.roster.map(r => {
    const a = ARTIST_BY_ID[r.id], busy = L.sessions.some(x => x.artist === r.id);
    return `<div class="card"><div class="row" style="gap:10px;align-items:center">${avatar(a)}<div class="grow"><b>${esc(a.name)}</b> <small class="muted">${esc(a.genre)}</small><div class="small">${statusLine(s, r)}</div></div></div>
      ${busy || r.jailed ? '' : `<label class="field" style="margin-top:8px"><span>Producer</span><select class="input" data-producer-for="${esc(r.id)}"><option value="">House / artist-led</option>${PRODUCERS.map(p => `<option value="${p.id}">${esc(p.name)} · +${p.q} quality · ${Math.round((p.rate - 1) * 100)}% fee</option>`).join('')}</select></label><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${KIND_IDS.map(k => `<button class="btn btn-sm" data-action="book" data-id="${r.id}" data-kind="${k}">${KINDS[k].name} · ${fmtMoney(LB.sessionCost(studio, k))}<br><small>${KINDS[k].days} day${KINDS[k].days > 1 ? 's' : ''}</small></button>`).join('')}</div>`}</div>`;
  }).join('');
  const producerCards = `<div class="section-title">🎚 Producers</div><div class="grid">${PRODUCERS.map(p => `<div class="card"><h3>${esc(p.name)}</h3><div class="small muted">${esc(p.genre)} · +${p.q} quality · ${Math.round((p.rate - 1) * 100)}% session fee</div><p class="small">${esc(p.bio)}</p></div>`).join('')}</div>`;
  return `<p class="small muted">${esc(S.owner)} runs the board here.${S.q ? ' Better room, better records, and it costs more.' : ' Fair prices, honest mixes.'} Albums take longest and pay the most.</p>${producerCards}
    ${rows || '<p class="muted">Sign an artist first, then bring them here.</p>'}`;
}

// ---------------------------------------------------------------- shows and tours
function gigCard(s, r) {
  const last = r.gigs?.length ? `<div class="list" style="margin-top:8px">${r.gigs.slice(0, 4).map(g => `<div class="li"><div class="grow"><div class="t">${esc(GIG_BY_ID[g.id].name)} <small class="muted">day ${g.day}</small></div><div class="s">${g.fans.toLocaleString()} tickets · ${fmtMoney(g.total)} gross · label ${fmtMoney(g.label)}${g.recouped ? ` + ${fmtMoney(g.recouped)} recouped` : ''}</div></div></div>`).join('')}</div>` : '';
  return `<div class="card"><h3>Book shows</h3>${r.gig ? `<p>${statusLine(s, r)}</p>` : `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px">${GIGS.map(G => {
    const why = LB.gigBlock(s, r.id, G.id), f = LB.gigFront(r, G);
    return `<button class="btn btn-sm" data-action="gig" data-id="${r.id}" data-gig="${G.id}" ${why ? `disabled title="${esc(why)}"` : ''} style="text-align:left">${esc(G.name)} · ${fmtMoney(G.front)}<br><small>${why && /fans/.test(why) ? `needs ${G.minFans.toLocaleString()} fans` : `${f.label ? `you front ${fmtMoney(f.label)}` : 'they pay'} · up to ${fmtMoney(LB.gigForecast(r, G))}`}</small></button>`;
  }).join('')}</div>`}${last}</div>`;
}
function showsTab(s) {
  const L = s.label;
  return `<p class="small muted">Promoters want money up front. If an artist is broke or already owes you, the label fronts it and it goes on their tab. The label keeps ${pct(LABEL_SHOW_SHARE)} of the door and merch, and their share pays back what they owe first. Recouped so far: <b>${fmtMoney(Math.round(L.recouped || 0))}</b>.</p>
    ${L.roster.length ? L.roster.map(r => { const a = ARTIST_BY_ID[r.id]; return `<div class="card"><div class="row" style="gap:10px;align-items:center">${avatar(a)}<div class="grow"><b>${esc(a.name)}</b> <small class="muted">${r.buzz.toLocaleString()} fans</small><div class="small">Owes ${fmtMoney(Math.round(r.debt || 0))} · has ${fmtMoney(Math.floor(r.wallet || 0))} · ${statusLine(s, r)}</div></div></div></div>${gigCard(s, r).replace('<div class="card"><h3>Book shows</h3>', '<div class="card" style="margin-top:-6px">')}`; }).join('') : '<p class="muted">Sign somebody first.</p>'}`;
}

// ---------------------------------------------------------------- the monthly showcase
function showcaseTab(s, app) {
  const L = s.label, sc = L.showcase, day = s.time.day;
  if (!sc || (sc.done && day > sc.day + 6)) return `<div class="card"><h3>🎙 Upcoming Artist Showcase</h3><p>Once a month your A&amp;R puts four new names on a stage. Rival labels show up with checks. Be in the room that night and beat their offers, or the talent signs somewhere else.</p><p class="small muted">Next showcase: day ${LB.nextShowcase(day + 1)}. The lineup comes out a week before.</p></div>`;
  const loc = LOC_BY_ID[sc.loc], here = near(app, sc.loc), live = day === sc.day;
  const headline = sc.done ? `Last showcase · day ${sc.day}` : live ? 'Tonight' : `Day ${sc.day} · ${sc.day - day} day${sc.day - day > 1 ? 's' : ''} out`;
  return `<div class="card"><h3>🎙 Showcase · ${esc(headline)}</h3><p class="small">${esc(loc?.name || '')}. ${sc.done ? `Next one is day ${LB.nextShowcase(day + 1)}.` : live ? (here ? '<b class="good">You\'re in the room.</b> Make your offers.' : 'You have to be there to make offers.') : 'The lineup is set. Rivals are already making calls.'}</p>
    ${sc.done ? '' : `<button class="btn btn-sm" data-action="gps" data-id="${sc.loc}" data-label="Showcase · ${esc(loc?.name || '')}">📍 GPS</button>`}</div>
    ${sc.lineup.map(id => {
      const a = ARTIST_BY_ID[id], bid = sc.bids[id], got = sc.signed[id], why = LB.showcaseBlock(s, id, here);
      const perf = day >= sc.day ? sc.perf[id] : null;
      return `<div class="card"><div class="row" style="gap:10px;align-items:center">${avatar(a)}<div class="grow"><b>${esc(a.name)}</b> <small class="muted">${esc(a.genre)} · ${esc(a.hood)}</small>
        <div class="small">${starRow(a.talent)} · ${a.buzz.toLocaleString()} fans${perf != null ? ` · set: <b>${LB.gradeOf(perf)}</b> (${perf})` : ''}</div>
        <div class="small muted">${esc(a.bio)}</div>
        <div class="small">${got ? (got === 'you' ? '<b class="good">Signed to you</b>' : `<span class="bad">Signed to ${esc(RIVAL_BY_ID[got]?.name)}</span>`) : bid ? `${esc(RIVAL_BY_ID[bid.rival].name)} is offering ${fmtMoney(bid.amount)}` : 'No offers yet'}</div></div></div>
        ${got ? '' : `<button class="btn btn-primary btn-sm" style="margin-top:8px" data-action="sc_sign" data-id="${id}" ${why ? 'disabled' : ''}>Sign · ${fmtMoney(LB.showcasePrice(s, id))}</button>${why ? `<div class="small muted">${esc(why)}</div>` : ''}`}</div>`;
    }).join('')}`;
}

// ---------------------------------------------------------------- SoundScan
const ownerTag = (s, own) => own === 'you' ? `<b style="color:var(--red)">${esc(s.label.name)}</b>` : own === 'indie' ? '<span class="muted">Independent</span>' : `<span style="color:${RIVAL_BY_ID[own]?.color}">${esc(RIVAL_BY_ID[own]?.name || own)}</span>`;
const fmtN = n => n.toLocaleString();
function soundscanTab(s, st) {
  const L = s.label, ss = L.ss, weeks = [{ label: `Week ${ss.wk} (so far)`, by: ss.cur, owner: null }, ...ss.hist.map(h => ({ label: `Week ${h.wk}`, by: h.by, owner: h.owner }))];
  const i = Math.min(st.week ?? (ss.hist.length ? 1 : 0), weeks.length - 1), W = weeks[i];
  const rows = LB.ssRows(W.by), own = id => W.owner?.[id] || LB.ownerOf(s, id);
  const prev = weeks[i + 1] ? LB.ssRows(weeks[i + 1].by) : [];
  const prevRank = Object.fromEntries(prev.map((x, k) => [x.id, k + 1]));
  // market share by label
  const share = {};
  for (const x of rows) share[own(x.id)] = (share[own(x.id)] || 0) + x.u;
  const total = Object.values(share).reduce((a, b) => a + b, 0) || 1;
  const labels = Object.entries(share).sort((a, b) => b[1] - a[1]);
  const move = (id, k) => { const p = prevRank[id]; return !weeks[i + 1] ? '' : !p ? '<small class="good">NEW</small>' : p > k ? `<small class="good">▲${p - k}</small>` : p < k ? `<small class="bad">▼${k - p}</small>` : '<small class="muted">–</small>'; };
  const mine = L.roster.map(r => r.id).concat(L.releases.map(x => x.artist)).filter((v, k, a) => a.indexOf(v) === k);
  return `<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">${weeks.map((w, k) => `<button class="btn btn-sm ${k === i ? 'btn-primary' : ''}" data-action="ss_week" data-i="${k}">${esc(w.label)}</button>`).join('')}</div>
    <p class="small muted">DFW SoundScan. Units = pure sales + 1 per ${fmtN(LB.SEA)} streams.</p>
    <div class="card"><h3>Label market share</h3>${labels.map(([o, u]) => `<div class="small" style="margin:4px 0"><div class="row" style="justify-content:space-between"><span>${ownerTag(s, o)}</span><span>${fmtN(u)} units · ${Math.round(u / total * 100)}%</span></div>
      <div style="height:6px;background:var(--line);border-radius:3px"><div style="height:6px;width:${(u / total * 100).toFixed(1)}%;border-radius:3px;background:${o === 'you' ? 'var(--red)' : RIVAL_BY_ID[o]?.color || '#777'}"></div></div></div>`).join('') || '<p class="muted">No numbers yet this week.</p>'}</div>
    <div class="card"><h3>Your artists</h3>${mine.length ? `<div style="overflow-x:auto"><table class="small" style="width:100%;border-collapse:collapse"><tr class="muted"><th align="left">Artist</th><th align="right">Rank</th><th align="right">Units</th><th align="right">Sales</th><th align="right">Streams</th><th align="right">Peak</th></tr>
      ${mine.map(id => { const k = rows.findIndex(x => x.id === id), x = rows[k], r = LB.signed(s, id); return `<tr><td>${esc(LB.artistName(id))}${r ? '' : ' <small class="muted">(gone)</small>'}</td><td align="right">${k >= 0 ? `#${k + 1} ${move(id, k + 1)}` : '–'}</td><td align="right">${x ? fmtN(x.u) : 0}</td><td align="right">${x ? fmtN(x.sa) : 0}</td><td align="right">${x ? LB.fmtStreams(x.st) : 0}</td><td align="right">${r?.peak ? '#' + r.peak : '–'}</td></tr>`; }).join('')}</table></div>` : '<p class="muted">Nobody on the label yet.</p>'}
      ${L.releases.length ? `<h4 style="margin:10px 0 4px">Your records, all time</h4><div style="overflow-x:auto"><table class="small" style="width:100%;border-collapse:collapse"><tr class="muted"><th align="left">Record</th><th align="right">Sales</th><th align="right">Streams</th><th align="right">Units</th><th align="right">Label $</th></tr>
      ${L.releases.slice(0, 12).map(x => `<tr><td>"${esc(x.title)}" <small class="muted">${esc(LB.artistName(x.artist))}</small></td><td align="right">${fmtN(x.sales || 0)}</td><td align="right">${LB.fmtStreams(x.total)}</td><td align="right">${fmtN(LB.unitsOf([x.total, x.sales || 0]))}</td><td align="right">${fmtMoney(x.earned)}</td></tr>`).join('')}</table></div>` : ''}</div>
    <div class="card"><h3>Top 25 · DFW</h3><div style="overflow-x:auto"><table class="small" style="width:100%;border-collapse:collapse"><tr class="muted"><th align="left">#</th><th align="left">Artist</th><th align="left">Label</th><th align="right">Units</th><th align="right">Sales</th><th align="right">Streams</th></tr>
      ${rows.slice(0, 25).map((x, k) => `<tr style="${own(x.id) === 'you' ? 'background:rgba(255,40,60,.12)' : ''}"><td>${k + 1} ${move(x.id, k + 1)}</td><td>${esc(LB.artistName(x.id))}</td><td>${ownerTag(s, own(x.id))}</td><td align="right">${fmtN(x.u)}</td><td align="right">${fmtN(x.sa)}</td><td align="right">${LB.fmtStreams(x.st)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nothing yet. Numbers come in every morning.</td></tr>'}</table></div></div>
    <div class="card"><h3>Rival labels</h3>${RIVALS.map(rv => { const ros = LB.rivalRoster(s, rv.id); return `<div class="li"><span class="lb-av" style="background:${rv.color}">${esc(rv.name[0])}</span><div class="grow"><div class="t">${esc(rv.name)} <small class="muted">${esc(rv.home)} · run by ${esc(rv.boss)}</small></div>
      <div class="s">${fmtN(share[rv.id] || 0)} units this week · ${ros.length} artist${ros.length === 1 ? '' : 's'}: ${ros.map(id => esc(LB.artistName(id))).join(', ') || 'nobody yet'}</div></div></div>`; }).join('')}</div>`;
}
