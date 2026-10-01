// Keyboard + touch input. Game code asks for actions ("throttle", "shiftUp")
// rather than keys, so the touch overlay and keyboard feed the same thing.

const down = new Set();
const pressedThisFrame = new Set();
const touchAxes = { throttle: 0, brake: 0, steer: 0 };
const touchHeld = new Set();
let enabled = true;

const BIND = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  nitrous: ['KeyN', 'ShiftLeft'],
  shiftUp: ['KeyE', 'PageUp'],
  shiftDown: ['KeyQ', 'PageDown'],
  interact: ['KeyE', 'Enter'],
  enterExit: ['KeyF'],
  phone: ['KeyP', 'Tab'],
  map: ['KeyM'],
  camera: ['KeyC'],
  horn: ['KeyH'],
  pause: ['Escape'],
  run: ['ShiftLeft'],
  lookBack: ['KeyB'],
};

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
window.addEventListener('keyup', e => { down.delete(e.code); });
window.addEventListener('blur', () => { down.clear(); });

export const input = {
  setEnabled(v) { enabled = v; if (!v) down.clear(); },
  held(action) {
    if (!enabled) return false;
    return BIND[action].some(k => down.has(k)) || touchHeld.has(action);
  },
  pressed(action) {
    if (!enabled) return false;
    return BIND[action].some(k => pressedThisFrame.has(k)) || touchPressed.has(action);
  },
  axis(action) {
    if (!enabled) return 0;
    if (BIND[action].some(k => down.has(k))) return 1;
    return touchAxes[action] || (touchHeld.has(action) ? 1 : 0);
  },
  steer() {
    if (!enabled) return 0;
    const k = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    return k || touchAxes.steer;
  },
  endFrame() { pressedThisFrame.clear(); touchPressed.clear(); },
  keyName(action) { return (BIND[action][0] || '').replace('Key', '').replace('Left', ''); },
};

// ---------------- touch overlay ----------------
const touchPressed = new Set();
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function buildTouchControls(root) {
  root.innerHTML = `
    <div class="tc-stick" data-stick><div class="tc-knob"></div></div>
    <div class="tc-right">
      <button class="tc-btn tc-gas" data-hold="throttle">GAS</button>
      <button class="tc-btn tc-brake" data-hold="brake">BRK</button>
      <button class="tc-btn" data-hold="nitrous">NOS</button>
      <button class="tc-btn" data-hold="handbrake">E-BRK</button>
      <button class="tc-btn" data-tap="shiftDown">−</button>
      <button class="tc-btn" data-tap="shiftUp">+</button>
      <button class="tc-btn" data-tap="enterExit">F</button>
      <button class="tc-btn" data-tap="interact">USE</button>
      <button class="tc-btn" data-tap="phone">☎</button>
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
      // on foot the stick also walks
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
