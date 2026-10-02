import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { signThumbnailUrls, type ThumbnailPreset } from '$lib/server/media-thumbnails';

export const REFERENCE_IMAGES_BUCKET = 'reference-images';

const SIGNED_URL_SECONDS = 60 * 60;

const COLUMNS = 'id, org_id, name, storage_path, mime_type, width, height, sort_order';

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

export type ReferenceImage = {
  id: string;
  orgId: string | null;
  name: string;
  storagePath: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
};

type ReferenceImageRow = {
  id: string;
  org_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
};

function toReferenceImage(row: ReferenceImageRow): ReferenceImage {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height
  };
}

function rowsOrEmpty(result: { data: unknown; error: { code?: string } | null }): ReferenceImageRow[] {
  if (result.error && MISSING_TABLE_CODES.has(result.error.code ?? '')) {
    return [];
  }
  if (result.error) {
    throw result.error;
  }
  return (result.data ?? []) as ReferenceImageRow[];
}

function untyped(db: Db): SupabaseClient {
  return db as unknown as SupabaseClient;
}

export async function listReferenceImages(db: Db): Promise<ReferenceImage[]> {
  const result = await untyped(db)
    .from('reference_images')
    .select(COLUMNS)
    .order('sort_order', { ascending: true });
  return rowsOrEmpty(result).map(toReferenceImage);
}

export async function findReferenceImages(db: Db, ids: string[]): Promise<Map<string, ReferenceImage>> {
  if (!ids.length) {
    return new Map();
  }
  const result = await untyped(db).from('reference_images').select(COLUMNS).in('id', ids);
  return new Map(rowsOrEmpty(result).map((row) => [row.id, toReferenceImage(row)]));
}

export async function signReferenceImages(db: Db, paths: string[], preset?: ThumbnailPreset): Promise<Map<string, string>> {
  return signThumbnailUrls({ name: REFERENCE_IMAGES_BUCKET, open: () => untyped(db).storage.from(REFERENCE_IMAGES_BUCKET) }, paths, SIGNED_URL_SECONDS, preset);
}

export type CatalogueImage = { id: string; name: string; url: string | null };

export async function listCatalogueImages(db: Db, preset: ThumbnailPreset = 'pickerTile'): Promise<CatalogueImage[]> {
  const images = await listReferenceImages(db);
  const signed = await signReferenceImages(db, images.map((image) => image.storagePath), preset);
  return images.map((image) => ({ id: image.id, name: image.name, url: signed.get(image.storagePath) ?? null }));
}
