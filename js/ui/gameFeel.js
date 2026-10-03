// Make the page behave like a game, not a website: no text selection, no
// copy / paste / "Look Up" callouts, no long-press menus, no magnifier loupe,
// no double-tap or pinch zoom, no pull-to-refresh, no dragging images. Text
// fields (your name, chat, prices) still work normally.

const editable = t => !!(t && t.closest && t.closest('input:not([type=range]):not([type=button]):not([type=checkbox]), textarea, select, [contenteditable="true"]'));
// The driving controls and the game view: a touch here is only ever a control.
const CONTROLS = '#touch, #game, #hud, .tc-btn, [data-rev], [data-hold], [data-tap]';

function clearSelection() {
  try { const sel = window.getSelection?.(); if (sel && sel.rangeCount && !editable(document.activeElement)) sel.removeAllRanges(); } catch { /* old browser */ }
}

export function initGameFeel() {
  const opt = { passive: false, capture: true };
  // long-press menus (Android Chrome fires contextmenu on a long touch)
  document.addEventListener('contextmenu', e => { if (!editable(e.target)) e.preventDefault(); }, opt);
  // text selection, drag-and-drop ghosts, double-click word selection
  document.addEventListener('selectstart', e => { if (!editable(e.target)) e.preventDefault(); }, opt);
  document.addEventListener('dragstart', e => { if (!editable(e.target)) e.preventDefault(); }, opt);
  document.addEventListener('dblclick', e => { if (!editable(e.target)) e.preventDefault(); }, opt);
  // iOS Safari pinch-zoom gestures
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), opt);
  // On the controls, cancel the touch's default action outright. That is the
  // only thing iOS honours for the long-press callout / loupe, and it stops
  // the browser stealing a held pedal for a scroll or zoom gesture. Pointer
  // events (what the controls listen to) still fire.
  document.addEventListener('touchstart', e => {
    if (editable(e.target)) return;
    if (e.target.closest?.(CONTROLS)) { if (e.cancelable) e.preventDefault(); clearSelection(); }
    else if (e.touches.length > 1 && e.cancelable) e.preventDefault();   // two-finger zoom anywhere
  }, opt);
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, opt);
  document.addEventListener('pointerdown', e => { if (!editable(e.target)) clearSelection(); }, true);
  document.documentElement.classList.add('game-feel');
}
