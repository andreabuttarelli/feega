import { json } from '@sveltejs/kit';
import { createAnonDb } from '$lib/server/db/client';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { findGalleryItem } from '$lib/server/repos/gallery';
import { withdrawFromGallery } from '$lib/server/gallery/publish';
import { cardView } from '$lib/server/gallery/service';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async ({ params, url }) => {
  const item = await findGalleryItem(createAnonDb(), params.id ?? '');
  if (!item) {
    return json({ error: 'item_not_found' }, { status: HTTP_NOT_FOUND });
  }
  return json({ ...cardView(item, url.origin), description: item.description, fields: item.doc.fields.map((f) => ({ key: f.key, label: f.label, type: f.type })) });
};

export const DELETE: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { db, orgId, writeAllowed } = resolved.caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }
  const withdrawn = await withdrawFromGallery(db, { orgId, itemId: params.id ?? '' });
  return withdrawn ? json({ id: params.id, status: 'removed' }) : json({ error: 'item_not_found' }, { status: HTTP_NOT_FOUND });
};
