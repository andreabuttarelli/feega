import type { ActionResult } from '@sveltejs/kit';
import { apiCall, withOrg } from '$lib/api/client';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import type { MotionEditorData } from '$lib/server/motion/editor-session';
import { UploadPurpose, actionAsk, type EditorActionName } from './actions';

const OK = 200;
const BAD_REQUEST = 400;
const BUCKET = 'canvas-assets';

export type Uploaded = { ok: true; path: string } | { ok: false; error: string };

const nodeIdOf = (editorUrl: string) => editorUrl.split('/').filter(Boolean).at(-1) ?? '';

const opsPath = (nodeId: string) => withOrg(`/api/v1/motion/${nodeId}/ops`);

function runOp(nodeId: string, op: string, input: Record<string, unknown>) {
  return apiCall(opsPath(nodeId), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, input }) });
}

export async function editorAction(editorUrl: string, name: EditorActionName, form = new FormData()): Promise<ActionResult> {
  const asked = actionAsk(name, form);
  if ('refused' in asked) {
    return { type: 'failure', status: asked.refused.status, data: asked.refused.body };
  }
  const { status, body } = await runOp(nodeIdOf(editorUrl), asked.op, asked.input);
  return status >= BAD_REQUEST ? { type: 'failure', status, data: body } : { type: 'success', status: OK, data: body };
}

export async function editorSessionOf(nodeId: string, briefIds: string[]): Promise<MotionEditorData | null> {
  const { status, body } = await runOp(nodeId, 'editor_session', { briefIds });
  return status >= BAD_REQUEST ? null : (body as unknown as MotionEditorData);
}

export async function uploadToSlot(editorUrl: string, purpose: UploadPurpose, file: Blob, name: string): Promise<Uploaded> {
  const slot = await runOp(nodeIdOf(editorUrl), 'upload_slot', { purpose, name });
  if (slot.status >= BAD_REQUEST) {
    return { ok: false, error: String(slot.body.error ?? 'upload_slot_failed') };
  }
  const path = String(slot.body.path);
  const upload = await createSupabaseBrowserClient().storage.from(BUCKET).uploadToSignedUrl(path, String(slot.body.token), file, { contentType: file.type || 'application/octet-stream' });
  return upload.error ? { ok: false, error: upload.error.message } : { ok: true, path };
}

export async function sendPoster(editorUrl: string, form: FormData): Promise<void> {
  await apiCall(withOrg(`/api/v1/motion/${nodeIdOf(editorUrl)}/poster`), { method: 'POST', body: form });
}
