import { el, esc, bind, toast } from './dom.js';
import { profile } from '../net/profile.js';
import { auth } from '../net/auth.js';

const AUTH_CSS = `
<style>
.rfg-auth-page{position:absolute;inset:0;display:grid;place-items:center;padding:24px;z-index:20;background:radial-gradient(circle at 50% 25%,rgba(45,45,55,.72),rgba(5,5,8,.96) 65%);font-family:Rajdhani,Arial,sans-serif}
.rfg-auth-card{width:min(430px,94vw);padding:28px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(12,12,16,.94);box-shadow:0 25px 80px rgba(0,0,0,.65)}
.rfg-auth-brand{font:700 28px/1 Chakra Petch,Arial,sans-serif;letter-spacing:1px;text-align:center}
.rfg-auth-brand span{display:block;font-size:13px;letter-spacing:3px;opacity:.65;margin-top:7px}
.rfg-auth-tabs{display:flex;gap:8px;margin:24px 0 18px}
.rfg-auth-tabs button{flex:1}
.rfg-auth-form{display:grid;gap:12px}
.rfg-auth-form label{display:grid;gap:5px;font-weight:600}
.rfg-auth-form input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:#08080b;color:#fff;font:600 16px Rajdhani,Arial,sans-serif}
.rfg-auth-actions{display:grid;gap:9px;margin-top:4px}
.rfg-auth-msg{min-height:20px;text-align:center;font-size:14px;opacity:.8}
.rfg-auth-back{text-align:center;margin-top:15px}
.rfg-auth-back button{background:none;border:0;color:#aaa;text-decoration:underline}
</style>`;

export function profileChip(onSwitch) {
  const signed = auth.isSignedIn;
  const chip = el(`<div class="acct-chip"><span>☁️ <b>${signed ? 'Account linked' : 'Guest cloud save'}</b><small>${signed ? esc(auth.email) : 'Sign in to sync across devices'}</small></span><button type="button" data-action="account">${signed ? 'Account' : 'Sign in'}</button></div>`);
  bind(chip, { account: () => showAccount(onSwitch) });
  return chip;
}

export function showAccount(onSwitch) {
  if (auth.isSignedIn) {
    showSignedIn(onSwitch);
    return;
  }
  showLoginPage(onSwitch);
}

function showSignedIn(onSwitch) {
  const root = document.getElementById('screen');
  root.innerHTML = AUTH_CSS + `<div class="rfg-auth-page"><div class="rfg-auth-card">
    <div class="rfg-auth-brand">MURDA WORTH<span>STREET RACING</span></div>
    <h2 style="text-align:center;margin:22px 0 5px">Account</h2>
    <p style="text-align:center;margin:0 0 20px"><b>${esc(auth.displayName)}</b><br><span class="muted">${esc(auth.email)}</span></p>
    <p style="text-align:center">☁️ Your career is connected to this account.</p>
    <div class="rfg-auth-actions">
      <button class="btn btn-primary" data-action="done">Back to Game</button>
      <button class="btn" data-action="out">Sign Out</button>
    </div>
  </div></div>`;
  bind(root, {
    done: () => onSwitch(),
    out: async () => {
      try {
        await auth.signOut();
        await profile.switchFromAuth();
        toast('Signed out. Your guest career remains on this device.', 'good');
        onSwitch();
      } catch (e) { toast(e.message || 'Could not sign out', 'bad'); }
    },
  });
}

function showLoginPage(onSwitch) {
  const root = document.getElementById('screen');
  root.innerHTML = AUTH_CSS + `<div class="rfg-auth-page"><div class="rfg-auth-card">
    <div class="rfg-auth-brand">MURDA WORTH<span>STREET RACING</span></div>
    <div class="rfg-auth-tabs">
      <button class="btn btn-primary" data-tab="login">Sign In</button>
      <button class="btn" data-tab="signup">Create Account</button>
    </div>
    <form class="rfg-auth-form" id="rfg-auth-form">
      <div data-name-wrap style="display:none"><label>Racer Name<input name="name" autocomplete="name" maxlength="40" placeholder="Your racer name"></label></div>
      <label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="At least 6 characters"></label>
      <div class="rfg-auth-actions">
        <button class="btn btn-primary" type="submit" data-submit>Sign In</button>
        <button class="btn" type="button" data-google>Continue with Google</button>
      </div>
      <button class="btn" type="button" data-reset style="background:none;border:0;text-decoration:underline">Forgot password?</button>
      <div class="rfg-auth-msg" data-msg></div>
    </form>
    <div class="rfg-auth-back"><button type="button" data-back>← Back to game</button></div>
  </div></div>`;

  let mode = 'login';
  const form = root.querySelector('#rfg-auth-form');
  const nameWrap = root.querySelector('[data-name-wrap]');
  const submit = root.querySelector('[data-submit]');
  const msg = root.querySelector('[data-msg]');
  const setMsg = (s, bad=false) => { msg.textContent = s; msg.style.color = bad ? '#ff6b6b' : ''; };

  const setMode = next => {
    mode = next;
    nameWrap.style.display = mode === 'signup' ? '' : 'none';
    submit.textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
    root.querySelector('[data-tab="login"]').classList.toggle('btn-primary', mode === 'login');
    root.querySelector('[data-tab="signup"]').classList.toggle('btn-primary', mode === 'signup');
    root.querySelector('[data-reset]').style.display = mode === 'login' ? '' : 'none';
    setMsg('');
  };
  root.querySelector('[data-tab="login"]').onclick = () => setMode('login');
  root.querySelector('[data-tab="signup"]').onclick = () => setMode('signup');
  root.querySelector('[data-back]').onclick = () => onSwitch();

  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    const name = String(fd.get('name') || '').trim();
    submit.disabled = true;
    setMsg(mode === 'signup' ? 'Creating your account…' : 'Signing in…');
    try {
      const data = mode === 'signup'
        ? await auth.signUpEmail(email, password, name)
        : { user: await auth.signInEmail(email, password) };
      if (!auth.isSignedIn) {
        setMsg('Account created. Check your email to confirm it, then sign in.');
        return;
      }
      await profile.switchToAuth(auth.user);
      toast(mode === 'signup' ? 'Account created — career synced.' : 'Welcome back — career synced.', 'good');
      onSwitch();
    } catch (e) {
      setMsg(e.message || 'Authentication failed.', true);
    } finally { submit.disabled = false; }
  };

  root.querySelector('[data-google]').onclick = async () => {
    setMsg('Opening Google…');
    try { await auth.signInGoogle(); } catch (e) { setMsg(e.message || 'Google sign-in is not configured yet.', true); }
  };

  root.querySelector('[data-reset]').onclick = async () => {
    const email = String(root.querySelector('[name="email"]').value || '').trim();
    if (!email) { setMsg('Enter your email first.', true); return; }
    try { await auth.resetPassword(email); setMsg('Password reset email sent.'); }
    catch (e) { setMsg(e.message || 'Could not send reset email.', true); }
  };
}

function onAuthChange() {
  if (auth.isSignedIn) profile.switchToAuth(auth.user).catch(e => console.warn('auth save migration', e));
  else profile.switchFromAuth().catch(e => console.warn('auth save restore', e));
}
window.addEventListener('rfg-auth', onAuthChange);
