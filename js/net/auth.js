// Player accounts. You need one to play: sign up with a username, email and
// password, and the game keeps you logged in on that device.
//
// Talks to Supabase Auth's REST API directly (no SDK download), so a player
// who is already logged in can still open the game with no signal. The
// session (access + refresh token) lives in localStorage; on every launch the
// game refreshes it when it can reach the server, and only a server that says
// "this session is no longer valid" logs the player out.
//
// `?auth=local` swaps in a same-browser implementation (accounts kept in
// localStorage) for the headless smoke test and offline development. It only
// works when the game is served from this machine, never on the live site.

import { SUPABASE_URL, SUPABASE_KEY } from './online.js';

const SESSION_KEY = 'mwsr.auth.session';
const LOCAL_USERS = 'mwsr.auth.localusers';
const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,16}$/;

function readJson(key) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } }
function writeJson(key, v) { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } }

// What the rest of the game sees: { id, email, username }.
const toUser = u => (u && u.id ? { id: u.id, email: u.email || '', username: (u.user_metadata && u.user_metadata.username) || (u.email || '').split('@')[0] } : null);

class AuthError extends Error {
  constructor(msg, status = 0) { super(msg); this.status = status; }
}

// Turns Supabase's error replies into something a player can act on.
function friendly(data, status) {
  const code = data && (data.error_code || data.code || data.error);
  const raw = (data && (data.msg || data.error_description || data.message)) || '';
  if (code === 'invalid_credentials' || code === 'invalid_grant' || /invalid login credentials/i.test(raw)) return 'Wrong email or password.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(raw)) return 'Confirm your email first: tap the link we sent you, then log in.';
  if (code === 'user_already_exists' || /already registered/i.test(raw)) return 'That email already has an account. Log in instead.';
  if (code === 'weak_password' || /password/i.test(raw) && /(least|weak|short)/i.test(raw)) return raw || 'Pick a stronger password (at least 6 characters).';
  if (code === 'over_email_send_rate_limit' || status === 429) return 'Too many tries. Wait a minute and try again.';
  if (code === 'signup_disabled') return 'New sign-ups are turned off right now.';
  if (code === 'validation_failed' || /valid email/i.test(raw)) return raw || 'That email address does not look right.';
  return raw || `The account server had a problem (${status}).`;
}

async function api(path, { method = 'POST', body, token, query = '' } = {}) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}${query}`, {
      method, signal: ctl.signal,
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
    if (!res.ok) throw new AuthError(friendly(data, res.status), res.status);
    return data;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError(e.name === 'AbortError' ? 'The account server took too long to answer. Check your signal.' : 'Could not reach the account server. Check your signal.', 0);
  } finally { clearTimeout(to); }
}

// Where email links (confirm, reset password) send the player back to.
const returnUrl = () => location.origin + location.pathname;

class RemoteAuth {
  async signUp(email, password, username) {
    const d = await api('signup', { body: { email, password, data: { username } }, query: `?redirect_to=${encodeURIComponent(returnUrl())}` });
    // Email confirmation on: no session until they tap the link.
    if (d && d.access_token) return { session: d };
    return { confirm: true };
  }
  async signIn(email, password) {
    return { session: await api('token', { query: '?grant_type=password', body: { email, password } }) };
  }
  async refresh(sess) {
    return api('token', { query: '?grant_type=refresh_token', body: { refresh_token: sess.refresh_token } });
  }
  async user(token) { return api('user', { method: 'GET', token }); }
  async signOut(sess) { try { await api('logout', { token: sess.access_token }); } catch { /* logged out locally either way */ } }
  async resetPassword(email) { await api('recover', { body: { email }, query: `?redirect_to=${encodeURIComponent(returnUrl())}` }); }
  async setPassword(sess, password) { return api('user', { method: 'PUT', token: sess.access_token, body: { password } }); }
}

// Same rules, kept in this browser. Not secure, and not meant to be.
class LocalAuth {
  users() { return readJson(LOCAL_USERS) || {}; }
  mk(u) { return { access_token: 'local.' + u.id, refresh_token: 'local.' + u.id, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: u.id, email: u.email, user_metadata: { username: u.username } } }; }
  async signUp(email, password, username) {
    const all = this.users();
    if (all[email]) throw new AuthError('That email already has an account. Log in instead.', 422);
    if (password.length < 6) throw new AuthError('Password should be at least 6 characters.', 422);
    all[email] = { id: 'local-' + Math.random().toString(36).slice(2, 10), email, password, username };
    writeJson(LOCAL_USERS, all);
    return { session: this.mk(all[email]) };
  }
  async signIn(email, password) {
    const u = this.users()[email];
    if (!u || u.password !== password) throw new AuthError('Wrong email or password.', 400);
    return { session: this.mk(u) };
  }
  async refresh(sess) {
    const u = Object.values(this.users()).find(x => 'local.' + x.id === sess.refresh_token);
    if (!u) throw new AuthError('Session expired', 400);
    return this.mk(u);
  }
  async user(token) { const s = await this.refresh({ refresh_token: token }); return s.user; }
  async signOut() {}
  async resetPassword() {}
  async setPassword(sess, password) {
    const all = this.users(), u = Object.values(all).find(x => x.id === sess.user.id);
    if (u) { u.password = password; writeJson(LOCAL_USERS, all); }
    return sess.user;
  }
}

const useLocal = isLocalHost() && new URLSearchParams(location.search).get('auth') === 'local';

export const auth = {
  impl: useLocal ? new LocalAuth() : new RemoteAuth(),
  kind: useLocal ? 'local' : 'supabase',
  session: null,
  get user() { return toUser(this.session && this.session.user); },
  listeners: new Set(),
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

  setSession(s) {
    if (s && !s.expires_at && s.expires_in) s.expires_at = Math.floor(Date.now() / 1000) + s.expires_in;
    this.session = s && s.access_token ? s : null;
    writeJson(SESSION_KEY, this.session);
    for (const fn of this.listeners) fn(this.user);
  },

  // Called once at boot. Returns { user, recovery } — recovery is true when the
  // player arrived from a "reset password" email and needs to pick a new one.
  async restore() {
    const fromLink = await this.fromEmailLink();
    if (fromLink) return fromLink;
    const saved = readJson(SESSION_KEY);
    if (!saved || !saved.refresh_token) return { user: null };
    this.session = saved;
    this.refreshNow();   // in the background: no waiting on a slow signal
    return { user: this.user };
  },

  // Keeps the session fresh. A server that answers "no" means the session is
  // dead (password changed, account removed); no answer at all (no signal)
  // keeps the player logged in so they can still play offline.
  async refreshNow() {
    const s = this.session;
    if (!s) return;
    try {
      const next = await this.impl.refresh(s);
      if (this.session === s) this.setSession(next);
    } catch (e) {
      if (this.session === s && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) this.setSession(null);
    }
  },

  // Email links come back as #access_token=…&refresh_token=…&type=signup|recovery
  // (or #error_description=… when the link is stale).
  async fromEmailLink() {
    const h = location.hash.slice(1);
    if (!/access_token=|error_description=/.test(h)) return null;
    const p = new URLSearchParams(h);
    history.replaceState(null, '', location.pathname + location.search);
    if (p.get('error_description')) return { user: null, linkError: p.get('error_description') };
    const s = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') || 3600 };
    try { s.user = await this.impl.user(s.access_token); } catch { return { user: null, linkError: 'That link did not work. Log in, or ask for a new one.' }; }
    this.setSession(s);
    return { user: this.user, recovery: p.get('type') === 'recovery' };
  },

  async signUp(email, password, username) {
    const r = await this.impl.signUp(email, password, username);
    if (r.session) this.setSession(r.session);
    return { user: this.user, confirm: !!r.confirm };
  },
  async signIn(email, password) {
    const r = await this.impl.signIn(email, password);
    this.setSession(r.session);
    return this.user;
  },
  async signOut() {
    const s = this.session;
    this.setSession(null);
    if (s) await this.impl.signOut(s);
  },
  resetPassword(email) { return this.impl.resetPassword(email); },
  async setPassword(password) {
    const u = await this.impl.setPassword(this.session, password);
    if (u && u.id) this.setSession({ ...this.session, user: u });
  },
};
