import type { ActionResult } from '@sveltejs/kit';
import { goto } from '$app/navigation';
import { postPageAction } from '$lib/api/page-action';
import { FEEGA_MAX_BYTES, FEEGA_REFUSAL_MESSAGE, FeegaRefusal, isFeegaFile } from './feega-file';

export const FEEGA_ACCEPT = '.feega';

const IMPORT_FAILED = 'The .feega file could not be imported. Try again.';
const SAVE_FAILED = 'The canvas could not be saved as a .feega file. Try again.';

type Post = (action: string, form: FormData) => Promise<ActionResult>;

const pageAt = (page: string): Post => (action, form) => postPageAction(page, action, form);

const formOf = (fields: Record<string, string>) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  return form;
};

const errorOf = (result: ActionResult, fallback: string) => (result.type === 'failure' ? String(result.data?.error ?? fallback) : fallback);

export async function importFeega(page: string, file: File): Promise<string | null> {
  if (!isFeegaFile(file)) {
    return FEEGA_REFUSAL_MESSAGE[FeegaRefusal.NotFeega];
  }
  if (file.size > FEEGA_MAX_BYTES) {
    return FEEGA_REFUSAL_MESSAGE[FeegaRefusal.TooLarge];
  }

  const post = pageAt(page);
  const signed = await post('request_canvas_import', formOf({ bytes: String(file.size) }));
  if (signed.type !== 'success' || !signed.data?.uploadUrl) {
    return errorOf(signed, IMPORT_FAILED);
  }

  const put = await fetch(String(signed.data.uploadUrl), { method: 'PUT', headers: { 'Content-Type': String(signed.data.mimeType) }, body: file }).catch(() => null);
  if (!put?.ok) {
    return IMPORT_FAILED;
  }

  const imported = await post('import_canvas_file', formOf({ path: String(signed.data.path) }));
  if (imported.type !== 'redirect') {
    return errorOf(imported, IMPORT_FAILED);
  }
  await goto(imported.location);
  return null;
}

export async function saveFeega(page: string): Promise<string | null> {
  const saved = await pageAt(page)('export_canvas_file', new FormData());
  if (saved.type !== 'success' || !saved.data?.url) {
    return errorOf(saved, SAVE_FAILED);
  }
  const link = Object.assign(document.createElement('a'), { href: String(saved.data.url), download: String(saved.data.name) });
  link.click();
  return null;
}
