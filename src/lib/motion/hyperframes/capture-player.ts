import { CAPTURE_REPLY, type CaptureReply } from './capture';
import { previewDriver, type ShotRequest } from './preview-driver';

type Player = HTMLElement & { seek: (t: number) => void; play: () => void; pause: () => void; iframeElement: HTMLIFrameElement };

export type CapturePlayer = { shoot: (time: number, request: ShotRequest) => Promise<CaptureReply>; dispose: () => void };

export async function mountCapturePlayer(host: HTMLElement, html: string): Promise<CapturePlayer> {
  await import('@hyperframes/player');
  const el = document.createElement('hyperframes-player') as Player;
  el.setAttribute('sandbox-origin', 'opaque');
  el.setAttribute('assets-loading-ui', 'none');
  el.setAttribute('disable-click-to-play', '');
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
  host.appendChild(el);

  const driver = previewDriver({
    load: (next) => el.setAttribute('srcdoc', next),
    seek: (t) => el.seek(t),
    play: () => el.play(),
    pause: () => el.pause(),
    post: (message) => {
      const target = el.iframeElement?.contentWindow;
      if (!target) {
        return false;
      }
      target.postMessage(message, '*');
      return true;
    },
    onReady: (listener) => {
      el.addEventListener('ready', listener);
      return () => el.removeEventListener('ready', listener);
    },
    onReply: (listener) => {
      const onMessage = (e: MessageEvent) => {
        const m = e.data as CaptureReply;
        if (e.source === el.iframeElement?.contentWindow && m?.type === CAPTURE_REPLY) {
          listener(m);
        }
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    }
  });

  el.addEventListener('ready', () => driver.ready(), { once: true });
  await driver.loaded(html);
  return { shoot: (time, request) => driver.shoot(time, request), dispose: () => el.remove() };
}
