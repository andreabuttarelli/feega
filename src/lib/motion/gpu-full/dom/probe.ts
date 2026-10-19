import { js } from '../../hyperframes/html';
import { COMPOSITION_ID } from '../../hyperframes/capture';
import { CUSTOM_ROOT_PREFIX, DOM_READ_REPLY, DOM_READ_REQUEST, NO_INDEX, READ_ATTRS, READ_STYLES, type DomReadRequest, type RawNode, type RawTree } from './tree';

type ProbeConfig = { request: string; reply: string; timeline: string; prefix: string; none: number; styles: readonly string[]; attrs: readonly string[] };

type Seekable = { pause: () => void; seek: (t: number) => void };

export function domProbe(cfg: ProbeConfig) {
  const UNRENDERED = new Set(['style', 'script', 'defs', 'clippath', 'pattern', 'lineargradient', 'radialgradient', 'filter', 'mask', 'symbol', 'marker', 'title', 'desc', 'metadata']);
  const UNTRANSFORMED = 'feega-dom-read-untransformed';
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  const boxed = (el: Element) => el instanceof HTMLElement || el.tagName.toLowerCase() === 'svg';

  const ownText = (el: Element) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();

  const untransformedRects = (elements: Element[]) => {
    const sheet = document.createElement('style');
    sheet.id = UNTRANSFORMED;
    sheet.textContent = '*{transform:none!important;translate:none!important;rotate:none!important;scale:none!important}';
    document.head.appendChild(sheet);
    const rects = elements.map((el) => el.getBoundingClientRect());
    sheet.remove();
    return rects;
  };

  const read = (root: HTMLElement, layers: Promise<ImageBitmap>[]): RawTree => {
    const nodes: RawNode[] = [];
    const elements: Element[] = [];
    const visit = (el: Element, parent: number) => {
      const tag = el.tagName.toLowerCase();
      if (UNRENDERED.has(tag)) {
        return;
      }
      const computed = getComputedStyle(el);
      if (computed.display === 'none') {
        return;
      }
      const style = Object.fromEntries(cfg.styles.map((k) => [k, computed.getPropertyValue(k)]));
      const attrs = Object.fromEntries(cfg.attrs.flatMap((k) => (el.hasAttribute(k) ? [[k, el.getAttribute(k) ?? '']] : [])));
      const layer = el instanceof HTMLCanvasElement ? layers.push(createImageBitmap(el)) - 1 : cfg.none;
      const text = tag === 'text' ? (el.textContent ?? '').trim() : ownText(el);
      nodes.push({ tag, svg: !(el instanceof HTMLElement), parent, at: null, size: [0, 0], style, attrs, text, layer });
      elements.push(el);
      const me = nodes.length - 1;
      for (const child of el.children) {
        visit(child, me);
      }
    };
    visit(root, cfg.none);
    const rects = untransformedRects(elements);
    nodes.forEach((node, i) => {
      if (!boxed(elements[i])) {
        return;
      }
      const own = rects[i];
      const base = node.parent === cfg.none ? own : rects[node.parent];
      node.at = [own.left - base.left, own.top - base.top];
      node.size = [own.width, own.height];
    });
    return { width: rects[0]?.width ?? 0, height: rects[0]?.height ?? 0, nodes };
  };

  addEventListener('message', (e: MessageEvent) => {
    const m = e.data as DomReadRequest;
    if (!m || m.type !== cfg.request) {
      return;
    }
    const source = e.source as Window | null;
    const w = window as unknown as { __timelines?: Record<string, Seekable>; __fontsReady?: Promise<unknown>; __hfWaitForSeekCompletion?: () => Promise<void> };
    const done = (body: Record<string, unknown>, transfer: Transferable[]) => source?.postMessage({ type: cfg.reply, id: m.id, time: m.time, ...body }, { targetOrigin: '*', transfer });
    Promise.resolve(w.__fontsReady)
      .then(() => document.fonts.ready)
      .then(() => {
        const tl = w.__timelines?.[cfg.timeline];
        tl?.pause();
        tl?.seek(m.time);
      })
      .then(() => w.__hfWaitForSeekCompletion?.())
      .then(frame)
      .then(async () => {
        const pending: Promise<ImageBitmap>[] = [];
        const trees = Object.fromEntries(
          m.clips.flatMap((clip) => {
            const root = document.getElementById(cfg.prefix + clip);
            return root ? [[clip, read(root, pending)]] : [];
          })
        );
        const layers = await Promise.all(pending);
        done({ trees, layers }, layers);
      })
      .catch((err) => done({ trees: {}, layers: [], error: String(err) }, []));
  });
}

export function domProbeScript(): string {
  const cfg: ProbeConfig = { request: DOM_READ_REQUEST, reply: DOM_READ_REPLY, timeline: COMPOSITION_ID, prefix: CUSTOM_ROOT_PREFIX, none: NO_INDEX, styles: READ_STYLES, attrs: READ_ATTRS };
  return `<script>(${domProbe.toString()})(${js(cfg)});</script>`;
}
