// Phone → Radio. Murda Worth Radio plays our own local artists, the songs
// the studio picks (core/audio.js STATIONS, files in audio/radio/). Pick a
// song, skip, turn it off, or put your earbuds in so it keeps playing when
// you get out of the car.

import { esc, bind, toast } from './dom.js';
import { audio, STATIONS } from '../core/audio.js';
import { settings, saveSettings } from '../core/save.js';

const fmt = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function renderRadio(scr, ctx) {
  const r = audio.radioState(), w = ctx.app.world;
  const where = w?.inCar ? 'Playing through your car\'s speakers.' : settings.earbuds ? 'Playing in your earbuds.' : 'Get in a car, or put your earbuds in to listen on foot.';
  scr.innerHTML = `<div class="app-head"><button class="back" data-action="back">‹ Back</button><h2>Radio</h2></div><div class="app-body radio-app">
    <div class="radio-now ${r.on ? 'on' : ''}">
      <small>📻 MURDA WORTH RADIO · LOCAL ARTISTS</small>
      <b>${esc(r.title)}</b>
      <span class="small muted" data-rtime>${esc(where)}</span>
      <div class="row radio-ctl"><button class="btn" data-action="prev" aria-label="Previous">⏮</button><button class="btn btn-primary" data-action="power">${r.on ? '⏸ Turn off' : '▶ Turn on'}</button><button class="btn" data-action="next" aria-label="Next">⏭</button></div>
      <label class="row small" style="gap:6px;margin-top:8px"><input type="checkbox" data-earbuds ${settings.earbuds ? 'checked' : ''}> 🎧 Earbuds: keep playing on foot</label>
    </div>
    <div class="section-title">Songs</div>
    <div class="list">${STATIONS.map((st, i) => `<div class="li click ${i === r.track ? 'on' : ''}" data-action="pick" data-i="${i}"><span class="qi">${i === r.track && r.playing ? '🔊' : '🎵'}</span><div class="grow"><div class="t">${esc(st.title)}</div><div class="s">${esc(st.by || 'Murda Worth local')}</div></div>${i === r.track ? '<span class="tag tag-green">On</span>' : ''}</div>`).join('')}</div>
    <p class="small muted">Only songs the studio picks get on Murda Worth Radio: our own artists first, then players from the city. Got a track? Send it to Glitch Gaming Studios. Keys: R next song, O on/off.</p></div>`;
  bind(scr, {
    back: () => ctx.go(null),
    prev: () => { audio.radioPrev(); ctx.h.refresh(); },
    next: () => { audio.radioNext(); ctx.h.refresh(); },
    power: () => { audio.init?.(); audio.radioPower(!r.on); ctx.h.refresh(); },
    pick: d => { audio.init?.(); audio.radioPick(+d.i); if (!audio.radioState().on) audio.radioPower(true); ctx.h.refresh(); },
  });
  scr.querySelector('[data-earbuds]').onchange = e => {
    settings.earbuds = e.target.checked; saveSettings();
    if (settings.earbuds && !audio.radioState().on) audio.radioPower(true);
    toast(settings.earbuds ? '🎧 Earbuds in. The radio plays wherever you go.' : 'Earbuds out. The radio plays in cars only.', 'info');
    ctx.h.refresh();
  };
  // the song's progress while the app is open
  const tm = scr.querySelector('[data-rtime]');
  const tick = () => {
    if (!tm.isConnected) return;
    const t = audio.radioTime();
    if (t && t.len) tm.textContent = `${fmt(t.at)} / ${fmt(t.len)} · ${where}`;
    setTimeout(tick, 500);
  };
  tick();
}
