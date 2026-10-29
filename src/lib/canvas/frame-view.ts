export enum FrameView {
  PixelGrid = 'pixel-grid',
  Guides = 'guides',
  Outlines = 'outlines',
  Pivot = 'pivot',
  Rulers = 'rulers'
}

export type FrameViews = Readonly<Record<FrameView, boolean>>;

export const FRAME_VIEW_DEFAULT: FrameViews = { [FrameView.PixelGrid]: true, [FrameView.Guides]: true, [FrameView.Outlines]: false, [FrameView.Pivot]: false, [FrameView.Rulers]: false };

export const shows = (views: FrameViews, view: FrameView): boolean => views[view];

export const flipView = (views: FrameViews, view: FrameView): FrameViews => ({ ...views, [view]: !views[view] });
