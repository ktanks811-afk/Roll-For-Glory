  // ===== STORY BEGIN =====
  // ---------- Story mode (2026-11-21, Kimari: "super long story line like some drug dealer on the come up ... multiple
  // different ways you can do the story and become other things in your life"). Phase 1 = the story engine (in-engine
  // cutscenes, phone calls, story texts, the trap phone, dialogue choices on a timer, the five meters, missions with
  // checkpoints and retry, the Story app) + the Prologue (Release Day) + Tier 1 (Hand to Hand). The bible is the Claude Doc
  // "Murda Worth: Story Mode Bible". Saved on S.story. Everything else in the game keeps working between missions. ----------
  const SY = { lock: false, skip: false, cam: null, actors: new Map(), act: null, obj: '', objSub: '', mk: null, near: null, talk: null,
    el: null, waits: [], call: null, fail: null, said: null, flash: false, mural: null, orderT: 30, cust: new Map(), busy: false, err: 0, t: 0, ver: 1 };
  const SY_FAIL = msg => Object.assign(new Error(msg), { syFail: true });
  const SY_ABORT = () => Object.assign(new Error('abort'), { syAbort: true });
  // who's who: subtitle colour, phone avatar, and their look (seeded so they look the same every time)
  const SY_CAST = {
    mama: { name: 'Big Mama', full: 'Pearl "Big Mama" Washington', col: '#ffb3c7', role: 'Your grandma. Raised you and Smoke in Stop Six.', seed: 11, fem: 1, look: { hair: '#9a9a9a', hairStyle: 'bun', build: 2, height: 0, extras: [], skin: '#6b4429', top: 'fleece_black', bottom: 'jeans_black', shoes: 'boots_black', hat: 'no_hat', bag: 'no_bag' } },
    mook: { name: 'Mook', full: 'Marcus "Mook" Hill', col: '#7fd1ff', role: 'Your best friend since Bunche Elementary. Used to run for Smoke.', seed: 21, look: { hairStyle: 'twists', hair: '#111111', build: 1, height: 1, skin: '#55341f', top: 'mh_hoodie_box', bottom: 'joggers_black', shoes: 'mk_jordan_bred', hat: 'no_hat', facialHair: 'none', extras: ['cuban'] } },
    rusty: { name: 'Rusty', full: 'Rusty Calhoun', col: '#ffcf70', role: 'Old head mechanic. Built Smoke\'s cars.', seed: 31, look: { hairStyle: 'buzz', hair: '#9a9a9a', build: 2, height: 1, skin: '#9c6644', top: 'mw_carhartt', bottom: 'md_carpenter', shoes: 'boots_black', hat: 'mw_cap_ranch', facialHair: 'full_beard' } },
    nia: { name: 'Nia', full: 'Nia Brooks', col: '#d9a6ff', role: 'Photographer. Runs the biggest car page on Throttle.', seed: 41, fem: 1, look: { hairStyle: 'box_braids', hair: '#111111', build: 0, height: 1, skin: '#845334' } },
    hollis: { name: 'Deacon Hollis', full: 'Deacon Raymond Hollis', col: '#e0e0e0', role: 'Owns Hollis Motors. Sponsors Ironline Dragway. Running for city council.', seed: 51, look: { hairStyle: 'caesar', hair: '#9a9a9a', build: 2, height: 2, skin: '#3f2a1a', top: 'mx_leather', bottom: 'jeans_black', shoes: 'boots_black', hat: 'no_hat', facialHair: 'goatee' } },
    pastor: { name: 'Pastor Reed', full: 'Pastor Ellis Reed', col: '#c9e6a3', role: 'Greater Stop Six Baptist. Has buried more of the block than anyone.', seed: 61, look: { hairStyle: 'bald', hair: '#9a9a9a', build: 1, height: 1, skin: '#4a2e1c', top: 'fleece_black', bottom: 'jeans_black', shoes: 'boots_black', facialHair: 'none' } },
    lou: { name: 'Big Lou', full: 'Louis "Big Lou" Batiste', col: '#ff8a65', role: 'Smoke\'s plug out of Oak Cliff. Smoke died owing him $40,000.', seed: 71, look: { hairStyle: 'waves', hair: '#111111', build: 2, height: 2, skin: '#3f2a1a', top: 'mx_monogram', bottom: 'mx_cargo', shoes: 'mx_runners', extras: ['plat_cuban', 'plat_grill'] } },
    dre: { name: 'Dre', full: 'Dre (Lou\'s people)', col: '#ff8a65', role: 'Big Lou\'s collector.', seed: 81, look: { hairStyle: 'cornrows', hair: '#111111', build: 2, height: 2, skin: '#55341f', top: 'tank_black', bottom: 'cargo_black', shoes: 'kicks_blackout', extras: ['chain'] } },
    bit: { name: 'Lil Bit', full: 'Bryson "Lil Bit" Taylor', col: '#9ff0b0', role: '15. Lives two houses down from Big Mama. Wants in.', seed: 91, look: { hairStyle: 'high_top', hair: '#111111', build: 0, height: 0, skin: '#6b4429', top: 'tee_white', bottom: 'track_black', shoes: 'mk_af1_white', hat: 'no_hat', facialHair: 'none', extras: [] } },
    smoke: { name: 'Smoke', full: 'Darius "Smoke" Washington', col: '#ffd23f', role: 'Your big brother. Ran the east side. Gone at 27.', seed: 101, look: { hairStyle: 'locs', hair: '#111111', build: 1, height: 2, skin: '#55341f', top: 'racing_jacket', bottom: 'jeans_black', shoes: 'mk_jordan_bred', facialHair: 'goatee', extras: ['cuban', 'grill'] } },
    og: { name: 'Mr. Earl', full: 'Mr. Earl', col: '#c0c0c0', role: 'Sits on his porch on Ramey every day since 1979.', seed: 111, look: { hairStyle: 'bald', hair: '#9a9a9a', build: 1, height: 1, skin: '#3f2a1a', top: 'mw_pearlsnap', bottom: 'jeans_blue', shoes: 'boots_black', hat: 'mm_tejana', facialHair: 'goatee' } },
    tre: { name: 'Lil Tre', full: 'Lil Tre', col: '#ffa3a3', role: 'Runs the corner store on Ramey. Knows everybody\'s business.', seed: 121, look: { hairStyle: 'waves', build: 1, height: 1, skin: '#6b4429', top: 'tee_red', bottom: 'jeans_blue', shoes: 'kicks_white' } },
    robber: { name: 'Hooded dude', full: 'Hooded dude', col: '#ff6b6b', role: '', seed: 131, look: { hairStyle: 'short', build: 1, height: 1, skin: '#55341f', top: 'hoodie_black', bottom: 'joggers_black', shoes: 'kicks_blackout', mask: 'skimask_black' } },
    robber2: { name: 'Second dude', full: 'Second dude', col: '#ff6b6b', role: '', seed: 141, look: { hairStyle: 'cornrows', build: 2, height: 1, skin: '#3f2a1a', top: 'hoodie_grey', bottom: 'cargo_black', shoes: 'boots_tactical', mask: 'bandana_black' } },
    me: { name: 'You', col: '#ffffff' },
    narr: { name: '', col: '#ffffff' },
    throttle: { name: 'Throttle', full: 'Throttle (app)', col: '#ff5a1f', role: '' },
  };
  // where the story happens (world metres; snapped to sidewalks when used)
  const SY_SPOT = {
    bus: [-40, -60, 'Fort Worth Central Station'],       // downtown, by the bus bays
    mama: [1440, -238, "Big Mama's house · Ramey Ave"],
    corner: [1915, -143, "Lil Tre's Corner Store"],
    church: [1509, -335, 'Greater Stop Six Baptist Church'],
    rusty: [-75, 463, "Rusty's Used Autos"],
    lancaster: [312, 650, 'East Lancaster Runs'],
    trap: [1605, -443, 'Ramey Ave Trap House'],
    lounge: [2095, -143, "Carsen's Lounge"],
    park: [1780, -560, 'Stop Six park'],
  };
  const SY_METERS = [['streets', 'Streets', '#ff5a1f'], ['heat', 'Heat', '#ff3b3b'], ['loyalty', 'Loyalty', '#3fa9ff'], ['family', 'Family', '#ff8fb8'], ['clean', 'Clean', '#45d07a']];
  function sy() {
    if (!S.story) S.story = { on: false, m: null, seg: 0, done: [], meters: { streets: 0, heat: 0, loyalty: 50, family: 60, clean: 0 }, flags: {}, journal: [], met: [],
      texts: {}, trap: [], orders: [], pack: 0, debt: 0, paid: 0, sold: 0, served: 0, unread: 0, trapUnread: 0, loan: null, next: null, nextT: 0, v: 1 };
    return S.story;
  }

  // ---------- the overlay: letterbox, subtitles, choices, calls, objective, banners ----------
  const SY_CSS = `
  #sy-root{position:fixed;inset:0;pointer-events:none;z-index:70;font-family:var(--body);color:#fff}
  #sy-root .bar{position:absolute;left:0;right:0;height:0;background:#000;transition:height .45s ease}
  #sy-root .bar.t{top:0} #sy-root .bar.b{bottom:0}
  body.sy-cs #sy-root .bar{height:11vh}
  body.sy-cs > *:not(#stage):not(#sy-root):not(script):not(style){visibility:hidden!important}
  body.sy-flash #stage canvas{filter:sepia(.55) saturate(.8) contrast(1.08) brightness(.96)}
  #sy-flashtag{position:absolute;top:13vh;left:50%;transform:translateX(-50%);font:700 13px var(--body);letter-spacing:.35em;color:#e8d3a2;opacity:0;transition:opacity .6s}
  body.sy-flash #sy-flashtag{opacity:.9}
  #sy-sub{position:absolute;left:50%;bottom:calc(11vh + 14px);transform:translateX(-50%);max-width:min(84vw,760px);text-align:center;padding:8px 16px;border-radius:10px;background:rgba(0,0,0,.58);font-size:clamp(15px,2.3vw,20px);line-height:1.3;opacity:0;transition:opacity .2s}
  body:not(.sy-cs) #sy-sub{bottom:calc(150px + env(safe-area-inset-bottom))}
  #sy-sub.on{opacity:1} #sy-sub b{display:block;font-size:.72em;letter-spacing:.14em;text-transform:uppercase;margin-bottom:2px}
  #sy-sub .ph{font-size:.7em;opacity:.7;margin-left:6px}
  #sy-choice{position:absolute;left:50%;bottom:calc(11vh + 10px);transform:translateX(-50%);display:flex;flex-direction:column;gap:7px;width:min(92vw,560px);pointer-events:auto}
  body:not(.sy-cs) #sy-choice{bottom:calc(130px + env(safe-area-inset-bottom))}
  #sy-choice button{font:600 clamp(15px,2.2vw,18px) var(--body);text-align:left;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(10,10,14,.82);color:#fff}
  #sy-choice button i{font-style:normal;font-size:.75em;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin-right:8px}
  #sy-choice button:active{background:#ffd23f;color:#000}
  #sy-choice .tm{height:3px;border-radius:2px;background:#ffd23f;transform-origin:left;margin-top:2px}
  #sy-call{position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;width:250px;padding:14px;border-radius:18px;background:rgba(20,22,28,.94);box-shadow:0 10px 30px rgba(0,0,0,.5);pointer-events:auto;text-align:center;transform:translateY(-140%);transition:transform .35s cubic-bezier(.2,.9,.3,1.2)}
  #sy-call.on{transform:none}
  #sy-call .av{width:58px;height:58px;border-radius:50%;margin:0 auto 6px;display:grid;place-items:center;font:28px var(--display);color:#111}
  #sy-call h4{margin:0;font:700 20px var(--body)} #sy-call p{margin:2px 0 10px;font-size:13px;opacity:.7}
  #sy-call .row{display:flex;gap:10px;justify-content:center} #sy-call button{flex:1;border:0;border-radius:20px;padding:9px 0;font:700 15px var(--body);color:#fff}
  #sy-call .yes{background:#2fbf5a} #sy-call .no{background:#e53935}
  #sy-call.live .row{display:none} #sy-call.live p::before{content:'● ';color:#2fbf5a}
  #sy-obj{position:absolute;top:calc(8px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);max-width:min(70vw,560px);text-align:center;font:700 clamp(14px,2vw,17px) var(--body);text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,.6);opacity:0;transition:opacity .3s}
  #sy-obj.on{opacity:1} #sy-obj small{display:block;font-size:.72em;letter-spacing:.16em;text-transform:uppercase;color:#ffd23f}
  body.phoning #sy-obj{opacity:0}
  #sy-title{position:absolute;inset:0;display:grid;place-items:center;text-align:center;opacity:0;transition:opacity .7s}
  #sy-title.on{opacity:1} #sy-title .k{font:700 14px var(--body);letter-spacing:.4em;color:#ffd23f}
  #sy-title h1{margin:.1em 0 0;font:clamp(30px,6vw,62px) var(--display);letter-spacing:.02em;text-shadow:0 3px 14px rgba(0,0,0,.7)}
  #sy-title p{margin:.3em 0 0;font:600 clamp(14px,2vw,18px) var(--body);opacity:.85}
  #sy-black{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .6s} #sy-black.on{opacity:1}
  #sy-black .txt{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font:600 clamp(16px,2.6vw,24px) var(--body);letter-spacing:.06em;padding:0 10vw;line-height:1.5}
  #sy-name{position:absolute;left:6vw;bottom:calc(11vh + 70px);opacity:0;transition:opacity .5s, transform .5s;transform:translateX(-14px)}
  #sy-name.on{opacity:1;transform:none} #sy-name h3{margin:0;font:clamp(22px,3.6vw,34px) var(--display);color:#ffd23f;text-shadow:0 2px 8px #000} #sy-name p{margin:0;font:600 15px var(--body);text-shadow:0 1px 4px #000}
  #sy-pops{position:absolute;right:12px;top:40%;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
  #sy-pops div{padding:5px 10px;border-radius:8px;background:rgba(0,0,0,.65);font:700 14px var(--body);animation:sypop 3.2s forwards}
  @keyframes sypop{0%{opacity:0;transform:translateX(20px)}10%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
  #sy-banner{position:absolute;left:0;right:0;top:34%;text-align:center;opacity:0;transition:opacity .5s;pointer-events:none}
  #sy-banner.on{opacity:1} #sy-banner h2{margin:0;font:clamp(30px,6vw,58px) var(--display);color:#ffd23f;text-shadow:0 3px 14px #000} #sy-banner.bad h2{color:#ff4b4b}
  #sy-banner p{margin:4px 0 0;font:600 17px var(--body);text-shadow:0 1px 4px #000} #sy-banner button{pointer-events:auto;margin-top:12px;font:700 16px var(--body);padding:9px 22px;border-radius:20px;border:0;background:#ffd23f;color:#000}
  #sy-talk{position:absolute;left:50%;bottom:calc(190px + env(safe-area-inset-bottom));transform:translateX(-50%);pointer-events:auto;display:none;font:700 16px var(--body);padding:10px 20px;border-radius:24px;border:0;background:#ffd23f;color:#000;box-shadow:0 4px 14px rgba(0,0,0,.45)}
  #sy-talk.on{display:block} #sy-talk small{opacity:.6;margin-left:6px}
  #sy-skip{position:absolute;top:calc(11vh + 8px);right:14px;pointer-events:auto;display:none;font:700 13px var(--body);letter-spacing:.1em;padding:6px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.4);color:#fff}
  body.sy-cs #sy-skip{display:block}
  #sy-note{position:absolute;top:calc(8px + env(safe-area-inset-top));left:50%;width:min(92vw,380px);transform:translate(-50%,-160%);padding:10px 12px;border-radius:16px;background:rgba(28,30,36,.95);box-shadow:0 8px 24px rgba(0,0,0,.5);transition:transform .35s;display:flex;gap:10px;align-items:center;pointer-events:auto}
  #sy-note.on{transform:translate(-50%,0)} #sy-note .av{flex:0 0 38px;height:38px;border-radius:50%;display:grid;place-items:center;font:18px var(--display);color:#111}
  #sy-note b{font:700 14px var(--body)} #sy-note span{display:block;font-size:14px;opacity:.85;line-height:1.25} #sy-note em{font-style:normal;font-size:11px;opacity:.5;margin-left:6px}
  .sy-app .sec{margin:14px 12px 6px;font:700 12px var(--body);letter-spacing:.16em;text-transform:uppercase;opacity:.55}
  .sy-app .mrow{display:flex;align-items:center;gap:8px;margin:5px 12px;font:600 14px var(--body)} .sy-app .mrow span{flex:0 0 64px} .sy-app .mrow i{flex:1;height:7px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden} .sy-app .mrow i b{display:block;height:100%}
  .sy-app .ms{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.06)} .sy-app .ms .n{flex:0 0 26px;height:26px;border-radius:50%;display:grid;place-items:center;font:700 13px var(--body);background:rgba(255,255,255,.1)}
  .sy-app .ms.done .n{background:#2fbf5a;color:#000} .sy-app .ms.now .n{background:#ffd23f;color:#000} .sy-app .ms.lock{opacity:.4} .sy-app .ms h5{margin:0;font:700 15px var(--body)} .sy-app .ms p{margin:2px 0 0;font-size:13px;opacity:.7}
  .sy-app .big{display:block;margin:12px;padding:12px;border-radius:12px;border:0;width:calc(100% - 24px);font:700 16px var(--body);background:#ffd23f;color:#000}
  .sy-app .ppl{display:flex;gap:10px;padding:8px 12px;align-items:center} .sy-app .ppl .av{flex:0 0 34px;height:34px;border-radius:50%;display:grid;place-items:center;font:16px var(--display);color:#111}
  .sy-app .ppl b{font:700 14px var(--body)} .sy-app .ppl span{display:block;font-size:12.5px;opacity:.7}
  .sy-app .jr{padding:7px 12px;font-size:14px;border-left:3px solid #ffd23f;margin:6px 12px;background:rgba(255,255,255,.04)}
  .sy-app .life{display:flex;justify-content:space-between;padding:7px 12px;font-size:14px} .sy-app .life em{font-style:normal;opacity:.55;font-size:12px}
  .sy-app .chat{padding:10px 12px;display:flex;flex-direction:column;gap:6px} .sy-app .chat .m{max-width:80%;padding:7px 11px;border-radius:16px;font-size:14.5px;line-height:1.3;background:rgba(255,255,255,.1);align-self:flex-start}
  .sy-app .chat .m.me{align-self:flex-end;background:#1f8bff} .sy-app .thr{display:flex;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);width:100%;text-align:left;background:none;border-left:0;border-right:0;border-top:0;color:#fff}
  .sy-app .thr .av{flex:0 0 38px;height:38px;border-radius:50%;display:grid;place-items:center;font:17px var(--display);color:#111} .sy-app .thr b{font:700 15px var(--body)} .sy-app .thr span{display:block;font-size:13px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
  .sy-app .thr .dot{margin-left:auto;width:9px;height:9px;border-radius:50%;background:#1f8bff}
  .sy-app .ord{display:flex;gap:10px;align-items:center;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.06)} .sy-app .ord b{font:700 15px var(--body)} .sy-app .ord span{display:block;font-size:13px;opacity:.7} .sy-app .ord button{margin-left:auto;border:0;border-radius:14px;padding:6px 12px;font:700 13px var(--body);background:#ffd23f;color:#000}
  .sy-app .stat{display:flex;gap:8px;margin:10px 12px} .sy-app .stat div{flex:1;padding:8px;border-radius:10px;background:rgba(255,255,255,.07);text-align:center} .sy-app .stat b{display:block;font:20px var(--display)} .sy-app .stat span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.6}
  `;
  function syUI() {
    if (SY.el) return SY.el;
    const st = document.createElement('style'); st.textContent = SY_CSS; document.head.append(st);
    const r = document.createElement('div'); r.id = 'sy-root';
    r.innerHTML = `<div class="bar t"></div><div class="bar b"></div><div id="sy-flashtag">FLASHBACK</div><div id="sy-black"><div class="txt"></div></div><div id="sy-title"><div><div class="k"></div><h1></h1><p></p></div></div>
      <div id="sy-name"><h3></h3><p></p></div><div id="sy-sub"></div><div id="sy-choice" hidden></div><div id="sy-obj"></div><div id="sy-pops"></div>
      <div id="sy-banner"><h2></h2><p></p><div class="act"></div></div><button id="sy-talk"></button><button id="sy-skip">SKIP ▸▸</button>
      <div id="sy-call"><div class="av"></div><h4></h4><p>Incoming call</p><div class="row"><button class="no">Decline</button><button class="yes">Answer</button></div></div>
      <div id="sy-note"><div class="av"></div><div><b></b><em></em><span></span></div></div>`;
    document.body.append(r);
    const q = id => r.querySelector(id);
    SY.el = { r, sub: q('#sy-sub'), choice: q('#sy-choice'), call: q('#sy-call'), obj: q('#sy-obj'), title: q('#sy-title'), black: q('#sy-black'), name: q('#sy-name'), pops: q('#sy-pops'), banner: q('#sy-banner'), talk: q('#sy-talk'), skip: q('#sy-skip'), note: q('#sy-note') };
    SY.el.skip.onclick = () => { SY.skip = true; syAdvance(); };
    SY.el.sub.addEventListener('pointerdown', () => syAdvance());
    r.addEventListener('pointerdown', e => { if (SY.lock && !e.target.closest('button')) syAdvance(); });
    SY.el.talk.onclick = () => { if (SY.talk) SY.talk.go(); };
    SY.el.note.onclick = () => { const n = SY.el.note.dataset.app; SY.el.note.classList.remove('on'); if (n && !SY.lock) { openPhone(); phoneApp(n); } };
    addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.code === 'KeyE' && SY.talk && !SY.lock && !menuFn) { e.stopImmediatePropagation(); SY.talk.go(); }
      else if ((e.code === 'Space' || e.code === 'Enter') && SY.lock && SY.el.choice.hidden) { e.preventDefault(); syAdvance(); }
      else if (e.code === 'Escape' && SY.lock) SY.skip = true, syAdvance();
      else if (/^Digit[1-4]$/.test(e.code) && !SY.el.choice.hidden) { const b = SY.el.choice.querySelectorAll('button')[+e.code.slice(5) - 1]; if (b) b.click(); }
    }, true);
    return SY.el;
  }
  const syAv = who => { const c = SY_CAST[who] || {}; return `<div class="av" style="background:${c.col || '#ccc'}">${esc((c.name || who || '?').replace(/^(Big|Lil|Mr\.|Deacon|Pastor) /, '')[0] || '?')}</div>`; };

  // ---------- little helpers ----------
  const syWait = s => new Promise(res => { if (SY.skip && SY.lock) return res(); const until = performance.now() + (SY.fast ? Math.min(s, 0.05) : s) * 1000; SY.waits.push({ until, res }); });
  function syAdvance() { const w = SY.said; if (w) { SY.said = null; w(); } if (SY.skip) for (const x of SY.waits.splice(0)) x.res(); }
  function syUntil(pred, obj, sub) { if (obj != null) syObjective(obj, sub); return new Promise(res => SY.waits.push({ pred, res })); }
  function syObjective(text, sub) { const el = syUI().obj; SY.obj = text || ''; SY.objSub = sub || (SY.act ? SY.act.label : ''); el.innerHTML = text ? `<small>${esc(SY.objSub)}</small>${esc(text)}` : ''; el.classList.toggle('on', !!text); }
  function syMeter(k, d, why) {
    const st = sy(), m = st.meters; if (!(k in m) || !d) return; m[k] = Math.max(0, Math.min(100, m[k] + d)); save();
    const def = SY_METERS.find(x => x[0] === k), el = document.createElement('div');
    el.innerHTML = `<span style="color:${def[2]}">${def[1]} ${d > 0 ? '▲' : '▼'} ${Math.abs(d)}</span>${why ? ` <small style="opacity:.7">${esc(why)}</small>` : ''}`; syUI().pops.append(el); setTimeout(() => el.remove(), 3300);
    if (k === 'heat' && d > 0 && m.heat > 60) S.heat = Math.min(5, (S.heat || 0) + 1);
  }
  function syNote(t) { const st = sy(); if (!st.journal.includes(t)) { st.journal.unshift(t); save(); const el = document.createElement('div'); el.innerHTML = `<span style="color:#ffd23f">Journal updated</span>`; syUI().pops.append(el); setTimeout(() => el.remove(), 3300); } }
  function syMeet(who) { const st = sy(); if (!st.met.includes(who)) { st.met.push(who); save(); } }
  const syFlag = (k, v) => { const f = sy().flags; if (v !== undefined) { f[k] = v; save(); } return f[k]; };
  const syMe = () => foot.on ? [foot.x, foot.z] : [drv.x, drv.z];
  // a sidewalk spot near (x, z), a few metres off the road on the side you name (1 / -1)
  function sySide(x, z, side = 1, off = 2.6) {
    const r = nearestRoad(x, z); if (!r) return { x, z, yaw: 0 };
    const nx = r.horiz ? 0 : 1, nz = r.horiz ? 1 : 0, s = Math.sign((x - r.x) * nx + (z - r.z) * nz) || side;
    const d = r.e.w / 2 + off;
    return { x: r.x + nx * d * s, z: r.z + nz * d * s, yaw: Math.atan2(nx * s, nz * s), road: r };   // yaw faces the road
  }
  function spot(k, side, off) { const s = SY_SPOT[k]; return Object.assign(sySide(s[0], s[1], side, off), { name: s[2] }); }

  // ---------- voices: a soft murmur under each line, pitched per person, so lines feel spoken ----------
  function syVoice(who, len) {
    const ac = typeof audioCtx === 'function' ? audioCtx() : null; if (!ac || ac.state !== 'running' || who === 'narr') return;
    const base = { mama: 210, mook: 150, rusty: 105, nia: 240, hollis: 95, pastor: 110, lou: 85, dre: 100, bit: 190, smoke: 125, og: 100, tre: 140, robber: 120, robber2: 110, me: 135 }[who] || 130;
    const n = Math.min(14, Math.max(3, Math.round(len / 6))), t0 = ac.currentTime, g0 = ac.createGain(); g0.gain.value = 0.05; g0.connect(ac.destination);
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), t = t0 + i * 0.085 + Math.random() * 0.02;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.25), t); f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 900; f.Q.value = 4;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      o.connect(f); f.connect(g); g.connect(g0); o.start(t); o.stop(t + 0.09);
    }
  }
  function syRing(on) {
    clearInterval(SY.ringI); if (!on) return;
    const ring = () => { const ac = typeof audioCtx === 'function' ? audioCtx() : null; if (!ac || ac.state !== 'running') return; const t0 = ac.currentTime;
      for (let k = 0; k < 2; k++) for (const [fq, dt] of [[1318, 0], [1046, 0.12], [1318, 0.24]]) { const o = ac.createOscillator(), g = ac.createGain(), t = t0 + k * 0.55 + dt; o.type = 'sine'; o.frequency.value = fq; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.12); } };
    ring(); SY.ringI = setInterval(ring, 2200);
  }
  function syPing() { const ac = typeof audioCtx === 'function' ? audioCtx() : null; if (!ac || ac.state !== 'running') return; const t = ac.currentTime; for (const [fq, dt] of [[1568, 0], [2093, 0.09]]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = fq; g.gain.setValueAtTime(0.0001, t + dt); g.gain.linearRampToValueAtTime(0.06, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.18); o.connect(g); g.connect(ac.destination); o.start(t + dt); o.stop(t + dt + 0.2); } }

  // ---------- lines, choices, calls, texts ----------
  // one line of dialogue: subtitle (and the speaker gestures if they're on screen); tap or wait to move on
  function say(who, text, o = {}) {
    const el = syUI().sub, c = SY_CAST[who] || { name: who, col: '#fff' };
    const nm = who === 'me' ? (S.name || 'You') : c.name;
    el.innerHTML = `${nm ? `<b style="color:${c.col}">${esc(nm)}${o.phone ? '<span class="ph">📞</span>' : ''}</b>` : ''}${esc(text)}`; el.classList.add('on');
    const A = SY.actors.get(who); if (A) A.talk = 1; else if (who === 'me' && ME) SY.meTalk = 1;
    if (!SY.skip) syVoice(who, text.length);
    const dur = o.dur || Math.max(1.8, 0.9 + text.length * 0.052);
    return new Promise(res => {
      let t = 0, fin = false;
      const done = () => { if (fin) return; fin = true; clearTimeout(t); if (A) A.talk = 0; SY.meTalk = 0; el.classList.remove('on'); res(); };
      if (SY.skip && SY.lock && !o.keep) return done();
      t = setTimeout(() => { if (SY.said === done) SY.said = null; done(); }, (SY.fast ? 0.05 : dur) * 1000); SY.said = done;
    });
  }
  async function lines(arr, o) { for (const l of arr) { if (typeof l === 'function') { await l(); continue; } await say(l[0], l[1], Object.assign({}, o, l[2])); } }
  // a choice on a timer (default picked when time runs out). opts: [{t, tone, d:{meter: n}}]
  function choose(opts, o = {}) {
    const el = syUI().choice, tmax = o.timer || 12, def = o.def || 0; el.hidden = false;
    el.innerHTML = (o.q ? `<div style="text-align:center;font:600 15px var(--body);text-shadow:0 1px 4px #000;margin-bottom:2px">${esc(o.q)}</div>` : '') +
      opts.map((x, i) => `<button data-i="${i}"><i>${i + 1}${x.tone ? ' · ' + esc(x.tone) : ''}</i>${esc(x.t)}</button>`).join('') + `<div class="tm"></div>`;
    const bar = el.querySelector('.tm'), t0 = performance.now();
    return new Promise(res => {
      let fin = false;
      const pick = i => { if (fin) return; fin = true; clearInterval(iv); el.hidden = true; el.innerHTML = ''; const x = opts[i]; if (x.d) for (const k in x.d) syMeter(k, x.d[k]); res(i); };
      el.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); pick(+b.dataset.i); });
      const iv = setInterval(() => { const k = 1 - (performance.now() - t0) / 1000 / tmax; bar.style.transform = `scaleX(${Math.max(0, k)})`; if (k <= 0) pick(def); }, 50);
      if (SY.autoPick != null) setTimeout(() => pick(Math.min(opts.length - 1, typeof SY.autoPick === 'function' ? SY.autoPick(opts) : SY.autoPick)), 30);
    });
  }
  // an incoming phone call: answer to hear it (you can keep walking or driving); decline and they remember
  function call(who, arr, o = {}) {
    const el = syUI().call, c = SY_CAST[who];
    el.querySelector('.av').outerHTML = syAv(who); el.querySelector('h4').textContent = c.name; el.querySelector('p').textContent = 'Incoming call'; el.classList.remove('live'); el.classList.add('on');
    syRing(true); syPing();
    return new Promise(res => {
      const end = async ok => {
        syRing(false);
        if (!ok) { el.classList.remove('on'); if (o.mustAnswer) { await syWait(8); return res(await call(who, arr, o)); } res(false); return; }
        el.classList.add('live'); el.querySelector('p').textContent = 'On the phone';
        await lines(arr, { phone: true }); el.classList.remove('on'); res(true);
      };
      el.querySelector('.yes').onclick = () => end(true); el.querySelector('.no').onclick = () => { if (o.onDecline) o.onDecline(); end(false); };
      SY.callAns = () => end(true);
      if (SY.autoAnswer) setTimeout(() => end(true), 50);
    });
  }
  // a text in your story thread with someone (or the trap phone for customers)
  function text(who, msg, o = {}) {
    const st = sy(), box = o.trap ? 'trap' : who; (st.texts[box] = st.texts[box] || []).push({ w: o.me ? 'me' : who, m: msg, d: S.day });
    if (st.texts[box].length > 60) st.texts[box].splice(0, st.texts[box].length - 60);
    if (!o.me) { if (o.trap) st.trapUnread++; else st.unread++; }
    save(); if (o.me || o.quiet) return;
    const el = syUI().note, c = SY_CAST[who] || { name: who, col: '#9aa' };
    el.querySelector('.av').outerHTML = syAv(SY_CAST[who] ? who : 'narr'); el.querySelector('b').textContent = o.trap ? `Trap phone · ${o.from || c.name}` : c.name; el.querySelector('em').textContent = 'now'; el.querySelector('span').textContent = msg;
    el.dataset.app = o.trap ? 'trap' : 'texts'; el.classList.add('on'); syPing(); clearTimeout(SY.noteT); SY.noteT = setTimeout(() => el.classList.remove('on'), 4200);
  }
  function syTitle(k, h, p, s = 3.2) { const el = syUI().title; el.querySelector('.k').textContent = k; el.querySelector('h1').textContent = h; el.querySelector('p').textContent = p || ''; el.classList.add('on'); return syWait(s).then(() => { el.classList.remove('on'); return syWait(0.6); }); }
  function syName(who) { const c = SY_CAST[who], el = syUI().name; syMeet(who); el.querySelector('h3').textContent = c.full || c.name; el.querySelector('p').textContent = c.role; el.classList.add('on'); clearTimeout(SY.nameT); SY.nameT = setTimeout(() => el.classList.remove('on'), 3400); }
  async function syBlack(txt, s = 3) { const el = syUI().black; el.querySelector('.txt').innerHTML = txt || ''; el.classList.add('on'); await syWait(s); }
  function syUnblack() { syUI().black.classList.remove('on'); return syWait(0.6); }
  async function banner(h, p, bad, btns) {
    const el = syUI().banner; el.querySelector('h2').textContent = h; el.querySelector('p').textContent = p || ''; el.classList.toggle('bad', !!bad); el.classList.add('on');
    const act = el.querySelector('.act'); act.innerHTML = '';
    if (btns) return new Promise(res => { for (const [t, v] of btns) { const b = document.createElement('button'); b.textContent = t; b.style.margin = '12px 6px 0'; b.onclick = () => { el.classList.remove('on'); act.innerHTML = ''; res(v); }; act.append(b); } if (SY.autoRetry) setTimeout(() => act.querySelector('button').click(), 30); });
    await new Promise(r => setTimeout(r, SY.fast ? 50 : 3200)); el.classList.remove('on');
  }

  // ---------- actors: the cast as real 3D people in the world ----------
  function syLook(who) {
    const c = SY_CAST[who]; let sd = 7919 * (c.seed || 1); const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; R();
    const L = Object.assign(PEOPLE.randomLook(R, !!c.fem), { mask: 'no_mask' }, c.look || {});
    if (!c.fem) L.bag = 'no_bag'; return L;
  }
  function actor(who, x, z, yaw = 0) {
    let A = SY.actors.get(who);
    if (!A) {
      const P = PEOPLE.build(syLook(who), phone ? 1 : 0), wrap = new THREE.Group(); P.root.rotation.y = Math.PI; wrap.add(P.root); scene.add(wrap);
      A = { who, P, wrap, x, z, yaw, ph: Math.random() * 6, walk: null, talk: 0, t: Math.random() * 10, pose: null }; SY.actors.set(who, A);
      if (who === 'smoke') SY.mural && (SY.mural.visible = SY.mural.visible);
    }
    A.x = x; A.z = z; A.yaw = yaw; A.walk = null; A.wrap.position.set(x, 0, z); A.wrap.rotation.y = yaw; A.wrap.visible = true;
    return A;
  }
  function unactor(who) { const A = SY.actors.get(who); if (!A) return; scene.remove(A.wrap); PEOPLE.dispose(A.P); SY.actors.delete(who); if (SY.talk && SY.talk.who === who) syTalkOff(); }
  function unactAll(keep = []) { for (const w of [...SY.actors.keys()]) if (!keep.includes(w)) unactor(w); }
  const syYawTo = (x0, z0, x1, z1) => Math.atan2(-(x1 - x0), -(z1 - z0));
  function face(who, x, z) { if (who === 'me') { foot.yaw = syYawTo(foot.x, foot.z, x, z); if (foot.holder) foot.holder.rotation.y = foot.yaw; return; } const A = SY.actors.get(who); if (A) A.yaw = syYawTo(A.x, A.z, x, z); }
  function faceEach(a, b) { const pa = syPos(a), pb = syPos(b); if (pa && pb) { face(a, pb[0], pb[1]); face(b, pa[0], pa[1]); } }
  function syPos(who) { if (who === 'me') return [foot.on ? foot.x : drv.x, foot.on ? foot.z : drv.z]; const A = SY.actors.get(who); return A ? [A.x, A.z] : null; }
  function walkTo(who, x, z, run = 0) {
    if (who === 'me') { if (SY.skip) { foot.x = x; foot.z = z; return Promise.resolve(); } return new Promise(res => { SY.meWalk = { x, z, run, res }; }); }
    const A = SY.actors.get(who); if (!A) return Promise.resolve();
    if (SY.skip && SY.lock) { A.x = x; A.z = z; return Promise.resolve(); }
    return new Promise(res => { A.walk = { x, z, run, res }; });
  }
  function syStepActors(dt) {
    const now = performance.now() / 1000;
    for (const A of SY.actors.values()) {
      A.t += dt; const P = A.P;
      if (A.walk) {
        const dx = A.walk.x - A.x, dz = A.walk.z - A.z, d = Math.hypot(dx, dz), sp = A.walk.run ? 6.2 : 1.9;
        if (d < 0.15 || (SY.skip && SY.lock)) { if (SY.skip) { A.x = A.walk.x; A.z = A.walk.z; } const r = A.walk.res; A.walk = null; r(); }
        else { const k = Math.min(1, sp * dt / d); A.x += dx * k; A.z += dz * k; A.yaw = Math.atan2(-dx, -dz); A.ph += dt * sp * Math.PI * 2 / (A.walk.run ? 3.6 : 1.5); animPerson(P, A.ph, 1, A.walk.run ? 1 : 0); }
      }
      if (!A.walk) {
        idlePerson(P, now + A.t);
        if (A.talk) { const k = A.t * 7; P.head.rotation.x += Math.sin(k) * 0.05; P.head.rotation.y += Math.sin(k * 0.37) * 0.08; P.arms[1].rotation.x += -0.35 + Math.sin(k * 0.5) * 0.25; if (P.fores) P.fores[1].rotation.x = -0.9 + Math.sin(k * 0.5) * 0.3; }
        if (A.pose === 'cross' && P.fores) { P.arms[0].rotation.x = P.arms[1].rotation.x = -0.5; P.arms[0].rotation.z = 0.5; P.arms[1].rotation.z = -0.5; P.fores[0].rotation.x = P.fores[1].rotation.x = -1.6; }
        if (A.pose === 'phone' && P.fores) { P.arms[1].rotation.x = -0.4; P.fores[1].rotation.x = -2.2; P.head.rotation.x += 0.15; }
        if (A.pose === 'hands' && P.fores) { P.arms[0].rotation.x = P.arms[1].rotation.x = -1.4; P.fores[0].rotation.x = P.fores[1].rotation.x = -0.3; }
        if (A.pose === 'sad') { P.head.rotation.x += 0.35; }
      }
      A.wrap.position.set(A.x, 0, A.z);
      let dy = A.yaw - A.wrap.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); A.wrap.rotation.y += dy * Math.min(1, dt * 8);
    }
    // you, while the story drives you (cutscene walks) or talks
    if (SY.lock && foot.on && ME && foot.holder) {
      if (SY.meWalk) {
        const W = SY.meWalk, dx = W.x - foot.x, dz = W.z - foot.z, d = Math.hypot(dx, dz), sp = W.run ? 6.2 : 1.9;
        if (d < 0.15) { SY.meWalk = null; W.res(); } else { const k = Math.min(1, sp * dt / d); foot.x += dx * k; foot.z += dz * k; foot.yaw = Math.atan2(-dx, -dz); foot.walk += dt * sp * Math.PI * 2 / (W.run ? 3.6 : 1.5); animPerson(ME, foot.walk, 1, W.run ? 1 : 0); }
      } else { idlePerson(ME, now); if (SY.meTalk) { const k = now * 7; ME.head.rotation.x += Math.sin(k) * 0.05; ME.arms[1].rotation.x += -0.3 + Math.sin(k * 0.5) * 0.22; } }
      foot.holder.position.set(foot.x, 0, foot.z); let dy = foot.yaw - foot.holder.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); foot.holder.rotation.y += dy * Math.min(1, dt * 8);
      drv.x = foot.x; drv.z = foot.z;
    }
  }

  // ---------- the camera director ----------
  // shot(from, at, opts): cut (or glide with opts.to/opts.toAt over opts.dur) the camera; positions are [x, y, z]
  function shot(from, at, o = {}) { SY.cam = { p0: new THREE.Vector3(...from), l0: new THREE.Vector3(...at), p1: new THREE.Vector3(...(o.to || from)), l1: new THREE.Vector3(...(o.toAt || at)), dur: o.dur || 6, t: 0, shake: o.shake || 0 }; }
  // framing helpers from where people stand: over-the-shoulder, a two-shot, a close-up
  function ots(a, b, side = 1) {   // over a's shoulder onto b
    const pa = syPos(a), pb = syPos(b); if (!pa || !pb) return; const dx = pb[0] - pa[0], dz = pb[1] - pa[1], d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, rx = -uz * side, rz = ux * side;
    shot([pa[0] - ux * 2.1 + rx * 0.95, 1.82, pa[1] - uz * 2.1 + rz * 0.95], [pb[0] - rx * 0.15, 1.5, pb[1] - rz * 0.15], { to: [pa[0] - ux * 1.85 + rx * 0.9, 1.8, pa[1] - uz * 1.85 + rz * 0.9], dur: 7 });
  }
  function two(a, b, side = 1, dist = 4.2) {
    const pa = syPos(a), pb = syPos(b); if (!pa || !pb) return; const mx = (pa[0] + pb[0]) / 2, mz = (pa[1] + pb[1]) / 2, dx = pb[0] - pa[0], dz = pb[1] - pa[1], d = Math.hypot(dx, dz) || 1;
    const nx = -dz / d * side, nz = dx / d * side; shot([mx + nx * dist, 1.6, mz + nz * dist], [mx, 1.35, mz], { to: [mx + nx * (dist - 0.6) + dx / d * 0.4, 1.62, mz + nz * (dist - 0.6) + dz / d * 0.4], dur: 8 });
  }
  function close(who, side = 1, d = 1.6) {
    const p = syPos(who); if (!p) return; const A = SY.actors.get(who), yaw = who === 'me' ? foot.yaw : A ? A.yaw : 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw) * side, rz = -Math.sin(yaw) * side;
    shot([p[0] + fx * d + rx * 0.5, 1.68, p[1] + fz * d + rz * 0.5], [p[0], 1.58, p[1]], { to: [p[0] + fx * (d - 0.2) + rx * 0.45, 1.66, p[1] + fz * (d - 0.2) + rz * 0.45], dur: 7 });
  }
  function wide(x, z, yaw, d = 14, h = 5) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); shot([x - fx * d, h, z - fz * d], [x, 1.2, z], { to: [x - fx * (d - 3), h - 1, z - fz * (d - 3)], dur: 9 }); }
  function syStepCam(dt) {
    const C = SY.cam; if (!C || !SY.lock) return;
    C.t = Math.min(C.dur, C.t + dt); const k = C.t / C.dur, e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(C.p0, C.p1, e); const L = v5.lerpVectors(C.l0, C.l1, e);
    if (C.shake) { camera.position.x += (Math.random() - 0.5) * C.shake; camera.position.y += (Math.random() - 0.5) * C.shake; }
    camera.lookAt(L);
  }
  // cutscene: lock input, hide the HUD, letterbox. fn does the shots and lines
  async function cut(fn, o = {}) {
    syUI(); if (inside) leaveInterior(true); closePhone && PH.open && closePhone(); closeMenu();
    SY.lock = true; SY.skip = false; document.body.classList.add('sy-cs'); syObjective('');
    if (driving && !foot.on && o.out !== false) { drv.v = 0; getOut(); }
    if (o.flash) { SY.flash = true; document.body.classList.add('sy-flash'); }
    try { await fn(); }
    finally {
      SY.lock = false; SY.skip = false; SY.cam = null; SY.meWalk = null; document.body.classList.remove('sy-cs');
      if (SY.flash && !o.keepFlash) { SY.flash = false; document.body.classList.remove('sy-flash'); }
      syUI().sub.classList.remove('on'); syUI().name.classList.remove('on'); syUI().black.classList.remove('on');
      for (const A of SY.actors.values()) A.talk = 0;
      if (foot.on) { foot.camYaw = foot.yaw; foot.cam.set(foot.x + Math.sin(foot.camYaw) * 4.6, 2.2, foot.z + Math.cos(foot.camYaw) * 4.6); foot.look.set(foot.x, 1.35, foot.z); }
      if (SY.obj) syObjective(SY.obj, SY.objSub);
    }
  }
  // put you somewhere on foot (no car), facing a way
  function placeMe(x, z, yaw) { if (!foot.on) { if (driving) getOut(); else spawnFoot(x, z, yaw); } foot.x = x; foot.z = z; foot.yaw = foot.camYaw = yaw || 0; foot.target = null; if (foot.holder) { foot.holder.position.set(x, 0, z); foot.holder.rotation.y = foot.yaw; } drv.x = x; drv.z = z; }

  // ---------- objectives in the world ----------
  function syMarker(x, z, y = 2.7) {
    if (!SY.mk) { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false, fog: false })); g.add(m); scene.add(g); SY.mk = g; }
    SY.mk.visible = true; SY.mk.position.set(x, y, z); SY.mk.userData.y = y;
  }
  function syMarkerOff() { if (SY.mk) SY.mk.visible = false; }
  // get to a spot (on foot or in a car)
  async function reach(x, z, r, label, o = {}) {
    setPin(o.pin || label, x, z); syMarker(x, z, o.y || 3);
    await syUntil(() => { const [mx, mz] = syMe(); return Math.hypot(mx - x, mz - z) < r && !inside && (!o.foot || foot.on); }, o.obj || `Go to ${label}`);
    syMarkerOff(); if (typeof gpsClear === 'function') gpsClear(); if (typeof pin !== 'undefined') pin.visible = false;
  }
  // walk up to someone and tap Talk
  function syTalkOff() { SY.talk = null; if (SY.el) SY.el.talk.classList.remove('on'); }
  function talkTo(who, verb = 'Talk to', o = {}) {
    const A = SY.actors.get(who); if (!A) return Promise.resolve();
    syMarker(A.x, A.z, 2.6); if (o.pin) setPin(o.pin, A.x, A.z);
    syObjective(o.obj || `${verb} ${SY_CAST[who] ? SY_CAST[who].name : who}`);
    return new Promise(res => { SY.talk = { who, verb, go: () => { syTalkOff(); syMarkerOff(); res(); }, r: o.r || 3.2 }; if (SY.autoTalk) setTimeout(() => SY.talk && SY.talk.go(), 30); });
  }
  function syStepTalk() {
    const T = SY.talk, el = SY.el && SY.el.talk; if (!el) return;
    if (!T || SY.lock || inside || PH.open) { el.classList.remove('on'); return; }
    const A = SY.actors.get(T.who), [mx, mz] = syMe(); if (!A) { el.classList.remove('on'); return; }
    const near = foot.on && Math.hypot(A.x - mx, A.z - mz) < T.r;
    if (near && (!el.classList.contains('on') || SY.serveFor)) { SY.serveFor = null; el.innerHTML = `${esc(T.verb)} ${esc(SY_CAST[T.who] ? SY_CAST[T.who].name : T.who)}<small>E</small>`; el.onclick = () => { if (SY.talk) SY.talk.go(); }; }
    el.classList.toggle('on', near);
    if (SY.mk && SY.mk.visible) SY.mk.position.set(A.x, 2.6 + Math.sin(performance.now() / 300) * 0.08, A.z);
  }

  // ---------- the loaner: Big Mama's car for the drive home (your own car waits in the garage meanwhile) ----------
  function loanCar(id, color, cond) {
    const st = sy(); if (!st.loan) st.loan = { had: S.car || null };
    const c = newCar(id, color, cond); c.fuel = 0.6; c.loaner = 1; S.car = c; syncCarModel(); save(); return c;
  }
  function endLoan() {
    const st = sy(); if (!st.loan) return; const had = st.loan.had; st.loan = null;
    S.car = had && !had.loaner ? had : null; syncCarModel();
    if (!S.car && foot.on) { foot.park = null; if (car) car.visible = false; carPrompt(false); } else if (S.car && foot.on) deliverCar();
    save(); refreshStats();
  }

  // ---------- Stop Six mural: Smoke's face on the corner store wall, finished a little more each tier ----------
  function syMuralTex(stage) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d');
    g.fillStyle = '#5a4a40'; g.fillRect(0, 0, 1024, 512);
    for (let y = 0; y < 512; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < 1024; x += 64) { g.fillStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.05})`; g.fillRect(x + 1, y + 1, 62, 30); }
    const W = stage >= 2 ? 1024 : 600;
    g.save(); g.beginPath(); g.rect(0, 0, W, 512); g.clip();
    const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, '#1b1f4a'); sky.addColorStop(0.55, '#a8326e'); sky.addColorStop(1, '#ffb347'); g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 70; i++) g.fillRect(Math.random() * 1024, Math.random() * 220, 2, 2);
    // a portrait: shoulders, neck, head, locs
    g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(300, 560, 220, 170, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a2e1c'; g.fillRect(268, 300, 64, 90);
    g.beginPath(); g.ellipse(300, 250, 92, 118, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#120c08'; g.lineWidth = 16; g.lineCap = 'round'; for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(300 + i * 17, 150); g.quadraticCurveTo(300 + i * 22, 230, 300 + i * 26 + (i < 0 ? -40 : 40), 330); g.stroke(); }
    g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(300, 120, 125, 22, 0, 0, Math.PI * 2); g.lineWidth = 8; g.strokeStyle = '#ffd23f'; g.stroke();
    g.fillStyle = '#e9c46a'; g.fillRect(250, 395, 100, 10);
    g.restore();
    g.font = 'bold 150px Bungee, Impact, sans-serif'; g.textBaseline = 'middle';
    const word = 'SMOKE'; g.lineWidth = 14; g.strokeStyle = '#111'; g.fillStyle = '#ffd23f';
    if (stage >= 1) { g.save(); g.beginPath(); g.rect(0, 0, W, 512); g.clip(); g.strokeText(word, 430, 190); g.fillText(word, 430, 190); g.font = 'bold 56px Bungee, Impact, sans-serif'; g.fillStyle = '#fff'; g.lineWidth = 8; g.strokeText('REST EASY', 470, 300); g.fillText('REST EASY', 470, 300); g.font = 'bold 40px "Barlow Condensed", sans-serif'; g.fillText('1998 – 2026 · STOP SIX FOREVER', 470, 370); g.restore(); }
    if (stage < 2) { g.fillStyle = 'rgba(210,205,195,.9)'; g.fillRect(W, 0, 1024 - W, 512); g.strokeStyle = 'rgba(120,110,100,.8)'; g.lineWidth = 3; g.strokeRect(W + 30, 40, 360, 420); g.fillStyle = '#6a5f55'; g.font = 'bold 34px "Barlow Condensed", sans-serif'; g.fillText('(still painting)', W + 80, 250); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function syMural() {
    const stage = syFlag('mural') || 0; if (!DATA) return;
    const p = DATA.P.find(x => x.id === 'plug') || { x: 1915, z: -143, face: 0 };
    if (SY.mural && SY.mural.userData.stage === stage) return;
    if (SY.mural) { scene.remove(SY.mural); SY.mural.material.map.dispose(); SY.mural.material.dispose(); SY.mural.geometry.dispose(); }
    if (!stage) { SY.mural = null; return; }
    const [ox, oz] = outDir(p), tx = -oz, tz = ox;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), new THREE.MeshStandardMaterial({ map: syMuralTex(stage), roughness: 0.92 }));
    // on the store's wall beside the door, facing the street
    m.position.set(p.x - ox * 0.35 + tx * 6.5, 2.1, p.z - oz * 0.35 + tz * 6.5); m.rotation.y = Math.atan2(ox, oz); m.userData.stage = stage; scene.add(m); SY.mural = m;
    // the wall it's painted on: a free-standing cinder block wall with a cap, like the memorial walls on the east side
    const wall = new THREE.Mesh(new THREE.BoxGeometry(7.8, 4.1, 0.45), new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.95 })); wall.position.set(0, -0.05, -0.24); m.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(8, 0.16, 0.6), new THREE.MeshStandardMaterial({ color: 0x6c655d, roughness: 0.9 })); cap.position.set(0, 2.03, -0.24); m.add(cap);
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.3, 0.6), cap.material); post.position.set(sx * 3.95, -0.05, -0.24); m.add(post); }
  }

  // ---------- the trap phone: customers text, you meet them, hand to hand ----------
  const SY_BUYERS = ['Dee', 'Unc', 'Shay', 'Bird', 'Tone', 'Miss Val', 'Boogie', 'Rell', 'Peaches', 'KB', 'Junebug', 'Smitty', 'Nae', 'Pooh', 'Big Ced', 'Coco', 'Twan', 'Fat Mike'];
  const SY_ASKS = ['u good?', 'need 2 asap', 'u on? same as always', 'Smoke used to look out for me. u got me?', 'pull up?', 'need 3 for the weekend', 'u still on Ramey?', 'can u meet me fast', 'got $ need work', 'my folks need some too'];
  const SY_ZONES = [[1915, -143], [1605, -443], [1722, -293], [1440, -238], [1765, -743], [1265, -143], [2095, -143], [1509, -335], [1780, -560], [2265, -293], [1215, -593]];
  function syInSix(x, z) { return x > 1100 && x < 2500 && z > -850 && z < 50; }
  function syNewOrder(o = {}) {
    const st = sy(); if (st.orders.length >= 3) return null;
    const name = o.name || SY_BUYERS[Math.floor(Math.random() * SY_BUYERS.length)], z0 = o.at || SY_ZONES[Math.floor(Math.random() * SY_ZONES.length)];
    const s = sySide(z0[0] + (Math.random() - 0.5) * 80, z0[1] + (Math.random() - 0.5) * 80, 1, 2.4);
    const big = (st.flags.reup || 0) > 0 && Math.random() < 0.3, qty = o.qty || (big ? 4 + Math.floor(Math.random() * 6) : 1 + Math.floor(Math.random() * 3)), each = st.flags.reup ? 55 : 45;
    const ord = { id: 'o' + Date.now() + Math.floor(Math.random() * 999), name, x: s.x, z: s.z, yaw: s.yaw + Math.PI, qty, pay: o.pay || qty * each + Math.round(Math.random() * 4) * 5, t: S.day, set: !!o.set, look: Math.floor(Math.random() * 1e6) };
    st.orders.push(ord); const street = streetAt(s.x, s.z);
    text(name, `${o.msg || SY_ASKS[Math.floor(Math.random() * SY_ASKS.length)]} · ${qty} · by ${street ? street.name : 'the store'}`, { trap: true, from: name });
    return ord;
  }
  function syServe(ord) {
    const st = sy(); if (st.pack < ord.qty) { toast(`You only have ${st.pack}. ${ord.name} wants ${ord.qty}.`, 'bad'); return false; }
    st.pack -= ord.qty; st.sold += ord.qty; st.served++; earn(ord.pay, `Served ${ord.name}`);
    st.orders = st.orders.filter(o => o !== ord); syCustOff(ord.id);
    text(ord.name, ['good lookin', 'preciate u', 'u just like ur brother', 'bet. ima hit u again', 'ok ok'][Math.floor(Math.random() * 5)], { trap: true, from: ord.name, quiet: true });
    if (st.served % 4 === 0) syMeter('streets', 1);
    if (Math.random() < (st.flags.lookout ? 0.03 : 0.07)) { syMeter('heat', 3, 'Somebody saw that'); }
    toast(`+${money(ord.pay)} from ${ord.name}. ${st.pack} left.`, 'good');
    if (SY.onServe) SY.onServe(ord); save(); return true;
  }
  function syCustOff(id) { const C = SY.cust.get(id); if (!C) return; scene.remove(C.wrap); PEOPLE.dispose(C.P); SY.cust.delete(id); }
  function syStepTrap(dt) {
    const st = sy(); if (!st.on) return;
    // customers show up where they said when you're close
    const [mx, mz] = syMe();
    for (const o of st.orders) {
      const d = Math.hypot(o.x - mx, o.z - mz); let C = SY.cust.get(o.id);
      if (d < 140 && !C) { let sd = o.look; const R = () => (sd = (sd * 16807 + 11) % 2147483647) / 2147483647; R(); const P = PEOPLE.build(Object.assign(PEOPLE.randomLook(R, /^(Shay|Miss Val|Peaches|Coco|Nae)$/.test(o.name)), { mask: 'no_mask' }), 1), wrap = new THREE.Group(); P.root.rotation.y = Math.PI; wrap.add(P.root); wrap.position.set(o.x, 0, o.z); wrap.rotation.y = o.yaw; scene.add(wrap); C = { P, wrap, t: Math.random() * 9 }; SY.cust.set(o.id, C); }
      else if (d > 190 && C) syCustOff(o.id);
      if (C) { C.t += dt; idlePerson(C.P, C.t); if (d < 6) { C.wrap.rotation.y = syYawTo(o.x, o.z, mx, mz); } }
    }
    // the serve button when you walk up to one
    if (!SY.lock && !SY.talk && foot.on && !inside) {
      const o = st.orders.find(o => Math.hypot(o.x - mx, o.z - mz) < 2.6);
      if (o && !o.set) { const el = syUI().talk; if (SY.serveFor !== o.id) { SY.serveFor = o.id; el.innerHTML = `Serve ${esc(o.name)} · ${o.qty} for ${money(o.pay)}<small>E</small>`; el.onclick = () => { if (syServe(o)) { el.classList.remove('on'); SY.serveFor = null; } }; } el.classList.add('on'); SY.serveKey = o; }
      else if (SY.serveFor) { SY.serveFor = null; SY.serveKey = null; syUI().talk.classList.remove('on'); syUI().talk.onclick = () => { if (SY.talk) SY.talk.go(); }; }
    }
    // new texts while you're holding and selling (Tier 1 on); faster on your own block
    if (st.flags.selling && st.pack > 0 && !SY.lock) {
      SY.orderT -= dt * (syInSix(mx, mz) ? 1 : 0.35);
      if (SY.orderT <= 0) { SY.orderT = 40 + Math.random() * 50; syNewOrder(); }
    }
  }
  addEventListener('keydown', e => { if (e.code === 'KeyE' && SY.serveKey && !SY.talk && !SY.lock && foot.on && !menuFn) { const o = SY.serveKey; if (Math.hypot(o.x - foot.x, o.z - foot.z) < 2.8 && syServe(o)) { SY.serveFor = null; SY.serveKey = null; if (SY.el) SY.el.talk.classList.remove('on'); } } });

  // ---------- missions ----------
  // each mission: segments run in order; finishing a segment is a checkpoint (saved). A fail restarts the segment.
  const M = [];
  const mis = (id, tier, label, title, brief, segs, o = {}) => M.push(Object.assign({ id, tier, label, title, brief, segs }, o));
  const misById = id => M.find(m => m.id === id);
  const TIERS = [[0, 'Prologue', 'Release Day'], [1, 'Tier 1', 'Hand to Hand'], [2, 'Tier 2', 'The Trap'], [3, 'Tier 3', 'The Block'], [4, 'Tier 4', 'The Plug'], [5, 'Tier 5', 'The City'], [6, 'Tier 6', 'The Pipeline'], [7, 'Tier 7', 'Murda Worth']];
  const LIVES = [['Kingpin', 'Start', 'Corner to pipeline'], ['Street racing legend', 'Tier 1', 'Win at the Yello Belly'], ['Music mogul', 'Tier 2', "Smoke's tapes at VirL"], ['Car boss', 'Tier 3', 'Rusty or Hollis'], ['Land and cattle', 'Tier 3', 'Call Uncle Bo'], ['Block boss', 'Tier 3', 'Take a block'], ['Informant', 'Tier 5', "Garza's offer"], ['Going straight', 'Any time', 'Pruitt or Pastor Reed']];

  async function syRun(m, from = 0) {
    if (SY.busy) return; const st = sy(); SY.busy = true; SY.act = m; st.m = m.id; st.seg = from; save();
    try {
      for (let i = from; i < m.segs.length; i++) {
        st.seg = i; save();
        for (;;) {
          try { await m.segs[i](m); break; }
          catch (e) {
            if (e && e.syAbort) throw e;
            if (!(e && e.syFail)) { console.warn('story: ' + (e && e.message), e && e.stack); if (SY.err++ > 3) throw e; await syWait(1); continue; }
            syTalkOff(); syMarkerOff(); syObjective(''); unactAll(m.keepCast || []);
            await banner('MISSION FAILED', e.message, true, [['Retry', 1]]);
          }
        }
      }
      st.done.push(m.id); st.m = null; st.seg = 0; save();
      syObjective(''); syMarkerOff(); syTalkOff();
      if (!m.quiet) await banner('MISSION PASSED', m.title);
      const nx = M[M.indexOf(m) + 1];
      if (nx) { st.next = nx.id; st.nextT = nx.delay != null ? nx.delay : 25; }
      else { st.next = null; syObjective(''); text('narr', 'More of the story is coming in the next update.', { quiet: true }); }
      save();
    } catch (e) { if (!(e && e.syAbort)) console.warn('story stopped: ' + (e && e.message), e && e.stack); }
    finally { SY.busy = false; SY.act = null; }
  }
  // between missions: the next one kicks off after a short breather (a call or text pulls you in)
  function syStepFlow(dt) {
    const st = sy(); if (!st.on || SY.busy || SY.lock || creating || !worldOn) return;
    if (st.m) { const m = misById(st.m); if (m) { syRun(m, st.seg || 0); return; } st.m = null; }
    if (st.next) { st.nextT -= dt; if (st.nextT <= 0 && !inside && !PH.open && !menuFn) { const m = misById(st.next); st.next = null; if (m) syRun(m, 0); } }
  }

  // ---------- PROLOGUE: Release Day ----------
  mis('p1', 0, 'Prologue', 'Out', 'Four years in TDCJ. Big Mama is waiting at the bus station.', [
    async () => {
      const bus = sySide(SY_SPOT.bus[0], SY_SPOT.bus[1], 1, 2.4), fx = -Math.sin(bus.yaw), fz = -Math.cos(bus.yaw);
      setTime('day');
      await cut(async () => {
        await syBlack('TDCJ · HUNTSVILLE UNIT<br><span style="opacity:.6;font-size:.8em">6:02 AM · RELEASE DAY</span>', 3.4);
        await lines([['narr', 'Four years. You did every day of it and never said a name.'], ['narr', 'Smoke was supposed to be the one picking you up.']]);
        await syBlack('FORT WORTH · CENTRAL STATION<br><span style="opacity:.6;font-size:.8em">11:40 AM</span>', 2.6);
        // Big Mama's champagne box Chevy at the curb; she's beside it
        loanCar(BUILT[0], '#cbb994', 62); spawnFoot(bus.x, bus.z, bus.yaw); deliverCar();
        const ca = foot.park || { x: bus.x, z: bus.z, yaw: 0 }; placeMe(foot.x - fz * 9, foot.z + fx * 9, bus.yaw);
        actor('mama', ca.x + (foot.x - ca.x) * 0.18 + fx * 0.2, ca.z + (foot.z - ca.z) * 0.18 + fz * 0.2, 0); face('mama', foot.x, foot.z); face('me', SY.actors.get('mama').x, SY.actors.get('mama').z);
        await syUnblack();
        wide(foot.x, foot.z, foot.yaw + Math.PI * 0.75, 16, 6); await syWait(2.2);
        syTitle('', 'MURDA WORTH', 'The story of ' + (S.name || 'you'), 3);
        await walkTo('me', SY.actors.get('mama').x + Math.sin(foot.yaw) * 1.1, SY.actors.get('mama').z + Math.cos(foot.yaw) * 1.1);
        faceEach('me', 'mama'); ots('me', 'mama'); syName('mama');
        await lines([['mama', 'Look at you. Look at you! Come here, baby.'], ['mama', 'You got so skinny. They wasn\'t feeding you in there?']]);
        close('me'); await say('me', 'Hey, Big Mama.');
        ots('mama', 'me', -1); await say('mama', 'I know you was looking for your brother.');
        SY.actors.get('mama').pose = 'sad'; close('mama', -1);
        await lines([['mama', 'I didn\'t want to tell you on the phone. Not in there.'], ['mama', 'Smoke is gone, baby. Last Saturday. Out at that drag strip.']]);
        const i = await choose([{ t: 'What happened?', tone: 'calm' }, { t: 'Who did it?', tone: 'cold', d: { streets: 2 } }, { t: '(Say nothing. Hold her.)', tone: 'quiet', d: { family: 3 } }], { timer: 14 });
        SY.actors.get('mama').pose = null;
        if (i === 2) { two('me', 'mama'); await say('mama', 'I know. I know.'); }
        ots('me', 'mama');
        await lines([['mama', 'Police say his car came apart at a hundred and sixty. Say it was an accident.'], ['mama', i === 1 ? 'Don\'t you start that. Don\'t you dare start that, not today.' : 'Smoke drove like he was born in a car. Mm-mm. I don\'t know.'], ['mama', 'Funeral is tomorrow at Greater Stop Six. Now drive your grandmama home. My knees are done.']]);
        syNote('Smoke died last Saturday at Ironline Dragway. Police say his car came apart at 160 mph. Big Mama doesn\'t believe it.');
        unactor('mama');
      });
      if (!S.car || !S.car.loaner) loanCar(BUILT[0], '#cbb994', 62);
    },
    async () => {
      // the drive home, Big Mama riding with you, talking
      const h = spot('mama', 1, 2.6);
      if (foot.on && foot.park && Math.hypot(foot.x - foot.park.x, foot.z - foot.park.z) > 40) { deliverCar(); }
      if (foot.on && !foot.park) deliverCar();
      setPin(h.name, h.x, h.z); syMarkerOff();
      await syUntil(() => driving && !foot.on, 'Get in Big Mama\'s car', 'Prologue · Out');
      setPin(h.name, h.x, h.z);
      const chat = (async () => {
        await syWait(3);
        await lines([['mama', 'Turn your music down, I ain\'t deaf yet. Well. Not all the way.'], ['mama', 'Mook been by the house every day this week. Every day. He don\'t say much.'],
          ['mama', 'And that Hollis man, from the car lot? He sent flowers. Big ones. Said he sponsored Smoke at the races.'], ['me', 'Smoke didn\'t race for no sponsor.'],
          ['mama', 'That\'s what I said.'], ['mama', 'Your room is how you left it. I ain\'t touched nothing but the dust.'], ['mama', 'And you go see your parole officer Monday. Officer Pruitt. Don\'t make me come down there.']]);
      })();
      await reach(h.x, h.z, 16, h.name, { obj: 'Drive Big Mama home to Stop Six', pin: h.name });
      await chat;
    },
    async () => {
      const h = spot('mama', 1, 2.6);
      await cut(async () => {
        drv.v = 0; if (!foot.on) getOut();
        const P = foot.park || { x: foot.x, z: foot.z, yaw: 0 };
        actor('mama', P.x + Math.cos(P.yaw) * 2.1, P.z - Math.sin(P.yaw) * 2.1, 0); face('mama', h.x, h.z);
        wide(h.x, h.z, h.yaw + Math.PI, 13, 4.5); await syWait(1.5);
        await walkTo('mama', h.x, h.z); face('mama', foot.x, foot.z); faceEach('me', 'mama');
        await walkTo('me', h.x + Math.sin(h.yaw) * 1.6, h.z + Math.cos(h.yaw) * 1.6); faceEach('me', 'mama');
        two('me', 'mama', 1, 3.6);
        await lines([['mama', 'I\'m keeping the keys. You ain\'t got no license no more, remember?'], ['mama', 'Go walk the block. Let people see you. Then come in and eat.'], ['mama', 'And baby... stay away from that corner.']]);
        syMeet('mama'); unactor('mama');
      });
      endLoan(); syFlag('home', 1);
      text('mama', 'Plate in the microwave. 2 min. Love you');
    },
  ], { label: 'Prologue · Out' });

  mis('p2', 0, 'Prologue', 'Stop Six', 'Walk the block. Everybody knew Smoke.', [
    async () => {
      syFlag('mural', 1); syMural();
      const og = sySide(1540, -238, 1, 2.6); actor('og', og.x, og.z, og.yaw + Math.PI);
      await talkTo('og', 'Talk to', { obj: 'Walk the block: talk to Mr. Earl on his porch', pin: 'Mr. Earl' });
      await cut(async () => {
        faceEach('me', 'og'); ots('me', 'og'); syName('og');
        await lines([['og', 'Well I\'ll be. Lil Smoke! They let you out.'], ['me', 'Yes sir. This morning.'], ['og', 'Your brother used to cut my grass for five dollars. Then he was paying MY light bill.'],
          ['og', 'Whole block came up off that boy. Now look.'], ['og', 'Go see the wall at Tre\'s. They painting him.']]);
      });
      unactor('og');
    },
    async () => {
      const p = DATA.P.find(x => x.id === 'plug') || { x: 1915, z: -143, face: 0 }, [ox, oz] = outDir(p), tx = -oz, tz = ox;
      const wx = p.x + ox * 5 + tx * 6.5, wz = p.z + oz * 5 + tz * 6.5;
      actor('tre', p.x + ox * 2.4 + tx * 2, p.z + oz * 2.4 + tz * 2, Math.atan2(-ox, -oz) + Math.PI);
      await reach(wx, wz, 7, 'Smoke\'s mural at Lil Tre\'s', { obj: 'See Smoke\'s mural at Lil Tre\'s Corner Store', foot: true });
      await cut(async () => {
        placeMe(wx, wz, syYawTo(wx, wz, SY.mural ? SY.mural.position.x : p.x, SY.mural ? SY.mural.position.z : p.z));
        const mp = SY.mural ? SY.mural.position : new THREE.Vector3(p.x, 2, p.z);
        shot([wx + ox * 4, 1.7, wz + oz * 4], [mp.x, 2.2, mp.z], { to: [wx + ox * 2.4, 1.9, wz + oz * 2.4], dur: 8 });
        await lines([['narr', 'REST EASY SMOKE. Half of it is still primer.'], ['me', '...Should\'ve been me picking you up.']]);
        face('tre', foot.x, foot.z); await walkTo('tre', foot.x + tx * 1.6, foot.z + tz * 1.6); faceEach('me', 'tre');
        two('me', 'tre', -1, 3.4); syName('tre');
        await lines([['tre', 'They ran out of paint money. Artist said he\'ll finish when somebody pay him.'], ['tre', 'Ay. You know Mook been looking for you. Said tomorrow, at the church, he got something for you.']]);
        unactor('tre');
      });
      syNote('A mural of Smoke is half painted on Lil Tre\'s Corner Store. The artist needs money to finish it.');
    },
  ], { label: 'Prologue · Stop Six', delay: 6 });

  mis('p3', 0, 'Prologue', 'The Funeral', 'Greater Stop Six Baptist. Everybody who mattered to Smoke, and some who shouldn\'t be there.', [
    async () => {
      const ch = sySide(SY_SPOT.church[0] + 8, SY_SPOT.church[1] + 13, 1, 3.2);
      await call('mama', [['mama', 'Service starts in a hour. Wear something with a collar if you got it.'], ['mama', 'Meet me out front of the church.']], { mustAnswer: true });
      await reach(ch.x, ch.z, 12, SY_SPOT.church[2], { obj: 'Go to Smoke\'s funeral at Greater Stop Six Baptist', foot: true });
    },
    async () => {
      const ch = sySide(SY_SPOT.church[0] + 8, SY_SPOT.church[1] + 13, 1, 3.2), fx = -Math.sin(ch.yaw), fz = -Math.cos(ch.yaw), rx = Math.cos(ch.yaw), rz = -Math.sin(ch.yaw);
      await cut(async () => {
        setTime('sunset');
        const at = (k, s) => [ch.x - fx * k + rx * s, ch.z - fz * k + rz * s];
        placeMe(...at(1.2, 0), ch.yaw);
        const P = [['pastor', 4.2, 0], ['mama', 1.6, -1.4], ['mook', 0.4, 2.2], ['nia', 2.6, 3.4], ['rusty', 0.8, -3.2], ['hollis', 3, -4.4]];
        for (const [w, k, s] of P) { const q = at(k, s); actor(w, q[0], q[1], 0); }
        for (const [w] of P) if (w !== 'pastor') face(w, ...at(4.2, 0)); face('pastor', foot.x, foot.z); face('me', ...at(4.2, 0));
        SY.actors.get('mama').pose = 'sad';
        shot([ch.x + fx * 9, 3.2, ch.z + fz * 9], [ch.x, 2, ch.z], { to: [ch.x + fx * 6, 2.4, ch.z + fz * 6], dur: 9 });
        syTitle('PROLOGUE', 'THE FUNERAL', 'Darius "Smoke" Washington · 1998 – 2026', 3.4); await syWait(3.4);
        close('pastor'); syName('pastor');
        await lines([['pastor', 'Darius was a hard-headed boy. I can say that, because I baptized him twice. The first one didn\'t take.'], ['pastor', 'But that boy fed this block. Some of you are sitting here today because of him, and you know it.'], ['pastor', 'Grief is love with nowhere to go. Don\'t give it to the streets. Give it to the Lord, or give it to your family.']]);
        close('hollis', 1, 2); syName('hollis');
        await lines([['hollis', 'If I may, Pastor. Just a word.'], ['hollis', 'Darius raced under the Hollis Motors banner. He was the fastest man I ever saw on that strip.'], ['hollis', 'Mrs. Washington, the Hollis family is covering every cost today. Every one.']]);
        await walkTo('hollis', SY.actors.get('mama').x - fx * 0.9, SY.actors.get('mama').z - fz * 0.9); faceEach('hollis', 'mama'); SY.actors.get('mama').pose = null;
        two('hollis', 'mama', 1, 3); await lines([['narr', 'He presses a thick envelope into Big Mama\'s hands.'], ['mama', '...Thank you, Mr. Hollis.']]);
        face('hollis', foot.x, foot.z); ots('me', 'hollis');
        await say('hollis', 'You must be the little brother. I\'ve heard about you. Kept your mouth shut four years. That\'s rare.');
        const i = await choose([{ t: 'Thank you for the flowers.', tone: 'polite', d: { family: 2 } }, { t: 'Smoke never mentioned you.', tone: 'cold', d: { streets: 2 } }, { t: '(Stare at him.)', tone: 'silent' }], { timer: 10 });
        syFlag('hollis1', i);
        close('hollis', -1, 1.8); await say('hollis', i === 1 ? 'He didn\'t mention a lot of things. Come see me at the dealership sometime.' : i === 2 ? 'Alright then. Come see me at the dealership sometime.' : 'Of course. Come see me at the dealership sometime. Hollis Motors.');
        unactor('hollis'); unactor('pastor');
        syMeet('rusty'); two('me', 'rusty', -1); await lines([['rusty', 'I built every car your brother ever drove. That one didn\'t come apart by itself.'], ['rusty', 'Not here. Come by the lot when you got wheels on your mind.']]); syName('rusty');
        face('nia', foot.x, foot.z); ots('me', 'nia'); syName('nia'); await lines([['nia', 'I\'m Nia. I shot all of Smoke\'s runs for my page.'], ['nia', 'I\'m sorry. For real. If you ever want to see them... you know where to find me. Throttle.']]);
        face('mook', foot.x, foot.z); faceEach('me', 'mook'); await walkTo('mook', foot.x + rx * 1.1, foot.z + rz * 1.1); faceEach('me', 'mook'); two('me', 'mook', 1, 3); syName('mook');
        await lines([['mook', 'Bro.'], ['me', 'Mook.'], ['mook', 'He made me promise. If anything happened, I give you this. Nobody else.'], ['narr', 'Mook slides an old cracked phone into your hand. Smoke\'s phone.'],
          ['mook', 'It\'s been ringing all week. People still need what he had.'], ['mook', 'You ain\'t gotta do nothing with it. But it\'s yours now.']]);
        syNote('Rusty says Smoke\'s car didn\'t come apart by itself. Hollis paid for the funeral. Mook gave you Smoke\'s phone.');
        unactAll();
        await syBlack('', 1.2); setTime('night'); await syUnblack();
        await syTitle('TIER 1', 'HAND TO HAND', 'Stop Six · the corner', 3.6);
      });
      sy().tier = 1; save();
    },
  ], { label: 'Prologue · The Funeral', delay: 30 });

  // ---------- TIER 1: Hand to Hand ----------
  mis('t1', 1, 'Tier 1', "Smoke's Phone", 'The phone keeps buzzing. Smoke\'s customers don\'t know he\'s gone, or don\'t care.', [
    async () => {
      syFlag('trapPhone', 1);
      text('Unc', 'smoke u up? been 2 weeks', { trap: true, from: 'Unc' }); await syWait(5);
      text('Miss Val', 'baby i heard. so sorry. who got his phone now?', { trap: true, from: 'Miss Val' }); await syWait(4);
      text('Bird', 'somebody answer this phone fr', { trap: true, from: 'Bird' }); await syWait(3);
      await call('mook', [['mook', 'You see it? Phone been jumping all day, huh.'], ['mook', 'Them his people. They gon\' go to somebody. Might as well be us.'], ['mook', 'Meet me at Tre\'s. I\'m out front.']], { mustAnswer: true });
    },
    async () => {
      const p = DATA.P.find(x => x.id === 'plug') || { x: 1915, z: -143, face: 0 }, [ox, oz] = outDir(p);
      actor('mook', p.x + ox * 3 - oz * 3, p.z + oz * 3 + ox * 3, Math.atan2(-ox, -oz) + Math.PI);
      await talkTo('mook', 'Talk to', { obj: 'Meet Mook at Lil Tre\'s Corner Store', pin: 'Mook' });
      await cut(async () => {
        faceEach('me', 'mook'); two('me', 'mook', 1, 3.4);
        await lines([['mook', 'I been holding this since the funeral.'], ['narr', 'He shows you a small zipped bag. Ten.'], ['mook', 'Smoke fronted me this the day before. I owe him. So now I owe you.']]);
        ots('me', 'mook');
        const i = await choose([{ t: 'Put me on. I need money.', tone: 'hungry', d: { streets: 3, loyalty: 3 } }, { t: 'I just got out. I\'m trying to stay out.', tone: 'careful', d: { family: 3 } }, { t: 'What did Smoke owe, and who to?', tone: 'sharp' }], { timer: 14 });
        syFlag('t1choice', i);
        if (i === 1) { close('mook'); await lines([['mook', 'I hear you. For real.'], ['mook', 'But Big Mama light bill due Friday, and she ain\'t gon\' tell you. Just hold it. Ten serves and you good for a minute.']]); }
        else if (i === 2) { close('mook'); await lines([['mook', '...You always been the smart one.'], ['mook', 'I don\'t know all of it. But he owed somebody big in Oak Cliff. That\'s all I know. Serve these first.']]); syNote('Smoke owed somebody big in Oak Cliff.'); }
        else { close('mook'); await lines([['mook', 'That\'s my dawg. Smoke said you was a natural.']]); }
        await lines([['mook', 'Phone tells you who and where. You walk up, hand to hand, you walk off. Don\'t stand around.'], ['mook', 'And don\'t serve nobody you don\'t know. Not yet.']]);
      });
      sy().pack += 10; syFlag('selling', 1); save();
      toast('Mook fronted you 10. Smoke\'s customers will text the trap phone.', 'good');
    },
  ], { label: 'Tier 1 · Smoke\'s Phone', delay: 40 });

  mis('t2', 1, 'Tier 1', 'First Pack', 'Three of Smoke\'s regulars want to see you. Meet them, serve them, don\'t linger.', [
    async () => {
      const st = sy(); if (st.pack < 6) st.pack = 10;
      st.orders = st.orders.filter(o => !o.set);
      const want = [['Unc', [1722, -293], 2, 'u got me? by the taco truck'], ['Miss Val', [1440, -238], 1, 'baby bring it to the house by your grandma'], ['Bird', [1915, -143], 3, 'at tres. hurry']];
      for (const [n, at, q, m] of want) { if (st.orders.length >= 3) st.orders.shift(); syNewOrder({ name: n, at, qty: q, msg: m }); await syWait(1.2); }
      const start = st.served;
      await syUntil(() => sy().served - start >= 3 || (sy().orders.length === 0 && sy().served > start), 'Serve Smoke\'s customers on the trap phone (open Trap to see where)');
    },
    async () => {
      await call('mook', [['mook', 'Ayy, Unc already called me talking about "Lil Smoke got the same stuff." You good.'], ['mook', 'Keep the phone on. They\'ll keep coming. Bring me my half later, no rush.']]);
      syMeter('streets', 3, 'Word is out'); syNote('You\'re serving Smoke\'s old customers. The block calls you Lil Smoke.');
    },
  ], { label: 'Tier 1 · First Pack', delay: 20 });

  mis('t3', 1, 'Tier 1', 'Wheels', 'You can\'t run a corner on foot forever. Rusty said come by the lot.', [
    async () => {
      await call('rusty', [['rusty', 'It\'s Rusty. Got a box Chevy here. Ugly, slow, runs forever. Smoke\'s first car looked just like it.'], ['rusty', 'Eighteen hundred. Come look. Rusty\'s Used Autos, off Rosedale.']], { mustAnswer: true });
      const r = DATA.P.find(x => x.id === 'rusty_used') || { x: SY_SPOT.rusty[0], z: SY_SPOT.rusty[1], face: 0 }, [ox, oz] = outDir(r);
      actor('rusty', r.x + ox * 4, r.z + oz * 4, Math.atan2(ox, oz));
      await talkTo('rusty', 'Talk to', { obj: 'Go see Rusty at Rusty\'s Used Autos (take a Ryde, walk or drive)', pin: "Rusty's Used Autos" });
    },
    async () => {
      const R = SY.actors.get('rusty') || (() => { const r = DATA.P.find(x => x.id === 'rusty_used'), [ox, oz] = outDir(r); return actor('rusty', r.x + ox * 4, r.z + oz * 4, 0); })();
      let buy = 0;
      await cut(async () => {
        faceEach('me', 'rusty'); two('me', 'rusty', -1, 3.4);
        await lines([['rusty', 'There he is.'], ['rusty', 'Box Chevy. 350 small block. Somebody painted it with a broom but she\'ll fire up every time.']]);
        ots('me', 'rusty');
        await lines([['me', 'You said Smoke\'s car didn\'t come apart by itself.'], ['rusty', '...Rear end let go. Axle tubes. I welded that rear myself. Those welds don\'t fail.'], ['rusty', 'The car they brought back had bolts on it that wasn\'t mine. Somebody was under that car. That\'s all I\'m saying out loud.']]);
        syNote('Rusty: Smoke\'s rear axle failed, but the bolts on it weren\'t his. Someone was under that car.');
        close('rusty'); await say('rusty', 'Now. You buying or you looking?');
        buy = await choose([{ t: `Buy the box Chevy (${money(1800)})`, tone: 'buy' }, { t: 'Not yet. I\'ll be back with the money.', tone: 'later' }], { timer: 16 });
      });
      if (buy === 0 && S.cash >= 1800) {
        spend(1800, 'Box Chevy from Rusty');
        const c = newCar(BUILT[0], '#6b6f5a', 58); c.fuel = 0.5; if (S.car && !S.car.loaner) S.garage.push(S.car); S.car = c; syncCarModel(); deliverCar(); save();
        toast('The box Chevy is yours. It\'s parked out front.', 'good');
      } else {
        if (buy === 0) toast(`You have ${money(S.cash)}. Rusty wants ${money(1800)}.`, 'bad');
        await syUntil(() => S.cash >= 1800, `Get ${money(1800)} for the box Chevy (serve customers, Hustle jobs)`);
        await talkTo('rusty', 'Buy the box Chevy from', { obj: 'Go back to Rusty and buy the box Chevy', pin: "Rusty's Used Autos" });
        spend(1800, 'Box Chevy from Rusty'); const c = newCar(BUILT[0], '#6b6f5a', 58); c.fuel = 0.5; if (S.car && !S.car.loaner) S.garage.push(S.car); S.car = c; syncCarModel(); deliverCar(); save();
        toast('The box Chevy is yours. It\'s parked out front.', 'good');
      }
      await syWait(1);
      await cut(async () => { faceEach('me', 'rusty'); close('rusty'); await lines([['rusty', 'Bring her back when you want her faster. And keep your head on a swivel. Whoever was under Smoke\'s car is still out here.']]); });
      unactor('rusty'); syMeter('streets', 2, 'You got wheels');
    },
  ], { label: 'Tier 1 · Wheels', delay: 45 });

  mis('t4', 1, 'Tier 1', 'Light Bill', 'Big Mama won\'t say it, but the lights are about to get cut off.', [
    async () => {
      text('mama', 'Baby come home when u can. need to talk to u');
      const h = spot('mama', 1, 2.6); actor('mama', h.x, h.z, h.yaw + Math.PI);
      await talkTo('mama', 'Talk to', { obj: 'Go home to Big Mama', pin: "Big Mama's house" });
      await cut(async () => {
        faceEach('me', 'mama'); two('me', 'mama', 1, 3.2);
        await lines([['mama', 'Oncor sent the pink letter. Three hundred and twelve dollars by Friday or they cut it.'], ['mama', 'Smoke always took care of it. I didn\'t even know it was due.'], ['mama', 'I ain\'t asking you. I\'m just telling you so you don\'t get surprised when it\'s dark.']]);
      });
    },
    async () => {
      await syUntil(() => S.cash >= 312, `Get ${money(312)} for Big Mama's light bill`);
      await talkTo('mama', 'Give money to', { obj: `Give Big Mama ${money(312)}` });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'mama'); ots('me', 'mama');
        await say('mama', 'Where did you get this?');
        i = await choose([{ t: 'Rusty got me some work at the lot.', tone: 'lie', d: { family: 2 } }, { t: 'Same place Smoke got it.', tone: 'truth', d: { family: -4, streets: 2 } }, { t: 'Don\'t worry about it, Big Mama.', tone: 'dodge' }], { timer: 14 });
        syFlag('lightLie', i);
        if (i === 0) { close('mama'); await lines([['mama', 'Mm. Rusty a good man.'], ['narr', 'She doesn\'t look at you when she says it.']]); }
        else if (i === 1) { close('mama'); await lines([['mama', '...'], ['mama', 'I buried one grandbaby this week.'], ['mama', 'I will take this money because the lights need to be on. But I won\'t thank you for it.']]); }
        else { close('mama'); await lines([['mama', 'I been worrying about Washington men my whole life. Don\'t tell me not to worry.']]); }
      });
      spend(312, 'Big Mama\'s light bill'); syMeter('family', i === 1 ? 0 : 3, 'Lights stay on');
      if (i === 1) syNote('You told Big Mama the truth about the money. She took it, but she\'s hurt.');
      unactor('mama');
    },
  ], { label: 'Tier 1 · Light Bill', delay: 50 });

  mis('t5', 1, 'Tier 1', 'Pull Up', 'Throttle says the whole east side is outside on East Lancaster tonight. Smoke\'s little brother showing up would be news.', [
    async () => {
      text('throttle', 'TONIGHT 🚨 East Lancaster runs. All the east side outside. Pull up.');
      await syWait(3); text('nia', 'You coming tonight? People asking if Lil Smoke can drive lol');
      await syUntil(() => !!S.car, 'Get a car (Rusty\'s box Chevy, Marketplace, or your garage)');
      setTime('night');
      const L = DATA.P.find(x => x.id === 'ironside_start') || { x: SY_SPOT.lancaster[0], z: SY_SPOT.lancaster[1] };
      await reach(L.x, L.z, 24, 'East Lancaster Runs', { obj: 'Pull up to East Lancaster Runs' });
    },
    async () => {
      const L = DATA.P.find(x => x.id === 'ironside_start') || { x: SY_SPOT.lancaster[0], z: SY_SPOT.lancaster[1], face: 0 };
      let i = 0;
      await cut(async () => {
        const s = sySide(L.x + 10, L.z, 1, 2.4); actor('nia', s.x, s.z, 0); actor('mook', s.x + 2, s.z + 1.4, 0);
        placeMe(s.x - Math.sin(s.yaw) * 0.1 + Math.cos(s.yaw) * 2, s.z + 2.2, 0); face('nia', foot.x, foot.z); face('mook', foot.x, foot.z); faceEach('me', 'nia'); SY.actors.get('nia').pose = 'phone';
        wide(s.x, s.z, s.yaw + Math.PI, 15, 5); await syWait(2);
        two('me', 'nia', 1, 3.6); await lines([['nia', 'He pulled up! I\'m going live. Don\'t embarrass me.'], ['mook', 'Everybody watching, bro. Whatever you do out here, they gon\' remember it.']]);
        ots('me', 'nia');
        i = await choose([{ t: 'Win loud. Let everybody know I\'m home.', tone: 'loud', d: { streets: 4, heat: 2 } }, { t: 'Keep it lowkey. Lose if I have to.', tone: 'lowkey' }], { timer: 12 });
        syFlag('pullup', i); SY.actors.get('nia').pose = null;
        close('mook'); await say('mook', i === 0 ? 'That\'s what I\'m talking about.' : 'Smart. Let \'em sleep on you.');
        unactor('nia'); unactor('mook');
      });
      const w0 = S.streetWins || 0, r0 = S.streetRuns || 0;
      await syUntil(() => (S.streetRuns || 0) > r0, 'Run a roll race here (pull into the spot and pick a racer)');
      const won = (S.streetWins || 0) > w0; syFlag('pullWon', won ? 1 : 0);
      if (won) { syMeter('streets', i === 0 ? 4 : 2, 'Throttle is going crazy'); text('throttle', `LIL SMOKE IS HOME 🔥🔥 just pulled ${['a Hellcat', 'a Scat', 'a built Camaro'][Math.floor(Math.random() * 3)]} on Lancaster`); syNote('You won on East Lancaster. Throttle posted it. Somebody important will see that.'); }
      else { text('throttle', 'Lil Smoke got WAXED on Lancaster lmao. not his brother'); if (i === 1) syMeter('heat', -2, 'Nobody worried about you'); }
      await syWait(4); text('nia', won ? 'Clip got 40k views in a hour. You famous now. Be careful.' : 'Honestly? Smart. Nobody looking at you now.');
    },
  ], { label: 'Tier 1 · Pull Up', delay: 60 });

  mis('t6', 1, 'Tier 1', 'Set Up', 'A new number. Big order. Smoke would have said don\'t. Mook said don\'t.', [
    async () => {
      const st = sy(); if (st.pack < 5) st.pack = 5; save();
      const ord = syNewOrder({ name: 'New number', at: [1780, -560], qty: 5, pay: 400, msg: 'Bird gave me this number. need 5. got $400. park on the corner' });
      if (ord) ord.set = true; save();
      await syUntil(() => { const o = sy().orders.find(o => o.set); return !o || Math.hypot(o.x - syMe()[0], o.z - syMe()[1]) < 9; }, 'A new number wants 5 for $400 by the park. (Mook said don\'t serve people you don\'t know.)');
    },
    async () => {
      const st = sy(), o = st.orders.find(o => o.set) || { x: 1780, z: -560, yaw: 0, qty: 5, pay: 400 };
      let i = 0;
      await cut(async () => {
        syCustOff(o.id); st.orders = st.orders.filter(x => x !== o);
        placeMe(o.x + 2.5, o.z + 2.5, 0); actor('robber', o.x, o.z, 0); face('robber', foot.x, foot.z); face('me', o.x, o.z);
        actor('robber2', foot.x - 5, foot.z + 4, 0);
        ots('me', 'robber'); await say('robber', 'You Lil Smoke? You got it?');
        await walkTo('robber2', foot.x - 1.2, foot.z + 1.1, 1); face('robber2', foot.x, foot.z);
        shot([foot.x + 3, 1.6, foot.z - 2], [foot.x, 1.3, foot.z], { shake: 0.04, dur: 4 }); SY.actors.get('robber').pose = 'hands';
        await lines([['robber2', 'Run that. All of it. Phone too. Don\'t look at me.'], ['narr', 'They take the pack, your cash and the trap phone, and they\'re gone up Stalcup.']]);
        const took = Math.min(S.cash, 600); S.cash -= took; st.pack = 0; st.flags.robbedFor = took; refreshStats();
        unactor('robber'); unactor('robber2');
        close('me'); await say('me', '...');
        await syWait(0.5); syUI().choice; await syBlack('', 0.8); await syUnblack();
        close('me', -1);
        i = await choose([{ t: 'Let it go. Lesson learned.', tone: 'let it go', d: { heat: -2, streets: -4 } }, { t: 'Get it back. Find out who they are.', tone: 'get it back', d: { streets: 3, loyalty: 2 } }, { t: 'Make an example out of them.', tone: 'example', d: { streets: 6, heat: 8 } }], { timer: 16, q: 'They just robbed you on your own block.' });
        syFlag('robbed', i);
      });
      save();
    },
    async () => {
      const i = syFlag('robbed') || 0, st = sy();
      if (i === 0) {
        await call('mook', [['mook', 'Bird said some Northside boys got his number off his phone. That was a set up.'], ['mook', 'You right to let it go. For now. I got you another 8 till you get on your feet.']]);
        st.pack += 8; syNote('You got robbed by people with Bird\'s number. You let it go. The block noticed.');
      } else {
        await call('mook', [['mook', 'It was them Northside boys. They at the Riverside Mini Mart right now laughing about it.'], ['mook', i === 2 ? 'If you doing this, you doing it all the way. Everybody gon\' know.' : 'I\'m on my way. Don\'t go in by yourself.']]);
        const r = DATA.P.find(x => x.id === 'corner_riverside') || { x: 463, z: -225, face: 0 }, [ox, oz] = outDir(r), s = { x: r.x + ox * 3.2, z: r.z + oz * 3.2 };
        actor('robber', s.x, s.z, Math.atan2(-ox, -oz) + Math.PI); actor('robber2', s.x + 1.3, s.z + 0.6, Math.atan2(-ox, -oz) + Math.PI); actor('mook', s.x + ox * 14, s.z + oz * 14, 0);
        await talkTo('robber', 'Run up on', { obj: 'Find the guys who robbed you at the Riverside Mini Mart', pin: 'Riverside Mini Mart', r: 3.6 });
        await cut(async () => {
          face('mook', foot.x, foot.z); await walkTo('mook', foot.x + 1.2, foot.z + 1.2, 1);
          faceEach('me', 'robber'); face('robber2', foot.x, foot.z); ots('me', 'robber');
          if (i === 1) {
            await lines([['me', 'Y\'all took something from me.'], ['robber', 'Man, we ain\'t—'], ['mook', 'Don\'t lie to him. Bird already told on y\'all.'], ['narr', 'It doesn\'t take long. They hand back the phone and most of the cash.']]);
            S.cash += Math.round((st.flags.robbedFor || 0) * 0.8); refreshStats();
          } else {
            shot([foot.x + 4, 2.2, foot.z + 3], [foot.x, 1.2, foot.z], { shake: 0.06, dur: 3 });
            await lines([['narr', 'You don\'t say anything. You don\'t have to.'], ['narr', 'By the time it\'s over, half the parking lot has it on their phones.'], ['mook', 'Bro. BRO. We gotta go. Now.']]);
            S.cash += (st.flags.robbedFor || 0); refreshStats(); syFlag('example', 1);
          }
          unactor('robber'); unactor('robber2'); close('mook'); await say('mook', 'Here. Another 8 so you ain\'t empty.'); unactor('mook');
        });
        st.pack += 8; syNote(i === 2 ? 'You made an example out of the Northside boys who robbed you. It\'s all over Throttle. Heat is up.' : 'You and Mook got your money back from the Northside boys who robbed you.');
        if (i === 2) { S.heat = Math.min(5, (S.heat || 0) + 2); text('throttle', 'Somebody got DEALT WITH at Riverside Mini Mart tonight 😳 they saying it was Lil Smoke'); }
      }
      syFlag('rule1', 1); save();
    },
  ], { label: 'Tier 1 · Set Up', delay: 70 });

  mis('t7', 1, 'Tier 1', 'Flashback: Same Corner', 'Twelve years ago. Smoke\'s first day on the same corner. You were ten, watching from Big Mama\'s porch.', [
    async () => {
      await syUntil(() => foot.on && syInSix(foot.x, foot.z), 'Walk around Stop Six (a memory is coming back)');
      const s0 = Object.assign({}, S.look), w0 = Object.assign({}, S.wear), st = sy();
      st.flags.flashBack = { look: s0, wear: w0 }; save();
      await cut(async () => {
        await syBlack('<span style="font-size:.8em;opacity:.7">STOP SIX · 2014</span>', 2.2);
        const L = syLook('smoke'); S.look = Object.assign({}, S.look, { body: 'm', skin: L.skin, hair: L.hair, hairStyle: 'short_afro', facialHair: 'none', build: 1, height: 1, face: L.face, extras: [] }); S.wear = Object.assign({}, S.wear, { top: 'tee_white', bottom: 'jeans_blue', shoes: 'kicks_white', hat: 'cap_red' }); dressAvatar(); if (foot.holder) wearMe(foot.holder);
        SY.flash = true; document.body.classList.add('sy-flash'); setTime('day');
        const c = spot('corner', 1, 2.6); placeMe(c.x, c.z, c.yaw);
        actor('mook', c.x + 1.6, c.z + 0.8, 0); face('mook', c.x, c.z); actor('mama', c.x + 30, c.z + 4, 0);
        await syUnblack();
        wide(c.x, c.z, c.yaw + Math.PI * 0.8, 12, 4); await syWait(1.5);
        two('me', 'mook', 1, 3.2);
        await lines([['narr', 'You are Smoke. Fifteen. Big Mama thinks you\'re at basketball practice.'], ['mook', 'You sure about this, D?'], ['me', 'Mama\'s gas got cut off. I\'m sure.']]);
      }, { keepFlash: true });
    },
    async () => {
      const c = spot('corner', 1, 2.6), st = sy();
      if (!SY.actors.get('mook')) actor('mook', c.x + 1.6, c.z + 0.8, 0);
      const keep = st.orders; st.orders = [];
      const o1 = syNewOrder({ name: 'Mr. Earl', at: [c.x + 40, c.z + 10], qty: 1, pay: 20, msg: 'young man come here' }), o2 = syNewOrder({ name: 'Shay', at: [c.x - 50, c.z - 20], qty: 1, pay: 20, msg: 'u D? come on' });
      const p0 = st.pack; st.pack = 2; const n0 = st.served;
      await syUntil(() => sy().served - n0 >= 2, 'As Smoke: serve your first two customers');
      st.pack = p0; st.orders = keep.concat(st.orders.filter(o => o !== o1 && o !== o2)); save();
      await cut(async () => {
        placeMe(c.x, c.z, c.yaw); actor('mama', c.x + 18, c.z + 6, 0); face('mama', c.x, c.z); face('me', c.x + 18, c.z + 6);
        shot([c.x + 22, 1.6, c.z + 8], [c.x, 1.4, c.z], { to: [c.x + 20, 1.6, c.z + 7], dur: 6 });
        await lines([['narr', 'Big Mama is standing at the end of the block. She saw everything.'], ['mama', 'Darius.'], ['mama', 'Get your little brother off that porch. He been watching you all day.']]);
        close('me', -1); await lines([['me', 'Yes ma\'am.'], ['narr', 'He never stopped. And you never stopped watching.']]);
        await syBlack('', 1.4);
        const B = sy().flags.flashBack; if (B) { S.look = B.look; S.wear = B.wear; delete sy().flags.flashBack; dressAvatar(); if (foot.holder) wearMe(foot.holder); }
        SY.flash = false; document.body.classList.remove('sy-flash'); unactAll(); setTime('night');
        await syUnblack();
      });
      syNote('Smoke started on the same corner at 15 to pay Big Mama\'s gas bill. She knew.');
    },
  ], { label: 'Tier 1 · Flashback', delay: 80, onLoad: () => { const B = sy().flags.flashBack; if (B && !SY.lock) { /* resumed mid flashback: keep it */ } } });

  mis('t8', 1, 'Tier 1', "Big Lou's People", 'A black G-Wagon has been parked outside Big Mama\'s for an hour.', [
    async () => {
      text('mama', 'theres a big black truck been sitting outside the house. you know them?');
      const h = spot('mama', 1, 2.6); actor('dre', h.x + 8, h.z, h.yaw + Math.PI);
      await talkTo('dre', 'Talk to', { obj: 'Go home. Somebody is waiting outside Big Mama\'s.', pin: "Big Mama's house" });
    },
    async () => {
      const A = SY.actors.get('dre') || actor('dre', ...spot('mama').x ? [spot('mama').x + 8, spot('mama').z, 0] : [0, 0, 0]);
      let i = 0;
      await cut(async () => {
        faceEach('me', 'dre'); ots('me', 'dre'); syName('dre');
        await lines([['dre', 'You the brother.'], ['dre', 'Big Lou sends his love. And his condolences. And this.'], ['narr', 'He holds up his phone. A ledger. "D — 40,000."']]);
        close('dre', 1, 1.8);
        await lines([['dre', 'Smoke took forty on consignment two days before the strip. Lou don\'t do funerals and he don\'t do write-offs.'], ['dre', 'It\'s your debt now. First ten in thirty days. Or we come talk to your grandmama.']]);
        ots('me', 'dre');
        i = await choose([{ t: 'I\'ll have it. Leave her out of this.', tone: 'firm', d: { family: 3, streets: 2 } }, { t: 'Smoke\'s debt died with Smoke.', tone: 'defiant', d: { streets: 4, heat: 3 } }, { t: 'Who else did Smoke owe? Who else was he talking to?', tone: 'probe' }], { timer: 14 });
        syFlag('lou1', i);
        if (i === 1) { close('dre', -1); await lines([['dre', 'That\'s cute.'], ['narr', 'He looks past you, at Big Mama\'s window.'], ['dre', 'Thirty days.']]); }
        else if (i === 2) { close('dre', -1); await lines([['dre', 'Smoke was talking to a lot of people at the end. That\'s what made Lou nervous.'], ['dre', 'Thirty days.']]); syNote('Lou\'s collector says Smoke was "talking to a lot of people" at the end, and it made Lou nervous.'); }
        else { close('dre', -1); await say('dre', 'Thirty days.'); }
        unactor('dre');
      });
      const st = sy(); st.debt = 40000; st.paid = 0; st.flags.debtDay = S.day; save();
      syMeet('lou'); syNote('Smoke died owing Big Lou of Oak Cliff $40,000. Now you owe it. First $10,000 due in 30 days.');
      toast('New debt: $40,000 to Big Lou. First $10,000 due in 30 days.', 'bad');
    },
  ], { label: "Tier 1 · Big Lou's People", delay: 60 });

  mis('t9', 1, 'Tier 1', 'Re-Up', 'Ten at a time won\'t pay forty thousand. Mook knows where Smoke re-upped.', [
    async () => {
      await call('mook', [['mook', 'Dre came to see you, huh. Forty. Damn.'], ['mook', 'We can\'t move ten at a time and pay that. Lil Tre\'s back room. Smoke used to re-up there. Bring two thousand.']], { mustAnswer: true });
      await syUntil(() => S.cash >= 2000, `Get ${money(2000)} for the re-up`);
      const p = DATA.P.find(x => x.id === 'plug') || { x: 1915, z: -143, face: 0 }, [ox, oz] = outDir(p);
      actor('mook', p.x + ox * 3, p.z + oz * 3, Math.atan2(-ox, -oz) + Math.PI); actor('tre', p.x + ox * 1.6 + oz * 1.2, p.z + oz * 1.6 - ox * 1.2, Math.atan2(-ox, -oz) + Math.PI);
      await talkTo('mook', 'Meet', { obj: 'Meet Mook at Lil Tre\'s with the money', pin: "Lil Tre's Corner Store" });
    },
    async () => {
      if (!SY.actors.get('mook')) { const p = DATA.P.find(x => x.id === 'plug'), [ox, oz] = outDir(p); actor('mook', p.x + ox * 3, p.z + oz * 3, 0); actor('tre', p.x + ox * 1.6, p.z + oz * 1.6, 0); }
      await cut(async () => {
        faceEach('me', 'tre'); face('mook', foot.x, foot.z); two('me', 'tre', 1, 3.6);
        await lines([['tre', 'Smoke\'s brother. Two racks?'], ['narr', 'You count it out. Tre counts it again.'], ['tre', 'Forty-five. Same as your brother got. Don\'t make me regret it.'], ['mook', 'Now we working.']]);
        close('tre'); await lines([['tre', 'One more thing. Smoke wasn\'t re-upping here at the end. He was going straight to Oak Cliff. To Lou.'], ['tre', 'Then the last month, he stopped going to Lou too. Somebody bigger was putting him on.']]);
      });
      spend(2000, 'Re-up at Lil Tre\'s'); const st = sy(); st.pack += 45; st.flags.reup = (st.flags.reup || 0) + 1; save();
      syNote('Lil Tre: the last month, Smoke stopped buying from Lou. "Somebody bigger was putting him on."');
      unactor('mook'); unactor('tre'); syMeter('streets', 3, 'Re-upped');
      toast('+45. Bigger customers will text now.', 'good');
    },
  ], { label: 'Tier 1 · Re-Up', delay: 50 });

  mis('t10', 1, 'Tier 1', 'Big Mama Finds It', 'She was doing laundry.', [
    async () => {
      await syUntil(() => sy().served >= 8 || S.day > (syFlag('debtDay') || 0) + 1, 'Keep serving (the trap phone keeps buzzing)');
      await call('mama', [['mama', 'Come home. Right now.']], { mustAnswer: true });
      const h = spot('mama', 1, 2.6); actor('mama', h.x, h.z, h.yaw + Math.PI);
      await talkTo('mama', 'Talk to', { obj: 'Go home. Big Mama sounded different.', pin: "Big Mama's house" });
    },
    async () => {
      let i = 0;
      await cut(async () => {
        if (!SY.actors.get('mama')) { const h = spot('mama', 1, 2.6); actor('mama', h.x, h.z, 0); }
        faceEach('me', 'mama'); SY.actors.get('mama').pose = 'cross'; two('me', 'mama', -1, 3);
        await lines([['mama', 'I was doing your laundry.'], ['narr', 'She holds up a rubber-banded roll of twenties.'], ['mama', 'Four years in that place. Four years I prayed every night. For this?']]);
        ots('me', 'mama');
        i = await choose([{ t: 'Smoke owed people. They came to the house. I\'m handling it.', tone: 'truth', d: { family: 4, loyalty: 2 } }, { t: 'It\'s Rusty\'s. I\'m holding it for him.', tone: 'lie', d: { family: -6 } }, { t: 'I\'ll stop. After this. I promise.', tone: 'promise', d: { family: 2 } }], { timer: 16 });
        syFlag('mamaFound', i);
        SY.actors.get('mama').pose = null; close('mama', -1);
        if (i === 0) await lines([['mama', '...That black truck.'], ['mama', 'Lord. Lord, Darius, what did you leave us in.'], ['mama', 'You handle it. Then you STOP. You hear me? I am not doing this twice.']]);
        else if (i === 1) await lines([['mama', 'Rusty\'s.'], ['mama', 'Your brother used to lie to me just like that. Same face. Same eyes.'], ['mama', 'Get out of my kitchen.']]);
        else await lines([['mama', 'Smoke promised me too.'], ['mama', 'I\'ma hold you to it. Every word.']]);
        if (i !== 1) { await say('mama', 'Here. Smoke kept this in my Bible. I didn\'t want it in my house no more.'); await say('narr', 'A folded page of numbers and initials. "R.H. — Ironline — 11/14." The night he died.'); syFlag('ledger', 1); syNote('Big Mama gave you a page from Smoke\'s ledger hidden in her Bible: "R.H. — Ironline — 11/14", the night he died.'); }
        else syNote('You lied to Big Mama about the money. She knows.');
        unactor('mama');
      });
    },
  ], { label: 'Tier 1 · Big Mama Finds It', delay: 90 });

  mis('t11', 1, 'Tier 1', 'Lookout', 'Lil Bit from two houses down has been watching you the way you used to watch Smoke.', [
    async () => {
      const s = sySide(1475, -238, 1, 2.6); actor('bit', s.x, s.z, s.yaw + Math.PI);
      await talkTo('bit', 'Talk to', { obj: 'Lil Bit wants to talk (two houses down from Big Mama\'s)', pin: 'Lil Bit' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'bit'); ots('me', 'bit'); syName('bit');
        await lines([['bit', 'I seen what you did. On the corner. I can watch out. For real, I see everything.'], ['bit', 'Twelve-hundred a week. Or a thousand. Or whatever.'], ['me', 'How old are you?'], ['bit', '...Fifteen.']]);
        close('me'); await lines([['narr', 'Same age Smoke was.']]);
        ots('me', 'bit');
        i = await choose([{ t: 'Alright. Eyes only. You see blue lights, you text me.', tone: 'put him on', d: { streets: 3, loyalty: 3, family: -3 } }, { t: 'Go to school, Bit. I\'m serious. I\'ll check your report card.', tone: 'school', d: { family: 4, streets: -1 } }, { t: 'Here\'s fifty. Go home. Forget you saw anything.', tone: 'pay him off' }], { timer: 14 });
        syFlag('bit', i);
        close('bit');
        if (i === 0) await lines([['bit', 'Bet! I won\'t let you down. I swear.']]);
        else if (i === 1) await lines([['bit', 'Man... aight.'], ['bit', '...You really gon\' check it?']]);
        else await lines([['bit', 'I don\'t want your fifty.'], ['narr', 'He takes it anyway.']]);
        unactor('bit');
      });
      if (i === 0) { syFlag('lookout', 1); syNote('You put Lil Bit (15) on as your lookout. Fewer surprises. Big Mama will find out.'); }
      else if (i === 1) { syFlag('bitSchool', 1); syNote('You told Lil Bit to go to school. You said you\'d check his report card.'); }
      else { spend(50, 'Gave Lil Bit fifty'); syNote('You paid Lil Bit $50 to forget what he saw.'); }
    },
  ], { label: 'Tier 1 · Lookout', delay: 60 });

  mis('t12', 1, 'Tier 1', 'First Installment', 'Ten thousand to Big Lou\'s people at Carsen\'s Lounge. Then you\'re not just Smoke\'s little brother anymore.', [
    async () => {
      const st = sy();
      await syUntil(() => S.cash >= 10000, `Get ${money(10000)} for Lou's first installment (serve, Hustle, race)`, `Tier 1 · First Installment · Lou's money: ${money(st.debt - st.paid)} owed`);
      await call('mook', [['mook', 'You got it? All ten?'], ['mook', 'Carsen\'s Lounge. Dre said come by yourself. I\'ll be in the car.']], { mustAnswer: true });
      const p = DATA.P.find(x => x.id === 'plug_carson') || { x: SY_SPOT.lounge[0], z: SY_SPOT.lounge[1], face: 0 }, [ox, oz] = outDir(p);
      actor('dre', p.x + ox * 2.6, p.z + oz * 2.6, Math.atan2(-ox, -oz) + Math.PI);
      await talkTo('dre', 'Pay', { obj: 'Bring Lou\'s $10,000 to Carsen\'s Lounge', pin: "Carsen's Lounge" });
    },
    async () => {
      if (S.cash < 10000) throw SY_FAIL('You showed up short. Get the full $10,000 first.');
      const st = sy();
      await cut(async () => {
        if (!SY.actors.get('dre')) { const p = DATA.P.find(x => x.id === 'plug_carson'), [ox, oz] = outDir(p); actor('dre', p.x + ox * 2.6, p.z + oz * 2.6, 0); }
        faceEach('me', 'dre'); ots('me', 'dre');
        await lines([['narr', 'Dre counts it twice. Then a third time, slower, to make a point.'], ['dre', 'Ten.'], ['dre', 'Lou\'s impressed. Smoke never paid on time either.']]);
        close('dre', 1, 1.7);
        await lines([['dre', 'He wants to meet you. Oak Cliff. When you can move more than a corner.'], ['dre', 'And a word for free: stop asking about Ironline. People talk to Lou. Lou talks to people.']]);
        unactor('dre');
        await syBlack('', 1);
        st.paid += 10000; spend(10000, 'First installment to Big Lou');
        syFlag('mural', 2); syMural();
        const c = spot('corner', 1, 2.6), mp = SY.mural ? SY.mural.position : new THREE.Vector3(c.x, 2, c.z);
        placeMe(c.x + 4, c.z + 4, syYawTo(c.x + 4, c.z + 4, mp.x, mp.z)); setTime('sunset');
        await syUnblack();
        shot([mp.x + Math.sin(SY.mural ? SY.mural.rotation.y : 0) * 9, 2.2, mp.z + Math.cos(SY.mural ? SY.mural.rotation.y : 0) * 9], [mp.x, 2.1, mp.z], { to: [mp.x + Math.sin(SY.mural ? SY.mural.rotation.y : 0) * 6, 2.1, mp.z + Math.cos(SY.mural ? SY.mural.rotation.y : 0) * 6], dur: 9 });
        await lines([['narr', 'Somebody paid the artist. The mural is finished.'], ['narr', 'Nobody on the block calls you Lil Smoke anymore.']]);
        await syTitle('TIER 1 COMPLETE', 'HAND TO HAND', `${money(st.debt - st.paid)} still owed to Big Lou`, 3.4);
        await syTitle('NEXT', 'TIER 2 · THE TRAP', 'Coming in the next story update', 3);
      });
      st.tier = 2; st.flags.nickname = 1; syMeter('streets', 6, 'Respect'); syMeter('loyalty', 3); save();
      text('mook', `${S.name || 'bro'}. they saying ur name on the block now. not lil smoke. ur name`);
    },
  ], { label: 'Tier 1 · First Installment', delay: 90 });

  // ---------- the phone apps: Story, Texts, Trap ----------
  PHONE_APPS.splice(0, 0, { id: 'story', name: 'Story', icon: '📖', bg: 'linear-gradient(135deg,#ffd23f,#b8321e)' });
  PHONE_APPS.splice(1, 0, { id: 'texts', name: 'Messages', icon: '💬', bg: 'linear-gradient(135deg,#5bd36b,#1e9e3a)' });
  PHONE_APPS.splice(2, 0, { id: 'trap', name: 'Trap', icon: '📟', bg: 'linear-gradient(135deg,#3a3a3a,#111)' });
  const _syPhoneHome = phoneHome;
  phoneHome = function () {
    _syPhoneHome.apply(this, arguments);
    const st = S && sy(); if (!st) return;
    const trapBtn = document.querySelector('#ph-screen .app[data-id="trap"]'); if (trapBtn && !st.flags.trapPhone) trapBtn.remove();
    for (const [id, n] of [['texts', st.unread], ['trap', st.trapUnread]]) { const b = document.querySelector(`#ph-screen .app[data-id="${id}"]`); if (b && n) b.insertAdjacentHTML('afterbegin', `<span class="go-badge">${n > 99 ? '99+' : n}</span>`); }
  };
  const _syPhoneApp = phoneApp;
  phoneApp = function (id, a2) {
    const sc = phoneEl('ph-screen');
    if (id === 'story') { PH.app = id; return syStoryApp(sc, a2); }
    if (id === 'texts') { PH.app = id; return syTextsApp(sc, a2); }
    if (id === 'trap') { PH.app = id; return syTrapApp(sc); }
    return _syPhoneApp.apply(this, arguments);
  };
  function syBack(sc, to) { const b = sc.querySelector('.ph-back'); if (b) b.onclick = to || phoneHome; }
  function syStoryApp(sc, tab = 'story') {
    const st = sy(); sc.className = 'ph-screen sy-app';
    const tabs = [['story', 'Story'], ['journal', 'Journal'], ['people', 'People'], ['lives', 'Lives']];
    let body = `<div style="display:flex;gap:6px;padding:8px 12px">${tabs.map(([k, l]) => `<button data-t="${k}" style="flex:1;border:0;border-radius:14px;padding:6px 0;font:700 13px var(--body);background:${tab === k ? '#ffd23f' : 'rgba(255,255,255,.1)'};color:${tab === k ? '#000' : '#fff'}">${l}</button>`).join('')}</div>`;
    if (tab === 'story') {
      if (!st.on) body += `<div class="jr">Smoke is dead. You just got out. The block is waiting.<br><br>About 40 to 60 hours, seven tiers of the come-up, eight lives you can live. Your progress, cars and money all carry over.</div><button class="big" data-a="start">${st.done.length ? 'Resume the story' : 'Start the story'}</button>`;
      else {
        body += `<div class="stat"><div><b>${money(Math.max(0, st.debt - st.paid))}</b><span>Owed to Lou</span></div><div><b>${st.pack}</b><span>Pack</span></div><div><b>${st.served}</b><span>Served</span></div></div>`;
        body += `<div class="sec">You</div>` + SY_METERS.map(([k, l, c]) => `<div class="mrow"><span>${l}</span><i><b style="width:${st.meters[k]}%;background:${c}"></b></i></div>`).join('');
        const now = st.m ? misById(st.m) : null; if (now) body += `<div class="jr"><b>Now:</b> ${esc(now.title)}${SY.obj ? ' · ' + esc(SY.obj) : ''}</div>`;
        else if (st.next) body += `<div class="jr">Free roam. Your next story beat comes soon (a call or a text).<br><button class="big" data-a="next" style="margin:10px 0 0;width:100%">Play it now</button></div>`;
        body += `<button class="big" data-a="pause" style="background:rgba(255,255,255,.12);color:#fff">Pause the story (free roam only)</button>`;
      }
      for (const [t, k, nm] of TIERS) {
        const ms = M.filter(m => m.tier === t); body += `<div class="sec">${k} · ${nm}</div>`;
        if (!ms.length) { body += `<div class="ms lock"><div class="n">·</div><div><h5>Coming soon</h5><p>${t === 2 ? 'Next story update' : 'Later updates'}</p></div></div>`; if (t >= 3) continue; continue; }
        ms.forEach((m, i) => { const done = st.done.includes(m.id), now = st.m === m.id || (!st.m && st.next === m.id); body += `<div class="ms ${done ? 'done' : now ? 'now' : 'lock'}"><div class="n">${done ? '✓' : i + 1}</div><div><h5>${esc(m.title)}</h5><p>${done || now ? esc(m.brief) : 'Locked'}</p></div></div>`; });
      }
    } else if (tab === 'journal') body += st.journal.length ? st.journal.map(j => `<div class="jr">${esc(j)}</div>`).join('') : '<div class="jr">Nothing yet.</div>';
    else if (tab === 'people') body += st.met.length ? st.met.map(w => { const c = SY_CAST[w]; return c ? `<div class="ppl">${syAv(w)}<div><b>${esc(c.full || c.name)}</b><span>${esc(c.role)}</span></div></div>` : ''; }).join('') : '<div class="jr">You haven\'t met anyone yet.</div>';
    else if (tab === 'lives') body += `<div class="jr">The dope game is the main road. Other lives open as you come up. Run several at once, or leave the game behind for one of them.</div>` + LIVES.map(([n, u, how]) => `<div class="life"><span>${n}<br><em>${how}</em></span><em>${n === 'Kingpin' && st.on ? 'Living it' : 'Unlocks ' + u}</em></div>`).join('');
    sc.innerHTML = phoneHead('Story') + `<div class="ph-body">${body}</div>`; syBack(sc);
    sc.querySelectorAll('[data-t]').forEach(b => b.onclick = () => syStoryApp(sc, b.dataset.t));
    const A = sc.querySelector('[data-a="start"]'); if (A) A.onclick = () => { closePhone(); syStart(); };
    const P = sc.querySelector('[data-a="pause"]'); if (P) P.onclick = () => { syPause(); syStoryApp(sc); };
    const N = sc.querySelector('[data-a="next"]'); if (N) N.onclick = () => { st.nextT = 0; closePhone(); };
  }
  function syTextsApp(sc, who) {
    const st = sy(); sc.className = 'ph-screen sy-app';
    if (who) {
      const th = st.texts[who] || [];
      sc.innerHTML = phoneHead(esc((SY_CAST[who] || { name: who }).name)) + `<div class="ph-body"><div class="chat">${th.map(m => `<div class="m ${m.w === 'me' ? 'me' : ''}">${esc(m.m)}</div>`).join('')}</div></div>`;
      syBack(sc, () => syTextsApp(sc)); const b = sc.querySelector('.ph-body'); b.scrollTop = 1e6; return;
    }
    st.unread = 0; save();
    const ths = Object.keys(st.texts).filter(k => k !== 'trap' && SY_CAST[k]).sort((a, b) => st.texts[b].length - st.texts[a].length);
    sc.innerHTML = phoneHead('Messages') + `<div class="ph-body">${ths.length ? ths.map(k => { const l = st.texts[k][st.texts[k].length - 1]; return `<button class="thr" data-w="${k}">${syAv(k)}<div><b>${esc(SY_CAST[k].name)}</b><span>${esc(l.m)}</span></div></button>`; }).join('') : '<div class="jr">No messages.</div>'}</div>`;
    syBack(sc); sc.querySelectorAll('[data-w]').forEach(b => b.onclick = () => syTextsApp(sc, b.dataset.w));
  }
  function syTrapApp(sc) {
    const st = sy(); sc.className = 'ph-screen sy-app'; st.trapUnread = 0; save();
    const th = (st.texts.trap || []).slice(-14);
    let body = `<div class="stat"><div><b>${st.pack}</b><span>Pack</span></div><div><b>${st.served}</b><span>Served</span></div><div><b>${money(Math.max(0, st.debt - st.paid))}</b><span>Lou</span></div></div>`;
    body += `<div class="sec">Waiting on you</div>` + (st.orders.length ? st.orders.map(o => { const s = streetAt(o.x, o.z), d = Math.hypot(o.x - syMe()[0], o.z - syMe()[1]); return `<div class="ord"><div><b>${esc(o.name)} · ${o.qty} for ${money(o.pay)}</b><span>${esc(s ? s.name : 'Stop Six')} · ${d < 1609 ? Math.round(d * 1.094) + ' yd' : (d / 1609).toFixed(1) + ' mi'}</span></div><button data-o="${o.id}">GPS</button></div>`; }).join('') : `<div class="jr">${st.pack ? 'Nobody right now. They\'ll text.' : 'You\'re out. Re-up or wait on Mook.'}</div>`);
    body += `<div class="sec">Texts</div><div class="chat">${th.map(m => `<div class="m">${esc(m.w)}: ${esc(m.m)}</div>`).join('') || '<div class="jr">Quiet.</div>'}</div>`;
    sc.innerHTML = phoneHead('Trap phone') + `<div class="ph-body">${body}</div>`; syBack(sc);
    sc.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const o = st.orders.find(x => x.id === b.dataset.o); if (o) { setPin(o.name, o.x, o.z); closePhone(); toast(`GPS: ${o.name}`, 'good'); } });
  }

  // ---------- start, pause, resume ----------
  function syStart() {
    const st = sy(); st.on = true; save(); syUI();
    if (!st.done.length && !st.m) { st.next = 'p1'; st.nextT = 0.5; }
    else if (!st.m && !st.next) { const nx = M.find(m => !st.done.includes(m.id)); if (nx) { st.next = nx.id; st.nextT = 2; } }
    syMural(); save();
  }
  function syPause() { const st = sy(); st.on = false; if (SY.busy) { st.next = st.m; st.nextT = 3; st.m = null; } syAbortRun(); save(); syObjective(''); toast('Story paused. Start it again from the Story app.', 'good'); }
  function syAbortRun() {
    // stop whatever mission is waiting (its promises are dropped), clean the world up
    for (const w of SY.waits.splice(0)) { /* dropped */ }
    SY.busy = false; SY.act = null; syTalkOff(); syMarkerOff(); unactAll(); if (SY.said) { const f = SY.said; SY.said = null; f(); }
    if (sy().loan) endLoan();
    const B = sy().flags.flashBack; if (B) { S.look = B.look; S.wear = B.wear; delete sy().flags.flashBack; dressAvatar(); }
    document.body.classList.remove('sy-flash', 'sy-cs'); SY.lock = false; SY.flash = false;
  }
  // a brand-new save gets the choice right after making your character
  const _syCloseCreator = closeCreator;
  closeCreator = function () {
    const first = CR.first; const r = _syCloseCreator.apply(this, arguments);
    if (first && S && !S.story) setTimeout(() => syOffer(), 900);
    return r;
  };
  async function syOffer() {
    syUI(); const v = await banner('STORY MODE', 'Smoke is dead. You just got out. Play the story, or just ride around.', false, [['Play the story', 1], ['Free roam', 0]]);
    const st = sy(); if (v) syStart(); else { st.on = false; save(); toast('You can start the story any time from the Story app on your phone.', 'good'); }
  }

  // ---------- each frame ----------
  const _syStepStreet = stepStreet;
  stepStreet = function (t) {
    _syStepStreet.apply(this, arguments);
    if (!S || !worldOn) return;
    const n = performance.now(), dt = Math.min(0.05, (n - (SY.lt || n)) / 1000); SY.lt = n;
    try {
      // waits: timers and conditions
      if (SY.waits.length) { const keep = []; for (const w of SY.waits) { if ((w.until && n >= w.until) || (w.pred && w.pred())) w.res(); else keep.push(w); } SY.waits = keep; }
      syStepActors(dt); syStepCam(dt); syStepTalk(); syStepTrap(dt); syStepFlow(dt);
      if (SY.mk && SY.mk.visible && !SY.talk) SY.mk.position.y = SY.mk.userData.y + Math.sin(n / 300) * 0.1;
      if (SY.mk) SY.mk.rotation.y += dt * 1.6;
    } catch (e) { if (SY.err++ < 5) console.warn('story frame: ' + e.message, e.stack); }
  };
  // the cutscene holds you still (and the camera is the director's)
  const _syStepFoot = stepFoot;
  stepFoot = function (dt) { if (SY.lock) return; return _syStepFoot.apply(this, arguments); };
  const _syStepDrive = stepDrive;
  stepDrive = function (dt) { if (SY.lock) { drv.v = 0; return; } return _syStepDrive.apply(this, arguments); };
  // returning players: the mural and an unfinished flashback put back; the story picks up where it was
  const _syEnterWorld = enterWorld;
  enterWorld = function () {
    const r = _syEnterWorld.apply(this, arguments);
    try { const st = S && S.story; if (st) { const B = st.flags.flashBack; if (B && !st.m) { S.look = B.look; S.wear = B.wear; delete st.flags.flashBack; dressAvatar(); } if (st.loan && !st.m) endLoan(); syUI(); syMural(); } } catch (e) { console.warn('story load: ' + e.message); }
    return r;
  };
  window.__story = { SY, M, sy, syRun, syStart, syPause, syAbortRun, syNewOrder, syServe, syMural, say, choose, call, text, cut, actor, unactor, unactAll, misById, sySide, spot, SY_CAST, SY_SPOT, syMeter,
    // test helpers: jump to a mission, fast-forward everything
    jump(id) { const st = sy(); st.on = true; syAbortRun(); const i = M.findIndex(m => m.id === id); st.done = M.slice(0, i).map(m => m.id); st.m = null; st.next = id; st.nextT = 0; save(); },
    auto(on) { SY.autoPick = on ? 0 : null; SY.autoAnswer = on; SY.autoTalk = on; SY.autoRetry = on; SY.fast = on; },
    advance: syAdvance, pinAt: () => pin.visible ? [pin.position.x, pin.position.z] : null, mk: () => SY.mk && SY.mk.visible ? [SY.mk.position.x, SY.mk.position.z] : null };
  // ===== STORY END =====
