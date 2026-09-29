import type { SupabaseClient } from '@supabase/supabase-js';
import { ARCHIVE_USER_AGENT, safeFetchBytes } from '$lib/server/tool-guard';
import { signThumbnailUrls, type ThumbnailPreset } from '$lib/server/media-thumbnails';

// Tiny, dependency-free media archival helpers (deliberately imports nothing from the AI modules,
// so scrapecreators/content-preview/brand-context can all use it without import cycles).
//
// Why this exists: every scraped thumbnail is a SIGNED platform-CDN URL that expires within days.
// Anything that must survive (history thumbs, competitor reference posts) gets downloaded into the
// private brand-knowledge bucket WHILE the link is alive; consumers then sign our copy.

const DEFAULT_BUCKET = 'brand-knowledge';
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

// Download an external image and store it at `path` in the given bucket (brand-knowledge unless
// told otherwise). Returns the path on success, null on any failure (dead URL, non-image,
// oversized, a target we refuse to reach) — callers keep the URL fallback. Upsert so re-archiving
// the same key is idempotent.
//
// The fetch goes through safeFetchBytes rather than bare fetch: at least one caller (the chat's
// style-reference tool) hands it a URL a model chose, and a plain fetch of a model-chosen URL is
// a request forger with our network position.
export async function archiveImageToBucket(
  supabase: SupabaseClient,
  path: string,
  url: string,
  bucket: string = DEFAULT_BUCKET
): Promise<string | null> {
  try {
    const res = await safeFetchBytes(url, {
      maxBytes: MAX_BYTES,
      timeoutMs: TIMEOUT_MS,
      userAgent: ARCHIVE_USER_AGENT
    });
    if (!res.ok || !res.mime.startsWith('image/') || !res.bytes.length) return null;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, res.bytes, { contentType: res.mime, upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

// Batch-sign brand-knowledge paths → path→signedUrl map (missing entries simply absent).
export async function signKnowledgePaths(
  supabase: SupabaseClient,
  paths: string[],
  ttlSeconds = 60 * 60 * 2,
  preset?: ThumbnailPreset
): Promise<Map<string, string>> {
  return signThumbnailUrls(() => supabase.storage.from(DEFAULT_BUCKET), paths, ttlSeconds, preset);
}
