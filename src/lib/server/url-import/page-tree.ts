import { MAX_SIDE } from '@feega/motion-core/motion/doc';
import type { RestNode } from '$lib/server/figma/rest-message';

export type TreeLimits = { nodes: number; height: number; text: number; samples: number };

export const TREE_LIMITS: TreeLimits = { nodes: 1_500, height: MAX_SIDE, text: 2_000, samples: 160 };

export type PageTree = { title: string; url: string; width: number; height: number; root: RestNode; truncated: boolean };

export function pageTreeOf(limits: TreeLimits): PageTree {
  const width = document.documentElement.clientWidth;
  const height = Math.min(limits.height, Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, window.innerHeight));
  let count = 0;
  let truncated = false;
  let ids = 0;
  const id = () => String(++ids);
  const round = (v: number) => Math.round(v * 10) / 10;
  const px = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const pixel = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const painted = new Map<string, string>();

  const asRgb = (value: string): string => {
    if (!pixel || /^rgba?\(/.test(value) || painted.has(value)) {
      return painted.get(value) ?? value;
    }
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = value;
    pixel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
    painted.set(value, `rgba(${r}, ${g}, ${b}, ${a / 255})`);
    return painted.get(value)!;
  };

  const colourOf = (raw: string): { r: number; g: number; b: number; a: number } | null => {
    const value = /\b(oklch|oklab|lab|lch|color|hwb|hsla?)\(/.test(raw) ? raw.replace(/\b(?:oklch|oklab|lab|lch|color|hwb|hsla?)\([^()]*(?:\([^()]*\)[^()]*)*\)/g, asRgb) : raw;
    const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
    if (!m) {
      return null;
    }
    const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
    if (alpha <= 0) {
      return null;
    }
    return { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255, a: alpha };
  };

  const solid = (value: string) => {
    const color = colourOf(value);
    return color ? [{ type: 'SOLID', color }] : [];
  };

  const box = (r: DOMRect) => ({ x: round(r.x + window.scrollX), y: round(r.y + window.scrollY), width: round(r.width), height: round(r.height) });

  const shown = (r: DOMRect) => r.width >= 1 && r.height >= 1 && r.right + window.scrollX > 0 && r.x + window.scrollX < width && r.y + window.scrollY < height && r.bottom + window.scrollY > 0;

  const hiddenCss = (css: CSSStyleDeclaration) => css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0 || css.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(css.clipPath);

  const take = () => {
    if (count >= limits.nodes) {
      truncated = true;
      return false;
    }
    count++;
    return true;
  };

  const backgroundsOf = (css: CSSStyleDeclaration) => {
    const paints: RestNode['fills'] = solid(css.backgroundColor);
    const tiled = !css.backgroundRepeat.startsWith('no-repeat');
    for (const m of tiled ? [] : css.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (/^https?:/.test(m[1])) {
        paints.push({ type: 'IMAGE', imageRef: m[1] });
      }
    }
    return paints;
  };

  const strokeOf = (css: CSSStyleDeclaration) => {
    const widths = [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth].map(px);
    const styles = [css.borderTopStyle, css.borderRightStyle, css.borderBottomStyle, css.borderLeftStyle];
    const colours = [css.borderTopColor, css.borderRightColor, css.borderBottomColor, css.borderLeftColor];
    const uniform = widths.every((w) => w === widths[0]) && styles.every((s) => s === styles[0]) && colours.every((c) => c === colours[0]);
    if (!uniform || widths[0] <= 0 || styles[0] === 'none' || styles[0] === 'hidden') {
      return {};
    }
    const strokes = solid(colours[0]);
    return strokes.length ? { strokes, strokeWeight: widths[0], strokeAlign: 'INSIDE' } : {};
  };

  const cornersOf = (css: CSSStyleDeclaration, r: DOMRect) => {
    const cap = Math.min(r.width, r.height) / 2;
    const radii = [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius].map((v) => Math.min(cap, v.endsWith('%') ? (parseFloat(v) / 100) * Math.min(r.width, r.height) : px(v)));
    if (radii.every((v) => v === 0)) {
      return {};
    }
    return radii.every((v) => v === radii[0]) ? { cornerRadius: radii[0] } : { rectangleCornerRadii: radii };
  };

  const shadowsOf = (css: CSSStyleDeclaration) => {
    if (!css.boxShadow || css.boxShadow === 'none') {
      return {};
    }
    const effects = css.boxShadow.split(/,(?![^(]*\))/).flatMap((part) => {
      const color = colourOf(part);
      const lengths = part.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g)?.map(px) ?? [];
      if (!color || lengths.length < 2) {
        return [];
      }
      return [{ type: part.includes('inset') ? 'INNER_SHADOW' : 'DROP_SHADOW', visible: true, color, offset: { x: lengths[0], y: lengths[1] }, radius: lengths[2] ?? 0, spread: lengths[3] ?? 0 }];
    });
    return effects.length ? { effects } : {};
  };

  const ALIGN: Record<string, string> = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', right: 'MAX', 'space-between': 'SPACE_BETWEEN', baseline: 'BASELINE' };
  const TEXT_ALIGN: Record<string, string> = { center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' };

  const flowOf = (css: CSSStyleDeclaration, r: DOMRect, kids: RestNode[]) => {
    if (!/flex/.test(css.display) || css.flexDirection.endsWith('reverse') || css.flexWrap === 'wrap-reverse') {
      return {};
    }
    const row = css.flexDirection.startsWith('row');
    const flowing = kids.filter((k) => k.layoutPositioning !== 'ABSOLUTE');
    const gap = px(row ? css.columnGap : css.rowGap);
    const primary = ALIGN[css.justifyContent] ?? 'MIN';
    const padding = { paddingTop: px(css.paddingTop) + px(css.borderTopWidth), paddingRight: px(css.paddingRight) + px(css.borderRightWidth), paddingBottom: px(css.paddingBottom) + px(css.borderBottomWidth), paddingLeft: px(css.paddingLeft) + px(css.borderLeftWidth) };
    const start = (k: RestNode) => (row ? k.absoluteBoundingBox!.x : k.absoluteBoundingBox!.y);
    const end = (k: RestNode) => start(k) + (row ? k.absoluteBoundingBox!.width : k.absoluteBoundingBox!.height);
    const wraps = css.flexWrap === 'wrap';
    const evenGaps = wraps || primary === 'SPACE_BETWEEN' || flowing.every((k, i) => i === 0 || Math.abs(start(k) - end(flowing[i - 1]) - gap) <= 1);
    const origin = row ? r.x + window.scrollX + padding.paddingLeft : r.y + window.scrollY + padding.paddingTop;
    const startsRight = primary !== 'MIN' || !flowing.length || Math.abs(start(flowing[0]) - origin) <= 1;
    if (!evenGaps || !startsRight) {
      return {};
    }
    return {
      layoutMode: row ? 'HORIZONTAL' : 'VERTICAL',
      layoutWrap: wraps ? 'WRAP' : undefined,
      itemSpacing: gap,
      counterAxisSpacing: wraps ? px(row ? css.rowGap : css.columnGap) : undefined,
      ...padding,
      primaryAxisAlignItems: primary,
      counterAxisAlignItems: ALIGN[css.alignItems] ?? 'MIN',
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'FIXED'
    };
  };

  const textOf = (node: Text, css: CSSStyleDeclaration): RestNode | null => {
    const raw = (node.textContent ?? '').replace(/\s+/g, ' ');
    if (!raw.trim()) {
      return null;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    const fills = solid(css.color);
    if (!shown(r) || !fills.length || !take()) {
      return null;
    }
    const characters = (css.textTransform === 'uppercase' ? raw.toUpperCase() : css.textTransform === 'lowercase' ? raw.toLowerCase() : raw).trim().slice(0, limits.text);
    const size = px(css.fontSize);
    const line = css.lineHeight === 'normal' ? size * 1.2 : px(css.lineHeight);
    return {
      id: id(),
      type: 'TEXT',
      name: characters.slice(0, 40),
      absoluteBoundingBox: { ...box(r), width: round(r.width + 1) },
      characters,
      ...(r.height > line * 1.5 ? { textAutoResize: 'HEIGHT' } : {}),
      fills,
      style: {
        fontFamily: css.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        fontWeight: Number(css.fontWeight) || 400,
        italic: css.fontStyle === 'italic',
        fontSize: size,
        textAlignHorizontal: TEXT_ALIGN[css.textAlign] ?? 'LEFT',
        letterSpacing: css.letterSpacing === 'normal' ? 0 : px(css.letterSpacing),
        ...(css.lineHeight === 'normal' ? {} : { lineHeightUnit: 'PIXELS', lineHeightPx: px(css.lineHeight) })
      }
    };
  };

  const vectorOf = (el: SVGSVGElement, r: DOMRect, css: CSSStyleDeclaration): RestNode | null => {
    const shapes = [...el.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon')] as SVGGeometryElement[];
    if (!shapes.length) {
      return null;
    }
    const children = shapes.flatMap((shape) => {
      const own = getComputedStyle(shape);
      const ctm = shape.getScreenCTM();
      const length = shape.getTotalLength?.() ?? 0;
      if (!ctm || !length || own.display === 'none') {
        return [];
      }
      const steps = Math.min(limits.samples, Math.max(8, Math.ceil(length / 1.5)));
      const map = DOMMatrix.fromMatrix(ctm);
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const p = shape.getPointAtLength((length * i) / steps);
        const screen = map.transformPoint(new DOMPoint(p.x, p.y));
        return `${round(screen.x - r.x)} ${round(screen.y - r.y)}`;
      });
      const fills = own.fill === 'none' ? [] : solid(own.fill === 'currentColor' ? css.color : own.fill);
      const strokes = own.stroke === 'none' ? [] : solid(own.stroke === 'currentColor' ? css.color : own.stroke);
      if ((!fills.length && !strokes.length) || !take()) {
        return [];
      }
      const path = `M ${points[0]} ${points.slice(1).map((p) => `L ${p}`).join(' ')}${fills.length ? ' Z' : ''}`;
      const node: RestNode = { id: id(), type: 'VECTOR', name: 'path', absoluteBoundingBox: box(r), fills, fillGeometry: [{ path, windingRule: own.fillRule === 'evenodd' ? 'EVENODD' : 'NONZERO' }] };
      return [strokes.length ? { ...node, strokes, strokeWeight: px(own.strokeWidth) * (map.a || 1), strokeAlign: 'CENTER' } : node];
    });
    return children.length ? { id: id(), type: 'GROUP', name: 'icon', absoluteBoundingBox: box(r), children } : null;
  };

  const walk = (el: Element): RestNode | null => {
    const css = getComputedStyle(el);
    if (hiddenCss(css)) {
      return null;
    }
    const r = el.getBoundingClientRect();
    if (el instanceof SVGSVGElement) {
      return shown(r) ? vectorOf(el, r, css) : null;
    }
    if (el instanceof HTMLImageElement) {
      const src = el.currentSrc || el.src;
      return shown(r) && /^https?:/.test(src) && take() ? { id: id(), type: 'RECTANGLE', name: el.alt || 'image', absoluteBoundingBox: box(r), fills: [{ type: 'IMAGE', imageRef: src }], ...cornersOf(css, r) } : null;
    }
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|IFRAME|VIDEO|CANVAS|HEAD|META|LINK)$/.test(el.tagName)) {
      return null;
    }
    const kids: RestNode[] = [];
    for (const child of el.childNodes) {
      const made = child.nodeType === Node.TEXT_NODE ? textOf(child as Text, css) : child.nodeType === Node.ELEMENT_NODE ? walk(child as Element) : null;
      if (made) {
        kids.push(made);
      }
    }
    const fills = backgroundsOf(css);
    const stroke = strokeOf(css);
    const effects = shadowsOf(css);
    const painted = fills.length > 0 || 'strokes' in stroke || 'effects' in effects;
    const positioned = css.position === 'absolute' || css.position === 'fixed';
    if (!painted && !/flex/.test(css.display)) {
      return kids.length === 1 ? kids[0] : kids.length ? { id: id(), type: 'GROUP', name: el.tagName.toLowerCase(), absoluteBoundingBox: box(r), children: kids } : null;
    }
    if (!shown(r) || !take()) {
      return kids.length ? { id: id(), type: 'GROUP', name: el.tagName.toLowerCase(), absoluteBoundingBox: box(r), children: kids } : null;
    }
    return {
      id: id(),
      type: 'FRAME',
      name: el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase(),
      absoluteBoundingBox: box(r),
      opacity: Number(css.opacity) < 1 ? Number(css.opacity) : undefined,
      fills,
      ...stroke,
      ...effects,
      ...cornersOf(css, r),
      clipsContent: /hidden|clip/.test(css.overflow),
      ...(positioned ? { layoutPositioning: 'ABSOLUTE' } : {}),
      ...flowOf(css, r, kids),
      children: kids
    };
  };

  const page = getComputedStyle(document.body);
  const ground = solid(page.backgroundColor).length ? solid(page.backgroundColor) : solid(getComputedStyle(document.documentElement).backgroundColor);
  const body = document.body ? walk(document.body) : null;
  const children = body ? (body.type === 'GROUP' ? (body.children ?? []) : [body]) : [];
  return {
    title: document.title.trim(),
    url: location.href,
    width,
    height,
    truncated,
    root: { id: id(), type: 'FRAME', name: document.title.trim() || location.hostname, absoluteBoundingBox: { x: 0, y: 0, width, height }, fills: ground.length ? ground : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], clipsContent: true, children }
  };
}
