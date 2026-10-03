// A short tap of haptic feedback for the on-screen controls. Android has
// navigator.vibrate. iPhone Safari doesn't, but since iOS 18 toggling a
// <input type="checkbox" switch> plays the system "tick", so on iPhone we
// flip a hidden switch. Both only work inside a touch handler, which is
// where the controls call this from.

let sw = null;
function iosSwitch() {
  if (sw) return sw;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.setAttribute('switch', '');
  box.tabIndex = -1;
  label.appendChild(box);
  document.body.appendChild(label);
  sw = label;
  return sw;
}

let lastAt = 0;
export function buzz(ms = 10) {
  const now = performance.now();
  if (now - lastAt < 40) return;            // a flurry of taps is one tick
  lastAt = now;
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(ms); return; }
    iosSwitch().click();
  } catch { /* no haptics here */ }
}
