import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { RUNTIME, Runtime } from '$lib/runtime';

let bundled: SupabaseClient | null = null;

function bundledClient(): SupabaseClient {
  bundled ??= createClient(publicEnv.PUBLIC_SUPABASE_URL, publicEnv.PUBLIC_SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return bundled;
}

export function createSupabaseBrowserClient(): SupabaseClient {
  if (RUNTIME === Runtime.Bundle) {
    return bundledClient();
  }
  return createBrowserClient(publicEnv.PUBLIC_SUPABASE_URL, publicEnv.PUBLIC_SUPABASE_ANON_KEY);
}
