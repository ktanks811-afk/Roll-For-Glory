// The Mustang's picture-based customization: which pictures exist for each part
// category, and which picture each installed part uses. The pictures are cut
// from the customization sheet (assets/mustang/parts, see scripts/slice-mustang.py).

const EMBLEMS = ['emblem50w', 'emblem50r', 'emblempony0', 'emblempony1', 'emblemgt0', 'emblemgt1'];
const seq = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

// view: where the part shows up — the side-view car, or the front / rear / top views
export const SPRITE_CATS = {
  wheels:      { view: 'side',  pics: seq('wheel', 9),      label: 'Wheels' },
  spoiler:     { view: 'side',  pics: seq('spoiler', 4),    label: 'Spoilers' },
  skirts:      { view: 'side',  pics: seq('skirt', 4),      label: 'Side skirts' },
  mirrors:     { view: 'side',  pics: seq('mirror', 5),     label: 'Mirrors' },
  handles:     { view: 'side',  pics: seq('handle', 4),     label: 'Door handles' },
  emblem:      { view: 'side',  pics: EMBLEMS,              label: 'Emblems' },
  headlights:  { view: 'side',  pics: seq('headlight', 6),  label: 'Headlights' },
  taillights:  { view: 'side',  pics: seq('taillight', 3),  label: 'Tail lights' },
  exhaustTips: { view: 'side',  pics: seq('tip', 4),        label: 'Exhaust tips' },
  frontBumper: { view: 'front', pics: seq('fbumper', 3),    label: 'Front bumpers' },
  grille:      { view: 'front', pics: seq('grille', 4),     label: 'Grilles' },
  plate:       { view: 'front', pics: seq('plate', 3),      label: 'License plates' },
  rearBumper:  { view: 'rear',  pics: seq('rbumper', 4),    label: 'Rear bumpers' },
  hood:        { view: 'top',   pics: seq('hood', 3),       label: 'Hoods' },
  roof:        { view: 'top',   pics: seq('roof', 3),       label: 'Roofs' },
  trunk:       { view: 'top',   pics: seq('trunk', 3),      label: 'Trunks & tails' },
};
export const SPRITE_VIEWS = ['side', 'front', 'rear', 'top'];

// Wheels bought before pictures existed: pick a design from the style.
const LEGACY_WHEEL = { five: 1, dish: 7, mesh: 8, split: 1, turbine: 0, six: 4 };

// Which picture of this category is on the car? null = the factory part.
export function designOfVisual(v, cat) {
  const d = v?.design?.[cat];
  if (d != null) return d;
  if (cat === 'wheels' && v?.wheels && v.wheels !== 'steel') return v.wheelColor === '#c9a24a' ? 2 : (LEGACY_WHEEL[v.wheels] ?? 4);
  return null;
}
