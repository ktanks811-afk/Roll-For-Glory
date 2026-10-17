// Car audio sold at the mechanic shops: subs in the trunk and door speakers.
// They change how the car radio sounds (core/audio.js): `pow` is how hard the
// subs hit (it sets the 808 drive, the clean sub and the trunk rattle), the
// door speakers add `bonus` on top and open up the mids and highs.
// A car keeps its build in car.audio = { subs, doors }; old cars have none.

export const SUBS = [
  { id: 'none', name: 'No subs',            desc: 'Factory radio. Thin, no real low end.',                 pow: 0.18, price: 0 },
  { id: '2x10', name: 'Two 10" subs',       desc: 'Tight punch, a little trunk buzz on the big notes.',    pow: 0.55, price: 450 },
  { id: '2x12', name: 'Two 12" subs',       desc: 'Real 808s. The trunk lid starts talking.',              pow: 0.75, price: 850 },
  { id: '2x15', name: 'Two 15" subs',       desc: 'Deep and slow. The plate rattles at every red light.',  pow: 0.92, price: 1400 },
  { id: '4x12', name: 'Four 12" subs',      desc: 'Wall of subs, two amps on the lid. Shakes the block.',  pow: 1.0,  price: 2200 },
];
export const DOORS = [
  { id: 'stock', name: 'Stock door speakers',          desc: 'Paper cones from the factory.',             bonus: 0,    price: 0 },
  { id: 'comp',  name: '6.5" component speakers',      desc: 'Clear vocals over the bass.',               bonus: 0.08, price: 300 },
  { id: 'pro',   name: 'Competition mids and tweeters', desc: 'Loud and clear with the windows down.',    bonus: 0.15, price: 750 },
];
export const SUB_BY_ID = Object.fromEntries(SUBS.map(x => [x.id, x]));
export const DOOR_BY_ID = Object.fromEntries(DOORS.map(x => [x.id, x]));

// the car's build, with old saves and unknown ids falling back to factory
export function audioBuild(car) {
  const subs = SUB_BY_ID[car?.audio?.subs] || SUBS[0];
  const doors = DOOR_BY_ID[car?.audio?.doors] || DOORS[0];
  return { subs, doors, pow: Math.min(1.1, subs.pow + doors.bonus) };
}
