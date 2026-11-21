import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionById, SNAPSHOT_BUCKET, versionPathOf } from './sessions';
import { indexZip, readEntry } from './zip';

export type SnapshotFile = { body: Uint8Array; contentType: string };

const DEFAULT_FILE = 'index.html';
const FALLBACK_TYPE = 'application/octet-stream';

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2'
};

export const SNAPSHOT_CSP = "sandbox; default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:";

const VERSION_PREFIX = /^v\/([a-z0-9-]+)\//;

export function snapshotEntryName(requested: string): string {
  const name = requested.replace(/^\/+/, '');

  return name === '' ? DEFAULT_FILE : name;
}

function splitVersion(requested: string): { versionId: string | null; file: string } {
  const match = requested.match(VERSION_PREFIX);

  return match ? { versionId: match[1], file: requested.slice(match[0].length) } : { versionId: null, file: requested };
}

function contentTypeOf(name: string): string {
  return CONTENT_TYPES[name.split('.').pop()?.toLowerCase() ?? ''] ?? FALLBACK_TYPE;
}

export async function snapshotFile(db: SupabaseClient, sid: string, requested: string): Promise<SnapshotFile | null> {
  const session = await sessionById(db, sid);
  const { versionId, file } = splitVersion(requested);
  const path = versionId && session ? versionPathOf(session, versionId) : session?.snapshot_path;
  if (!path) {
    return null;
  }

  const stored = await db.storage.from(SNAPSHOT_BUCKET).download(path);
  if (!stored.data) {
    return null;
  }

  const archive = new Uint8Array(await stored.data.arrayBuffer());
  const name = snapshotEntryName(file);
  const body = await readEntry(archive, indexZip(archive), name);

  return body ? { body, contentType: contentTypeOf(name) } : null;
}
