import { Delivery, FrameEditSession, type SendResult } from '$lib/motion/frame-edit-session.svelte';
import type { FrameStep } from './frame-multi';
import { LIVE_CLIP, liveDocOf, liveEditsOf, livePreviewOf, unwrittenOf } from './live-doc';
import type { LiveApi } from './live-edit-client';
import type { LivePick, LivePreview } from './live-fields';

const NO_CSS = 'This setting has no equivalent in CSS, so the code is unchanged';

export type LivePort = { api: LiveApi; preview: (preview: LivePreview) => void; stepped: (step: FrameStep) => void; failed: (reason: string) => void };

export function liveSession(pick: LivePick, port: LivePort): FrameEditSession {
  const picked = liveDocOf(pick);
  let written = picked;

  async function write(): Promise<SendResult> {
    const target = session.history.present;
    port.preview(livePreviewOf(picked, target));

    const edits = liveEditsOf(written, target, pick);
    if (!edits.length && unwrittenOf(written, target)) {
      port.failed(NO_CSS);
    }

    for (const body of edits) {
      const out = await port.api.edit(body);
      if (!out.ok) {
        port.failed(out.reason);
        port.preview(livePreviewOf(target, written));
        return { ok: false, error: out.reason, delivery: Delivery.Refused };
      }
    }

    written = target;
    return { ok: true, version: session.version + 1, doc: undefined };
  }

  const session: FrameEditSession = new FrameEditSession(
    { head: { version: 0, doc: picked }, selection: [LIVE_CLIP] },
    {
      viewPath: () => [],
      playhead: () => 0,
      show: (doc) => doc && port.preview(livePreviewOf(picked, doc)),
      recorded: () => undefined,
      stepped: () => port.stepped({ back: () => session.undo(), forward: () => session.redo() }),
      saved: () => undefined,
      landed: () => undefined,
      pull: async () => undefined,
      send: write,
      draft: () => undefined
    }
  );
  return session;
}
