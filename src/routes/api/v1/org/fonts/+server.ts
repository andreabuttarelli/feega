import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callerOf, forbidden } from '$lib/server/effects/http';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { deleteFontFamily, orgFontFaces, storeFontFile } from '$lib/server/motion/font-upload';

const HTTP_BAD_REQUEST = 400;
const HTTP_CREATED = 201;

export const GET: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const { db, orgId } = resolved.caller;
  const sign = (paths: string[]) => signAssetPaths(db, createAssetSigningDb(), { generated: [], uploaded: paths });
  return json({ fonts: await orgFontFaces(db, orgId, sign) });
};

export const POST: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }
  if (!resolved.caller.writeAllowed) {
    return forbidden();
  }

  const file = (await request.formData().catch(() => null))?.get('file');
  if (!(file instanceof File)) {
    return json({ error: 'missing_file' }, { status: HTTP_BAD_REQUEST });
  }

  const { db, orgId, userId } = resolved.caller;
  const saved = await storeFontFile(db, { orgId, userId, name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  return saved.ok ? json({ font: saved.font }, { status: HTTP_CREATED }) : json({ error: saved.error }, { status: HTTP_BAD_REQUEST });
};

export const DELETE: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }
  if (!resolved.caller.writeAllowed) {
    return forbidden();
  }

  const family = url.searchParams.get('family') ?? '';
  const deleted = await deleteFontFamily(resolved.caller.db, { orgId: resolved.caller.orgId, family });
  return deleted.ok ? json({ deleted: family }) : json({ error: deleted.error }, { status: HTTP_BAD_REQUEST });
};
