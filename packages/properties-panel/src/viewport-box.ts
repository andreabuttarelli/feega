<<<<<<<< HEAD:packages/properties-panel/src/viewport-box.ts
export enum ViewportMode {
  Fit = 'fit',
  FillWidth = 'fill',
  Actual = 'actual',
  Responsive = 'responsive'
}

export type Size = { w: number; h: number };
export type FrameBox = Size & { scale: number; scrolls: boolean };
export enum WidthSource {
  Frame = 'frame',
  Window = 'window',
  Fixed = 'fixed'
}

export type Viewport = { mode: ViewportMode; width: number; source: WidthSource };
export type WidthChoice = { label: string; width: number };

type ModeSpec = { label: string; scale: (stage: Size, box: Size) => number; scrolls: boolean };

const MIN_STAGE_PX = 1;
const fitsWidth = (stage: Size, box: Size) => Math.max(stage.w, MIN_STAGE_PX) / box.w;

export const MODES: Record<ViewportMode, ModeSpec> = {
  [ViewportMode.Fit]: { label: 'Fit', scale: (stage, box) => Math.min(fitsWidth(stage, box), Math.max(stage.h, MIN_STAGE_PX) / box.h), scrolls: false },
  [ViewportMode.FillWidth]: { label: 'Fill width', scale: fitsWidth, scrolls: true },
  [ViewportMode.Actual]: { label: '100%', scale: () => 1, scrolls: true },
  [ViewportMode.Responsive]: { label: 'Responsive', scale: (stage, box) => Math.min(1, fitsWidth(stage, box)), scrolls: true }
};

export const MODE_ORDER = [ViewportMode.Fit, ViewportMode.FillWidth, ViewportMode.Actual, ViewportMode.Responsive];

export const WIDTH_PRESETS = [
  { label: 'Desktop', width: 1440 },
  { label: 'Tablet', width: 768 },
  { label: 'Mobile', width: 390 }
];

const MIN_WIDTH = 120;
const MAX_WIDTH = 4096;
const DEFAULT: Viewport = { mode: ViewportMode.Responsive, width: WIDTH_PRESETS[0].width, source: WidthSource.Frame };

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT.width;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

const WIDTH_OF: Record<WidthSource, (view: Viewport, stageWidth: number, frameWidth: number) => number> = {
  [WidthSource.Frame]: (_view, _stage, frameWidth) => frameWidth,
  [WidthSource.Window]: (_view, stageWidth) => clampWidth(stageWidth),
  [WidthSource.Fixed]: (view) => view.width
};

export const shownWidth = (view: Viewport, stageWidth: number, frameWidth: number): number => WIDTH_OF[view.source](view, stageWidth, frameWidth);

export function frameBox(mode: ViewportMode, stage: Size, frame: Size, width: number): FrameBox {
  const box = mode === ViewportMode.Responsive ? { w: width, h: frame.h } : frame;
  return { ...box, scale: MODES[mode].scale(stage, box), scrolls: MODES[mode].scrolls };
}

export function parseViewport(raw: string | null): Viewport {
  try {
    const stored = JSON.parse(raw ?? '') as Partial<Viewport>;
    const mode = MODE_ORDER.find((m) => m === stored.mode) ?? DEFAULT.mode;
    const source = Object.values(WidthSource).find((w) => w === stored.source) ?? DEFAULT.source;
    return { mode, width: clampWidth(stored.width ?? DEFAULT.width), source };
  } catch {
    return DEFAULT;
  }
========
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { viewsOf, type Breakpoint } from '@feega/motion-core/motion/breakpoints/model';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import { withContentHeight } from '@feega/motion-core/motion/layout/resolve';
import { WIDTH_PRESETS, ViewportMode, WidthSource, shownWidth, type Viewport, type WidthChoice } from '@feega/properties-panel/viewport-box';

export * from '@feega/properties-panel/viewport-box';

export function viewChoices(doc: MotionDoc): WidthChoice[] {
  const all = [...WIDTH_PRESETS, ...viewsOf(doc).map((v) => ({ label: v.name, width: v.width }))].sort((a, b) => b.width - a.width);
  return all.filter((c, i) => all.findIndex((o) => o.width === c.width) === i);
}

export function activeView(doc: MotionDoc, width: number): Breakpoint {
  const views = viewsOf(doc);
  return views.findLast((view) => view.width >= width) ?? views[0];
}

export function docAtWidth(doc: MotionDoc, width: number): MotionDoc {
  const resolved = resolveView(doc, activeView(doc, width).id);
  return resolved.width === width ? resolved : withContentHeight({ ...resolved, width });
}

export function docShown(doc: MotionDoc, view: Viewport, stageWidth: number): MotionDoc {
  if (view.mode !== ViewportMode.Responsive || view.source === WidthSource.Frame) {
    return doc;
  }
  return docAtWidth(doc, shownWidth(view, stageWidth, doc.width));
>>>>>>>> origin/feat/feega-inspect:src/lib/motion/prototype/viewport.ts
}
