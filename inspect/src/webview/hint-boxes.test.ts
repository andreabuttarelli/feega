import { describe, expect, it } from 'vitest';
import type { Pick } from '../messages';
import { Group } from './controls';
import { hintBoxes } from './hint-boxes';

const pick = {
  rect: { x: 100, y: 50, width: 200, height: 80 },
  styles: { 'padding-top': '10px', 'padding-left': '20px', 'padding-right': '0px', 'padding-bottom': '4px', 'margin-top': '8px', 'margin-left': '0px', 'margin-right': '0px', 'margin-bottom': '0px' }
} as unknown as Pick;

describe('hintBoxes', () => {
  it('padding top is a strip inside the top edge', () => {
    expect(hintBoxes(pick, { group: Group.Padding, sides: ['top'] })).toEqual([{ x: 100, y: 50, w: 200, h: 10 }]);
  });

  it('padding left is a strip inside the left edge', () => {
    expect(hintBoxes(pick, { group: Group.Padding, sides: ['left'] })).toEqual([{ x: 100, y: 50, w: 20, h: 80 }]);
  });

  it('margin top is a strip outside the top edge', () => {
    expect(hintBoxes(pick, { group: Group.Margin, sides: ['top'] })).toEqual([{ x: 100, y: 42, w: 200, h: 8 }]);
  });

  it('empty sides draw nothing, radius draws nothing', () => {
    expect(hintBoxes(pick, { group: Group.Padding, sides: ['right'] })).toEqual([]);
    expect(hintBoxes(pick, { group: Group.Radius, sides: ['top-left'] })).toEqual([]);
  });
});
