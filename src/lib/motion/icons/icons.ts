import type { MotionDoc } from '../doc';
import { FillType } from '../fill/model';
import { ShapeKind } from '../shape/schema';
import { StrokeAlign } from '../stroke/model';
import { addClip, type OpResult } from '../timeline';
import { ICON_PATHS } from './paths';

export const ICON_NAMES = Object.keys(ICON_PATHS);

const STROKE_SHARE = 2 / 24;
const ROUND = 'round';

export type IconInput = { name: string; x: number; y: number; size: number; color: string; from: number; durationInFrames?: number; trackId?: string };

export function iconProps(doc: Pick<MotionDoc, 'width' | 'height'>, input: Omit<IconInput, 'from' | 'durationInFrames' | 'trackId'>): Record<string, unknown> | string {
  const path = ICON_PATHS[input.name];
  if (!path) {
    return `no icon ${input.name}: ${ICON_NAMES.join(', ')}`;
  }
  const short = Math.min(doc.width, doc.height);
  return {
    shape: ShapeKind.Path,
    path,
    x: input.x,
    y: input.y,
    width: (input.size * short) / doc.width,
    height: (input.size * short) / doc.height,
    fills: [],
    strokes: [{ paint: { type: FillType.Solid, color: input.color }, width: input.size * STROKE_SHARE, align: StrokeAlign.Center, cap: ROUND, join: ROUND }]
  };
}

export function addIcon(doc: MotionDoc, input: IconInput, id: string): OpResult {
  const props = iconProps(doc, input);
  if (typeof props === 'string') {
    return { ok: false, error: props };
  }
  return addClip(doc, { component: 'Shape', from: input.from, durationInFrames: input.durationInFrames, trackId: input.trackId, props }, id);
}
