// Game controllers (Xbox and anything else the browser reports with the
// "standard" layout) through the Gamepad API. Polled once a frame from the main
// loop; core/input.js turns the buttons into game actions and ui/padnav.js uses
// them to move around menus.
//
// Buttons are named after the Xbox pad. Sticks and triggers also show up as
// buttons (LSU/LSD/LSL/LSR for the left stick pushed that way, LT/RT pulled in)
// so they can be bound like any other button, and their analog values are in
// pad.lx / ly / rx / ry / lt / rt.

const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME'];
const DEAD = 0.2;          // stick dead zone
const TRIG_DEAD = 0.06;
const listeners = new Set();

export const pad = {
  connected: false,
  name: '',
  inUse: false,            // the pad is what the player touched last (vs. keyboard / touch screen)
  down: new Set(),         // button names held this frame
  edge: new Set(),         // button names that went down this frame
  lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0,
  onUse(fn) { listeners.add(fn); },
};

let index = -1;

function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * k, y * k];
}
const trig = v => (v < TRIG_DEAD ? 0 : Math.min(1, (v - TRIG_DEAD) / (1 - TRIG_DEAD)));

// With hysteresis, so a stick resting near the threshold doesn't chatter.
function dir(name, v, held) { if (v > 0.55 || (v > 0.35 && pad.down.has(name))) held.add(name); }

function setInUse(v) {
  if (pad.inUse === v) return;
  pad.inUse = v;
  for (const fn of listeners) fn(v);
}

function find() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  if (index >= 0 && list[index]?.connected) return list[index];
  index = -1;
  for (const gp of list) if (gp && gp.connected) { index = gp.index; return gp; }
  return null;
}

export function pollPad() {
  pad.edge.clear();
  const gp = find();
  if (!gp) {
    if (pad.connected) { pad.connected = false; pad.down.clear(); pad.lx = pad.ly = pad.rx = pad.ry = pad.lt = pad.rt = 0; setInUse(false); }
    return;
  }
  pad.connected = true;
  pad.name = gp.id;
  const b = i => gp.buttons[i];
  const held = new Set();
  for (let i = 0; i < NAMES.length && i < gp.buttons.length; i++) if (b(i)?.pressed) held.add(NAMES[i]);
  [pad.lx, pad.ly] = stick(gp.axes[0] || 0, gp.axes[1] || 0);
  [pad.rx, pad.ry] = stick(gp.axes[2] || 0, gp.axes[3] || 0);
  pad.lt = trig(b(6)?.value ?? 0);
  pad.rt = trig(b(7)?.value ?? 0);
  if (pad.lt > 0.3) held.add('LT'); else if (pad.lt < 0.15) held.delete('LT');
  if (pad.rt > 0.3) held.add('RT'); else if (pad.rt < 0.15) held.delete('RT');
  dir('LSL', -pad.lx, held); dir('LSR', pad.lx, held);
  dir('LSU', -pad.ly, held); dir('LSD', pad.ly, held);
  for (const n of held) if (!pad.down.has(n)) pad.edge.add(n);
  pad.down = held;
  if (pad.edge.size || Math.abs(pad.lx) + Math.abs(pad.ly) + Math.abs(pad.rx) + Math.abs(pad.ry) > 0.3) setInUse(true);
}

export const padHeld = n => pad.down.has(n);
export const padPressed = n => pad.edge.has(n);

// Rumble, where the browser supports it (Chrome / Edge; Safari ignores it).
export function rumble(strong = 0.5, weak = 0.5, ms = 120) {
  if (!pad.connected || !pad.inUse) return;
  const gp = find();
  try { gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch { /* no rumble */ }
}

// Back to keyboard or the touch screen: the touch controls and key hints come back.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, e => { if (e.isTrusted !== false) setInUse(false); }, true);
window.addEventListener('gamepadconnected', () => { find(); });
window.addEventListener('gamepaddisconnected', () => { index = -1; });
