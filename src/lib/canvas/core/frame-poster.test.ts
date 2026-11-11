import { describe, expect, it } from 'vitest';
import { ItemKind } from '@feega/motion-core/motion/gpu-full/display-list';
import { postersFor, showsPoster } from './frame-poster';

const poster = (id: string) => ({ key: `poster:${id}`, frame: { id } });

describe('frame posters', () => {
  it('a frame the core draws whole needs no poster', () => {
    expect(postersFor([poster('a'), poster('b')], new Set(['a'])).map((p) => p.frame.id)).toEqual(['b']);
  });

  it('a frame not loaded yet, or with content the core cannot draw, shows its poster', () => {
    expect(postersFor([poster('a')], new Set())).toEqual([poster('a')]);
  });
});

describe('showsPoster', () => {
  it('una card con l\'immagine del poster conta come mostrata', () => {
    expect(showsPoster({ items: [{ kind: ItemKind.Path }, { kind: ItemKind.Group, items: [{ kind: ItemKind.Image }] }] })).toBe(true);
  });

  it('una card vuota no', () => {
    expect(showsPoster({ items: [{ kind: ItemKind.Path }] })).toBe(false);
  });
});
