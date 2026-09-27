import { fail, redirect } from '@sveltejs/kit';
import { inviteTokenIn, landingPath } from '$lib/server/tenancy/landing';
import type { Actions, PageServerLoad } from './$types';

const MIN_PASSWORD = 6;

// Reached only after /auth/confirm verified a recovery token and established a (recovery) session.
// No session → the link was bad/expired or opened directly; send them back to start over.
export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) throw redirect(303, '/login?error=link');
};

export const actions: Actions = {
  default: async ({ request, url, cookies, locals: { supabase, safeGetSession, db } }) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) throw redirect(303, '/login?error=link');

    const data = await request.formData();
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');

    if (password.length < MIN_PASSWORD) return fail(400, { errorCode: 'weakPassword' });
    if (password !== confirm) return fail(400, { errorCode: 'mismatch' });

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return fail(400, { error: error.message });

    const dbClient = await db();
    if (!dbClient) throw redirect(303, '/login');
    throw redirect(303, await landingPath(dbClient, user, cookies, inviteTokenIn(url.searchParams)));
  }
};
