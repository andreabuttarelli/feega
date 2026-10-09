// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { neutralised, pathStyles } from './raster-key';

describe('a cached raster keeps its key across frames', () => {
  it('neutralising and restoring its path leaves the key unchanged', () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'position:absolute;left:0px;top:340px;opacity:0.5');
    const before = pathStyles([el]);
    neutralised([el])();
    expect(pathStyles([el])).toBe(before);
  });

  it('a real style change still changes the key', () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'left:0px');
    const before = pathStyles([el]);
    el.style.left = '4px';
    expect(pathStyles([el])).not.toBe(before);
  });
});
