import { buildPage } from '@feega/motion-core/motion/codegen/build';
import { NodeKind, type CodeNode, type Rule } from '@feega/motion-core/motion/codegen/ir';
import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { withSurface } from '@feega/motion-core/motion/surface';
import { setParent } from '$lib/motion/parent-ops';
import { mapClips } from './code-look';
import { ClassFamily, arbitraryFamily } from './live-fields';

export type Css = ReadonlyMap<string, string>;

export type ClassCtx = { clip: MotionClip; doc: MotionDoc; origin: MotionClip; css: Css };

export type ClassRow = { family: string; read: (ctx: ClassCtx) => string | undefined; preview: (value: string | undefined, ctx: ClassCtx) => Record<string, string> };

const WRAP = 'live-wrap';
const NO_FLIP = 1;

const CSS_OWNED_ELSEWHERE = new Set([
  'position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'max-width', 'min-width', 'max-height', 'min-height', 'margin-inline', 'margin',
  'display', 'color', 'background', 'background-color', 'font-size', 'font-weight', 'gap', 'row-gap', 'column-gap',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-block', 'padding-inline', 'margin-block', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'border-radius', 'overflow', 'box-sizing'
]);

const arbitrary = (value: string) => value.trim().replace(/\s+/g, '_');

const rawOf = ([, value]: Rule) => (typeof value === 'string' ? value : value.raw);

function ruleOf(nodes: readonly CodeNode[], clipId: string): Rule[] | null {
  for (const node of nodes) {
    if (node.kind === NodeKind.Text || node.kind === NodeKind.Break) {
      continue;
    }
    if (node.clipId === clipId) {
      return node.rules;
    }
    const inner = node.kind === NodeKind.Element ? ruleOf(node.children, clipId) : null;
    if (inner) {
      return inner;
    }
  }
  return null;
}

export function cssOf(doc: MotionDoc, clipId: string): Css {
  const wrapped = withSurface(doc, WRAP);
  const parented = setParent(wrapped, clipId, WRAP, { at: 0 });
  const shown = mapClips(parented.ok ? parented.doc : wrapped, (c) => (c.hidden ? { ...c, hidden: false } : c));
  const page = buildPage({ doc: shown, name: 'live', assets: {}, assetBase: '', brand: null });
  return new Map((ruleOf([page.root], clipId) ?? []).map((rule) => [rule[0], rawOf(rule)]));
}

const CSS_INITIAL: Record<string, string> = { 'flex-direction': 'row' };

const fromCss = (property: string, family: string, make: (value: string) => string, previewAs = property): ClassRow & { property: string; make: (value: string) => string } => ({
  property,
  make,
  family,
  read: (ctx) => ctx.css.get(property) ?? (ctx.css.has('display') ? CSS_INITIAL[property] : undefined),
  preview: (value) => ({ [previewAs]: value ?? '' })
});

const ROTATE = /rotate\((-?[\d.]+deg)\)/;
const ALIGN: Record<string, string> = { 'flex-start': 'start', start: 'start', center: 'center', 'flex-end': 'end', end: 'end', stretch: 'stretch', baseline: 'baseline' };
const JUSTIFY: Record<string, string> = { 'flex-start': 'start', start: 'start', center: 'center', 'flex-end': 'end', end: 'end', 'space-between': 'between', 'space-around': 'around', 'space-evenly': 'evenly' };
const CASE: Record<string, string> = { uppercase: 'uppercase', lowercase: 'lowercase', capitalize: 'capitalize', none: 'normal-case' };
const DIRECTION: Record<string, string> = { row: 'flex-row', column: 'flex-col', 'row-reverse': 'flex-row-reverse', 'column-reverse': 'flex-col-reverse' };

const CSS_ROWS = [
  fromCss('opacity', ClassFamily.Opacity, (v) => `opacity-[${v}]`),
  { ...fromCss('transform', ClassFamily.Rotate, (v) => `rotate-[${v.match(ROTATE)?.[1] ?? '0deg'}]`), preview: (v: string | undefined) => ({ rotate: v?.match(ROTATE)?.[1] ?? '' }) },
  fromCss('mix-blend-mode', ClassFamily.Blend, (v) => `mix-blend-${v}`),
  fromCss('letter-spacing', ClassFamily.Tracking, (v) => `tracking-[${v}]`),
  fromCss('line-height', ClassFamily.Leading, (v) => `leading-[${v}]`),
  fromCss('text-align', ClassFamily.TextAlign, (v) => `text-${v}`),
  fromCss('text-transform', ClassFamily.Case, (v) => CASE[v] ?? `[text-transform:${v}]`),
  fromCss('font-style', ClassFamily.Italic, (v) => (v === 'italic' ? 'italic' : 'not-italic')),
  fromCss('font-family', ClassFamily.FontFamily, (v) => `font-['${arbitrary(v.split(',')[0].replace(/["']/g, ''))}']`),
  fromCss('flex-direction', ClassFamily.Direction, (v) => DIRECTION[v] ?? `[flex-direction:${v}]`),
  fromCss('align-items', ClassFamily.Items, (v) => `items-${ALIGN[v] ?? arbitrary(`[${v}]`)}`),
  fromCss('justify-content', ClassFamily.Justify, (v) => `justify-${JUSTIFY[v] ?? arbitrary(`[${v}]`)}`),
  fromCss('flex-wrap', ClassFamily.Wrap, (v) => (v === 'nowrap' ? 'flex-nowrap' : `flex-${v}`)),
  fromCss('box-shadow', ClassFamily.Shadow, (v) => `shadow-[${arbitrary(v)}]`)
];

const KNOWN_CSS = new Set([...CSS_OWNED_ELSEWHERE, ...CSS_ROWS.map((r) => r.property)]);

export function cssClassOf(row: ClassRow, value: string): string {
  const known = CSS_ROWS.find((r) => r.family === row.family);
  if (known) {
    return known.make(value);
  }
  const property = row.family.slice(row.family.indexOf(':') + 1);
  return `[${property}:${arbitrary(value)}]`;
}

const offset = (axis: 'x' | 'y', side: 'width' | 'height') => (ctx: ClassCtx) => {
  const px = Math.round((Number(ctx.clip.props[axis] ?? 0) - Number(ctx.origin.props[axis] ?? 0)) * ctx.doc[side]);
  return px ? String(px) : undefined;
};

const size = (side: 'width' | 'height') => (ctx: ClassCtx) => {
  const px = Math.round(Number(ctx.clip.props[side] ?? 0) * ctx.doc[side]);
  return px === Math.round(Number(ctx.origin.props[side] ?? 0) * ctx.doc[side]) ? undefined : String(px);
};

const signed = (prefix: string, px: string) => (px.startsWith('-') ? `-${prefix}-[${px.slice(1)}px]` : `${prefix}-[${px}px]`);

const scaleOf = (clip: MotionClip, key: 'scaleX' | 'scaleY') => Number((clip.transform as Record<string, number | undefined>)[key] ?? NO_FLIP);

const DECORATION: Record<string, string> = { underline: 'underline', strikethrough: 'line-through', 'line-through': 'line-through', overline: 'overline' };

const translate = (ctx: ClassCtx) => `${offset('x', 'width')(ctx) ?? 0}px ${offset('y', 'height')(ctx) ?? 0}px`;

export type DirectRow = ClassRow & { make: (value: string) => string };

export const DIRECT_ROWS: DirectRow[] = [
  { family: ClassFamily.TranslateX, read: offset('x', 'width'), make: (v) => signed('translate-x', v), preview: (_, ctx) => ({ translate: translate(ctx) }) },
  { family: ClassFamily.TranslateY, read: offset('y', 'height'), make: (v) => signed('translate-y', v), preview: (_, ctx) => ({ translate: translate(ctx) }) },
  { family: ClassFamily.Width, read: size('width'), make: (v) => `w-[${v}px]`, preview: (v) => ({ width: v ? `${v}px` : '' }) },
  { family: ClassFamily.Height, read: size('height'), make: (v) => `h-[${v}px]`, preview: (v) => ({ height: v ? `${v}px` : '' }) },
  { family: ClassFamily.FlipX, read: (ctx) => (scaleOf(ctx.clip, 'scaleX') < 0 ? '-1' : undefined), make: () => '-scale-x-100', preview: (v) => ({ scale: v ? '-1 1' : '' }) },
  { family: ClassFamily.FlipY, read: (ctx) => (scaleOf(ctx.clip, 'scaleY') < 0 ? '-1' : undefined), make: () => '-scale-y-100', preview: (v) => ({ scale: v ? '1 -1' : '' }) },
  { family: ClassFamily.Hidden, read: (ctx) => (ctx.clip.hidden ? 'hidden' : undefined), make: () => 'hidden', preview: (v) => ({ display: v ? 'none' : '' }) },
  {
    family: ClassFamily.Decoration,
    read: (ctx) => DECORATION[String(ctx.clip.props.decoration ?? '')],
    make: (v) => v,
    preview: (v) => ({ 'text-decoration-line': v ?? '' })
  },
  {
    family: ClassFamily.Clamp,
    read: (ctx) => (ctx.clip.props.truncate ? (ctx.clip.props.maxLines ? `line-clamp-${ctx.clip.props.maxLines}` : 'truncate') : undefined),
    make: (v) => v,
    preview: (v) => (v ? { overflow: 'hidden', display: '-webkit-box', '-webkit-box-orient': 'vertical', '-webkit-line-clamp': v.replace(/\D/g, '') || '1' } : { overflow: '', display: '', '-webkit-line-clamp': '' })
  }
];

export function cssRows(css: Css): ClassRow[] {
  const extra = [...css.keys()].filter((property) => !KNOWN_CSS.has(property)).map((property) => fromCss(property, arbitraryFamily(property), (v) => `[${property}:${arbitrary(v)}]`));
  return [...CSS_ROWS, ...extra];
}

export const directMake = (row: ClassRow) => DIRECT_ROWS.find((r) => r.family === row.family)?.make;

export const liveClipOf = (doc: MotionDoc, id: string) => findClip(doc, id)?.clip;
