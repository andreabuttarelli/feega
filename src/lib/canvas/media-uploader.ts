import { deserialize } from '$app/forms';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { kindOfFile } from '$lib/motion/media/pick';
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

export function canvasMediaUploader(supabase: SupabaseClient, at: { orgId: string; projectId: string; canvasId: string }): MediaUploader {
  return async (file, progress) => {
    const kind = kindOfFile(file.type);
    if (!kind) {
      return { ok: false, error: 'Pick an image or a video file' };
    }
    const path = `${canvasUploadPrefix(at.orgId, at.projectId)}${crypto.randomUUID()}-${file.name.replace(UNSAFE_NAME, '_')}`;
    const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signed.error) {
      return { ok: false, error: signed.error.message };
    }
    const refused = await put(signed.data.signedUrl, file, progress);
    if (refused) {
      return { ok: false, error: refused };
    }

    const form = new FormData();
    Object.entries({ path, file_name: file.name, mime_type: file.type, bytes: String(file.size), into: 'library' }).forEach(([k, v]) => form.set(k, v));
    const res = await fetch(`/p/${at.projectId}/c/${at.canvasId}?/upload`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());
    const id = result.type === 'success' ? (result.data?.asset as { id?: string } | undefined)?.id : undefined;
    if (!id) {
      return { ok: false, error: result.type === 'failure' ? String(result.data?.error ?? 'Upload refused') : 'Upload failed' };
    }

    const readable = (await projectMedia(at)).find((m) => m.id === id)?.url ?? null;
    return { ok: true, asset: { id, kind, label: file.name, previewUrl: `/p/${at.projectId}/c/${at.canvasId}/assets/${id}`, url: readable } };
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
    .map((a) => ({ id: a.id, kind: a.type, label: labelOf(a), previewUrl: `/p/${at.projectId}/c/${at.canvasId}/assets/${a.id}`, url: a.signedUrl, seconds: a.durationS }));
}
