import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';

export const createClient = ((...args: unknown[]) => (createSupabaseClient as (...a: unknown[]) => unknown)(...args)) as typeof createSupabaseClient;

export const createServerClient = ((...args: unknown[]) => (createSupabaseServerClient as (...a: unknown[]) => unknown)(...args)) as typeof createSupabaseServerClient;
