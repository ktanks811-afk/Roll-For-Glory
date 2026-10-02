// Keyboard + touch input. Game code asks for actions ("throttle", "shiftUp")
// rather than keys, so the touch overlay and keyboard feed the same thing.
//
// Controls depend on what you're doing. Each context has its own action
// table, and an action that isn't in the current table does nothing:
//
//   foot — walking around: WASD move, Shift run, E interact, F get in a car
//   car  — driving:        W gas, S brake/reverse, A/D steer, Space e-brake,
//                          N/Shift nitrous, Q/E shift, Enter interact, F get out
//   race — in a race:      the driving controls minus things a race doesn't use
//   menu — nothing from the game world (title screen, results)
//
// When the context changes, keys that are already held are ignored until they
// are released, so holding Shift to run doesn't fire nitrous the moment you
// climb into the car, and holding W doesn't launch it.

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
window.addEventListener('blur', () => { down.clear(); latched.clear(); touchHeld.clear(); });

const keys = action => CONTEXTS[context][action];
const isDown = k => down.has(k) && !latched.has(k);

let touchRoot = null;

export const input = {
  get context() { return context; },
  // Switch control scheme. Keys already held are ignored until released.
  setContext(name) {
    if (name === context || !CONTEXTS[name]) return;
    context = name;
    latched.clear();
    for (const k of down) latched.add(k);
    touchHeld.clear();
    if (touchRoot) touchRoot.dataset.ctx = name;
  },
  setEnabled(v) { enabled = v; if (!v) { down.clear(); latched.clear(); } },
  has(action) { return !!keys(action); },
  held(action) {
    const ks = keys(action);
    if (!enabled || !ks) return false;
    return ks.some(isDown) || touchHeld.has(action);
  },
  pressed(action) {
    const ks = keys(action);
    if (!enabled || !ks) return false;
    return ks.some(k => pressedThisFrame.has(k) && !latched.has(k)) || touchPressed.has(action);
  },
  axis(action) {
    const ks = keys(action);
    if (!enabled || !ks) return 0;
    if (ks.some(isDown)) return 1;
    return touchAxes[TOUCH_AXIS[action]] || (touchHeld.has(action) ? 1 : 0);
  },
  steer() {
    if (!enabled || !keys('left')) return 0;
    const k = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    return k || touchAxes.steer;
  },
  endFrame() { pressedThisFrame.clear(); touchPressed.clear(); },
  // Key label for an action in a context (for on-screen hints).
  keyName(action, ctx = context) {
    const k = (CONTEXTS[ctx][action] || [])[0] || '';
    return k.replace('Key', '').replace('Arrow', '').replace('Left', '');
  },
};

// ---------------- touch overlay ----------------
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// data-for lists the contexts a button shows in; CSS hides it otherwise.
export function buildTouchControls(root) {
  touchRoot = root;
  root.dataset.ctx = context;
  root.innerHTML = `
    <div class="tc-stick" data-stick><div class="tc-knob"></div></div>
    <div class="tc-right">
      <button class="tc-btn tc-gas" data-for="car race" data-hold="throttle">GAS</button>
      <button class="tc-btn tc-brake" data-for="car race" data-hold="brake">BRK</button>
      <button class="tc-btn" data-for="car race" data-hold="nitrous">NOS</button>
      <button class="tc-btn" data-for="car" data-hold="handbrake">E-BRK</button>
      <button class="tc-btn" data-for="car race" data-tap="shiftDown">−</button>
      <button class="tc-btn" data-for="car race" data-tap="shiftUp">+</button>
      <button class="tc-btn" data-for="foot" data-hold="run">RUN</button>
      <button class="tc-btn" data-for="foot car" data-tap="enterExit">F</button>
      <button class="tc-btn" data-for="foot car" data-tap="interact">USE</button>
      <button class="tc-btn" data-for="car" data-tap="horn">HORN</button>
      <button class="tc-btn" data-for="foot car" data-tap="phone">☎</button>
    </div>`;
  root.querySelectorAll('[data-hold]').forEach(b => {
    const a = b.dataset.hold;
    const on = e => { e.preventDefault(); touchHeld.add(a); touchPressed.add(a); };
    const off = e => { e.preventDefault(); touchHeld.delete(a); };
    b.addEventListener('touchstart', on, { passive: false });
    b.addEventListener('touchend', off, { passive: false });
    b.addEventListener('touchcancel', off, { passive: false });
  });
  root.querySelectorAll('[data-tap]').forEach(b => {
    b.addEventListener('touchstart', e => { e.preventDefault(); touchPressed.add(b.dataset.tap); }, { passive: false });
  });
  const stick = root.querySelector('[data-stick]');
  const knob = stick.querySelector('.tc-knob');
  let id = null, cx = 0, cy = 0;
  stick.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0]; id = t.identifier;
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
  }, { passive: false });
  stick.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === id) {
      const dx = Math.max(-50, Math.min(50, t.clientX - cx));
      const dy = Math.max(-50, Math.min(50, t.clientY - cy));
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      touchAxes.steer = dx / 50;
      // up/down on the stick = forward/back on foot, gas/brake in a car
      touchAxes.throttle = dy < -15 ? Math.min(1, -dy / 50) : 0;
      touchAxes.brake = dy > 15 ? Math.min(1, dy / 50) : 0;
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) if (t.identifier === id) {
      id = null; knob.style.transform = ''; touchAxes.steer = 0; touchAxes.throttle = 0; touchAxes.brake = 0;
    }
  };
  stick.addEventListener('touchend', end);
  stick.addEventListener('touchcancel', end);
}
