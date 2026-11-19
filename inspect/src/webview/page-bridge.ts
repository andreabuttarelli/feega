import { BRIDGE_READY, INSPECT, INSPECT_RESULT, LOCAL_ORIGIN, PREVIEW, type Pick, type Source } from '../messages';

type Inspected = { source: Source; component: Source | null; html: string; rect: Pick['rect']; styles: Record<string, string>; classes: string; rem: number; viewport: number };

const TAG = /^<([a-zA-Z][\w-]*)/;
const SOURCE_ATTR = 'data-feega-src';

const pickOf = (r: Inspected | null): Pick | null =>
  r ? { source: r.source, component: r.component, tag: r.html.match(TAG)?.[1] ?? '', rect: r.rect, styles: r.styles, classes: r.classes, rem: r.rem, viewport: r.viewport } : null;

export const sourceText = (s: Source) => `${s.file}:${s.line}:${s.col}`;

export function pageBridge(frame: () => HTMLIFrameElement | null, onReady: () => void) {
  const waiting = new Map<number, (pick: Pick | null) => void>();
  let next = 0;

  window.addEventListener('message', (event) => {
    if (!LOCAL_ORIGIN.test(event.origin)) {
      return;
    }
    if (event.data?.type === BRIDGE_READY) {
      onReady();
      return;
    }
    if (event.data?.type !== INSPECT_RESULT) {
      return;
    }
    waiting.get(event.data.id)?.(pickOf(event.data.result));
    waiting.delete(event.data.id);
  });

  function send(message: Record<string, unknown>) {
    const target = frame();
    const origin = target?.src ? new URL(target.src).origin : null;
    if (target?.contentWindow && origin) {
      target.contentWindow.postMessage(message, origin);
    }
  }

  function inspect(query: { x: number; y: number } | { selector: string }): Promise<Pick | null> {
    const id = ++next;
    return new Promise((resolve) => {
      waiting.set(id, resolve);
      send({ type: INSPECT, id, ...query });
    });
  }

  return {
    at: (x: number, y: number) => inspect({ x, y }),
    again: (source: Source) => inspect({ selector: `[${SOURCE_ATTR}="${sourceText(source)}"]` }),
    preview: (source: Source, style: Record<string, string>) => send({ type: PREVIEW, source: sourceText(source), style })
  };
}
