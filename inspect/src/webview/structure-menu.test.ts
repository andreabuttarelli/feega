import { describe, expect, it } from 'vitest';
import { fitMenu } from './structure-menu';

const VIEW = { width: 1000, height: 900 };

describe('fitMenu', () => {
  it('keeps a menu that fits where it was opened', () => {
    expect(fitMenu({ x: 100, y: 100 }, { width: 160, height: 120 }, VIEW)).toEqual({ x: 100, y: 100 });
  });

  it('lifts a menu that would leave the bottom of the view', () => {
    expect(fitMenu({ x: 100, y: 877 }, { width: 160, height: 120 }, VIEW)).toEqual({ x: 100, y: 772 });
  });

  it('pulls a menu back from the right edge', () => {
    expect(fitMenu({ x: 980, y: 10 }, { width: 160, height: 120 }, VIEW)).toEqual({ x: 832, y: 10 });
  });
});
