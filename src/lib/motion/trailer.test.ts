import { describe, expect, it } from 'vitest';
import { parseMotionDoc, clipsOf } from './doc';
import { feegaTrailer } from './trailer';

describe('feega trailer', () => {
  it('is a valid 18 second landscape doc', () => {
    const doc = feegaTrailer({ modelId: 'glb', imageId: 'img' });

    expect(parseMotionDoc(doc).ok).toBe(true);
    expect([doc.width, doc.height, doc.durationInFrames]).toEqual([1920, 1080, 540]);
  });

  it('carries a 3D model clip when a model exists, a 3D shape otherwise', () => {
    expect(clipsOf(feegaTrailer({ modelId: 'glb', imageId: null })).some((c) => c.component === 'Model3D')).toBe(true);
    expect(clipsOf(feegaTrailer({ modelId: null, imageId: null })).some((c) => c.component === 'Shape3D')).toBe(true);
  });

  it('text sits on the top track, above media and background', () => {
    expect(feegaTrailer({ modelId: null, imageId: null }).tracks.map((t) => t.id)).toEqual(['text', 'media', 'bg', 'a1']);
  });
});
