import { describe, expect, it } from 'vitest';
import { CameraMotion, tileDom } from './camera-motion';

const SELECTED = { on: true, resizable: true, showAdd: true, marks: ['m1', 'm2'] };

describe('tileDom', () => {
  it('renders no per-tile chrome while the camera moves, so a gesture updates no tile DOM', () => {
    expect(tileDom(SELECTED, CameraMotion.Moving)).toEqual({ on: false, resizable: false, showAdd: false, marks: [] });
  });

  it('gives the chrome back as soon as the camera rests, so pointers work right after', () => {
    expect(tileDom(SELECTED, CameraMotion.Still)).toEqual(SELECTED);
  });
});
