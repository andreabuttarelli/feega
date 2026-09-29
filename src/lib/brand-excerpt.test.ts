import { describe, expect, it } from 'vitest';
import { brandExcerpt } from './brand-excerpt';

describe('brandExcerpt', () => {
  it('la card di un brand non mostra la sintassi markdown del documento', () => {
    expect(brandExcerpt('## Voice\nWarm, **plain**, curious.\n\n## Palette\n#2b2b2b', 300)).toBe(
      'Voice\nWarm, plain, curious.\n\nPalette\n#2b2b2b'
    );
  });

  it('taglia al limite senza spezzare a metà una parola', () => {
    expect(brandExcerpt('Comfortable sustainable shoes', 16)).toBe('Comfortable…');
  });
});
