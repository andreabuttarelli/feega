import { editorAction, uploadToSlot } from '$lib/frame-editor/client';
import { UploadPurpose } from '$lib/frame-editor/actions';
import type { Size } from '../export-plan';
import { MP4_MIME } from './encode';

export type Saved = { ok: true; assetId: string } | { ok: false; error: string };

export async function saveExport(blob: Blob, input: { editorUrl: string; size: Size; seconds: number }): Promise<Saved> {
  const upload = await uploadToSlot(input.editorUrl, UploadPurpose.Export, new Blob([blob], { type: MP4_MIME }), 'export.mp4');
  if (!upload.ok) {
    return upload;
  }

  const form = new FormData();
  form.set('path', upload.path);
  form.set('width', String(input.size.width));
  form.set('height', String(input.size.height));
  form.set('seconds', String(input.seconds));
  const result = await editorAction(input.editorUrl, 'exported', form);
  if (result.type === 'success') {
    return { ok: true, assetId: String(result.data?.assetId) };
  }
  return { ok: false, error: result.type === 'failure' ? String(result.data?.error ?? 'not saved') : 'not saved' };
}
