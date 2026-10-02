// Phone app: Online Crew. Crews are permanent: they live in a database (see
// net/crewdb.js), so a crew is still there when nobody is online. Found one or
// join one that real players run; chat; the leader accepts requests, kicks,
// edits or disbands. The live layer (who's online, which server, instant
// chat) comes from net/crews.js.

import { bind, esc, toast, confirm } from './dom.js';
import { game, spend, fmtMoney } from '../core/state.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';
import { online, SERVER_BY_ID } from '../net/online.js';
import { lobby, cleanCrewName, cleanTag, CREW_COLORS, CREW_FEE } from '../net/crews.js';
import { crewdb } from '../net/crewdb.js';

const head = title => `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>${esc(title)}</h2></div>`;
const QUICK = ['🏁 Crew meet?', "Who's on?", '🔥', 'On my way', 'GG'];
let current = null;          // the phone view on screen
const net = { dir: [], members: [], pending: [], chat: [], error: '', loading: false, loaded: false, lastSync: 0, busy: false };

const rnd = (n, set = 'abcdefghijklmnopqrstuvwxyz0123456789') => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
export function ensureIdentity(s) { s.uid ??= rnd(10); s.crewKey ??= rnd(24); return s.uid; }
const who = s => ({ uid: s.uid, tok: s.crewKey, name: String(s.player.name).slice(0, 16), rep: Math.round(s.rep || 0) });
export const crewTag = s => (s.onlineCrew ? { tag: s.onlineCrew.tag, color: s.onlineCrew.color } : null);

// Push my name / crew / server into the live lobby.
export function syncLobby() {
  const s = game.s; if (!s) return;
  ensureIdentity(s);
  lobby.setMe({ name: s.player.name, uid: s.uid, crewId: s.onlineCrew?.id || '', where: online.active ? online.room : '' });
}

// ---------------------------------------------------------------- server state
function reconcile(res, s) {
  const had = s.onlineCrew;
  if (res.crew) {
    const c = res.crew;
    s.onlineCrew = { id: c.id, name: c.name, tag: c.tag, color: c.color, motto: c.motto || '', open: !!c.open, role: res.role };
    s.crewPending = null;
    if (!had || had.id !== c.id) { emit('crewJoined', { online: true }); toast(`You're in [${c.tag}] ${c.name}.`, 'good'); audio.win?.(); }
  } else {
    s.crewPending = res.pending || null;
    if (had) { toast(`You're no longer in [${had.tag}] ${had.name} (removed, or it was disbanded).`, 'bad'); s.onlineCrew = null; }
  }
  syncLobby();
}

export async function refreshCrew({ members = true, chat = false } = {}) {
  const s = game.s; if (!s || net.busy) return;
  net.busy = true;
  const db = crewdb(), u = (ensureIdentity(s), who(s));
  try {
    const [dir, mine] = await Promise.all([db.list(), db.mine(u)]);
    net.dir = dir; net.error = ''; net.loaded = true;
    reconcile(mine, s);
    const c = s.onlineCrew;
    if (c && members) net.members = await db.members(c.id); else if (!c) net.members = [];
    net.pending = c?.role === 'leader' ? await db.pending(u) : [];
    if (c && chat) net.chat = (await db.chat(u)).map(m => ({ name: m.name, text: m.text, mine: m.uid === s.uid, t: m.t }));
    if (c && Date.now() - net.lastSync > 60000) { net.lastSync = Date.now(); db.sync(u).catch(() => {}); }
  } catch (e) { net.error = e.message || 'Could not reach the crew server.'; }
  net.busy = false;
  redraw();
}

function redraw() {
  if (!current || !current.scr.isConnected) return;
  const a = document.activeElement;
  if (a && current.scr.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) { if (current.scr.querySelector('[data-cchat]')) drawChat(current.scr); return; }
  current.ctx.h.refresh();
}

// Wire network events once at boot, plus a slow background check while in (or waiting on) a crew.
export function initCrews(app) {
  lobby.on((ev, d) => {
    const s = game.s; if (!s) return;
    if (ev === 'poke') refreshCrew({ chat: !!current?.scr.querySelector('[data-cchat]') });
    else if (ev === 'chat') {
      net.chat.push(d); if (net.chat.length > 80) net.chat.shift();
      if (current?.scr.isConnected && current.scr.querySelector('[data-cchat]')) drawChat(current.scr);
      else if (!d.mine) toast(`[${s.onlineCrew?.tag}] ${d.name}: ${d.text}`, 'info');
    } else if (ev === 'dir' || ev === 'status') redraw();
  });
  online.on(ev => { if (ev === 'status') syncLobby(); });
  setInterval(() => {
    const s = game.s;
    if (!s || !(s.onlineCrew || s.crewPending) || current?.scr.isConnected) return;
    refreshCrew({ members: false });
  }, 30000);
}

function drawChat(scr) {
  const box = scr.querySelector('[data-cchat]');
  if (!box) return;
  box.innerHTML = net.chat.length ? net.chat.slice(-40).map(m => `<div><b style="color:${m.mine ? '#ff2a3a' : '#c0c4c8'}">${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') : '<span class="muted small">No crew messages yet.</span>';
  box.scrollTop = box.scrollHeight;
}

const whereName = w => (w && SERVER_BY_ID[w] ? SERVER_BY_ID[w].name + ' server' : 'online (not roaming)');

export function renderOcrew(scr, ctx) {
  const s = ctx.s;
  ensureIdentity(s);
  syncLobby();
  current = { scr, ctx };
  const st = ctx.st.oc ??= { tab: null, form: { name: '', tag: '', motto: '', color: CREW_COLORS[0], open: true }, started: false };
  const crew = s.onlineCrew;
  const tabs = crew ? [['members', 'Members'], ['chat', 'Chat'], ['manage', crew.role === 'leader' ? `Manage${net.pending.length ? ` (${net.pending.length})` : ''}` : 'Crew']] : [['browse', 'Browse crews'], ['create', 'Start a crew']];
  const tab = st.tab && tabs.some(t => t[0] === st.tab) ? st.tab : tabs[0][0];
  st.tab = tab;

  if (!st.started) { st.started = true; refreshCrew({ chat: true }); }
  if (lobby.status === 'off') lobby.connect();
  if (!st.timer) st.timer = setInterval(() => { if (!current || !current.scr.isConnected || current.ctx.st.oc !== st) { clearInterval(st.timer); st.timer = null; return; } if (!net.busy) refreshCrew({ chat: !!current.scr.querySelector('[data-cchat]') }); }, 6000);

  const live = lobby.active;
  const banner = !net.loaded ? '<p class="small muted">Loading crews…</p>'
    : net.error ? `<p class="small" style="color:#ff6270">⚠ ${esc(net.error)} <button class="btn btn-sm" data-action="retry">Retry</button></p>`
    : `<p class="small muted">🌐 ${net.dir.length} crew${net.dir.length === 1 ? '' : 's'} · ${lobby.players.size} player${lobby.players.size === 1 ? '' : 's'} on the crew network${live ? '' : ' (live link offline)'}</p>`;
  const tabBar = `<div class="row" style="gap:6px;margin:6px 0;flex-wrap:wrap">${tabs.map(([k, l]) => `<button class="btn btn-sm ${tab === k ? 'btn-primary' : ''}" data-action="tab" data-id="${k}">${l}</button>`).join('')}</div>`;
  let body = '';

  if (!crew && tab === 'browse') {
    body = `<p class="small muted">Crews are permanent. Members can be offline; the green dot shows who is online now.${s.crewPending ? ' You have a join request waiting.' : ''}</p>
      ${net.dir.length ? `<div class="list">${net.dir.map(g => {
        const asked = s.crewPending === g.id, on = lobby.onlineCount(g.id);
        return `<div class="li"><span class="avatar" style="background:${esc(g.color)}">${esc(g.tag[0])}</span><div class="grow"><div class="t">[${esc(g.tag)}] ${esc(g.name)} <span class="tag ${g.open ? 'tag-green' : ''}">${g.open ? 'Open' : 'Invite only'}</span></div>
          <div class="s">${esc(g.motto || 'No motto')}</div><div class="s">${g.members} member${g.members === 1 ? '' : 's'}${on ? ` · <span style="color:#2bd96b">●</span> ${on} online` : ''} · ${Number(g.rep).toLocaleString()} rep · led by ${esc(g.leader || '?')}</div></div>
          ${asked ? `<button class="btn btn-sm" data-action="cancelreq">Cancel request</button>` : `<button class="btn btn-sm btn-primary" data-action="${g.open ? 'join' : 'ask'}" data-id="${g.id}">${g.open ? 'Join' : 'Request'}</button>`}</div>`;
      }).join('')}</div>` : net.loaded ? '<div class="empty">No crews yet. Start the first one!</div>' : ''}`;
  } else if (!crew && tab === 'create') {
    const f = st.form;
    body = `<p class="small muted">Name it, pick a tag and a colour. Your crew is permanent: it stays up when you log off. Other players see your tag next to your name and car. Costs ${fmtMoney(CREW_FEE)} for the jackets. You lead it: accept requests, kick, and disband.</p>
      <label class="field"><span>Crew name (2–20)</span><input class="input" data-f="name" maxlength="20" value="${esc(f.name)}" placeholder="Night Shift"></label>
      <label class="field"><span>Tag (2–4 letters)</span><input class="input" data-f="tag" maxlength="4" value="${esc(f.tag)}" placeholder="NSFT" style="text-transform:uppercase"></label>
      <label class="field"><span>Motto</span><input class="input" data-f="motto" maxlength="40" value="${esc(f.motto)}" placeholder="We only go left."></label>
      <div class="row" style="gap:6px;margin:6px 0">${CREW_COLORS.map(c => `<button class="swatch" data-action="color" data-c="${c}" style="width:30px;height:30px;background:${c};border:${f.color === c ? '3px solid #fff' : '1px solid #444'}"></button>`).join('')}</div>
      <div class="row" style="gap:6px;margin:8px 0"><button class="btn btn-sm ${f.open ? 'btn-primary' : ''}" data-action="openflag" data-v="1">Open — anyone can join</button><button class="btn btn-sm ${f.open ? '' : 'btn-primary'}" data-action="openflag" data-v="0">Invite only — you approve</button></div>
      <button class="btn btn-primary" data-action="create">Found the crew · ${fmtMoney(CREW_FEE)}</button>`;
  } else if (crew && tab === 'members') {
    const on = lobby.onlineByUid();
    body = `<div class="row"><span class="avatar" style="background:${esc(crew.color)}">${esc(crew.tag[0])}</span><div class="grow"><b>[${esc(crew.tag)}] ${esc(crew.name)}</b><div class="muted small">${esc(crew.motto || 'No motto')} · ${crew.open ? 'Open' : 'Invite only'} · you are ${crew.role === 'leader' ? 'the leader' : 'a member'}</div></div></div>
      <div class="section-title">Members (${net.members.length})</div>
      <div class="list">${net.members.map(p => {
        const o = on.get(p.uid), me = p.uid === s.uid;
        return `<div class="li"><span class="avatar" style="background:${esc(crew.color)};width:24px;height:24px">${esc(p.name[0] || '?')}</span><div class="grow"><div class="t"><span style="color:${o || me ? '#2bd96b' : '#555'}">●</span> ${esc(p.name)}${me ? ' (you)' : ''} ${p.leader ? '<span class="tag tag-green">Leader</span>' : ''}</div><div class="s">${o || me ? esc(whereName(me ? (online.active ? online.room : '') : o.where)) : 'offline'} · ${Number(p.rep).toLocaleString()} rep</div></div>
          ${!me && o?.where && o.where !== (online.active ? online.room : '') ? `<button class="btn btn-sm" data-action="goto" data-srv="${esc(o.where)}">Join server</button>` : ''}
          ${crew.role === 'leader' && !me ? `<button class="btn btn-sm btn-danger" data-action="kick" data-id="${esc(p.uid)}">Kick</button>` : ''}</div>`;
      }).join('')}</div>
      <p class="small muted">Total rep: ${net.members.reduce((t, p) => t + Number(p.rep), 0).toLocaleString()}. Crew-mates show with the tag [${esc(crew.tag)}] in online free roam.</p>`;
  } else if (crew && tab === 'chat') {
    body = `<div data-cchat style="height:210px;overflow:auto;background:#101114;border:1px solid #2a2c33;padding:8px;font-size:14px"></div>
      <form data-cform style="display:flex;gap:6px;margin-top:8px"><input class="input" data-cmsg maxlength="90" placeholder="Message your crew…" style="flex:1" autocomplete="off"><button class="btn btn-primary" type="submit">Send</button></form>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">${QUICK.map(q => `<button class="btn btn-sm" data-action="quick" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <p class="small muted">Only crew members can read this. History is saved, so you see what you missed.</p>`;
  } else if (crew && tab === 'manage') {
    if (crew.role === 'leader') {
      body = `<div class="section-title">Join requests</div>
        ${net.pending.length ? `<div class="list">${net.pending.map(r => `<div class="li"><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${Number(r.rep).toLocaleString()} rep · wants to join</div></div><button class="btn btn-sm btn-primary" data-action="accept" data-id="${esc(r.uid)}">Accept</button><button class="btn btn-sm" data-action="decline" data-id="${esc(r.uid)}">Decline</button></div>`).join('')}</div>` : '<p class="small muted">None right now.</p>'}
        <div class="section-title">Crew settings</div>
        <label class="field"><span>Motto</span><input class="input" data-motto maxlength="40" value="${esc(crew.motto || '')}"></label>
        <div class="row" style="gap:6px;margin:8px 0"><button class="btn btn-sm ${crew.open ? 'btn-primary' : ''}" data-action="setopen" data-v="1">Open</button><button class="btn btn-sm ${crew.open ? '' : 'btn-primary'}" data-action="setopen" data-v="0">Invite only</button><button class="btn btn-sm" data-action="savemotto">Save motto</button></div>
        <button class="btn btn-danger btn-sm" data-action="disband">Disband crew</button><p class="small muted">Disbanding removes everyone and frees the name and tag.</p>`;
    } else {
      body = `<p class="small muted">${esc(crew.motto || '')}</p><p>You're a member of <b>[${esc(crew.tag)}] ${esc(crew.name)}</b>. The leader accepts new members and can remove people.</p><button class="btn btn-danger btn-sm" data-action="leave">Leave crew</button>`;
    }
  }

  scr.innerHTML = head(crew ? `[${crew.tag}] ${crew.name}` : 'Online Crew') + `<div class="app-body">${banner}${tabBar}${body}</div>`;
  if (crew && tab === 'chat') {
    drawChat(scr);
    const form = scr.querySelector('[data-cform]'), msg = scr.querySelector('[data-cmsg]');
    form.onsubmit = e => { e.preventDefault(); say(msg.value); msg.value = ''; };
  }
  scr.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('input', () => { st.form[inp.dataset.f] = inp.value; }));

  const fresh = () => ctx.h.refresh();
  const run = async (fn, okText, poke) => {
    try { const r = await fn(); if (okText) toast(okText, 'good'); if (poke) lobby.poke(); await refreshCrew({ chat: tab === 'chat' }); return r; }
    catch (e) { toast(e.message || 'That did not work.', 'bad'); refreshCrew(); }
  };
  const say = async text => {
    const t = String(text || '').trim(); if (!t) return;
    try { await crewdb().say(who(s), t); lobby.say(t); if (!lobby.active) { net.chat.push({ name: s.player.name, text: t, mine: true }); drawChat(scr); } } catch (e) { toast(e.message, 'bad'); }
  };
  bind(scr, {
    back: () => { current = null; ctx.go(null); },
    retry: () => refreshCrew(),
    tab: d => { st.tab = d.id; fresh(); if (d.id === 'chat') refreshCrew({ chat: true }); },
    color: d => { st.form.color = d.c; fresh(); },
    openflag: d => { st.form.open = d.v === '1'; fresh(); },
    join: d => run(() => crewdb().join(who(s), d.id), 'Welcome to the crew!', false).then(() => { lobby.pokeCrew(d.id); st.tab = 'members'; fresh(); }),
    ask: d => run(() => crewdb().request(who(s), d.id), 'Request sent. The leader will see it next time they open Online Crew.').then(() => lobby.pokeCrew(d.id)),
    cancelreq: () => run(() => crewdb().cancelRequest(who(s)), 'Request cancelled.'),
    create: async () => {
      const f = st.form, name = cleanCrewName(f.name), tag = cleanTag(f.tag);
      if (name.length < 2) return toast('Pick a crew name (2–20 letters).', 'bad');
      if (tag.length < 2) return toast('Pick a 2–4 letter tag.', 'bad');
      if (s.cash + s.bank < CREW_FEE) return toast(`You need ${fmtMoney(CREW_FEE)} for the jackets.`, 'bad');
      try {
        await crewdb().create(who(s), { id: rnd(8), name, tag, color: f.color, motto: (f.motto || '').trim().slice(0, 40), open: !!f.open });
      } catch (e) { return toast(e.message || 'Could not create the crew.', 'bad'); }
      spend(s, CREW_FEE, 'Crew jackets & decals');
      toast(`[${tag}] ${name} is founded, and it's permanent. Tell your friends!`, 'good');
      st.form = { name: '', tag: '', motto: '', color: CREW_COLORS[0], open: true }; st.tab = 'members';
      await refreshCrew(); fresh();
    },
    quick: d => say(d.q),
    goto: async d => {
      const { meFromGame } = await import('./online.js');
      const me = meFromGame(); if (!me) return toast('You need a car to go online.', 'bad');
      toast(`Joining ${SERVER_BY_ID[d.srv]?.name || d.srv}…`, 'info');
      const ok = await online.join(d.srv, me); if (ok) toast('Online — find your crew-mates on the map.', 'good'); fresh();
    },
    kick: async d => { if (await confirm('Kick this player?', '<p>They are removed from the crew.</p>', 'Kick', true)) run(() => crewdb().kick(who(s), d.id), 'Kicked.', true); },
    accept: d => run(() => crewdb().decide(who(s), d.id, true), 'Accepted.', true),
    decline: d => run(() => crewdb().decide(who(s), d.id, false), 'Declined.'),
    setopen: d => run(() => crewdb().edit(who(s), crew.motto, d.v === '1'), null, true),
    savemotto: () => run(() => crewdb().edit(who(s), (scr.querySelector('[data-motto]').value || '').trim().slice(0, 40), crew.open), 'Motto saved.', true),
    disband: async () => { if (await confirm('Disband the crew?', '<p>Everyone is removed from the crew. This can\'t be undone.</p>', 'Disband', true)) { lobby.poke(); await run(() => crewdb().disband(who(s)), 'Crew disbanded.', true); } },
    leave: async () => { if (await confirm('Leave the crew?', '<p>You can join another one any time.</p>', 'Leave', true)) { await run(() => crewdb().leave(who(s)), 'You left the crew.', true); st.tab = 'browse'; fresh(); } },
  });
}
