import { domProbeScript } from './probe';
import { DOM_READ_REPLY, DOM_READ_REQUEST, type DomReadReply, type DomReadRequest } from './tree';

export type Compose = (only?: ReadonlySet<string>) => string;

export type DomReader = { readAt: (time: number) => Promise<DomReadReply>; dispose: () => void };

const READ_TIMEOUT_MS = 60_000;

const withProbe = (html: string) => (html.includes('</body>') ? html.replace('</body>', `${domProbeScript()}</body>`) : html + domProbeScript());

export async function mountDomReader(host: HTMLElement, compose: Compose, clips: string[], size: { width: number; height: number }): Promise<DomReader> {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:absolute;left:0;top:0;width:${size.width}px;height:${size.height}px;border:0;opacity:0;pointer-events:none;z-index:-1`;
  const loaded = new Promise((r) => frame.addEventListener('load', r, { once: true }));
  frame.srcdoc = withProbe(compose(new Set(clips)));
  host.appendChild(frame);
  await loaded;

  const readAt = (time: number) =>
    new Promise<DomReadReply>((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => finish(() => reject(new Error(`custom components did not answer within ${READ_TIMEOUT_MS / 1000}s`))), READ_TIMEOUT_MS);
      const onMessage = (e: MessageEvent) => {
        const m = e.data as DomReadReply;
        if (e.source === frame.contentWindow && m?.type === DOM_READ_REPLY && m.id === id) {
          finish(() => (m.error ? reject(new Error(m.error)) : resolve(m)));
        }
      };
      const finish = (then: () => void) => {
        clearTimeout(timer);
        removeEventListener('message', onMessage);
        then();
      };
      addEventListener('message', onMessage);
      const request: DomReadRequest = { type: DOM_READ_REQUEST, id, time, clips };
      frame.contentWindow?.postMessage(request, '*');
    });

  return { readAt, dispose: () => frame.remove() };
}
