import { describe, expect, it } from 'vitest';
import { postThumb, productThumb } from './source-thumbs';

describe('source thumbs — the picture a source tile shows per item', () => {
  it('a post shows its first carousel item, else its cover', () => {
    expect(postThumb({ media: { items: [{ thumbnailUrl: 'a' }], thumbnailUrl: 'b' } })).toBe('a');
    expect(postThumb({ media: { thumbnailUrl: 'b' } })).toBe('b');
    expect(postThumb({ media: null })).toBeNull();
  });

  it('a product shows its first image', () => {
    expect(productThumb({ images: [{ url: 'p' }, { url: 'q' }] })).toBe('p');
    expect(productThumb({ images: [] })).toBeNull();
  });
});
