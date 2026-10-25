// Phone → Betting (Cowtown Book). The LiveTicker runs across the top with
// live scores, finals and the next games' lines; below it, today's and
// tomorrow's games to bet on, live betting while a game is on, and your bets.
// The games and odds come from core/sportsbook.js.

import { esc, bind, toast } from './dom.js';
import { fmtMoney, spend, tierOf } from '../core/state.js';
import { LEAGUES } from '../data/sports.js';
import { ensureBook, gamesOn, gameById, scoreAt, odds, american, closedWhy, placeBet, stakeMax, ticker, nowMin, clock } from '../core/sportsbook.js';

export function tickerHtml(s) {
  const items = ticker(s);
  if (!items.length) return '';
  const row = items.map(x => `<span class="tk ${x.live ? 'live' : ''} ${x.mine ? 'mine' : ''}">${x.live ? '<i>LIVE</i>' : x.final ? '<i class="fin">FINAL</i>' : ''}${esc(x.icon)} ${esc(x.text)}</span>`).join('');
  return `<div class="liveticker"><b>LIVE<br>TICKER</b><div class="tk-track"><div class="tk-run" style="--dur:${Math.max(18, items.length * 5)}s">${row}${row}</div></div></div>`;
}

export function renderBook(scr, ctx) {
  const s = ctx.s, b = ensureBook(s), st = ctx.st.book ??= { tab: 'games', pick: null, stake: 100 };
  const now = nowMin(s), tier = tierOf(s.rep).n, max = stakeMax(tier);
  const open = b.bets.filter(x => !x.done);
  const draw = () => {
    const games = [...gamesOn(s.time.day), ...gamesOn(s.time.day + 1)].filter(g => scoreAt(g, nowMin(s)).state !== 'final' || g.end > nowMin(s) - 180);
    const list = st.tab === 'live' ? games.filter(g => scoreAt(g, nowMin(s)).state === 'live') : games;
    const gameHtml = g => {
      const t = nowMin(s), sc = scoreAt(g, t), o = odds(g, t), why = closedWhy(g, t), L = LEAGUES[g.lg];
      const mine = open.filter(x => x.gid === g.id);
      const side = (k, team) => {
        const sel = st.pick?.gid === g.id && st.pick.side === k;
        return `<button class="bk-side ${sel ? 'on' : ''}" data-action="pick" data-gid="${g.id}" data-side="${k}" ${why ? 'disabled' : ''}><span>${esc(team.name)}</span>${sc.state !== 'pre' ? `<b class="bk-score">${k === 'h' ? sc.h : sc.a}</b>` : ''}<em>${why ? '—' : american(o[k])}</em></button>`;
      };
      return `<div class="bk-game ${sc.state}"><div class="bk-top"><span>${L.icon} ${esc(L.name)}</span><span>${sc.state === 'pre' ? clock(g.start, s.time.day) : sc.state === 'live' ? `<b class="live">● LIVE</b> ${esc(sc.label)}` : esc(sc.label)}</span></div>
        ${side('a', g.away)}${side('h', g.home)}
        ${mine.length ? `<div class="small bk-mine">🎟 Your bet${mine.length > 1 ? 's' : ''}: ${mine.map(x => `${fmtMoney(x.stake)} on ${esc((x.pick === 'h' ? g.home : g.away).ab)} to win ${fmtMoney(x.stake * x.dec)}`).join(' · ')}</div>` : ''}
        ${st.pick?.gid === g.id ? slip(g) : ''}</div>`;
    };
    const slip = g => {
      const team = st.pick.side === 'h' ? g.home : g.away, dec = odds(g, nowMin(s))[st.pick.side];
      const stake = Math.min(st.stake, max);
      return `<div class="bk-slip"><div class="small">Bet on <b>${esc(team.name)}</b> at ${american(dec)}${scoreAt(g, nowMin(s)).state === 'live' ? ' (live)' : ''}</div>
        <div class="row" style="gap:5px;flex-wrap:wrap;margin:6px 0">${[50, 100, 500, 1000, 5000].filter(v => v <= max).map(v => `<button class="btn btn-sm ${stake === v ? 'btn-primary' : ''}" data-action="stake" data-v="${v}">${fmtMoney(v)}</button>`).join('')}<button class="btn btn-sm" data-action="stake" data-v="${Math.min(max, Math.floor(s.cash))}">Max</button></div>
        <div class="row" style="gap:6px"><input class="input grow" type="number" inputmode="numeric" min="10" max="${max}" data-stakein value="${stake}"><button class="btn btn-primary" data-action="place">Bet ${fmtMoney(stake)} · pays ${fmtMoney(stake * dec)}</button></div></div>`;
    };
    const betHtml = x => {
      const g = gameById(x.gid); if (!g) return '';
      const sc = scoreAt(g, nowMin(s)), team = x.pick === 'h' ? g.home : g.away;
      return `<div class="li"><span class="qi">${LEAGUES[g.lg].icon}</span><div class="grow"><div class="t">${fmtMoney(x.stake)} on ${esc(team.name)} ${x.live ? '<span class="tag">Live bet</span>' : ''}</div><div class="s">${esc(g.away.ab)} ${sc.a} – ${esc(g.home.ab)} ${sc.h} · ${sc.state === 'pre' ? clock(g.start, s.time.day) : esc(sc.label)} · at ${american(x.dec)}</div></div>
        ${x.done ? (x.won ? `<b class="good">+${fmtMoney(x.paid)}</b>` : `<b class="bad">−${fmtMoney(x.stake)}</b>`) : `<b>${fmtMoney(x.stake * x.dec)}</b>`}</div>`;
    };
    const body = st.tab === 'bets'
      ? `<div class="stats-row"><div><div class="stat-lbl">Won</div><b class="good">${fmtMoney(b.won)}</b></div><div><div class="stat-lbl">Lost</div><b class="bad">${fmtMoney(b.lost)}</b></div><div><div class="stat-lbl">Open</div><b>${open.length}</b></div></div>
        <div class="list">${b.bets.slice(0, 30).map(betHtml).join('') || '<div class="empty">No bets yet.</div>'}</div>`
      : (list.map(gameHtml).join('') || `<div class="empty">${st.tab === 'live' ? 'Nothing live right now. Check the ticker for what\'s next.' : 'No games on the board.'}</div>`);
    scr.innerHTML = `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>Cowtown Book</h2></div>${tickerHtml(s)}<div class="app-body book-app">
      <div class="tabs tp-tabs"><button class="${st.tab === 'games' ? 'on' : ''}" data-action="tab" data-id="games">Games</button><button class="${st.tab === 'live' ? 'on' : ''}" data-action="tab" data-id="live">● Live</button><button class="${st.tab === 'bets' ? 'on' : ''}" data-action="tab" data-id="bets">My bets${open.length ? ` (${open.length})` : ''}</button></div>
      <p class="small muted">Cash bets, paid in cash when the game ends. Your limit is ${fmtMoney(max)} a bet (Tier ${tier}). Live betting closes late in the game.</p>
      ${body}</div>`;
    bind(scr, {
      back: () => ctx.go(null),
      tab: d => { st.tab = d.id; st.pick = null; draw(); },
      pick: d => { st.pick = st.pick?.gid === d.gid && st.pick.side === d.side ? null : { gid: d.gid, side: d.side }; draw(); },
      stake: d => { st.stake = Math.max(10, +d.v || 10); draw(); },
      place: () => {
        const v = +(scr.querySelector('[data-stakein]')?.value || st.stake);
        const r = placeBet(s, st.pick.gid, st.pick.side, v, tier, (a, l) => spend(s, a, l, { fromBank: false }));
        toast(r.text, r.ok ? 'good' : 'bad');
        if (r.ok) { st.pick = null; open.push(r.bet); }
        draw();
      },
    });
    const inp = scr.querySelector('[data-stakein]');
    if (inp) inp.oninput = e => { st.stake = Math.max(10, Math.round(+e.target.value || 10)); const btn = scr.querySelector('[data-action="place"]'); const g = gameById(st.pick.gid); if (btn && g) btn.textContent = `Bet ${fmtMoney(Math.min(st.stake, max))} · pays ${fmtMoney(Math.min(st.stake, max) * odds(g, nowMin(s))[st.pick.side])}`; };
  };
  draw();
  // scores and odds move while you watch (not while you're typing a bet)
  let last = now;
  const live = () => {
    if (!scr.isConnected || ctx.st.app !== 'book') return;
    if (nowMin(s) !== last && !st.pick) { last = nowMin(s); draw(); }
    setTimeout(live, 1000);
  };
  setTimeout(live, 1000);
}
