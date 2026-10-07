import { deserialize } from '$app/forms';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import type { Size } from '../export-plan';
import { MP4_MIME } from './encode';
import type { Saved } from './save';

const BUCKET = 'canvas-assets';

type Answer = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

async function action(pageUrl: string, name: string, fields: Record<string, string> = {}): Promise<Answer> {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  const res = await fetch(`${pageUrl}?/${name}`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
  const result = deserialize(await res.text());
  if (result.type === 'success') {
    return { ok: true, data: (result.data ?? {}) as Record<string, unknown> };
  }
  return { ok: false, error: result.type === 'failure' ? String(result.data?.error ?? 'refused') : 'request_failed' };
}

export async function saveToLink(pageUrl: string, blob: Blob, output: Size & { seconds: number }): Promise<Saved> {
  const slot = await action(pageUrl, 'slot');
  if (!slot.ok) {
    return slot;
  }
  const upload = await createSupabaseBrowserClient().storage.from(BUCKET).uploadToSignedUrl(String(slot.data.path), String(slot.data.token), blob, { contentType: MP4_MIME });
  if (upload.error) {
    return { ok: false, error: upload.error.message };
  }
  const finished = await action(pageUrl, 'finish', { width: String(output.width), height: String(output.height), seconds: String(output.seconds) });
  return finished.ok ? { ok: true, assetId: String(finished.data.assetId) } : finished;
}

export async function cancelLink(pageUrl: string): Promise<void> {
  await action(pageUrl, 'cancel', { reason: 'cancelled' });
}
