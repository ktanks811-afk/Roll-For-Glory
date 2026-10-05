// Online free roam screen: join a room, see who's around, chat, leave.
// The police stay active online: your own city cops chase you as usual.

import { openPanel, bind, esc, toast, confirm } from './dom.js';
import { game, activeCar, modelOf, levels, tierOf } from '../core/state.js';
import { carName } from '../data/cars.js';
import { online, SERVERS, SERVER_CAP, SERVER_BY_ID } from '../net/online.js';
import { deeds } from '../net/deeds.js';
import { PROPERTIES } from '../data/world.js';
import { LAND } from '../data/estate.js';
import { audio } from '../core/audio.js';
import { initPvp, openChallenge } from './pvp.js';
import { pvp } from '../net/pvp.js';

const QUICK = ['🏁 Race me!', '🔥 Nice build', '👍', '😂', 'Meet at Pier 9?'];

export function meFromGame() {
  const s = game.s, car = activeCar(s);
  if (!car) return null;
  return { name: s.player.name, modelId: car.modelId, visual: car.visual, levels: levels(car), tier: tierOf(s.rep).n, crew: s.onlineCrew ? { tag: s.onlineCrew.tag, color: s.onlineCrew.color } : null };
}

// Wire network events to sound/toasts once at boot.
export function initOnline(app) {
  initPvp(app);
  online.on((ev, d) => {
    if (ev === 'chat' && !d.mine) { toast(`💬 ${d.name}: ${d.text}`, 'info'); audio.radio?.(); }
    if (ev === 'honk' && app.world) {
      const p = app.world.playerState();
      if (Math.hypot(d.x - p.x, d.z - p.z) < 70) audio.horn();
    }
    if (ev === 'status' && online.status === 'error') toast(`Online: ${online.error}`, 'bad');
  });
}

export function openOnline(app) {
  const s = game.s;
  let unsub = null;
  const ui = { counts: null, members: null, loading: false, joining: null };
  let loadCounts = () => {};
  const panel = openPanel((root, h) => {
    const st = online.status;
    if (st === 'on') {
      root.innerHTML = `<div class="p-head"><h1>Online · Free Roam<small>${esc(online.serverName)}${s.homeServer === online.room ? ' (your server)' : ''} · <span data-count></span> · police are active</small></h1><button class="btn x" data-action="close">×</button></div>
        <div class="p-body"><div class="split"><div>
          <div class="section-title" style="margin-top:0">Racers around</div>
          <div class="list" data-peers></div>
          <p class="small muted">Tap <b>Race</b> next to someone to call them out: a roll race or a drag race, with or without money on it. Other racers show up on the map and minimap. Cars don't collide online — it's a shared cruise, not a demolition derby.</p>
        </div><div>
          <div class="section-title" style="margin-top:0">Chat</div>
          <div data-chat style="height:200px;overflow:auto;background:#101114;border:1px solid #2a2c33;padding:8px;font-size:14px"></div>
          <form data-form style="display:flex;gap:6px;margin-top:8px"><input class="input" data-msg maxlength="90" placeholder="Say something…" style="flex:1" autocomplete="off"><button class="btn btn-primary" type="submit">Send</button></form>
          <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">${QUICK.map(q => `<button class="btn btn-sm" data-action="quick" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
          <div style="margin-top:16px"><button class="btn" data-action="switch">Switch server</button> <button class="btn" data-action="leave">Leave online mode</button></div>
        </div></div></div>`;
      const msg = root.querySelector('[data-msg]');
      root.querySelector('[data-form]').onsubmit = e => { e.preventDefault(); online.say(msg.value); msg.value = ''; };
      root.querySelector('[data-peers]').onclick = e => {
        const b = e.target.closest('[data-race]');
        const p = b && online.peers.get(b.dataset.race);
        if (p) { audio.click?.(); openChallenge(app, p); }
      };
      bind(root, {
        close: () => h.close(),
        quick: d => online.say(d.q),
        switch: () => { online.leave(); ui.counts = null; h.refresh(); loadCounts(); },
        leave: () => { online.leave(); toast('Left online mode', 'info'); h.close(); },
      });
      drawPeers(root, app); drawChat(root);
      return;
    }
    const busy = st === 'connecting';
    const counts = ui.counts, members = ui.members;
    const home = s.homeServer && SERVER_BY_ID[s.homeServer] ? s.homeServer : null;
    const fullNow = id => counts && counts[id] != null && counts[id] >= SERVER_CAP;
    const fullMembers = id => id !== home && members && (members[id] || 0) >= SERVER_CAP;
    const full = id => fullNow(id) || fullMembers(id);
    root.innerHTML = `<div class="p-head"><h1>Online · Servers<small>${home ? `Your server: ${esc(SERVER_BY_ID[home].name)}` : 'Pick your server and cruise Fort Worth with other players'}</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body" style="max-width:640px;margin:0 auto">
        <p class="small muted">${home ? `<b>${esc(SERVER_BY_ID[home].name)}</b> is your server. Your houses are registered there, and the houses other players own there are off the market for you.` : 'The server you pick becomes <b>your server</b>. Each one holds ' + SERVER_CAP + ' players and has its own Fort Worth: once a real player buys a house there, nobody else on that server can.'} Everyone on a server shares the map live — cars, horns, flames, chat — and you can race each other. Playing as <b>${esc(s.player.name)}</b>${activeCar(s) ? ` in your ${esc(carName(modelOf(activeCar(s)), activeCar(s).year))}` : ''}.</p>
        ${st === 'error' ? `<p class="small" style="color:#ff6270">⚠ ${esc(online.error)}. ${/full/.test(online.error) ? 'Pick another server.' : 'Check your connection and try again.'}</p>` : ''}
        ${ui.note ? `<p class="small warn">${ui.note}</p>` : ''}
        <div class="row" style="gap:8px;margin:8px 0"><button class="btn btn-primary" data-action="quick" ${busy ? 'disabled' : ''}>${home ? `Join ${esc(SERVER_BY_ID[home].name)}` : 'Quick join'}</button><button class="btn" data-action="refresh" ${busy || ui.loading ? 'disabled' : ''}>${ui.loading ? 'Checking…' : '↻ Refresh'}</button></div>
        <div class="list">${SERVERS.map(sv => {
          const n = counts ? counts[sv.id] : null, m = members ? (members[sv.id] || 0) : null;
          const pct = m == null ? 0 : Math.min(100, m / SERVER_CAP * 100);
          const mine = sv.id === home;
          const label = mine ? 'Join' : home ? 'Move here' : 'Make it mine';
          return `<div class="li" style="${mine ? 'border-color:var(--green)' : ''}"><div class="grow"><div class="t">${esc(sv.name)} ${mine ? '<span class="tag tag-green">Your server</span>' : ''} <span class="tag ${n == null ? '' : full(sv.id) ? 'tag-red' : n > 0 ? 'tag-green' : ''}">${n == null ? (ui.loading ? '…' : '?') : full(sv.id) ? 'FULL' : n === 0 ? 'Nobody on' : `${n} on now`}</span></div>
            <div class="s">${esc(sv.blurb)}</div><div class="bar thin" style="margin-top:4px"><div style="width:${pct}%"></div></div></div>
            <div style="text-align:right;min-width:104px"><div class="small muted">${m == null ? '—' : `${m}/${SERVER_CAP} players`}</div><button class="btn btn-sm ${mine || !home ? 'btn-primary' : ''}" data-action="join" data-id="${sv.id}" ${busy || (full(sv.id) && !mine) || (mine && fullNow(sv.id)) ? 'disabled' : ''}>${busy && ui.joining === sv.id ? 'Joining…' : label}</button></div></div>`;
        }).join('')}</div>
        <p class="small muted" style="margin-top:10px">Each server holds ${SERVER_CAP} players. A player who hasn't been online in 30 days gives up their spot, and their houses go back on the market.${deeds.down ? ' <span class="warn">The house registry isn\'t answering right now, so house sales aren\'t being checked against other players.</span>' : ''}</p>
      </div>`;
    const join = async id => {
      const me = meFromGame();
      if (!me) { toast('You need a car to go online. Grab one from Marketplace first.', 'bad'); return; }
      const moving = id !== s.homeServer;
      if (moving) {
        const sv = SERVER_BY_ID[id];
        const ok = await confirm(s.homeServer ? `Move to ${sv.name}?` : `Make ${sv.name} your server?`, `<p>${s.homeServer ? `You'll leave ${esc(SERVER_BY_ID[s.homeServer]?.name || 'your server')}. ` : ''}${esc(sv.name)} becomes your server. The houses and land you own get registered there, so other players on ${esc(sv.name)} can't buy them.</p><p class="small muted">If someone on ${esc(sv.name)} already owns one of your houses, you'll have to pick another server.</p>`, s.homeServer ? 'Move' : 'Make it mine');
        if (!ok) return;
      }
      ui.joining = id; ui.note = ''; h.refresh();
      const r = await deeds.join(s, id);
      if (!r.ok) {
        ui.joining = null;
        if (r.full) ui.note = `${esc(SERVER_BY_ID[id].name)} already has ${SERVER_CAP} players. Pick another server.`;
        else if (r.conflicts?.length) ui.note = `You can't move to ${esc(SERVER_BY_ID[id].name)}: ${r.conflicts.map(c => `${esc(PROPERTIES[c.prop]?.name || LAND[c.prop]?.name || c.prop)} already belongs to <b>${esc(c.name)}</b>`).join(', ')} there. Pick another server, or sell it first.`;
        else ui.note = esc(r.error || 'Could not join that server.');
        h.refresh(); return;
      }
      if (r.conflicts?.length) toast(`Heads up: ${r.conflicts.length} of your houses belong to someone else on this server.`, 'bad');
      const ok = await online.join(id, me);
      ui.joining = null;
      if (ok) toast(`Online — ${online.serverName}. The police are active.`, 'good');
      h.refresh();
    };
    bind(root, {
      close: () => h.close(),
      refresh: () => loadCounts(),
      join: d => join(d.id),
      quick: () => {
        if (home) { join(home); return; }
        // the busiest server that still has room, so you actually find people
        const open = SERVERS.filter(sv => !full(sv.id));
        const pick = open.sort((a, b) => (counts?.[b.id] || 0) - (counts?.[a.id] || 0))[0] || SERVERS[0];
        join(pick.id);
      },
    });
  }, { onClose: () => { unsub?.(); } });
  loadCounts = async () => {
    if (ui.loading) return;
    ui.loading = true; if (!online.active) panel.refresh();
    [ui.counts, ui.members] = await Promise.all([online.census(), deeds.counts()]);
    ui.loading = false;
    if (panel.root.isConnected && !online.active) panel.refresh();
  };
  if (!online.active) loadCounts();
  unsub = online.on(ev => {
    if (!panel.root.isConnected) return;
    if (ev === 'status') panel.refresh();
    else if (ev === 'peers') drawPeers(panel.inner, app);
    else if (ev === 'chat') drawChat(panel.inner);
  });
  // refresh distances every couple of seconds
  const iv = setInterval(() => { if (!panel.root.isConnected) clearInterval(iv); else if (online.active) drawPeers(panel.inner, app); }, 2000);
  return panel;
}

function drawPeers(root, app) {
  const box = root.querySelector('[data-peers]');
  if (!box) return;
  const me = app.world?.playerState();
  const peers = online.list();
  const c = root.querySelector('[data-count]'); if (c) c.textContent = `${peers.length + 1} online`;
  box.innerHTML = peers.length ? peers.map(p => {
    const d = me ? Math.round(Math.hypot(p.x - me.x, p.z - me.z)) : 0;
    const asked = pvp.out?.to === p.id;
    return `<div class="li"><span class="avatar" style="background:#2a6bff">${esc(p.name[0] || '?')}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(carName(p.model))} · ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : d + ' m'} away</div></div><button class="btn btn-sm ${asked ? '' : 'btn-primary'}" data-race="${esc(p.id)}" ${asked ? 'disabled' : ''}>${asked ? 'Asked…' : '🏁 Race'}</button></div>`;
  }).join('') : '<p class="small muted">Nobody else is here yet. Tell a friend to join this server, or switch to a busier one.</p>';
}

function drawChat(root) {
  const box = root.querySelector('[data-chat]');
  if (!box) return;
  box.innerHTML = online.chat.length ? online.chat.slice(-30).map(m => `<div><b style="color:${m.mine ? '#ff2a3a' : '#c0c4cc'}">${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') : '<span class="muted small">No messages yet.</span>';
  box.scrollTop = box.scrollHeight;
}
