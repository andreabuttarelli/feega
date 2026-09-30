import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { exportAccount } from '$lib/server/account/export-account';

const HTTP_UNAUTHORIZED = 401;

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    throw error(HTTP_UNAUTHORIZED, 'Sign in first');
  }
  const data = await exportAccount(supabase as unknown as SupabaseClient, user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="feega-my-data.json"',
      'cache-control': 'no-store'
    }
  });
};
