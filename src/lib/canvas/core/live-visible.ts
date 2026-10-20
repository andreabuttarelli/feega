export type Edges = { left: number; top: number; right: number; bottom: number };

const MIN_SIDE_PX = 1;

export function liveCovers(live: Edges | null, screen: Edges): boolean {
  if (!live || live.right - live.left < MIN_SIDE_PX || live.bottom - live.top < MIN_SIDE_PX) {
    return false;
  }
  return live.left < screen.right && live.right > screen.left && live.top < screen.bottom && live.bottom > screen.top;
}
