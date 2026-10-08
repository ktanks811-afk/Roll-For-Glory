import { el, esc, bind, toast, modal, prompt } from './dom.js';
import { profile } from '../net/profile.js';
import { auth } from '../net/auth.js';

export function profileChip(onSwitch) {
  if (auth.isSignedIn) {
    const chip = el(`<div class="acct-chip"><span>☁️ <b>Google linked</b><small>${esc(auth.email)}</small></span><button type="button" data-action="account">Account</button></div>`);
    bind(chip, { account: () => showAccount(onSwitch) });
    return chip;
  }
  if (!profile.id) return null;
  const chip = el(`<div class="acct-chip"><span>☁️ <b>Guest cloud save</b></span><button type="button" data-action="account">Sign in</button></div>`);
  bind(chip, { account: () => showAccount(onSwitch) });
  return chip;
}

async function showAccount(onSwitch) {
  if (!auth.isSignedIn) {
    const pick = await modal('Save your career', `<p>Your current career is saved on this device and in the guest cloud.</p>
      <p><b>Sign in with Google</b> to attach this career to your Google account and play it on any device.</p>
      <p>Your existing saves will be migrated when you sign in.</p>`,
      [{ label: 'Continue with Google', value: 'google', primary: true }, { label: 'Not now', value: 'cancel' }]);
    if (pick === 'google') {
      try { await auth.signInGoogle(); } catch (e) { toast(e.message || 'Google sign-in failed', 'bad'); }
    }
    return;
  }

  const pick = await modal('Account', `<p><b>${esc(auth.displayName)}</b></p><p class="muted">${esc(auth.email)}</p>
    <p>☁️ Your career is linked to Google and syncs across devices.</p>`,
    [{ label: 'Sign out', value: 'out' }, { label: 'Done', primary: true, value: 'ok' }]);
  if (pick === 'out') {
    try {
      await auth.signOut();
      toast('Signed out — your local career remains on this device.', 'good');
      onSwitch();
    } catch (e) { toast(e.message || 'Could not sign out', 'bad'); }
  }
}
