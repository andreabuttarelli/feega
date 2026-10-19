import type { MotionDoc } from '../doc';
import type { Box } from '../layout';
import type { Bounds } from '../scene-select';
import type { OpResult } from '../timeline';
import { GuideKind, MAX_LAYOUT_GUIDES, layoutGuideSchema, type LayoutGuide } from './model';

export { GuideKind, type LayoutGuide };

type Size = { width: number; height: number };
export type GuideLine = { axis: 'x' | 'y'; at: number };

export const newGuide = (kind: GuideKind): LayoutGuide => layoutGuideSchema.parse({ kind });

function bandsAlong(guide: LayoutGuide, span: number): [number, number][] {
  const inner = span - 2 * guide.margin - guide.gutter * (guide.count - 1);
  const band = Math.max(0, inner / guide.count);
  return Array.from({ length: guide.count }, (_, i) => [guide.margin + i * (band + guide.gutter), band]);
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

const shownGuides = (doc: Pick<MotionDoc, 'layoutGuides'>) => (doc.layoutGuides ?? []).filter((g) => !g.hidden);

export function guideSnapBounds(doc: Pick<MotionDoc, 'layoutGuides' | 'width' | 'height'>): Bounds[] {
  return shownGuides(doc)
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
