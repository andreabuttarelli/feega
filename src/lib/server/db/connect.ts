import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';

export const createClient = createSupabaseClient;

export const createServerClient = createSupabaseServerClient;
