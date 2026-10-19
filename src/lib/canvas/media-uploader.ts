import type { SupabaseClient } from '@supabase/supabase-js';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { AssetSize, canvasAssetUrl } from '$lib/canvas/asset-url';
import { postCanvasAction } from '$lib/canvas/canvas-api';
import { MediaKind, kindOfFile } from '$lib/motion/media/pick';
import type { LibraryMedia, MediaUploader } from '$lib/components/motion/media-upload';

const BUCKET = 'canvas-assets';
const UNSAFE_NAME = /[^\w.-]+/g;

function put(url: string, file: File, progress: (fraction: number) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && progress(e.loaded / e.total);
    xhr.onload = () => resolve(xhr.status < 300 ? null : 'The upload was refused');
    xhr.onerror = () => resolve('The upload failed. Check the connection and try again.');
    xhr.send(file);
  });
}

type At = { orgId: string; projectId: string; canvasId: string };

async function registered(at: At, action: string, fields: Record<string, string>): Promise<{ id: string } | { error: string }> {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  const result = await postCanvasAction(at, action, form);
  const id = result.type === 'success' ? (result.data?.asset as { id?: string } | undefined)?.id : undefined;
  if (id) {
    return { id };
  }
  return { error: result.type === 'failure' ? String(result.data?.error ?? 'Upload refused') : 'Upload failed' };
}

async function uploadFile(supabase: SupabaseClient, at: At, file: File, progress: (fraction: number) => void): Promise<{ id: string } | { error: string }> {
  const path = `${canvasUploadPrefix(at.orgId, at.projectId)}${crypto.randomUUID()}-${file.name.replace(UNSAFE_NAME, '_')}`;
  const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signed.error) {
    return { error: signed.error.message };
  }
  const refused = await put(signed.data.signedUrl, file, progress);
  if (refused) {
    return { error: refused };
  }
  return registered(at, 'upload', { path, file_name: file.name, mime_type: file.type, bytes: String(file.size), into: 'library' });
}

const importLink = (at: At, url: URL) => registered(at, 'importLink', { url: url.href });

export function canvasMediaUploader(supabase: SupabaseClient, at: At): MediaUploader {
  return async (source, progress) => {
    const linked = source instanceof URL;
    const kind = linked ? null : kindOfFile(source.type);
    if (!linked && !kind) {
      return { ok: false, error: 'Pick an image or a video file' };
    }

    const outcome = linked ? await importLink(at, source) : await uploadFile(supabase, at, source, progress);
    if ('error' in outcome) {
      return { ok: false, error: outcome.error };
    }

    const media = (await projectMedia(at)).find((m) => m.id === outcome.id);
    const label = linked ? (media?.label ?? source.href) : source.name;
    return { ok: true, asset: { id: outcome.id, kind: (media?.kind as MediaKind | undefined) ?? kind ?? MediaKind.Image, label, previewUrl: canvasAssetUrl(at.projectId, at.canvasId, outcome.id, AssetSize.Full), url: media?.url ?? null } };
  };
}

type AssetRow = { id: string; type: string; url: string | null; signedUrl: string | null; durationS: number | null; source: string | null };

const MEDIA_TYPES = new Set(['image', 'video']);
const UPLOAD_NAME = /^[0-9a-f-]{36}-/i;

const labelOf = (row: AssetRow) => (row.url?.split('/').pop() ?? '').replace(UPLOAD_NAME, '') || (row.source === 'generated' ? `Generated ${row.type}` : row.type);

export async function projectMedia(at: { projectId: string; canvasId: string }): Promise<LibraryMedia[]> {
  const res = await fetch(`/api/v1/projects/${at.projectId}/agent/assets`).catch(() => null);
  if (!res?.ok) {
    return [];
  }
  const { assets } = (await res.json()) as { assets: AssetRow[] };
  return assets
    .filter((a) => MEDIA_TYPES.has(a.type))
    .map((a) => ({ id: a.id, kind: a.type, label: labelOf(a), previewUrl: canvasAssetUrl(at.projectId, at.canvasId, a.id, AssetSize.Full), url: a.signedUrl, seconds: a.durationS }));
}
