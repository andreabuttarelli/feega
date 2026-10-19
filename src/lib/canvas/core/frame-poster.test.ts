import { describe, expect, it } from 'vitest';
import { postersFor } from './frame-poster';

const poster = (id: string) => ({ key: `poster:${id}`, frame: { id } });

describe('frame posters', () => {
  it('a frame the core draws whole needs no poster', () => {
    expect(postersFor([poster('a'), poster('b')], new Set(['a'])).map((p) => p.frame.id)).toEqual(['b']);
  });

  it('a frame not loaded yet, or with content the core cannot draw, shows its poster', () => {
    expect(postersFor([poster('a')], new Set())).toEqual([poster('a')]);
  });
});
