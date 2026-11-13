import { describe, expect, it } from 'vitest';
import { PILLARS } from './pillars';

describe('pillars', () => {
  it('numbers the three pillars in order', () => {
    expect(PILLARS.map((p) => p.number)).toEqual(['01', '02', '03']);
  });
});
