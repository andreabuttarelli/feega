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
}
