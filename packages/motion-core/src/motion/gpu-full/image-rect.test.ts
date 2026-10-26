import { describe, expect, it } from 'vitest';
import { cropRect } from './image-rect';

describe('a crop window', () => {
  it('stretches the picture so the window fills the box', () => {
    expect(cropRect({ width: 200, height: 100 }, [0.25, 0.5, 0.5, 0.25])).toEqual({ x: -100, y: -200, width: 400, height: 400 });
  });

  it('the whole picture is the box itself', () => {
    expect(cropRect({ width: 200, height: 100 }, [0, 0, 1, 1])).toEqual({ x: -0, y: -0, width: 200, height: 100 });
  });
});
