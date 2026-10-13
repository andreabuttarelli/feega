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

type Bounds = { x: number; y: number; width: number; height: number };
export type Viewport = { x: number; y: number; zoom: number };

export function frameIn(node: Bounds, screen: Screen, free: Insets, maxZoom: number): Viewport {
  const room = { width: screen.width - free.left - free.right - 2 * MARGIN_PX, height: screen.height - free.top - free.bottom - 2 * MARGIN_PX };
  const zoom = Math.min(maxZoom, room.width / node.width, room.height / node.height);
  const centre = { x: free.left + (screen.width - free.left - free.right) / 2, y: free.top + (screen.height - free.top - free.bottom) / 2 };
  return { zoom, x: centre.x - (node.x + node.width / 2) * zoom, y: centre.y - (node.y + node.height / 2) * zoom };
}

export enum FocusMode {
  Frame = 'frame',
  Select = 'select'
}

export type FocusRequest = { ids: string[]; key: number; free?: Insets; mode?: FocusMode };
