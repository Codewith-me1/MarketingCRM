import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigError = !SUPABASE_URL || !SUPABASE_ANON_KEY
  ? 'Supabase is not configured. Copy .env.example to .env, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.'
  : '';

if (supabaseConfigError) console.error(supabaseConfigError);

const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'missing-anon-key',
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
