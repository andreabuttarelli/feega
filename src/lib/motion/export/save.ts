import { postPageAction } from '$lib/api/page-action';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import { exportPath, type ExportScope, type Size } from '../export-plan';
import { MP4_MIME } from './encode';

const BUCKET = 'canvas-assets';

export type Saved = { ok: true; assetId: string } | { ok: false; error: string };

export async function saveExport(blob: Blob, input: { scope: ExportScope; editorUrl: string; size: Size; seconds: number }): Promise<Saved> {
  const path = exportPath(input.scope, crypto.randomUUID());
  const upload = await createSupabaseBrowserClient().storage.from(BUCKET).upload(path, blob, { contentType: MP4_MIME, upsert: false });
  if (upload.error) {
    return { ok: false, error: upload.error.message };
  }

  const form = new FormData();
  form.set('path', path);
  form.set('width', String(input.size.width));
  form.set('height', String(input.size.height));
  form.set('seconds', String(input.seconds));
  const result = await postPageAction(input.editorUrl, 'exported', form);
  if (result.type === 'success') {
    return { ok: true, assetId: String(result.data?.assetId) };
  }
  return { ok: false, error: result.type === 'failure' ? String(result.data?.error ?? 'not saved') : 'not saved' };
}
