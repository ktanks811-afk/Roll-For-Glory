// Dog pictures: the Hogs & Dogs coat engine (gfx2d/dogCoat.js) paints each
// dog from its genes onto its breed's master. Painting takes a moment, so a
// screen puts <img> placeholders in with dogImg() and calls hydrateDogs()
// once it's in the page; pictures fill in one at a time and are cached.

import { Coat } from './dogCoat.js';
import { coatSpec, coatKey, coatName, breedName } from '../core/dogs.js';
import { esc } from '../ui/dom.js';

const CACHE = new Map(), PENDING = new Set(), JOBS = [];
let busy = false;
const scaleFor = w => w > 220 ? 0.5 : 0.25;   // two sizes keeps fewer maps in memory
const keyOf = (d, sc) => coatKey(d) + '@' + sc;
// pups are drawn smaller until they're grown
const pupW = (d, w) => Math.round(w * (d.age >= 12 ? 1 : 0.6 + 0.4 * d.age / 12));

export function dogImg(d, w = 120) {
  const sc = scaleFor(w), src = CACHE.get(keyOf(d, sc));
  return `<img class="dogimg" data-dog="${esc(d.id)}" data-sc="${sc}" ${src ? `src="${src}"` : ''} width="${w}" height="${Math.round(w * 2 / 3)}" alt="${esc(d.name)}, ${esc(coatName(d))} ${esc(breedName(d))}" style="width:${pupW(d, w)}px">`;
}

// Fill in every empty dog picture under root. dogs: the dogs on screen.
export function hydrateDogs(root, dogs) {
  const by = new Map(dogs.map(d => [d.id, d]));
  root.querySelectorAll('img.dogimg:not([src])').forEach(img => {
    const d = by.get(img.dataset.dog); if (!d) return;
    const sc = +img.dataset.sc, key = keyOf(d, sc);
    if (CACHE.has(key)) { img.src = CACHE.get(key); return; }
    if (PENDING.has(key)) return;
    PENDING.add(key);
    const spec = coatSpec(d);
    JOBS.push({ key, run: async () => {
      const c = await Coat.render(spec, sc);
      CACHE.set(key, c.toDataURL('image/png'));
      if (CACHE.size > 120) CACHE.delete(CACHE.keys().next().value);
      PENDING.delete(key);
      document.querySelectorAll(`img.dogimg[data-dog="${CSS.escape(d.id)}"][data-sc="${sc}"]`).forEach(i => { i.src = CACHE.get(key); });
    } });
  });
  pump();
}
async function pump() {
  if (busy) return;
  busy = true;
  while (JOBS.length) {
    const j = JOBS.shift();
    try { await j.run(); } catch (e) { PENDING.delete(j.key); console.warn('dog art', e.message); }
    await new Promise(r => setTimeout(r, 0));
  }
  busy = false;
}
export const dogArtBusy = () => busy || JOBS.length > 0;
