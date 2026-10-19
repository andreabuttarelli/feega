import { describe, expect, it } from 'vitest';
import { textured } from './texture-budget';

const view = { x: 0, y: 0, zoom: 1 };
const screen = { width: 1000, height: 1000 };

describe('texture budget', () => {
  it('only visible media holds a texture; text costs nothing', () => {
    const items = [
      { id: 'img', x: 0, y: 0, w: 100, h: 100, bytes: 1000 },
      { id: 'far', x: 9000, y: 9000, w: 100, h: 100, bytes: 1000 },
      { id: 'text', x: 0, y: 0, w: 100, h: 100, bytes: 0 }
    ];
    expect(textured(items, view, screen, 10_000)).toEqual(['img']);
  });

  it('over budget, the largest on screen keep their texture', () => {
    const items = [
      { id: 'small', x: 0, y: 0, w: 50, h: 50, bytes: 600 },
      { id: 'big', x: 100, y: 0, w: 500, h: 500, bytes: 600 }
    ];
    expect(textured(items, view, screen, 1000)).toEqual(['big']);
  });
});
