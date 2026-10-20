import { describe, expect, it } from 'vitest';
import { Horizontal, Vertical } from './model';
import { Side, Toggle, toggleHorizontal, toggleVertical } from './sides';

describe('constraint sides', () => {
  it('clicking the other tick pins both sides', () => {
    expect(toggleHorizontal(Horizontal.Left, Side.End, Toggle.One)).toBe(Horizontal.LeftRight);
  });

  it('clicking the pinned tick again releases it', () => {
    expect(toggleVertical(Vertical.TopBottom, Side.Start, Toggle.One)).toBe(Vertical.Bottom);
  });

  it('shift pins both sides at once', () => {
    expect(toggleHorizontal(Horizontal.Scale, Side.Start, Toggle.Both)).toBe(Horizontal.LeftRight);
  });
});
