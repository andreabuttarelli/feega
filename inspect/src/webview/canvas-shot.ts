import { CAPTURE, CAPTURED } from '../messages';

export const SHOT_TIMEOUT_MS = 10000;

const PNG_PREFIX = 'data:image/png;base64,';

let counter = 0;

export function shotOf(frame: HTMLIFrameElement): Promise<string | null> {
  const win = frame.contentWindow;
  if (!win || !frame.src) {
    return Promise.resolve(null);
  }
  const id = ++counter;

  return new Promise((resolve) => {
    const finish = (png: string | null) => (clearTimeout(timer), window.removeEventListener('message', heard), resolve(png ? `${PNG_PREFIX}${png}` : null));
    const heard = (event: Event) => {
      const { data, source } = event as MessageEvent;
      if (source === win && data?.type === CAPTURED && data.id === id) {
        finish(data.png ?? null);
      }
    };
    const timer = setTimeout(() => finish(null), SHOT_TIMEOUT_MS);

    window.addEventListener('message', heard);
    win.postMessage({ type: CAPTURE, id }, new URL(frame.src).origin);
  });
}
