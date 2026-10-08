import { fail } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { insertAsset } from '$lib/server/repos/assets';
import { DataCheck, patchNodeData } from '$lib/server/repos/canvas';
import { storeAssetFile } from '$lib/server/repos/asset-storage';
import { exportFolder, type ExportScope } from '$lib/motion/export-plan';

const POSTER_MIME = 'image/jpeg';
const POSTER_MAX_BYTES = 1_000_000;
const HTTP_BAD_REQUEST = 400;

export type PosterInput = ExportScope & { actor: Actor; form: FormData };

function posterFile(form: FormData): File | null {
  const file = form.get('file');
  return file instanceof File && file.type === POSTER_MIME && file.size > 0 && file.size <= POSTER_MAX_BYTES ? file : null;
}

const sizeOf = (raw: FormDataEntryValue | null): number | null => (Number(raw) > 0 ? Math.round(Number(raw)) : null);

export async function savePoster(db: Db, input: PosterInput) {
  const file = posterFile(input.form);
  if (!file) {
    return fail(HTTP_BAD_REQUEST, { error: 'invalid_poster' });
  }

  const path = `${exportFolder(input)}poster-${crypto.randomUUID()}.jpg`;
  await storeAssetFile(db, path, file);
  const asset = await insertAsset(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    type: 'image',
    source: 'upload',
    url: path,
    mimeType: POSTER_MIME,
    bytes: file.size,
    width: sizeOf(input.form.get('width')),
    height: sizeOf(input.form.get('height')),
    sourceNodeId: input.nodeId
  });

  await patchNodeData(db, { orgId: input.orgId, nodeId: input.nodeId, patch: { posterAssetId: asset.id }, check: DataCheck.Schema, actor: input.actor });
  return { assetId: asset.id };
}
