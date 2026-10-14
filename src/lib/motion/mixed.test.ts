import { describe, expect, it } from 'vitest';
import { MIXED, shared } from './mixed';

describe('a value across a multiple selection', () => {
  it('is the value when every clip agrees', () => {
    expect(shared([0.5, 0.5, 0.5])).toBe(0.5);
    expect(shared(['normal', 'normal'])).toBe('normal');
  });

  it('is Mixed when they differ', () => {
    expect(shared([0.5, 1])).toBe(MIXED);
  });

  it('is Mixed for an empty selection rather than an invented value', () => {
    expect(shared([])).toBe(MIXED);
  });
});
