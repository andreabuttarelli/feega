import { RAW_CAPTURE, VectorHint, VectorKind, vectorUi, type RawCapture, type VectorUi } from '$lib/motion/vector-ui/model';
import type { OpenAppBrowser } from './browser';

export type CaptureLimits = { max: number; text: number; svg: number };

export const CAPTURE_LIMITS: CaptureLimits = { max: 3_000, text: 300, svg: 6_000 };

const SETTLE_MS = 1_500;

export function captureOf(limits: CaptureLimits): RawCapture {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const nodes: RawCapture['nodes'] = [];
  const opacity = new Map<Element, number>();
  const clips = new Map<Element, DOMRect | null>();
  const round = (v: number) => Math.round(v * 10) / 10;
  const visibleColour = (c: string) => Boolean(c) && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c) && !/\/\s*0\)$/.test(c);
  const effective = (el: Element | null): number => {
    if (!el) {
      return 1;
    }
    const known = opacity.get(el);
    if (known !== undefined) {
      return known;
    }
    const own = Number(getComputedStyle(el).opacity);
    const value = (Number.isFinite(own) ? own : 1) * effective(el.parentElement);
    opacity.set(el, value);
    return value;
  };
  const clipOf = (el: Element | null): DOMRect | null => {
    if (!el || el === document.body || el === document.documentElement) {
      return null;
    }
    if (clips.has(el)) {
      return clips.get(el) ?? null;
    }
    const css = getComputedStyle(el);
    const parent = clipOf(el.parentElement);
    const clipping = /hidden|clip/.test(css.overflow + css.overflowX + css.overflowY);
    const own = clipping ? el.getBoundingClientRect() : null;
    const value = own && parent ? new DOMRect(Math.max(own.x, parent.x), Math.max(own.y, parent.y), Math.max(0, Math.min(own.right, parent.right) - Math.max(own.x, parent.x)), Math.max(0, Math.min(own.bottom, parent.bottom) - Math.max(own.y, parent.y))) : (own ?? parent);
    clips.set(el, value);
    return value;
  };
  const shown = (el: Element, rect: DOMRect) => {
    const clip = clipOf(el.parentElement);
    const visible = rect.width >= 1 && rect.height >= 1 && rect.right > 0 && rect.bottom > 0 && rect.x < W && rect.y < H;
    return visible && (!clip || (rect.right > clip.x && rect.x < clip.right && rect.bottom > clip.y && rect.y < clip.bottom));
  };
  const hintOf = (el: Element) => {
    if (el.closest('button, [role=button], input[type=submit], input[type=button]')) {
      return 'button';
    }
    if (el.closest('input, textarea, select, [contenteditable=true]')) {
      return 'input';
    }
    if (el.closest('h1, h2, h3')) {
      return 'heading';
    }
    if (el.closest('nav')) {
      return 'nav';
    }
    return el.closest('a') ? 'link' : 'none';
  };
  const textCase = (text: string, transform: string) => (transform === 'uppercase' ? text.toUpperCase() : transform === 'lowercase' ? text.toLowerCase() : text);
  const px = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const side = (w: string, s: string, c: string) => (parseFloat(w) > 0 && s !== 'none' && s !== 'hidden' && visibleColour(c) ? `${w} ${s} ${c}` : '');
  const pushText = (el: Element, text: string, rect: DOMRect, lines: number, css: CSSStyleDeclaration, o: number) => {
    const gradient = css.webkitTextFillColor === 'rgba(0, 0, 0, 0)' && css.backgroundImage.includes('gradient');
    nodes.push({
      kind: 'text' as never,
      hint: hintOf(el) as never,
      x: round(rect.x),
      y: round(rect.y),
      w: round(rect.width),
      h: round(rect.height),
      o: round(o),
      text: textCase(text, css.textTransform).slice(0, limits.text),
      color: gradient ? undefined : css.color,
      fill: gradient ? css.backgroundImage : undefined,
      font: css.fontFamily.slice(0, 120),
      size: px(css.fontSize),
      weight: Number(css.fontWeight) || 400,
      ls: css.letterSpacing === 'normal' ? undefined : px(css.letterSpacing),
      lh: css.lineHeight === 'normal' ? undefined : px(css.lineHeight),
      wrap: lines > 1,
      italic: css.fontStyle === 'italic' || undefined
    });
  };
  const svgMarkup = (el: SVGElement, colour: string) => {
    const copy = el.cloneNode(true) as SVGElement;
    copy.querySelectorAll('script, foreignObject, image, a').forEach((n) => n.remove());
    for (const n of [copy, ...copy.querySelectorAll('*')]) {
      for (const attr of [...n.attributes]) {
        if (/^on/i.test(attr.name) || ((attr.name === 'href' || attr.name === 'xlink:href') && !attr.value.startsWith('#'))) {
          n.removeAttribute(attr.name);
        }
      }
    }
    copy.removeAttribute('class');
    copy.setAttribute('width', '100%');
    copy.setAttribute('height', '100%');
    copy.style.cssText = `color:${colour};display:block`;
    const markup = copy.outerHTML;
    return markup.length <= limits.svg ? markup : undefined;
  };
  const linesOf = (node: Text) => {
    const raw = node.textContent ?? '';
    const range = document.createRange();
    const lines: { text: string; rect: DOMRect }[] = [];
    const words = [...raw.matchAll(/\S+/g)];
    for (const word of words) {
      range.setStart(node, word.index ?? 0);
      range.setEnd(node, (word.index ?? 0) + word[0].length);
      const rect = range.getBoundingClientRect();
      const last = lines.at(-1);
      if (last && Math.abs(last.rect.top - rect.top) < rect.height / 2) {
        const right = Math.max(last.rect.right, rect.right);
        last.rect = new DOMRect(last.rect.x, Math.min(last.rect.y, rect.y), right - last.rect.x, Math.max(last.rect.height, rect.height));
        last.text += ' ' + word[0];
        continue;
      }
      lines.push({ text: word[0], rect });
    }
    return lines;
  };
  const concealed = (css: CSSStyleDeclaration) => css.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(css.clipPath) || (css.position === 'absolute' && parseFloat(css.width) <= 1 && parseFloat(css.height) <= 1);
  const walk = (el: Element) => {
    if (nodes.length >= limits.max) {
      return;
    }
    const css = getComputedStyle(el);
    if (css.display === 'none' || concealed(css)) {
      return;
    }
    const o = effective(el);
    if (o < 0.02) {
      return;
    }
    const painted = css.visibility !== 'hidden';
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    if (tag === 'svg') {
      if (painted && shown(el, rect)) {
        const svg = svgMarkup(el as SVGElement, css.color);
        nodes.push({ kind: (svg ? 'icon' : 'image') as never, hint: hintOf(el) as never, x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height), o: round(o), svg });
      }
      return;
    }
    if (tag === 'img' || tag === 'video' || tag === 'canvas' || tag === 'picture') {
      if (painted && shown(el, rect)) {
        nodes.push({ kind: 'image' as never, hint: hintOf(el) as never, x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height), o: round(o), r: css.borderRadius, src: (el as HTMLImageElement).currentSrc || undefined });
      }
      return;
    }
    if (painted && shown(el, rect) && el !== document.documentElement) {
      const sides = [side(css.borderTopWidth, css.borderTopStyle, css.borderTopColor), side(css.borderRightWidth, css.borderRightStyle, css.borderRightColor), side(css.borderBottomWidth, css.borderBottomStyle, css.borderBottomColor), side(css.borderLeftWidth, css.borderLeftStyle, css.borderLeftColor)];
      const image = css.backgroundImage;
      const gradient = image.includes('gradient') && !image.includes('url(');
      const masked = css.maskImage && css.maskImage !== 'none';
      const fill = masked ? undefined : gradient ? image : visibleColour(css.backgroundColor) ? css.backgroundColor : undefined;
      const shadow = css.boxShadow !== 'none' ? css.boxShadow : undefined;
      const blur = /blur\(([\d.]+)px\)/.exec(css.backdropFilter || '')?.[1];
      const textless = !(css.webkitTextFillColor === 'rgba(0, 0, 0, 0)' && gradient);
      if (textless && (fill || sides.some(Boolean) || shadow || blur)) {
        const same = sides.every((s) => s === sides[0]);
        nodes.push({ kind: 'box' as never, hint: hintOf(el) as never, x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height), o: round(o), fill, stroke: same && sides[0] ? sides[0] : undefined, sides: !same ? sides : undefined, r: css.borderRadius !== '0px' ? css.borderRadius : undefined, shadow, blur: blur ? Number(blur) : undefined });
      }
      if (image.includes('url(')) {
        nodes.push({ kind: 'image' as never, hint: hintOf(el) as never, x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height), o: round(o), r: css.borderRadius });
      }
      if (tag === 'input' || tag === 'textarea') {
        const field = el as HTMLInputElement;
        const value = field.value || field.placeholder;
        if (value && field.type !== 'password' && field.type !== 'hidden') {
          const inner = new DOMRect(rect.x + (px(css.paddingLeft) ?? 0), rect.y, Math.max(1, rect.width - (px(css.paddingLeft) ?? 0) - (px(css.paddingRight) ?? 0)), rect.height);
          pushText(el, value, inner, 1, field.value ? css : getComputedStyle(el, '::placeholder'), o);
        }
      }
    }
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!text) {
          continue;
        }
        if (!painted) {
          continue;
        }
        for (const line of linesOf(child as Text)) {
          if (shown(el, line.rect)) {
            pushText(el, line.text, line.rect, 1, css, o);
          }
        }
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child as Element);
      }
    }
  };
  const background = [document.body, document.documentElement].map((e) => getComputedStyle(e).backgroundColor).find(visibleColour) ?? 'rgb(255, 255, 255)';
  walk(document.body);
  return { url: location.href, title: document.title, width: W, height: H, background, nodes };
}

export type FrameBox = { x: number; y: number; width: number; height: number };

export function framedNodes(inner: RawCapture, box: FrameBox): RawCapture['nodes'] {
  const backdrop = { kind: VectorKind.Box, hint: VectorHint.None, x: box.x, y: box.y, w: box.width, h: box.height, fill: inner.background };
  return [backdrop, ...inner.nodes.map((n) => ({ ...n, x: n.x + box.x, y: n.y + box.y }))];
}

export type UiCapture = (url: string) => Promise<{ ok: true; ui: VectorUi } | { ok: false; error: string }>;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function vectorCapture(open: OpenAppBrowser, settleMs = SETTLE_MS): UiCapture {
  return async (url) => {
    const tab = await open();
    try {
      const status = await tab.goto(url);
      if (status !== null && status >= 400) {
        return { ok: false, error: `${url} answered ${status}` };
      }
      await pause(settleMs);
      const parsed = RAW_CAPTURE.safeParse(await tab.vector());
      if (!parsed.success) {
        return { ok: false, error: `the page could not be read as vector UI: ${parsed.error.issues[0]?.message ?? 'unknown shape'}` };
      }
      return { ok: true, ui: vectorUi(parsed.data) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      await tab.close();
    }
  };
}
