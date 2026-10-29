import { describe, expect, it } from 'vitest';
import { Direction } from './auto-layout';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM } from './model';
import { LayoutKind, Placement, layoutKind, placementOf } from './stack';
import { clipName } from '../organize';

describe('layoutKind', () => {
  it.each([
    [Direction.Horizontal, LayoutKind.Stack],
    [Direction.Vertical, LayoutKind.Stack],
    [Direction.Grid, LayoutKind.Grid]
  ])('reads a saved %s auto layout container as a %s', (direction, kind) => {
    expect(layoutKind({ autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction } })).toBe(kind);
  });

  it('a clip without auto layout is no stack', () => {
    expect(layoutKind({})).toBeNull();
    expect(layoutKind({ autoLayout: null })).toBeNull();
  });
});

describe('placementOf', () => {
  const stack = { autoLayout: DEFAULT_AUTO_LAYOUT };

  it('a clip outside any layout places itself', () => {
    expect(placementOf({}, null)).toBe(Placement.Free);
    expect(placementOf({}, {})).toBe(Placement.Free);
  });

  it('a stack child is placed by its stack', () => {
    expect(placementOf({}, stack)).toBe(Placement.Flow);
  });

  it('an absolute stack child places itself relative to the stack', () => {
    expect(placementOf({ layoutItem: { ...DEFAULT_LAYOUT_ITEM, absolute: true } }, stack)).toBe(Placement.Absolute);
  });
});

describe('clipName of a stack', () => {
  it('names an auto layout container after its kind, not its component', () => {
    expect(clipName({ component: 'Shape', props: { shape: 'rect' }, autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction: Direction.Horizontal } })).toBe('Stack');
    expect(clipName({ component: 'Shape', props: { shape: 'rect' } })).toBe('Shape');
  });
});
