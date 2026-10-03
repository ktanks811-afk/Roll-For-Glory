// On-screen controls for phones. What shows depends on what you're doing:
//
//   walking  — joystick, RUN, IN (get in car), USE
//   driving  — ◀ ▶ steering arrows, BRAKE and GAS pedals, a shift knob,
//              NOS, E-BRAKE, HORN, OUT (get out), USE
//   racing   — arrows (change lanes), pedals, shift knob, NOS
//
// Everything uses pointer events with capture, so you can steer with one
// thumb and work the pedals with the other, and drag races (brake + gas held
// together) work. Layout and sizing live in css/touch.css.

import { input, touch, isTouchDevice } from '../core/input.js';
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
  const R = () => stick.clientWidth * 0.36;
  const set = (dx, dy) => {
    const r = R(), d = Math.hypot(dx, dy) || 1, k = d > r ? r / d : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.axis('steer', dx / r);
    touch.axis('throttle', dy < -0.18 * r ? Math.min(1, -dy / r) : 0);   // up = forward
    touch.axis('brake', dy > 0.18 * r ? Math.min(1, dy / r) : 0);        // down = back
  };
  const stop = () => { pid = null; knob.style.transform = ''; touch.axis('steer', 0); touch.axis('throttle', 0); touch.axis('brake', 0); };
  stick.addEventListener('pointerdown', e => {
    e.preventDefault(); capture(stick, e); pid = e.pointerId;
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    set(e.clientX - cx, e.clientY - cy);
  });
  stick.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e.clientX - cx, e.clientY - cy); });
  stick.addEventListener('pointerup', e => { if (e.pointerId === pid) stop(); });
  stick.addEventListener('pointercancel', e => { if (e.pointerId === pid) stop(); });
  return stop;
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
  const on = wanted && enabled;
  root.classList.toggle('hidden', !on);
  document.body.classList.toggle('touch', on);
}

export const touchUi = {
  get active() { return wanted && enabled; },

  mount(el) {
    root = el;
    root.dataset.ctx = input.context;
    root.innerHTML = `
      <div class="tc-foot">
        <div class="tc-stick" data-stick><div class="tc-knob"></div></div>
        <div class="tc-foot-btns">
          <button class="tc-btn tc-round tc-sm tc-gun" data-tap="reload">RE-<br>LOAD</button>
          <button class="tc-btn tc-round tc-sm tc-gun" data-tap="draw">ARM</button>
          <button class="tc-btn tc-round tc-sm tc-mask" data-tap="mask">MASK</button>
          <button class="tc-btn tc-round tc-fire" data-hold="fire">FIRE</button>
          <button class="tc-btn tc-round" data-hold="run">RUN</button>
          <button class="tc-btn tc-round" data-tap="enterExit">GET<br>IN</button>
          <button class="tc-btn tc-round tc-use" data-tap="interact">USE</button>
        </div>
      </div>
      <div class="tc-drive">
        <div class="tc-wheel" data-wheel aria-label="Steering wheel">
          <svg viewBox="-50 -50 100 100"><g data-wheel-rot>
            <circle r="42" fill="rgba(20,22,26,.55)" stroke="rgba(255,255,255,.75)" stroke-width="7"/>
            <circle r="12" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" stroke-width="2"/>
            <path d="M-40 0H-12M12 0H40M0 12V40" stroke="rgba(255,255,255,.7)" stroke-width="6" stroke-linecap="round"/>
            <rect x="-4" y="-47" width="8" height="12" rx="2" fill="#ffd23a"/>
          </g></svg>
        </div>
        <div class="tc-arrows">
          <button class="tc-btn tc-arrow" data-hold="left" aria-label="Steer left"><i></i></button>
          <button class="tc-btn tc-arrow tc-right" data-hold="right" aria-label="Steer right"><i></i></button>
        </div>
        <div class="tc-shifter" data-shifter aria-label="Shift knob">
          <span class="tc-plus">+</span>
          <div class="tc-sknob" data-sknob><b data-gear>1</b><small data-mode>A</small></div>
          <span class="tc-minus">−</span>
        </div>
        <div class="tc-pedals">
          <button class="tc-btn tc-pedal tc-brake" data-hold="brake"><span>BRAKE</span></button>
          <button class="tc-btn tc-pedal tc-gas" data-hold="throttle"><span>GAS</span></button>
        </div>
        <div class="tc-row">
          <button class="tc-btn tc-round tc-sm tc-nos" data-hold="nitrous">NOS</button>
          <button class="tc-btn tc-round tc-sm tc-car-only" data-hold="handbrake">E-<br>BRK</button>
          <button class="tc-btn tc-round tc-sm tc-car-only" data-tap="horn">HORN</button>
          <button class="tc-btn tc-round tc-sm tc-car-only" data-steermode>STEER<br>MODE</button>
          <button class="tc-btn tc-round tc-sm tc-car-only" data-tap="enterExit">GET<br>OUT</button>
          <button class="tc-btn tc-round tc-sm tc-car-only tc-use" data-tap="interact">USE</button>
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
    input.onContext(ctx => {
      root.dataset.ctx = ctx;
      stopStick(); resetWheel();
      root.querySelectorAll('.on').forEach(n => n.classList.remove('on'));
      root.classList.remove('shift-now');
    });
    this.releaseAll = () => { stopStick(); resetWheel(); touch.reset(); root.querySelectorAll('.on').forEach(n => n.classList.remove('on')); };
    refreshMode();
  },

  // wanted = we're in the world or a race; the title screen has no controls.
  show(v) { wanted = v; this.refresh(); },

  // Re-read the setting (Auto = only on touch devices).
  refresh() {
    enabled = settings.touch === 'on' || (settings.touch === 'auto' && isTouchDevice());
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
