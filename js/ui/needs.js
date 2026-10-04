// The snack bag: tap the food/energy meters on the HUD to eat what you're
// carrying, or get the GPS to the nearest food or your bed.

import { modal, toast, esc } from './dom.js';
import { game } from '../core/state.js';
import { LOCATIONS, LOC_BY_ID } from '../data/world.js';
import { BAG, eatFromBag, ensureNeeds } from '../core/needs.js';

export async function openBag(app) {
  const s = game.s, w = app.world;
  if (!s) return;
  ensureNeeds(s);
  const have = BAG.filter(b => s.inventory[b.id] > 0);
  const p = w?.playerState();
  const food = p && LOCATIONS.filter(l => l.type === 'food').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  const home = LOC_BY_ID[s.home];
  const html = `<p>🌮 Food <b>${Math.round(s.player.food)}</b>/100 · ⚡ Energy <b>${Math.round(s.player.energy)}</b>/100</p>
    <p class="small muted">${have.length ? 'In your bag: ' + have.map(b => `${b.icon} ${esc(b.name)} ×${s.inventory[b.id]}`).join(', ') + '.' : 'Your bag is empty. Taco trucks sell tacos to go, gas stations sell energy drinks.'}
    Eat at taco trucks and diners. Sleep at a place you own to rest up and save.</p>`;
  const buttons = [
    ...have.map(b => ({ label: `${b.icon} ${b.id === 'energyDrinks' ? 'Drink' : 'Eat'} ${b.name}`, primary: true, value: 'eat:' + b.id })),
    ...(food && w ? [{ label: '🌮 GPS: food', value: 'food' }] : []),
    ...(home && w ? [{ label: '🛏 GPS: home', value: 'home' }] : []),
    { label: 'Close', value: 'close' },
  ];
  const r = await modal('Food & sleep', html, buttons);
  if (typeof r === 'string' && r.startsWith('eat:')) {
    if (eatFromBag(s, r.slice(4))) toast(`Food ${Math.round(s.player.food)} · Energy ${Math.round(s.player.energy)}`, 'good');
  } else if (r === 'food') w.setGps(food.x, food.z, food.name);
  else if (r === 'home') w.setGps(home.x, home.z, home.name);
}
