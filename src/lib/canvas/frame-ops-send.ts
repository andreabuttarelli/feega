import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { postPageAction } from '$lib/api/page-action';
import { Delivery, type SendResult as FrameSend } from '$lib/motion/frame-edit-session.svelte';
import type { FrameDraft } from '$lib/motion/frame-sync';
import { failureOf, sendResultOf, type ActionAnswer } from './node-save';
import { SendResult } from './save-scheduler';

export type FramePlace = { projectId: string; canvasId: string; nodeId: string };

const OPS_ACTION = 'ops';
const NETWORK: ActionAnswer = { type: 'network' };
const SAVE_FAILED = 'Save failed';

export const frameOpsUrl = (place: FramePlace) => `/p/${place.projectId}/c/${place.canvasId}/motion/${place.nodeId}`;

export function frameOpsForm(draft: FrameDraft): FormData {
  const form = new FormData();
  form.set('ops', JSON.stringify(draft.ops));
  form.set('version', String(draft.version));
  form.set('summary', draft.summary);
  return form;
}

export function frameSendOf(answer: ActionAnswer): FrameSend {
  if (answer.type === 'success') {
    const data = (answer.data ?? {}) as { version?: number; doc?: MotionDoc };
    return { ok: true, version: Number(data.version), doc: data.doc };
  }
  const delivery = sendResultOf(failureOf(answer)) === SendResult.Retry ? Delivery.Unreachable : Delivery.Refused;
  return { ok: false, error: SAVE_FAILED, delivery };
}

export function queueResultOf(sent: FrameSend): SendResult {
  if (sent.ok) {
    return SendResult.Saved;
  }
  return sent.delivery === Delivery.Unreachable ? SendResult.Retry : SendResult.Dropped;
}

export async function postFrameOps(place: FramePlace, draft: FrameDraft): Promise<FrameSend> {
  const answer = await postPageAction(frameOpsUrl(place), OPS_ACTION, frameOpsForm(draft)).catch(() => NETWORK);
  return frameSendOf(answer as ActionAnswer);
}
