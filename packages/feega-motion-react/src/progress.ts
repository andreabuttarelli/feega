export type Span = { top: number; height: number };

const unit = (v: number) => Math.min(1, Math.max(0, v));

export function travelProgress(box: Span, viewport: Span): number {
  return unit((viewport.top + viewport.height - box.top) / (viewport.height + box.height));
}

export function storyProgress(story: Span, stage: number, viewport: Span): number {
  return unit((viewport.top - story.top) / Math.max(1, story.height - stage));
}

export function isVisible(box: Span, viewport: Span): boolean {
  return box.top + box.height > viewport.top && box.top < viewport.top + viewport.height;
}
