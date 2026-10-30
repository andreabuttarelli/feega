import { Direction } from './auto-layout';
import type { AutoLayout, LayoutItem } from './model';

export enum LayoutKind {
  Stack = 'stack',
  Grid = 'grid'
}

const KIND_OF_DIRECTION: Record<Direction, LayoutKind> = {
  [Direction.Horizontal]: LayoutKind.Stack,
  [Direction.Vertical]: LayoutKind.Stack,
  [Direction.Grid]: LayoutKind.Grid
};

export const LAYOUT_KIND_LABEL: Record<LayoutKind, string> = {
  [LayoutKind.Stack]: 'Stack',
  [LayoutKind.Grid]: 'Grid'
};

type Laid = { autoLayout?: Pick<AutoLayout, 'direction'> | null };

export const layoutKind = (clip: Laid): LayoutKind | null => (clip.autoLayout ? KIND_OF_DIRECTION[clip.autoLayout.direction] : null);

export enum Placement {
  Free = 'free',
  Flow = 'flow',
  Absolute = 'absolute'
}

type Placeable = { layoutItem?: Pick<LayoutItem, 'absolute'> | null };

export function placementOf(clip: Placeable, parent: Laid | null): Placement {
  if (!parent?.autoLayout) {
    return Placement.Free;
  }
  return clip.layoutItem?.absolute ? Placement.Absolute : Placement.Flow;
}
