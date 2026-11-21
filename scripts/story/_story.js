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
    calloway: { name: 'Det. Calloway', full: 'Det. Wade Calloway (FWPD Narcotics)', col: '#9db4ff', role: 'FWPD narcotics detective. Worked Smoke\'s case. Takes envelopes.', seed: 151, look: { hairStyle: 'buzz', hair: '#5a4632', build: 2, height: 2, skin: '#d8a888', top: 'mx_leather', bottom: 'jeans_black', shoes: 'kicks_blackout', facialHair: 'stubble', extras: [] } },
    pooh: { name: 'Pooh', full: 'Pooh', col: '#ffe08a', role: 'Old head. Worked Smoke\'s spot. Now works yours.', seed: 161, look: { hairStyle: 'short', hair: '#7a7a7a', build: 2, height: 1, skin: '#4a2f1c', top: 'mw_carhartt', bottom: 'cargo_black', shoes: 'kicks_blackout', facialHair: 'beard', extras: [] } },
    saint: { name: 'Saint', full: 'Santiago "Saint" Ortega', col: '#f2d94e', role: 'Northside Reyes. Chuy Ortega\'s nephew. Half the city thinks he killed Smoke.', seed: 171, look: { hairStyle: 'buzz', hair: '#111111', build: 1, height: 2, skin: '#a0704c', top: 'mw_carhartt', bottom: 'mw_wranglers', shoes: 'mk_af1_white', hat: 'no_hat', facialHair: 'goatee', extras: ['chain'] } },
    saint2: { name: 'Lalo', full: 'Lalo Ortega', col: '#f2d94e', role: 'Saint\'s cousin. Doesn\'t listen to anybody.', seed: 181, look: { hairStyle: 'short', hair: '#111111', build: 2, height: 1, skin: '#8a5a3a', top: 'mm_mexico_blk', bottom: 'cargo_tan', shoes: 'mm_botas', hat: 'mw_cap_ranch', facialHair: 'stubble', extras: [] } },
    bo: { name: 'Uncle Bo', full: 'Boyd "Uncle Bo" Jenkins', col: '#e0b070', role: 'Big Mama\'s brother. Cattle, hog dogs and a windmill out by Joshua.', seed: 191, look: { hairStyle: 'short', hair: '#bdbdbd', build: 2, height: 2, skin: '#4a2f1c', top: 'mw_pearlsnap', bottom: 'mw_wranglers', shoes: 'mm_botas', hat: 'mm_tejana', facialHair: 'full_beard', extras: [] } },
    garza: { name: 'Agent Garza', full: 'Special Agent Rosa Garza (DEA)', col: '#9fd3ff', role: 'DEA, Dallas field office. Was supposed to meet Smoke the night he died.', seed: 211, fem: 1, look: { hairStyle: 'bun', hair: '#1a120c', build: 0, height: 0, skin: '#a8714a', top: 'mx_leather', bottom: 'jeans_black', shoes: 'boots_black', hat: 'no_hat', extras: [] } },
    earl: { name: 'Earl', full: 'Earl Tate (Hook & Haul Towing)', col: '#ffa65c', role: 'Owns Hook & Haul. Moves cars at night for Hollis Motors, no questions.', seed: 221, look: { hairStyle: 'buzz', hair: '#bdbdbd', build: 2, height: 1, skin: '#c08a64', top: 'mw_carhartt', bottom: 'md_carpenter', shoes: 'boots_black', hat: 'mw_cap_ranch', facialHair: 'full_beard' } },
    virgil: { name: 'Virgil', full: 'Virgil (VirL Studios)', col: '#ffc21a', role: 'Owns VirL Studios. Has 11 of Smoke\'s unreleased songs in the vault.', seed: 201, look: { hairStyle: 'locs', hair: '#3a2a1a', build: 1, height: 1, skin: '#55341f', top: 'mx_monogram', bottom: 'jeans_black', shoes: 'kicks_blackout', facialHair: 'beard', extras: ['chain'] } },
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
    const el = syUI().sub, fb = who === 'me' && SY.flash, c = fb ? SY_CAST.smoke : SY_CAST[who] || { name: who, col: '#fff' };
    const nm = who === 'me' && !fb ? (S.name || 'You') : c.name;
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
    // somebody standing in front (the person they're talking to): keep the lens in front of that person's head
    for (const k of ['me', ...SY.actors.keys()]) { if (k === who) continue; const q = syPos(k); if (!q) continue; const ox = q[0] - p[0], oz = q[1] - p[1], ahead = ox * fx + oz * fz; if (ahead > 0 && ahead < d + 0.5 && Math.abs(ox * rx + oz * rz - 0.5) < 0.7) d = Math.max(0.85, ahead * 0.6); }
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
      if (m.life) { const ln = syLifeNext(m.life); if (ln) text(SY_LIFE[m.life].who, `When you ready for the next one: ${ln.title}. Story app, Lives.`, { quiet: true }); }
      else {
        const main = M.filter(x => !x.life), nx = main[main.indexOf(m) + 1];
        if (nx) { st.next = nx.id; st.nextT = nx.delay != null ? nx.delay : 25; }
        else { st.next = null; syObjective(''); text('narr', 'More of the story is coming in the next update.', { quiet: true }); }
        if (m.id === 't3b' && syLifeNext('block')) text('mook', 'We got a block now. If you want to build the set up for real, Story app, Lives, Block boss.');
        if (m.id === 't3f' && syLifeNext('music')) text('virgil', 'Smoke left songs in my vault. When you want to hear them: Story app, Lives, Music mogul.');
        if (m.id === 't3h' && syLifeNext('land')) text('bo', 'Come back out when you want to learn cattle. Story app, Lives, Land and cattle.');
        if (m.id === 't12' && syLifeNext('racing')) text('rusty', 'Heard you put money in Lou\'s hand. Now come build something people remember. Story app, Lives, Street racing.');
      }
      save();
      if (!m.quiet) await banner('MISSION PASSED', m.title);
    } catch (e) { if (!(e && e.syAbort)) console.warn('story stopped: ' + (e && e.message), e && e.stack); }
    finally { SY.busy = false; SY.act = null; }
  }
  // the lives: side chains you play from the Story app (Lives tab) between story beats
  const SY_LIFE = { racing: { n: 'Street racing legend', who: 'rusty', after: 't12' }, block: { n: 'Block boss', who: 'mook', after: 't3b' }, land: { n: 'Land and cattle', who: 'bo', after: 't3h' }, music: { n: 'Music mogul', who: 'virgil', after: 't3f' } , cars: { n: 'Car boss', who: 'rusty', after: 't4a' } };
  const syLifeNext = k => { const st = sy(); return M.find(m => m.life === k && !st.done.includes(m.id)) || null; };
  const syLifeOpen = k => { const L = SY_LIFE[k]; return L && sy().done.includes(L.after); };
  function syPlayLife(k) { const st = sy(); if (SY.busy || st.m) { toast('Finish the job you\'re on first.', 'bad'); return false; } const m = syLifeNext(k); if (!m || !syLifeOpen(k)) return false; st.on = true; syRun(m, 0); return true; }
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
        await syTitle('NEXT', 'TIER 2 · THE TRAP', 'Four walls. Workers. Weight.', 3);
      });
      st.tier = 2; st.flags.nickname = 1; syMeter('streets', 6, 'Respect'); syMeter('loyalty', 3); save();
      text('mook', `${S.name || 'bro'}. they saying ur name on the block now. not lil smoke. ur name`);
    },
  ], { label: 'Tier 1 · First Installment', delay: 90 });

  // ---------- TRAP HOUSES (Tier 2): workers sell your stock while you're away; you pick up the cash and restock.
  // Heat builds; without Calloway's protection (or a lookout and cameras) FWPD can hit the spot. Saved on S.story.traps ----------
  const SY_TRAPS = { ramey: { place: 'trap_stopsix', name: 'Ramey Ave Trap House', rent: 3000 }, riverside: { place: 'trap_riverside', name: 'Riverside Duplex', rent: 4500 } };
  const SY_WORKERS = { keisha: { n: 'Keisha', spd: 0.8, honest: 0.99, blurb: 'Slow, careful, never short.' }, lilman: { n: 'Lil Man', spd: 1.5, honest: 0.86, blurb: 'Fast. Talks too much. Counts funny.' }, pooh: { n: 'Pooh', spd: 1.1, honest: 0.95, blurb: 'Old head. Worked for Smoke. Loyal.' },
    twin: { n: 'Twin', spd: 1.2, honest: 0.93, blurb: 'Quiet. Shows up on time.' }, deja: { n: 'Deja', spd: 1.0, honest: 0.97, blurb: 'Nurse by day. Nobody suspects her.' } };
  const syTraps = () => (sy().traps = sy().traps || []);
  const syTrap = id => syTraps().find(t => t.id === id);
  function syTrapPos(T) { const p = DATA.P.find(x => x.id === SY_TRAPS[T.id].place) || { x: 0, z: 0, face: 0 }, [ox, oz] = outDir(p); return { x: p.x + ox * 3.4, z: p.z + oz * 3.4, p }; }
  function syOpenTrap(id) { const st = sy(); if (syTrap(id)) return syTrap(id); const T = { id, name: SY_TRAPS[id].name, stock: 0, cash: 0, workers: [], cams: 0, sold: 0, heat: 0, opened: S.day }; syTraps().push(T); save(); return T; }
  // every 30 s of play the workers move some of the stock
  function syTrapTick() {
    const st = sy(), wk = syFlag('lookout') ? 0.55 : 1;
    for (const T of syTraps()) {
      if (!T.workers.length || T.stock <= 0 || T.raided) continue;
      const rate = T.workers.reduce((a, w) => a + (SY_WORKERS[w] ? SY_WORKERS[w].spd : 1), 0), n = Math.min(T.stock, Math.max(0, Math.round(rate * (0.6 + Math.random() * 1.2))));
      if (!n) continue;
      const each = st.flags.brick ? 60 : 55, skim = T.workers.reduce((a, w) => a * (SY_WORKERS[w] ? SY_WORKERS[w].honest : 0.95), 1);
      T.stock -= n; T.sold += n; T.cash += Math.round(n * each * skim); T.short = (T.short || 0) + Math.round(n * each * (1 - skim)); T.heat = Math.min(100, T.heat + n * 0.35 * wk);
      // a raid: only in free roam, never while a mission is running
      const prot = st.flags.calloway === 1 && !st.flags.callowayLate, risk = prot ? 0 : (T.heat / 100) * 0.05 * (T.cams ? 0.5 : 1) * wk;
      if (!SY.busy && !SY.lock && Math.random() < risk) {
        const lost = T.stock, lostCash = Math.round(T.cash * 0.7); T.stock = 0; T.cash -= lostCash; T.raided = S.day + 1; T.heat = 0;
        text('mook', `12 just ran up in ${T.name}. They took ${lost} and ${money(lostCash)}. Workers got out the back.`); syMeter('heat', 6, `${T.name} got raided`); syNote(`FWPD raided ${T.name}. You lost ${lost} and ${money(lostCash)}.`);
      }
    }
    save();
  }
  function syTrapMenu(T) {
    const st = sy(), W = T.workers.map(w => SY_WORKERS[w].n).join(', ') || 'nobody';
    const rows = [
      { t: 'Pick up the cash', s: `${money(T.cash)} waiting · sold ${T.sold} total`, btn: T.cash ? money(T.cash) : 'Empty', off: !T.cash, act: () => { earn(T.cash, `Pickup at ${T.name}`); T.cash = 0; sy().pickups = (sy().pickups || 0) + 1; } },
      { t: 'Drop off stock', s: `${T.stock} in the spot · ${st.pack} on you`, btn: st.pack ? `Drop ${Math.min(st.pack, 40)}` : 'Empty pack', off: !st.pack, act: () => { const n = Math.min(st.pack, 40); st.pack -= n; T.stock += n; } },
      { t: 'Take stock back', s: 'Grab some for your own customers', btn: T.stock ? `Take ${Math.min(T.stock, 20)}` : '—', off: !T.stock, act: () => { const n = Math.min(T.stock, 20); T.stock -= n; st.pack += n; } },
      { t: 'Cameras', s: T.cams ? 'Installed. Raids are half as likely.' : 'See 12 coming. Halves raid risk.', btn: T.cams ? 'Installed' : money(600), off: !!T.cams, act: () => { if (spend(600, 'Trap cameras')) T.cams = 1; } },
      { t: 'Heat on this spot', s: T.heat > 60 ? 'Hot. Slow down or pay somebody.' : T.heat > 25 ? 'Warm. Neighbors talking.' : 'Quiet.', bar: 100 - T.heat, btn: `${Math.round(T.heat)}%`, off: true, act: () => {} },
      { t: 'Workers', s: W, btn: `${T.workers.length}`, off: true, act: () => {} },
    ];
    if (T.raided) rows.unshift({ t: 'Raided', s: 'Spot is shut down until tomorrow (sleep).', btn: '—', off: true, act: () => {} });
    return { title: T.name, sub: `Your trap · ${T.workers.length} working`, rows };
  }
  // the door prompt when you walk up to one of your traps
  function syStepTraps(dt) {
    const st = sy(); if (!st.on || !st.traps || !st.traps.length) return;
    SY.trapT = (SY.trapT || 0) + dt; if (SY.trapT > 30) { SY.trapT = 0; syTrapTick(); }
    if (SY.lock || SY.talk || SY.serveFor || !foot.on || inside || menuFn) { if (SY.trapFor) { SY.trapFor = null; syUI().talk.classList.remove('on'); } return; }
    const [mx, mz] = syMe(); let near = null;
    if (!(SY.act && SY.act.id === 't2g')) for (const T of st.traps) { const q = syTrapPos(T); if (Math.hypot(q.x - mx, q.z - mz) < 4) near = T; }
    const el = syUI().talk;
    if (near) { if (SY.trapFor !== near.id) { SY.trapFor = near.id; el.innerHTML = `Run ${esc(near.name)}<small>E</small>`; el.onclick = () => openMenu(() => syTrapMenu(near)); } el.classList.add('on'); }
    else if (SY.trapFor) { SY.trapFor = null; el.classList.remove('on'); el.onclick = () => { if (SY.talk) SY.talk.go(); }; }
  }
  addEventListener('keydown', e => { if (e.code === 'KeyE' && SY.trapFor && !SY.talk && !SY.lock && !menuFn) { const T = syTrap(SY.trapFor); if (T) openMenu(() => syTrapMenu(T)); } });
  // sleeping: raided spots reopen, Calloway gets paid every 7 days (or he gets mad), Lou's clock runs
  const _sySleep = sleep;
  sleep = function (p) {
    const r = _sySleep.apply(this, arguments);
    try {
      const st = S.story; if (!st || !st.on) return r;
      for (const T of st.traps || []) { if (T.raided && S.day >= T.raided) T.raided = 0; T.heat = Math.max(0, T.heat - 12); }
      if (st.flags.calloway === 1 && S.day % 7 === 0) { if (S.cash >= 2500) { S.cash -= 2500; S.log.unshift('-$2,500 Calloway'); st.flags.callowayLate = 0; text('narr', 'Calloway\'s envelope: $2,500. Paid.', { quiet: true }); } else { st.flags.callowayLate = 1; text('mook', 'Calloway came by for his envelope and you was short. He not happy.'); } }
      save();
    } catch (e) { console.warn('story sleep: ' + e.message); }
    return r;
  };
  // drag strip results for the racing life (Ironline / Yello Belly)
  const _syStripEnd = stripEnd;
  stripEnd = function (why) {
    const r0 = S.rep, opp = STRIP.racer, pl = STRIP.p; const r = _syStripEnd.apply(this, arguments);
    try { const st = S.story; if (st) { st.drags = (st.drags || 0) + 1; if (opp && S.rep > r0) { st.dragWins = (st.dragWins || 0) + 1; st.lastDragAt = pl && pl.id || ''; } save(); } } catch (e) {}
    return r;
  };

  // ---------- TIER 2: The Trap ----------
  mis('t2a', 2, 'Tier 2', 'Four Walls', 'You can\'t stand on a corner forever. Mook found a spot on Ramey.', [
    async () => {
      await call('mook', [['mook', 'Ayo. Ms. Odessa\'s duplex on Ramey, the one that been empty since her son went to Huntsville.'], ['mook', 'She want three thousand up front and she don\'t ask questions. Come look.']], { mustAnswer: true });
      const q = syTrapPos({ id: 'ramey' }); actor('mook', q.x + 1.5, q.z, 0); face('mook', q.p.x, q.p.z);
      await talkTo('mook', 'Talk to', { obj: 'Meet Mook at the Ramey Ave spot', pin: 'Ramey Ave Trap House' });
    },
    async () => {
      await syUntil(() => S.cash >= 3000, `Get ${money(3000)} for Ms. Odessa's rent`);
      if (!SY.actors.get('mook')) { const q = syTrapPos({ id: 'ramey' }); actor('mook', q.x + 1.5, q.z, 0); }
      await cut(async () => {
        faceEach('me', 'mook'); two('me', 'mook', 1, 3.4);
        await lines([['mook', 'Two bedrooms, burglar bars, back door to the alley. And she deaf in one ear.'], ['narr', 'You hand Ms. Odessa three thousand in a grocery bag. She counts it on the porch and goes back inside.'],
          ['mook', 'A spot means you ain\'t standing out there. People come to you. Workers move it while you sleep.'], ['mook', 'But a spot is a address. And 12 can read addresses.']]);
      });
      spend(3000, 'Ms. Odessa\'s rent'); const T = syOpenTrap('ramey'); T.workers = ['pooh']; const st = sy(); const n = Math.min(st.pack, 20); st.pack -= n; T.stock += n; save();
      syNote('You opened your first trap: the Ramey Ave duplex. Pooh, who worked for Smoke, is working it.');
      toast('Ramey Ave is yours. Walk up to the door to run it.', 'good'); unactor('mook');
    },
  ], { label: 'Tier 2 · Four Walls', delay: 40 });

  mis('t2b', 2, 'Tier 2', 'Hiring', 'Pooh can\'t work it alone. Three people want in.', [
    async () => {
      const q = syTrapPos({ id: 'ramey' }); actor('mook', q.x + 1.6, q.z + 1, 0);
      await talkTo('mook', 'Talk to', { obj: 'Go to Ramey Ave. Mook lined up people who want to work.', pin: 'Ramey Ave Trap House' });
      let a = 0, b = 0;
      await cut(async () => {
        faceEach('me', 'mook'); two('me', 'mook', -1, 3.4);
        await lines([['mook', 'Keisha: slow, but she ain\'t never been short a dollar. Lil Man: fastest hands on the east side, but he count funny.'], ['mook', 'And Twin. Don\'t talk, don\'t miss a day. Pick two.']]);
        a = await choose([{ t: 'Keisha. Slow money is still money.', tone: 'careful', d: { clean: 1 } }, { t: 'Lil Man. I need it moving.', tone: 'fast', d: { streets: 2 } }, { t: 'Twin.', tone: 'steady' }], { timer: 14, q: 'First hire' });
        const rest = [['keisha', 'Keisha'], ['lilman', 'Lil Man'], ['twin', 'Twin']].filter((x, i) => i !== a);
        b = await choose(rest.map(x => ({ t: x[1] })), { timer: 12, q: 'Second hire' });
        const pick = [['keisha', 'lilman', 'twin'][a], rest[b][0]]; const T = syTrap('ramey') || syOpenTrap('ramey'); T.workers = ['pooh', ...pick]; syFlag('hired', pick); save();
        close('mook'); await say('mook', `${SY_WORKERS[pick[0]].n} and ${SY_WORKERS[pick[1]].n}. Bet. I\'ll tell \'em.`);
        if (syFlag('lookout')) { await say('mook', 'And Lil Bit already on the porch. That boy don\'t blink.'); }
      });
      unactor('mook');
    },
    async () => {
      await call('mook', [['mook', 'The spot moving. Keep it stocked and come get the money. Don\'t let it sit there.'], ['mook', 'Money sitting in a trap is money for whoever kick the door in.']]);
      await syUntil(() => { const T = syTrap('ramey'); return T && T.sold >= 6; }, 'Keep Ramey Ave stocked (walk up to the door, drop off stock)');
      const pk0 = sy().pickups || 0; await syUntil(() => (sy().pickups || 0) > pk0, 'Pick up the cash at Ramey Ave');
    },
  ], { label: 'Tier 2 · Hiring', delay: 30 });

  mis('t2c', 2, 'Tier 2', 'The Brick', 'Dre pulls up with something heavier than a zip.', [
    async () => {
      text('dre', 'Lou heard about the spot. Im outside it');
      const q = syTrapPos({ id: 'ramey' }); actor('dre', q.x - 3, q.z + 2, 0); face('dre', q.p.x, q.p.z);
      await talkTo('dre', 'Talk to', { obj: 'Dre is waiting outside Ramey Ave', pin: 'Ramey Ave Trap House' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'dre'); ots('me', 'dre');
        await lines([['dre', 'Lou likes that you got four walls now. He wants to front you real weight.'], ['dre', 'Two hundred. On consignment. That\'s nine more on the tab.']]);
        i = await choose([{ t: 'Bet. Put it on the tab.', tone: 'all in', d: { streets: 4, heat: 3 } }, { t: 'Half. I don\'t want to owe more than I can move.', tone: 'careful', d: { clean: 1 } }], { timer: 14 });
        close('dre', 1, 1.8); await say('dre', i === 0 ? 'That\'s the spirit Smoke had.' : 'Careful. Lou respects careful. For now.');
      });
      const st = sy(), n = i === 0 ? 200 : 100; st.pack += n; st.debt += i === 0 ? 9000 : 4500; st.flags.brick = 1; save();
      toast(`+${n}. Lou's tab: ${money(st.debt - st.paid)}`, 'good'); unactor('dre');
      syNote(`Lou fronted you ${n} on consignment. You owe him ${money(st.debt - st.paid)} now.`);
    },
  ], { label: 'Tier 2 · The Brick', delay: 50 });

  mis('t2d', 2, 'Tier 2', 'Count', 'The money from Ramey came up short. Somebody\'s skimming.', [
    async () => {
      const T = syTrap('ramey') || syOpenTrap('ramey'); const short = Math.max(800, T.short || 0);
      text('pooh', `count off ${money(short)} this week. wasnt me. u need to come see`);
      const q = syTrapPos(T); const ws = T.workers.filter(w => w !== 'pooh'); actor('pooh', q.x + 1.4, q.z, 0);
      await talkTo('pooh', 'Talk to', { obj: `Ramey Ave came up ${money(short)} short. Go find out who.`, pin: 'Ramey Ave Trap House' });
      const thief = T.workers.includes('lilman') ? 'lilman' : ws[0] || 'twin';
      let i = 0;
      await cut(async () => {
        faceEach('me', 'pooh'); ots('me', 'pooh');
        await lines([['pooh', 'I been doing this since your brother was in middle school. I know a short count.'], ['pooh', thief === 'lilman' ? 'Lil Man got new Jordans yesterday. Bred 11s. Two-fifty.' : `${SY_WORKERS[thief].n} been leaving early. Every night this week.`], ['pooh', 'Ain\'t saying. Just saying.']]);
        i = await choose([{ t: `Fire ${SY_WORKERS[thief].n}.`, tone: 'fire', d: { loyalty: 2 } }, { t: 'Give them one more chance.', tone: 'forgive', d: { loyalty: 4, streets: -2 } }, { t: `Make an example of ${SY_WORKERS[thief].n}.`, tone: 'example', d: { streets: 5, heat: 5, loyalty: -3 } }], { timer: 14 });
        syFlag('count', i);
        close('pooh'); await say('pooh', i === 0 ? 'I\'ll find somebody. Deja, from the nursing home. Nobody suspect her.' : i === 1 ? 'Your call. Smoke would\'ve did the same. Once.' : '...Alright. Everybody gon\' hear about it. That\'s the point, huh.');
      });
      if (i === 0 || i === 2) T.workers = T.workers.map(w => w === thief ? 'deja' : w);
      if (i === 1 && SY_WORKERS[thief]) T.forgiven = thief; T.short = 0; save(); unactor('pooh');
      syNote(i === 0 ? `You fired ${SY_WORKERS[thief].n} for skimming. Deja replaced them.` : i === 1 ? `You gave ${SY_WORKERS[thief].n} another chance after skimming.` : `You made an example of ${SY_WORKERS[thief].n}. Every worker on the east side heard.`);
    },
  ], { label: 'Tier 2 · Count', delay: 70 });

  mis('t2e', 2, 'Tier 2', 'Calloway', 'An unmarked Charger has been behind you for six blocks.', [
    async () => {
      await syUntil(() => syInSix(...syMe()), 'Head back to Stop Six');
      const [mx, mz] = syMe(), s = sySide(mx + 10, mz + 6, 1, 2.4);
      actor('calloway', s.x, s.z, 0); face('calloway', mx, mz);
      await talkTo('calloway', 'Talk to', { obj: 'A man in a FWPD jacket is waving you over', r: 4 });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'calloway'); ots('me', 'calloway'); syName('calloway');
        await lines([['calloway', 'Relax. If I wanted you in cuffs you\'d be in cuffs.'], ['calloway', 'Detective Calloway. Narcotics. I worked your brother\'s case. The accident.'], ['calloway', 'Ramey Ave is a nice little spot. Be a shame if it got a warrant.']]);
        close('calloway', 1, 1.8); await say('calloway', 'Twenty-five hundred a week, and the warrants go in my bottom drawer.');
        ots('me', 'calloway');
        i = await choose([{ t: 'Pay him.', tone: 'pay', d: { heat: -8, clean: -2 } }, { t: 'I don\'t pay police.', tone: 'refuse', d: { streets: 4, heat: 6 } }, { t: 'You worked Smoke\'s case. What really happened?', tone: 'probe' }], { timer: 14 });
        if (i === 2) { close('calloway', -1, 1.8); await lines([['calloway', 'Your brother drove too fast in a car held together with Rusty\'s welding. That\'s what happened.'], ['calloway', 'Now. Twenty-five hundred. Yes or no.']]); i = await choose([{ t: 'Pay him.', tone: 'pay', d: { heat: -8 } }, { t: 'No.', tone: 'refuse', d: { streets: 3, heat: 6 } }], { timer: 12 }); syNote('Calloway blamed Rusty\'s welding for Smoke\'s crash. Rusty said someone swapped the bolts.'); }
        syFlag('calloway', i === 0 ? 1 : 2);
        close('calloway', -1, 1.8); await say('calloway', i === 0 ? 'Smart. First envelope every Sunday. Don\'t make me come looking.' : 'Okay. We\'ll do it the other way, then.');
      });
      if (syFlag('calloway') === 1) { if (!spend(2500, 'Calloway, first envelope')) { syFlag('callowayLate', 1); } }
      syMeet('calloway'); unactor('calloway');
      syNote(syFlag('calloway') === 1 ? 'You\'re paying Det. Calloway (FWPD narcotics) $2,500 a week to keep warrants off Ramey Ave.' : 'You refused to pay Det. Calloway. Expect raids.');
    },
  ], { label: 'Tier 2 · Calloway', delay: 60 });

  mis('t2f', 2, 'Tier 2', 'Flashback: The Keys', 'Three weeks before Ironline. Smoke at Hollis Motors.', [
    async () => {
      await syUntil(() => foot.on && !inside, 'Get out and walk (another memory)');
      const st = sy(); st.flags.flashBack = { look: Object.assign({}, S.look), wear: Object.assign({}, S.wear), at: [foot.on ? foot.x : drv.x, foot.on ? foot.z : drv.z, foot.yaw] }; save();
      await cut(async () => {
        await syBlack('<span style="font-size:.8em;opacity:.7">HOLLIS MOTORS · COWTOWN AUTO ROW · 3 WEEKS BEFORE</span>', 2.4);
        const L = syLook('smoke'); S.look = Object.assign({}, S.look, { body: 'm', skin: L.skin, hair: L.hair, hairStyle: 'locs', facialHair: 'goatee', build: 1, height: 2, face: L.face, extras: ['cuban'] }); S.wear = Object.assign({}, S.wear, { top: 'racing_jacket', bottom: 'jeans_black', shoes: 'mk_jordan_bred', hat: '' }); dressAvatar(); if (foot.holder) wearMe(foot.holder);
        SY.flash = true; document.body.classList.add('sy-flash'); setTime('night');
        const a = DATA.P.find(x => x.id === 'auto_row') || { x: 75, z: -163, face: 0 }, [ox, oz] = outDir(a), s = { x: a.x + ox * 6, z: a.z + oz * 6 };
        placeMe(s.x, s.z, 0); actor('hollis', s.x + 1.4, s.z - 1.2, 0); actor('calloway', s.x - 5, s.z - 3, 0); faceEach('me', 'hollis'); face('calloway', s.x, s.z); SY.actors.get('calloway').pose = 'cross';
        await syUnblack(); two('me', 'hollis', 1, 3.6);
        await lines([['narr', 'You are Smoke. Twenty-seven. The fastest name in Fort Worth.'], ['hollis', 'Darius. Keys to the car. Whatever you need for Ironline, it\'s on Hollis Motors.'], ['hollis', 'And the other thing. The haulers go out Tuesday. Your boys just drive. No questions.']]);
        ots('me', 'hollis'); await lines([['me', 'I said I\'d race for you, Deacon. I ain\'t moving your trucks.'], ['hollis', '...Everybody moves my trucks eventually, son.']]);
        close('me', -1); await lines([['narr', 'Across the lot, a man in a FWPD jacket is leaning on an unmarked Charger. Watching.'], ['me', '(Who is that?)']]);
        await syBlack('', 1.2);
        const B = sy().flags.flashBack; if (B) { S.look = B.look; S.wear = B.wear; delete sy().flags.flashBack; dressAvatar(); if (foot.holder) wearMe(foot.holder); if (B.at) placeMe(B.at[0], B.at[1], B.at[2]); } setTime('day');
        SY.flash = false; document.body.classList.remove('sy-flash'); unactAll();
        await syUnblack();
      });
      syNote('Three weeks before he died, Smoke refused to drive Hollis\'s car haulers. Calloway was on the lot that night.');
    },
  ], { label: 'Tier 2 · Flashback', delay: 80 });

  mis('t2g', 2, 'Tier 2', 'Raid', 'Lil Bit is texting in all caps.', [
    async () => {
      const T = syTrap('ramey') || syOpenTrap('ramey'); if (T.stock < 15) T.stock = 15; save();
      text(syFlag('lookout') ? 'bit' : 'pooh', syFlag('lookout') ? 'BLUE LIGHTS ON STALCUP TURNING ON RAMEY RN' : '12 outside. alot of em');
      if (syFlag('calloway') === 1 && !syFlag('callowayLate')) { await syWait(2); text('calloway', 'Not mine. County task force. Get your stuff out.'); }
      await reach(syTrapPos(T).x, syTrapPos(T).z, 10, 'Ramey Ave Trap House', { obj: 'Get to Ramey Ave before the raid hits' });
    },
    async () => {
      const T = syTrap('ramey'), q = syTrapPos(T); let i = 0;
      await cut(async () => {
        placeMe(q.x, q.z, syYawTo(q.x, q.z, q.p.x, q.p.z)); actor('pooh', q.x + 1.2, q.z + 0.8, 0); face('pooh', foot.x, foot.z);
        shot([q.x + 8, 2.6, q.z + 6], [q.x, 1.4, q.z], { to: [q.x + 6, 2.2, q.z + 5], dur: 6 });
        await lines([['pooh', 'They two blocks out! What we doing?!']]);
        i = await choose([{ t: 'Grab the stock and run out the back.', tone: 'run', d: { streets: 3, heat: 4 } }, { t: 'Leave it. Everybody walk out the front calm.', tone: 'walk away', d: { heat: -3 } }, { t: 'Flush it all.', tone: 'flush', d: { heat: -6, streets: -2 } }], { timer: 8, def: 1 });
        syFlag('raid', i);
      });
      if (i === 0) {
        sy().pack += T.stock; T.stock = 0; S.heat = Math.max(S.heat || 0, 2); save();
        const [mx, mz] = syMe(), t0 = performance.now();
        await syUntil(() => { if (performance.now() - t0 > 75000) throw SY_FAIL('Task force caught you with the stock.'); const [x, z] = syMe(); return Math.hypot(x - mx, z - mz) > 320; }, 'Get away from Ramey Ave (300+ yards)', 'Tier 2 · Raid').catch(e => { throw e; });
        syNote('You ran the stock out the back of Ramey Ave during a raid.');
      } else if (i === 1) { T.stock = 0; T.cash = 0; syNote('You walked away from Ramey Ave during a raid and lost everything inside.'); }
      else { T.stock = 0; syNote('You flushed everything at Ramey Ave before the raid.'); }
      T.raided = S.day + 1; T.heat = 0; save(); unactAll();
      await syWait(3);
      if (syFlag('lookout')) await call('bit', [['bit', 'I did good, right? I seen them first. I seen them first!']]);
    },
  ], { label: 'Tier 2 · Raid', delay: 70 });

  // the throw in the raid loop above can't escape syUntil's poller; make predicates that throw fail the mission
  {
    const _u = syUntil;
    syUntil = function (pred, obj, sub) { return new Promise((res, rej) => { const p = _u(() => { try { return pred(); } catch (e) { rej(e); return true; } }, obj, sub); p.then(res, rej); }); };
  }

  mis('t2h', 2, 'Tier 2', 'Second Spot', 'One spot gets raided, you need two. Riverside Duplex is empty.', [
    async () => {
      await call('mook', [['mook', 'Ramey gon\' be hot for a minute. My cousin got the Riverside Duplex, off Belknap. Forty-five hundred.'], ['mook', 'Two spots, they can\'t shut us down at once.']], { mustAnswer: true });
      await syUntil(() => S.cash >= 4500, `Get ${money(4500)} for the Riverside Duplex`);
      const q = syTrapPos({ id: 'riverside' }); actor('mook', q.x + 1.4, q.z, 0);
      await talkTo('mook', 'Talk to', { obj: 'Meet Mook at the Riverside Duplex', pin: 'Riverside Duplex' });
      await cut(async () => { faceEach('me', 'mook'); two('me', 'mook', 1, 3.4); await lines([['mook', 'Twin can run this one. And I\'ll be here myself some nights.'], ['mook', 'Two spots. Smoke never had two spots.']]); });
      spend(4500, 'Riverside Duplex'); const T = syOpenTrap('riverside'); T.workers = ['twin', 'deja'].filter(w => !(syTrap('ramey') || { workers: [] }).workers.includes(w)); if (!T.workers.length) T.workers = ['keisha'];
      const st = sy(), n = Math.min(st.pack, 30); st.pack -= n; T.stock += n; save(); unactor('mook');
      syMeter('streets', 4, 'Two spots'); syNote('You opened a second trap at the Riverside Duplex.');
    },
  ], { label: 'Tier 2 · Second Spot', delay: 50 });

  mis('t2i', 2, 'Tier 2', "Nia's Pictures", 'Nia has the photos from the night Smoke died. She wants to show you in person.', [
    async () => {
      text('nia', 'I finally went through the Ironline pics. You need to see something. Gran Plaza lot tonight?');
      setTime('night'); const g = DATA.P.find(x => x.id === 'gran_plaza') || { x: 225, z: 613, face: 3.1 }, [ox, oz] = outDir(g);
      actor('nia', g.x + ox * 4, g.z + oz * 4, 0); SY.actors.get('nia').pose = 'phone';
      await talkTo('nia', 'Meet', { obj: 'Meet Nia at La Gran Plaza Lot', pin: 'La Gran Plaza Lot' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'nia'); SY.actors.get('nia').pose = 'phone'; two('me', 'nia', 1, 3.2);
        await lines([['nia', 'I shot two hundred pictures that night. I never looked at them. Couldn\'t.'], ['nia', 'Look. Behind the staging lanes. Eleven-oh-four PM. Fifteen minutes before his run.']]);
        close('nia', -1, 1.5); await lines([['narr', 'In the photo: Smoke\'s car on jack stands in the pits. A man in a dark jacket underneath it. A Hollis Motors hauler behind him.'], ['me', 'Who is that?'], ['nia', 'I can\'t see his face. But that\'s a FWPD jacket. Look at the back.']]);
        SY.actors.get('nia').pose = null; ots('me', 'nia');
        await say('nia', 'I don\'t know what you\'re doing out here. I don\'t want to know. But be careful. Please.');
        i = await choose([{ t: 'Can I see you again? Not about this.', tone: 'flirt', d: { family: 3 } }, { t: 'Delete these. Don\'t show anybody.', tone: 'protect' }, { t: 'Send me everything you shot that night.', tone: 'business' }], { timer: 14 });
        syFlag('nia', i);
        close('nia', -1, 1.6); await say('nia', i === 0 ? '...Yeah. I\'d like that.' : i === 1 ? 'They\'re in three places. I\'m not stupid.' : 'Airdropping now. All two hundred.');
      });
      unactor('nia'); syNote('Nia\'s photo, 11:04 PM the night Smoke died: a man in a FWPD jacket under Smoke\'s car in the Ironline pits, a Hollis Motors hauler behind him.');
      if (syFlag('nia') === 0) text('nia', 'Next Friday. You\'re buying the tacos 😌');
    },
  ], { label: "Tier 2 · Nia's Pictures", delay: 60 });

  mis('t2j', 2, 'Tier 2', 'Lil Bit', 'The thing you decided about Lil Bit comes back around.', [
    async () => {
      const bit = syFlag('bit'), s = sySide(1475, -238, 1, 2.6);
      if (bit === 0) {
        text('mama', 'They took Bryson to juvenile last night. His mama is at my house crying. Come home.');
        actor('mama', s.x, s.z, 0); await talkTo('mama', 'Talk to', { obj: 'Go to Big Mama\'s. Lil Bit got picked up.', pin: "Big Mama's house" });
        let i = 0;
        await cut(async () => {
          faceEach('me', 'mama'); SY.actors.get('mama').pose = 'cross'; ots('me', 'mama');
          await lines([['mama', 'Caught him on the porch of that duplex with a phone and four hundred dollars.'], ['mama', 'Fifteen years old. Who you think he was working for?']]);
          i = await choose([{ t: 'I\'ll pay his lawyer. Whatever it costs.', tone: 'own it', d: { family: 3, loyalty: 4 } }, { t: 'That\'s on him. He asked me.', tone: 'cold', d: { family: -8, streets: 2 } }], { timer: 14 });
          SY.actors.get('mama').pose = null; close('mama');
          await say('mama', i === 0 ? 'You\'ll pay his lawyer. And then you\'ll look his mama in the face.' : 'Then you ain\'t who I raised.');
        });
        if (i === 0) spend(Math.min(S.cash, 3500), 'Lil Bit\'s lawyer'); syFlag('bitJuvie', 1); unactor('mama');
        syNote(i === 0 ? 'Lil Bit (15) got picked up working your spot. You paid his lawyer.' : 'Lil Bit (15) got picked up working your spot. You told Big Mama that was on him.');
      } else if (bit === 1) {
        actor('bit', s.x, s.z, 0); SY.actors.get('bit').pose = 'phone';
        await talkTo('bit', 'Talk to', { obj: 'Lil Bit is waiting on the porch with something', pin: 'Lil Bit' });
        await cut(async () => {
          faceEach('me', 'bit'); SY.actors.get('bit').pose = null; two('me', 'bit', 1, 3);
          await lines([['bit', 'You said you\'d check it. So. Here.'], ['narr', 'A report card. Three Bs, two Cs, an A in Algebra.'], ['bit', 'Coach said I could start JV if my grades stay up.'], ['me', 'An A in Algebra? Who you cheating off?'], ['bit', 'Nobody! I\'m just smart, bro.']]);
        });
        syMeter('family', 4, 'Lil Bit\'s report card'); syFlag('bitGood', 1); unactor('bit');
        syNote('Lil Bit brought you his report card. An A in Algebra. He\'s trying out for JV.');
      } else {
        text('bit', 'u was right. i dont need nobody 50. got a job at the car wash on Lancaster');
        syNote('Lil Bit got a job at the car wash on Lancaster.');
      }
    },
  ], { label: 'Tier 2 · Lil Bit', delay: 60 });

  mis('t2k', 2, 'Tier 2', 'Paid in Full', 'Every dollar Smoke owed Lou. Then you owe nobody.', [
    async () => {
      const st = sy();
      await syUntil(() => S.cash >= Math.max(0, st.debt - st.paid), `Pay off Big Lou: ${money(Math.max(0, st.debt - st.paid))} (run your traps, serve, race)`);
      await call('dre', [['dre', 'Lou wants to see you himself. Bring all of it. Oak Cliff is too far for you, so he\'s coming to Carsen\'s.']], { mustAnswer: true });
      const p = DATA.P.find(x => x.id === 'plug_carson') || { x: 2095, z: -143, face: 3.1 }, [ox, oz] = outDir(p);
      actor('lou', p.x + ox * 3, p.z + oz * 3, Math.atan2(-ox, -oz) + Math.PI); actor('dre', p.x + ox * 3 + oz * 1.6, p.z + oz * 3 - ox * 1.6, Math.atan2(-ox, -oz) + Math.PI);
      await talkTo('lou', 'Pay', { obj: 'Bring Big Lou everything you owe at Carsen\'s Lounge', pin: "Carsen's Lounge" });
    },
    async () => {
      const st = sy(), owe = Math.max(0, st.debt - st.paid); if (S.cash < owe) throw SY_FAIL(`You need ${money(owe)} on you.`);
      if (!SY.actors.get('lou')) { const p = DATA.P.find(x => x.id === 'plug_carson'), [ox, oz] = outDir(p); actor('lou', p.x + ox * 3, p.z + oz * 3, 0); actor('dre', p.x + ox * 3 + 1.5, p.z + oz * 3, 0); }
      let i = 0;
      await cut(async () => {
        faceEach('me', 'lou'); face('dre', foot.x, foot.z); wide(foot.x, foot.z, foot.yaw + Math.PI * 0.6, 9, 3); await syWait(1.5);
        ots('me', 'lou'); syName('lou');
        await lines([['lou', 'So you the little brother.'], ['narr', 'Dre counts it. Lou doesn\'t watch. He\'s watching you.'], ['lou', 'Smoke never paid me all at once. Not one time. You know why?']]);
        close('lou', 1, 1.8); await lines([['lou', 'Because the last month he wasn\'t buying from me. He was buying from the man I buy from.'], ['lou', 'Hollis. Deacon Hollis. The car lot man. He moves it all in those car haulers. I-30, I-35, I-20.'], ['lou', 'Smoke cut me out to go straight to the top. And then he told Hollis no.']]);
        ots('me', 'lou');
        i = await choose([{ t: 'Did you have anything to do with Ironline?', tone: 'direct', d: { streets: 2 } }, { t: 'Why are you telling me this?', tone: 'careful' }, { t: 'Put me on. Directly. Like you did Smoke.', tone: 'ambitious', d: { streets: 4, heat: 2 } }], { timer: 14 });
        syFlag('lou2', i);
        close('lou', -1, 1.8);
        await lines(i === 0 ? [['lou', 'If I wanted Smoke dead I would have done it at a red light. Not on a racetrack with cameras.'], ['lou', 'Somebody wanted it to look like an accident. That\'s a different kind of man.']] : i === 1 ? [['lou', 'Because Hollis is coming for you next. And I want you owing me a favor when he does.']] : [['lou', 'Ha. Same mouth as your brother.'], ['lou', 'Come see me in Oak Cliff when you can move a real load. Then we talk.']]);
        await say('lou', 'Debt\'s clean. You owe nobody. That\'s a rare thing in Fort Worth. Enjoy it.');
        unactor('lou'); unactor('dre');
        st.paid += owe; spend(owe, 'Paid off Big Lou');
        await syTitle('TIER 2 COMPLETE', 'THE TRAP', 'Smoke\'s debt is paid. Two spots running.', 3.4);
        await syTitle('NEXT', 'TIER 3 · THE BLOCK', 'Corners. Colors. Northside.', 2.6);
      });
      st.tier = 3; syMeter('streets', 6, 'Debt free'); syMeter('loyalty', 3); save(); syMeet('lou');
      syNote('Big Lou is paid in full. Lou says Smoke was buying straight from Deacon Hollis at the end, then told Hollis no. Hollis moves everything in his car haulers.');
    },
  ], { label: 'Tier 2 · Paid in Full', delay: 90 });

  // ---------- LIFE: Street Racing Legend (Rusty). Opens after Tier 1; plays between story missions ----------
  mis('r1', 1, 'Racing', "Rusty's Project", 'Rusty wants to turn your car into something people remember.', [
    async () => {
      await call('rusty', [['rusty', 'Saw your clip from Lancaster. You drive like your brother. Sloppy, but you got it.'], ['rusty', 'Bring whatever you\'re driving by the lot. Let\'s make it mean something.']], { mustAnswer: true });
      await syUntil(() => !!S.car, 'Get a car to bring to Rusty');
      const r = DATA.P.find(x => x.id === 'rusty_used') || { x: -75, z: 463, face: 0 }, [ox, oz] = outDir(r); actor('rusty', r.x + ox * 4, r.z + oz * 4, 0);
      await talkTo('rusty', 'Talk to', { obj: 'Drive your car to Rusty\'s Used Autos', pin: "Rusty's Used Autos" });
      await cut(async () => {
        faceEach('me', 'rusty'); two('me', 'rusty', 1, 3.4);
        await lines([['rusty', 'Speed costs money. How fast you want to go?'], ['rusty', 'Open the Engine Lab on your phone. Put any real parts in it. Then come race at the strip.'], ['rusty', 'Smoke ran the Yello Belly and Ironline every Friday. Start where he started.']]);
      });
      unactor('rusty'); syFlag('racing', 1);
      syNote('Rusty is building your car for the strip. Street racing life unlocked.');
    },
  ], { label: 'Racing · Rusty\'s Project', life: 'racing', delay: 0 });
  mis('r2', 1, 'Racing', 'Friday at the Strip', 'Win a drag race against somebody at the Yello Belly or Ironline.', [
    async () => {
      const w0 = sy().dragWins || 0;
      text('rusty', 'Friday night. Yello Belly or Ironline. Beat somebody.');
      await syUntil(() => (sy().dragWins || 0) > w0, 'Win a drag race at the Yello Belly or Ironline (pull into the lanes, pick a racer)');
      syMeter('streets', 4, 'Strip win'); text('throttle', `${S.name || 'Lil Smoke'} just took money at the strip 🏁`);
      syNote('You won your first drag race at the strip.');
    },
  ], { label: 'Racing · Friday at the Strip', life: 'racing', delay: 0 });
  mis('r3', 1, 'Racing', "Hollis's Offer", 'Win at Ironline and Deacon Hollis wants to put his name on your car.', [
    async () => {
      const w0 = sy().dragWins || 0, ir = DATA.P.find(x => x.id === 'ironline') || { x: 34, z: 1260 };
      setPin('Ironline Dragway', ir.x, ir.z);
      await syUntil(() => (sy().dragWins || 0) > w0 && sy().lastDragAt === 'ironline', 'Win a drag race at Ironline Dragway, where Smoke died');
      const [mx, mz] = syMe(); actor('hollis', mx + 5, mz + 3, 0); face('hollis', mx, mz);
      await talkTo('hollis', 'Talk to', { obj: 'Deacon Hollis is walking over', r: 5 });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'hollis'); ots('me', 'hollis');
        await lines([['hollis', 'Same lane. Same light. Same lean in the launch. It\'s like watching Darius.'], ['hollis', 'Race under the Hollis Motors banner. Full sponsorship. Parts, tires, entry fees, a car if you want one.']]);
        i = await choose([{ t: 'Deal. Put your name on it.', tone: 'take it', d: { streets: 3, clean: 2 } }, { t: 'I race for Stop Six. Not for you.', tone: 'refuse', d: { streets: 4, loyalty: 3 } }, { t: 'Smoke raced for you too. Look where it got him.', tone: 'accuse', d: { heat: 3 } }], { timer: 14 });
        syFlag('hollisSponsor', i);
        close('hollis', -1, 1.8); await say('hollis', i === 0 ? 'Welcome to the family. Come by the dealership. We\'ll get you a real car.' : i === 1 ? 'Stop Six doesn\'t pay for tires. I do. Offer stands.' : 'Darius made choices. I hope you make better ones.');
      });
      if (i === 0) { earn(5000, 'Hollis Motors sponsorship'); syNote('You took Hollis Motors\' sponsorship. $5,000 up front.'); } else syNote(i === 1 ? 'You turned down Hollis\'s sponsorship.' : 'You told Hollis to his face that racing for him got Smoke killed.');
      unactor('hollis');
      text('narr', 'More of the racing life comes with the next story update.', { quiet: true });
    },
  ], { label: 'Racing · Hollis\'s Offer', life: 'racing', delay: 0 });

  // ---------- TIER 3: The Block. Uses the hood's turf system (HOOD, hS, hOwner): take blocks, hold them, the war with Saint's Northside ----------
  const syH = () => (typeof hS === 'function' && HOOD.ready ? hS() : null);
  const syMine = () => { const h = syH(); return h && h.set ? HOOD.blocks.filter(b => hOwner(b) === h.set) : []; };
  // the block to go after: the closest one to Stop Six (or to p) that isn't yours, optionally only a given set's
  function syBlockFor(x, z, gid) {
    const h = syH(); if (!h) return null; let best = null, bd = 1e9;
    for (const b of HOOD.blocks) { const o = hOwner(b); if (o === h.set || (gid && o !== gid)) continue; const d = Math.hypot(b.cx - x, b.cz - z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  // a set rolls on a spot: 2-3 shooters walk in from up the street (same people the hood's own slides use)
  async function sySlide(gid, x, z, n = 3) {
    let bases = null;
    for (let k = 0; k < 40; k++) { bases = [0, 1].map(v => hBase(gid, v)); if (bases.every(Boolean)) break; await syWait(0.25); }
    if (!bases || !bases.every(Boolean)) return [];
    const a = Math.random() * Math.PI * 2, out = [];
    for (let k = 0; k < n; k++) {
      const ex = x + Math.cos(a) * 42 + k * 2, ez = z + Math.sin(a) * 42, name = H_NICKS[(hHash(gid) + k * 5 + frame) % H_NICKS.length], gunId = k ? 'g19' : 'arp';
      const e = hEnt({ id: hXid('s'), own: 'me', ct: hNow(), desc: { k: 'member', g: hToNet(gid), n: name, gn: gunId, v: k % 2 }, kind: 'member', gang: gid, blk: null, slider: true, sy: true, name, x: ex, z: ez, hx: ex, hz: ez, mode: 'fight', gunId });
      hDress(e, hClone(bases[k % 2])); hLabel(e); out.push(e);
    }
    return out;
  }
  const syAlive = list => list.filter(e => !e.gone && !e.down);
  function syTakeBlock(b) { const h = syH(); if (!h || !h.set) return; h.turf[b.id] = h.set; h.turfAt[b.id] = hNow(); h.stats.taken++; if (hOn()) { HNET.turf[b.id] = [h.set, hNow()]; HNET.tfOut.push([b.id, hToNet(h.set), hNow()]); } for (const e of b.crew.slice()) hKill(e); save(); }
  // flashbacks put you back where you stood when they end
  function syFlashIn(look, wear, time) {
    const st = sy(); st.flags.flashBack = { look: Object.assign({}, S.look), wear: Object.assign({}, S.wear), at: [foot.on ? foot.x : drv.x, foot.on ? foot.z : drv.z, foot.yaw] }; save();
    const L = syLook('smoke'); S.look = Object.assign({}, S.look, { body: 'm', skin: L.skin, hair: L.hair, hairStyle: 'locs', facialHair: 'goatee', build: 1, height: 2, face: L.face, extras: ['cuban'] }, look || {});
    S.wear = Object.assign({}, S.wear, { top: 'racing_jacket', bottom: 'jeans_black', shoes: 'mk_jordan_bred', hat: '' }, wear || {}); dressAvatar(); if (foot.holder) wearMe(foot.holder);
    SY.flash = true; document.body.classList.add('sy-flash'); if (time) setTime(time);
  }
  function syFlashOut() {
    const B = sy().flags.flashBack; if (B) { S.look = B.look; S.wear = B.wear; delete sy().flags.flashBack; dressAvatar(); if (foot.holder) wearMe(foot.holder); if (B.at) placeMe(B.at[0], B.at[1], B.at[2]); }
    SY.flash = false; document.body.classList.remove('sy-flash'); unactAll(); setTime('day');
  }
  // running the dogs at the kennel counts for the ranch life
  if (MENUS.dogs) { const _syDogs = MENUS.dogs; MENUS.dogs = function () { const m = _syDogs.apply(this, arguments); try { for (const r of m.rows) if (/Run the dogs/.test(r.t)) { const a = r.act; r.act = () => { a(); const st = S.story; if (st) { st.hunts = (st.hunts || 0) + 1; save(); } }; } } catch (e) {} return m; }; }

  mis('t3a', 3, 'Tier 3', 'A Name', 'Two spots and no debt. Mook says it\'s time the block had a name.', [
    async () => {
      await call('mook', [['mook', 'Two traps and Lou paid off. You know what we ain\'t got? A name.'], ['mook', 'Big Tre and Six Block run every corner from Rosedale to Stalcup. Pull up on Ramey.']], { mustAnswer: true });
      const q = syTrapPos({ id: 'ramey' }); actor('mook', q.x + 1.5, q.z + 0.6, 0); face('mook', q.p.x, q.p.z);
      await talkTo('mook', 'Talk to', { obj: 'Meet Mook at Ramey Ave', pin: 'Ramey Ave Trap House' });
      const h = syH();
      await cut(async () => {
        faceEach('me', 'mook'); two('me', 'mook', 1, 3.4);
        if (h && h.set && h.set !== 'own') {
          await lines([['mook', `You already rocking with ${setOf(h.set).name}. Smoke never wore nobody's colors but his own.`]]);
          const i = await choose([{ t: `I'm ${setOf(h.set).short}. We take blocks for them.`, tone: 'loyal', d: { loyalty: 2 } }, { t: 'Then we start our own.', tone: 'own', d: { streets: 3, heat: 2 } }], { timer: 14 });
          if (i === 1) { hLeave(); } else { syFlag('setName', setOf(h.set).name); close('mook'); await say('mook', 'Aight. Then we put work in for them.'); return; }
        }
        if (h && h.set === 'own') { syFlag('setName', h.own.name); await lines([['mook', `${h.own.name}. I like it. Now it gotta mean something.`]]); return; }
        await lines([['mook', 'Smoke ran with no name. Everybody just said "Smoke people." That was cool when he was here.'], ['mook', 'Now it\'s us. What we calling it?']]);
        const names = [['Six Side', '#ff6a3a'], ['Smoke Gang', '#9b5cff'], ['Ramey Boyz', '#3dd1a0']];
        const i = await choose(names.map(n => ({ t: n[0] })), { timer: 14, q: 'Name your set' });
        const H = syH(); if (H) { H.own = { name: names[i][0], color: names[i][1] }; H.set = 'own'; H.respect = 0; H.job = null; }
        syFlag('setName', names[i][0]); save();
        close('mook', -1); await say('mook', `${names[i][0]}. Say it again. ${names[i][0]}. Yeah.`);
      });
      unactor('mook'); syMeter('streets', 3, 'A name');
      syNote(`You named your set: ${syFlag('setName')}.`);
    },
  ], { label: 'Tier 3 · A Name', delay: 40 });

  mis('t3b', 3, 'Tier 3', 'First Block', 'A name means nothing without a corner. Take one.', [
    async () => {
      const b = syBlockFor(1100, -300); if (!b) throw SY_FAIL('The hood map is still loading.');
      syFlag('firstBlock', b.id);
      text('mook', `${b.name}. ${hOwner(b) ? setOf(hOwner(b)).short + ' got like 3 people on it and they lazy' : 'Nobody holding it'}. Thats ours`);
      setPin(b.name, b.corner.x, b.corner.z); syMarker(b.corner.x, b.corner.z, 3);
      await syUntil(() => { const h = syH(); return h && h.set && hOwner(b) === h.set; }, `Take ${b.name}: clear the corner, then stand on it for 30 seconds`, 'Tier 3 · First Block');
      syMarkerOff();
      await syWait(1.5);
      text('throttle', `${syFlag('setName') || 'Somebody new'} just took ${b.name} 👀 east side moving different`);
      syMeter('streets', 5, 'First block'); syMeter('heat', 3);
      syNote(`You took your first block: ${b.name}.`);
    },
  ], { label: 'Tier 3 · First Block', delay: 30 });

  mis('t3c', 3, 'Tier 3', 'Saint', 'Throttle is saying the man who killed Smoke runs Northside. He wants to talk.', [
    async () => {
      text('throttle', 'Word is SAINT from Northside the one who did Smoke at Ironline. Now Smoke lil brother out here taking blocks 🍿');
      await syWait(4);
      text('saint', 'This Saint. I seen what they posting. I didnt touch your brother. Northside Quick Stop, come alone');
      const p = DATA.P.find(x => x.id === 'corner_northside') || { x: 75, z: -463, face: 0 }, [ox, oz] = outDir(p);
      actor('saint', p.x + ox * 4, p.z + oz * 4, 0); actor('saint2', p.x + ox * 4 + oz * 2.4, p.z + oz * 4 - ox * 2.4, 0); face('saint', p.x, p.z); SY.actors.get('saint2').pose = 'cross';
      await talkTo('saint', 'Talk to', { obj: 'Meet Saint at Northside Quick Stop', pin: 'Northside Quick Stop' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'saint'); face('saint2', foot.x, foot.z); wide(foot.x, foot.z, foot.yaw + Math.PI * 0.55, 10, 3.4); await syWait(1.6);
        ots('me', 'saint'); syName('saint');
        await lines([['saint', 'Santiago Ortega. Everybody say Saint. Chuy is my uncle.'], ['saint', 'Half this city think I killed your brother. You probably think it too.']]);
        close('saint', 1, 1.8);
        await lines([['saint', 'I was at Ironline that night. I had ten thousand on the other car. Me and Smoke had words in the pits. Loud ones.'], ['saint', 'Then he\'s dead, and two days later a detective is at my mama\'s house asking about my "argument."'], ['saint', 'Calloway. You know him?']]);
        ots('me', 'saint');
        i = await choose([{ t: 'I believe you. For now.', tone: 'listen', d: { loyalty: 2 } }, { t: 'Calloway knows me. What did he want?', tone: 'probe' }, { t: 'If I find out you lying, I\'m coming north.', tone: 'threat', d: { streets: 4, heat: 2 } }], { timer: 14 });
        syFlag('saint', i);
        close('saint', -1, 1.8);
        await lines(i === 0 ? [['saint', 'For now is all anybody gets.'], ['saint', 'My people don\'t all see it like me, though. Some of my cousins want that block you took.']]
          : i === 1 ? [['saint', 'He wanted me to say it was me. Said he\'d make it a manslaughter. Said it would go away.'], ['saint', 'Why would a cop want me to confess to a racing accident?']]
          : [['saint', 'Come north, then. We\'ll be here.'], ['saint', 'But you\'re looking at the wrong man. Remember I told you that.']]);
      });
      unactor('saint'); unactor('saint2'); syMeet('saint');
      syNote(i === 1 ? 'Saint says Calloway pushed him to confess to Smoke\'s "accident" and offered to make it a manslaughter.' : 'Saint (Northside Reyes, Chuy Ortega\'s nephew) says he argued with Smoke in the Ironline pits that night over a $10,000 bet, but didn\'t kill him.');
    },
  ], { label: 'Tier 3 · Saint', delay: 60 });

  mis('t3d', 3, 'Tier 3', 'Slide', 'Northside is on your block. Not Saint. His cousins.', [
    async () => {
      const b = HOOD.byId.get(syFlag('firstBlock')) || syMine()[0]; if (!b) throw SY_FAIL('You need a block first.');
      text(syFlag('lookout') ? 'bit' : 'mook', `NORTHSIDE ON ${b.name.toUpperCase()}. 3 of em`);
      await reach(b.corner.x, b.corner.z, 70, b.name, { obj: `Get to ${b.name}. Northside is sliding.` });
      const ens = await sySlide('northside', b.corner.x, b.corner.z, 3); SY.slide = ens;
      toast(`${HOOD_SETS.northside.name} are sliding on ${b.name}. Hold it down.`, 'bad');
      await syUntil(() => !syAlive(ens).length, `Hold ${b.name}: drop the Northside shooters (${'3'})`, 'Tier 3 · Slide');
      SY.slide = null;
      if (syH()) hBeef('northside', 25);
      syMeter('streets', 4, 'Held the block'); syMeter('heat', 4);
      await call('mook', [['mook', 'That was Saint\'s cousin Lalo and them. Saint ain\'t send them. But he ain\'t stop them neither.'], ['mook', 'Everybody watching what we do next.']]);
      syNote(`Northside (Saint's cousins, not Saint) slid on ${b.name}. You held it.`);
    },
  ], { label: 'Tier 3 · Slide', delay: 50 });

  mis('t3e', 3, 'Tier 3', 'Answer', 'They slid. The whole east side is waiting on your answer.', [
    async () => {
      const q = syTrapPos({ id: 'ramey' }); actor('mook', q.x + 1.4, q.z + 0.6, 0);
      await talkTo('mook', 'Talk to', { obj: 'Go to Ramey Ave. Mook wants to talk about Northside.', pin: 'Ramey Ave Trap House' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'mook'); ots('me', 'mook');
        await lines([['mook', 'Three ways to do this, and you know all three.'], ['mook', 'Talk to Saint and make him check his own people. Walk up on a Northside corner. Or I drive and you hang out the window.']]);
        i = await choose([{ t: 'Talk it down. Saint handles his cousins.', tone: 'talk-down', d: { loyalty: 2, heat: -3, streets: -2 } }, { t: 'Walk up. Face to face.', tone: 'walk-up', d: { streets: 5, heat: 5 } }, { t: 'Drive-by. You drive.', tone: 'drive-by', d: { streets: 6, heat: 8, family: -2 } }], { timer: 14, q: 'How do you answer Northside?' });
        syFlag('answer', i);
        close('mook', 1); await say('mook', i === 0 ? 'Talking. Smoke would\'ve talked first too.' : i === 1 ? 'Bet. I\'m right behind you.' : 'Get in.');
      });
      unactor('mook');
      if (i === 0) {
        text('saint', 'Pull up. Same spot');
        const p = DATA.P.find(x => x.id === 'corner_northside') || { x: 75, z: -463 }, [ox, oz] = outDir(p); actor('saint', p.x + ox * 4, p.z + oz * 4, 0);
        await talkTo('saint', 'Talk to', { obj: 'Meet Saint at Northside Quick Stop', pin: 'Northside Quick Stop' });
        let j = 0;
        await cut(async () => {
          faceEach('me', 'saint'); ots('me', 'saint');
          await lines([['saint', 'Lalo don\'t listen to nobody. Not even Chuy.'], ['saint', 'But I\'ll put the word out: your block is off limits. That cost me something with my own people.']]);
          j = await choose([{ t: 'Then I owe you one.', tone: 'respect', d: { loyalty: 3 } }, { t: 'You did the right thing. That\'s all.', tone: 'cold' }], { timer: 12 });
          close('saint', -1, 1.8); await say('saint', j === 0 ? 'I\'ll remember that. One day I\'m gonna need it.' : 'Okay. Right thing. Sure.');
        });
        unactor('saint'); syFlag('saintAlly', j === 0 ? 2 : 1); if (syH()) hBeef('northside', -40);
        syNote('You talked it down with Saint. He told Northside to leave your block alone.' + (j === 0 ? ' You told him you owe him one.' : ''));
      } else {
        const h = syH(), nb = syBlockFor(foot.x, foot.z, 'northside') || syBlockFor(0, -750);
        if (nb) { setPin(nb.name, nb.corner.x, nb.corner.z); }
        const d0 = h ? h.stats.drops : 0;
        if (i === 2) await syUntil(() => driving && !foot.on, 'Get in a car. Mook is driving, you\'re shooting.');
        await syUntil(() => { const H = syH(); return H && H.stats.drops >= d0 + 2; }, i === 1 ? `Walk up on ${nb ? nb.name : 'a Northside corner'} and drop 2 of them` : `Ride by ${nb ? nb.name : 'a Northside corner'} and drop 2 of them`, 'Tier 3 · Answer');
        if (h) hBeef('northside', 40);
        syNote(i === 1 ? 'You walked up on a Northside corner and dropped two of theirs.' : 'You did a drive-by on a Northside corner. Two of theirs got hit.');
        text('saint', i === 1 ? 'You came north. Ok.' : 'A drive by. Ok. Thats how we doing it');
      }
    },
  ], { label: 'Tier 3 · Answer', delay: 60 });

  mis('t3f', 3, 'Tier 3', 'Too Much Cash', 'You have more money than a man with no job can explain.', [
    async () => {
      await call('mama', [['mama', 'Baby, the lady at the bank asked me where all my "gift money" coming from. In front of the whole line.'], ['mama', 'I don\'t want to know. But you better figure it out before somebody else does.']], { mustAnswer: true });
      await syWait(3);
      await call('rusty', [['rusty', 'Heard you got a cash problem. A car lot is a laundromat with a sign out front.'], ['rusty', 'Cars sell for whatever I write down. Come see me.']]);
      await syWait(2);
      text('virgil', 'This Virgil, VirL Studios. Smoke booked studio time he never used. Lot of it. Studio money is the cleanest money in Texas. Pull up');
      let i = await choose([{ t: 'Rusty\'s car lot', tone: 'cars' }, { t: 'VirL Studios', tone: 'music' }], { timer: 20, q: 'Who washes your money?' });
      syFlag('wash', i === 0 ? 'rusty' : 'virl');
      const pid = i === 0 ? 'rusty_used' : 'virl_studios', who = i === 0 ? 'rusty' : 'virgil', p = DATA.P.find(x => x.id === pid) || { x: 0, z: 0 }, [ox, oz] = outDir(p);
      actor(who, p.x + ox * 4, p.z + oz * 4, 0);
      await syUntil(() => S.cash >= 5000, `Get $5,000 to put in the front`);
      await talkTo(who, 'Talk to', { obj: `Bring $5,000 to ${who === 'rusty' ? "Rusty's Used Autos" : 'VirL Studios'}`, pin: p.name });
      await cut(async () => {
        faceEach('me', who); two('me', who, 1, 3.4);
        await lines(who === 'rusty' ? [['rusty', 'Five thousand comes in as a down payment on a Monte Carlo that don\'t exist. Comes out as a commission check with your name on it.'], ['rusty', 'And you on my books as a salesman now. Pay stubs and everything. Pruitt will love that.']]
          : [['virgil', 'Five thousand in studio time, booked. Engineer gets paid. Producer gets paid. You get paid as a producer.'], ['virgil', 'And Smoke\'s tapes are still in the vault. Eleven songs. When you\'re ready, we should talk about those.']]);
      });
      if (spend(5000, who === 'rusty' ? 'Rusty: front' : 'VirL: studio time')) { earn(4200, who === 'rusty' ? 'Commission check (clean)' : 'Producer fee (clean)'); syMeter('clean', 12, 'Money washed'); }
      unactor(who); syMeet(who);
      syNote(who === 'rusty' ? 'Rusty washes your money through the car lot. You\'re on his books as a salesman.' : 'Virgil washes your money through VirL Studios. He still has 11 of Smoke\'s unreleased songs in the vault.');
    },
  ], { label: 'Tier 3 · Too Much Cash', delay: 70 });

  mis('t3g', 3, 'Tier 3', 'Flashback: Ironline Night', 'The night Smoke died. 10:40 PM, the Ironline pits.', [
    async () => {
      await syUntil(() => foot.on && !inside, 'Get out and walk (another memory)');
      const ir = DATA.P.find(x => x.id === 'ironline') || { x: 34, z: 1260, face: 0 }, [ox, oz] = outDir(ir), s = { x: ir.x + ox * 10, z: ir.z + oz * 10 };
      await cut(async () => {
        await syBlack('<span style="font-size:.8em;opacity:.7">IRONLINE DRAGWAY · THE NIGHT SMOKE DIED · 10:40 PM</span>', 2.4);
        syFlashIn(null, null, 'night');
        placeMe(s.x, s.z, 0); actor('saint', s.x + 1.6, s.z - 1.2, 0); actor('calloway', s.x - 6, s.z - 4, 0); actor('mook', s.x + 4, s.z + 3, 0);
        faceEach('me', 'saint'); face('calloway', s.x, s.z); face('mook', s.x, s.z); SY.actors.get('calloway').pose = 'cross'; SY.actors.get('mook').pose = 'phone';
        await syUnblack(); two('me', 'saint', 1, 3.6);
        await lines([['saint', 'Ten thousand says your car don\'t make it to the eighth.'], ['me', 'Then you about to be ten thousand short, Saint.'], ['saint', 'Your mouth gonna get you hurt one day, Darius.']]);
        ots('me', 'saint'); await lines([['me', 'Not tonight. Tonight I got a meeting after this. A real one.']]);
        close('me', -1); await lines([['narr', 'Behind the staging lanes, Calloway is on the phone. Across the pits, Mook is on his phone too.'], ['narr', 'Neither of them is watching the race.']]);
        await syBlack('', 1.2); syFlashOut(); await syUnblack();
      });
      syNote('The night he died, Smoke told Saint he had "a meeting after this, a real one." Calloway and Mook were both on their phones in the pits.');
    },
  ], { label: 'Tier 3 · Flashback', delay: 80 });

  mis('t3h', 3, 'Tier 3', 'Uncle Bo', 'Big Mama\'s brother has a ranch in Johnson County. He says Smoke left something there.', [
    async () => {
      await call('mama', [['mama', 'My brother Bo called. You remember Uncle Bo? Out by Joshua with the cows and them crazy dogs.'], ['mama', 'He said Smoke came out there a month before he passed. He wants to see you. Go. Get out the city a day.']], { mustAnswer: true });
      const p = DATA.P.find(x => x.id === 'land_homestead') || { x: 18, z: 4090 };
      actor('bo', p.x + 34, p.z - 6, 0);
      await talkTo('bo', 'Talk to', { obj: 'Drive to Uncle Bo\'s place on Old Cleburne Rd (Johnson County)', pin: 'Uncle Bo\'s place', r: 4 });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'bo'); wide(foot.x, foot.z, foot.yaw + Math.PI * 0.6, 12, 4); await syWait(1.8);
        ots('me', 'bo'); syName('bo');
        await lines([['bo', 'Look at you. Last time I saw you, you was scared of my cows.'], ['bo', 'Your brother came out here with a duffel bag and a shovel. Didn\'t say a word. Dug for an hour by the windmill.'], ['bo', 'Then he told me: "If something happen to me, give it to my little brother when he ready. Not before."']]);
        close('bo', 1, 1.8); await say('bo', 'And you ain\'t ready. Not running blocks with cops on you. When you ready, I\'ll know.');
        ots('me', 'bo');
        i = await choose([{ t: 'Then teach me something out here.', tone: 'humble', d: { family: 4, clean: 2 } }, { t: 'That\'s my brother\'s money. Give it to me.', tone: 'demand', d: { family: -4, streets: 2 } }], { timer: 14 });
        close('bo', -1, 1.8); await say('bo', i === 0 ? 'Now that\'s the first smart thing out your mouth. Come back. I\'ll show you cattle.' : 'It\'s in the ground, boy. Ain\'t going nowhere. Neither am I.');
      });
      syFlag('bo', i); unactor('bo'); syMeet('bo');
      syNote('Uncle Bo says Smoke buried a duffel bag by the windmill on his land a month before he died, for you, "when you\'re ready." Land and cattle life unlocked.');
    },
  ], { label: 'Tier 3 · Uncle Bo', delay: 60 });

  mis('t3i', 3, 'Tier 3', 'Three Blocks', 'One block is a corner. Three is a set.', [
    async () => {
      text('mook', 'One block is a corner. Three blocks is a set. Lets eat');
      const pinNext = () => { const b = syBlockFor(foot.on ? foot.x : drv.x, foot.on ? foot.z : drv.z); if (b) setPin(b.name, b.corner.x, b.corner.z); return b; };
      let last = -1;
      await syUntil(() => { const n = syMine().length; if (n !== last) { last = n; if (n < 3) pinNext(); } return n >= 3; }, 'Hold 3 blocks (take two more: clear each corner and stand on it)', 'Tier 3 · Three Blocks');
      syMeter('streets', 6, 'Three blocks'); syMeter('heat', 4);
      text('throttle', `${syFlag('setName') || 'Them east side boys'} got 3 blocks now. City getting small 😳`);
      syNote('Your set holds three blocks.');
    },
  ], { label: 'Tier 3 · Three Blocks', delay: 40 });

  mis('t3j', 3, 'Tier 3', 'The Hit', 'Somebody is coming for you tonight. Where you sleep.', [
    async () => {
      const ally = (syFlag('saintAlly') || 0) > 0;
      setTime('night');
      if (ally) await call('saint', [['saint', 'Listen. Lalo and four of them going to your grandmother\'s street tonight. I couldn\'t stop it.'], ['saint', 'I\'m coming too. On your side. Don\'t shoot me.']], { mustAnswer: true });
      else await call('mama', [['mama', 'Baby there\'s a car been going up and down the street with the lights off. Three times now.'], ['mama', 'I\'m scared. Come home.']], { mustAnswer: true });
      const s = sySide(1440, -238, 1, 2.6);
      await reach(s.x, s.z, 40, "Big Mama's house", { obj: 'Get to Big Mama\'s house. Now.' });
      if (ally) { actor('saint', s.x + 3, s.z + 2, 0); face('saint', s.x + 40, s.z); }
      const ens = await sySlide('northside', s.x, s.z, ally ? 3 : 4); SY.slide = ens;
      toast('Northside is on Big Mama\'s street.', 'bad');
      await syUntil(() => !syAlive(ens).length, `Protect Big Mama's house: drop the shooters`, 'Tier 3 · The Hit');
      SY.slide = null; actor('mama', s.x, s.z, 0);
      await cut(async () => {
        faceEach('me', 'mama'); SY.actors.get('mama').pose = 'cross'; ots('me', 'mama');
        await lines([['mama', 'They shot my front window out. My front window. Where I sit and read my Bible.'], ['mama', 'Your brother never brought it to my door. Not one time in nine years.']]);
        if (ally) { face('saint', foot.x, foot.z); two('me', 'saint', 1, 3.8); await lines([['saint', 'That was my family that did that. I\'m sorry, ma\'am.'], ['mama', 'Sorry don\'t fix glass, baby. But thank you for standing in front of it.']]); }
        close('mama'); SY.actors.get('mama').pose = null;
        const i = await choose([{ t: 'I\'ll move you somewhere safe. Tonight.', tone: 'protect', d: { family: 4 } }, { t: 'It won\'t happen again. I promise.', tone: 'promise', d: { family: 2 } }, { t: 'This is what the life is, Mama.', tone: 'cold', d: { family: -6, streets: 3 } }], { timer: 14 });
        syFlag('hit', i);
        await say('mama', i === 0 ? 'I\'m not leaving this house. Your granddaddy built this porch.' : i === 1 ? 'Don\'t promise me. Your brother promised me.' : 'Then I don\'t want no part of your life.');
      });
      unactAll(); setTime('day');
      if (syH()) hBeef('northside', ally ? 10 : 30);
      syNote('Northside shot up Big Mama\'s house the night of the hit.' + (ally ? ' Saint stood on your side against his own cousins.' : ''));
    },
  ], { label: 'Tier 3 · The Hit', delay: 70 });

  mis('t3k', 3, 'Tier 3', 'Oak Cliff Calling', 'Lou heard about the blocks. He has an offer.', [
    async () => {
      await call('lou', [['lou', 'Three blocks and you held them against Chuy\'s people. People in Dallas talk about you now.'], ['lou', 'I\'m done fronting you zips like a kid. You want to buy weight, real weight, you come to Oak Cliff. Bring a car with a stash spot.']], { mustAnswer: true });
      const st = sy();
      await cut(async () => {
        const [mx, mz] = syMe(); shot([mx + 8, 6, mz + 8], [mx, 1.2, mz], { to: [mx + 14, 12, mz + 14], dur: 8 });
        await syTitle('TIER 3 COMPLETE', 'THE BLOCK', `${syFlag('setName') || 'Your set'} holds ${syMine().length} blocks.`, 3.4);
        await syTitle('NEXT', 'TIER 4 · THE PLUG', 'Oak Cliff. Weight. I-30.', 2.6);
      });
      st.tier = 4; syMeter('streets', 6, 'The Block'); save(); syMeet('lou');
      syNote('Lou wants to sell to you directly in Oak Cliff. He says to bring a car with a stash spot.');
    },
  ], { label: 'Tier 3 · Oak Cliff Calling', delay: 80 });

  // ---------- LIFE: Block Boss (Mook). Opens after your first block ----------
  mis('b1', 3, 'Block boss', 'Colors', 'A set needs colors people can see from a block away.', [
    async () => {
      const h = syH(); if (!h || h.set !== 'own') { text('mook', 'You riding for somebody else set. Block boss is for people with they own name. Start one at the Hood app or in the story.'); throw SY_FAIL('You need your own set for this life.'); }
      await call('mook', [['mook', 'People see us and don\'t know who we are. We need colors.']]);
      const i = await choose([['Purple', '#9b5cff'], ['Orange', '#ff6a3a'], ['Teal', '#3dd1a0'], ['Pink', '#ff3ea5']].map(c => ({ t: c[0] })), { timer: 20, q: 'Your set\'s color' });
      h.own.color = ['#9b5cff', '#ff6a3a', '#3dd1a0', '#ff3ea5'][i]; save(); if (typeof bmDirty === 'function' && BM.open) bmDirty();
      toast(`${h.own.name} wears ${['purple', 'orange', 'teal', 'pink'][i]} now. Look at the map.`, 'good');
      syNote(`Your set's color is ${['purple', 'orange', 'teal', 'pink'][i]}.`);
    },
  ], { label: 'Block boss · Colors', life: 'block', delay: 0 });
  mis('b2', 3, 'Block boss', 'Put In Work', 'Your homies want to see the boss put in work with them.', [
    async () => {
      const h = syH(); const d0 = h ? h.stats.drops : 0;
      text('mook', 'Homies want to see you put in work. Hemphill been talking crazy on Throttle');
      const nb = syBlockFor(foot.x, foot.z, 'hemphill'); if (nb) setPin(nb.name, nb.corner.x, nb.corner.z);
      await syUntil(() => { const H = syH(); return H && H.stats.drops >= d0 + 3; }, `Drop 3 Hemphill Boyz${nb ? ' at ' + nb.name : ''}`, 'Block boss · Put In Work');
      syMeter('streets', 4, 'Put in work'); syMeter('loyalty', 3);
      syNote('You put in work against Hemphill with your homies.');
    },
  ], { label: 'Block boss · Put In Work', life: 'block', delay: 0 });
  mis('b3', 3, 'Block boss', 'Five Blocks', 'Five blocks and your set is on every map in the city.', [
    async () => {
      const pinNext = () => { const b = syBlockFor(foot.on ? foot.x : drv.x, foot.on ? foot.z : drv.z); if (b) setPin(b.name, b.corner.x, b.corner.z); };
      let last = -1;
      await syUntil(() => { const n = syMine().length; if (n !== last) { last = n; if (n < 5) pinNext(); } return n >= 5; }, 'Hold 5 blocks', 'Block boss · Five Blocks');
      syMeter('streets', 6, 'Five blocks');
      text('throttle', `${syFlag('setName') || 'East side'} on 5 blocks now. Thats a whole side of town`);
      syNote('Your set holds five blocks.');
      text('narr', 'More of the Block boss life comes with the next story update.', { quiet: true });
    },
  ], { label: 'Block boss · Five Blocks', life: 'block', delay: 0 });

  // ---------- LIFE: Land and Cattle (Uncle Bo). Opens after you visit him ----------
  mis('c1', 3, 'Land and cattle', 'First Head', 'Bo says a man with cattle has a reason to wake up early.', [
    async () => {
      await call('bo', [['bo', 'You want to learn? Buy ten head at the Joshua sale barn. Fourteen thousand. Don\'t let them sell you a sick one.']], { mustAnswer: true });
      const c0 = S.cattle || 0, p = DATA.P.find(x => x.id === 'salebarn') || { x: 580, z: 4518 };
      setPin('Joshua Livestock Auction', p.x, p.z);
      await syUntil(() => (S.cattle || 0) >= c0 + 10, 'Buy 10 head at Joshua Livestock Auction (walk in, Auction desk)', 'Land and cattle · First Head');
      text('bo', 'Ten head. Thats a start. Now you a cattleman with a record lol');
      syMeter('clean', 6, 'Cattle'); syMeter('family', 2);
      syNote('You bought your first ten head of cattle at the Joshua sale barn.');
    },
  ], { label: 'Land and cattle · First Head', life: 'land', delay: 0 });
  mis('c2', 3, 'Land and cattle', 'Hog Dogs', 'Bo\'s dogs are the best in Johnson County. He wants to see yours.', [
    async () => {
      await call('bo', [['bo', 'Hogs tearing up the whole county. Get you a catch dog at Cross Timbers and run him.']]);
      const h0 = sy().hunts || 0, p = DATA.P.find(x => x.id === 'dog_kennel') || { x: 380, z: 4482 };
      setPin('Cross Timbers Hog Dogs', p.x, p.z);
      await syUntil(() => (S.dogs || 0) > 0 && (sy().hunts || 0) > h0, 'Get a dog at Cross Timbers Hog Dogs and run the dogs on hogs', 'Land and cattle · Hog Dogs');
      text('bo', 'Thats a good dog. Smoke had one named Lil Smoke. Ran off chasing a boar in 2019');
      syMeter('family', 2); syNote('You ran your own hog dogs for the first time.');
    },
  ], { label: 'Land and cattle · Hog Dogs', life: 'land', delay: 0 });
  mis('c3', 3, 'Land and cattle', 'By the Windmill', 'Bo thinks you might be ready.', [
    async () => {
      const ready = (sy().meters.heat || 0) < 60 || syFlag('bo') === 0;
      await call('bo', ready ? [['bo', 'You been coming out here. Working. Not bringing trouble to my gate.'], ['bo', 'Bring a shovel. I\'ll show you where.']] : [['bo', 'Cops been by asking about you. Twice.'], ['bo', 'Come anyway. Your brother would want you to have it before they get it.']], { mustAnswer: true });
      const p = DATA.P.find(x => x.id === 'land_homestead') || { x: 18, z: 4090 }, wx = p.x + 120, wz = p.z + 40;
      actor('bo', wx + 1.6, wz + 1, 0);
      await talkTo('bo', 'Dig with', { obj: 'Meet Uncle Bo at the windmill on his land', pin: 'The windmill', r: 4 });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'bo'); two('me', 'bo', 1, 3.6);
        await lines([['narr', 'Two feet down, the shovel hits a duffel bag wrapped in a feed sack.'], ['narr', 'Inside: rubber-banded cash, a cheap flip phone, and a business card.'], ['bo', 'What\'s the card say?']]);
        close('me', -1); await lines([['me', '"Special Agent R. Garza. Drug Enforcement Administration." There\'s a date on the back. The night Smoke died.']]);
        close('bo', 1, 1.8); await say('bo', 'Lord. Your brother wasn\'t meeting no plug that night. He was meeting the law.');
        ots('me', 'bo');
        i = await choose([{ t: 'Keep it quiet. Nobody knows about this card.', tone: 'quiet', d: { loyalty: 1 } }, { t: 'I need to find Garza.', tone: 'find', d: { heat: 2 } }, { t: 'Smoke was a snitch?', tone: 'angry', d: { streets: 2, family: -2 } }], { timer: 14 });
        syFlag('garzaCard', i);
        close('bo', -1, 1.8); await say('bo', i === 2 ? 'Your brother was trying to get out. That\'s all I know. Don\'t you put that word on him.' : 'Whatever you do, do it slow. Whoever killed him knows about that meeting.');
      });
      earn(25000, 'Smoke\'s duffel bag'); unactor('bo');
      syNote('By Uncle Bo\'s windmill: Smoke\'s duffel bag with $25,000, a flip phone, and DEA Special Agent R. Garza\'s card dated the night Smoke died. Smoke was going to meet the DEA after the race.');
      text('narr', 'More of the Land and cattle life comes with the next story update.', { quiet: true });
    },
  ], { label: 'Land and cattle · By the Windmill', life: 'land', delay: 0 });

  // ---------- LIFE: Music Mogul (Virgil, VirL Studios). Smoke's 11 unreleased songs; uses the record label system (label(), lbStart, lbSigned) ----------
  const SY_ALBUM_TITLES = ['Before Ironline', 'Stop Six Saint', 'Darius'];
  // Smoke's album pays out every night you sleep, like the label's releases (story-only record, not an artist on your roster)
  {
    const _syAlbSleep = sleep;
    sleep = function () {
      const r = _syAlbSleep.apply(this, arguments);
      try {
        const A = S.story && S.story.album; if (A && A.out && A.daily > 200) {
          const pay = Math.round(A.daily * 0.01 * (A.split || 1)); A.total += A.daily; A.daily = Math.round(A.daily * 0.93); S.bank += pay; A.earned = (A.earned || 0) + pay;
          if (!A.gold && A.total >= 500000) { A.gold = 1; text('virgil', `${A.title} just went GOLD. Half a million. Smoke would have lost his mind`); syMeter('clean', 6, 'Gold record'); }
          save();
        }
      } catch (e) { console.warn('story album: ' + e.message); }
      return r;
    };
  }
  const syLabel = () => (typeof label === 'function' ? label() : null);

  mis('m1', 3, 'Music mogul', 'The Vault', 'Virgil has eleven of Smoke\'s songs nobody has ever heard.', [
    async () => {
      if (syFlag('wash') !== 'virl') text('virgil', 'This Virgil from VirL. Smoke left songs in my vault. Eleven of them. Come hear your brother');
      else await call('virgil', [['virgil', 'You been washing money through my studio. Least I can do is play you what\'s in the vault.']]);
      const p = DATA.P.find(x => x.id === 'virl_studios') || { x: 225, z: 137 }, [ox, oz] = outDir(p);
      actor('virgil', p.x + ox * 4, p.z + oz * 4, 0);
      await talkTo('virgil', 'Talk to', { obj: 'Go to VirL Studios', pin: 'VirL Studios' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'virgil'); two('me', 'virgil', 1, 3.4);
        await lines([['virgil', 'He cut these at two in the morning, after the strip. Every one of them.'], ['narr', 'Virgil presses play. Smoke\'s voice fills the room. A song about Big Mama\'s porch. A song about a little brother in Huntsville.'], ['virgil', 'Track six is about you. He never let me mix it.']]);
        close('virgil', 1, 1.8);
        await lines([['virgil', 'I can\'t put these out. They\'re his, so now they\'re yours.'], ['virgil', 'But you\'d need a label. Paperwork, distribution, a name on the back of the album.']]);
        ots('me', 'virgil');
        i = await choose([{ t: 'Then I\'m starting a label.', tone: 'mogul', d: { clean: 4 } }, { t: 'Leave them in the vault. They\'re his.', tone: 'keep' }], { timer: 16 });
        close('virgil', -1, 1.8); await say('virgil', i === 0 ? 'Smoke said you was the smart one. Twenty-five thousand gets you the paperwork.' : 'Okay. They\'ll be here. They ain\'t going nowhere.');
      });
      unactor('virgil'); syMeet('virgil');
      if (i === 1) { syNote('You heard Smoke\'s 11 unreleased songs at VirL Studios. Track six is about you.'); throw SY_FAIL('Come back when you\'re ready to put them out.'); }
      const L = syLabel();
      if (L && !L.name) {
        await syUntil(() => S.cash + S.bank >= 25000, 'Get $25,000 to start the label (cash or bank)');
        const names = ['Smoke Season Records', 'Six Side Music', 'Ramey Ave Records'];
        const j = await choose(names.map(n => ({ t: n })), { timer: 20, q: 'Name your label' });
        const r = lbStart(names[j]); toast(r.text, r.ok ? 'good' : 'bad');
      }
      syNote(`You started ${syLabel() && syLabel().name || 'a label'} to put out Smoke's songs.`);
    },
  ], { label: 'Music mogul · The Vault', life: 'music', delay: 0 });

  mis('m2', 3, 'Music mogul', "Smoke's Album", 'Eleven songs. Mix them, name the album, put it out.', [
    async () => {
      await call('virgil', [['virgil', 'Mixing and mastering eleven songs right is eight thousand. I\'ll get my best engineer on it.'], ['virgil', 'And we need a title. Something he would have said.']]);
      await syUntil(() => S.cash >= 8000, 'Get $8,000 for mixing and mastering');
      const i = await choose(SY_ALBUM_TITLES.map(t => ({ t })), { timer: 20, q: 'Name Smoke\'s album' });
      spend(8000, 'Smoke\'s album: mix and master');
      const st = sy(); st.album = { title: SY_ALBUM_TITLES[i], out: 0, daily: 0, total: 0, split: 1 }; save();
      const p = DATA.P.find(x => x.id === 'virl_studios') || { x: 225, z: 137 }, [ox, oz] = outDir(p);
      actor('virgil', p.x + ox * 4, p.z + oz * 4, 0); actor('mama', p.x + ox * 4 + oz * 2, p.z + oz * 4 - ox * 2, 0);
      await talkTo('virgil', 'Listen with', { obj: 'Release night at VirL Studios. Big Mama came.', pin: 'VirL Studios' });
      await cut(async () => {
        setTime('night'); faceEach('me', 'virgil'); face('mama', foot.x, foot.z); two('me', 'mama', 1, 3.6);
        await lines([['mama', 'I ain\'t never been in a studio. It\'s cold in here.'], ['virgil', 'Three, two, one. It\'s live.'], ['narr', `"${SY_ALBUM_TITLES[i]}" by Smoke is out everywhere.`]]);
        close('mama'); await lines([['mama', 'That\'s my baby. That\'s my baby singing.']]);
        await syTitle('OUT NOW', SY_ALBUM_TITLES[i].toUpperCase(), 'Smoke · the album', 3);
      });
      st.album.out = 1; st.album.day = S.day; st.album.daily = 60000; save();
      unactAll(); setTime('day'); syMeter('family', 6, 'Smoke\'s album'); syMeter('streets', 3);
      text('throttle', `SMOKE ALBUM DROPPED 😭🕊 "${SY_ALBUM_TITLES[i]}" go stream it east side`);
      syNote(`You released Smoke's album "${SY_ALBUM_TITLES[i]}". It pays out every night you sleep.`);
    },
  ], { label: 'Music mogul · Smoke\'s Album', life: 'music', delay: 0 });

  mis('m3', 3, 'Music mogul', 'First Signing', 'A label with one dead artist is a memorial. Sign somebody alive.', [
    async () => {
      const L = syLabel(); const n0 = L ? L.roster.length : 0;
      text('virgil', 'Smoke album bringing people to the studio. Open the Label app, go meet somebody in person, and sign them');
      await syUntil(() => { const l = syLabel(); return !!l && l.roster.length > n0; }, 'Sign an artist to your label (Label app: Scene, then meet them in person)', 'Music mogul · First Signing');
      syMeter('clean', 4, 'Signed an artist');
      const r = syLabel().roster[syLabel().roster.length - 1], a = r && LB_BY[r.id];
      text('throttle', `${syLabel().name} just signed ${a ? a.name : 'somebody new'} 🎤 Smoke lil brother building something`);
      syNote(`You signed ${a ? a.name : 'your first artist'} to ${syLabel().name}.`);
    },
  ], { label: 'Music mogul · First Signing', life: 'music', delay: 0 });

  mis('m4', 3, 'Music mogul', 'Half the Studio', 'Somebody owns half of VirL. Virgil has been afraid to say who.', [
    async () => {
      await call('virgil', [['virgil', 'I need to tell you something before you hear it somewhere else. Come by. Not on the phone.']], { mustAnswer: true });
      const p = DATA.P.find(x => x.id === 'virl_studios') || { x: 225, z: 137 }, [ox, oz] = outDir(p);
      actor('virgil', p.x + ox * 4, p.z + oz * 4, 0);
      await talkTo('virgil', 'Talk to', { obj: 'Go to VirL Studios. Virgil won\'t say it on the phone.', pin: 'VirL Studios' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'virgil'); ots('me', 'virgil');
        await lines([['virgil', 'In 2019 I was going under. A man walked in and paid off my notes. All of them.'], ['virgil', 'He owns fifty percent of this building. Of the vault. Of Smoke\'s masters.']]);
        close('virgil', 1, 1.8); await lines([['virgil', 'Deacon Hollis.'], ['virgil', 'His lawyer called this morning. He wants half of everything Smoke\'s album makes.']]);
        ots('me', 'virgil');
        i = await choose([{ t: 'Buy him out. Whatever it costs.', tone: 'buy out', d: { clean: 4 } }, { t: 'Give him his half. Not worth the war.', tone: 'pay', d: { loyalty: -2 } }, { t: 'Move the masters. Tonight.', tone: 'steal', d: { streets: 4, heat: 4 } }], { timer: 14 });
        syFlag('hollisMasters', i);
        close('virgil', -1, 1.8); await say('virgil', i === 0 ? 'He\'ll want a hundred thousand. And he\'ll know it\'s you.' : i === 1 ? 'Then he gets paid off your brother twice.' : 'I didn\'t hear that. I didn\'t see nothing.');
      });
      unactor('virgil');
      const st = sy();
      if (i === 0) {
        await syUntil(() => S.cash + S.bank >= 100000, 'Get $100,000 to buy Hollis out of VirL (cash or bank)');
        const fromBank = Math.max(0, 100000 - S.cash); S.bank -= fromBank; S.cash -= 100000 - fromBank; S.log.unshift('-$100,000 Bought Hollis out of VirL'); save(); refreshStats();
        text('hollis', 'You paid full price for something that was mine. Your brother did that too.');
        syNote('You bought Deacon Hollis out of VirL Studios for $100,000. Smoke\'s masters are yours.');
      } else if (i === 1) { if (st.album) st.album.split = 0.5; save(); syNote('You let Hollis keep half of Smoke\'s album money. He owns 50% of VirL Studios.'); }
      else { syFlag('mastersMoved', 1); text('hollis', 'Interesting thing happened at VirL last night. Tapes went missing. I hope you have a good lawyer, son.'); syNote('You moved Smoke\'s masters out of VirL in the middle of the night. Hollis knows it was you.'); }
      text('narr', 'More of the Music mogul life comes with the next story update.', { quiet: true });
    },
  ], { label: 'Music mogul · Half the Studio', life: 'music', delay: 0 });

  // ---------- LIFE: Car boss (Rusty). Own the shop, then Hook & Haul, then a lot of your own in Stop Six. Income pays out every night you sleep ----------
  const syCars = () => { const st = sy(); return st.cars || (st.cars = { shop: '', tow: 0, lot: 0, earned: 0, days: 0 }); };
  const syCarsDaily = () => { const c = sy().cars; if (!c) return 0; return (c.shop ? 1500 : 0) + (c.tow ? 2500 : 0) + (c.lot ? 5000 : 0); };
  {
    const _syCarSleep = sleep;
    sleep = function () {
      const r = _syCarSleep.apply(this, arguments);
      try {
        const c = S.story && S.story.cars, pay = syCarsDaily();
        if (c && pay > 0) {
          const day = Math.round(pay * (0.8 + Math.random() * 0.4)); S.bank += day; c.earned = (c.earned || 0) + day; c.days = (c.days || 0) + 1;
          S.log.unshift(`+${money(day)} ${c.shop || 'Your shop'}${c.tow ? ' + Hook & Haul' : ''}${c.lot ? ' + the lot' : ''}`); toast(`🔧 Your businesses made ${money(day)} while you slept (bank).`, 'good');
          if (c.days === 7) text('rusty', `First week in the books. ${money(c.earned)} clean. Smoke never had a week like that with a wrench in his hand`);
          save();
        }
      } catch (e) { console.warn('story cars: ' + e.message); }
      return r;
    };
  }
  const syLotName = () => ((sy().cars && sy().cars.shop) || 'Six Side Customs').replace(/ (Customs|Auto|Garage)$/, '') + ' Auto Sales';
  const syPlace = (id, fx, fz) => { const p = DATA.P.find(x => x.id === id) || { x: fx, z: fz }, [ox, oz] = outDir(p); return { p, ox, oz }; };

  mis('k1', 3, 'Car boss', "Rusty's Keys", 'Rusty is tired. Forty years under a hood. He wants you to have the shop.', [
    async () => {
      await call('rusty', [['rusty', 'Come by the shop. I got something to say and I only want to say it once.']], { mustAnswer: true });
      const { p, ox, oz } = syPlace('rusty_used', -75, 463);
      actor('rusty', p.x + ox * 4, p.z + oz * 4, 0);
      await talkTo('rusty', 'Talk to', { obj: 'Go see Rusty at Rusty\'s Used Autos', pin: "Rusty's Used Autos" });
      let i = 0; const cost = syFlag('wash') === 'rusty' ? 30000 : 40000;
      await cut(async () => {
        faceEach('me', 'rusty'); wide(foot.x, foot.z, foot.yaw + Math.PI * 0.5, 11, 3.6); await syWait(1.4);
        two('me', 'rusty', 1, 3.4);
        await lines([['rusty', 'My back is done. My knees been done. My daughter wants me in Galveston, fishing.'], ['rusty', 'I built every car your brother ever raced in this bay. I ain\'t selling it to some kid from Southlake.']]);
        close('rusty', 1, 1.8); await lines([['rusty', `${money(cost)}. The building, the lifts, the tools, the customers. Name on the sign is yours.`]]);
        ots('me', 'rusty');
        i = await choose([{ t: 'Shake his hand. It\'s mine.', tone: 'buy', d: { clean: 4, family: 2 } }, { t: 'Not yet. I got other things going.', tone: 'wait' }], { timer: 16 });
        close('rusty', -1, 1.8); await say('rusty', i === 0 ? 'That\'s what I wanted to hear. Bring the money and we\'ll do the paper.' : 'Don\'t wait too long. Galveston ain\'t going nowhere but I am.');
      });
      if (i === 1) { unactor('rusty'); syNote('Rusty offered you his shop. You told him not yet.'); throw SY_FAIL('Come back when you\'re ready to take Rusty\'s shop.'); }
      await syUntil(() => S.cash + S.bank >= cost, `Get ${money(cost)} to buy Rusty's shop (cash or bank)`);
      const fromBank = Math.max(0, cost - S.cash); S.bank -= fromBank; S.cash -= cost - fromBank; S.log.unshift(`-${money(cost)} Bought Rusty's shop`); refreshStats();
      const names = ['Six Side Customs', 'Ramey Ave Auto', "Smoke's Garage"];
      const j = await choose(names.map(n => ({ t: n })), { timer: 20, q: 'Name the shop' });
      const c = syCars(); c.shop = names[j]; save();
      await cut(async () => {
        faceEach('me', 'rusty'); two('me', 'rusty', -1, 3.2);
        await lines([['rusty', 'Keys. Alarm code is Smoke\'s birthday. It always was.'], ['narr', `Rusty takes down his sign. A new one goes up: ${names[j].toUpperCase()}.`]]);
        await syTitle('NOW OPEN', names[j].toUpperCase(), 'Car boss · your first business', 3);
      });
      unactor('rusty'); syMeter('clean', 5, 'Bought the shop'); syMeter('family', 3);
      text('mama', `Rusty told me. ${names[j]}. Lord, a business. I'm proud of you baby`);
      syNote(`You bought Rusty's shop and named it ${names[j]}. It makes money every night you sleep.`);
    },
  ], { label: "Car boss · Rusty's Keys", life: 'cars', delay: 0 });

  mis('k2', 3, 'Car boss', 'Hook & Haul', 'A shop needs cars coming in. Earl at Hook & Haul is ready to sell.', [
    async () => {
      await call('earl', [['earl', 'Earl Tate, Hook & Haul. Rusty said you might want some trucks.'], ['earl', 'I\'m sixty-eight. My boy don\'t want it. Come look.']]);
      const { p, ox, oz } = syPlace('hook_haul', 675, 137);
      actor('earl', p.x + ox * 4, p.z + oz * 4, 0);
      await talkTo('earl', 'Talk to', { obj: 'Go to Hook & Haul Towing', pin: 'Hook & Haul Towing' });
      await cut(async () => {
        faceEach('me', 'earl'); two('me', 'earl', 1, 3.4);
        await lines([['earl', 'Four trucks, the yard, and the city rotation list. Every wreck on I-30 and Loop 820, we get a call.'], ['earl', 'Sixty thousand. And one more thing you ought to know.']]);
        close('earl', 1, 1.8); await lines([['earl', 'Hollis Motors pays me to move cars at night. No paperwork. I never asked. You might want to.']]);
      });
      unactor('earl'); syMeet('earl');
      await syUntil(() => S.cash + S.bank >= 60000, 'Get $60,000 to buy Hook & Haul (cash or bank)');
      const fromBank = Math.max(0, 60000 - S.cash); S.bank -= fromBank; S.cash -= 60000 - fromBank; S.log.unshift('-$60,000 Bought Hook & Haul Towing'); refreshStats();
      const c = syCars(); c.tow = 1; save();
      toast('🛻 Hook & Haul is yours. Wrecks go to your shop now.', 'good');
      // the first night call: a Hollis car on the side of I-30
      text('earl', 'Night call. Dealer car broke down on I-30 by the Beach St exit. Hollis job. You want to ride on this one');
      const wx = 2900, wz = -1333;
      let wreck = null; try { wreck = putCar(scene, 'dodge_charger_scat_pack_2015', '#0b0b0d'); wreck.position.set(wx, 0, wz); wreck.rotation.y = Math.PI / 2 + 0.08; } catch (e) {}
      setTime('night');
      await reach(wx, wz + 12, 18, 'Broken-down dealer car (I-30)', { obj: 'Drive to the broken-down Hollis car on I-30' });
      let i = 0;
      await cut(async () => {
        placeMe(wx + 2.5, wz + 4.5, Math.PI); face('me', wx, wz); wide(wx, wz, Math.PI * 0.25, 10, 3.5); await syWait(1.2);
        await lines([['narr', 'A black Charger with a dealer plate. Hood up. Nobody with it. The driver\'s door panel is loose.'], ['narr', 'Behind the panel: shrink-wrapped cash. Lots of it. And a bill of lading for a hauler going to Laredo.']]);
        shot([wx + 3, 1.6, wz + 3], [wx, 0.8, wz]);
        i = await choose([{ t: 'Tow it to Hollis. Touch nothing.', tone: 'deliver', d: { loyalty: 2, clean: 2 } }, { t: 'Take the cash.', tone: 'take', d: { streets: 4, heat: 6 } }, { t: 'Photograph everything for Nia.', tone: 'photos', d: { clean: 2, heat: 2 } }], { timer: 14 });
      });
      setTime('day'); if (wreck) { wreck.userData.dead = true; scene.remove(wreck); try { CARS3D.slots.delete(wreck); } catch (e) {} }
      syFlag('haulerCar', i);
      if (i === 0) { S.bank += 5000; text('hollis', 'Earl\'s new owner delivered my car without a scratch. Five thousand is in your account. I remember people who know how to not look.'); syNote('You towed a Hollis car full of cash back to him and didn\'t look. He paid you $5,000.'); }
      else if (i === 1) { S.cash += 22000; refreshStats(); text('hollis', 'A car of mine came back light last night. Twenty-two thousand light. Your tow company, son. Think about that.'); syNote('You took $22,000 out of a Hollis car on I-30. He knows it was your truck.'); }
      else { syFlag('niaPhotos', 1); text('nia', 'Got the pics. Dealer plate, Laredo hauler, cash in the doors. I\'m not posting this. Not yet. This is how they did Smoke'); syNote('You photographed the cash in a Hollis car and sent it to Nia. The hauler was headed to Laredo.'); }
      save();
    },
  ], { label: 'Car boss · Hook & Haul', life: 'cars', delay: 0 });

  mis('k3', 3, 'Car boss', "Smoke's Box Chevy", 'Smoke\'s old Caprice is at auction. Hollis\'s buyer is there too.', [
    async () => {
      await call('rusty', [['rusty', 'You sitting down? Smoke\'s box Chevy. The purple one. It\'s on the auction list at Auto Row tomorrow.'], ['rusty', 'Calloway impounded it the night he died. Now they selling it. And Hollis sent a buyer.']], { mustAnswer: true });
      const { p, ox, oz } = syPlace('auto_row', 75, -163);
      actor('rusty', p.x + ox * 5, p.z + oz * 5, 0); actor('hollis', p.x + ox * 5 + oz * 3, p.z + oz * 5 - ox * 3, 0);
      await talkTo('rusty', 'Stand with', { obj: 'Go to the auction at Cowtown Auto Row', pin: 'Cowtown Auto Row' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'rusty'); face('hollis', foot.x, foot.z); wide(foot.x, foot.z, foot.yaw + Math.PI * 0.6, 12, 4); await syWait(1.4);
        await lines([['narr', 'Lot 31. 1986 Chevrolet Caprice Classic. Purple. Rusty\'s 454 still under the hood.'], ['narr', 'The auctioneer opens at fifteen thousand. Hollis raises one finger without looking at you.']]);
        close('hollis', 1, 1.8); await lines([['hollis', 'Forty-five. It\'s just a car, son.']]);
        ots('me', 'hollis');
        i = await choose([{ t: 'Sixty-five thousand.', tone: 'outbid', d: { family: 4, streets: 2 } }, { t: 'Forty-six. (he\'ll go higher)', tone: 'test him' }, { t: 'Let him have it.', tone: 'walk', d: { family: -3 } }], { timer: 12 });
        close('hollis', -1, 1.8); await say('hollis', i === 0 ? 'Sentimental. Your brother was too.' : i === 1 ? 'Seventy. You can\'t afford grief, son.' : 'Smart. Cars don\'t love you back.');
      });
      unactor('hollis');
      if (i === 0) {
        await syUntil(() => S.cash + S.bank >= 65000, 'Get $65,000 for Smoke\'s Caprice (cash or bank)');
        const fromBank = Math.max(0, 65000 - S.cash); S.bank -= fromBank; S.cash -= 65000 - fromBank; S.log.unshift('-$65,000 Smoke\'s box Chevy (auction)'); refreshStats();
        const c = newCar('chevrolet_caprice_classic_box_chevy_1986', '#4b1f6e', 82); c.smoke = 1; c.stash = 1;
        if (!S.car) { S.car = c; deliverCar(); } else S.garage.push(c);
        await cut(async () => { faceEach('me', 'rusty'); close('rusty', 1, 1.8); await lines([['rusty', 'Stash spot still in the back seat. Same switch. He never told nobody about that but me.']]); await syTitle('YOURS', "SMOKE'S BOX CHEVY", '1986 Caprice Classic · purple', 3); });
        syMeter('family', 4, 'Got Smoke\'s car back'); syFlag('smokeCar', 1);
        text('throttle', 'SMOKE PURPLE BOX BACK ON THE EAST SIDE 💜🕊 his lil brother got it at auction');
        syNote('You outbid Hollis at the auction and got Smoke\'s purple box Chevy back. It\'s in your garage.');
      } else { syFlag('smokeCar', 0); text('rusty', 'Hollis got it. He gon park it at the dealership like a trophy. I know he will'); syNote('Hollis bought Smoke\'s purple box Chevy at auction. It sits in his showroom.'); }
      unactor('rusty'); save();
    },
  ], { label: "Car boss · Smoke's Box Chevy", life: 'cars', delay: 0 });

  mis('k4', 3, 'Car boss', 'The Lot', 'A car lot of your own, in Stop Six. Two blocks from where you grew up.', [
    async () => {
      text('rusty', 'Empty lot on the east side by Stalcup. City selling it cheap. Cars from your yard, sold off your lot. That\'s how Hollis started');
      const { p } = syPlace('land_stopsix', 2265, -293);
      await syUntil(() => S.cash + S.bank >= 120000, 'Get $120,000 for the lot and the first cars (cash or bank)');
      await reach(p.x, p.z, 16, 'Empty Lot · Stop Six', { obj: 'Go to the empty lot in Stop Six' });
      const fromBank = Math.max(0, 120000 - S.cash); S.bank -= fromBank; S.cash -= 120000 - fromBank; S.log.unshift('-$120,000 Your car lot in Stop Six'); refreshStats();
      const c = syCars(); c.lot = 1; save();
      actor('rusty', p.x + 3, p.z + 2, 0); actor('mook', p.x - 3, p.z + 2, 0); actor('mama', p.x, p.z + 4, 0);
      await cut(async () => {
        setTime('sunset'); face('rusty', foot.x, foot.z); face('mook', foot.x, foot.z); face('mama', foot.x, foot.z);
        wide(p.x, p.z, Math.PI * 0.3, 16, 5); await syWait(1.6);
        await lines([['narr', `Thirty cars under string lights. A sign: ${syLotName().toUpperCase()}. Buy here, pay here.`], ['mook', 'Big Mama brought a pound cake. To a car lot.']]);
        two('me', 'mama', 1, 3.4); await lines([['mama', 'Your granddaddy sold cars off a lot like this on Rosedale. Nobody remembers that but me.']]);
        await lines([['narr', 'A black Escalade rolls by slow. The window comes down halfway. Hollis looks at the sign, then at you. The window goes back up.']]);
        close('rusty', 1, 1.8); await lines([['rusty', 'He seen it. Good. Two dealers in this city, and one of them is family.']]);
        await syTitle('GRAND OPENING', syLotName().toUpperCase(), 'Shop · Hook & Haul · the lot', 3);
      });
      unactAll(); setTime('day');
      syMeter('clean', 6, 'Opened the lot'); syMeter('family', 3); syMeter('streets', 2);
      text('hollis', 'Buy here, pay here. In Stop Six. That\'s cute. I\'ve been selling cars in this city since before you were born.');
      text('throttle', 'NEW CAR LOT ON THE EAST SIDE 🚗 Smoke lil brother own the shop, the tow trucks AND the lot now');
      syNote(`You opened a car lot in Stop Six. With the shop and Hook & Haul, your businesses make about ${money(syCarsDaily())} a night.`);
      text('narr', 'More of the Car boss life comes with the next story update.', { quiet: true });
    },
  ], { label: 'Car boss · The Lot', life: 'cars', delay: 0 });

  // ---------- TIER 4: The Plug. Runs to Oak Cliff and back with weight in the car; FWPD/DPS on the way (COP) ----------
  const SY_LOU_SPOT = 'gas_oakcliff';
  // the police and jail modules live in their own scopes; reach them through what they expose
  const syCops = () => window.__cops || { COP: { phase: 'none', stop: null } };
  const syBusted = () => { const J = window.__jail; return !!(J && J.jBusy && J.jBusy()); };
  const syHeatUp = n => { S.heat = Math.min(5, (S.heat || 0) + n); const C = syCops(); if (C.COP) C.COP.heat0 = S.heat; refreshStats(); };
  const syStash = () => !!(S.car && S.car.stash);
  // one run: pay, pick up at the Gas-N-Go in Oak Cliff, drive it back to Ramey Ave without getting busted
  async function syLoadRun(o = {}) {
    const st = sy(), cost = o.cost || 20000, n = o.n || 300;
    const p = DATA.P.find(x => x.id === SY_LOU_SPOT) || { x: 4937, z: -975 }, [ox, oz] = outDir(p);
    await syUntil(() => S.cash >= cost, `Get ${money(cost)} for the load${o.label ? ' (' + o.label + ')' : ''}`);
    await syUntil(() => driving && !foot.on && !!S.car, 'Get in your car');
    if (!syStash() && !o.noWarn) text('dre', 'No stash spot? You crazy. Anything happen thats on you');
    await reach(p.x + ox * 8, p.z + oz * 8, 18, 'Gas-N-Go (Oak Cliff)', { obj: o.pickObj || 'Drive to the Gas-N-Go in Oak Cliff for the pickup' });
    spend(cost, 'Lou: the load'); SY.run = { n, chased: false, busted: false, searched: false }; st.carry = n; save();
    toast(`${n} in the ${syStash() ? 'stash spot' : 'trunk'}. Drive it home.`, 'good');
    if (o.onLoaded) await o.onLoaded();
    const T = syTrap('ramey') || syOpenTrap('ramey'), q = syTrapPos(T);
    setPin('Ramey Ave Trap House', q.x, q.z); syMarker(q.x, q.z, 3);
    try {
      await syUntil(() => {
        const R = SY.run, COP = syCops().COP; if (!R) return true;
        if (syBusted()) R.busted = true;
        if (R.busted) throw SY_FAIL('Busted with the load. It\'s gone, and Lou still got paid.');
        if (COP.phase === 'chase') R.chased = true;
        // a traffic stop without a stash spot: the officer looks in the trunk
        if (COP.stop && !R.searched) { R.searched = true; if (!syStash() && Math.random() < 0.6) { syHeatUp(2); syCops().copChase('Officer found narcotics in the trunk.'); toast('He opened the trunk.', 'bad'); } }
        const [mx, mz] = syMe(); return Math.hypot(mx - q.x, mz - q.z) < 14 && COP.phase !== 'chase' && COP.phase !== 'stop' && COP.phase !== 'notice';
      }, o.dropObj || 'Drive the load back to Ramey Ave (don\'t get stopped)', o.sub);
    } catch (e) { st.carry = 0; SY.run = null; syMarkerOff(); throw e; }
    syMarkerOff(); T.stock += n; st.carry = 0; const clean = !SY.run.chased; SY.run = null;
    if (clean) st.cleanRuns = (st.cleanRuns || 0) + 1; st.runs = (st.runs || 0) + 1; save();
    toast(clean ? `Clean run. ${n} in Ramey Ave. (${st.cleanRuns} clean)` : `Made it, but they chased you. ${n} in Ramey Ave.`, clean ? 'good' : '');
    return clean;
  }

  mis('t4a', 4, 'Tier 4', 'Stash Spot', 'Lou says bring a car with a stash spot. Rusty knows how.', [
    async () => {
      await call('rusty', [['rusty', 'Lou called me before he called you. Said you need a trap built.'], ['rusty', 'Bring your car. Hidden compartment behind the back seat, opens with the defrost and the window switch at the same time.']], { mustAnswer: true });
      await syUntil(() => !!S.car, 'Get a car to bring to Rusty');
      const r = DATA.P.find(x => x.id === 'rusty_used') || { x: -75, z: 463 }, [ox, oz] = outDir(r);
      actor('rusty', r.x + ox * 4, r.z + oz * 4, 0);
      const cost = syFlag('wash') === 'rusty' ? 2000 : 3500;
      await syUntil(() => S.cash >= cost, `Get ${money(cost)} for the stash spot`);
      await talkTo('rusty', 'Talk to', { obj: 'Drive your car to Rusty\'s Used Autos', pin: "Rusty's Used Autos" });
      await cut(async () => {
        faceEach('me', 'rusty'); two('me', 'rusty', 1, 3.4);
        await lines([['rusty', 'Took me two days. Smoke\'s car had the same one. Same switch.'], ['rusty', 'Defrost and the window at the same time. A dog might smell it. A cop with a flashlight won\'t find it.']]);
        if (syFlag('wash') === 'rusty') await say('rusty', 'Friend price, since you on my books.');
      });
      spend(cost, 'Rusty: stash spot'); S.car.stash = 1; save(); unactor('rusty');
      syNote('Rusty built a stash spot in your car. Traffic stops won\'t find the load.');
      text('rusty', 'One more thing. I\'m getting old. Come talk to me about the shop sometime. Story app, Lives, Car boss', { quiet: true });
    },
  ], { label: 'Tier 4 · Stash Spot', delay: 40 });

  mis('t4b', 4, 'Tier 4', 'Oak Cliff', 'Kessler Park. Lou\'s house. Your first real buy.', [
    async () => {
      text('lou', 'Kessler Park. Come by the house first. Then the Gas-N-Go for pickups. Never the house again after today');
      const k = DATA.P.find(x => x.id === 'kessler_tudor') || { x: 4787, z: -825 }, [ox, oz] = outDir(k);
      actor('lou', k.x + ox * 5, k.z + oz * 5, 0); actor('dre', k.x + ox * 5 + oz * 2, k.z + oz * 5 - ox * 2, 0);
      await talkTo('lou', 'Talk to', { obj: 'Drive to Big Lou\'s house in Kessler Park, Oak Cliff', pin: 'Kessler Park' });
      await cut(async () => {
        faceEach('me', 'lou'); face('dre', foot.x, foot.z); wide(foot.x, foot.z, foot.yaw + Math.PI * 0.6, 12, 4); await syWait(1.6);
        ots('me', 'lou');
        await lines([['lou', 'This is where Smoke sat every Thursday. Same spot. Twenty thousand, three hundred zips\' worth. You move it, you keep the difference.'], ['lou', 'You get stopped, you don\'t know me. You don\'t know Dre. You don\'t know Oak Cliff.']]);
        close('lou', 1, 1.8); await lines([['lou', 'And I-30 is not your friend. DPS sits at the Six Flags exit every Friday night.']]);
      });
      unactor('lou'); unactor('dre');
      await syLoadRun({ label: 'your first buy', sub: 'Tier 4 · Oak Cliff' });
      syMeter('streets', 5, 'First Oak Cliff run');
      syNote('Your first Oak Cliff run: $20,000 for 300, picked up at the Gas-N-Go, dropped at Ramey Ave.');
    },
  ], { label: 'Tier 4 · Oak Cliff', delay: 50 });

  mis('t4c', 4, 'Tier 4', 'I-30', 'Friday night. DPS at the Six Flags exit. You have a full load.', [
    async () => {
      text('lou', 'Ready when you are. Same place');
      await syLoadRun({ label: 'Friday', sub: 'Tier 4 · I-30', onLoaded: async () => {
        await syWait(6);
        text(syFlag('lookout') ? 'bit' : 'mook', 'DPS just lit somebody up by Six Flags. They pulling EVERYBODY. Take the service road or outrun them');
        if (!SY.fast) { await syWait(20); if (SY.run && syCops().COP.phase === 'none' && syCops().copChase) { syHeatUp(1); syCops().copChase('DPS: vehicle matching a narcotics tip, eastbound I-30.'); } }
      } });
      syMeter('heat', 3); syMeter('streets', 3);
      syNote('You brought a full load home on I-30 on a Friday night with DPS working the Six Flags exit.');
    },
  ], { label: 'Tier 4 · I-30', delay: 60 });

  mis('t4d', 4, 'Tier 4', 'Garza', 'A woman at the pump knows your name. And your brother\'s.', [
    async () => {
      const p = DATA.P.find(x => x.id === SY_LOU_SPOT) || { x: 4937, z: -975 }, [ox, oz] = outDir(p);
      text('lou', 'Pickup at the Gas-N-Go. Come alone');
      actor('garza', p.x + ox * 6 + oz * 3, p.z + oz * 6 - ox * 3, 0);
      await talkTo('garza', 'Talk to', { obj: 'Go to the Gas-N-Go in Oak Cliff. Somebody is waiting at the pump.', pin: 'Gas-N-Go (Oak Cliff)', r: 4 });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'garza'); ots('me', 'garza'); syName('garza');
        await lines([['garza', 'Don\'t look around. Lou\'s people aren\'t here yet. Pump your gas.'], ['garza', 'Special Agent Rosa Garza. DEA. I was supposed to meet your brother at 11:30 the night he died.']]);
        close('garza', 1, 1.8); await lines([['garza', 'He never showed. Three days later the file on him was gone from my office.'], ['garza', 'I\'m not here to arrest you. I\'m here because whoever killed Smoke knew about me before I knew about them.']]);
        ots('me', 'garza');
        i = await choose([{ t: 'You got him killed.', tone: 'blame', d: { streets: 2 } }, { t: 'Who took the file?', tone: 'probe' }, { t: 'I don\'t talk to cops. Walk away.', tone: 'cold', d: { streets: 3, loyalty: 2 } }], { timer: 14 });
        syFlag('garza', i);
        close('garza', -1, 1.8);
        await lines(i === 0 ? [['garza', 'Maybe I did. I think about that every day.'], ['garza', 'My card is in your brother\'s bag, I bet. Call me when you\'re ready to be mad at the right people.']]
          : i === 1 ? [['garza', 'Somebody with a FWPD badge and access to a federal fax machine.'], ['garza', 'You already know who. You met him on Ramey Ave.']]
          : [['garza', 'Your brother said that too. For six years.'], ['garza', 'Then one day he called me.']]);
      });
      unactor('garza'); syMeet('garza');
      syNote(i === 1 ? 'DEA Agent Rosa Garza was supposed to meet Smoke at 11:30 the night he died. His file disappeared from her office. She thinks Calloway took it.' : 'DEA Agent Rosa Garza says she was supposed to meet Smoke at 11:30 the night he died. He never showed, and his file disappeared from her office.');
      await syWait(2);
      await syLoadRun({ label: 'after Garza', sub: 'Tier 4 · Garza', noWarn: true, pickObj: 'Lou\'s people pulled up. Pick up the load at the Gas-N-Go' });
    },
  ], { label: 'Tier 4 · Garza', delay: 70 });

  mis('t4e', 4, 'Tier 4', "Mook's Debt", 'Mook needs fifteen thousand and won\'t say why.', [
    async () => {
      const q = syTrapPos({ id: 'ramey' }); actor('mook', q.x + 1.4, q.z + 0.8, 0); SY.actors.get('mook').pose = 'phone';
      await talkTo('mook', 'Talk to', { obj: 'Mook is at Ramey Ave. He\'s been acting weird.', pin: 'Ramey Ave Trap House' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'mook'); SY.actors.get('mook').pose = null; ots('me', 'mook');
        await lines([['mook', 'I need fifteen. Not a loan. I mean I need it, like, today.'], ['me', 'For what?'], ['mook', 'Don\'t ask me that. I owe somebody from before. From when Smoke was here.']]);
        close('mook', 1, 1.6); await say('mook', 'If you don\'t, it\'s cool. I\'ll figure it out. I always figure it out.');
        ots('me', 'mook');
        i = await choose([{ t: 'Here. No questions.', tone: 'loyal', d: { loyalty: 6 } }, { t: 'Not till you tell me who.', tone: 'press', d: { loyalty: -2 } }, { t: 'I can\'t carry your old debts, bro.', tone: 'refuse', d: { loyalty: -5 } }], { timer: 14 });
        syFlag('mookDebt', i);
        close('mook', -1, 1.6);
        await say('mook', i === 0 ? '...I won\'t forget this. For real.' : i === 1 ? 'A car lot man. That\'s all I\'m saying. Forget it.' : 'Yeah. Okay. I get it.');
      });
      if (i === 0) { await syUntil(() => S.cash >= 15000, 'Get $15,000 for Mook'); spend(15000, 'Mook'); }
      unactor('mook');
      syNote(i === 1 ? 'Mook owes "a car lot man" from back when Smoke was alive. He wanted $15,000 and wouldn\'t say more.' : i === 0 ? 'You gave Mook $15,000 for a debt from Smoke\'s time. He wouldn\'t say who.' : 'Mook asked you for $15,000 for an old debt. You said no.');
    },
  ], { label: "Tier 4 · Mook's Debt", delay: 60 });

  mis('t4f', 4, 'Tier 4', 'Flashback: The Haulers', 'Six weeks before Ironline. Smoke in a parked car across from Hollis Motors at 3 AM.', [
    async () => {
      await syUntil(() => foot.on && !inside, 'Get out and walk (another memory)');
      const a = DATA.P.find(x => x.id === 'auto_row') || { x: 75, z: -163 }, [ox, oz] = outDir(a), s = { x: a.x + ox * 16, z: a.z + oz * 16 };
      await cut(async () => {
        await syBlack('<span style="font-size:.8em;opacity:.7">ACROSS FROM HOLLIS MOTORS · 6 WEEKS BEFORE · 3:10 AM</span>', 2.4);
        syFlashIn(null, null, 'night'); placeMe(s.x, s.z, 0); actor('hollis', a.x + ox * 3, a.z + oz * 3, 0); actor('calloway', a.x + ox * 3 + oz * 3, a.z + oz * 3 - ox * 3, 0);
        face('me', a.x, a.z); faceEach('hollis', 'calloway'); SY.actors.get('hollis').pose = 'hands';
        await syUnblack(); shot([s.x + 2, 1.7, s.z + 2], [a.x, 1.4, a.z], { to: [s.x + 1.5, 1.65, s.z + 1.5], dur: 8 });
        await lines([['narr', 'Two car haulers idle at the gate. Every car on them has a dealer plate. Every car on them sits low in the back.'], ['narr', 'Hollis hands Calloway a thick envelope under the lot lights.'], ['me', '(Nine. Ten. Eleven pictures. That\'s enough. That\'s enough for Garza.)']]);
        await syBlack('', 1.2); syFlashOut(); await syUnblack();
      });
      syNote('Six weeks before he died, Smoke photographed Hollis paying Calloway at 3 AM while two car haulers loaded at Hollis Motors. The pictures were for Garza.');
    },
  ], { label: 'Tier 4 · Flashback', delay: 80 });

  mis('t4g', 4, 'Tier 4', 'The Man Upstairs', 'Lou\'s boss wants to meet you.', [
    async () => {
      await call('lou', [['lou', 'The man I buy from wants to meet you. I told him you ain\'t ready. He don\'t care what I think.'], ['lou', 'Hollis Motors. Tonight. Wear a shirt with buttons.']], { mustAnswer: true });
      setTime('night');
      const a = DATA.P.find(x => x.id === 'auto_row') || { x: 75, z: -163 }, [ox, oz] = outDir(a);
      actor('hollis', a.x + ox * 4, a.z + oz * 4, 0); actor('lou', a.x + ox * 4 + oz * 2.4, a.z + oz * 4 - ox * 2.4, 0);
      await talkTo('hollis', 'Talk to', { obj: 'Go to Hollis Motors at Cowtown Auto Row', pin: 'Hollis Motors' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'hollis'); face('lou', foot.x, foot.z); SY.actors.get('lou').pose = 'cross'; wide(foot.x, foot.z, foot.yaw + Math.PI * 0.6, 11, 3.6); await syWait(1.6);
        ots('me', 'hollis');
        await lines([['hollis', 'Louis has been very proud of you. I let him have his little customers. Everybody needs a hobby.'], ['hollis', 'Every gram in Fort Worth rides in on one of my haulers. Lou buys off the truck. Now you can too.']]);
        close('hollis', 1, 1.8); await lines([['hollis', 'Half Lou\'s price. Twice the weight. And Calloway works for you instead of on you.'], ['hollis', 'Your brother said no to me. I\'d like the family to have a second chance.']]);
        ots('me', 'hollis');
        i = await choose([{ t: 'I\'ll take your price.', tone: 'Hollis', d: { streets: 5, heat: -6, loyalty: -4 } }, { t: 'I\'m staying with Lou.', tone: 'Lou', d: { loyalty: 5, streets: 2 } }, { t: 'What happened to my brother, Deacon?', tone: 'confront', d: { heat: 4 } }], { timer: 16 });
        if (i === 2) { close('hollis', -1, 1.8); await lines([['hollis', 'A tragedy. A beautiful young man and a car that couldn\'t hold him.'], ['hollis', 'Now. My price, or Lou\'s?']]); i = await choose([{ t: 'Yours.', tone: 'Hollis', d: { streets: 4, loyalty: -4 } }, { t: 'Lou\'s.', tone: 'Lou', d: { loyalty: 4 } }], { timer: 12 }); syFlag('askedHollis', 1); }
        syFlag('plug', i === 0 ? 'hollis' : 'lou');
        close('hollis', -1, 1.8); await say('hollis', i === 0 ? 'Smart. Smarter than Darius.' : 'Loyalty. How old-fashioned. Louis, your boy is loyal.');
        if (i === 1) { face('lou', foot.x, foot.z); close('lou', 1, 1.6); await say('lou', '...You just made a very rich man mad for me. I won\'t forget it.'); }
      });
      unactAll(); setTime('day'); syMeet('hollis');
      syNote(syFlag('plug') === 'hollis' ? 'Deacon Hollis is Lou\'s supplier: everything comes in on his car haulers. You started buying from Hollis directly.' : 'Deacon Hollis is Lou\'s supplier: everything comes in on his car haulers. You told Hollis you\'re staying with Lou.');
    },
  ], { label: 'Tier 4 · The Man Upstairs', delay: 70 });

  mis('t4h', 4, 'Tier 4', 'Five Clean', 'Five runs home without a chase. Then everybody knows you\'re for real.', [
    async () => {
      const st = sy(), hol = syFlag('plug') === 'hollis';
      text(hol ? 'hollis' : 'lou', hol ? 'Pickups at the Gas-N-Go. My people. Half price. Do not get chased.' : 'Five clean runs and Dallas starts taking you serious');
      while ((st.cleanRuns || 0) < 5) await syLoadRun({ cost: hol ? 12000 : 20000, n: hol ? 500 : 300, label: `clean runs: ${st.cleanRuns || 0} of 5`, sub: `Tier 4 · Five Clean (${st.cleanRuns || 0}/5)`, noWarn: true });
      syMeter('streets', 6, 'Five clean runs');
    },
    async () => {
      const st = sy(), hol = syFlag('plug') === 'hollis';
      await cut(async () => {
        const [mx, mz] = syMe(); shot([mx + 8, 6, mz + 8], [mx, 1.2, mz], { to: [mx + 14, 12, mz + 14], dur: 8 });
        await syTitle('TIER 4 COMPLETE', 'THE PLUG', `${st.runs || 5} runs to Oak Cliff. ${hol ? 'Buying from Hollis.' : 'Loyal to Lou.'}`, 3.4);
        await syTitle('NEXT', 'TIER 5 · THE CITY', 'Fundraisers. Clean money. The truth.', 2.6);
      });
      st.tier = 5; save();
      if (hol) text('calloway', 'Deacon says you with us now. Funny how that works.'); else text('calloway', 'Heard you told Deacon no. Your brother did that too.');
      syNote(`Tier 4 done: five clean runs. ${hol ? 'You\'re buying from Hollis now. Calloway says you\'re "with us."' : 'You stayed with Lou. Calloway says Smoke told Hollis no too.'}`);
    },
  ], { label: 'Tier 4 · Five Clean', delay: 60 });

  // ---------- TIER 5: The City. Hollis brings you inside; wash the money; the midpoint twist (Smoke was meeting Garza); $1M clean ----------
  const syAt = (id, fx, fz, d = 4) => { const p = DATA.P.find(x => x.id === id) || { x: fx, z: fz }, [ox, oz] = outDir(p); return { p, ox, oz, x: p.x + ox * d, z: p.z + oz * d }; };
  const syFromBank = n => { const b = Math.max(0, n - S.cash); S.bank -= b; S.cash -= n - b; refreshStats(); };

  mis('t5a', 5, 'Tier 5', 'The Fundraiser', 'Deacon Hollis is running for city council. He wants you at the yacht club in a suit.', [
    async () => {
      const hol = syFlag('plug') === 'hollis';
      await call('hollis', [['hollis', hol ? 'Saturday. Trinity Harbor Yacht Club. Wear something without a logo on it.' : 'You said no to me once. Come say it to my face at the yacht club Saturday. Wear a suit.'], ['hollis', 'Half this city will be there. The other half works for them.']], { mustAnswer: true });
      const a = syAt('marina_harbor', 996, 880, 5);
      setTime('night');
      actor('hollis', a.x, a.z, 0); actor('calloway', a.x + a.oz * 3, a.z - a.ox * 3, 0);
      await talkTo('hollis', 'Talk to', { obj: 'Go to Hollis\'s fundraiser at Trinity Harbor Yacht Club', pin: 'Trinity Harbor Yacht Club' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'hollis'); face('calloway', foot.x, foot.z); wide(foot.x, foot.z, foot.yaw + Math.PI * 0.6, 13, 4.5); await syWait(1.6);
        await lines([['narr', 'String quartet. Shrimp on ice. A banner: HOLLIS FOR COUNCIL · DISTRICT 8 · "BUILDING FORT WORTH."'], ['narr', 'A county judge. Two councilmen. The man who runs the Stockyards. All of them shake Hollis\'s hand like they owe him.']]);
        two('me', 'hollis', 1, 3.4);
        await lines([['hollis', 'You see that man by the bar? Zoning. The woman in blue? Port of Houston. Every car on my haulers goes where she says.'], ['hollis', 'Your brother stood right where you\'re standing. He had the same look on his face.']]);
        close('calloway', 1, 1.8); await lines([['calloway', 'Nice suit. Smoke wore one too. At the funeral.']]);
        ots('me', 'hollis');
        i = await choose([{ t: 'Shake his hand in front of everybody.', tone: 'in', d: { streets: 3, loyalty: -2 } }, { t: 'Smile. Say nothing. Learn names.', tone: 'watch', d: { clean: 2 } }, { t: 'Tell Calloway to say Smoke\'s name again.', tone: 'push', d: { streets: 4, heat: 4 } }], { timer: 14 });
        close('hollis', -1, 1.8); await say('hollis', i === 0 ? 'Smile for the camera. The Star-Telegram is here.' : i === 1 ? 'Smart. Most young men talk. You listen. I can use that.' : 'Easy. Not here. Not in front of the judge.');
      });
      syFlag('fundraiser', i); unactor('hollis'); unactor('calloway'); setTime('day');
      if (i === 0) text('throttle', 'SMOKE LIL BRO AT THE HOLLIS FUNDRAISER IN A SUIT 👀 east side asking questions');
      syNote(['You shook Hollis\'s hand in front of the whole city at his fundraiser.', 'You watched Hollis\'s fundraiser and learned who he owns: a judge, zoning, the Port of Houston.', 'You got in Calloway\'s face at Hollis\'s fundraiser.'][i]);
    },
  ], { label: 'Tier 5 · The Fundraiser', delay: 40 });

  mis('t5b', 5, 'Tier 5', 'Laundry', 'Dirty money gets you killed. Clean money gets you a seat. Wash it.', [
    async () => {
      const st = sy(); st.bank5 = S.bank; save();
      const lives = ['label', 'shop', 'ranch', 'rentals'].filter(k => k === 'label' ? !!(syLabel() && syLabel().name) : k === 'shop' ? !!(st.cars && st.cars.shop) : k === 'ranch' ? (S.cattle || 0) > 0 : (S.props || []).length > 0);
      await call('rusty', [['rusty', 'People asking where the money coming from. You need paper behind every dollar.'], ['rusty', lives.length ? `You got ${lives.join(', ')}. Run the cash through them. Slow. Little at a time.` : 'Get you a business. A shop, a label, some cattle. Then run the cash through it.']]);
      await syUntil(() => S.bank >= (st.bank5 || 0) + 100000, 'Wash $100,000 into the bank (deposit through your businesses)');
      syMeter('clean', 6, 'Washed $100,000');
      text('hollis', 'My bank manager says your deposits look very... legitimate. Good. Now you can be seen with me.');
      syNote('You washed $100,000 into the bank through your businesses.');
    },
  ], { label: 'Tier 5 · Laundry', delay: 40 });

  mis('t5c', 5, 'Tier 5', 'Ironline VIP', 'Hollis\'s suite at Ironline Dragway. The track where Smoke died.', [
    async () => {
      text('hollis', 'Friday. My suite at Ironline. Come watch the big tire class with me');
      const a = syAt('ironline', 34, 1260, 8);
      setTime('night');
      actor('hollis', a.x, a.z, 0);
      await talkTo('hollis', 'Sit with', { obj: 'Go to Hollis\'s VIP suite at Ironline Dragway', pin: 'Ironline Dragway' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'hollis'); const ir = a.p; shot([ir.x + 30, 14, ir.z - 10], [ir.x, 1, ir.z], { to: [ir.x + 18, 10, ir.z + 20], dur: 7 }); await syWait(1.4);
        await lines([['narr', 'Two cars stage under the lights. The tree drops. Somebody runs a six-second pass and the stands shake.']]);
        two('me', 'hollis', 1, 3.4);
        await lines([['hollis', 'Your brother ran a 6.1 on this track. Nobody from the east side ever did that.'], ['hollis', 'He got greedy at the end. Wanted more than his piece. That\'s all I\'ll say about it.']]);
        close('hollis', 1, 1.8); await lines([['hollis', 'Lane two, by the back gate. That\'s where they found him. I paid for the funeral. Did anybody tell you that?']]);
        ots('me', 'hollis');
        i = await choose([{ t: '"Thank you for the funeral."', tone: 'play it', d: { loyalty: 2 } }, { t: '"Greedy how?"', tone: 'press', d: { heat: 2 } }, { t: 'Look at the back gate. Say nothing.', tone: 'remember', d: { family: 2 } }], { timer: 14 });
        close('hollis', -1, 1.8); await say('hollis', i === 0 ? 'Manners. Pearl raised y\'all right.' : i === 1 ? 'He wanted to talk to people he shouldn\'t have. Enjoy the race.' : 'You\'ll stop looking at it. Everybody does.');
      });
      syFlag('ironlineVIP', i); unactor('hollis'); setTime('day');
      syNote(i === 1 ? 'Hollis said Smoke "wanted to talk to people he shouldn\'t have."' : 'Hollis showed you lane two at Ironline, by the back gate, where they found Smoke. He says he paid for the funeral.');
    },
  ], { label: 'Tier 5 · Ironline VIP', delay: 40 });

  mis('t5d', 5, 'Tier 5', "Nia's Video", 'Nia found something in the footage from the night Smoke died.', [
    async () => {
      text('nia', 'I need to show you something and I can\'t send it. Dickies Arena lot. Come alone');
      const a = syAt('dickies_arena', -375, -13, 10);
      setTime('night');
      actor('nia', a.x, a.z, 0); SY.actors.get('nia').pose = 'phone';
      await talkTo('nia', 'Talk to', { obj: 'Meet Nia in the Dickies Arena lot. Alone.', pin: 'Dickies Arena' });
      await cut(async () => {
        faceEach('me', 'nia'); two('me', 'nia', 1, 3.2);
        await lines([['nia', 'That night I was filming the pit for Throttle. I never looked at the end of the clip. Too hard.'], ['nia', 'Last week I did. 2:07 in the morning. Back gate. Look.']]);
        close('nia', 1, 1.6);
        await lines([['narr', 'Nia\'s phone. Grainy. Headlights at the Ironline back gate. An unmarked Tahoe. A man gets out and walks toward lane two.'], ['narr', 'He turns once, into the light. Detective Calloway.'], ['nia', 'Four minutes later the ambulance call goes out. Calloway is never in a single report.']]);
        if (syFlag('niaPhotos')) await lines([['nia', 'And the pics you sent me off that Hollis car? Same Laredo hauler number on a Hollis invoice from that week.']]);
        await lines([['nia', 'If I post this, I\'m dead. If you do something stupid with it, you\'re dead. So we wait. We get more.']]);
      });
      SY.actors.get('nia').pose = null; unactor('nia'); setTime('day');
      syFlag('niaVideo', 1); syMeter('family', 3, 'The truth about Smoke');
      syNote('Nia\'s video: at 2:07 a.m. the night Smoke died, Detective Calloway walked through the Ironline back gate toward lane two.');
    },
  ], { label: "Tier 5 · Nia's Video", delay: 40 });

  mis('t5e', 5, 'Tier 5', "Big Mama's Ledger", 'Big Mama found Smoke\'s ledger in the deep freezer.', [
    async () => {
      text('mama', 'Baby come home. I found something of your brother\'s. I was looking for a roast');
      const h = spot('mama', 1, 2.6); actor('mama', h.x, h.z, h.yaw + Math.PI);
      await talkTo('mama', 'Talk to', { obj: 'Go home to Big Mama', pin: "Big Mama's house" });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'mama'); two('me', 'mama', 1, 3.2);
        await lines([['mama', 'Wrapped in foil like a pork chop. In the bottom of the deep freezer. That boy.'], ['narr', 'A black composition book. Every page is numbers. Pickups, drops, Hollis\'s haulers by plate number.']]);
        close('mama', 1, 1.6);
        await lines([['narr', 'The last page is in Smoke\'s handwriting. "Thurs. 2am. Ironline back gate. G. Bring the book. Then we out. Me, Mama, lil bro."'], ['mama', 'Who is G, baby?']]);
        await syTitle('G', 'AGENT GARZA', 'Smoke was meeting the DEA the night he died', 3.4);
        await lines([['narr', 'Smoke was going to give Hollis to the DEA. Calloway got to the back gate first.']]);
        ots('me', 'mama');
        i = await choose([{ t: 'Keep it between you and Big Mama.', tone: 'quiet', d: { family: 4 } }, { t: 'Call Mook. He was there back then.', tone: 'tell Mook', d: { loyalty: 3 } }, { t: 'Call Agent Garza.', tone: 'call Garza', d: { clean: 2, streets: -2 } }], { timer: 16 });
        close('mama', -1, 1.6); await say('mama', i === 0 ? 'Then it stays in this house. Like everything else.' : i === 1 ? 'Mook. Hm. Be careful who you tell, baby. Smoke told people too.' : 'The police? Lord. Your brother trusted them and look.');
      });
      unactor('mama');
      syFlag('ledger', 1); syFlag('ledgerTold', i);
      syMeter('family', 4, 'Smoke\'s ledger');
      if (i === 1) text('mook', 'Smoke was gon flip?? nah. nah bro. who else know about this book');
      syNote('MIDPOINT: Smoke\'s ledger says he was meeting "G" (Agent Garza) at the Ironline back gate at 2 a.m. the night he died. He was going to give her Hollis. Calloway got there first.');
    },
  ], { label: "Tier 5 · Big Mama's Ledger", delay: 40 });

  mis('t5f', 5, 'Tier 5', "Garza's Deal", 'Agent Garza knows you found the book.', [
    async () => {
      if (syFlag('ledgerTold') !== 2) await call('garza', [['garza', 'Don\'t hang up. I know about the book. Your grandmother called a church friend, the church friend called her nephew, her nephew works for me.'], ['garza', 'Greater Stop Six Baptist. Tonight. The back pew.']], { mustAnswer: true });
      else await call('garza', [['garza', 'You called. Good. Not on the phone. Greater Stop Six Baptist, tonight. The back pew.']]);
      const c = spot('church', 1, 3); setTime('night');
      actor('garza', c.x, c.z, c.yaw + Math.PI);
      await talkTo('garza', 'Talk to', { obj: 'Meet Agent Garza at Greater Stop Six Baptist Church', pin: 'Greater Stop Six Baptist Church' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'garza'); two('me', 'garza', 1, 3.2);
        await lines([['garza', 'Your brother called me eleven times in two weeks. He was scared. Not of Hollis. Of Calloway.'], ['garza', 'I was at the Ironline gate at two fifteen. He was already on the ground.']]);
        close('garza', 1, 1.6);
        await lines([['garza', 'Finish what he started. Wear a wire at Hollis\'s table. Give me the haulers and the Laredo route, and the book.'], ['garza', 'Your charges go away. Big Mama gets moved somewhere safe. You get your brother\'s name back.']]);
        ots('me', 'garza');
        i = await choose([{ t: 'Take the deal.', tone: 'informant', d: { clean: 6, streets: -6, loyalty: -4 } }, { t: 'Not yet. I need to think.', tone: 'wait' }, { t: '"Smoke trusted you and he\'s dead."', tone: 'refuse', d: { streets: 4, heat: 2 } }], { timer: 18 });
        close('garza', -1, 1.6); await say('garza', i === 0 ? 'Then you never met me. You never sat in this church. I\'ll find you.' : i === 1 ? 'Don\'t think too long. Calloway can count to the same number I can.' : 'He trusted me too late. Don\'t make the same mistake.');
      });
      unactor('garza'); setTime('day');
      syFlag('garzaDeal', i === 0 ? 'yes' : i === 1 ? 'later' : 'no');
      if (i === 0) syMeter('heat', -10, 'Federal protection');
      syNote(i === 0 ? 'You took Agent Garza\'s deal. You\'re an informant now. One slip and you\'re done.' : i === 1 ? 'Agent Garza offered you a deal: wear a wire at Hollis\'s table. You said not yet.' : 'You told Agent Garza no. Smoke trusted her and he died.');
    },
  ], { label: "Tier 5 · Garza's Deal", delay: 40 });

  mis('t5g', 5, 'Tier 5', 'The Tax', 'Calloway wants a piece of everything you touch. Every week.', [
    async () => {
      text('calloway', 'Back of the Dickies lot. Now. Don\'t make me come find you');
      const a = syAt('dickies_arena', -375, -13, 14);
      actor('calloway', a.x, a.z, 0);
      await talkTo('calloway', 'Talk to', { obj: 'Meet Calloway behind Dickies Arena', pin: 'Dickies Arena' });
      let i = 0;
      await cut(async () => {
        faceEach('me', 'calloway'); ots('me', 'calloway');
        await lines([['calloway', 'Shop. Tow trucks. Studio. Cattle. Whatever you got going, I see all of it from my desk.'], ['calloway', 'Twenty-five thousand a week. Or a judge I know signs a warrant for that house on Ramey.']]);
        if (syFlag('niaVideo')) { close('calloway', 1, 1.6); await lines([['calloway', 'And tell your little Throttle girlfriend to delete what she\'s got. I know what she\'s got.']]); }
        ots('me', 'calloway');
        i = await choose([{ t: 'Pay him. Keep him close.', tone: 'pay', d: { loyalty: -2 } }, { t: 'Tell him you\'ll see him at lane two.', tone: 'threat', d: { streets: 6, heat: 8 } }, { t: 'Pay him, and record it.', tone: 'record', d: { clean: 3, heat: 2 } }], { timer: 14 });
        close('calloway', -1, 1.6); await say('calloway', i === 1 ? 'Lane two. You really are his brother.' : 'Every Monday. Don\'t be late. I hate late.');
      });
      unactor('calloway');
      syFlag('callowayTax', i);
      if (i !== 1) { await syUntil(() => S.cash + S.bank >= 25000, 'Get $25,000 for Calloway\'s first payment (cash or bank)'); syFromBank(25000); S.log.unshift('-$25,000 Calloway'); save(); }
      if (i === 2) syFlag('callowayTape', 1);
      syNote(i === 0 ? 'Calloway is taxing you $25,000 a week. You paid.' : i === 1 ? 'You told Calloway you\'d see him at lane two. He didn\'t like that.' : 'You paid Calloway $25,000 and recorded the whole thing on your phone.');
    },
  ], { label: 'Tier 5 · The Tax', delay: 40 });

  mis('t5h', 5, 'Tier 5', "Hollis's Table", 'A million clean. Then Hollis pulls out a chair for you.', [
    async () => {
      text('hollis', 'When you have a million dollars that can stand up in front of an auditor, call me. Not before');
      await syUntil(() => S.bank >= 1000000, 'Have $1,000,000 clean in the bank');
      syMeter('clean', 6, 'A million clean');
    },
    async () => {
      const a = syAt('auto_row', 75, -163, 5); setTime('night');
      actor('hollis', a.x, a.z, 0); actor('calloway', a.x + a.oz * 2.6, a.z - a.ox * 2.6, 0);
      await talkTo('hollis', 'Sit down with', { obj: 'Hollis Motors. After hours. He\'s holding a seat for you.', pin: 'Cowtown Auto Row' });
      const wire = syFlag('garzaDeal') === 'yes';
      let i = 0;
      await cut(async () => {
        faceEach('me', 'hollis'); face('calloway', foot.x, foot.z); wide(foot.x, foot.z, foot.yaw + Math.PI * 0.5, 11, 3.6); await syWait(1.4);
        if (wire) await lines([['narr', 'The wire is taped under your shirt. It feels like it\'s glowing.']]);
        two('me', 'hollis', 1, 3.4);
        await lines([['hollis', 'A million that can stand up. Your brother never got there. He wanted out instead of up.'], ['hollis', 'Laredo to Fort Worth. My haulers, your people, Calloway\'s badge. Next month, Denver. A woman named Wren grows more than Colorado can smoke.']]);
        close('hollis', 1, 1.8); await lines([['hollis', 'Sit down. Or walk out like he did.']]);
        ots('me', 'hollis');
        i = await choose([{ t: 'Sit down.', tone: 'sit', d: { streets: 5 } }, { t: wire ? 'Sit down. Let the wire hear everything.' : 'Sit down, and remember every word.', tone: wire ? 'wire' : 'remember', d: { clean: 3 } }], { timer: 16 });
        close('hollis', -1, 1.8); await say('hollis', 'Welcome to the city.');
      });
      syFlag('table', 1); if (wire && i === 1) syFlag('wireHollis', 1);
      unactor('hollis'); unactor('calloway');
      const st = sy();
      await cut(async () => {
        const [mx, mz] = syMe(); shot([mx + 8, 6, mz + 8], [mx, 1.2, mz], { to: [mx + 16, 14, mz + 16], dur: 8 });
        await syTitle('TIER 5 COMPLETE', 'THE CITY', 'A million clean and a seat at Hollis\'s table', 3.4);
        await syTitle('NEXT', 'TIER 6 · THE PIPELINE', 'Denver. Big rigs. Somebody is talking.', 2.6);
      });
      setTime('day'); st.tier = 6; save();
      if (syFlag('ledgerTold') === 1) text('mook', 'we good right? you been quiet with me lately');
      if (wire) text('garza', 'We heard all of it. Laredo, Denver, Wren. Stay alive.');
      syNote(`Tier 5 done: a million clean and a seat at Hollis\'s table.${wire ? ' Garza\'s wire heard every word.' : ''} Next: Denver, and a woman named Wren.`);
    },
  ], { label: "Tier 5 · Hollis's Table", delay: 60 });

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
        const ms = M.filter(m => m.tier === t && !m.life); body += `<div class="sec">${k} · ${nm}</div>`;
        if (!ms.length) { body += `<div class="ms lock"><div class="n">·</div><div><h5>Coming soon</h5><p>${t === 6 ? 'Next story update' : 'Later updates'}</p></div></div>`; if (t >= 3) continue; continue; }
        ms.forEach((m, i) => { const done = st.done.includes(m.id), now = st.m === m.id || (!st.m && st.next === m.id); body += `<div class="ms ${done ? 'done' : now ? 'now' : 'lock'}"><div class="n">${done ? '✓' : i + 1}</div><div><h5>${esc(m.title)}</h5><p>${done || now ? esc(m.brief) : 'Locked'}</p></div></div>`; });
      }
    } else if (tab === 'journal') body += st.journal.length ? st.journal.map(j => `<div class="jr">${esc(j)}</div>`).join('') : '<div class="jr">Nothing yet.</div>';
    else if (tab === 'people') body += st.met.length ? st.met.map(w => { const c = SY_CAST[w]; return c ? `<div class="ppl">${syAv(w)}<div><b>${esc(c.full || c.name)}</b><span>${esc(c.role)}</span></div></div>` : ''; }).join('') : '<div class="jr">You haven\'t met anyone yet.</div>';
    else if (tab === 'lives') body += `<div class="jr">The dope game is the main road. Other lives open as you come up. Run several at once, or leave the game behind for one of them.</div>` + LIVES.map(([n, u, how]) => {
      const k = Object.keys(SY_LIFE).find(x => SY_LIFE[x].n === n);
      if (k && syLifeOpen(k)) {
        const ch = M.filter(m => m.life === k), nx = syLifeNext(k), cur = st.m && misById(st.m);
        return `<div class="life"><span>${n}<br><em>${ch.filter(m => st.done.includes(m.id)).length} of ${ch.length} done</em></span><em>${cur && cur.life === k ? 'On it' : nx ? '' : 'More soon'}</em></div>` + ch.map((m, i) => { const done = st.done.includes(m.id), now = cur === m; return `<div class="ms ${done ? 'done' : now || m === nx ? 'now' : 'lock'}"><div class="n">${done ? '✓' : i + 1}</div><div style="flex:1"><h5>${esc(m.title)}</h5><p>${done || now || m === nx ? esc(m.brief) : 'Locked'}</p></div>${m === nx && !now && !st.m ? `<button class="big" data-life="${k}" style="margin:0;padding:6px 12px;width:auto">Play</button>` : ''}</div>`; }).join('');
      }
      return `<div class="life"><span>${n}<br><em>${how}</em></span><em>${n === 'Kingpin' && st.on ? 'Living it' : 'Unlocks ' + u}</em></div>`;
    }).join('');
    sc.innerHTML = phoneHead('Story') + `<div class="ph-body">${body}</div>`; syBack(sc);
    sc.querySelectorAll('[data-t]').forEach(b => b.onclick = () => syStoryApp(sc, b.dataset.t));
    const A = sc.querySelector('[data-a="start"]'); if (A) A.onclick = () => { closePhone(); syStart(); };
    const P = sc.querySelector('[data-a="pause"]'); if (P) P.onclick = () => { syPause(); syStoryApp(sc); };
    sc.querySelectorAll('[data-life]').forEach(b => b.onclick = () => { if (syPlayLife(b.dataset.life)) closePhone(); });
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
    else if (!st.m && !st.next) { const nx = M.find(m => !m.life && !st.done.includes(m.id)); if (nx) { st.next = nx.id; st.nextT = 2; } }
    syMural(); save();
  }
  function syPause() { const st = sy(); st.on = false; if (SY.busy) { const cur = misById(st.m); if (!(cur && cur.life)) { st.next = st.m; st.nextT = 3; } st.m = null; } syAbortRun(); save(); syObjective(''); toast('Story paused. Start it again from the Story app.', 'good'); }
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
      syStepActors(dt); syStepCam(dt); syStepTalk(); syStepTrap(dt); syStepTraps(dt); syStepFlow(dt);
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
  window.__story = { SY, M, sy, syRun, syStart, syPause, syAbortRun, syNewOrder, syServe, syMural, say, choose, call, text, cut, actor, unactor, unactAll, misById, sySide, spot, SY_CAST, SY_SPOT, syMeter, syTraps, syTrap, syOpenTrap, syTrapMenu, syTrapTick, syTrapPos, syPlayLife, syLifeNext, SY_WORKERS,
    // test helpers: jump to a mission, fast-forward everything
    jump(id) { const st = sy(); st.on = true; syAbortRun(); const i = M.findIndex(m => m.id === id), m = M[i]; if (m.life) { const ai = M.findIndex(x => x.id === SY_LIFE[m.life].after); st.done = M.filter((x, k) => (!x.life && k <= ai) || (x.life === m.life && k < i)).map(x => x.id); st.m = null; st.next = null; save(); syRun(m, 0); return; } st.done = M.slice(0, i).filter(x => !x.life).map(x => x.id); st.m = null; st.next = id; st.nextT = 0; save(); },
    auto(on) { SY.autoPick = on ? 0 : null; SY.autoAnswer = on; SY.autoTalk = on; SY.autoRetry = on; SY.fast = on; },
    // tier 3 test helpers: take blocks, drop the sliders, buy cattle, run dogs
    takeNear(n = 1) { const h = syH(); if (!h || !h.set) return 0; for (let k = 0; k < n; k++) { const b = syBlockFor(foot.on ? foot.x : drv.x, foot.on ? foot.z : drv.z); if (b) syTakeBlock(b); } return syMine().length; },
    takeAt(x, z) { const h = syH(); if (!h || !h.set) return 0; let best = null, bd = 1e9; for (const b of HOOD.blocks) { if (hOwner(b) === h.set) continue; const d = Math.hypot(b.corner.x - x, b.corner.z - z); if (d < bd) { bd = d; best = b; } } if (best) syTakeBlock(best); return syMine().length; },
    dropSlide() { for (const e of (SY.slide || [])) if (!e.gone && !e.down) hDrop(e, 'me'); S.heat = 0; },
    addDrops(n) { const h = syH(); if (h) h.stats.drops += n; S.heat = 0; },
    hoodReady: () => !!(HOOD.ready && syH()), mine: () => syMine().length, sySlide, syBlockFor,
    signAny() { const L = label(); if (!L.name) lbStart('Test Records'); const a = LB_ARTISTS.find(a => !a.five && !lbSigned(a.id)); if (a) L.roster.push({ id: a.id, cut: 0.2, advance: 0, buzz: a.buzz, day: S.day }); save(); return L.roster.length; },
    copClear() { const C = window.__cops; try { C.copEnd(''); } catch (e) {} if (C) { C.COP.stop = null; C.COP.phase = 'none'; } S.heat = 0; },
    giveCar() { const c = newCar(BUILT[0], '#6b6f5a', 58); c.fuel = 0.6; S.car = c; syncCarModel(); deliverCar(); save(); },
    advance: syAdvance, pinAt: () => pin.visible ? [pin.position.x, pin.position.z] : null, mk: () => SY.mk && SY.mk.visible ? [SY.mk.position.x, SY.mk.position.z] : null };
  // ===== STORY END =====
