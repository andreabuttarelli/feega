import { describe, expect, it } from 'vitest';
import { resolveMedia } from './compose';

const asset = (id: string | null) => (id === 'a' ? 'https://cdn/a.png' : null);

describe('a media list reaches the component slot by slot', () => {
  it('an empty slot keeps its place so later pictures stay where they were put', () => {
    expect(resolveMedia([{ assetId: '', kind: 'image' }, { assetId: 'a', kind: 'image' }], asset)).toEqual([
      { src: '', kind: 'image' },
      { src: 'https://cdn/a.png', kind: 'image' }
    ]);
  });

  it('a picture carries its fit and focus', () => {
    expect(resolveMedia([{ assetId: 'a', kind: 'image', fit: 'contain', focusX: 0.2, focusY: 0.7 }], asset)).toEqual([
      { src: 'https://cdn/a.png', kind: 'image', fit: 'contain', focusX: 0.2, focusY: 0.7 }
    ]);
  });

  it('a legacy comma list passes through', () => {
    expect(resolveMedia('a, b', asset)).toBe('a, b');
  });
});
