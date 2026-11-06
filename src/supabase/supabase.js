import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
// New publishable key (sb_publishable_…) preferred; the legacy anon JWT still works as a fallback.
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

/** True for keys that must never be shipped to a browser (secret keys or a legacy service_role JWT). */
const isPrivilegedKey = key => {
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return true;
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
};

export const supabaseConfigError = !SUPABASE_URL || !SUPABASE_KEY
  ? 'Supabase is not configured. Copy .env.example to .env, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.'
  : isPrivilegedKey(SUPABASE_KEY)
    ? 'A secret/service_role key was put in a VITE_ variable. That key would be published to every visitor, so the app refuses to start. Put the publishable key (sb_publishable_…) in VITE_SUPABASE_PUBLISHABLE_KEY, keep the secret key only in SUPABASE_SECRET_KEY, and rotate the exposed secret key in Supabase.'
    : '';

if (supabaseConfigError) console.error(supabaseConfigError);

const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  !supabaseConfigError ? SUPABASE_KEY : 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Email confirmation links must work in any browser, so use the implicit flow.
      flowType: 'implicit'
    }
  }
);

export const appConfig = {
  name: import.meta.env.VITE_APP_NAME?.trim() || 'Northstar CRM',
  url: (import.meta.env.VITE_APP_URL?.trim() || '').replace(/\/+$/, '')
};

/** Base URL of the app (origin + path, no query/hash), used for redirects and invite links. */
export const appBaseUrl = () => appConfig.url || `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '') || window.location.origin;

export default supabase;
