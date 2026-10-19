import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { bundleApiBase } from '$lib/api/bundle-fetch';

export function createSupabaseBrowserClient() {
  if (!bundleApiBase()) {
    return createBrowserClient(publicEnv.PUBLIC_SUPABASE_URL, publicEnv.PUBLIC_SUPABASE_ANON_KEY);
  }
  return createClient(publicEnv.PUBLIC_SUPABASE_URL, publicEnv.PUBLIC_SUPABASE_ANON_KEY, {
    auth: { storage: localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' }
  }) as unknown as ReturnType<typeof createBrowserClient>;
}
