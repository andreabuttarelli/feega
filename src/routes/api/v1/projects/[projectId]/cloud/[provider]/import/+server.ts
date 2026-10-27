import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { downloadFile, isCloudProvider } from '$lib/server/cloud/cloud';
import { cloudAccess } from '$lib/server/cloud/runtime';
import { importCanvasBytes, UploadError } from '$lib/server/canvas/upload';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_NOT_CONFIGURED = 501;
const HTTP_BAD_GATEWAY = 502;

const askSchema = z.object({
  fileId: z.string().min(1).max(1000),
  place: z.object({ canvasId: z.string().min(1), x: z.number(), y: z.number() }).optional()
});

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

  const access = await cloudAccess(scope.db, scope.userId, event.params.provider);
  if (!access.ok) {
    return json({ error: access.reason }, { status: access.reason === 'not_configured' ? HTTP_NOT_CONFIGURED : HTTP_CONFLICT });
  }
  const file = await downloadFile(event.params.provider, access.token, ask.data.fileId);
  if (!file) {
    return json({ error: 'download_failed' }, { status: HTTP_BAD_GATEWAY });
  }

  try {
    const { asset, node } = await importCanvasBytes(scope.db, { orgId: scope.orgId, projectId: scope.projectId, fileName: file.name, mime: file.mime, bytes: file.bytes, place: ask.data.place });
    return json({ asset: { id: asset.id }, node: node ?? null });
  } catch (cause) {
    if (cause instanceof UploadError) {
      return json({ error: cause.message }, { status: cause.status });
    }
    throw cause;
  }
};
