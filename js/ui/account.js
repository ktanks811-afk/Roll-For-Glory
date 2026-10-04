// The profile chip on the title screen. There is no log-in: every device gets
// an online profile on its own (js/net/profile.js). The chip shows the profile
// code, which brings the same careers back on another phone or after the
// browser forgets everything.

import { el, esc, bind, toast, modal, prompt } from './dom.js';
import { profile } from '../net/profile.js';

export function profileChip(onSwitch) {
  if (!profile.id) return null;
  const chip = el(`<div class="acct-chip"><span>☁️ <b>Saved online</b></span><button type="button" data-action="code">Profile code</button></div>`);
  bind(chip, { code: () => showCode(onSwitch) });
  return chip;
}

async function showCode(onSwitch) {
  const pick = await modal('Your profile code', `<p>Your careers save online under this code automatically. Write it down or screenshot it.</p>
    <p class="profile-code">${esc(profile.code)}</p>
    <p>New phone, or the game forgot you? Tap <b>Use a code</b> and type it in to get your careers back.</p>`,
  [{ label: 'Use a code', value: 'use' }, { label: 'Done', primary: true, value: 'ok' }]);
  if (pick !== 'use') return;
  const text = await prompt('Use a profile code', '<p>Type the 20-character code from your other device. The careers on this device are swapped for that profile\'s.</p>', 'XXXX-XXXX-XXXX-XXXX-XXXX');
  if (!text) return;
  try {
    await profile.useCode(text);
    toast('Profile loaded', 'good');
    onSwitch();
  } catch (e) { toast(e.message || 'That code did not work', 'bad'); }
}
