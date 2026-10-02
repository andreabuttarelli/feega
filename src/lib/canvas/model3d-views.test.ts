import { describe, expect, it } from 'vitest';
import { RENDER_VIEWS, renderViewPositions } from './model3d-views';

describe('render views of a 3D model', () => {
  it('are front, right, back and left, evenly around the model', () => {
    expect(RENDER_VIEWS.map((v) => v.name)).toEqual(['front', 'right', 'back', 'left']);
    expect(RENDER_VIEWS.map((v) => v.azimuthDeg)).toEqual([0, 90, 180, 270]);
  });

  it('keep the camera at the same distance and height, so the four frames match', () => {
    const positions = renderViewPositions(2, 0.5);

    const distances = positions.map((p) => Math.hypot(p.x, p.z));
    for (const d of distances) {
      expect(d).toBeCloseTo(2);
    }
    expect(new Set(positions.map((p) => p.y))).toEqual(new Set([0.5]));
    expect(positions[0].z).toBeCloseTo(2);
    expect(positions[1].x).toBeCloseTo(2);
  });
});
