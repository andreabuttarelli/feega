// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { snapcnKit } from './kit';

const S = snapcnKit();

describe('snapcn kit media', () => {
  it('loads pictures and clips cross-origin so the canvas can read them', () => {
    expect(S.h('img', { src: 'https://x.test/a.png' }).getAttribute('crossorigin')).toBe('anonymous');
    expect(S.h('video', { src: 'https://x.test/a.mp4' }).getAttribute('crossorigin')).toBe('anonymous');
  });

  it('turns picker items into urls and ignores everything else', () => {
    expect(S.media([{ src: 'a.png', kind: 'image' }, { src: '' }, { src: 'b.mp4', kind: 'video' }])).toEqual(['a.png', 'b.mp4']);
    expect(S.media('')).toEqual([]);
  });
});
