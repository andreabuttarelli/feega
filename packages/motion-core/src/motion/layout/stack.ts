import { Direction } from './auto-layout';
import type { AutoLayout } from './model';

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
