// Phone app: Online Crew. Found a crew or join one that other real players
// run, chat with your crew, see who's online and where, and let the leader
// accept requests, kick, or disband. Crews live in members' saves; the live
// directory is whoever is connected (see net/crews.js).

import { bind, esc, toast, confirm } from './dom.js';
import { game, spend, fmtMoney, tierOf } from '../core/state.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';
import { online, SERVER_BY_ID } from '../net/online.js';
import { lobby, newCrewKeys, cleanCrewName, cleanTag, CREW_COLORS, CREW_FEE } from '../net/crews.js';

const head = title => `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>${esc(title)}</h2></div>`;
const QUICK = ['🏁 Crew meet?', "Who's on?", '🔥', 'On my way', 'GG'];
let current = null;          // the phone view that is on screen (so network events can refresh it)

const rid = n => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
export function ensureIdentity(s) { s.uid ??= rid(10); return s.uid; }

// Push my name / rep / crew / server into the lobby presence.
export function syncLobby() {
  const s = game.s; if (!s) return;
  ensureIdentity(s);
  const c = s.onlineCrew;
  lobby.setMe({ name: s.player.name, uid: s.uid, rep: s.rep, where: online.active ? online.room : '', crew: c ? { ...c } : null, sk: c?.role === 'leader' ? c.sk : '' });
}
// For the in-world name tag next to other players' cars.
export const crewTag = s => (s.onlineCrew ? { tag: s.onlineCrew.tag, color: s.onlineCrew.color } : null);

// Wire network events once at boot.
export function initCrews(app) {
  lobby.on((ev, d) => {
    const s = game.s; if (!s) return;
    if (ev === 'accepted') {
      const g = lobby.directory().find(x => x.id === d.crew);
      if (g) { s.onlineCrew = { id: g.id, name: g.name, tag: g.tag, color: g.color, motto: g.motto, open: g.open, pk: g.pk, role: 'member', joined: Date.now() }; syncLobby(); emit('crewJoined', { online: true }); toast(`The leader accepted you: welcome to ${g.name}!`, 'good'); audio.win?.(); }
    } else if (ev === 'kicked' || ev === 'disbanded') {
      toast(ev === 'kicked' ? `You were kicked from ${d.name}.` : `${d.name} was disbanded.`, 'bad');
      s.onlineCrew = null; syncLobby();
    } else if (ev === 'request') {
      toast(`🌐 ${d.name} wants to join ${s.onlineCrew?.name}. Phone → Online Crew`, 'info'); audio.radio?.();
    } else if (ev === 'chat' && !d.mine && !current) {
      toast(`[${s.onlineCrew?.tag}] ${d.name}: ${d.text}`, 'info');
    } else if (ev === 'dir' && s.onlineCrew && s.onlineCrew.role !== 'leader') {
      // keep my copy of the crew's name/motto/open flag in step with what the leader publishes
      const g = lobby.directory().find(x => x.id === s.onlineCrew.id && x.pk === s.onlineCrew.pk);
      if (g && (g.motto !== s.onlineCrew.motto || g.open !== s.onlineCrew.open)) { s.onlineCrew.motto = g.motto; s.onlineCrew.open = g.open; syncLobby(); }
    }
    if (current && current.scr.isConnected && ev !== 'chat') {
      const a = document.activeElement;
      if (!(a && current.scr.contains(a) && /INPUT|TEXTAREA/.test(a.tagName))) current.ctx.h.refresh();
    } else if (ev === 'chat' && current && current.scr.isConnected) drawChat(current.scr);
  });
  online.on(ev => { if (ev === 'status') syncLobby(); });
}

function drawChat(scr) {
  const box = scr.querySelector('[data-cchat]');
  if (!box) return;
  box.innerHTML = lobby.chat.length ? lobby.chat.slice(-40).map(m => `<div><b style="color:${m.mine ? '#ff2a3a' : '#c0c4cc'}">${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') : '<span class="muted small">No crew messages yet.</span>';
  box.scrollTop = box.scrollHeight;
}

const whereName = w => (w && SERVER_BY_ID[w] ? SERVER_BY_ID[w].name + ' server' : 'online (not roaming)');

export function renderOcrew(scr, ctx) {
  const s = ctx.s;
  ensureIdentity(s);
  syncLobby();
  current = { scr, ctx };
  const st = ctx.st.oc ??= { tab: null, form: { name: '', tag: '', motto: '', color: CREW_COLORS[0], open: true } };
  const crew = s.onlineCrew;
  const tab = st.tab && (crew ? ['members', 'chat', 'manage'] : ['browse', 'create']).includes(st.tab) ? st.tab : (crew ? 'members' : 'browse');
  st.tab = tab;

  if (lobby.status === 'off') lobby.connect();
  const connected = lobby.active;
  const banner = lobby.status === 'connecting' ? '<p class="small muted">Connecting to the crew network…</p>'
    : lobby.status === 'error' ? `<p class="small" style="color:#ff6270">⚠ ${esc(lobby.error)}. <button class="btn btn-sm" data-action="reconnect">Retry</button></p>`
    : `<p class="small muted">🌐 ${lobby.players.size} player${lobby.players.size === 1 ? '' : 's'} on the crew network</p>`;

  const tabs = crew ? [['members', 'Members'], ['chat', 'Chat'], ['manage', crew.role === 'leader' ? `Manage${lobby.requests.length ? ` (${lobby.requests.length})` : ''}` : 'Crew']] : [['browse', 'Browse crews'], ['create', 'Start a crew']];
  const tabBar = `<div class="row" style="gap:6px;margin:6px 0;flex-wrap:wrap">${tabs.map(([k, l]) => `<button class="btn btn-sm ${tab === k ? 'btn-primary' : ''}" data-action="tab" data-id="${k}">${l}</button>`).join('')}</div>`;
  let body = '';

  if (!crew && tab === 'browse') {
    const dir = lobby.directory();
    body = `<p class="small muted">Crews made by other players. A crew shows up here while at least one member is online.</p>
      ${dir.length ? `<div class="list">${dir.map(g => {
        const asked = lobby.pending?.crew === g.id;
        return `<div class="li"><span class="avatar" style="background:${g.color}">${esc(g.tag[0])}</span><div class="grow"><div class="t">[${esc(g.tag)}] ${esc(g.name)} <span class="tag ${g.open ? 'tag-green' : ''}">${g.open ? 'Open' : 'Invite only'}</span></div>
          <div class="s">${esc(g.motto || 'No motto')}</div><div class="s">${g.members.length} online · ${g.rep.toLocaleString()} total rep</div></div>
          <button class="btn btn-sm btn-primary" data-action="${g.open ? 'join' : 'ask'}" data-id="${g.id}" ${asked || !connected ? 'disabled' : ''}>${g.open ? 'Join' : asked ? 'Requested…' : 'Request'}</button></div>`;
      }).join('')}</div>` : '<div class="empty">No crews are online right now. Start one!</div>'}`;
  } else if (!crew && tab === 'create') {
    const f = st.form;
    body = `<p class="small muted">Name it, pick a tag and a colour. Other players will see your crew tag next to your name and car. Costs ${fmtMoney(CREW_FEE)} for the jackets. You're the leader: you accept requests, kick and disband.</p>
      <label class="field"><span>Crew name (2–20)</span><input class="input" data-f="name" maxlength="20" value="${esc(f.name)}" placeholder="Night Shift"></label>
      <label class="field"><span>Tag (2–4 letters)</span><input class="input" data-f="tag" maxlength="4" value="${esc(f.tag)}" placeholder="NSFT" style="text-transform:uppercase"></label>
      <label class="field"><span>Motto</span><input class="input" data-f="motto" maxlength="40" value="${esc(f.motto)}" placeholder="We only go left."></label>
      <div class="row" style="gap:6px;margin:6px 0">${CREW_COLORS.map(c => `<button class="swatch" data-action="color" data-c="${c}" style="width:30px;height:30px;background:${c};border:${f.color === c ? '3px solid #fff' : '1px solid #444'}"></button>`).join('')}</div>
      <div class="row" style="gap:6px;margin:8px 0"><button class="btn btn-sm ${f.open ? 'btn-primary' : ''}" data-action="openflag" data-v="1">Open — anyone can join</button><button class="btn btn-sm ${f.open ? '' : 'btn-primary'}" data-action="openflag" data-v="0">Invite only — you approve</button></div>
      <button class="btn btn-primary" data-action="create" ${connected ? '' : 'disabled'}>Found the crew · ${fmtMoney(CREW_FEE)}</button>`;
  } else if (crew && tab === 'members') {
    const members = lobby.crewMembers(crew.id);
    const meId = lobby.id;
    body = `<div class="row"><span class="avatar" style="background:${crew.color}">${esc(crew.tag[0])}</span><div class="grow"><b>[${esc(crew.tag)}] ${esc(crew.name)}</b><div class="muted small">${esc(crew.motto || 'No motto')} · ${crew.open ? 'Open' : 'Invite only'} · you are ${crew.role === 'leader' ? 'the leader' : 'a member'}</div></div></div>
      <div class="section-title">Online now (${members.length})</div>
      <div class="list">${members.length ? members.map(p => `<div class="li"><span class="avatar" style="background:${crew.color};width:24px;height:24px">${esc(p.name[0] || '?')}</span><div class="grow"><div class="t">${esc(p.name)}${p.id === meId ? ' (you)' : ''} ${p.crew.leader ? '<span class="tag tag-green">Leader</span>' : ''}</div><div class="s">${esc(whereName(p.where))} · ${p.rep.toLocaleString()} rep</div></div>
        ${p.id !== meId && p.where && p.where !== (online.active ? online.room : '') ? `<button class="btn btn-sm" data-action="goto" data-srv="${p.where}">Join server</button>` : ''}
        ${crew.role === 'leader' && p.id !== meId ? `<button class="btn btn-sm btn-danger" data-action="kick" data-id="${p.id}">Kick</button>` : ''}</div>`).join('') : '<div class="empty">Just you. Share the crew name so people can find it.</div>'}</div>
      <p class="small muted">Total online rep: ${members.reduce((t, p) => t + p.rep, 0).toLocaleString()}. Crew-mates show with your tag [${esc(crew.tag)}] in online free roam.</p>`;
  } else if (crew && tab === 'chat') {
    body = `<div data-cchat style="height:210px;overflow:auto;background:#101114;border:1px solid #2a2c33;padding:8px;font-size:14px"></div>
      <form data-cform style="display:flex;gap:6px;margin-top:8px"><input class="input" data-cmsg maxlength="90" placeholder="Message your crew…" style="flex:1" autocomplete="off"><button class="btn btn-primary" type="submit" ${connected ? '' : 'disabled'}>Send</button></form>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">${QUICK.map(q => `<button class="btn btn-sm" data-action="quick" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <p class="small muted">Only crew members see this chat, and only while they're online.</p>`;
  } else if (crew && tab === 'manage') {
    if (crew.role === 'leader') {
      body = `<div class="section-title">Join requests</div>
        ${lobby.requests.length ? `<div class="list">${lobby.requests.map(r => `<div class="li"><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">wants to join</div></div><button class="btn btn-sm btn-primary" data-action="accept" data-id="${r.id}">Accept</button><button class="btn btn-sm" data-action="decline" data-id="${r.id}">Decline</button></div>`).join('')}</div>` : '<p class="small muted">None right now. Requests appear while you\'re online.</p>'}
        <div class="section-title">Crew settings</div>
        <label class="field"><span>Motto</span><input class="input" data-motto maxlength="40" value="${esc(crew.motto || '')}"></label>
        <div class="row" style="gap:6px;margin:8px 0"><button class="btn btn-sm ${crew.open ? 'btn-primary' : ''}" data-action="setopen" data-v="1">Open</button><button class="btn btn-sm ${crew.open ? '' : 'btn-primary'}" data-action="setopen" data-v="0">Invite only</button><button class="btn btn-sm" data-action="savemotto">Save motto</button></div>
        <button class="btn btn-danger btn-sm" data-action="disband">Disband crew</button><p class="small muted">Disbanding removes everyone from the crew. Your leader key stays on this device only.</p>`;
    } else {
      body = `<p class="small muted">${esc(crew.motto || '')}</p><p>You're a member of <b>[${esc(crew.tag)}] ${esc(crew.name)}</b>. The leader can accept new members and remove people.</p><button class="btn btn-danger btn-sm" data-action="leave">Leave crew</button>`;
    }
  }

  scr.innerHTML = head(crew ? `[${crew.tag}] ${crew.name}` : 'Online Crew') + `<div class="app-body">${banner}${tabBar}${body}</div>`;
  if (crew && tab === 'chat') {
    drawChat(scr);
    const form = scr.querySelector('[data-cform]'), msg = scr.querySelector('[data-cmsg]');
    form.onsubmit = e => { e.preventDefault(); lobby.say(msg.value); msg.value = ''; };
  }
  scr.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('input', () => { st.form[inp.dataset.f] = inp.value; }));

  const fresh = () => ctx.h.refresh();
  const join = (g, role = 'member') => {
    s.onlineCrew = { id: g.id, name: g.name, tag: g.tag, color: g.color, motto: g.motto, open: g.open, pk: g.pk, role, joined: Date.now() };
    syncLobby(); emit('crewJoined', { online: true });
  };
  bind(scr, {
    back: () => { current = null; ctx.go(null); },
    reconnect: () => { lobby.status = 'off'; lobby.connect(); fresh(); },
    tab: d => { st.tab = d.id; fresh(); },
    color: d => { st.form.color = d.c; fresh(); },
    openflag: d => { st.form.open = d.v === '1'; fresh(); },
    join: d => {
      const g = lobby.directory().find(x => x.id === d.id); if (!g) return toast('That crew just went offline.', 'bad');
      join(g); toast(`Welcome to ${g.name}!`, 'good'); st.tab = 'members'; fresh();
    },
    ask: d => {
      const g = lobby.directory().find(x => x.id === d.id); if (!g) return;
      lobby.request(g); toast(`Request sent to ${g.name}. A leader has to be online to accept it.`, 'info'); fresh();
    },
    create: async () => {
      const f = st.form, name = cleanCrewName(f.name), tag = cleanTag(f.tag);
      if (name.length < 2) return toast('Pick a crew name (2–20 letters).', 'bad');
      if (tag.length < 2) return toast('Pick a 2–4 letter tag.', 'bad');
      if (lobby.nameTaken(name, tag)) return toast('A live crew already uses that name or tag.', 'bad');
      if (!spend(s, CREW_FEE, 'Crew jackets & decals')) return;
      const keys = await newCrewKeys();
      s.onlineCrew = { id: rid(8), name, tag, color: f.color, motto: (f.motto || '').trim().slice(0, 40), open: !!f.open, pk: keys.pk, sk: keys.sk, role: 'leader', joined: Date.now() };
      syncLobby(); emit('crewJoined', { online: true, own: true });
      toast(`[${tag}] ${name} is live. Tell your friends!`, 'good'); st.tab = 'members'; st.form = { name: '', tag: '', motto: '', color: CREW_COLORS[0], open: true }; fresh();
    },
    quick: d => lobby.say(d.q),
    goto: async d => {
      const { meFromGame } = await import('./online.js');
      const me = meFromGame(); if (!me) return toast('You need a car to go online.', 'bad');
      toast(`Joining ${SERVER_BY_ID[d.srv]?.name || d.srv}…`, 'info');
      const ok = await online.join(d.srv, me); if (ok) toast('Online — find your crew-mates on the map.', 'good'); fresh();
    },
    kick: async d => { if (await confirm('Kick this player?', '<p>They are removed from the crew.</p>', 'Kick', true)) { await lobby.kick(d.id); toast('Kicked.', 'info'); } },
    accept: async d => { await lobby.accept(d.id); toast('Accepted — they join as soon as their phone sees it.', 'good'); },
    decline: d => lobby.decline(d.id),
    setopen: d => { crew.open = d.v === '1'; syncLobby(); fresh(); },
    savemotto: () => { crew.motto = (scr.querySelector('[data-motto]').value || '').trim().slice(0, 40); syncLobby(); toast('Motto saved.', 'good'); fresh(); },
    disband: async () => { if (await confirm('Disband the crew?', '<p>Everyone is removed from the crew. This can\'t be undone.</p>', 'Disband', true)) { await lobby.disband(); s.onlineCrew = null; syncLobby(); toast('Crew disbanded.', 'info'); fresh(); } },
    leave: async () => { if (await confirm('Leave the crew?', '<p>You can join another one any time.</p>', 'Leave', true)) { s.onlineCrew = null; syncLobby(); st.tab = 'browse'; fresh(); } },
  });
}
