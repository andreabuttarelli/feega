import { json } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { brandExists } from '$lib/server/brand-library';
import type { RequestEvent, RequestHandler } from './$types';

const NO_CONTENT = 204;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const SERVER_ERROR = 500;

enum PinChange {
  Pin = 'pin',
  Unpin = 'unpin'
}

async function change(event: RequestEvent, how: PinChange): Promise<Response> {
  const { params, locals } = event;
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: UNAUTHORIZED });
  }

  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: SERVER_ERROR });
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findReachableProject(db, { projectId: params.projectId ?? '', memberships, userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: NOT_FOUND });
  }

  const scope = { orgId: found.orgId, brandId: params.brandId ?? '' };
  if (!(await brandExists(db, scope))) {
    return json({ error: 'brand_not_found' }, { status: NOT_FOUND });
  }

  const { error } =
    how === PinChange.Pin
      ? await db.from('brand_pins').upsert({ user_id: user.id, brand_id: scope.brandId, org_id: scope.orgId })
      : await db.from('brand_pins').delete().eq('user_id', user.id).eq('brand_id', scope.brandId);
  if (error) {
    return json({ error: 'write_failed' }, { status: SERVER_ERROR });
  }

  return new Response(null, { status: NO_CONTENT });
}

export const POST: RequestHandler = (event) => change(event, PinChange.Pin);
export const DELETE: RequestHandler = (event) => change(event, PinChange.Unpin);
