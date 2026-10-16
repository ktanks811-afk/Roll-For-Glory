// Inside a mall (data/malls.js): the store directory, the food court, and
// walking around. Clothes stores reuse the wardrobe screen, the jeweler
// reuses the Luxe catalog.

import { openPanel, bind, esc, toast, modal } from './dom.js';
import { game, hourOf } from '../core/state.js';
import { MALL_BY_ID, MALL_STORES, MALL_HOURS, isSunday } from '../data/malls.js';
import { LOC_BY_ID, districtAt } from '../data/world.js';
import { isOpen, walkMall } from '../core/mall.js';
import { wardrobe, food } from './places.js';
import { advanceTime } from './garage.js';
import { openLuxe } from './luxe.js';

const head = (title, sub = '') => `<div class="p-head"><h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1><button class="btn x" data-action="close">×</button></div>`;
const clock = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

export function openMall(loc, app) {
  const s = game.s, mall = MALL_BY_ID[loc.id];
  if (!mall) return;
  const meetLot = loc.id === 'mall_gran_plaza' ? LOC_BY_ID.gran_plaza : null;
  openPanel((root, h) => {
    const open = isOpen(s), sun = isSunday(s.time.day);
    const hours = sun ? `Sunday ${clock(MALL_HOURS.sunOpen)} to ${clock(MALL_HOURS.sunClose)}` : `${clock(MALL_HOURS.open)} to ${clock(MALL_HOURS.close)}`;
    const sub = `${esc(districtAt(loc.x, loc.z))} · ${open ? `<b class="good">Open</b> till ${clock(sun ? MALL_HOURS.sunClose : MALL_HOURS.close)}` : `<b class="bad">Closed</b> · ${hours}`}`;
    const meet = meetLot ? `<div class="li"><span style="font-size:22px">🚗</span><div class="grow"><div class="t">${esc(meetLot.name)}</div><div class="s">The lot across the street is the weekend night meet: Friday and Saturday, 9 PM to 3 AM.</div></div><button class="btn btn-sm" data-action="meet">GPS</button></div>` : '';
    if (!open) {
      const opens = hourOf(s.time) < (sun ? MALL_HOURS.sunOpen : MALL_HOURS.open) ? 'later today' : 'tomorrow';
      root.innerHTML = head(mall.name, sub) + `<div class="p-body" style="max-width:640px">
        <p>The doors are chained. A security guard in a golf cart flashes a light at you. Come back ${opens}.</p>
        <p class="muted small">Open ${clock(MALL_HOURS.open)} to ${clock(MALL_HOURS.close)}, Sunday ${clock(MALL_HOURS.sunOpen)} to ${clock(MALL_HOURS.sunClose)}.</p>${meet}</div>`;
      bind(root, { close: () => h.close(), meet: () => gps(app, meetLot, h) });
      return;
    }
    const stores = mall.stores.map(id => ({ id, ...MALL_STORES[id] }));
    root.innerHTML = head(mall.name, sub) + `<div class="p-body">
      <p class="muted small">${esc(mall.blurb)}</p>
      <div class="section-title">Directory</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${stores.map(st => `<div class="card click" data-action="store" data-id="${st.id}"><div style="font-size:26px">${st.icon}</div><h3>${esc(st.name)}</h3><p class="muted small">${esc(st.blurb)}</p></div>`).join('')}</div>
      <div class="section-title">Hang out</div>
      <div class="li"><span style="font-size:22px">🚶</span><div class="grow"><div class="t">Walk the mall</div><div class="s">An hour of laps. Get recognized, catch a fit pic, flip a pair from a drop line. Mall cops notice people with heat.</div></div><button class="btn btn-sm btn-primary" data-action="walk">Walk · 1 hr</button></div>
      ${meet}</div>`;
    bind(root, {
      close: () => h.close(),
      meet: () => gps(app, meetLot, h),
      store: d => {
        const st = MALL_STORES[d.id];
        if (st.kind === 'clothes') wardrobe(app, s, { name: `${st.name} · ${mall.name}`, shop: st.shop });
        else if (st.kind === 'food') food({ name: `${mall.name} Food Court`, menu: 'foodcourt' }, app, s);
        else if (st.kind === 'jewelry') { openLuxe(app, 'jewelry'); toast(`${st.name}: same pieces as Luxe, try them on at the counter`, 'info'); }
      },
      walk: () => {
        const r = walkMall(s, mall);
        advanceTime(s, 60);
        modal(r.kind === 'security' && r.hot ? 'Mall cops' : mall.name, `<p>${esc(r.text)}</p>`);
        h.refresh();
      },
    });
  });
}

function gps(app, l, h) {
  app.world?.setGps(l.x, l.z, l.name);
  toast('GPS set', 'info');
  h.close();
}
