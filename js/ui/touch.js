// On-screen controls for phones. What shows depends on what you're doing:
//
//   walking  — joystick, RUN, IN (get in car), USE, STEAL (next to a car you can take)
//   driving  — ◀ ▶ steering arrows, BRAKE and GAS pedals, a shift knob,
//              NOS, E-BRAKE, HORN, OUT (get out), USE
//   racing   — arrows (change lanes), pedals, shift knob, NOS
//
// Everything uses pointer events with capture, so you can steer with one
// thumb and work the pedals with the other, and drag races (brake + gas held
// together) work. Layout and sizing live in css/touch.css.
//
// Players can move and resize every control (Settings → Edit button layout).
// Their layout is saved per orientation in settings.touchLayout as offsets
// from the default spot (fractions of the screen) plus a size.

import { input, touch, isTouchDevice } from '../core/input.js';
import { pad } from '../core/gamepad.js';
import { settings, saveSettings } from '../core/save.js';
import { toast } from './dom.js';
import { buzz } from './haptics.js';

let root = null;
let wanted = false;      // in the world or a race (not on the title screen)
let enabled = false;     // settings + device say touch controls should show
const els = {};

const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } };

function holdButton(el, action) {
  const down = e => { e.preventDefault(); capture(el, e); el.classList.add('on'); touch.hold(action, true); buzz(8); };
  const up = () => { el.classList.remove('on'); touch.hold(action, false); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}

function tapButton(el, action) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); capture(el, e); el.classList.add('on'); touch.press(action); buzz(10); });
  const up = () => el.classList.remove('on');
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}

// Shift knob: drag it up for an upshift, down for a downshift (it springs
// back, drag again to shift again). Tap the top or bottom of the housing to
// shift too. Tap the knob itself to switch between automatic and manual.
function wireShifter(box, knob) {
  let pid = null, y0 = 0, fired = false, moved = false;
  const fire = dir => { touch.press(dir); buzz(14); box.classList.add(dir === 'shiftUp' ? 'up' : 'down'); setTimeout(() => box.classList.remove('up', 'down'), 140); };
  box.addEventListener('pointerdown', e => {
    e.preventDefault(); capture(box, e);
    pid = e.pointerId; y0 = e.clientY; fired = false; moved = false;
    box.classList.add('on');
  });
  box.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const dy = e.clientY - y0;
    const lim = box.clientHeight * 0.28;
    knob.style.transform = `translateY(${Math.max(-lim, Math.min(lim, dy))}px)`;
    if (!fired && Math.abs(dy) > 14) { fired = true; moved = true; fire(dy < 0 ? 'shiftUp' : 'shiftDown'); }
    else if (fired && Math.abs(dy) < 6) fired = false;      // back at centre: re-arm
  });
  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    box.classList.remove('on');
    knob.style.transform = '';
    if (moved) return;
    const r = box.getBoundingClientRect(), k = knob.getBoundingClientRect();
    if (e.clientY >= k.top && e.clientY <= k.bottom) {
      settings.transmission = settings.transmission === 'auto' ? 'manual' : 'auto';
      saveSettings();
      refreshMode();
      toast(settings.transmission === 'auto' ? 'Automatic transmission' : 'Manual — drag the shift knob up and down', 'info');
    } else fire(e.clientY < r.top + r.height / 2 ? 'shiftUp' : 'shiftDown');
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
}

// Steering wheel: drag around its centre. It turns as far as your finger turns
// it (up to about a third of a turn each way), and spins back to centre on release.
function wireWheel(wheel, rot) {
  const MAX = 1.75;   // radians of lock each way
  let pid = null, cx = 0, cy = 0, last = 0, angle = 0, raf = 0;
  const apply = () => { rot.style.transform = `rotate(${angle}rad)`; touch.axis('steer', Math.max(-1, Math.min(1, angle / MAX))); };
  const ang = e => Math.atan2(e.clientY - cy, e.clientX - cx);
  const spring = () => {
    cancelAnimationFrame(raf);
    const step = () => { angle *= 0.78; if (Math.abs(angle) < 0.01) angle = 0; apply(); if (angle) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  };
  wheel.addEventListener('pointerdown', e => {
    e.preventDefault(); capture(wheel, e); pid = e.pointerId; cancelAnimationFrame(raf);
    const r = wheel.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; last = ang(e);
    buzz(8);
  });
  wheel.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const a = ang(e); let d = a - last;
    if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
    last = a; angle = Math.max(-MAX, Math.min(MAX, angle + d)); apply();
  });
  const up = e => { if (e && e.pointerId !== pid) return; pid = null; spring(); };
  wheel.addEventListener('pointerup', up);
  wheel.addEventListener('pointercancel', up);
  wheel.addEventListener('lostpointercapture', () => { if (pid !== null) up(); });
  return () => { pid = null; cancelAnimationFrame(raf); angle = 0; rot.style.transform = ''; };
}

// Walking joystick.
function wireStick(stick, knob) {
  let pid = null, cx = 0, cy = 0;
  let sc = 1;   // the player may have resized the stick
  const R = () => stick.clientWidth * sc * 0.36;
  const set = (dx, dy) => {
    const r = R(), d = Math.hypot(dx, dy) || 1, k = d > r ? r / d : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx / sc}px, ${dy / sc}px)`;
    touch.axis('steer', dx / r);
    touch.axis('throttle', dy < -0.18 * r ? Math.min(1, -dy / r) : 0);   // up = forward
    touch.axis('brake', dy > 0.18 * r ? Math.min(1, dy / r) : 0);        // down = back
  };
  const stop = () => { pid = null; knob.style.transform = ''; touch.axis('steer', 0); touch.axis('throttle', 0); touch.axis('brake', 0); };
  stick.addEventListener('pointerdown', e => {
    e.preventDefault(); capture(stick, e); pid = e.pointerId;
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    sc = r.width / (stick.clientWidth || r.width) || 1;
    set(e.clientX - cx, e.clientY - cy);
  });
  stick.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e.clientX - cx, e.clientY - cy); });
  stick.addEventListener('pointerup', e => { if (e.pointerId === pid) stop(); });
  stick.addEventListener('pointercancel', e => { if (e.pointerId === pid) stop(); });
  return stop;
}

// ---------- custom layout ----------
const orient = () => (innerHeight > innerWidth ? 'portrait' : 'landscape');
let editing = null;      // { draft, ctx, sel, drag } while the layout editor is open

function applyLayout(L = settings.touchLayout) {
  if (!root) return;
  const pos = (L && L[orient()]) || {};
  root.querySelectorAll('[data-ed]').forEach(n => {
    const p = pos[n.dataset.ed];
    n.style.translate = p && (p.x || p.y) ? `${Math.round(p.x * innerWidth)}px ${Math.round(p.y * innerHeight)}px` : '';
    n.style.scale = p && p.s && p.s !== 1 ? String(p.s) : '';
  });
}

function editSpot(id) {
  const o = orient(), d = editing.draft;
  d[o] = d[o] || {};
  return (d[o][id] = d[o][id] || { x: 0, y: 0, s: 1 });
}

function selectEdit(n) {
  root.querySelectorAll('.tc-ed-sel').forEach(x => x.classList.remove('tc-ed-sel'));
  editing.sel = n;
  const r = root.querySelector('[data-esize]');
  if (n) { n.classList.add('tc-ed-sel'); r.disabled = false; r.value = editSpot(n.dataset.ed).s; }
  else r.disabled = true;
}

function setEditCtx(ctx) {
  editing.ctx = ctx;
  root.dataset.ctx = ctx;
  root.querySelectorAll('[data-ectx]').forEach(b => b.classList.toggle('on', b.dataset.ectx === ctx));
  selectEdit(null);
}

function closeEditor(save) {
  if (!editing) return;
  if (save) { settings.touchLayout = editing.draft; saveSettings(); toast('Button layout saved', 'good'); }
  editing = null;
  root.querySelector('.tc-edit')?.remove();
  root.querySelectorAll('.tc-ed-sel').forEach(x => x.classList.remove('tc-ed-sel'));
  root.classList.remove('editing');
  root.dataset.ctx = input.context;
  applyLayout();
  apply();
}

function wireEditor() {
  // Capture phase, so while editing a touch moves the control instead of pressing it.
  const grab = e => {
    if (!editing || e.target.closest('.tc-edit')) return;
    e.stopPropagation(); e.preventDefault();
    const n = e.target.closest('[data-ed]');
    if (!n || editing.drag) return;
    selectEdit(n); buzz(8);
    const p = editSpot(n.dataset.ed), r = n.getBoundingClientRect();
    editing.drag = { pid: e.pointerId, n, p, x0: e.clientX, y0: e.clientY, px: p.x, py: p.y, r };
    try { root.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  };
  const move = e => {
    const g = editing?.drag;
    if (!g || e.pointerId !== g.pid) return;
    e.stopPropagation();
    const W = innerWidth, H = innerHeight;
    const dx = Math.max(-g.r.left, Math.min(W - g.r.right, e.clientX - g.x0));
    const dy = Math.max(-g.r.top, Math.min(H - g.r.bottom, e.clientY - g.y0));
    g.p.x = g.px + dx / W; g.p.y = g.py + dy / H;
    applyLayout(editing.draft);
  };
  const end = e => {
    const g = editing?.drag;
    if (!g || e.pointerId !== g.pid) return;
    e.stopPropagation();
    editing.drag = null;
  };
  root.addEventListener('pointerdown', grab, true);
  root.addEventListener('pointermove', move, true);
  root.addEventListener('pointerup', end, true);
  root.addEventListener('pointercancel', end, true);
  addEventListener('resize', () => { if (editing) selectEdit(null); applyLayout(editing ? editing.draft : undefined); });
}

function openEditor() {
  if (!root || editing) return;
  touchUi.releaseAll?.();
  editing = { draft: JSON.parse(JSON.stringify(settings.touchLayout || {})), ctx: 'car', sel: null, drag: null };
  root.classList.add('editing');
  root.insertAdjacentHTML('beforeend', `
    <div class="tc-edit">
      <div class="tc-edit-row">
        <button data-ectx="car">Driving</button><button data-ectx="foot">Walking</button>
        <label class="tc-edit-size">Size <input type="range" min="0.6" max="1.6" step="0.05" value="1" data-esize disabled></label>
      </div>
      <div class="tc-edit-row">
        <button data-eact="reset">Reset</button><button data-eact="cancel">Cancel</button><button class="tc-edit-save" data-eact="save">Save</button>
      </div>
      <div class="tc-edit-tip">Drag a button to move it. Tap one, then slide Size. Portrait and landscape are saved separately.</div>
    </div>`);
  const bar = root.querySelector('.tc-edit');
  bar.addEventListener('pointerup', e => {   // not click: #touch blocks taps from turning into clicks
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ectx) setEditCtx(b.dataset.ectx);
    else if (b.dataset.eact === 'save') closeEditor(true);
    else if (b.dataset.eact === 'cancel') closeEditor(false);
    else if (b.dataset.eact === 'reset') { editing.draft = {}; selectEdit(null); applyLayout(editing.draft); toast('Back to the default layout — tap Save to keep it', 'info'); }
  });
  bar.querySelector('[data-esize]').addEventListener('input', e => {
    if (!editing.sel) return;
    editSpot(editing.sel.dataset.ed).s = +e.target.value;
    applyLayout(editing.draft);
  });
  setEditCtx('car');
  applyLayout(editing.draft);
  apply();
}

function refreshMode() {
  if (!els.mode) return;
  root.classList.toggle('wheel', settings.steerMode === 'wheel');
  const auto = settings.transmission === 'auto';
  els.mode.textContent = auto ? 'A' : 'M';
  root.classList.toggle('manual', !auto);
}

function apply() {
  if (!root) return;
  const on = (wanted && enabled) || !!editing;
  root.classList.toggle('hidden', !on);
  document.body.classList.toggle('touch', wanted && enabled);
}

export const touchUi = {
  get active() { return wanted && enabled; },

  mount(el) {
    root = el;
    root.dataset.ctx = input.context;
    root.innerHTML = `
      <div class="tc-foot">
        <div class="tc-stick" data-stick data-ed="stick"><div class="tc-knob"></div></div>
        <div class="tc-foot-btns">
          <button class="tc-btn tc-round tc-sm tc-gun" data-tap="reload" data-ed="reload">RE-<br>LOAD</button>
          <button class="tc-btn tc-round tc-sm tc-gun" data-tap="draw" data-ed="draw">ARM</button>
          <button class="tc-btn tc-round tc-sm tc-mask" data-tap="mask" data-ed="mask">MASK</button>
          <button class="tc-btn tc-round tc-fire" data-hold="fire" data-ed="fire">FIRE</button>
          <button class="tc-btn tc-round" data-hold="run" data-ed="run">RUN</button>
          <button class="tc-btn tc-round" data-tap="enterExit" data-ed="getin">GET<br>IN</button>
          <button class="tc-btn tc-round tc-use" data-tap="interact" data-ed="use">USE</button>
          <button class="tc-btn tc-round tc-steal" data-tap="steal" data-ed="steal">STEAL</button>
        </div>
      </div>
      <div class="tc-drive">
        <div class="tc-wheel" data-wheel data-ed="wheel" aria-label="Steering wheel">
          <svg viewBox="-50 -50 100 100"><g data-wheel-rot>
            <circle r="42" fill="rgba(20,22,26,.55)" stroke="rgba(255,255,255,.75)" stroke-width="7"/>
            <circle r="12" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" stroke-width="2"/>
            <path d="M-40 0H-12M12 0H40M0 12V40" stroke="rgba(255,255,255,.7)" stroke-width="6" stroke-linecap="round"/>
            <rect x="-4" y="-47" width="8" height="12" rx="2" fill="#ffd23a"/>
          </g></svg>
        </div>
        <div class="tc-arrows">
          <button class="tc-btn tc-arrow" data-hold="left" data-ed="left" aria-label="Steer left"><i></i></button>
          <button class="tc-btn tc-arrow tc-right" data-hold="right" data-ed="right" aria-label="Steer right"><i></i></button>
        </div>
        <div class="tc-shifter" data-shifter data-ed="shifter" aria-label="Shift knob">
          <span class="tc-plus">+</span>
          <div class="tc-sknob" data-sknob><b data-gear>1</b><small data-mode>A</small></div>
          <span class="tc-minus">−</span>
        </div>
        <div class="tc-pedals">
          <button class="tc-btn tc-pedal tc-brake" data-hold="brake" data-ed="brake"><span>BRAKE</span></button>
          <button class="tc-btn tc-pedal tc-gas" data-hold="throttle" data-ed="gas"><span>GAS</span></button>
        </div>
        <div class="tc-row">
          <button class="tc-btn tc-round tc-sm tc-nos" data-hold="nitrous" data-ed="nos">NOS</button>
          <button class="tc-btn tc-round tc-sm tc-car-only" data-hold="handbrake" data-ed="ebrake">E-<br>BRK</button>
          <button class="tc-btn tc-round tc-sm tc-car-only" data-tap="horn" data-ed="horn">HORN</button>
          <button class="tc-btn tc-round tc-sm tc-car-only" data-steermode data-ed="steermode">STEER<br>MODE</button>
          <button class="tc-btn tc-round tc-sm tc-car-only" data-tap="enterExit" data-ed="getout">GET<br>OUT</button>
          <button class="tc-btn tc-round tc-sm tc-car-only tc-use" data-tap="interact" data-ed="caruse">USE</button>
        </div>
      </div>`;
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.querySelectorAll('[data-hold]').forEach(b => holdButton(b, b.dataset.hold));
    root.querySelectorAll('[data-tap]').forEach(b => tapButton(b, b.dataset.tap));
    els.gear = root.querySelector('[data-gear]');
    els.mode = root.querySelector('[data-mode]');
    wireShifter(root.querySelector('[data-shifter]'), root.querySelector('[data-sknob]'));
    const resetWheel = wireWheel(root.querySelector('[data-wheel]'), root.querySelector('[data-wheel-rot]'));
    root.querySelector('[data-steermode]').addEventListener('pointerdown', e => { e.preventDefault(); settings.steerMode = settings.steerMode === 'wheel' ? 'arrows' : 'wheel'; saveSettings(); touchUi.refresh(); toast(settings.steerMode === 'wheel' ? 'Steering wheel — drag it left and right' : 'Steering arrows', 'info'); });
    const stopStick = wireStick(root.querySelector('[data-stick]'), root.querySelector('.tc-knob'));
    wireEditor();
    applyLayout();
    input.onContext(ctx => {
      if (editing) return;
      root.dataset.ctx = ctx;
      stopStick(); resetWheel();
      root.querySelectorAll('.on').forEach(n => n.classList.remove('on'));
      root.classList.remove('shift-now');
    });
    this.releaseAll = () => { stopStick(); resetWheel(); touch.reset(); root.querySelectorAll('.on').forEach(n => n.classList.remove('on')); };
    refreshMode();
    pad.onUse(() => { this.releaseAll(); this.refresh(); });
  },

  // Move / resize the on-screen controls (opened from Settings).
  edit() { openEditor(); },
  get editing() { return !!editing; },

  // wanted = we're in the world or a race; the title screen has no controls.
  show(v) { wanted = v; this.refresh(); },

  // Re-read the setting (Auto = only on touch devices).
  refresh() {
    // a controller in use hides them; touch the screen and they're back
    enabled = !pad.inUse && (settings.touch === 'on' || (settings.touch === 'auto' && isTouchDevice()));
    apply();
    refreshMode();
  },

  // 'drag' hides the lane-change arrows (a strip has no lanes to change)
  setRace(kind) { if (root) root.dataset.race = kind || ''; },

  setGear(text) { if (els.gear && els.gear.textContent !== text) els.gear.textContent = text; },

  // Manual box near the limiter: the knob glows so you know to shift up.
  setShiftCue(hot) {
    const on = !!hot && settings.transmission !== 'auto';
    if (root && root.classList.contains('shift-now') !== on) root.classList.toggle('shift-now', on);
  },
};
