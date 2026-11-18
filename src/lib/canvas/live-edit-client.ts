import type { FrameStep } from './frame-multi';
import { editBody, fieldValue, previewOf, type LiveEditBody, type LiveField, type LivePick, type LivePreview } from './live-fields';

const PATH = '/api/v1/local/live-edit';

export type LiveAnswer = { ok: true; sha: string } | { ok: false; reason: string };

export type LiveApi = { edit: (body: LiveEditBody) => Promise<LiveAnswer>; undo: (sha: string) => Promise<LiveAnswer> };

export type LiveChangesView = { branch: string; files: string[]; patch: string };

async function answered(res: Response): Promise<LiveAnswer> {
  const body = await res.json().catch(() => null);
  return res.ok ? { ok: true, sha: body.sha } : { ok: false, reason: body?.message ?? `live edit: ${res.status}` };
}

const posted = (path: string, body: unknown) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const liveApi: LiveApi = {
  edit: (body) => posted(PATH, body).then(answered, (e: Error) => ({ ok: false, reason: e.message })),
  undo: (sha) => posted(PATH, { undo: sha }).then(answered, (e: Error) => ({ ok: false, reason: e.message }))
};

export const liveChanges = (): Promise<LiveChangesView> => fetch(PATH).then((r) => r.json());

export async function livePush(): Promise<{ ok: boolean; branch?: string; message?: string }> {
  const res = await posted(`${PATH}/push`, {});
  const body = await res.json().catch(() => null);
  return res.ok ? { ok: true, branch: body.branch } : { ok: false, message: body?.message };
}

export type LiveEditOutcome = { ok: true; step: FrameStep } | { ok: false; reason: string };

export async function editLive(api: LiveApi, pick: LivePick, field: LiveField, value: string, show: (preview: LivePreview) => void): Promise<LiveEditOutcome> {
  const body = editBody(pick, field, value);
  const was = fieldValue(field, pick);
  show(previewOf(field, value));

  const first = await api.edit(body);
  if (!first.ok) {
    show(previewOf(field, was));
    return first;
  }

  let sha = first.sha;
  const step: FrameStep = {
    back: () => {
      show(previewOf(field, was));
      void api.undo(sha);
    },
    forward: () => {
      show(previewOf(field, value));
      void api.edit(body).then((again) => {
        sha = again.ok ? again.sha : sha;
      });
    }
  };
  return { ok: true, step };
}
