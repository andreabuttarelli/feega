import { describe, expect, it } from 'vitest';
import { setCamera, setClipDepth } from './camera-ops';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { sceneMap } from './scene-map';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = (() => {
  let d = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 60 }, 'bg'));
  d = must(addClip(d, { component: 'Title', from: 30, durationInFrames: 60 }, 'title'));
  d = must(setClipDepth(d, 'bg', { depth: 2000 }));
  return must(setCamera(d, { base: { z: 300, focusDistance: 2000 } }));
})();

describe('the scene map seen from above', () => {
  it('places the camera in front of the focus plane 0, at its dolly', () => {
    const map = sceneMap(doc, 0)!;

    expect(map.camera.x).toBe(0);
    expect(map.camera.depth).toBeCloseTo(-(map.rest - 300), 6);
    expect(map.focus).toBe(2000);
  });

  it('draws each world layer at its depth, as wide as it looks at rest, and dims the ones not on screen', () => {
    const map = sceneMap(doc, 0)!;
    const bg = map.layers.find((l) => l.id === 'bg')!;
    const title = map.layers.find((l) => l.id === 'title')!;

    expect(bg.depth).toBe(2000);
    expect(bg.half).toBeCloseTo((960 * (map.rest + 2000)) / map.rest, 6);
    expect(bg.shown).toBe(true);
    expect(title.shown).toBe(false);
  });

  it('frames everything with a margin', () => {
    const map = sceneMap(doc, 0)!;

    expect(map.box.top).toBeLessThan(map.camera.depth);
    expect(map.box.top + map.box.height).toBeGreaterThan(2000);
    expect(map.box.left).toBeLessThan(-map.layers[0].half);
  });

  it('has nothing to draw without a camera', () => {
    expect(sceneMap({ ...doc, camera: null }, 0)).toBeNull();
  });
});
