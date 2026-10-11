import { describe, expect, it } from 'vitest';
import { PORTRAIT, STAGE, StageLayout, portraitWorld, stageLayout, stageScale } from './stage';

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

describe('the stage layout', () => {
  it('picks the portrait composition under the mobile breakpoint', () => {
    expect(stageLayout(390)).toBe(StageLayout.Portrait);
    expect(stageLayout(360)).toBe(StageLayout.Portrait);
    expect(stageLayout(PORTRAIT.breakpoint)).toBe(StageLayout.Portrait);
  });

  it('keeps the landscape scene above it', () => {
    expect(stageLayout(PORTRAIT.breakpoint + 1)).toBe(StageLayout.Landscape);
    expect(stageLayout(1280)).toBe(StageLayout.Landscape);
  });

  it('keeps the landscape scene before the box has a size', () => {
    expect(stageLayout(0)).toBe(StageLayout.Landscape);
  });
});

describe('the portrait world', () => {
  it('spans the box width and fills its height', () => {
    expect(portraitWorld({ width: PORTRAIT.width, height: 460 })).toEqual({ scale: 1, height: 460 });
    expect(portraitWorld({ width: PORTRAIT.width * 2, height: 1000 })).toEqual({ scale: 2, height: 500 });
  });

  it('is empty before the box has a size', () => {
    expect(portraitWorld({ width: 0, height: 0 })).toEqual({ scale: 0, height: 0 });
  });
});
