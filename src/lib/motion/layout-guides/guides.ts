import type { MotionDoc } from '../doc';
import type { Box } from '../layout';
import type { Bounds } from '../scene-select';
import type { OpResult } from '../timeline';
import { AUTO_COUNT, GuideAlign, GuideKind, MAX_LAYOUT_GUIDES, layoutGuideSchema, type LayoutGuide } from './model';

export { GuideAlign, GuideKind, type LayoutGuide };

type Size = { width: number; height: number };
export type GuideLine = { axis: 'x' | 'y'; at: number };

export const newGuide = (kind: GuideKind): LayoutGuide => layoutGuideSchema.parse({ kind });

const MAX_AUTO_BANDS = 256;

const AVAILABLE: Record<GuideAlign, (guide: LayoutGuide, span: number) => number> = {
  [GuideAlign.Stretch]: (guide, span) => span - 2 * guide.margin,
  [GuideAlign.Min]: (guide, span) => span - guide.offset,
  [GuideAlign.Max]: (guide, span) => span - guide.offset,
  [GuideAlign.Center]: (_guide, span) => span
};

const STARTS_AT: Record<GuideAlign, (guide: LayoutGuide, span: number, total: number) => number> = {
  [GuideAlign.Stretch]: (guide) => guide.margin,
  [GuideAlign.Min]: (guide) => guide.offset,
  [GuideAlign.Max]: (guide, span, total) => span - guide.offset - total,
  [GuideAlign.Center]: (_guide, span, total) => (span - total) / 2
};

function countOf(guide: LayoutGuide, span: number): number {
  if (guide.count !== AUTO_COUNT) {
    return guide.count;
  }
  const fits = Math.floor((AVAILABLE[guide.align](guide, span) + guide.gutter) / (guide.size + guide.gutter));
  return Math.max(1, Math.min(MAX_AUTO_BANDS, fits));
}

function bandsAlong(guide: LayoutGuide, span: number): [number, number][] {
  const count = countOf(guide, span);
  const gutters = guide.gutter * (count - 1);
  const band = guide.align === GuideAlign.Stretch ? Math.max(0, (AVAILABLE[guide.align](guide, span) - gutters) / count) : guide.size;
  const start = STARTS_AT[guide.align](guide, span, band * count + gutters);
  return Array.from({ length: count }, (_, i) => [start + i * (band + guide.gutter), band]);
}

const BANDS: Record<GuideKind, (guide: LayoutGuide, frame: Size) => Box[]> = {
  [GuideKind.Columns]: (guide, frame) => bandsAlong(guide, frame.width).map(([left, width]) => ({ left, top: 0, width, height: frame.height })),
  [GuideKind.Rows]: (guide, frame) => bandsAlong(guide, frame.height).map(([top, height]) => ({ left: 0, top, width: frame.width, height })),
  [GuideKind.Grid]: () => []
};

export const guideBands = (guide: LayoutGuide, frame: Size): Box[] => BANDS[guide.kind](guide, frame);

function every(size: number, span: number): number[] {
  return Array.from({ length: Math.max(0, Math.ceil(span / size) - 1) }, (_, i) => (i + 1) * size);
}

export function guideLines(guide: LayoutGuide, frame: Size): GuideLine[] {
  if (guide.kind !== GuideKind.Grid) {
    return [];
  }
  return [...every(guide.size, frame.width).map((at) => ({ axis: 'x' as const, at })), ...every(guide.size, frame.height).map((at) => ({ axis: 'y' as const, at }))];
}

export function guideSnapBounds(doc: Pick<MotionDoc, 'layoutGuides' | 'width' | 'height'>): Bounds[] {
  return (doc.layoutGuides ?? [])
    .flatMap((g) => guideBands(g, doc))
    .map((b) => ({ left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height }));
}

export function setLayoutGuides(doc: MotionDoc, guides: readonly LayoutGuide[]): OpResult {
  if (guides.length > MAX_LAYOUT_GUIDES) {
    return { ok: false, error: `a frame holds at most ${MAX_LAYOUT_GUIDES} layout guides` };
  }
  const parsed = guides.map((g) => layoutGuideSchema.safeParse(g));
  const bad = parsed.find((p) => !p.success);
  if (bad && !bad.success) {
    return { ok: false, error: `layout guide: ${bad.error.issues[0]?.message ?? 'invalid'}` };
  }
  const { layoutGuides: _, ...rest } = doc;
  const kept = parsed.flatMap((p) => (p.success ? [p.data] : []));
  return { ok: true, doc: kept.length ? { ...rest, layoutGuides: kept } : rest };
}
