// Car trailers from Kimari's sheets (2026-10-04), sold at Cowtown Trailer
// Sales next to Hook & Haul. Only trucks pull them (core/tow.js).
//
// len: overall length in metres, tongue tip to back. The top art faces up
// (tongue at the top), so `axle` and `deck` are fractions of that length
// measured from the tongue tip. maxCar: the longest car that fits (m).
// slow: how much a trailer takes off the truck's pull (more with a car on it).

export const TRAILERS = [
  {
    id: 'open_hauler', kind: 'open', axles: 2, price: 5200,
    name: '20 ft Open Car Hauler',
    desc: 'Wood deck, stand-up ramps, tandem axles. Light and cheap, and everybody sees what you brought.',
    len: 7.9, axle: 0.46, deck: [0.17, 0.87], maxCar: 6.1, slow: 0.12, loadedSlow: 0.22,
    side: 'img/trailers/open-hauler-side.png', top: 'img/trailers/open-hauler-top.png',
  },
  {
    id: 'enclosed_20', kind: 'enclosed', axles: 2, price: 11800,
    name: '20 ft Enclosed Car Trailer',
    desc: 'Tandem axle, rear ramp door, side door. The car rides out of sight and out of the weather.',
    len: 7.6, axle: 0.59, deck: [0.16, 0.97], maxCar: 5.9, slow: 0.18, loadedSlow: 0.27,
    side: 'img/trailers/enclosed-tandem-side.png', top: 'img/trailers/enclosed-tandem-top.png',
  },
  {
    id: 'enclosed_28', kind: 'enclosed', axles: 3, price: 19500,
    name: '28 ft Enclosed Race Trailer',
    desc: 'Triple axle, room for anything up to a full-size truck plus tools and tires. The pro setup.',
    len: 10.2, axle: 0.69, deck: [0.12, 0.98], maxCar: 8, slow: 0.24, loadedSlow: 0.32,
    side: 'img/trailers/enclosed-triple-side.png', top: 'img/trailers/enclosed-triple-top.png',
  },
];

export const TRAILER_BY_ID = Object.fromEntries(TRAILERS.map(t => [t.id, t]));
export const TRAILER_RESALE = 0.6;   // what the lot pays you back for one
