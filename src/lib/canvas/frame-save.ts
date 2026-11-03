import type { ActionResult } from '@sveltejs/kit';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { SaveFailure, type FrameDraft, type SendResult } from '$lib/motion/frame-edit-session.svelte';
import { idbShelf, type Shelf } from './outbox';

const SENT_AGAIN_STATUS: ReadonlySet<number> = new Set([408, 409, 425, 429]);
const SIGNED_OUT = 'You are signed out: sign in again to save';
const NOT_SAVED = 'Save failed';

const errorOf = (data: unknown) => (data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : NOT_SAVED);

const ANSWER: Record<ActionResult['type'], (result: ActionResult) => SendResult> = {
  success: (result) => {
    const data = (result as Extract<ActionResult, { type: 'success' }>).data ?? {};
    return { ok: true, version: Number(data.version), doc: data.doc as MotionDoc | undefined };
  },
  failure: (result) => {
    const { status, data } = result as Extract<ActionResult, { type: 'failure' }>;
    return { ok: false, error: errorOf(data), failure: SENT_AGAIN_STATUS.has(status) ? SaveFailure.Transient : SaveFailure.Refused };
  },
  error: (result) => ({ ok: false, error: String((result as Extract<ActionResult, { type: 'error' }>).error?.message ?? NOT_SAVED), failure: SaveFailure.Transient }),
  redirect: () => ({ ok: false, error: SIGNED_OUT, failure: SaveFailure.Refused })
};

export const sendResultOf = (result: ActionResult): SendResult => ANSWER[result.type](result);

export const refusedNotice = (error: string) => `Not saved: ${error}. Your edit is kept on this device and is sent again with your next change.`;

const DRAFTS_PLACE = { db: 'feega-frame-drafts', store: 'drafts' };

const isDraft = (value: unknown): value is FrameDraft => Boolean(value && typeof value === 'object' && Number.isInteger((value as FrameDraft).version) && Array.isArray((value as FrameDraft).ops));

export function frameDrafts(canvasId: string, shelf: Shelf) {
  const key = (nodeId: string) => `${canvasId}/${nodeId}`;
  return {
    keep: (nodeId: string, draft: FrameDraft) => shelf.write(key(nodeId), draft).catch(() => undefined),
    release: (nodeId: string) => shelf.write(key(nodeId), null).catch(() => undefined),
    read: async (nodeId: string): Promise<FrameDraft | null> => {
      const held = await shelf.read(key(nodeId)).catch(() => null);
      return isDraft(held) ? held : null;
    }
  };
}

export type FrameDrafts = ReturnType<typeof frameDrafts>;

export const browserDrafts = (canvasId: string): FrameDrafts => frameDrafts(canvasId, idbShelf(indexedDB, DRAFTS_PLACE));
