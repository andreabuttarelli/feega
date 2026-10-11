import { describe, expect, it } from 'vitest';
import { STAGE, stageScale } from './stage';

describe('the stage scale', () => {
  it('fits the scene height in a wide box', () => {
    expect(stageScale({ width: STAGE.width * 2, height: STAGE.height })).toBe(1);
    expect(stageScale({ width: STAGE.width * 4, height: STAGE.height * 2 })).toBe(2);
  });

  it('on a narrow box crops the sides down to the safe zone, never further', () => {
    expect(stageScale({ width: STAGE.safeWidth, height: STAGE.height * 2 })).toBe(1);
    expect(stageScale({ width: STAGE.safeWidth / 2, height: STAGE.height })).toBe(0.5);
  });

  it('is zero before the box has a size', () => {
    expect(stageScale({ width: 0, height: 0 })).toBe(0);
  });
});
