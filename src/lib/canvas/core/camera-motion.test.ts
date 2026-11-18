import { describe, expect, it } from 'vitest';
import { CameraMotion, screenOverlays, tileDom } from './camera-motion';

const SELECTED = { on: true, resizable: true, showAdd: true, marks: ['m1', 'm2'] };

describe('tileDom', () => {
  it('renders no per-tile chrome while the camera moves, so a gesture updates no tile DOM', () => {
    expect(tileDom(SELECTED, CameraMotion.Moving)).toEqual({ on: false, resizable: false, showAdd: false, marks: [] });
  });

  it('gives the chrome back as soon as the camera rests, so pointers work right after', () => {
    expect(tileDom(SELECTED, CameraMotion.Still)).toEqual(SELECTED);
  });
});

describe('screenOverlays', () => {
  const FRAMES = [{ id: 'a' }, { id: 'b' }, { id: 'typed' }];
  const editing = (id: string) => id === 'typed';

  it('keeps only the frame being edited while the camera moves, so no other overlay restyles per frame', () => {
    expect(screenOverlays(FRAMES, editing, CameraMotion.Moving)).toEqual([{ id: 'typed' }]);
  });

  it('brings every overlay back at rest', () => {
    expect(screenOverlays(FRAMES, editing, CameraMotion.Still)).toEqual(FRAMES);
  });
});
