// Online free roam screen: join a room, see who's around, chat, leave.
// The police stay active online: your own city cops chase you as usual.

import { openPanel, bind, esc, toast } from './dom.js';
import { game, activeCar, modelOf, levels, tierOf } from '../core/state.js';
import { carName } from '../data/cars.js';
import { online, SERVERS, SERVER_CAP } from '../net/online.js';
import { audio } from '../core/audio.js';

const QUICK = ['🏁 Race me!', '🔥 Nice build', '👍', '😂', 'Meet at Pier 9?'];

export function meFromGame() {
  const s = game.s, car = activeCar(s);
  if (!car) return null;
  return { name: s.player.name, modelId: car.modelId, visual: car.visual, levels: levels(car), tier: tierOf(s.rep).n };
}

// Wire network events to sound/toasts once at boot.
export function initOnline(app) {
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
  const ui = { counts: null, loading: false, joining: null };
  let loadCounts = () => {};
  const panel = openPanel((root, h) => {
    const st = online.status;
    if (st === 'on') {
      root.innerHTML = `<div class="p-head"><h1>Online · Free Roam<small>${esc(online.serverName)} server · <span data-count></span> · police are active</small></h1><button class="btn x" data-action="close">×</button></div>
        <div class="p-body"><div class="split"><div>
          <div class="section-title" style="margin-top:0">Racers around</div>
          <div class="list" data-peers></div>
          <p class="small muted">Friends can pick the same server to find you. Other racers show up on the map and minimap. Cars don't collide online — it's a shared cruise, not a demolition derby.</p>
        </div><div>
          <div class="section-title" style="margin-top:0">Chat</div>
          <div data-chat style="height:200px;overflow:auto;background:#101114;border:1px solid #2a2c33;padding:8px;font-size:14px"></div>
          <form data-form style="display:flex;gap:6px;margin-top:8px"><input class="input" data-msg maxlength="90" placeholder="Say something…" style="flex:1" autocomplete="off"><button class="btn btn-primary" type="submit">Send</button></form>
          <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">${QUICK.map(q => `<button class="btn btn-sm" data-action="quick" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
          <div style="margin-top:16px"><button class="btn" data-action="switch">Switch server</button> <button class="btn" data-action="leave">Leave online mode</button></div>
        </div></div></div>`;
      const msg = root.querySelector('[data-msg]');
      root.querySelector('[data-form]').onsubmit = e => { e.preventDefault(); online.say(msg.value); msg.value = ''; };
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
    const counts = ui.counts;
    const full = id => counts && counts[id] != null && counts[id] >= SERVER_CAP;
    root.innerHTML = `<div class="p-head"><h1>Online · Servers<small>Pick a server and cruise Port Solace with other players</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body" style="max-width:640px;margin:0 auto">
        <p class="small muted">Everyone on a server shares the map live — cars, horns, flames and chat. The police are still on patrol. Your career, money and car come with you. Playing as <b>${esc(s.player.name)}</b>${activeCar(s) ? ` in your ${esc(carName(modelOf(activeCar(s)), activeCar(s).year))}` : ''}; others only see your name, car and position.</p>
        ${st === 'error' ? `<p class="small" style="color:#ff6270">⚠ ${esc(online.error)}. ${/full/.test(online.error) ? 'Pick another server.' : 'Check your connection and try again.'}</p>` : ''}
        <div class="row" style="gap:8px;margin:8px 0"><button class="btn btn-primary" data-action="quick" ${busy ? 'disabled' : ''}>Quick join</button><button class="btn" data-action="refresh" ${busy || ui.loading ? 'disabled' : ''}>${ui.loading ? 'Checking…' : '↻ Refresh'}</button></div>
        <div class="list">${SERVERS.map(sv => {
          const n = counts ? counts[sv.id] : null;
          const pct = n == null ? 0 : Math.min(100, n / SERVER_CAP * 100);
          return `<div class="li"><div class="grow"><div class="t">${esc(sv.name)} <span class="tag ${n == null ? '' : full(sv.id) ? 'tag-red' : n > 0 ? 'tag-green' : ''}">${n == null ? (ui.loading ? '…' : '?') : full(sv.id) ? 'FULL' : n === 0 ? 'Empty' : 'Online'}</span></div>
            <div class="s">${esc(sv.blurb)}</div><div class="bar thin" style="margin-top:4px"><div style="width:${pct}%"></div></div></div>
            <div style="text-align:right;min-width:92px"><div class="small muted">${n == null ? '—' : `${n}/${SERVER_CAP} players`}</div><button class="btn btn-sm btn-primary" data-action="join" data-id="${sv.id}" ${busy || full(sv.id) ? 'disabled' : ''}>${busy && ui.joining === sv.id ? 'Joining…' : 'Join'}</button></div></div>`;
        }).join('')}</div>
        <p class="small muted" style="margin-top:10px">Each server holds ${SERVER_CAP} players. Nothing about you is stored on a server.</p>
      </div>`;
    const join = async id => {
      const me = meFromGame();
      if (!me) { toast('You need a car to go online. Grab one from Marketplace first.', 'bad'); return; }
      ui.joining = id; h.refresh();
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
    ui.counts = await online.census();
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
    return `<div class="li"><span class="avatar" style="background:#2a6bff">${esc(p.name[0] || '?')}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(carName(p.model))} · ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : d + ' m'} away</div></div></div>`;
  }).join('') : '<p class="small muted">Nobody else is here yet. Tell a friend to join this server, or switch to a busier one.</p>';
}

function drawChat(root) {
  const box = root.querySelector('[data-chat]');
  if (!box) return;
  box.innerHTML = online.chat.length ? online.chat.slice(-30).map(m => `<div><b style="color:${m.mine ? '#ff2a3a' : '#c0c4cc'}">${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') : '<span class="muted small">No messages yet.</span>';
  box.scrollTop = box.scrollHeight;
}
