// The Label app and the two studios: start a label, scout the scene, sign
// artists in person, book sessions, drop records with promo, and watch the
// streams. Rules: core/label.js.

import { openPanel, bind, esc, toast, confirm, prompt, closeAllPanels } from './dom.js';
import { game, fmtMoney } from '../core/state.js';
import { LOC_BY_ID } from '../data/world.js';
import { LABEL_COST, MAX_ROSTER, STUDIOS, KINDS, KIND_IDS, PROMO, ARTIST_BY_ID, PRODUCERS } from '../data/label.js';
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

// opts.tab: roster | scene | releases | studio. opts.studio: the studio you're standing in.
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
    else if (st.tab === 'studio' && S) body = studioTab(s, studio);
    else body = rosterTab(s, ready);
    const tabs = [['roster', `Roster ${L.roster.length}/${MAX_ROSTER}${ready.length ? ' •' : ''}`], ['scene', 'Scene'], ['releases', 'Releases']];
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
  if (r.demand) return `<span style="color:#f0a020">Wants ${pct(r.demand.cut)}</span>`;
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
      <div class="s">${r.buzz.toLocaleString()} fans · keeps ${pct(r.cut)} · ${statusLine(s, r)}</div></div><span class="muted">›</span></div>`; }).join('')}</div>`
    : `<p class="muted">Nobody signed yet. Check the Scene tab, then go meet an artist where they hang out.</p>`;
  html += `<p class="small muted" style="margin-top:10px">The label pays into your bank every morning. Record at a studio:</p>
    <div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(STUDIOS).map(([id, S]) => `<button class="btn btn-sm" data-action="gps" data-id="${id}">📍 ${esc(S.name)}</button>`).join('')}</div>`;
  return html;
}

function sceneTab(s, app) {
  const L = s.label;
  const featured = Object.values(ARTIST_BY_ID).filter(a => a.featured).map(a => a.id);\n  const list = [...new Set([...L.known, ...featured])].map(id => ARTIST_BY_ID[id]).filter(a => a && !LB.signed(s, a.id));
  return `<p class="small muted">Your A&amp;R texts you when she hears about somebody. To sign an artist you have to go where they hang out and talk to them in person.</p>
    <div class="list">${list.map(a => { const here = near(app, a.hang), need = LB.cloutNeeded(a); return `<div class="li click" data-action="view" data-id="${a.id}">${avatar(a)}<div class="grow"><div class="t">${esc(a.name)} <small class="muted">${esc(a.genre)} · ${esc(a.hood)}</small></div>
      <div class="s">${starRow(a.talent)} · ${LB.buzzOf(s, a.id).toLocaleString()} fans · wants ${fmtMoney(LB.askOf(s, a))}${need > L.clout ? ` · <span class="bad">needs clout ${need}</span>` : ''}</div>
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
    html += `<div class="card"><h3>Contract</h3><p>Signed day ${r.signedDay} for ${fmtMoney(r.advance)}. They keep <b>${pct(r.cut)}</b> of royalties. ${r.shows} show${r.shows === 1 ? '' : 's'} played.</p><p>${statusLine(s, r)}</p>
      ${r.jailed ? `<button class="btn btn-primary" data-action="bail" data-id="${id}">Post bail · ${fmtMoney(r.jailed.bail)}</button>` : ''}
      ${r.demand ? `<div class="row" style="gap:6px"><button class="btn btn-primary" data-action="demand" data-id="${id}" data-yes="1">Give them ${pct(r.demand.cut)}</button><button class="btn" data-action="demand" data-id="${id}" data-yes="0">Say no (they might walk)</button></div>` : ''}
      <div style="margin-top:8px"><button class="btn btn-sm btn-danger" data-action="drop" data-id="${id}">Drop from the label</button></div></div>`;
    if (recs.length) html += `<div class="card"><h3>Records</h3>${recs.map(relRow).join('')}</div>`;
    return html;
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
  return L.releases.length ? `<div class="list">${L.releases.map(relRow).join('')}</div>` : '<p class="muted">Nothing out yet. Book a session at a studio, then drop it from the Roster tab.</p>';
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
