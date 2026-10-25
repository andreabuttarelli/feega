import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { localStore } from '$lib/server/local/local-mode';

export const createClient = ((...args: unknown[]) => localStore()?.db ?? (createSupabaseClient as (...a: unknown[]) => unknown)(...args)) as typeof createSupabaseClient;

export const createServerClient = ((...args: unknown[]) => localStore()?.db ?? (createSupabaseServerClient as (...a: unknown[]) => unknown)(...args)) as typeof createSupabaseServerClient;
