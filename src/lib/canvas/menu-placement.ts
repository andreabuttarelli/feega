type Point = { x: number; y: number };
type Size = { width: number; height: number };

export type MenuPlacement = { x: number; y: number; maxHeight: number; scrollable: boolean };

const VIEWPORT_MARGIN = 8;

export function placeMenu({ anchor, size, viewport }: { anchor: Point; size: Size; viewport: Size }): MenuPlacement {
  const room = viewport.height - 2 * VIEWPORT_MARGIN;
  const x = Math.max(VIEWPORT_MARGIN, Math.min(anchor.x, viewport.width - VIEWPORT_MARGIN - size.width));

  if (size.height > room) {
    return { x, y: VIEWPORT_MARGIN, maxHeight: room, scrollable: true };
  }

  const y = Math.min(anchor.y, viewport.height - VIEWPORT_MARGIN - size.height);
  return { x, y, maxHeight: room, scrollable: false };
}
