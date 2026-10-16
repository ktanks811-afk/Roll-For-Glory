// New-game character creation, and the mirror at home for restyling later.

import { openPanel, closeAllPanels, bind, esc, toast } from './dom.js';
import { drawPortrait } from '../gfx2d/person.js';
import { SKIN_TONES, HAIR_COLORS, defaultLook, CLOTHES } from '../data/shops.js';
import { HAIRSTYLES, HAIR_GROUPS, HAIR_BY_ID, FACIAL_HAIR, EYE_COLORS, BROWS, EXTRAS, ORIGINS, ORIGIN_BY_ID } from '../data/looks.js';
import { game, createState } from '../core/state.js';
import { beginStory } from '../core/story.js';
import { generateListings } from '../data/market.js';
import { saveGame, SLOTS, slotInfo } from '../core/save.js';
import { maybeStartTutorial } from './tutorial.js';
import { enterWorld } from '../main.js';

const STARTER_TOPS = ['hoodie_black', 'tee_white', 'tee_red', 'hoodie_grey'];
const STARTER_BOTTOMS = ['jeans_blue', 'jeans_black', 'track_black', 'cargo_tan'];
const STARTER_HATS = ['no_hat', 'cap_black', 'cap_red', 'beanie_grey'];
const BUILDS = ['Slim', 'Average', 'Broad'];

const pick = a => a[Math.floor(Math.random() * a.length)];

// a hair-style thumbnail: the head cut out of a full portrait, cached per look
const thumbCache = new Map();
const portraitCanvas = () => document.createElement('canvas');
function hairThumb(cv, look, style) {
  const key = [style, look.skin, look.hair].join('|');
  let src = thumbCache.get(key);
  if (!src) {
    src = portraitCanvas(); src.width = 300; src.height = 300;
    drawPortrait(src.getContext('2d'), 300, 300, { ...look, hairStyle: style, hat: 'no_hat', mask: 'no_mask', extras: [], facialHair: 'none', build: +look.build || 1 });
    if (thumbCache.size > 300) thumbCache.clear();
    thumbCache.set(key, src);
  }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, 86, 0, 128, 128, 0, 0, cv.width, cv.height);
}

// The editor's tabs, shared by the creator and the mirror.
// st: { tab, scroll }, look is edited in place.
function lookTabs(look, tab) {
  const sw = (key, list) => `<div class="opts">${list.map(c => `<span class="swatch ${look[key] === c ? 'on' : ''}" style="background:${c}" data-action="look" data-k="${key}" data-v="${c}"></span>`).join('')}</div>`;
  const btns = (key, list, label = x => x) => `<div class="opts">${list.map(v => `<button class="${String(look[key]) === String(v) ? 'on' : ''}" data-action="look" data-k="${key}" data-v="${v}">${esc(label(v))}</button>`).join('')}</div>`;
  const named = (key, list) => `<div class="opts">${list.map(o => `<button class="${look[key] === o.id ? 'on' : ''}" data-action="look" data-k="${key}" data-v="${o.id}">${esc(o.name)}</button>`).join('')}</div>`;
  if (tab === 'hair') {
    return `<label class="field"><span>Hair color</span>${sw('hair', HAIR_COLORS)}</label>
      ${HAIR_GROUPS.map(g => `<div class="section-title">${esc(g.name)}</div><div class="hs-grid">${HAIRSTYLES.filter(h => h.group === g.id).map(h =>
        `<button class="hs ${look.hairStyle === h.id ? 'on' : ''}" data-action="look" data-k="hairStyle" data-v="${h.id}"><canvas width="72" height="72" data-hs="${h.id}"></canvas><span>${esc(h.name)}</span></button>`).join('')}</div>`).join('')}`;
  }
  if (tab === 'face') {
    return `<label class="field"><span>Skin tone</span>${sw('skin', SKIN_TONES)}</label>
      <label class="field"><span>Eyes</span>${sw('eyes', EYE_COLORS)}</label>
      <label class="field"><span>Eyebrows</span>${named('brows', BROWS)}</label>
      <label class="field"><span>Facial hair</span>${named('facialHair', FACIAL_HAIR)}</label>`;
  }
  if (tab === 'extras') {
    const ex = look.extras || [];
    return `<p class="muted small">Pick as many as you want.</p><div class="opts">${EXTRAS.map(e => `<button class="${ex.includes(e.id) ? 'on' : ''}" data-action="extra" data-v="${e.id}">${esc(e.name)}</button>`).join('')}</div>`;
  }
  if (tab === 'fit') {
    const cloth = id => CLOTHES.find(c => c.id === id)?.name || id;
    return `<label class="field"><span>Build</span>${btns('build', ['0', '1', '2'], v => BUILDS[v])}</label>
      <label class="field"><span>Top</span>${btns('top', STARTER_TOPS, cloth)}</label>
      <label class="field"><span>Bottoms</span>${btns('bottom', STARTER_BOTTOMS, cloth)}</label>
      <label class="field"><span>Hat</span>${btns('hat', STARTER_HATS, cloth)}</label>`;
  }
  return '';
}

function randomLook(look, withClothes) {
  look.skin = pick(SKIN_TONES);
  look.hairStyle = pick(HAIRSTYLES).id;
  look.hair = Math.random() < 0.8 ? pick(HAIR_COLORS.slice(0, 11)) : pick(HAIR_COLORS);
  look.eyes = pick(EYE_COLORS);
  look.brows = pick(BROWS).id;
  look.facialHair = Math.random() < 0.5 ? 'none' : pick(FACIAL_HAIR).id;
  look.extras = EXTRAS.filter(() => Math.random() < 0.15).map(e => e.id);
  if (look.extras.includes('shades') && look.extras.includes('glasses')) look.extras = look.extras.filter(e => e !== 'glasses');
  if (withClothes) { look.build = String(Math.floor(Math.random() * 3)); look.top = pick(STARTER_TOPS); look.bottom = pick(STARTER_BOTTOMS); look.hat = pick(STARTER_HATS); }
}

function editorHandlers(look, st, h) {
  return {
    look: d => { look[d.k] = d.v; h.refresh(); },
    extra: d => {
      const ex = new Set(look.extras || []);
      if (ex.has(d.v)) ex.delete(d.v);
      else {
        ex.add(d.v);
        if (d.v === 'shades') ex.delete('glasses'); if (d.v === 'glasses') ex.delete('shades');
        if (d.v === 'chain') ex.delete('cuban'); if (d.v === 'cuban') ex.delete('chain');
      }
      look.extras = [...ex]; h.refresh();
    },
    tab: d => { st.tab = d.v; st.scroll = 0; h.refresh(); },
  };
}

// keep the scroll spot when a tap re-renders the panel
function keepScroll(root, st) {
  const body = root.querySelector('.p-body');
  if (!body) return;
  body.scrollTop = st.scroll || 0;
  body.addEventListener('scroll', () => { st.scroll = body.scrollTop; }, { passive: true });
}

function paint(root, look, st) {
  const cv = root.querySelector('[data-portrait]');
  // on the hair tab, take the hat off so you can see what you're picking
  const shown = { ...look, build: +look.build, ...(st.tab === 'hair' ? { hat: 'no_hat' } : {}) };
  drawPortrait(cv.getContext('2d'), cv.width, cv.height, shown);
  root.querySelectorAll('canvas[data-hs]').forEach(c => hairThumb(c, look, c.dataset.hs));
}

const tabBar = (tabs, cur) => `<div class="tabs">${tabs.map(([id, name]) => `<button class="${cur === id ? 'on' : ''}" data-action="tab" data-v="${id}">${name}</button>`).join('')}</div>`;

export function openCreate(app) {
  const look = { ...defaultLook(), build: '1' };
  const data = { name: '', age: 21, story: true, origin: 'fresh' };
  const st = { tab: 'you', scroll: 0 };
  openPanel((root, h) => {
    const o = ORIGIN_BY_ID[data.origin];
    const you = `<div class="row"><label class="field grow"><span>Name</span><input class="input" maxlength="20" data-name value="${esc(data.name)}" placeholder="Your street name"></label>
          <label class="field" style="width:110px"><span>Age</span><input class="input" type="number" min="18" max="70" data-age value="${data.age}"></label></div>
          <label class="field"><span>Where you came up</span><div class="opts">${ORIGINS.map(x => `<button class="${data.origin === x.id ? 'on' : ''}" data-action="origin" data-v="${x.id}">${esc(x.name)}</button>`).join('')}</div></label>
          <p class="small muted" data-origin-blurb>${esc(o.blurb)}</p>
          <label class="field"><span>Mode</span><div class="opts">
            <button class="${data.story ? 'on' : ''}" data-action="mode" data-v="1">Story Mode</button>
            <button class="${!data.story ? 'on' : ''}" data-action="mode" data-v="0">Free Roam</button></div></label>
          <p class="small muted">Use the tabs up top for hair, face, extras and your fit, or hit Randomize.</p>`;
    root.innerHTML = `<div class="p-head"><h1>New Career<small>Who's about to take over Fort Worth?</small></h1><button class="btn x" data-action="close">×</button></div>
      ${tabBar([['you', 'You'], ['hair', 'Hair'], ['face', 'Face'], ['extras', 'Extras'], ['fit', 'Fit']], st.tab)}
      <div class="p-body"><div class="create">
        <div><canvas width="300" height="300" data-portrait></canvas>
          <div class="row create-tools"><button class="btn btn-sm" data-action="random">🎲 Randomize</button></div>
          <p class="muted small"><b>${esc(HAIR_BY_ID[look.hairStyle]?.name || '')}</b> · ${esc(o.name)}</p>
          <p class="muted small">You start with a phone and a studio apartment in Eastgate. No car.</p></div>
        <div>${st.tab === 'you' ? you : lookTabs(look, st.tab)}</div></div></div>
      <div class="p-foot"><button class="btn" data-action="close">Back</button><button class="btn btn-primary" data-action="start">Hit the streets</button></div>`;
    paint(root, look, st);
    keepScroll(root, st);
    const nameIn = root.querySelector('[data-name]'), ageIn = root.querySelector('[data-age]');
    if (nameIn) nameIn.oninput = e => { data.name = e.target.value; };
    if (ageIn) ageIn.oninput = e => { data.age = +e.target.value; };
    bind(root, {
      ...editorHandlers(look, st, h),
      close: () => h.close(),
      mode: d => { data.story = d.v === '1'; h.refresh(); },
      origin: d => { data.origin = d.v; h.refresh(); },
      random: () => { randomLook(look, true); h.refresh(); },
      start: () => {
        const name = data.name.trim();
        if (!name) { toast('Pick a name first', 'bad'); if (st.tab !== 'you') { st.tab = 'you'; h.refresh(); } root.querySelector('[data-name]')?.focus(); return; }
        if (!(data.age >= 18 && data.age <= 70)) { toast('Age must be 18-70', 'bad'); return; }
        const veteran = SLOTS.some(sl => slotInfo(sl));   // already had careers on this profile: no tour unasked
        const s = createState({ name, age: data.age, look: { ...look, extras: [...(look.extras || [])], build: +look.build }, story: data.story });
        s.player.origin = data.origin;
        ORIGIN_BY_ID[data.origin]?.apply(s);
        s.player.outfits = [...new Set(['hoodie_black', 'jeans_blue', 'no_hat', 'kicks_white', look.top, look.bottom, look.hat])];
        s.listings = generateListings(30);
        s.listingsDay = 1;
        game.s = s;
        closeAllPanels();
        beginStory(s);
        saveGame('auto', true);
        enterWorld();
        maybeStartTutorial(app, { veteran });
      },
    });
  });
}

// The mirror at home: change hair, face and extras any time, free.
export function openMirror(s) {
  const look = s.player.look;
  look.extras ??= [];
  const st = { tab: 'hair', scroll: 0 };
  openPanel((root, h) => {
    root.innerHTML = `<div class="p-head"><h1>Mirror<small>Fresh cut, new look. On the house.</small></h1><button class="btn x" data-action="close">×</button></div>
      ${tabBar([['hair', 'Hair'], ['face', 'Face'], ['extras', 'Extras']], st.tab)}
      <div class="p-body"><div class="create">
        <div><canvas width="300" height="300" data-portrait></canvas>
          <p class="muted small"><b>${esc(HAIR_BY_ID[look.hairStyle]?.name || '')}</b></p></div>
        <div>${lookTabs(look, st.tab)}</div></div></div>
      <div class="p-foot"><button class="btn btn-primary" data-action="close">Looking good</button></div>`;
    paint(root, look, st);
    keepScroll(root, st);
    bind(root, { ...editorHandlers(look, st, h), close: () => h.close() });
  });
}
