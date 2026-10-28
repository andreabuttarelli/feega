import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { GuideAxis, MAX_USER_GUIDES, userGuideSchema, type UserGuide } from '@feega/motion-core/motion/user-guides/model';

export { GuideAxis, type UserGuide };

type Frame = Pick<MotionDoc, 'width' | 'height'>;
export type RulerTick = { at: number; label: string };

export enum DropOutcome {
  Keep = 'keep',
  Delete = 'delete'
}

const MIN_TICK_PX = 40;
const TICK_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

const SPAN: Record<GuideAxis, (frame: Frame) => number> = {
  [GuideAxis.Vertical]: (frame) => frame.width,
  [GuideAxis.Horizontal]: (frame) => frame.height
};

const same = (a: UserGuide, b: UserGuide) => a.axis === b.axis && a.at === b.at;

function store(doc: MotionDoc, guides: UserGuide[]): MotionDoc {
  const { userGuides: _, ...rest } = doc;
  return guides.length ? { ...rest, userGuides: guides } : rest;
}

export const dropOutcome = (frame: Frame, guide: UserGuide): DropOutcome => (guide.at < 0 || guide.at > SPAN[guide.axis](frame) ? DropOutcome.Delete : DropOutcome.Keep);

export function addGuide(doc: MotionDoc, guide: UserGuide): OpResult {
  const placed = { axis: guide.axis, at: Math.round(guide.at) };
  const checked = userGuideSchema.safeParse(placed);
  if (!checked.success || dropOutcome(doc, placed) === DropOutcome.Delete) {
    return { ok: false, error: `a ${guide.axis === GuideAxis.Vertical ? 'vertical' : 'horizontal'} guide sits between 0 and ${SPAN[guide.axis](doc)}` };
  }

  const guides = doc.userGuides ?? [];
  if (guides.some((g) => same(g, placed))) {
    return { ok: true, doc };
  }
  if (guides.length >= MAX_USER_GUIDES) {
    return { ok: false, error: `a frame holds at most ${MAX_USER_GUIDES} guides` };
  }
  return { ok: true, doc: store(doc, [...guides, placed]) };
}

export function removeGuide(doc: MotionDoc, guide: UserGuide): OpResult {
  const guides = doc.userGuides ?? [];
  const kept = guides.filter((g) => !same(g, { axis: guide.axis, at: Math.round(guide.at) }));
  if (kept.length === guides.length) {
    return { ok: false, error: 'no guide there' };
  }
  return { ok: true, doc: store(doc, kept) };
}

export function moveGuide(doc: MotionDoc, from: UserGuide, at: number): OpResult {
  const removed = removeGuide(doc, from);
  return removed.ok ? addGuide(removed.doc, { axis: from.axis, at }) : removed;
}

export function tickStep(zoom: number): number {
  return TICK_STEPS.find((step) => step * zoom >= MIN_TICK_PX) ?? TICK_STEPS[TICK_STEPS.length - 1];
}

export function rulerTicks(span: number, zoom: number, labelPx = 0): RulerTick[] {
  const step = tickStep(zoom);
  const last = span - labelPx / zoom;
  return Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => ({ at: i * step, label: String(i * step) })).filter((t) => t.at <= last);
}
