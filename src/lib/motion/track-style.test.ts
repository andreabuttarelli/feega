import { describe, expect, it } from 'vitest';
import { COMPONENTS, type ComponentId } from './components';
import { CLIP_FAMILIES, ClipFamily, Preview, familyOf, tileFrames } from './track-style';

describe('track-style', () => {
  it('every component belongs to a family', () => {
    for (const id of Object.keys(COMPONENTS) as ComponentId[]) {
      expect(CLIP_FAMILIES[familyOf(id)]).toBeDefined();
    }
  });

  it('every family has its own colour', () => {
    const hues = Object.values(CLIP_FAMILIES).map((f) => f.hue.toLowerCase());
    expect(new Set(hues).size).toBe(hues.length);
  });

  it('colours never reuse the selection accent', () => {
    expect(Object.values(CLIP_FAMILIES).map((f) => f.hue.toLowerCase())).not.toContain('#0099ff');
  });

  it('media families preview their content', () => {
    expect(CLIP_FAMILIES[familyOf('Image')].preview).toBe(Preview.Thumb);
    expect(CLIP_FAMILIES[familyOf('Video')].preview).toBe(Preview.Filmstrip);
    expect(CLIP_FAMILIES[familyOf('Audio')].preview).toBe(Preview.Waveform);
    expect(CLIP_FAMILIES[familyOf('Title')].preview).toBe(Preview.Text);
  });

  it('text, 3D and null land in their families', () => {
    expect(familyOf('Caption')).toBe(ClipFamily.Text);
    expect(familyOf('Model3D')).toBe(ClipFamily.ThreeD);
    expect(familyOf('Null')).toBe(ClipFamily.Null);
    expect(familyOf('Custom')).toBe(ClipFamily.Custom);
  });
});

describe('tileFrames', () => {
  const samples = 10;

  it('spreads tiles across the visible span of the source', () => {
    expect(tileFrames({ samples, sourceSeconds: 10, trimSeconds: 0, clipSeconds: 10, tiles: 5 })).toEqual([0, 2, 4, 6, 8]);
  });

  it('starts at the trim point', () => {
    expect(tileFrames({ samples, sourceSeconds: 10, trimSeconds: 5, clipSeconds: 5, tiles: 2 })).toEqual([5, 7]);
  });

  it('never reads past the last sample when the clip outlasts the source', () => {
    expect(Math.max(...tileFrames({ samples, sourceSeconds: 2, trimSeconds: 0, clipSeconds: 20, tiles: 4 }))).toBe(samples - 1);
  });

  it('returns nothing for a source with no samples', () => {
    expect(tileFrames({ samples: 0, sourceSeconds: 0, trimSeconds: 0, clipSeconds: 3, tiles: 3 })).toEqual([]);
  });
});
