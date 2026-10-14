import { describe, expect, it } from 'vitest';
import { resolveMedia } from './compose';
import { fillsSchema } from '../fill/model';

const image = (raw: Record<string, unknown>) => fillsSchema.parse([{ type: 'image', ...raw }]);

const asset = (id: string | null) => (id === 'a' ? 'https://cdn/a.png' : null);

describe('a media list reaches the component slot by slot', () => {
  it('an empty slot keeps its place so later pictures stay where they were put', () => {
    expect(resolveMedia([{ assetId: '', kind: 'image' }, { assetId: 'a', kind: 'image' }], asset)).toEqual([
      { src: '', kind: 'image', fills: [] },
      { src: 'https://cdn/a.png', kind: 'image', fills: image({ assetId: 'a', src: 'https://cdn/a.png' }) }
    ]);
  });

  it('a picture carries its fit and focus', () => {
    expect(resolveMedia([{ assetId: 'a', kind: 'image', fit: 'contain', focusX: 0.2, focusY: 0.7 }], asset)).toEqual([
      { src: 'https://cdn/a.png', kind: 'image', fit: 'contain', focusX: 0.2, focusY: 0.7, fills: image({ assetId: 'a', src: 'https://cdn/a.png', fit: 'contain', focus: { x: 0.2, y: 0.7 } }) }
    ]);
  });

  it('a photo with a fill stack reaches the slot with its pictures and colours resolved', () => {
    const fills = [{ type: 'image', assetId: 'a' }, { type: 'solid', color: 'brand.accent', opacity: 0.4 }];
    const [slot] = resolveMedia([{ assetId: 'a', kind: 'image', fills }], asset, (c) => (c === 'brand.accent' ? '#ff0000' : c)) as { fills: unknown[] }[];
    expect(slot.fills).toEqual(fillsSchema.parse([{ type: 'image', assetId: 'a', src: 'https://cdn/a.png' }, { type: 'solid', color: '#ff0000', opacity: 0.4 }]));
  });

  it('a legacy comma list passes through', () => {
    expect(resolveMedia('a, b', asset)).toBe('a, b');
  });
});
