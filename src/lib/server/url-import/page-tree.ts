import { DESIGN_MAX_SIDE } from '@feega/motion-core/motion/doc';
import type { RestNode, RestPaint } from '$lib/server/figma/rest-message';
import { pageKit, type KitMatrix, type KitRect, type PageKit } from './page-kit';

export enum SnapMode {
  Isolated = 'isolated',
  Own = 'own',
  Backdrop = 'backdrop'
}

export type TreeLimits = { nodes: number; height: number; text: number; snaps: number; useAttr: string; snapAttr: string; hostAttr: string; hideAttr: string };

const PAGE_SLICES = 4;

export const TREE_LIMITS: TreeLimits = { nodes: 10_000, height: DESIGN_MAX_SIDE * PAGE_SLICES, text: 4_000, snaps: 48, useAttr: 'data-feega-use', snapAttr: 'data-feega-snap', hostAttr: 'data-feega-host', hideAttr: 'data-feega-hide' };

export const SNAP_REF = 'snap:';

export type PageBox = { x: number; y: number; width: number; height: number };
export type PageFont = { family: string; weight: string; style: string; url: string };
export type PageSnap = { ref: string; box: PageBox; mode: SnapMode };

export type PageTree = { title: string; url: string; width: number; height: number; root: RestNode; truncated: boolean; fonts?: PageFont[]; snaps?: PageSnap[] };

export type FontSheets = Record<string, string>;

const FONT_FACE = /@font-face\s*{[^}]*}/g;

export const fontFacesIn = (css: string) => (css.match(FONT_FACE) ?? []).join('\n');

export const treeScript = (limits: TreeLimits, sheets: FontSheets = {}) => `var __name = (f) => f; (${pageTreeOf.toString()})(${JSON.stringify(limits)}, (${pageKit.toString()})(), ${JSON.stringify(sheets)})`;

export async function pageTreeOf(limits: TreeLimits, kit: PageKit, sheets: FontSheets = {}): Promise<PageTree> {
  const SKIPPED = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|HEAD|META|LINK|TITLE|BR|WBR|DIALOG)$/;
  const RASTER = /^(VIDEO|CANVAS|IFRAME|EMBED|OBJECT)$/;
  const REPLACED = /^(IMG|SVG|VIDEO|CANVAS|IFRAME|EMBED|OBJECT|INPUT|SELECT|TEXTAREA|BUTTON|PICTURE)$/;
  const SVG_SKIP = /^(defs|clipPath|mask|symbol|pattern|marker|linearGradient|radialGradient|title|desc|metadata|style|script|filter|foreignObject)$/;
  const SVG_RASTER = 'mask, filter, pattern, image, foreignObject, textPath, feImage';
  const SHAPES = /^(path|rect|circle|ellipse|line|polyline|polygon)$/;
  const FIELDS = /^(text|email|search|url|tel|number|password|)$/;
  const TEXT_ALIGN: Record<string, string> = { center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' };
  const ALIGN: Record<string, string> = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', right: 'MAX', 'space-between': 'SPACE_BETWEEN' };
  const FIT: Record<string, string> = { cover: 'FILL', contain: 'FIT', fill: 'STRETCH', 'scale-down': 'FIT', none: 'FIT' };
  const PRE = /^(pre|pre-wrap|break-spaces)$/;
  const EXACT = 0.5;
  const LINE_SLACK = 1;
  const MOSTLY_SEEN = 0.5;
  const LIFTED = 1.5;
  const DRAWN_ALL = 0.99;

  const width = document.documentElement.clientWidth;
  const full = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, window.innerHeight);
  const height = Math.min(limits.height, full);
  let count = 0;
  let truncated = false;
  let ids = 0;
  const id = () => String(++ids);
  const round = (v: number) => Math.round(v * 10) / 10;
  const px = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const take = () => {
    if (count >= limits.nodes) {
      truncated = true;
      return false;
    }
    count++;
    return true;
  };

  const pixel = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const painted = new Map<string, string>();
  const asRgb = (value: string): string => {
    if (!pixel || /^rgba?\(/.test(value) || painted.has(value)) {
      return painted.get(value) ?? value;
    }
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = '#000';
    pixel.fillStyle = value;
    pixel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
    painted.set(value, `rgba(${r}, ${g}, ${b}, ${a / 255})`);
    return painted.get(value)!;
  };
  const rgbaOf = (raw: string): { r: number; g: number; b: number; a: number } | null => {
    const word = raw.trim();
    if (word === 'transparent') {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const value = /^(#|[a-z]+$)/i.test(word) ? asRgb(word) : /\b(oklch|oklab|lab|lch|color|hwb|hsla?|color-mix)\(/.test(word) ? word.replace(/\b(?:oklch|oklab|lab|lch|color|hwb|hsla?|color-mix)\([^()]*(?:\([^()]*\)[^()]*)*\)/g, asRgb) : word;
    const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
    if (!m) {
      return null;
    }
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
    return { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255, a };
  };
  const colourOf = (raw: string) => {
    const c = rgbaOf(raw);
    return c && c.a > 0 ? c : null;
  };
  const solid = (value: string, alpha = 1): RestPaint[] => {
    const color = colourOf(value);
    return color ? [{ type: 'SOLID', color: { ...color, a: color.a * alpha } }] : [];
  };

  type Rect = { x: number; y: number; width: number; height: number };
  const pageRect = (r: { left: number; top: number; width: number; height: number }): Rect => ({ x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height });
  const box = (r: Rect) => {
    const top = Math.max(r.y, 0);
    const bottom = Math.min(r.y + r.height, height);
    return { x: round(r.x), y: round(top), width: round(r.width), height: round(Math.max(0, bottom - top)) };
  };
  const overlap = (a: Rect, b: Rect) => Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
  const meet = (a: Rect, b: Rect): Rect => {
    const [x, y] = [Math.max(a.x, b.x), Math.max(a.y, b.y)];
    return { x, y, width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x), height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) };
  };
  const PAGE: Rect = { x: 0, y: 0, width, height };
  const shown = (r: Rect, clip: Rect) => r.width >= 1 && r.height >= 1 && overlap(r, clip);
  const extentOf = (n: RestNode, clipped = true): Rect => {
    const own = n.absoluteBoundingBox!;
    if ((clipped && n.clipsContent) || !n.children?.length) {
      return own;
    }
    return n.children.map((c) => extentOf(c, clipped)).reduce((a, b) => {
      const [x, y] = [Math.min(a.x, b.x), Math.min(a.y, b.y)];
      return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
    }, own);
  };

  const zOf = new WeakMap<RestNode, number>();
  const fixedNodes = new WeakSet<RestNode>();
  const keyed = (node: RestNode, z: number) => {
    zOf.set(node, z);
    return node;
  };

  type Ctx = { clip: Rect; scale: number; textFills: RestPaint[] | null; visible: boolean };

  const snaps: { ref: string; box: Rect; mode: string }[] = [];
  const snapOf = (el: Element, r: Rect, mode: string, ctx: Ctx, name: string): RestNode | null => {
    if (snaps.length >= limits.snaps || !shown(r, ctx.clip) || !take()) {
      return null;
    }
    const ref = String(snaps.length + 1);
    el.setAttribute(limits.snapAttr, ref);
    const seen = meet(r, ctx.clip);
    snaps.push({ ref, box: { x: round(seen.x), y: round(seen.y), width: round(seen.width), height: round(seen.height) }, mode });
    return { id: id(), type: 'RECTANGLE', name, absoluteBoundingBox: box(seen), fills: [{ type: 'IMAGE', imageRef: `snap:${ref}`, scaleMode: 'STRETCH' }] };
  };

  const matrixOf = (transform: string): KitMatrix | null => {
    const m = transform.match(/^matrix\(([^)]+)\)$/);
    if (!m) {
      return null;
    }
    const v = m[1].split(',').map(Number);
    return [v[0], v[1], v[2], v[3], v[4], v[5]];
  };
  const turned = (css: CSSStyleDeclaration) => {
    if (css.transform === 'none') {
      return false;
    }
    const m = matrixOf(css.transform);
    return !m || Math.abs(m[1]) > 1e-3 || Math.abs(m[2]) > 1e-3;
  };
  const scaleOf = (css: CSSStyleDeclaration) => {
    const m = matrixOf(css.transform);
    return m ? Math.hypot(m[0], m[1]) : 1;
  };

  const zApplies = (el: Element, css: CSSStyleDeclaration) => css.position !== 'static' || /flex|grid/.test(el.parentElement ? getComputedStyle(el.parentElement).display : '');
  const stacks = (el: Element, css: CSSStyleDeclaration) => (zApplies(el, css) && css.zIndex !== 'auto') || Number(css.opacity) < 1 || css.transform !== 'none' || css.filter !== 'none' || css.position === 'fixed' || css.position === 'sticky' || css.isolation === 'isolate' || css.mixBlendMode !== 'normal';
  const layerOf = (el: Element, css: CSSStyleDeclaration) => {
    const applies = zApplies(el, css);
    const z = applies ? parseInt(css.zIndex, 10) : NaN;
    if (Number.isFinite(z) && z < 0) {
      return z;
    }
    const lifted = css.position !== 'static' || stacks(el, css);
    return lifted ? (Number.isFinite(z) ? z : 0) + 0.5 : 0;
  };
  const sorted = (kids: RestNode[]) => kids.map((k, i) => ({ k, i, z: zOf.get(k) ?? 0 })).sort((a, b) => a.z - b.z || a.i - b.i).map((e) => e.k);

  const SIMPLE_FILTER = /^blur\(([\d.]+)px\)$/;
  const effectsOf = (css: CSSStyleDeclaration): RestNode['effects'] => {
    const effects: NonNullable<RestNode['effects']> = [];
    if (css.boxShadow && css.boxShadow !== 'none') {
      for (const part of kit.splitTop(css.boxShadow, ',')) {
        const color = colourOf(part.match(/(?:[a-z-]+\([^()]*(?:\([^()]*\)[^()]*)*\)|#[\da-f]+|\b(?:transparent|black|white|currentcolor)\b)/i)?.[0] ?? '');
        const lengths = part.replace(/[a-z-]+\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, '').match(/-?[\d.]+px/g)?.map(px) ?? [];
        if (!color || lengths.length < 2) {
          continue;
        }
        effects.push({ type: /\binset\b/.test(part) ? 'INNER_SHADOW' : 'DROP_SHADOW', visible: true, color, offset: { x: lengths[0], y: lengths[1] }, radius: lengths[2] ?? 0, spread: lengths[3] ?? 0 });
      }
    }
    const blur = css.filter.match(SIMPLE_FILTER);
    if (blur) {
      effects.push({ type: 'FOREGROUND_BLUR', visible: true, radius: px(blur[1]) * 2 });
    }
    const behind = (css.backdropFilter || '').match(/blur\(([\d.]+)px\)/);
    if (behind) {
      effects.push({ type: 'BACKGROUND_BLUR', visible: true, radius: px(behind[1]) * 2 });
    }
    return effects.length ? effects : undefined;
  };

  const cornersOf = (css: CSSStyleDeclaration, r: Rect) => {
    const cap = Math.min(r.width, r.height) / 2;
    const radii = [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius].map((v) => Math.min(cap, v.endsWith('%') ? (parseFloat(v) / 100) * Math.min(r.width, r.height) : px(v)));
    if (radii.every((v) => v === 0)) {
      return {};
    }
    return radii.every((v) => v === radii[0]) ? { cornerRadius: radii[0] } : { rectangleCornerRadii: radii };
  };

  const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;
  const bordersOf = (css: CSSStyleDeclaration, r: Rect): { strokes?: RestPaint[]; strokeWeight?: number; strokeAlign?: string; sides: RestNode[] } => {
    const drawn = SIDES.map((s) => ({ side: s, width: px(css.getPropertyValue(`border-${s.toLowerCase()}-width`)), style: css.getPropertyValue(`border-${s.toLowerCase()}-style`), color: css.getPropertyValue(`border-${s.toLowerCase()}-color`) })).filter((b) => b.width > 0 && b.style !== 'none' && b.style !== 'hidden' && colourOf(b.color));
    if (!drawn.length) {
      return { sides: [] };
    }
    const uniform = drawn.length === 4 && drawn.every((b) => b.width === drawn[0].width && b.color === drawn[0].color);
    if (uniform) {
      return { strokes: solid(drawn[0].color), strokeWeight: drawn[0].width, strokeAlign: 'INSIDE', sides: [] };
    }
    const RECT: Record<string, (w: number) => Rect> = {
      Top: (w) => ({ x: r.x, y: r.y, width: r.width, height: w }),
      Bottom: (w) => ({ x: r.x, y: r.y + r.height - w, width: r.width, height: w }),
      Left: (w) => ({ x: r.x, y: r.y, width: w, height: r.height }),
      Right: (w) => ({ x: r.x + r.width - w, y: r.y, width: w, height: r.height })
    };
    const sides = drawn.flatMap((b) => (take() ? [{ id: id(), type: 'RECTANGLE', name: `border ${b.side.toLowerCase()}`, absoluteBoundingBox: box(RECT[b.side](b.width)), fills: solid(b.color), layoutPositioning: 'ABSOLUTE' }] : []));
    return { sides };
  };

  const outlineOf = (css: CSSStyleDeclaration, r: Rect): RestNode[] => {
    const w = px(css.outlineWidth);
    if (!w || css.outlineStyle === 'none' || !colourOf(css.outlineColor) || !take()) {
      return [];
    }
    const off = px(css.outlineOffset) + w / 2;
    return [{ id: id(), type: 'RECTANGLE', name: 'outline', absoluteBoundingBox: box({ x: r.x - off, y: r.y - off, width: r.width + off * 2, height: r.height + off * 2 }), strokes: solid(css.outlineColor), strokeWeight: w, strokeAlign: 'CENTER', layoutPositioning: 'ABSOLUTE' }];
  };

  const natural = new Map<string, { w: number; h: number }>();
  const urlsIn = (value: string) => [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => new URL(m[1], document.baseURI).href);

  const focusOf = (position: string, boxW: number, boxH: number, drawnW: number, drawnH: number) => {
    const [x = '50%', y = '50%'] = kit.splitTop(position, ' ');
    const axis = (v: string, span: number) => {
      if (v.endsWith('%')) {
        return Math.min(1, Math.max(0, parseFloat(v) / 100));
      }
      return span ? Math.min(1, Math.max(0, px(v) / span)) : 0.5;
    };
    return { x: axis(x, boxW - drawnW), y: axis(y, boxH - drawnH) };
  };

  type Painted = { fills: RestPaint[]; under: RestNode[]; own: boolean };

  const backgroundOf = (css: CSSStyleDeclaration, r: Rect, ctx: Ctx): Painted => {
    const fills: RestPaint[] = solid(css.backgroundColor);
    const under: RestNode[] = [];
    let own = false;
    const layers = css.backgroundImage === 'none' ? [] : kit.splitTop(css.backgroundImage, ',');
    const sizes = kit.splitTop(css.backgroundSize, ',');
    const positions = kit.splitTop(css.backgroundPosition, ',');
    const repeats = kit.splitTop(css.backgroundRepeat, ',');
    const at = <T,>(list: T[], i: number) => list[i % list.length];
    const above: RestPaint[] = [];
    layers.forEach((layer, i) => {
      const size = at(sizes, i) ?? 'auto';
      const repeat = at(repeats, i) ?? 'repeat';
      const position = at(positions, i) ?? '0% 0%';
      if (/gradient\(/.test(layer)) {
        const whole = /^(auto|auto auto|100% 100%|cover|contain)$/.test(size) || repeat.startsWith('no-repeat');
        const paint = whole ? kit.gradientOf(layer, r.width, r.height, rgbaOf) : null;
        if (paint) {
          above.push(paint as RestPaint);
          return;
        }
        own = true;
        return;
      }
      const [src] = urlsIn(layer);
      if (!src || !/^(https?|data):/.test(src)) {
        return;
      }
      const single = repeat.startsWith('no-repeat') || size === 'cover';
      if (!single) {
        own = true;
        return;
      }
      if (size === 'cover' || size === 'contain') {
        const n = natural.get(src);
        const k = n ? (size === 'cover' ? Math.max(r.width / n.w, r.height / n.h) : Math.min(r.width / n.w, r.height / n.h)) : 1;
        above.push({ type: 'IMAGE', imageRef: src, scaleMode: FIT[size], imageFocus: n ? focusOf(position, r.width, r.height, n.w * k, n.h * k) : { x: 0.5, y: 0.5 } });
        return;
      }
      const n = natural.get(src);
      if (!n) {
        return;
      }
      const [sw = 'auto', sh = 'auto'] = kit.splitTop(size, ' ');
      const lengthOf = (v: string, span: number) => (v.endsWith('%') ? (parseFloat(v) / 100) * span : px(v));
      const w = sw === 'auto' ? (sh === 'auto' ? n.w : (lengthOf(sh, r.height) * n.w) / n.h) : lengthOf(sw, r.width);
      const h = sh === 'auto' ? (w * n.h) / n.w : lengthOf(sh, r.height);
      const [fx, fy] = kit.splitTop(position, ' ');
      const offset = (v: string | undefined, span: number, drawn: number) => (!v ? (span - drawn) / 2 : v.endsWith('%') ? ((span - drawn) * parseFloat(v)) / 100 : px(v));
      const drawnRect = { x: r.x + offset(fx, r.width, w), y: r.y + offset(fy, r.height, h), width: w, height: h };
      const seen = meet(drawnRect, ctx.clip);
      if (seen.width >= 1 && seen.height >= 1 && take()) {
        under.unshift({ id: id(), type: 'RECTANGLE', name: 'background', absoluteBoundingBox: box(drawnRect), fills: [{ type: 'IMAGE', imageRef: src, scaleMode: 'STRETCH' }], layoutPositioning: 'ABSOLUTE' });
      }
    });
    return { fills: [...fills, ...above.reverse()], under, own };
  };

  const loadedFamilies = new Set<string>();
  const declaredFamilies = new Set<string>();
  document.fonts.forEach((f) => {
    if (f.status === 'loaded') {
      loadedFamilies.add(f.family.replace(/["']/g, '').trim().toLowerCase());
    }
  });
  const familyOf = (stack: string) => {
    const names = stack.split(',').map((f) => f.replace(/["']/g, '').trim()).filter(Boolean);
    return names.find((n) => loadedFamilies.has(n.toLowerCase()) || declaredFamilies.has(n.toLowerCase())) ?? names.join(', ');
  };

  const quadOf = (raw: string) => [...raw.matchAll(/["']([A-Za-z0-9]{4})["']\s*(-?[\d.]+|on|off)?/g)];
  const tuning = (css: CSSStyleDeclaration, size: number) => {
    const axes = quadOf(css.fontVariationSettings === 'normal' ? '' : css.fontVariationSettings)
      .filter(([, tag]) => tag !== 'wght')
      .map(([, tag, v]) => `'${tag}' ${Number(v ?? 0)}`);
    const optical = css.fontOpticalSizing !== 'none' && !axes.some((a) => a.startsWith("'opsz'")) ? [`'opsz' ${round(size)}`] : [];
    const features = quadOf(css.fontFeatureSettings === 'normal' ? '' : css.fontFeatureSettings).map(([, tag, v]) => `'${tag}' ${v === undefined || v === 'on' ? 1 : v === 'off' ? 0 : Number(v) ? 1 : 0}`);
    return { ...(axes.length || optical.length ? { fontAxes: [...axes, ...optical].join(', ') } : {}), ...(features.length ? { fontFeatures: features.join(', ') } : {}) };
  };

  const caseOf = (text: string, transform: string) => {
    if (transform === 'uppercase') {
      return text.toUpperCase();
    }
    if (transform === 'lowercase') {
      return text.toLowerCase();
    }
    if (transform === 'capitalize') {
      return text.replace(/(^|\s)(\S)/g, (_, s: string, c: string) => s + c.toUpperCase());
    }
    return text;
  };

  type Seg = { node: Text | null; css: CSSStyleDeclaration; fills: RestPaint[] | null; br: boolean; lead?: number; trail?: number };
  type Char = { c: string; seg: number; node: Text | null; at: number; extra?: number };

  const styleOf = (seg: Seg, scale: number) => ({
    fontFamily: familyOf(seg.css.fontFamily),
    fontWeight: Number(seg.css.fontWeight) || 400,
    italic: seg.css.fontStyle === 'italic' || seg.css.fontStyle.startsWith('oblique'),
    fontSize: round(px(seg.css.fontSize) * scale)
  });
  const segFills = (seg: Seg) => {
    if (seg.fills) {
      return seg.fills;
    }
    const fill = seg.css.webkitTextFillColor && seg.css.webkitTextFillColor !== seg.css.color ? seg.css.webkitTextFillColor : seg.css.color;
    return solid(fill);
  };

  const charsOf = (segs: Seg[]): Char[] => {
    const out: Char[] = [];
    const widen = (ch: Char | undefined, by = 0) => {
      if (ch && by) {
        ch.extra = (ch.extra ?? 0) + by;
      }
    };
    segs.forEach((seg, s) => {
      if (seg.br) {
        out.push({ c: '\n', seg: s, node: null, at: 0 });
        return;
      }
      widen(out[out.length - 1], seg.lead);
      const raw = seg.node!.data;
      const space = seg.css.whiteSpace;
      const keepAll = PRE.test(space);
      const keepBreaks = keepAll || space === 'pre-line';
      const cased = caseOf(raw, seg.css.textTransform);
      for (let i = 0; i < raw.length; i++) {
        const c = cased[i] ?? raw[i];
        if (keepAll || !/\s/.test(c) || (keepBreaks && c === '\n')) {
          out.push({ c: c === '\t' ? ' ' : c, seg: s, node: seg.node, at: i });
          continue;
        }
        const prev = out[out.length - 1];
        if (!prev || prev.c === ' ' || prev.c === '\n') {
          continue;
        }
        out.push({ c: ' ', seg: s, node: seg.node, at: i });
      }
      widen(out[out.length - 1], seg.trail);
    });
    while (out.length && out[out.length - 1].c === ' ') {
      out.pop();
    }
    return out;
  };

  const rectsOf = (node: Text, from = 0, to = node.data.length): KitRect[] => {
    const range = document.createRange();
    range.setStart(node, from);
    range.setEnd(node, to);
    return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map((r) => ({ left: r.left + window.scrollX, top: r.top + window.scrollY, right: r.right + window.scrollX, bottom: r.bottom + window.scrollY }));
  };

  const SPACE_EM = 0.2;
  const lineAt = (ch: Char, lines: KitRect[]) => {
    const rect = ch.node ? rectsOf(ch.node, ch.at, ch.at + 1)[0] : null;
    return rect ? lines.findIndex((l) => Math.min(l.bottom, rect.bottom) - Math.max(l.top, rect.top) > 0) : -1;
  };
  const firstOn = (chars: Char[], lines: KitRect[], line: number) => {
    let [lo, hi] = [0, chars.length];
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      let probe = mid;
      while (probe < hi && (!chars[probe].node || !chars[probe].c.trim())) {
        probe++;
      }
      const at = probe < hi ? lineAt(chars[probe], lines) : lines.length;
      if (at >= line || at < 0) {
        hi = mid;
      } else {
        lo = probe + 1;
      }
    }
    while (lo < chars.length && !chars[lo].c.trim()) {
      lo++;
    }
    return lo;
  };
  const wordWidth = (chars: Char[], from: number) => {
    let to = from;
    while (to < chars.length && chars[to].c.trim() && chars[to].node === chars[from].node) {
      to++;
    }
    const node = chars[from]?.node;
    const rects = node && to > from ? rectsOf(node, chars[from].at, chars[to - 1].at + 1) : [];
    return rects.length ? Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)) : 0;
  };
  const roomOf = (chars: Char[], lines: KitRect[], fontSize: number) => {
    if (chars.some((c) => c.c === '\n')) {
      return LINE_SLACK;
    }
    const left = Math.min(...lines.map((l) => l.left));
    const widest = Math.max(...lines.map((l) => l.right)) - left;
    let limit = Infinity;
    for (let i = 1; i < lines.length; i++) {
      const word = wordWidth(chars, firstOn(chars, lines, i));
      limit = Math.min(limit, lines[i - 1].right - left + SPACE_EM * fontSize + word);
    }
    return Number.isFinite(limit) && limit - widest > 2 * LINE_SLACK ? (limit - widest) / 2 : LINE_SLACK;
  };

  const textNode = (chars: Char[], segs: Seg[], lines: KitRect[], ctx: Ctx, align: string): RestNode | null => {
    const characters = chars.map((c) => c.c).join('').slice(0, limits.text);
    if (!characters.trim() || !take()) {
      return null;
    }
    const counts = new Map<number, number>();
    chars.forEach((c) => counts.set(c.seg, (counts.get(c.seg) ?? 0) + 1));
    const main = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const base = segs[main];
    const baseStyle = styleOf(base, ctx.scale);
    const baseFills = segFills(base);
    const spacingOf = (c: Char) => (segs[c.seg].css.letterSpacing === 'normal' ? 0 : px(segs[c.seg].css.letterSpacing) * ctx.scale) + (c.extra ?? 0);
    const runStyleOf = (c: Char) => ({ ...styleOf(segs[c.seg], ctx.scale), ...(c.extra ? { letterSpacing: round(spacingOf(c)) } : {}), fills: segFills(segs[c.seg]) });
    const keyOf = (c: Char) => JSON.stringify(runStyleOf(c));
    const baseKey = JSON.stringify({ ...styleOf(base, ctx.scale), fills: baseFills });
    const table: Record<string, NonNullable<RestNode['style']>> = {};
    const styleIds = new Map<string, number>();
    const overrides = chars.slice(0, characters.length).map((c) => {
      const key = keyOf(c);
      if (key === baseKey) {
        return 0;
      }
      if (!styleIds.has(key)) {
        const sid = styleIds.size + 1;
        styleIds.set(key, sid);
        table[String(sid)] = runStyleOf(c);
      }
      return styleIds.get(key)!;
    });
    const fontSize = baseStyle.fontSize;
    const content = lines[0].bottom - lines[0].top;
    const blanks = characters.match(/\n[^\S\n]*(?=\n)/g)?.length ?? 0;
    const pitch = lines.length > 1 ? (lines[lines.length - 1].top - lines[0].top) / (lines.length - 1 + blanks) : base.css.lineHeight === 'normal' ? content : px(base.css.lineHeight) * ctx.scale;
    const lineHeight = pitch > 0 ? pitch : content;
    const left = Math.min(...lines.map((l) => l.left));
    const right = Math.max(...lines.map((l) => l.right));
    const top = lines[0].top - (lineHeight - content) / 2;
    const slack = lines.length > 1 && align !== 'JUSTIFIED' ? roomOf(chars, lines, fontSize) : 0;
    const shift = align === 'CENTER' ? slack / 2 : align === 'RIGHT' ? slack : 0;
    const node: RestNode = {
      id: id(),
      type: 'TEXT',
      name: characters.slice(0, 40),
      absoluteBoundingBox: box({ x: left - shift, y: top, width: right - left + slack, height: lineHeight * (lines.length + blanks) }),
      characters,
      ...(lines.length > 1 ? { textAutoResize: 'HEIGHT' } : {}),
      fills: baseFills,
      style: {
        ...baseStyle,
        textAlignHorizontal: lines.length > 1 ? align : 'LEFT',
        letterSpacing: base.css.letterSpacing === 'normal' ? 0 : px(base.css.letterSpacing) * ctx.scale,
        ...tuning(base.css, fontSize),
        lineHeightUnit: 'PIXELS',
        lineHeightPx: round(lineHeight),
        ...(/underline|line-through/.test(base.css.textDecorationLine) ? { textDecoration: base.css.textDecorationLine.includes('underline') ? 'UNDERLINE' : 'STRIKETHROUGH' } : {})
      },
      ...(styleIds.size ? { characterStyleOverrides: overrides, styleOverrideTable: table } : {})
    };
    return node;
  };

  const runNodes = (segs: Seg[], ctx: Ctx, block: CSSStyleDeclaration): RestNode[] => {
    const chars = charsOf(segs);
    if (!chars.some((c) => c.c.trim())) {
      return [];
    }
    const texts = segs.filter((s) => s.node);
    const all = texts.flatMap((s) => rectsOf(s.node!));
    const lines = kit.linesOf(all);
    const seen = (l: KitRect) => {
      const r = { x: l.left, y: l.top, width: l.right - l.left, height: l.bottom - l.top };
      const v = meet(r, ctx.clip);
      return (v.width * v.height) / Math.max(1, r.width * r.height);
    };
    const kept = lines.filter((l) => seen(l) >= MOSTLY_SEEN && l.top < height);
    if (!kept.length) {
      return [];
    }
    const align = TEXT_ALIGN[block.textAlign] ?? 'LEFT';
    const edge = (l: KitRect) => (align === 'CENTER' ? (l.left + l.right) / 2 : align === 'RIGHT' ? l.right : l.left);
    const clean = kept.length === lines.length && (lines.length === 1 || lines.every((l) => Math.abs(edge(l) - edge(lines[0])) <= LINE_SLACK || (align === 'JUSTIFIED' && Math.abs(l.left - lines[0].left) <= LINE_SLACK)));
    if (clean) {
      const made = textNode(chars, segs, lines, ctx, align);
      return made ? [made] : [];
    }
    const perLine = kept.map(() => [] as Char[]);
    let last = 0;
    for (const ch of chars) {
      const rect = ch.node ? rectsOf(ch.node, ch.at, ch.at + 1)[0] : null;
      const index = rect ? kept.findIndex((l) => Math.min(l.bottom, rect.bottom) - Math.max(l.top, rect.top) > 0) : -1;
      if (index >= 0) {
        last = index;
      } else if (rect && ch.c.trim()) {
        continue;
      }
      if (ch.c === '\n') {
        continue;
      }
      perLine[last].push(ch);
    }
    return perLine.flatMap((cs, i) => {
      const trimmed = cs.slice(cs.findIndex((c) => c.c !== ' '));
      while (trimmed.length && trimmed[trimmed.length - 1].c === ' ') {
        trimmed.pop();
      }
      const made = trimmed.length ? textNode(trimmed, segs, [kept[i]], ctx, 'LEFT') : null;
      return made ? [made] : [];
    });
  };

  const composed = (node: Node): Node[] => {
    const host = (node as Element).shadowRoot;
    if (host) {
      return [...host.childNodes];
    }
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedNodes({ flatten: true });
      return assigned.length ? assigned : [...node.childNodes];
    }
    return [...node.childNodes];
  };

  const plainInline = (el: Element, css: CSSStyleDeclaration) => css.display === 'inline' && !REPLACED.test(el.tagName.toUpperCase()) && css.transform === 'none' && Number(css.opacity) >= 1 && css.float === 'none' && (css.position === 'static' || (css.position === 'relative' && px(css.top) === 0 && px(css.left) === 0)) && css.filter === 'none' && css.mixBlendMode === 'normal';

  const decorationsOf = (el: Element, css: CSSStyleDeclaration, ctx: Ctx): RestNode[] => {
    const fills = solid(css.backgroundColor);
    const radius = cornersOf(css, { x: 0, y: 0, width: 1e4, height: 1e4 });
    return [...el.getClientRects()].flatMap((cr) => {
      const r = pageRect(cr);
      const borders = bordersOf(css, r);
      const stroked = 'strokes' in borders ? { strokes: borders.strokes, strokeWeight: borders.strokeWeight, strokeAlign: borders.strokeAlign } : {};
      if ((!fills.length && !('strokes' in borders) && !borders.sides.length) || !shown(r, ctx.clip) || !take()) {
        return [];
      }
      return [{ id: id(), type: 'RECTANGLE', name: el.tagName.toLowerCase(), absoluteBoundingBox: box(r), fills, ...stroked, ...radius, layoutPositioning: 'ABSOLUTE' }, ...borders.sides];
    });
  };


  const clipFor = (el: Element, css: CSSStyleDeclaration, r: Rect, ctx: Ctx): Rect => {
    const hides = (v: string) => v === 'hidden' || v === 'clip' || v === 'auto' || v === 'scroll';
    const x = hides(css.overflowX);
    const y = hides(css.overflowY);
    const inset = css.clipPath.match(/^inset\(([^)]*)\)$/);
    let clip = ctx.clip;
    if (x || y) {
      const inner = { x: r.x + px(css.borderLeftWidth), y: r.y + px(css.borderTopWidth), width: (el as HTMLElement).clientWidth || r.width, height: (el as HTMLElement).clientHeight || r.height };
      clip = meet(clip, { x: x ? inner.x : -1e6, y: y ? inner.y : -1e6, width: x ? inner.width : 2e6, height: y ? inner.height : 2e6 });
    }
    if (inset) {
      const [t = 0, rt = t, b = t, l = rt] = inset[1].split(/\s+/).filter((v) => !v.startsWith('round')).map(px);
      clip = meet(clip, { x: r.x + l, y: r.y + t, width: r.width - l - rt, height: r.height - t - b });
    }
    return clip;
  };

  const svgLoaded = new Map<string, SVGSVGElement>();
  const hosts: Element[] = [];

  const svgPaint = (el: Element, kind: 'fill' | 'stroke', css: CSSStyleDeclaration, frame: KitMatrix, svgBox: Rect, inherit: CSSStyleDeclaration | null): RestPaint[] => {
    const explicit = el.getAttribute(kind) !== null || (el as SVGElement).style?.getPropertyValue(kind);
    const value = inherit && !explicit ? inherit.getPropertyValue(kind) : css.getPropertyValue(kind);
    const alpha = Number((inherit && !explicit ? inherit : css).getPropertyValue(`${kind}-opacity`) || 1);
    if (!value || value === 'none') {
      return [];
    }
    const ref = value.match(/url\(["']?#([^"')]+)["']?\)/);
    if (!ref) {
      return solid(value === 'currentcolor' ? css.color : value, alpha);
    }
    const root: Element = (el as SVGElement).ownerSVGElement ?? el;
    const target = (root.querySelector(`[id="${CSS.escape(ref[1])}"]`) ?? document.getElementById(ref[1])) as SVGGradientElement | null;
    if (!target || !/Gradient$/.test(target.tagName)) {
      const fallback = value.replace(/url\([^)]*\)/, '').trim();
      return fallback ? solid(fallback, alpha) : [];
    }
    let source: Element | null = target;
    let stopsFrom: Element | null = null;
    const attr = (name: string, fallback: string) => {
      let at: Element | null = target;
      while (at) {
        const v = at.getAttribute(name);
        if (v !== null) {
          return v;
        }
        const href: string | null = at.getAttribute('href') ?? at.getAttribute('xlink:href');
        at = href ? root.querySelector(`[id="${CSS.escape(href.slice(1))}"]`) : null;
      }
      return fallback;
    };
    while (source && !stopsFrom) {
      if (source.querySelector('stop')) {
        stopsFrom = source;
        break;
      }
      const href: string | null = source.getAttribute('href') ?? source.getAttribute('xlink:href');
      source = href ? root.querySelector(`[id="${CSS.escape(href.slice(1))}"]`) : null;
    }
    const gradientStops = [...(stopsFrom?.querySelectorAll('stop') ?? [])].flatMap((s) => {
      const sc = getComputedStyle(s);
      const color = rgbaOf(sc.stopColor);
      const offset = s.getAttribute('offset') ?? '0';
      const position = offset.endsWith('%') ? parseFloat(offset) / 100 : Number(offset);
      return color ? [{ position: Math.min(1, Math.max(0, position)), color: { ...color, a: color.a * Number(sc.stopOpacity || 1) } }] : [];
    });
    if (gradientStops.length < 2) {
      return gradientStops.length ? [{ type: 'SOLID', color: gradientStops[0].color }] : [];
    }
    const userSpace = attr('gradientUnits', 'objectBoundingBox') === 'userSpaceOnUse';
    const bbox = (el as SVGGraphicsElement).getBBox?.() ?? { x: 0, y: 0, width: 1, height: 1 };
    const num = (v: string, span: number, offset: number) => (v.endsWith('%') ? (userSpace ? offset + (parseFloat(v) / 100) * span : parseFloat(v) / 100) : Number(v));
    const toBox = (u: number, v: number) => {
      const [ux, uy] = userSpace ? [u, v] : [bbox.x + u * bbox.width, bbox.y + v * bbox.height];
      const [x, y] = [frame[0] * ux + frame[2] * uy + frame[4], frame[1] * ux + frame[3] * uy + frame[5]];
      return { x: Math.round((x / (svgBox.width || 1)) * 1e4) / 1e4, y: Math.round((y / (svgBox.height || 1)) * 1e4) / 1e4 };
    };
    if (target.tagName === 'radialGradient') {
      const [cx, cy, r] = [num(attr('cx', '50%'), bbox.width, bbox.x), num(attr('cy', '50%'), bbox.height, bbox.y), num(attr('r', '50%'), bbox.width, 0)];
      return [{ type: 'GRADIENT_RADIAL', opacity: alpha, gradientHandlePositions: [toBox(cx, cy), toBox(cx + r, cy), toBox(cx, cy + r)], gradientStops }];
    }
    const [x1, y1, x2, y2] = [num(attr('x1', '0%'), bbox.width, bbox.x), num(attr('y1', '0%'), bbox.height, bbox.y), num(attr('x2', '100%'), bbox.width, bbox.x), num(attr('y2', '0%'), bbox.height, bbox.y)];
    return [{ type: 'GRADIENT_LINEAR', opacity: alpha, gradientHandlePositions: [toBox(x1, y1), toBox(x2, y2), toBox(x1 - (y2 - y1), y1 + (x2 - x1))], gradientStops }];
  };

  const local = (el: Element): KitMatrix => {
    const m = (el as SVGGraphicsElement).transform?.baseVal?.consolidate()?.matrix;
    return m ? [m.a, m.b, m.c, m.d, m.e, m.f] : [1, 0, 0, 1, 0, 0];
  };
  const times = (a: KitMatrix, b: KitMatrix): KitMatrix => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const screenFrame = (el: Element, svgBox: Rect): KitMatrix | null => {
    const m = (el as SVGGraphicsElement).getScreenCTM?.();
    return m ? [m.a, m.b, m.c, m.d, m.e - (svgBox.x - window.scrollX), m.f - (svgBox.y - window.scrollY)] : null;
  };
  const viewBoxFrame = (symbol: Element, w: number, h: number): KitMatrix => {
    const vb = symbol.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
    if (!vb || vb.length !== 4 || !vb[2] || !vb[3]) {
      return [1, 0, 0, 1, 0, 0];
    }
    const k = Math.min(w / vb[2], h / vb[3]);
    return [k, 0, 0, k, (w - vb[2] * k) / 2 - vb[0] * k, (h - vb[3] * k) / 2 - vb[1] * k];
  };

  const opacityUp = (el: Element, stop: Element) => {
    let o = 1;
    for (let at: Element | null = el; at && at !== stop; at = at.parentElement) {
      o *= Number(getComputedStyle(at).opacity);
    }
    return o;
  };

  const dashedAway = (el: Element, css: CSSStyleDeclaration) => {
    if (!css.strokeDasharray || css.strokeDasharray === 'none') {
      return false;
    }
    const length = (el as SVGGeometryElement).getTotalLength?.() ?? 0;
    const [dash = 0] = css.strokeDasharray.split(/[\s,]+/).map(px);
    return length > 0 && dash >= length * DRAWN_ALL && Math.abs(px(css.strokeDashoffset)) >= length * DRAWN_ALL;
  };

  const svgShape = (el: Element, frame: KitMatrix, svgBox: Rect, svgRoot: Element, inherit: CSSStyleDeclaration | null): RestNode | null => {
    const css = getComputedStyle(el);
    if (css.display === 'none' || css.visibility === 'hidden') {
      return null;
    }
    const tag = el.tagName;
    const cssPath = tag === 'path' && css.getPropertyValue('d').match(/^path\(["'](.*)["']\)$/)?.[1];
    const g = el as unknown as Record<string, { baseVal?: { value?: number } }>;
    const d = tag === 'path' ? (cssPath || el.getAttribute('d')) : kit.shapeD(tag, (name) => (name === 'points' ? (el.getAttribute('points') ?? '') : (g[name]?.baseVal?.value ?? Number(el.getAttribute(name)) ?? 0)));
    if (!d) {
      return null;
    }
    const ops = kit.pathOps(d);
    if (!ops.length) {
      return null;
    }
    const fills = tag === 'line' ? [] : svgPaint(el, 'fill', css, frame, svgBox, inherit);
    const strokes = dashedAway(el, css) ? [] : svgPaint(el, 'stroke', css, frame, svgBox, inherit);
    if ((!fills.length && !strokes.length) || !take()) {
      return null;
    }
    const opacity = opacityUp(el, svgRoot);
    const path = kit.pathText(ops, frame);
    const node: RestNode = { id: id(), type: 'VECTOR', name: tag, absoluteBoundingBox: box(svgBox), fills, ...(opacity < 1 ? { opacity } : {}), fillGeometry: [{ path, windingRule: (inherit && el.getAttribute('fill-rule') === null ? inherit.fillRule : css.fillRule) === 'evenodd' ? 'EVENODD' : 'NONZERO' }] };
    const weight = px(css.strokeWidth || '1') * Math.sqrt(Math.abs(frame[0] * frame[3] - frame[1] * frame[2]));
    return strokes.length ? { ...node, strokes, strokeWeight: round(weight * 100) / 100, strokeAlign: 'CENTER' } : node;
  };

  const svgText = (el: Element, ctx: Ctx): RestNode | null => {
    const css = getComputedStyle(el);
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const r = pageRect(el.getBoundingClientRect());
    const fills = solid(css.fill === 'none' ? css.color : css.fill);
    if (!text || !shown(r, ctx.clip) || !fills.length || !take()) {
      return null;
    }
    return { id: id(), type: 'TEXT', name: text.slice(0, 40), characters: text.slice(0, limits.text), absoluteBoundingBox: box({ ...r, width: r.width + 1 }), fills, style: { fontFamily: familyOf(css.fontFamily), fontWeight: Number(css.fontWeight) || 400, italic: css.fontStyle === 'italic', fontSize: px(css.fontSize), letterSpacing: 0, lineHeightUnit: 'PIXELS', lineHeightPx: round(r.height) } };
  };

  const svgWalk = (el: Element, svgBox: Rect, svgRoot: Element, ctx: Ctx, through: { frame: KitMatrix; inherit: CSSStyleDeclaration } | null): RestNode[] => {
    const tag = el.tagName;
    if (SVG_SKIP.test(tag)) {
      return [];
    }
    if (tag === 'text') {
      const made = svgText(el, ctx);
      return made ? [made] : [];
    }
    const frame = through ? times(through.frame, local(el)) : screenFrame(el, svgBox);
    if (!frame) {
      return [];
    }
    return clippedBy(el, frame, svgBox, svgRoot, svgInner(el, frame, svgBox, svgRoot, ctx, through));
  };

  const clipRectOf = (svgRoot: Element, el: Element): SVGRectElement | null => {
    const id = el.getAttribute('clip-path')?.match(/url\(["']?#([^"')]+)["']?\)/)?.[1];
    const clip = id ? (svgRoot.querySelector(`[id="${CSS.escape(id)}"]`) ?? document.getElementById(id)) : null;
    const only = clip?.children.length === 1 ? clip.firstElementChild : null;
    const userSpace = (clip?.getAttribute('clipPathUnits') ?? 'userSpaceOnUse') === 'userSpaceOnUse';
    return clip?.tagName === 'clipPath' && only?.tagName === 'rect' && userSpace && !only.hasAttribute('transform') ? (only as SVGRectElement) : null;
  };

  const vectorOnly = (svg: Element) => !svg.querySelector(SVG_RASTER) && !svg.querySelector('[mask], [filter]') && [...svg.querySelectorAll('[clip-path]')].every((e) => clipRectOf(svg, e));

  const clippedBy = (el: Element, frame: KitMatrix, svgBox: Rect, svgRoot: Element, made: RestNode[]): RestNode[] => {
    const rect = el.hasAttribute('clip-path') ? clipRectOf(svgRoot, el) : null;
    if (!rect || !made.length || Math.abs(frame[1]) > 1e-6 || Math.abs(frame[2]) > 1e-6 || !take()) {
      return made;
    }
    const [x, y, w, h] = [rect.x, rect.y, rect.width, rect.height].map((v) => v.baseVal.value);
    const [left, right] = [frame[0] * x + frame[4], frame[0] * (x + w) + frame[4]].sort((a, b) => a - b);
    const [top, bottom] = [frame[3] * y + frame[5], frame[3] * (y + h) + frame[5]].sort((a, b) => a - b);
    return [{ id: id(), type: 'FRAME', name: 'clip', absoluteBoundingBox: box({ x: svgBox.x + left, y: svgBox.y + top, width: right - left, height: bottom - top }), fills: [], clipsContent: true, children: made }];
  };

  const svgInner = (el: Element, frame: KitMatrix, svgBox: Rect, svgRoot: Element, ctx: Ctx, through: { frame: KitMatrix; inherit: CSSStyleDeclaration } | null): RestNode[] => {
    const tag = el.tagName;
    if (SHAPES.test(tag)) {
      const made = svgShape(el, frame, svgBox, svgRoot, through?.inherit ?? null);
      return made ? [made] : [];
    }
    if (tag === 'use') {
      const href = el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '';
      const target = href.startsWith('#') ? (svgRoot.querySelector(`[id="${CSS.escape(href.slice(1))}"]`) ?? document.getElementById(href.slice(1))) : null;
      if (!target) {
        return [];
      }
      const u = el as SVGUseElement;
      const moved = times(frame, [1, 0, 0, 1, u.x.baseVal.value, u.y.baseVal.value]);
      const inherit = getComputedStyle(el);
      if (target.tagName === 'symbol') {
        const inner = times(moved, viewBoxFrame(target, u.width.baseVal.value || svgBox.width, u.height.baseVal.value || svgBox.height));
        return [...target.children].flatMap((c) => svgWalk(c, svgBox, svgRoot, ctx, { frame: inner, inherit }));
      }
      return svgWalk(target, svgBox, svgRoot, ctx, { frame: moved, inherit });
    }
    if (tag === 'svg' && el !== svgRoot && through) {
      const inner = times(frame, viewBoxFrame(el, Number(el.getAttribute('width')) || svgBox.width, Number(el.getAttribute('height')) || svgBox.height));
      return [...el.children].flatMap((c) => svgWalk(c, svgBox, svgRoot, ctx, { frame: inner, inherit: through.inherit }));
    }
    const css = getComputedStyle(el);
    if (css.display === 'none') {
      return [];
    }
    const next = through ? { frame, inherit: through.inherit } : null;
    return [...el.children].flatMap((c) => svgWalk(c, svgBox, svgRoot, ctx, next));
  };

  const vectorOf = (svg: SVGSVGElement, r: Rect, ctx: Ctx, name: string): RestNode | null => {
    const children = svgWalk(svg, r, svg, ctx, null);
    if (!children.length) {
      return null;
    }
    return { id: id(), type: 'GROUP', name, absoluteBoundingBox: box(r), children };
  };

  const imageOf = (el: HTMLImageElement, css: CSSStyleDeclaration, r: Rect, ctx: Ctx): RestNode | null => {
    const src = el.currentSrc || el.src;
    if (!shown(r, ctx.clip) || !/^(https?|data):/.test(src)) {
      return null;
    }
    const hosted = svgLoaded.get(src);
    if (hosted) {
      const made = vectorOf(hosted, r, ctx, el.alt || 'image');
      if (made) {
        return made;
      }
    }
    if (/\.svg(\?|#|$)|^data:image\/svg/i.test(src)) {
      return snapOf(el, r, 'isolated', ctx, el.alt || 'image');
    }
    if (!take()) {
      return null;
    }
    const fit = css.objectFit;
    const [nw, nh] = [el.naturalWidth || r.width, el.naturalHeight || r.height];
    const k = fit === 'cover' ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
    const paint: RestPaint = { type: 'IMAGE', imageRef: src, scaleMode: FIT[fit] ?? 'STRETCH', imageFocus: focusOf(css.objectPosition, r.width, r.height, nw * k, nh * k) };
    return { id: id(), type: 'RECTANGLE', name: el.alt || 'image', absoluteBoundingBox: box(r), fills: [paint], ...cornersOf(css, r), ...(Number(css.opacity) < 1 ? { opacity: Number(css.opacity) } : {}) };
  };

  const fieldText = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, css: CSSStyleDeclaration, r: Rect, ctx: Ctx): RestNode | null => {
    const select = el instanceof HTMLSelectElement;
    const value = select ? (el.selectedOptions[0]?.text ?? '') : el.value;
    const placeholder = !select && !value ? (el as HTMLInputElement).placeholder : '';
    const text = (el instanceof HTMLInputElement && el.type === 'password' ? '•'.repeat(value.length) : value || placeholder).replace(/\s+/g, ' ').trim();
    if (!text || !take()) {
      return null;
    }
    const look = placeholder ? getComputedStyle(el, '::placeholder') : css;
    const size = px(css.fontSize) * ctx.scale;
    const line = css.lineHeight === 'normal' ? size * 1.2 : px(css.lineHeight);
    const inner = { x: r.x + px(css.borderLeftWidth) + px(css.paddingLeft), width: r.width - px(css.borderLeftWidth) - px(css.borderRightWidth) - px(css.paddingLeft) - px(css.paddingRight) };
    const top = el instanceof HTMLTextAreaElement ? r.y + px(css.borderTopWidth) + px(css.paddingTop) : r.y + (r.height - line) / 2;
    return { id: id(), type: 'TEXT', name: text.slice(0, 40), characters: text.slice(0, limits.text), absoluteBoundingBox: box({ x: inner.x, y: top, width: Math.max(1, inner.width), height: line }), fills: solid(look.color), ...(el instanceof HTMLTextAreaElement ? { textAutoResize: 'HEIGHT' } : {}), style: { fontFamily: familyOf(css.fontFamily), fontWeight: Number(css.fontWeight) || 400, italic: css.fontStyle === 'italic', fontSize: round(size), textAlignHorizontal: TEXT_ALIGN[css.textAlign] ?? 'LEFT', letterSpacing: css.letterSpacing === 'normal' ? 0 : px(css.letterSpacing), lineHeightUnit: 'PIXELS', lineHeightPx: round(line) } };
  };

  const flowOf = (css: CSSStyleDeclaration, r: Rect, kids: RestNode[]): Partial<RestNode> => {
    if (!/flex/.test(css.display) || css.flexDirection.endsWith('reverse') || css.flexWrap !== 'nowrap' || css.alignItems === 'baseline') {
      return {};
    }
    const row = css.flexDirection.startsWith('row');
    const flowing = kids.filter((k) => k.layoutPositioning !== 'ABSOLUTE');
    const primary = ALIGN[css.justifyContent] ?? (/^(normal|flex-start|start|left|stretch)$/.test(css.justifyContent) ? 'MIN' : null);
    const counter = ALIGN[css.alignItems] ?? 'MIN';
    const spills = (k: RestNode) => {
      const [own, all] = [k.absoluteBoundingBox!, extentOf(k, false)];
      return all.x < own.x - EXACT || all.y < own.y - EXACT || all.x + all.width > own.x + own.width + EXACT || all.y + all.height > own.y + own.height + EXACT;
    };
    if (!primary || !flowing.length || flowing.some(spills)) {
      return {};
    }
    const pad = { top: px(css.paddingTop) + px(css.borderTopWidth), right: px(css.paddingRight) + px(css.borderRightWidth), bottom: px(css.paddingBottom) + px(css.borderBottomWidth), left: px(css.paddingLeft) + px(css.borderLeftWidth) };
    const gap = px(row ? css.columnGap : css.rowGap);
    const main = (n: RestNode) => (row ? n.absoluteBoundingBox!.width : n.absoluteBoundingBox!.height);
    const cross = (n: RestNode) => (row ? n.absoluteBoundingBox!.height : n.absoluteBoundingBox!.width);
    const startOf = (n: RestNode) => (row ? n.absoluteBoundingBox!.x : n.absoluteBoundingBox!.y);
    const crossOf = (n: RestNode) => (row ? n.absoluteBoundingBox!.y : n.absoluteBoundingBox!.x);
    const origin = row ? r.x + pad.left : r.y + pad.top;
    const span = row ? r.width - pad.left - pad.right : r.height - pad.top - pad.bottom;
    const crossOrigin = row ? r.y + pad.top : r.x + pad.left;
    const crossSpan = row ? r.height - pad.top - pad.bottom : r.width - pad.left - pad.right;
    const total = flowing.reduce((s, k) => s + main(k), 0);
    const free = span - total - gap * (flowing.length - 1);
    const between = primary === 'SPACE_BETWEEN' && flowing.length > 1 ? gap + free / (flowing.length - 1) : gap;
    let at = origin + (primary === 'CENTER' ? free / 2 : primary === 'MAX' ? free : 0);
    for (const k of flowing) {
      const crossAt = crossOrigin + (counter === 'CENTER' ? (crossSpan - cross(k)) / 2 : counter === 'MAX' ? crossSpan - cross(k) : 0);
      if (Math.abs(startOf(k) - at) > EXACT || Math.abs(crossOf(k) - crossAt) > EXACT) {
        return {};
      }
      at += main(k) + between;
    }
    return {
      layoutMode: row ? 'HORIZONTAL' : 'VERTICAL',
      itemSpacing: round(primary === 'SPACE_BETWEEN' ? Math.max(0, between) : gap),
      paddingTop: pad.top,
      paddingRight: pad.right,
      paddingBottom: pad.bottom,
      paddingLeft: pad.left,
      primaryAxisAlignItems: primary === 'SPACE_BETWEEN' ? 'MIN' : primary,
      counterAxisAlignItems: counter,
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'FIXED'
    };
  };

  const marked = (el: Element, made: RestNode[]): RestNode[] => {
    const use = el.getAttribute(limits.useAttr);
    if (use === null || !made.length) {
      return made;
    }
    if (made.length === 1 && made[0].use === undefined && made[0].type !== 'TEXT') {
      return [{ ...made[0], use: Number(use) }];
    }
    const r = pageRect(el.getBoundingClientRect());
    return [keyed({ id: id(), type: 'GROUP', name: el.tagName.toLowerCase(), absoluteBoundingBox: box(r), use: Number(use), children: made }, Math.max(...made.map((m) => zOf.get(m) ?? 0)))];
  };

  const SIMPLE_EFFECTS = (css: CSSStyleDeclaration) => (css.filter === 'none' || SIMPLE_FILTER.test(css.filter)) && css.mixBlendMode === 'normal' && (css.maskImage === 'none' || !css.maskImage) && (css.webkitMaskImage === 'none' || !css.webkitMaskImage) && (css.clipPath === 'none' || /^inset\(/.test(css.clipPath));

  const childrenOf = (el: Element, css: CSSStyleDeclaration, ctx: Ctx): RestNode[] => {
    const out: RestNode[] = [];
    let run: Seg[] = [];
    const flush = () => {
      if (run.length) {
        out.push(...runNodes(run, ctx, css));
      }
      run = [];
    };
    const inline = (node: Node, own: CSSStyleDeclaration, fills: RestPaint[] | null) => {
      for (const child of composed(node)) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (own.visibility === 'visible') {
            run.push({ node: child as Text, css: own, fills, br: false });
          }
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }
        const element = child as Element;
        if (SKIPPED.test(element.tagName.toUpperCase()) && element.tagName !== 'BR') {
          continue;
        }
        if (element.tagName === 'BR') {
          run.push({ node: null, css: own, fills, br: true });
          continue;
        }
        const ccss = getComputedStyle(element);
        if (ccss.display === 'none' || Number(ccss.opacity) === 0) {
          continue;
        }
        if (plainInline(element, ccss)) {
          out.push(...decorationsOf(element, ccss, ctx));
          const [lead, trail] = [px(ccss.marginLeft) + px(ccss.borderLeftWidth) + px(ccss.paddingLeft), px(ccss.marginRight) + px(ccss.borderRightWidth) + px(ccss.paddingRight)].map((v) => v * ctx.scale);
          const [was, from] = [run, run.length];
          inline(element, ccss, /text/.test(ccss.backgroundClip) || /text/.test(ccss.webkitBackgroundClip) ? textPaintOf(ccss, element) : fills);
          const inside = run === was ? run.slice(from).filter((seg) => seg.node) : [];
          if (inside.length) {
            inside[0].lead = (inside[0].lead ?? 0) + lead;
            inside[inside.length - 1].trail = (inside[inside.length - 1].trail ?? 0) + trail;
          }
          continue;
        }
        flush();
        out.push(...visit(element, ctx));
      }
    };
    inline(el, css, ctx.textFills);
    flush();
    return out;
  };

  const textPaintOf = (css: CSSStyleDeclaration, el: Element): RestPaint[] | null => {
    const r = pageRect(el.getBoundingClientRect());
    const layers = css.backgroundImage === 'none' ? [] : kit.splitTop(css.backgroundImage, ',');
    const paint = layers.map((l) => kit.gradientOf(l, r.width, r.height, rgbaOf)).find(Boolean);
    return paint ? [paint as RestPaint] : solid(css.backgroundColor).length ? solid(css.backgroundColor) : null;
  };

  const escapedFrom = (el: Element, ctx: Ctx): RestNode[] =>
    [...el.querySelectorAll('*')]
      .filter((e) => getComputedStyle(e).position === 'fixed' && !e.parentElement?.closest(`[${limits.hideAttr}]`))
      .flatMap((e) => {
        e.setAttribute(limits.hideAttr, '');
        return visit(e, ctx);
      });

  const visit = (el: Element, within: Ctx): RestNode[] => {
    const tag = el.tagName.toUpperCase();
    if (SKIPPED.test(tag)) {
      return [];
    }
    const css = getComputedStyle(el);
    const fixed = css.position === 'fixed';
    if (fixed || css.position === 'sticky') {
      el.setAttribute(limits.hideAttr, '');
    }
    const ctx = fixed ? { ...within, clip: PAGE } : within;
    const made = shape(el, css, ctx);
    if (fixed) {
      made.forEach((n) => fixedNodes.add(n));
    }
    return made;
  };

  const shape = (el: Element, css: CSSStyleDeclaration, ctx: Ctx): RestNode[] => {
    const tag = el.tagName.toUpperCase();
    if (css.display === 'none' || Number(css.opacity) === 0 || css.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(css.clipPath) || css.contentVisibility === 'hidden') {
      return [];
    }
    const visible = css.visibility === 'visible';
    if (css.display === 'contents') {
      return marked(el, childrenOf(el, css, { ...ctx, visible }));
    }
    const r = pageRect(el.getBoundingClientRect());
    const z = layerOf(el, css);
    const clipsSelf = /hidden|clip/.test(css.overflow) || /^inset\(/.test(css.clipPath);
    if (clipsSelf && !shown(r, ctx.clip)) {
      return [];
    }
    const name = el.id || el.getAttribute('aria-label') || tag.toLowerCase();
    const control = (el instanceof HTMLInputElement && !FIELDS.test(el.type) && css.appearance !== 'none') || /^(PROGRESS|METER)$/.test(tag);
    const rasterOnly = RASTER.test(tag);
    if (!SIMPLE_EFFECTS(css) || (turned(css) && !(el instanceof SVGSVGElement)) || control || rasterOnly) {
      if (!visible) {
        return [];
      }
      const snap = snapOf(el, r, css.mixBlendMode === 'normal' || rasterOnly ? 'isolated' : 'backdrop', ctx, rasterOnly ? tag.toLowerCase() : name);
      if (snap || rasterOnly) {
        return snap ? marked(el, [keyed(snap, z), ...escapedFrom(el, ctx)]) : [];
      }
    }
    if (el instanceof SVGSVGElement) {
      if (!visible || !shown(r, ctx.clip)) {
        return [];
      }
      if (!vectorOnly(el)) {
        const snap = snapOf(el, r, 'isolated', ctx, 'icon');
        return snap ? marked(el, [keyed(snap, z)]) : [];
      }
      const made = vectorOf(el, r, ctx, 'icon');
      return made ? marked(el, [keyed(made, z)]) : [];
    }
    if (el instanceof HTMLImageElement) {
      const made = visible ? imageOf(el, css, r, ctx) : null;
      return made ? marked(el, [keyed(made, z)]) : [];
    }
    const scale = turned(css) ? ctx.scale : ctx.scale * scaleOf(css);
    const textFills = /text/.test(css.backgroundClip) || /text/.test(css.webkitBackgroundClip) ? textPaintOf(css, el) : ctx.textFills;
    const inner: Ctx = { clip: clipFor(el, css, r, ctx), scale, textFills, visible };
    const field = (el instanceof HTMLInputElement && FIELDS.test(el.type)) || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? fieldText(el as HTMLInputElement, css, r, ctx) : null;
    const every = sorted([...(field ? [field] : []), ...childrenOf(el, css, inner)]);
    const lifted = every.filter((k) => fixedNodes.has(k) || (!stacks(el, css) && !clipsSelf && ((zOf.get(k) ?? 0) < 0 || (zOf.get(k) ?? 0) >= LIFTED)));
    const kids = every.filter((k) => !lifted.includes(k));
    const own = visible && !textFills ? backgroundOf(css, r, ctx) : { fills: [], under: [], own: false };
    const ownSnap = own.own && visible ? snapOf(el, r, 'own', ctx, 'background') : null;
    const borders = visible ? bordersOf(css, r) : { sides: [] };
    const effects = visible ? effectsOf(css) : undefined;
    const outline = visible ? outlineOf(css, r) : [];
    const extras = [...(ownSnap ? [{ ...ownSnap, layoutPositioning: 'ABSOLUTE' }] : []), ...own.under];
    const paintedSelf = own.fills.length > 0 || 'strokes' in borders || Boolean(effects) || extras.length > 0 || borders.sides.length > 0;
    const overflows = clipsSelf && kids.some((k) => {
      const b = extentOf(k);
      return b.x < r.x - EXACT || b.y < r.y - EXACT || b.x + b.width > r.x + r.width + EXACT || b.y + b.height > r.y + r.height + EXACT;
    });
    const opacity = Number(css.opacity);
    const framed = paintedSelf || overflows || /flex/.test(css.display) || opacity < 1;
    const kidZ = kids.map((k) => zOf.get(k) ?? 0);
    const zEff = stacks(el, css) || clipsSelf ? z : Math.max(z, ...kidZ);
    if (!framed) {
      if (!kids.length) {
        return marked(el, lifted);
      }
      if (kids.length === 1) {
        return marked(el, [keyed(kids[0], zEff), ...lifted]);
      }
      return marked(el, [keyed({ id: id(), type: 'GROUP', name, absoluteBoundingBox: box(r), children: kids }, zEff), ...lifted]);
    }
    if (!shown(r, ctx.clip) || !take()) {
      return marked(el, [...kids.map((k) => keyed(k, zEff)), ...lifted]);
    }
    const positioned = css.position === 'absolute' || css.position === 'fixed';
    const flow = flowOf(css, r, kids);
    const boxed = (k: RestNode): RestNode => {
      if (k.layoutPositioning === 'ABSOLUTE') {
        return k;
      }
      if (k.type === 'GROUP') {
        return { ...k, type: 'FRAME', fills: [], clipsContent: false };
      }
      return k.type === 'TEXT' ? { id: id(), type: 'FRAME', name: k.name, absoluteBoundingBox: k.absoluteBoundingBox, fills: [], clipsContent: false, children: [k] } : k;
    };
    const children = [...extras, ...(flow.layoutMode ? kids.map(boxed) : kids), ...borders.sides, ...outline];
    return marked(el, [
      keyed(
        {
          id: id(),
          type: 'FRAME',
          name,
          absoluteBoundingBox: box(r),
          ...(opacity < 1 ? { opacity } : {}),
          fills: own.fills,
          ...('strokes' in borders ? { strokes: borders.strokes, strokeWeight: borders.strokeWeight, strokeAlign: borders.strokeAlign } : {}),
          ...(effects ? { effects } : {}),
          ...cornersOf(css, r),
          clipsContent: overflows,
          ...(positioned ? { layoutPositioning: 'ABSOLUTE' } : {}),
          ...flow,
          children
        },
        zEff
      ),
      ...lifted
    ]);
  };

  pseudoElements();
  const fonts = await fontsOf();
  fonts.forEach((f) => declaredFamilies.add(f.family.toLowerCase()));
  await svgImages();

  const body = document.body;
  const pageCss = body ? getComputedStyle(body) : null;
  const ground = pageCss && solid(pageCss.backgroundColor).length ? solid(pageCss.backgroundColor) : solid(getComputedStyle(document.documentElement).backgroundColor);
  const top: Ctx = { clip: PAGE, scale: 1, textFills: null, visible: true };
  const children = body ? sorted(childrenOf(body, pageCss!, top)).flatMap((n) => (n.type === 'GROUP' && n.name === 'body' ? (n.children ?? []) : [n])) : [];
  hosts.forEach((h) => h.remove());

  return {
    title: document.title.trim(),
    url: location.href,
    width,
    height,
    truncated,
    fonts,
    snaps: snaps.map((s) => ({ ...s, mode: s.mode as SnapMode })),
    root: { id: id(), type: 'FRAME', name: document.title.trim() || location.hostname, absoluteBoundingBox: { x: 0, y: 0, width, height }, fills: ground.length ? ground : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], clipsContent: true, children }
  };

  function pseudoElements() {
    const SKIP_PROPS = /^(animation|transition|content$|counter-|quotes$|will-change)/;
    const sheet = new CSSStyleSheet();
    const rules: string[] = [];
    let made = 0;
    for (const el of document.body ? [...document.body.querySelectorAll('*')] : []) {
      if (REPLACED.test(el.tagName.toUpperCase()) || el instanceof SVGElement || made >= limits.nodes) {
        continue;
      }
      for (const which of ['before', 'after'] as const) {
        const pc = getComputedStyle(el, `::${which}`);
        const content = pc.content;
        if (!content || content === 'none' || content === 'normal' || pc.display === 'none') {
          continue;
        }
        const text = [...content.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join('');
        const picture = content.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
        const stand = document.createElement(picture ? 'img' : 'feega-pseudo');
        for (let i = 0; i < pc.length; i++) {
          const prop = pc[i];
          if (!SKIP_PROPS.test(prop)) {
            stand.style.setProperty(prop, pc.getPropertyValue(prop));
          }
        }
        if (picture) {
          (stand as HTMLImageElement).src = picture;
        } else {
          stand.textContent = text;
        }
        const mark = `data-feega-${which}`;
        el.setAttribute(mark, '');
        rules.push(`[${mark}]::${which}{content:none!important}`);
        if (which === 'before') {
          el.insertBefore(stand, el.firstChild);
        } else {
          el.appendChild(stand);
        }
        made++;
      }
    }
    sheet.replaceSync([...new Set(rules)].join('\n'));
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }

  async function svgImages() {
    const images = [...document.images].filter((img) => /\.svg(\?|#|$)|^data:image\/svg/i.test(img.currentSrc || img.src));
    await Promise.all(
      images.map(async (img) => {
        const src = img.currentSrc || img.src;
        if (svgLoaded.has(src)) {
          return;
        }
        const text = await fetch(src)
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => '');
        const doc = text ? new DOMParser().parseFromString(text, 'image/svg+xml') : null;
        const svg = doc?.documentElement;
        if (!svg || svg.tagName !== 'svg' || svg.querySelector('style, script') || !vectorOnly(svg)) {
          return;
        }
        const r = img.getBoundingClientRect();
        const host = document.createElement('div');
        host.setAttribute(limits.hostAttr, '');
        host.style.cssText = `position:absolute;left:${r.left + window.scrollX}px;top:${r.top + window.scrollY}px;width:${r.width}px;height:${r.height}px;opacity:0;pointer-events:none;overflow:hidden;contain:strict`;
        const clone = document.importNode(svg, true) as unknown as SVGSVGElement;
        clone.setAttribute('width', String(r.width));
        clone.setAttribute('height', String(r.height));
        clone.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet');
        if (!clone.getAttribute('viewBox') && svg.getAttribute('width') && svg.getAttribute('height')) {
          clone.setAttribute('viewBox', `0 0 ${parseFloat(svg.getAttribute('width')!)} ${parseFloat(svg.getAttribute('height')!)}`);
        }
        clone.style.cssText = 'display:block;width:100%;height:100%';
        host.appendChild(clone);
        document.body.appendChild(host);
        hosts.push(host);
        svgLoaded.set(src, clone);
      })
    );
    const pending = [...document.querySelectorAll('*')].flatMap((el) => urlsIn(getComputedStyle(el).backgroundImage));
    await Promise.all(
      [...new Set(pending)].map(
        (src) =>
          new Promise<void>((done) => {
            const img = new Image();
            img.onload = () => {
              natural.set(src, { w: img.naturalWidth, h: img.naturalHeight });
              done();
            };
            img.onerror = () => done();
            img.src = src;
          })
      )
    );
  }

  async function fontsOf(): Promise<PageFont[]> {
    const faces: (PageFont & { latin: boolean })[] = [];
    const add = (family: string, src: string, weight: string, style: string, range: string, base: string) => {
      const urls = [...src.matchAll(/url\(["']?([^"')]+)["']?\)\s*(?:format\(["']?([\w-]+)["']?\))?/g)].map((m) => ({ url: new URL(m[1], base).href, format: m[2] ?? '' }));
      const pick = urls.find((u) => /woff2/.test(u.format) || /\.woff2(\?|$)/.test(u.url)) ?? urls.find((u) => /woff|truetype|opentype/.test(u.format) || /\.(woff|ttf|otf)(\?|$)/.test(u.url));
      const latin = !range || /U\+0(?:000)?-|U\+0+0?2?[0-4]|U\+00?41|U\+0-/i.test(range) || /U\+0{0,2}20-/i.test(range);
      if (pick && /^(https?):/.test(pick.url)) {
        faces.push({ family: family.replace(/["']/g, '').trim(), weight: weight || '400', style: style || 'normal', url: pick.url, latin });
      }
    };
    const fromRules = (rules: CSSRuleList, base: string) => {
      for (const rule of rules) {
        if (rule instanceof CSSFontFaceRule) {
          const s = rule.style;
          add(s.getPropertyValue('font-family'), s.getPropertyValue('src'), s.getPropertyValue('font-weight'), s.getPropertyValue('font-style'), s.getPropertyValue('unicode-range'), base);
          continue;
        }
        if (rule instanceof CSSImportRule && rule.styleSheet) {
          readSheet(rule.styleSheet);
          continue;
        }
        if ('cssRules' in rule) {
          fromRules((rule as CSSGroupingRule).cssRules, base);
        }
      }
    };
    const unread: string[] = [];
    const readSheet = (sheet: CSSStyleSheet) => {
      try {
        fromRules(sheet.cssRules, sheet.href ?? location.href);
      } catch {
        if (sheet.href) {
          unread.push(sheet.href);
        }
      }
    };
    [...document.styleSheets].forEach(readSheet);
    await Promise.all(
      unread.map(async (href) => {
        const text =
          sheets[href] ??
          (await fetch(href)
            .then((r) => (r.ok ? r.text() : ''))
            .catch(() => ''));
        for (const block of text.match(/@font-face\s*{[^}]*}/g) ?? []) {
          const get = (prop: string) => block.match(new RegExp(`${prop}\\s*:\\s*([^;}]+)`))?.[1]?.trim() ?? '';
          add(get('font-family'), get('src'), get('font-weight'), get('font-style'), get('unicode-range'), href);
        }
      })
    );
    const best = new Map<string, PageFont & { latin: boolean }>();
    for (const f of faces) {
      const key = `${f.family.toLowerCase()}|${f.weight}|${f.style}`;
      const held = best.get(key);
      if (!held || (f.latin && !held.latin)) {
        best.set(key, f);
      }
    }
    return [...best.values()].map(({ latin: _latin, ...face }) => face);
  }
}
