export enum FrameView {
  PixelGrid = 'pixel-grid',
  Guides = 'guides',
  Outlines = 'outlines'
}

export type FrameViews = Readonly<Record<FrameView, boolean>>;

export const FRAME_VIEW_DEFAULT: FrameViews = { [FrameView.PixelGrid]: true, [FrameView.Guides]: true, [FrameView.Outlines]: false };

export const shows = (views: FrameViews, view: FrameView): boolean => views[view];

export const flipView = (views: FrameViews, view: FrameView): FrameViews => ({ ...views, [view]: !views[view] });
