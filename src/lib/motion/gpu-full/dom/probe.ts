import { js } from '../../hyperframes/html';
import { COMPOSITION_ID } from '../../hyperframes/capture';
import { CUSTOM_ROOT_PREFIX, DOM_READ_REPLY, DOM_READ_REQUEST, NO_INDEX, TEXT_PAD, READ_ATTRS, READ_STYLES, type DomReadRequest, type RawNode, type RawTree, type TextLine, type TextRaster } from './tree';
import type { SvgNode } from '../../effects/registry';

type ProbeConfig = { request: string; reply: string; timeline: string; prefix: string; none: number; pad: number; styles: readonly string[]; attrs: readonly string[] };

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

  const untransformed = <T>(measure: () => T): T => {
    const sheet = document.createElement('style');
    sheet.id = UNTRANSFORMED;
    sheet.textContent = '*{transform:none!important;translate:none!important;rotate:none!important;scale:none!important}';
    document.head.appendChild(sheet);
    const out = measure();
    sheet.remove();
    return out;
  };

  const linesOf = (el: Element, box: DOMRect): TextLine[] => {
    const lines: TextLine[] = [];
    const range = document.createRange();
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) {
        continue;
      }
      let offset = 0;
      for (const char of node.textContent ?? '') {
        const start = offset;
        offset += char.length;
        if (!char.trim()) {
          continue;
        }
        range.setStart(node, start);
        range.setEnd(node, offset);
        const rect = range.getClientRects()[0];
        if (!rect || !rect.width) {
          continue;
        }
        const top = rect.top - box.top;
        const last = lines[lines.length - 1];
        const line = last && top + rect.height / 2 < last.top + last.height ? last : lines[lines.push({ chars: [], xs: [], top, height: rect.height }) - 1];
        line.chars.push(char);
        line.xs.push(rect.left - box.left);
      }
    }
    return lines;
  };

  const CASES: Record<string, (c: string) => string> = { uppercase: (c) => c.toUpperCase(), lowercase: (c) => c.toLowerCase() };
  const unquoted = (family: string) => family.trim().replace(/^["']|["']$/g, '');

  const webFamilies = () => new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => unquoted(f.family)));

  const rasterOf = (computed: CSSStyleDeclaration, lines: TextLine[], box: DOMRect, layers: Promise<ImageBitmap>[]): TextRaster => {
    const size = parseFloat(computed.fontSize) || 0;
    const right = Math.max(box.width, ...lines.map((l) => (l.xs[l.xs.length - 1] ?? 0) + 2 * size));
    const bottom = Math.max(box.height, ...lines.map((l) => l.top + l.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(right) + 2 * cfg.pad;
    canvas.height = Math.ceil(bottom) + 2 * cfg.pad;
    const pen = canvas.getContext('2d') as CanvasRenderingContext2D;
    pen.font = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
    pen.fillStyle = computed.color;
    const cased = CASES[computed.textTransform] ?? ((c: string) => c);
    for (const line of lines) {
      line.chars.forEach((raw, i) => {
        const char = cased(raw);
        pen.fillText(char, cfg.pad + line.xs[i], cfg.pad + line.top + pen.measureText(char).fontBoundingBoxAscent);
      });
    }
    return { layer: layers.push(createImageBitmap(canvas)) - 1, width: canvas.width, height: canvas.height };
  };

  const REFERENCE = /url\(\s*["']?#([^"')]+)["']?\s*\)/;
  const REFERRING = ['clip-path', 'filter', 'fill', 'stroke', 'mask-image'];

  const serialized = (el: Element): SvgNode => ({
    tag: el.tagName,
    attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])),
    children: [...el.children].map(serialized)
  });

  const defsOf = (nodes: RawNode[]): Record<string, SvgNode> => {
    const ids = new Set(nodes.flatMap((n) => REFERRING.map((k) => REFERENCE.exec(n.style[k as keyof RawNode['style']] ?? '')?.[1]).filter((id): id is string => Boolean(id))));
    return Object.fromEntries([...ids].flatMap((id) => {
      const el = document.getElementById(id);
      return el ? [[id, serialized(el)]] : [];
    }));
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
      nodes.push({ tag, svg: !(el instanceof HTMLElement), parent, at: null, size: [0, 0], style, attrs, text, lines: [], raster: null, layer });
      elements.push(el);
      const me = nodes.length - 1;
      for (const child of el.children) {
        visit(child, me);
      }
    };
    visit(root, cfg.none);
    const rects = untransformed(() => {
      const boxes = elements.map((el) => el.getBoundingClientRect());
      const web = webFamilies();
      elements.forEach((el, i) => {
        if (!(el instanceof HTMLElement) || !nodes[i].text) {
          return;
        }
        const computed = getComputedStyle(el);
        nodes[i].lines = linesOf(el, boxes[i]);
        nodes[i].raster = web.has(unquoted(computed.fontFamily.split(',')[0])) ? null : rasterOf(computed, nodes[i].lines, boxes[i], layers);
      });
      return boxes;
    });
    nodes.forEach((node, i) => {
      if (!boxed(elements[i])) {
        return;
      }
      const own = rects[i];
      const base = node.parent === cfg.none ? own : rects[node.parent];
      node.at = [own.left - base.left, own.top - base.top];
      node.size = [own.width, own.height];
    });
    return { width: rects[0]?.width ?? 0, height: rects[0]?.height ?? 0, nodes, defs: defsOf(nodes) };
  };

  addEventListener('message', (e: MessageEvent) => {
    const m = e.data as DomReadRequest;
    if (!m || m.type !== cfg.request) {
      return;
    }
    const source = e.source as Window | null;
    const w = window as unknown as { __timelines?: Record<string, Seekable>; __fontsReady?: Promise<unknown>; __hfWaitForSeekCompletion?: () => Promise<void>; __hf?: { buildReady?: Record<string, Promise<unknown>> }; __player?: { renderSeek?: (t: number, o: { exact: boolean }) => void } };
    const done = (body: Record<string, unknown>, transfer: Transferable[]) => source?.postMessage({ type: cfg.reply, id: m.id, time: m.time, ...body }, { targetOrigin: '*', transfer });
    Promise.resolve(w.__fontsReady)
      .then(() => document.fonts.ready)
      .then(() => Promise.all(Object.values(w.__hf?.buildReady ?? {})))
      .then(() => {
        const tl = w.__timelines?.[cfg.timeline];
        tl?.pause();
        if (w.__player?.renderSeek) {
          w.__player.renderSeek(m.time, { exact: true });
          return;
        }
        tl?.seek(m.time);
      })
      .then(() => w.__hfWaitForSeekCompletion?.())
      .then(frame)
      .then(async () => {
        const pending: Promise<ImageBitmap>[] = [];
        const trees = Object.fromEntries(
          m.clips.flatMap((clip) => {
            const root = document.getElementById(cfg.prefix + clip) ?? document.querySelector<HTMLElement>(`[data-clip="${CSS.escape(clip)}"]`);
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
  const cfg: ProbeConfig = { request: DOM_READ_REQUEST, reply: DOM_READ_REPLY, timeline: COMPOSITION_ID, prefix: CUSTOM_ROOT_PREFIX, none: NO_INDEX, pad: TEXT_PAD, styles: READ_STYLES, attrs: READ_ATTRS };
  return `<script>(${domProbe.toString()})(${js(cfg)});</script>`;
}
