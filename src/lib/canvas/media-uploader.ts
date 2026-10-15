import { deserialize } from '$app/forms';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { kindOfFile } from '$lib/motion/media/pick';
import type { MediaUploader } from '$lib/components/motion/media-upload';

const BUCKET = 'canvas-assets';
const READ_TTL_S = 3600;
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

    const read = await supabase.storage.from(BUCKET).createSignedUrl(path, READ_TTL_S);
    return { ok: true, asset: { id, kind, label: file.name, previewUrl: `/p/${at.projectId}/c/${at.canvasId}/assets/${id}`, url: read.data?.signedUrl ?? null } };
  };
}
