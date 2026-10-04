// Keyboard, touch and controller input. Game code asks for actions ("throttle", "shiftUp")
// rather than keys, so the touch overlay and keyboard feed the same thing.
//
// Controls depend on what you're doing. Each context has its own action
// table, and an action that isn't in the current table does nothing:
//
//   foot — walking around: WASD move, Shift run, E interact, F get in a car,
//          G draw/holster, J or Space or click fire, R reload, T steal a car
//   car  — driving:        W gas, S brake/reverse, A/D steer, Space e-brake,
//                          N/Shift nitrous, Q/E shift, Enter interact, F get out
//   race — in a race:      the driving controls minus things a race doesn't use
//   menu — nothing from the game world (title screen, results)
//
// A controller (core/gamepad.js) has its own table per context, PAD below.
//
// When the context changes, keys that are already held are ignored until they
// are released, so holding Shift to run doesn't fire nitrous the moment you
// climb into the car, and holding W doesn't launch it.

import { pad, pollPad } from './gamepad.js';

const down = new Set();
const latched = new Set();        // held when the context changed; ignored until released
const pressedThisFrame = new Set();
const touchPressed = new Set();
const touchHeld = new Set();
const touchAxes = { throttle: 0, brake: 0, steer: 0 };
let enabled = true;
let context = 'menu';

const COMMON = {
  phone: ['KeyP', 'Tab'],
  map: ['KeyM'],
  camera: ['KeyC'],
  pause: ['Escape'],
  enterExit: ['KeyF'],
};
const MOVE_X = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };

export const CONTEXTS = {
  foot: {
    ...COMMON, ...MOVE_X,
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    run: ['ShiftLeft', 'ShiftRight'],
    interact: ['KeyE', 'Enter'],
    draw: ['KeyG'],
    fire: ['KeyJ', 'Space'],
    reload: ['KeyR'],
    mask: ['KeyV'],
    steal: ['KeyT'],
  },
  car: {
    ...COMMON, ...MOVE_X,
    throttle: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'],
    handbrake: ['Space'],
    nitrous: ['KeyN', 'ShiftLeft'],
    shiftUp: ['KeyE', 'PageUp'],
    shiftDown: ['KeyQ', 'PageDown'],
    horn: ['KeyH'],
    view: ['KeyV'],   // third-person / top-down camera (on foot V is the ski mask)
    interact: ['Enter'],
  },
  race: {
    ...MOVE_X,
    pause: ['Escape'],
    throttle: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'],
    nitrous: ['KeyN', 'ShiftLeft'],
    shiftUp: ['KeyE', 'PageUp'],
    shiftDown: ['KeyQ', 'PageDown'],
  },
  menu: {},
};

// Xbox layout. Sticks and triggers are analog where it matters (gas, brake,
// steering, walking); see axis() and steer().
const PAD_COMMON = { phone: ['VIEW'], pause: ['MENU'], map: ['UP'], camera: ['DOWN'] };
export const PAD = {
  foot: {
    ...PAD_COMMON,
    interact: ['A'], run: ['B', 'LS'], steal: ['X'], enterExit: ['Y'],
    fire: ['RT'], draw: ['LT'], reload: ['RB'], mask: ['LB'],
    forward: ['LSU'], back: ['LSD'], left: ['LSL'], right: ['LSR'],
  },
  car: {
    ...PAD_COMMON,
    throttle: ['RT'], brake: ['LT'], handbrake: ['A'], interact: ['B'], nitrous: ['X'], enterExit: ['Y'],
    shiftUp: ['RB'], shiftDown: ['LB'], horn: ['LS'], view: ['RS'],
    left: ['LSL', 'LEFT'], right: ['LSR', 'RIGHT'],
  },
  race: {
    pause: ['MENU'],
    throttle: ['RT'], brake: ['LT'], nitrous: ['X', 'A'], shiftUp: ['RB', 'B'], shiftDown: ['LB'],
    left: ['LSL', 'LEFT'], right: ['LSR', 'RIGHT'],
  },
  menu: {},
};
const PAD_AXIS = { throttle: () => pad.rt, brake: () => pad.lt, forward: () => Math.max(0, -pad.ly), back: () => Math.max(0, pad.ly) };
const padLatched = new Set();     // pad buttons held when the context changed or a menu closed
let padOff = false;               // a menu is open: the pad drives the menu (ui/padnav.js), not the game

// The touch stick drives different actions depending on context.
const TOUCH_AXIS = { forward: 'throttle', back: 'brake', throttle: 'throttle', brake: 'brake' };

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

window.addEventListener('keydown', e => {
  if (isTyping(e)) return;
  if (!down.has(e.code)) pressedThisFrame.add(e.code);
  down.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { down.delete(e.code); latched.delete(e.code); });
window.addEventListener('blur', () => { down.clear(); latched.clear(); touchHeld.clear(); input.latchPad(); });

const keys = action => CONTEXTS[context][action];
const isDown = k => down.has(k) && !latched.has(k);
const padKeys = action => (padOff ? null : PAD[context][action]);
const padDown = b => pad.down.has(b) && !padLatched.has(b);
const padHit = action => !!padKeys(action)?.some(padDown);
const padEdge = action => !!padKeys(action)?.some(b => pad.edge.has(b) && !padLatched.has(b));
function padAxis(action) {
  const ks = padKeys(action), f = PAD_AXIS[action];
  if (!ks || !f || ks.some(b => padLatched.has(b))) return 0;
  return f();
}

const contextListeners = new Set();

export const input = {
  get context() { return context; },
  // Switch control scheme. Keys already held are ignored until released.
  setContext(name) {
    if (name === context || !CONTEXTS[name]) return;
    context = name;
    latched.clear();
    for (const k of down) latched.add(k);
    this.latchPad();
    touch.reset();
    for (const fn of contextListeners) fn(name);
  },
  onContext(fn) { contextListeners.add(fn); },
  // Read the controller (once a frame, before the game updates). nav() moves
  // around any open menu and says whether there is one: if so the pad is busy
  // with it, so the game ignores it; buttons still held
  // when the menu closes are ignored until released.
  pollPad(nav) {
    pollPad();
    const menuOpen = nav();
    for (const b of padLatched) if (!pad.down.has(b)) padLatched.delete(b);
    if (padOff && !menuOpen) this.latchPad();
    padOff = menuOpen;
  },
  latchPad() { padLatched.clear(); for (const b of pad.down) padLatched.add(b); },
  setEnabled(v) { enabled = v; if (!v) { down.clear(); latched.clear(); } },
  has(action) { return !!keys(action); },
  held(action) {
    const ks = keys(action);
    if (!enabled || !ks) return false;
    return ks.some(isDown) || touchHeld.has(action) || padHit(action);
  },
  pressed(action) {
    const ks = keys(action);
    if (!enabled || !ks) return false;
    return ks.some(k => pressedThisFrame.has(k) && !latched.has(k)) || touchPressed.has(action) || padEdge(action);
  },
  axis(action) {
    const ks = keys(action);
    if (!enabled || !ks) return 0;
    if (ks.some(isDown)) return 1;
    return touchAxes[TOUCH_AXIS[action]] || (touchHeld.has(action) ? 1 : 0) || padAxis(action);
  },
  steer() {
    if (!enabled || !keys('left')) return 0;
    const kt = side => keys(side).some(isDown) || touchHeld.has(side);
    const k = (kt('right') ? 1 : 0) - (kt('left') ? 1 : 0);
    if (k || touchAxes.steer) return k || touchAxes.steer;
    if (padOff) return 0;
    const d = (padDown('RIGHT') ? 1 : 0) - (padDown('LEFT') ? 1 : 0);
    return d || pad.lx;
  },
  // Right stick aim on foot (an angle in the same convention as the player's
  // heading), or null when the stick is centred.
  aim() {
    if (!enabled || padOff || context !== 'foot' || Math.hypot(pad.rx, pad.ry) < 0.35) return null;
    return Math.atan2(pad.rx, -pad.ry);
  },
  endFrame() { pressedThisFrame.clear(); touchPressed.clear(); },
  // Key label for an action in a context (for on-screen hints).
  keyName(action, ctx = context) {
    const k = (CONTEXTS[ctx][action] || [])[0] || '';
    return k.replace('Key', '').replace('Arrow', '').replace('Left', '');
  },
};

// ---------------- touch ----------------
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// What the on-screen controls (ui/touch.js) drive. Same actions as the
// keyboard, so game code never knows the difference.
export const touch = {
  hold(action, on) {
    if (on) { touchHeld.add(action); touchPressed.add(action); } else touchHeld.delete(action);
  },
  press(action) { touchPressed.add(action); },
  axis(name, v) { touchAxes[name] = v; },
  reset() { touchHeld.clear(); touchAxes.throttle = touchAxes.brake = touchAxes.steer = 0; },
};
