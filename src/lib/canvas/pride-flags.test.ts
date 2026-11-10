import { describe, expect, it } from 'vitest';
import { PRIDE_FLAGS, PrideFlag, flagGradient, nextFlag } from './pride-flags';

const memory = (start: string | null) => {
  let value = start;
  return { getItem: () => value, setItem: (_: string, v: string) => void (value = v) };
};

describe('nextFlag', () => {
  it('rotates through every flag in order, then repeats', () => {
    const store = memory(PRIDE_FLAGS.at(-1)!.flag);
    const seen = Array.from({ length: PRIDE_FLAGS.length + 1 }, () => nextFlag(store).flag);
    expect(seen).toEqual([...PRIDE_FLAGS.map((f) => f.flag), PRIDE_FLAGS[0].flag]);
  });

  it('starts at the rainbow on a first visit', () => {
    expect(nextFlag(memory(null)).flag).toBe(PrideFlag.Rainbow);
  });

  it('falls back to the rainbow when storage throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(nextFlag(broken).flag).toBe(PrideFlag.Rainbow);
  });

  it('falls back to the rainbow on a stored value it does not know', () => {
    expect(nextFlag(memory('banana')).flag).toBe(PrideFlag.Rainbow);
  });
});

describe('flagGradient', () => {
  it('blends the stripes smoothly, white drawn light grey on the white loading screen', () => {
    expect(flagGradient(['#FFFFFF', '#000000', '#FF0000'])).toBe('linear-gradient(to right, #ECECEC 0%, #000000 50%, #FF0000 100%)');
  });
});
