import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { isCloudProvider } from '$lib/server/cloud/cloud';
import { cloudStatuses, disconnectCloud, type CloudStatus } from '$lib/server/cloud/runtime';

type Locals = { supabase: unknown; safeGetSession: () => Promise<{ user: { id: string } | null }> };
type Ev = Pick<RequestEvent, 'request'> & { locals: Locals };

export async function cloudConnections(locals: Locals): Promise<CloudStatus[]> {
  const { user } = await locals.safeGetSession();
  return user ? cloudStatuses(locals.supabase as Db, user.id) : [];
}

export async function disconnectCloudAction({ request, locals }: Ev) {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return fail(401, { cloudError: 'unauthorized' });
  }
  const provider = String((await request.formData()).get('provider') ?? '');
  if (!isCloudProvider(provider)) {
    return fail(400, { cloudError: 'invalid' });
  }

  await disconnectCloud(locals.supabase as Db, user.id, provider);
  return { cloudDisconnected: provider };
}
