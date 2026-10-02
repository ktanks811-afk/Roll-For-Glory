// Landscape-first on phones.
//
// Browsers only let a page lock the screen orientation from fullscreen (and
// only on Android), so: the first tap goes fullscreen and asks for landscape.
// Installed to the home screen, the manifest does it from launch. Where
// neither works (iPhone Safari), a "rotate your phone" screen asks for it —
// with a way to play in portrait anyway.

import { isTouchDevice } from '../core/input.js';

export function initOrientation() {
  if (!isTouchDevice()) return;
  const portrait = window.matchMedia('(orientation: portrait)');
  let skipped = false, locked = false;

  const overlay = document.createElement('div');
  overlay.id = 'rotate';
  overlay.className = 'rotate hidden';
  overlay.innerHTML = '<div class="rotate-phone"></div><b>Rotate your phone</b><span>Roll for Glory plays in landscape.</span><button id="rotate-skip" type="button">Play in portrait anyway</button>';
  document.body.appendChild(overlay);
  overlay.querySelector('#rotate-skip').addEventListener('click', () => { skipped = true; sync(); });

  const sync = () => overlay.classList.toggle('hidden', !portrait.matches || skipped || locked);
  portrait.addEventListener('change', () => { if (!portrait.matches) skipped = false; sync(); });

  async function lockLandscape() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch { /* fullscreen refused: fine */ }
    try {
      await screen.orientation?.lock?.('landscape');
      locked = true;
    } catch { /* not supported or not allowed: the rotate screen covers it */ }
    sync();
  }
  // Try right away (works when installed / already fullscreen), then on the first tap.
  screen.orientation?.lock?.('landscape').then(() => { locked = true; sync(); }, () => {});
  const first = () => { window.removeEventListener('pointerdown', first, true); lockLandscape(); };
  window.addEventListener('pointerdown', first, true);
  sync();
}
