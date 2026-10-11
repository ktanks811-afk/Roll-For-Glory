import { SUPABASE_URL, SUPABASE_KEY } from './online.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
let client = null;
let current = null;

async function getClient() {
  if (client) return client;
  const { createClient } = await import(/* @vite-ignore */ SUPABASE_JS);
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export const auth = {
  ready: false,
  user: null,
  async init() {
    const c = await getClient();
    const { data } = await c.auth.getSession();
    current = data.session?.user || null;
    this.user = current;
    this.ready = true;
    c.auth.onAuthStateChange((_event, session) => {
      current = session?.user || null;
      this.user = current;
      window.dispatchEvent(new CustomEvent('rfg-auth', { detail: { event: _event, user: current } }));
    });
    return current;
  },
  async signInEmail(email, password) {
    const c = await getClient();
    const { data, error } = await c.auth.signInWithPassword({ email: String(email || '').trim(), password });
    if (error) throw error;
    current = data.user || null;
    this.user = current;
    return current;
  },
  async signUpEmail(email, password, name = '') {
    const c = await getClient();
    const { data, error } = await c.auth.signUp({
      email: String(email || '').trim(),
      password,
      options: { data: name ? { full_name: String(name).trim() } : {} },
    });
    if (error) throw error;
    current = data.session?.user || null;
    this.user = current;
    return data;
  },
  async resetPassword(email) {
    const c = await getClient();
    const { error } = await c.auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: location.origin + location.pathname,
    });
    if (error) throw error;
  },
  async signInGoogle() {
    const c = await getClient();
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
  },
  async signOut() {
    const c = await getClient();
    const { error } = await c.auth.signOut();
    if (error) throw error;
  },
  get isSignedIn() { return !!current; },
  get email() { return current?.email || ''; },
  get displayName() { return current?.user_metadata?.full_name || current?.user_metadata?.name || current?.email || 'Racer'; },
  async loadSave(userId) {
    const c = await getClient();
    const { data, error } = await c.from('rfg_auth_saves').select('saves,updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async saveSave(userId, saves) {
    const c = await getClient();
    const { error } = await c.from('rfg_auth_saves').upsert({ user_id: userId, saves, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
  },
};