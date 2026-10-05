// Controller navigation for everything that isn't the game world: the title
// screen, panels (phone, garage, shops), and dialogs.
//
//   D-pad / left stick  move between buttons (by where they are on screen)
//   A                   press the highlighted button
//   B                   back: the screen's ‹ Back button, Cancel in a dialog,
//                       or close the panel
//   right stick         scroll
//   Start / View        close the panel (pause menu, phone)
//   ◀ ▶ on a slider or dropdown change its value
//   on a plan with its own cursor (data-padgrid), the D-pad moves that cursor
//
// The highlighted button gets the .pad-focus ring (css/main.css).

import { pad } from '../core/gamepad.js';
import { panelOpen, topPanel, closePanel, modalOpen } from './dom.js';

const FOCUSABLE = 'button, a[href], [data-action], input, select, textarea, [tabindex]:not([tabindex="-1"])';
let cur = null;
let lastLayer = null;
let curIdx = 0;                    // where cur was in its layer, to land near it after a re-render
const remembered = new WeakMap();  // layer → its highlighted button, for coming back from a dialog
let repeatDir = null, repeatAt = 0;

// The layer the pad is driving: the top dialog, the top panel, or the title /
// log-in screen. Null while playing.
export function padLayer() {
  if (modalOpen()) { const m = document.querySelectorAll('#modals .modal-back'); return m[m.length - 1]; }
  if (panelOpen()) return topPanel().root;
  const scr = document.getElementById('screen');
  if (scr && scr.firstElementChild && scr.firstElementChild.getClientRects().length) return scr;
  return null;
}

function visible(n) {
  if (n.disabled || n.closest('[disabled], .hidden')) return false;
  const r = n.getBoundingClientRect();
  return r.width > 2 && r.height > 2 && getComputedStyle(n).visibility !== 'hidden';
}

function candidates(layer) {
  // a [data-action] wrapper around a real button counts once
  return [...layer.querySelectorAll(FOCUSABLE)].filter(n => visible(n) && !(n.matches('[data-action]') && n.querySelector(FOCUSABLE) && !n.matches('button, a, input, select')) && !(n.parentElement?.closest('button, a[href]')));
}

function setFocus(n) {
  if (cur === n) return;
  cur?.classList.remove('pad-focus');
  cur = n;
  if (!n) return;
  if (lastLayer) { remembered.set(lastLayer, n); curIdx = Math.max(0, candidates(lastLayer).indexOf(n)); }
  n.classList.add('pad-focus');
  try { n.focus({ preventScroll: true }); } catch { /* not focusable */ }
  n.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function firstIn(layer, list) {
  return (layer.matches('.modal-back') && list.find(n => n.matches('.btn-primary')))
    || list.find(n => !n.matches('.back, input, select, textarea')) || list[0] || null;
}

function move(layer, dx, dy) {
  const list = candidates(layer);
  if (!list.length) { setFocus(null); return; }
  if (!cur || !list.includes(cur)) { setFocus(firstIn(layer, list)); return; }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const n of list) {
    if (n === cur) continue;
    const r = n.getBoundingClientRect();
    // distance from the edge of the current button in the direction we're going
    const along = dx ? (dx > 0 ? r.left - a.right : a.left - r.right) : (dy > 0 ? r.top - a.bottom : a.top - r.bottom);
    const bx = r.left + r.width / 2, by = r.top + r.height / 2;
    const cAlong = dx ? (bx - ax) * dx : (by - ay) * dy;
    if (cAlong <= 1 || along < -Math.min(a.width, a.height, r.width, r.height) / 2) continue;
    const across = dx ? Math.max(0, Math.max(r.top, a.top) - Math.min(r.bottom, a.bottom)) : Math.max(0, Math.max(r.left, a.left) - Math.min(r.right, a.right));
    const s = Math.max(0, along) + across * 3 + (dx ? Math.abs(by - ay) : Math.abs(bx - ax)) * 0.2;
    if (s < bs) { bs = s; best = n; }
  }
  if (best) setFocus(best);
  else if (dy) {   // nothing further: scroll the panel so off-screen content comes into view
    const sc = scroller(cur);
    sc?.scrollBy({ top: dy * 160 });
  }
}

function scroller(n) {
  for (let p = n?.parentElement; p; p = p.parentElement) {
    const st = getComputedStyle(p);
    if (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
  }
  return null;
}

// ◀ ▶ on a slider / dropdown changes its value instead of moving.
function adjust(n, d) {
  if (n.matches('input[type=range]')) {
    const step = +n.step || 1, v = Math.min(+n.max || 100, Math.max(+n.min || 0, +n.value + d * step));
    if (v === +n.value) return true;
    n.value = v;
  } else if (n.matches('select')) {
    const i = Math.min(n.options.length - 1, Math.max(0, n.selectedIndex + d));
    if (i === n.selectedIndex) return true;
    n.selectedIndex = i;
  } else return false;
  n.dispatchEvent(new Event('input', { bubbles: true }));
  n.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// A plan or board with its own cursor (data-padgrid, like the house
// builder): it gets the D-pad until the cursor runs off its edge.
function gridMove(n, dx, dy) {
  if (!n.matches('[data-padgrid]')) return false;
  const detail = { dx, dy, used: false };
  n.dispatchEvent(new CustomEvent('padmove', { detail }));
  return detail.used;
}

function press(n) {
  if (n.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea')) { n.focus(); return; }
  n.click();
}

function back(layer) {
  if (layer.matches('.modal-back')) {
    const btns = [...layer.querySelectorAll('.modal-actions button')];
    const cancel = btns.find(b => /^(cancel|no|close|not now|later|back)/i.test(b.textContent.trim())) || (btns.length === 1 ? btns[0] : btns.find(b => !b.matches('.btn-primary, .btn-danger')));
    if (cancel) press(cancel);
    return;
  }
  const bk = [...layer.querySelectorAll('.back, [data-action=back], [data-action=close], .panel-close')].find(visible);
  if (bk) { press(bk); return; }
  if (panelOpen()) closePanel(topPanel());
}

const DIRS = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0], LSU: [0, -1], LSD: [0, 1], LSL: [-1, 0], LSR: [1, 0] };

// Called once a frame. Returns true while a menu has the pad.
export function padNav() {
  const layer = padLayer();
  if (!layer || !pad.connected) { if (cur) setFocus(null); lastLayer = null; return !!layer; }
  if (!pad.inUse) { if (cur) setFocus(null); lastLayer = null; return true; }
  if (layer !== lastLayer) {
    // a new screen or dialog: highlight its first button straight away (or
    // the one you were on, coming back from a dialog)
    setFocus(null);
    lastLayer = layer;
    const back = remembered.get(layer);
    if (back?.isConnected && layer.contains(back) && visible(back)) setFocus(back); else move(layer, 0, 0);
  } else if (cur && (!cur.isConnected || !visible(cur))) {
    // the panel re-rendered (bought something, switched tab): stay about where you were
    const list = candidates(layer);
    setFocus(null);
    setFocus(list[Math.min(curIdx, list.length - 1)] || null);
  }

  // direction, with key repeat while held
  const now = performance.now();
  let d = null;
  for (const b in DIRS) if (pad.edge.has(b)) { d = b; repeatAt = now + 380; break; }
  if (!d) {
    const held = Object.keys(DIRS).find(b => pad.down.has(b));
    if (held && held === repeatDir && now >= repeatAt) { d = held; repeatAt = now + 110; }
    repeatDir = held || null;
  } else repeatDir = d;
  if (d) {
    const [dx, dy] = DIRS[d];
    if (!(cur && gridMove(cur, dx, dy)) && !(dx && cur && adjust(cur, dx))) move(layer, dx, dy);
  } else if (!cur && Object.keys(DIRS).some(b => pad.down.has(b))) move(layer, 0, 0);

  if (pad.edge.has('A')) { if (cur) press(cur); else move(layer, 0, 0); }
  else if (pad.edge.has('B')) back(layer);
  else if ((pad.edge.has('MENU') || pad.edge.has('VIEW')) && panelOpen() && layer === topPanel().root) closePanel(topPanel());

  if (Math.abs(pad.ry) > 0.2) (scroller(cur) || layer.querySelector('.panel-inner'))?.scrollBy({ top: pad.ry * 18 });
  return true;
}
