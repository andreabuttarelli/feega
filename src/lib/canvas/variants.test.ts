import { describe, expect, it } from 'vitest';
import {
  VariantInto,
  variantCountsFor,
  variantsOf,
  effectiveVariants,
  variantsIntoOf,
  variantLayout,
  variantsCredits,
  readRemembered,
  writeRemembered,
  parseVariantsAsk,
  type VariantsStorage
} from './variants';

const memory = (): VariantsStorage => {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
};

describe('variantCountsFor', () => {
  it('offers 1, 2, 4, 8 on an image model', () => {
    expect(variantCountsFor('image')).toEqual([1, 2, 4, 8]);
  });

  it('stops at 4 on video', () => {
    expect(variantCountsFor('video')).toEqual([1, 2, 4]);
  });

  it('offers only 1 where variants make no sense', () => {
    expect(variantCountsFor('text')).toEqual([1]);
    expect(variantCountsFor('audio')).toEqual([1]);
    expect(variantCountsFor('model3d')).toEqual([1]);
  });

  it('never exceeds what the model declares it can do', () => {
    expect(variantCountsFor('image', { maxVariants: 2 })).toEqual([1, 2]);
  });
});

describe('variantsOf', () => {
  it('is 1 when nothing was chosen and nothing remembered', () => {
    expect(variantsOf({}, null)).toBe(1);
  });

  it('falls back to the remembered choice when the node has none', () => {
    expect(variantsOf({}, { count: 4, into: VariantInto.Nodes })).toBe(4);
  });

  it('prefers the node own choice over the remembered one', () => {
    expect(variantsOf({ variants: 2 }, { count: 4, into: VariantInto.Nodes })).toBe(2);
  });

  it('ignores a value that is not on the ladder', () => {
    expect(variantsOf({ variants: 3 }, null)).toBe(1);
    expect(variantsOf({ variants: 'many' as never }, null)).toBe(1);
  });
});

describe('variantsIntoOf', () => {
  it('defaults to separate nodes', () => {
    expect(variantsIntoOf({}, null)).toBe(VariantInto.Nodes);
  });

  it('reads the node, then the remembered choice', () => {
    expect(variantsIntoOf({ variantsInto: VariantInto.History }, null)).toBe(VariantInto.History);
    expect(variantsIntoOf({}, { count: 2, into: VariantInto.History })).toBe(VariantInto.History);
  });

  it('ignores garbage', () => {
    expect(variantsIntoOf({ variantsInto: 'sideways' as never }, null)).toBe(VariantInto.Nodes);
  });
});

describe('variantLayout', () => {
  const source = { x: 100, y: 50, width: 300, height: 200 };

  it('puts one variant right of the source', () => {
    expect(variantLayout(source, 1)).toEqual([{ x: 440, y: 50 }]);
  });

  it('lays four in a 2x2 grid right of the source without overlapping it', () => {
    expect(variantLayout(source, 4)).toEqual([
      { x: 440, y: 50 },
      { x: 780, y: 50 },
      { x: 440, y: 290 },
      { x: 780, y: 290 }
    ]);
  });

  it('gives every variant its own spot', () => {
    const spots = variantLayout(source, 8);

    expect(new Set(spots.map((s) => `${s.x},${s.y}`)).size).toBe(8);
    expect(spots.every((s) => s.x >= source.x + source.width)).toBe(true);
  });
});

describe('variantsCredits', () => {
  it('multiplies the price of one run', () => {
    expect(variantsCredits(5, 4)).toBe(20);
  });

  it('stays unknown when one run is', () => {
    expect(variantsCredits(null, 4)).toBeNull();
  });
});

describe('remembered choice', () => {
  it('is kept per user', () => {
    const storage = memory();
    writeRemembered(storage, 'u1', { count: 4, into: VariantInto.History });

    expect(readRemembered(storage, 'u1')).toEqual({ count: 4, into: VariantInto.History });
    expect(readRemembered(storage, 'u2')).toBeNull();
  });

  it('is null when storage holds garbage', () => {
    const storage = memory();
    storage.setItem('feega:variants:u1', '{nope');

    expect(readRemembered(storage, 'u1')).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken: VariantsStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    };

    expect(readRemembered(broken, 'u1')).toBeNull();
    expect(() => writeRemembered(broken, 'u1', { count: 2, into: VariantInto.Nodes })).not.toThrow();
  });
});

describe('parseVariantsAsk', () => {
  it('reads count and destination', () => {
    expect(parseVariantsAsk({ variants: 4, into: 'history' })).toEqual({ ok: true, count: 4, into: VariantInto.History });
  });

  it('is one run into nodes when absent', () => {
    expect(parseVariantsAsk({})).toEqual({ ok: true, count: 1, into: VariantInto.Nodes });
  });

  it('refuses a count outside 1..8 or not whole', () => {
    expect(parseVariantsAsk({ variants: 0 })).toEqual({ ok: false, error: 'invalid_variants' });
    expect(parseVariantsAsk({ variants: 9 })).toEqual({ ok: false, error: 'invalid_variants' });
    expect(parseVariantsAsk({ variants: 2.5 })).toEqual({ ok: false, error: 'invalid_variants' });
  });

  it('refuses an unknown destination', () => {
    expect(parseVariantsAsk({ variants: 2, into: 'sideways' })).toEqual({ ok: false, error: 'invalid_variants_into' });
  });
});

describe('effectiveVariants', () => {
  it('is what the node asks for within the medium cap', () => {
    expect(effectiveVariants('image', { variants: 4 }, null)).toBe(4);
  });

  it('comes down to the biggest step the medium allows', () => {
    expect(effectiveVariants('video', { variants: 8 }, null)).toBe(4);
    expect(effectiveVariants('image', { variants: 8 }, null, { maxVariants: 2 })).toBe(2);
  });

  it('is one where variants make no sense, even with a remembered four', () => {
    expect(effectiveVariants('text', {}, { count: 4, into: VariantInto.Nodes })).toBe(1);
  });
});
