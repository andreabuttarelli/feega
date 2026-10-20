import { Horizontal, Vertical } from './model';

export enum Side {
  Start = 'start',
  End = 'end'
}

export enum Toggle {
  One = 'one',
  Both = 'both'
}

type Pinned = { start: boolean; end: boolean };

const FROM_HORIZONTAL: Record<Horizontal, Pinned> = {
  [Horizontal.Left]: { start: true, end: false },
  [Horizontal.Right]: { start: false, end: true },
  [Horizontal.LeftRight]: { start: true, end: true },
  [Horizontal.Center]: { start: false, end: false },
  [Horizontal.Scale]: { start: false, end: false }
};

const FROM_VERTICAL: Record<Vertical, Pinned> = {
  [Vertical.Top]: { start: true, end: false },
  [Vertical.Bottom]: { start: false, end: true },
  [Vertical.TopBottom]: { start: true, end: true },
  [Vertical.Center]: { start: false, end: false },
  [Vertical.Scale]: { start: false, end: false }
};

export const pinnedHorizontally = (h: Horizontal): Pinned => FROM_HORIZONTAL[h];

export const pinnedVertically = (v: Vertical): Pinned => FROM_VERTICAL[v];

function next(was: Pinned, side: Side, how: Toggle): Pinned {
  const flipped = !was[side];
  return how === Toggle.Both ? { start: flipped, end: flipped } : { ...was, [side]: flipped };
}

export function toggleHorizontal(h: Horizontal, side: Side, how: Toggle): Horizontal {
  const now = next(FROM_HORIZONTAL[h], side, how);
  if (now.start && now.end) {
    return Horizontal.LeftRight;
  }
  return now.start ? Horizontal.Left : now.end ? Horizontal.Right : Horizontal.Scale;
}

export function toggleVertical(v: Vertical, side: Side, how: Toggle): Vertical {
  const now = next(FROM_VERTICAL[v], side, how);
  if (now.start && now.end) {
    return Vertical.TopBottom;
  }
  return now.start ? Vertical.Top : now.end ? Vertical.Bottom : Vertical.Scale;
}
