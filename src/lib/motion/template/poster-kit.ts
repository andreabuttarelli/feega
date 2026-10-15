import { FORMATS, MotionFormat, type MotionDoc } from '$lib/motion/doc';
import { ComponentMode, PropFormat, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { EffectKind } from '$lib/motion/effects/registry';
import { addEffect } from '$lib/motion/effects/ops';
import { setStill } from '$lib/motion/still';
import type { OpResult } from '$lib/motion/timeline';
import { customTemplateDoc, type CustomTemplateSpec } from './custom-template';
import { MEDIA_LIST } from './media-list';

export const POSTER_SECONDS = 2;
export const POSTER_FORMAT = MotionFormat.Portrait;
export const GRAIN_EFFECT = 'grain';

export const NOISE_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.4'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>";

const must = (name: string, result: OpResult): MotionDoc => {
  if (!result.ok) {
    throw new Error(`${name}: ${result.error}`);
  }
  return result.doc;
};

export function posterTemplateDoc(spec: Omit<CustomTemplateSpec, 'seconds' | 'fps'>, grain: number): MotionDoc {
  const doc = customTemplateDoc({ ...spec, seconds: POSTER_SECONDS, fps: 30 });
  const { width, height } = FORMATS[POSTER_FORMAT];
  const grained = must(spec.name, addEffect({ ...doc, width, height }, spec.clip, EffectKind.Noise, GRAIN_EFFECT, { amount: grain, size: 1.2, evolve: 0 }));
  return must(spec.name, setStill(grained, 0));
}

export const textProp = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
export const linesProp = (title: string, value: string, maxLength = 600): PropSpec => textProp(title, value, { format: PropFormat.Textarea, maxLength });
export const numberProp = (title: string, value: number, minimum: number, maximum: number, step: number, group: PropSpec['group'] = 'Layout'): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
export const colourProp = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });
export const fontProp = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Font, default: value, group: 'Style' });
export const prefixProp = (prefix: string): PropSpec => textProp('Runtime variable prefix', prefix, { group: 'Layout', maxLength: 20 });

const POSTER_HELPERS = String.raw`
const fontOf = (f) => (String(f).includes(',') ? f : '"' + f + '", system-ui, sans-serif');
const escaped = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const linesOf = (s) => String(s || '').split('\n');
const box = (x, y, w, h) => 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;';
const part = (field, index) => ' data-part="' + field + (index === undefined ? '' : ':' + index) + '"';
const numbersOf = (line) => String(line || '').trim().split(/[\s,]+/).map(Number).map((n) => (Number.isFinite(n) ? n : 0));
const upright = (text, x, bottom, px, colour, field = 'caption') =>
  '<div' + part(field) + ' style="position:absolute;left:' + x + 'px;top:' + bottom + 'px;font-size:' + px + 'px;line-height:1;white-space:pre;letter-spacing:0.08em;text-transform:uppercase;transform:rotate(-90deg);transform-origin:0 0;color:' + colour + '">' + escaped(text) + '</div>';
`;

const POSTER_RUN = String.raw`
let drawn = '';
const run = () => {
  const p = { ...props };
  const width = scene.clientWidth || 1080;
  const height = scene.clientHeight || 1350;
  const key = JSON.stringify([p, width, height, document.fonts ? document.fonts.status : 'loaded']);
  if (key === drawn) {
    return;
  }
  drawn = key;
  draw(p, width, height);
};

run();
if (document.fonts) {
  document.fonts.ready.then(() => {
    drawn = '';
    run();
  });
}
tl.to({}, { duration, ease: 'none', onUpdate: run }, 0);
`;

export const POSTER_PHOTOS = String.raw`
${MEDIA_LIST}
const photosOf = (raw) => mediaList(raw).filter((m) => !m.video).map((m) => m.src);
`;

export const POSTER_ART = String.raw`
const artSeq = (k) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const STILL_FORMS = [
  (id, cx, floor, r) => '<circle cx="' + cx + '" cy="' + (floor - r * 0.95) + '" r="' + r + '" fill="url(#' + id + 's)"/>',
  (id, cx, floor, r, dark) => '<circle cx="' + cx + '" cy="' + (floor - r * 1.25) + '" r="' + r * 1.1 + '" fill="none" stroke="url(#' + id + 's)" stroke-width="' + r * 0.32 + '"/><rect x="' + (cx - r * 0.2) + '" y="' + (floor - r * 0.2) + '" width="' + r * 0.4 + '" height="' + r * 0.2 + '" fill="' + dark + '"/>',
  (id, cx, floor, r) => '<rect x="' + (cx - r * 0.9) + '" y="' + (floor - r * 0.7) + '" width="' + r * 1.8 + '" height="' + r * 0.7 + '" fill="url(#' + id + 'b)"/><rect x="' + (cx - r * 0.55) + '" y="' + (floor - r * 1.5) + '" width="' + r * 1.1 + '" height="' + r * 0.8 + '" fill="url(#' + id + 's)"/><circle cx="' + cx + '" cy="' + (floor - r * 1.85) + '" r="' + r * 0.35 + '" fill="url(#' + id + 's)"/>'
];

const stillLife = (id, k, w, h, tones) => {
  const [light, mid, dark] = tones;
  const side = Math.min(w, h);
  const floor = h * (0.58 + artSeq(k + 1) * 0.12);
  const r = side * (0.2 + artSeq(k + 2) * 0.12);
  const cx = w * (0.3 + artSeq(k + 3) * 0.4);
  const bw = side * (0.18 + artSeq(k + 4) * 0.16);
  const bh = h * (0.25 + artSeq(k + 5) * 0.25);
  const bx = cx + (artSeq(k + 6) > 0.5 ? r * 0.6 : -r * 0.6 - bw);
  return '<defs><linearGradient id="' + id + 'w" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="' + light + '"/><stop offset="1" stop-color="' + mid + '"/></linearGradient>' +
    '<linearGradient id="' + id + 'f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + mid + '"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>' +
    '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + light + '"/><stop offset="0.55" stop-color="' + mid + '"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>' +
    '<radialGradient id="' + id + 's" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="' + light + '"/><stop offset="0.6" stop-color="' + mid + '"/><stop offset="1" stop-color="' + dark + '"/></radialGradient></defs>' +
    '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + 'w)"/>' +
    '<rect y="' + floor + '" width="' + w + '" height="' + (h - floor) + '" fill="url(#' + id + 'f)"/>' +
    '<rect x="' + bx + '" y="' + (floor - bh) + '" width="' + bw + '" height="' + bh + '" fill="url(#' + id + 'b)"/>' +
    '<ellipse cx="' + cx + '" cy="' + (floor + r * 0.08) + '" rx="' + r * 1.05 + '" ry="' + r * 0.16 + '" fill="' + dark + '" opacity="0.55"/>' +
    STILL_FORMS[k % STILL_FORMS.length](id, cx, floor, r, dark);
};

const picture = (photos, k, w, h, tones, look = '', salt = 'pa') => {
  const id = salt + k;
  const inner = photos.length
    ? '<image href="' + photos[k % photos.length] + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice" style="filter:' + (look || 'none') + '"/>'
    : stillLife(id, k * 7 + 3, w, h, tones);
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block">' + inner + '</svg>';
};
`;

export const mediaProp = (title: string): PropSpec => textProp(title, '', { format: PropFormat.Media, maxLength: 2000 });

export type PosterSource = { css: string; js: string };

export function posterComponent(source: PosterSource, props: Record<string, PropSpec>): CustomComponent {
  return {
    source: { html: '', css: source.css.trim(), js: [POSTER_HELPERS, source.js, POSTER_RUN].map((s) => s.trim()).join('\n\n') },
    propsSchema: { type: 'object', properties: props },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}

export type TextPartLook = { color: string; x: number; y: number; font?: string; size?: number; weight?: number; lines?: boolean };

const optional = <T>(value: T | undefined, spec: (v: T) => Record<string, PropSpec>): Record<string, PropSpec> => (value === undefined ? {} : spec(value));

export function textPartProps(key: string, title: string, value: string, look: TextPartLook): Record<string, PropSpec> {
  const words = look.lines ? linesProp(title, value) : textProp(title, value, { maxLength: 120 });
  return {
    [key]: words,
    [`${key}Color`]: colourProp(`${title}: colour`, look.color),
    ...optional(look.font, (font) => ({ [`${key}Font`]: fontProp(`${title}: font`, font) })),
    ...optional(look.size, (size) => ({ [`${key}Size`]: numberProp(`${title}: size (% of the width)`, size, 0.4, 60, 0.1) })),
    ...optional(look.weight, (weight) => ({ [`${key}Weight`]: numberProp(`${title}: weight`, weight, 100, 900, 100, 'Style') })),
    [`${key}X`]: numberProp(`${title}: left %`, look.x, -20, 100, 0.5),
    [`${key}Y`]: numberProp(`${title}: top %`, look.y, -20, 100, 0.5)
  };
}

export const smallTextProps = (font: string, size: number): Record<string, PropSpec> => ({
  smallFont: fontProp('Small text font', font),
  smallSize: numberProp('Small text size (% of the width)', size, 0.4, 6, 0.1)
});

export const POSTER_TEXT = String.raw`
const cssFont = (f) => fontOf(f).replace(/"/g, "'");
const sizeOf = (p, key) => (p[key + 'Size'] === undefined ? p.smallSize : p[key + 'Size']);
const textPart = (p, key, width, height, extra = '') =>
  '<div' + part(key) + ' style="position:absolute;margin:0;white-space:pre;line-height:1.04;left:' + (p[key + 'X'] / 100) * width + 'px;top:' + (p[key + 'Y'] / 100) * height + 'px;font-size:' + (sizeOf(p, key) / 100) * width + 'px;font-weight:' + (p[key + 'Weight'] || 'inherit') + ';color:' + p[key + 'Color'] + ';font-family:' + cssFont(p[key + 'Font'] || p.smallFont) + ';' + extra + '">' + escaped(p[key]) + '</div>';
const rowsOf = (raw) => linesOf(raw).filter((l) => l.trim()).map((l) => l.split('|').map((t) => t.trim()));
`;

export const POSTER_SHAPES = String.raw`
const roundedPath = (points, r) => {
  const n = points.length;
  const near = (a, b, d) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = Math.min(d, len / 2) / len;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  return points.map((v, i) => {
    const before = near(v, points[(i + n - 1) % n], r);
    const after = near(v, points[(i + 1) % n], r);
    return (i ? 'L' : 'M') + before[0] + ' ' + before[1] + 'Q' + v[0] + ' ' + v[1] + ' ' + after[0] + ' ' + after[1];
  }).join('') + 'Z';
};

const starPath = (cx, cy, r, inner, points, turn = 0) => {
  const all = [];
  for (let i = 0; i < points * 2; i++) {
    const a = turn + (Math.PI * i) / points - Math.PI / 2;
    const d = i % 2 ? r * inner : r;
    all.push((i ? 'L' : 'M') + (cx + Math.cos(a) * d) + ' ' + (cy + Math.sin(a) * d));
  }
  return all.join('') + 'Z';
};

const gooFilter = (id, blur) => '<filter id="' + id + '" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="' + blur + '"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12"/></filter>';

const dotPattern = (id, step, r, colour) => '<pattern id="' + id + '" width="' + step + '" height="' + step + '" patternUnits="userSpaceOnUse"><circle cx="' + step / 2 + '" cy="' + step / 2 + '" r="' + r + '" fill="' + colour + '"/></pattern>';
`;
