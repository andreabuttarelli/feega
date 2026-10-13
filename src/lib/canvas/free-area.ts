type Box = { left: number; top: number; right: number; bottom: number };
type Screen = { width: number; height: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

export enum Dock {
  TopBar = 'top-bar',
  LeftBar = 'left-bar',
  LeftPanel = 'left-panel',
  RightPanel = 'right-panel',
  Timeline = 'timeline'
}

export enum Edge {
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left'
}

export const DOCK_ATTR = 'data-dock';

export const DOCK_EDGE: Record<Dock, Edge> = {
  [Dock.TopBar]: Edge.Top,
  [Dock.LeftBar]: Edge.Left,
  [Dock.LeftPanel]: Edge.Left,
  [Dock.RightPanel]: Edge.Right,
  [Dock.Timeline]: Edge.Bottom
};

const REACH: Record<Edge, (b: Box, s: Screen) => number> = {
  [Edge.Top]: (b) => b.bottom,
  [Edge.Right]: (b, s) => s.width - b.left,
  [Edge.Bottom]: (b, s) => s.height - b.top,
  [Edge.Left]: (b) => b.right
};

const clip = (b: Box, s: Screen): Box => ({ left: Math.max(0, b.left), top: Math.max(0, b.top), right: Math.min(s.width, b.right), bottom: Math.min(s.height, b.bottom) });

const occupies = (b: Box) => b.right > b.left && b.bottom > b.top;

export function freeArea(screen: Screen, docked: readonly { dock: Dock; box: Box }[]): Insets {
  const insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const { dock, box } of docked) {
    const shown = clip(box, screen);
    if (!occupies(shown)) {
      continue;
    }
    const edge = DOCK_EDGE[dock];
    insets[edge] = Math.max(insets[edge], REACH[edge](shown, screen));
  }
  return insets;
}

const MARGIN_PX = 32;

type Px = `${number}px`;
export type FitPadding = { top: Px; right: Px; bottom: Px; left: Px };
export type FocusRequest = { ids: string[]; key: number; padding?: FitPadding };

const px = (n: number): Px => `${Math.round(n + MARGIN_PX)}px`;

export const fitPadding = (free: Insets): FitPadding => ({ top: px(free.top), right: px(free.right), bottom: px(free.bottom), left: px(free.left) });
