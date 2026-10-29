import { describe, expect, it } from 'vitest';
import { Direction } from './auto-layout';
import { DEFAULT_AUTO_LAYOUT } from './model';
import { LayoutKind, layoutKind } from './stack';
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

describe('clipName of a stack', () => {
  it('names an auto layout container after its kind, not its component', () => {
    expect(clipName({ component: 'Shape', props: { shape: 'rect' }, autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction: Direction.Horizontal } })).toBe('Stack');
    expect(clipName({ component: 'Shape', props: { shape: 'rect' } })).toBe('Shape');
  });
});
