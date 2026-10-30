import { describe, expect, it } from 'vitest';
import { ComponentDropOn, componentDropTarget } from './component-drop';

const frames = [
  { id: 'frame', takesDrops: true },
  { id: 'free', takesDrops: false }
];

describe('where a dragged component lands', () => {
  it('a frame under the pointer takes it', () => {
    expect(componentDropTarget('frame', frames)).toEqual({ on: ComponentDropOn.Frame, frameId: 'frame' });
  });

  it('empty canvas makes it a free element', () => {
    expect(componentDropTarget(null, frames)).toEqual({ on: ComponentDropOn.Canvas });
  });

  it('a free element under the pointer does not swallow it', () => {
    expect(componentDropTarget('free', frames)).toEqual({ on: ComponentDropOn.Canvas });
  });

  it('a paste with no frame under the pointer falls back to the selected frame', () => {
    expect(componentDropTarget(null, frames, 'frame')).toEqual({ on: ComponentDropOn.Frame, frameId: 'frame' });
  });
});
