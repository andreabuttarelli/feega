import { describe, expect, it } from 'vitest';
import { acceptsProductPhoto, cheapest } from './studio-options';

describe('modelli del Photo studio', () => {
  it('solo un modello che accetta la foto del prodotto come riferimento', () => {
    expect(acceptsProductPhoto({ id: 'nano-banana-2', inputModalities: ['text', 'image'], maxRefs: 10 })).toBe(true);
    expect(acceptsProductPhoto({ id: 'nano-banana-2', inputModalities: ['text'], maxRefs: 3 })).toBe(false);
    expect(acceptsProductPhoto({ id: 'nano-banana-2', inputModalities: ['text', 'image'], maxRefs: undefined })).toBe(false);
  });

  it('solo modelli con una scheda nostra: un sincronizzato senza scheda o un uncensored non rende', () => {
    expect(acceptsProductPhoto({ id: 'recraft/recraft-v4.1-flash', inputModalities: ['text', 'image'], maxRefs: 4 })).toBe(false);
    expect(acceptsProductPhoto({ id: 'wiro/fireredteam/firered-image-edit', inputModalities: ['text', 'image'], maxRefs: 4 })).toBe(false);
  });

  it("l'anteprima va sul più economico", () => {
    expect(cheapest([{ id: 'a', label: 'A', credits: 9, maxRefs: 3 }, { id: 'b', label: 'B', credits: 4, maxRefs: 3 }])?.id).toBe('b');
  });
});
