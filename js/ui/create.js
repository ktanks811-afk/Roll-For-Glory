// New-game character creation.

import { openPanel, closeAllPanels, bind, esc, toast } from './dom.js';
import { drawPortrait } from '../gfx2d/person.js';
import { SKIN_TONES, HAIR_COLORS, HAIR_STYLES, defaultLook, CLOTHES } from '../data/shops.js';
import { game, createState } from '../core/state.js';
import { beginStory } from '../core/story.js';
import { generateListings } from '../data/market.js';
import { saveGame } from '../core/save.js';
import { enterWorld } from '../main.js';

const STARTER_TOPS = ['hoodie_black', 'tee_white', 'tee_red', 'hoodie_grey'];
const STARTER_BOTTOMS = ['jeans_blue', 'jeans_black', 'track_black', 'cargo_tan'];
const STARTER_HATS = ['no_hat', 'cap_black', 'cap_red', 'beanie_grey'];

export function openCreate(app) {
  const look = { ...defaultLook(), build: '1' };
  const data = { name: '', age: 21, story: true };
  openPanel((root, h) => {
    const sw = (key, list) => `<div class="opts">${list.map(c => `<span class="swatch ${look[key] === c ? 'on' : ''}" style="background:${c}" data-action="look" data-k="${key}" data-v="${c}"></span>`).join('')}</div>`;
    const btns = (key, list, label = x => x) => `<div class="opts">${list.map(v => `<button class="${look[key] === v ? 'on' : ''}" data-action="look" data-k="${key}" data-v="${v}">${esc(label(v))}</button>`).join('')}</div>`;
    const cloth = id => CLOTHES.find(c => c.id === id)?.name || id;
    root.innerHTML = `<div class="p-head"><h1>New Career<small>Who's about to take over Port Solace?</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body"><div class="create">
        <div><canvas width="300" height="300" data-portrait></canvas>
          <p class="muted small">You start with $4,500, a phone, and a studio apartment in Eastgate. No car.</p></div>
        <div>
          <div class="row"><label class="field grow"><span>Name</span><input class="input" maxlength="20" data-name value="${esc(data.name)}" placeholder="Your street name"></label>
          <label class="field" style="width:110px"><span>Age</span><input class="input" type="number" min="18" max="70" data-age value="${data.age}"></label></div>
          <label class="field"><span>Skin tone</span>${sw('skin', SKIN_TONES)}</label>
          <label class="field"><span>Hair color</span>${sw('hair', HAIR_COLORS)}</label>
          <label class="field"><span>Hair style</span>${btns('hairStyle', HAIR_STYLES)}</label>
          <label class="field"><span>Build</span>${btns('build', ['0', '1', '2'], v => ['Slim', 'Average', 'Broad'][v])}</label>
          <label class="field"><span>Top</span>${btns('top', STARTER_TOPS, cloth)}</label>
          <label class="field"><span>Bottoms</span>${btns('bottom', STARTER_BOTTOMS, cloth)}</label>
          <label class="field"><span>Hat</span>${btns('hat', STARTER_HATS, cloth)}</label>
          <label class="field"><span>Mode</span><div class="opts">
            <button class="${data.story ? 'on' : ''}" data-action="mode" data-v="1">Story Mode</button>
            <button class="${!data.story ? 'on' : ''}" data-action="mode" data-v="0">Free Roam</button></div></label>
        </div></div></div>
      <div class="p-foot"><button class="btn" data-action="close">Back</button><button class="btn btn-primary" data-action="start">Hit the streets</button></div>`;
    const cv = root.querySelector('[data-portrait]');
    drawPortrait(cv.getContext('2d'), cv.width, cv.height, { ...look, build: +look.build });
    root.querySelector('[data-name]').oninput = e => { data.name = e.target.value; };
    root.querySelector('[data-age]').oninput = e => { data.age = +e.target.value; };
    bind(root, {
      close: () => h.close(),
      look: d => { look[d.k] = d.v; h.refresh(); },
      mode: d => { data.story = d.v === '1'; h.refresh(); },
      start: () => {
        const name = data.name.trim();
        if (!name) { toast('Pick a name first', 'bad'); root.querySelector('[data-name]').focus(); return; }
        if (!(data.age >= 18 && data.age <= 70)) { toast('Age must be 18-70', 'bad'); return; }
        const s = createState({ name, age: data.age, look: { ...look, build: +look.build }, story: data.story });
        s.player.outfits = [...new Set(['hoodie_black', 'jeans_blue', 'no_hat', 'kicks_white', look.top, look.bottom, look.hat])];
        s.listings = generateListings(30);
        s.listingsDay = 1;
        game.s = s;
        closeAllPanels();
        beginStory(s);
        saveGame('auto', true);
        enterWorld();
      },
    });
  });
}
