import { describe, expect, it } from 'vitest';
import { uploadWithin } from './picture-uploads';

describe('uploadWithin', () => {
  it('continua a caricare i frame in parallelo finché resta tempo', () => {
    const left = new Map([['a', 3], ['b', 2]]);
    let clock = 0;

    const done = uploadWithin(['a', 'b'], (g) => (clock++, left.set(g, left.get(g)! - 1), left.get(g) === 0), () => clock, 100);

    expect(done).toEqual(['b', 'a']);
  });

  it('si ferma allo scadere del budget', () => {
    let clock = 0;

    const done = uploadWithin(['a', 'b'], () => ((clock += 10), false), () => clock, 25);

    expect(done).toEqual([]);
    expect(clock).toBe(30);
  });

  it('fa sempre almeno un giro, anche senza tempo', () => {
    const tried: string[] = [];

    uploadWithin(['a', 'b'], (g) => (tried.push(g), false), () => 0, 0);

    expect(tried).toEqual(['a', 'b']);
  });
});
