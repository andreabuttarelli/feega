import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin/admins';
import { loadStats } from '$lib/server/admin/stats';
import { statsDb } from '$lib/server/admin/stats-db';

const SEE_OTHER = 303;
const NOT_FOUND = 404;

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    throw redirect(SEE_OTHER, '/login');
  }
  if (!isAdmin(user.email, env.ADMIN_EMAILS)) {
    throw error(NOT_FOUND);
  }

  return loadStats(statsDb);
};
