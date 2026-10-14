export enum SideMode {
  Side = 'side',
  Sheet = 'sheet'
}

export const SIDE_WIDTH = 240;
export const SIDE_GAP = 8;
export const PHONE_MAX = 640;

export type SideInput = {
  row: { top: number; bottom: number };
  edge: number;
  height: number;
  viewport: { width: number; height: number };
};

export type SidePlace = { mode: SideMode.Side; left: number; top: number; width: number } | { mode: SideMode.Sheet };

export function sidePlacement({ row, edge, height, viewport }: SideInput): SidePlace {
  if (viewport.width < PHONE_MAX) {
    return { mode: SideMode.Sheet };
  }
  const lowest = viewport.height - SIDE_GAP - height;
  const top = Math.max(SIDE_GAP, Math.min(row.top, lowest));
  return { mode: SideMode.Side, left: Math.max(SIDE_GAP, edge - SIDE_GAP - SIDE_WIDTH), top, width: SIDE_WIDTH };
}
