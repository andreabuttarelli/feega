import { CAPTURE, CAPTURED } from '../messages';
import type { Snap } from './canvas-snaps';

export const SHOT_TIMEOUT_MS = 10000;
export const FULL_SHOT_TIMEOUT_MS = 90000;

const PNG_PREFIX = 'data:image/png;base64,';
const NO_WINDOW = 'the frame has no window';
const NO_ANSWER = 'the page did not answer the capture';

type Answer = { png?: string; height?: number; capped?: boolean; error?: string };

export type FullShotAsk = { scale: number; maxHeight: number };

export type FullShot = { snap: Snap } | { reason: string };

let counter = 0;

function ask(frame: HTMLIFrameElement, extra: object, timeoutMs: number): Promise<Answer | null> {
  const win = frame.contentWindow;
  if (!win || !frame.src) {
    return Promise.resolve(null);
  }
  const id = ++counter;

  return new Promise((resolve) => {
    const finish = (answer: Answer | null) => (clearTimeout(timer), window.removeEventListener('message', heard), resolve(answer));
    const heard = (event: Event) => {
      const { data, source } = event as MessageEvent;
      if (source === win && data?.type === CAPTURED && data.id === id) {
        finish(data);
      }
    };
    const timer = setTimeout(() => finish({ error: NO_ANSWER }), timeoutMs);

    window.addEventListener('message', heard);
    win.postMessage({ type: CAPTURE, id, ...extra }, new URL(frame.src).origin);
  });
}

export async function shotOf(frame: HTMLIFrameElement): Promise<string | null> {
  const answer = await ask(frame, {}, SHOT_TIMEOUT_MS);

  return answer?.png ? `${PNG_PREFIX}${answer.png}` : null;
}

export async function fullShotOf(frame: HTMLIFrameElement, { scale, maxHeight }: FullShotAsk): Promise<FullShot> {
  const answer = await ask(frame, { full: true, scale, maxHeight }, FULL_SHOT_TIMEOUT_MS);
  if (!answer) {
    return { reason: NO_WINDOW };
  }
  if (!answer.png) {
    return { reason: answer.error ?? 'the page returned no picture' };
  }

  return { snap: { url: `${PNG_PREFIX}${answer.png}`, height: answer.height ?? 0, capped: answer.capped ?? false } };
}
