import { createHash } from 'node:crypto';
import { gunzipSync, strFromU8 } from 'fflate';
import { untarred } from '$lib/code-upload/tar';
import { SNAPSHOT_LIMITS } from '$lib/code-upload/snapshot';
import type { Db } from '$lib/server/db/client';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import type { CodeSource } from './code-source';

export type Upload = { path: string; name: string };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UPLOAD_PATH = new RegExp(`^(${UUID})/${UUID}/code-uploads/${UUID}/([A-Za-z0-9_][A-Za-z0-9._-]{0,59})$`);
const ARCHIVE_MIME = 'application/gzip';
export const MAX_UPLOAD_BYTES = SNAPSHOT_LIMITS.totalBytes;

export const uploadPath = (orgId: string, projectId: string, name: string) => `${orgId}/${projectId}/code-uploads/${crypto.randomUUID()}/${name}`;

export function uploadOf(orgId: string, raw: string): Upload | null {
  const m = raw.match(UPLOAD_PATH);
  return m && m[1] === orgId ? { path: raw, name: m[2] } : null;
}

export async function signCodeUpload(db: Db, scope: { orgId: string; projectId: string }, name: string): Promise<{ path: string; uploadUrl: string; mimeType: string } | null> {
  const path = uploadPath(scope.orgId, scope.projectId, name);
  if (!uploadOf(scope.orgId, path)) {
    return null;
  }
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET).createSignedUploadUrl(path);
  return error || !data ? null : { path, uploadUrl: data.signedUrl, mimeType: ARCHIVE_MIME };
}

export async function uploadedArchive(db: Db, upload: Upload): Promise<Uint8Array | null> {
  const got = await db.storage.from(CANVAS_ASSET_BUCKET).download(upload.path);
  if (got.error || !got.data || got.data.size > MAX_UPLOAD_BYTES) {
    return null;
  }
  return new Uint8Array(await got.data.arrayBuffer());
}

export const snapshotSha = (archive: Uint8Array) => createHash('sha1').update(archive).digest('hex');

export function uploadSource(archive: Uint8Array): CodeSource {
  const sha = snapshotSha(archive);
  const files = untarred(gunzipSync(archive));
  return {
    read: () => async (path) => {
      const bytes = files.get(path);
      return bytes ? strFromU8(bytes) : null;
    },
    head: async () => sha,
    publish: async () => null
  };
}

export const uploadFiles = (archive: Uint8Array) => [...untarred(gunzipSync(archive)).keys()];
