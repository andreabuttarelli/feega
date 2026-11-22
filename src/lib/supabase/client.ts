import { createBrowserClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';

export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.PUBLIC_SUPABASE_URL, publicEnv.PUBLIC_SUPABASE_ANON_KEY);
}
