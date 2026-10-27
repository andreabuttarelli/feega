import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { isCloudProvider, uploadFile } from '$lib/server/cloud/cloud';
import { exportName } from '$lib/server/cloud/export-name';
import { cloudAccess } from '$lib/server/cloud/runtime';
import { findAsset } from '$lib/server/repos/assets';
import { BUCKET_BY_SOURCE, SIGNED_URL_TTL_S, signStoredFile } from '$lib/server/repos/asset-storage';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_NOT_CONFIGURED = 501;
const HTTP_BAD_GATEWAY = 502;

const askSchema = z.object({ assetId: z.string().min(1), folder: z.string().max(1000), name: z.string().min(1).max(200).optional() });

export const POST: RequestHandler = async (event) => {
  if (!isCloudProvider(event.params.provider)) {
    return json({ error: 'unknown_provider' }, { status: HTTP_NOT_FOUND });
  }
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: 'invalid' }, { status: HTTP_BAD_REQUEST });
  }

  const asset = await findAsset(scope.db, { orgId: scope.orgId, assetId: ask.data.assetId });
  if (!asset?.url || (asset.projectId ?? scope.projectId) !== scope.projectId) {
    return json({ error: 'asset_not_found' }, { status: HTTP_NOT_FOUND });
  }
  const access = await cloudAccess(scope.db, scope.userId, event.params.provider);
  if (!access.ok) {
    return json({ error: access.reason }, { status: access.reason === 'not_configured' ? HTTP_NOT_CONFIGURED : HTTP_CONFLICT });
  }

  const signed = await signStoredFile(scope.db, BUCKET_BY_SOURCE[asset.source ?? 'upload'], asset.url, SIGNED_URL_TTL_S.providerInput);
  const fetched = signed ? await fetch(signed) : null;
  if (!fetched?.ok) {
    return json({ error: 'asset_unreadable' }, { status: HTTP_BAD_GATEWAY });
  }
  const mime = asset.mimeType ?? fetched.headers.get('content-type') ?? 'application/octet-stream';
  const name = ask.data.name ?? exportName(asset.url);

  const done = await uploadFile(event.params.provider, access.token, { folder: ask.data.folder, name, mime, bytes: new Uint8Array(await fetched.arrayBuffer()) });
  return done ? json({ exported: true }) : json({ error: 'upload_failed' }, { status: HTTP_BAD_GATEWAY });
};
