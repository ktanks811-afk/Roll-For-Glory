// The sign-up / log-in screen that stands between the loading screen and the
// title menu, plus the account bits of the title screen (who's logged in, log
// out). No account, no game.

import { $, el, esc, bind, toast, confirm } from './dom.js';
import { auth, USERNAME_RE, storageWorks, inAppBrowser } from '../net/auth.js';
import { latestLegacySave } from '../core/save.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// mode: 'signup' | 'login' | 'forgot' | 'newpass' | 'check'
export function showAuth(app, { mode, note = '', email = '', onDone } = {}) {
  const legacy = latestLegacySave();
  mode ||= 'signup';
  const root = $('#screen');
  root.innerHTML = '';
  const suggested = legacy ? String(legacy.name || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 16) : '';
  const state = { mode, note, email, username: suggested, busy: false };

  const render = () => {
    const m = state.mode;
    const heads = {
      signup: ['Create your account', 'You need an account to play. It keeps your career tied to you.'],
      login: ['Log in', 'Welcome back. Log in to pick up where you left off.'],
      forgot: ['Reset password', "Enter your email and we'll send you a link to pick a new password."],
      newpass: ['New password', 'Pick a new password for your account.'],
      check: ['Check your email', `We sent a link to <b>${esc(state.email)}</b>. Tap it to confirm your account, then come back here and log in.`],
    };
    const [h, sub] = heads[m];
    const field = (name, label, type, ac, extra = '') => `<label class="field"><span>${label}</span><input class="input" name="${name}" type="${type}" autocomplete="${ac}" autocapitalize="off" autocorrect="off" spellcheck="false" ${extra}></label>`;
    let fields = '';
    if (m === 'signup') fields = field('username', 'Username', 'text', 'nickname', `maxlength="16" placeholder="3-16 letters or numbers" value="${esc(state.username)}"`) + field('email', 'Email', 'email', 'username', `inputmode="email" value="${esc(state.email)}"`) + field('password', 'Password', 'password', 'new-password', 'minlength="6" placeholder="At least 6 characters"');
    if (m === 'login') fields = field('email', 'Email', 'email', 'username', `inputmode="email" value="${esc(state.email)}"`) + field('password', 'Password', 'password', 'current-password');
    if (m === 'forgot') fields = field('email', 'Email', 'email', 'username', `inputmode="email" value="${esc(state.email)}"`);
    if (m === 'newpass') fields = field('password', 'New password', 'password', 'new-password', 'minlength="6" placeholder="At least 6 characters"');
    const cta = { signup: 'Create account', login: 'Log in', forgot: 'Send reset link', newpass: 'Save password', check: 'Go to log in' }[m];
    const links = {
      signup: `Already have an account? <button type="button" data-action="go" data-m="login">Log in</button>`,
      login: `New here? <button type="button" data-action="go" data-m="signup">Create an account</button> · <button type="button" data-action="go" data-m="forgot">Forgot password?</button>`,
      forgot: `<button type="button" data-action="go" data-m="login">Back to log in</button>`,
      newpass: '',
      check: `Wrong email? <button type="button" data-action="go" data-m="signup">Start over</button>`,
    }[m];
    const legacyNote = legacy && (m === 'signup' || m === 'login')
      ? `<p class="auth-legacy">Your saved career (<b>${esc(legacy.name)}</b>, day ${legacy.day}) on this device moves into the first account you log in with.</p>` : '';
    // Browsers that forget everything on close would make them log in every time: say so up front.
    const warn = (m === 'signup' || m === 'login') && auth.kind === 'supabase' && (inAppBrowser || !storageWorks)
      ? `<p class="auth-warn">${inAppBrowser
        ? "This app's built-in browser forgets your login when you close it. Open the game in <b>Safari</b> (or Chrome) and tap <b>Share → Add to Home Screen</b> to stay logged in."
        : 'Your browser is blocking storage (Private Browsing or blocked cookies), so it will log you out every time you leave. Use a normal tab, or add the game to your home screen, to stay logged in.'}</p>` : '';
    root.innerHTML = '';
    const t = el(`<div class="auth">
      <form class="auth-card" novalidate>
        <div class="auth-brand">MURDA WORTH<span>STREET RACING</span></div>
        <h1>${h}</h1>
        <p class="auth-sub">${sub}</p>
        ${state.note ? `<p class="auth-note">${esc(state.note)}</p>` : ''}
        ${warn}
        ${legacyNote}
        ${fields}
        <p class="auth-err" data-err hidden></p>
        <button class="btn btn-primary auth-go" type="submit">${cta}</button>
        ${links ? `<p class="auth-links">${links}</p>` : ''}
      </form>
    </div>`);
    root.appendChild(t);
    const form = t.querySelector('form');
    const errEl = t.querySelector('[data-err]');
    const fail = msg => { errEl.textContent = msg; errEl.hidden = false; };
    bind(t, { go: d => { keep(); state.mode = d.m; state.note = ''; render(); } });
    const val = n => (form.elements[n] ? form.elements[n].value.trim() : '');
    const keep = () => { if (form.elements.email) state.email = val('email'); if (form.elements.username) state.username = val('username'); };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (state.busy) return;
      errEl.hidden = true;
      keep();
      const email = val('email').toLowerCase(), pw = form.elements.password ? form.elements.password.value : '';
      if (m === 'check') { state.mode = 'login'; state.note = ''; render(); return; }
      if (m === 'signup' && !USERNAME_RE.test(val('username'))) return fail('Username must be 3-16 letters, numbers, dots, dashes or underscores.');
      if ((m === 'signup' || m === 'login' || m === 'forgot') && !EMAIL_RE.test(email)) return fail('Enter a real email address.');
      if ((m === 'signup' || m === 'newpass') && pw.length < 6) return fail('Password needs at least 6 characters.');
      if (m === 'login' && !pw) return fail('Enter your password.');
      const go = form.querySelector('.auth-go');
      state.busy = true; go.disabled = true; go.textContent = 'One sec…';
      try {
        if (m === 'signup') {
          const r = await auth.signUp(email, pw, val('username'));
          if (r.confirm) { state.mode = 'check'; state.email = email; state.busy = false; render(); return; }
          done(`Welcome, ${r.user.username}!`);
        } else if (m === 'login') {
          const u = await auth.signIn(email, pw);
          done(`Logged in as ${u.username}`);
        } else if (m === 'forgot') {
          await auth.resetPassword(email);
          state.mode = 'login'; state.note = 'If that email has an account, a reset link is on its way.'; state.busy = false; render();
        } else if (m === 'newpass') {
          await auth.setPassword(pw);
          done('Password updated');
        }
      } catch (err) {
        state.busy = false; go.disabled = false; go.textContent = cta;
        fail(err.message || 'Something went wrong. Try again.');
      }
    });
    const first = [...form.querySelectorAll('input')].find(i => !i.value);
    // Don't pop the keyboard over the screen on phones; desktop gets focus.
    if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
  };
  const done = msg => {
    toast(msg, 'good');
    if (onDone) onDone();
  };
  render();
}

// The "logged in as" chip on the title screen.
export function accountChip(onLogout) {
  const u = auth.user;
  if (!u) return null;
  const chip = el(`<div class="acct-chip"><span>👤 <b>${esc(u.username)}</b></span><button type="button" data-action="logout">Log out</button></div>`);
  bind(chip, {
    logout: async () => {
      if (!(await confirm('Log out?', `<p>You'll need your email and password to log back in. Your careers stay saved on this device under <b>${esc(u.username)}</b>.</p>`, 'Log out'))) return;
      await auth.signOut();
      onLogout();
    },
  });
  return chip;
}
