import { describe, expect, it } from 'vitest';
import { OVERRIDE_KEYS } from '@feega/motion-core/motion/states/model';
import { OVERRIDE_FIELD, seedOf } from './fields';

describe('state override fields', () => {
  it('every overridable key has a field', () => {
    expect(OVERRIDE_KEYS.filter((k) => !OVERRIDE_FIELD[k])).toEqual([]);
  });

  it('a new override starts from what the layer shows now', () => {
    const clip = { transform: { scale: 1.2 }, props: { fill: '#123456' } };
    expect(seedOf(clip, 'scale')).toBe(1.2);
    expect(seedOf(clip, 'fill')).toBe('#123456');
    expect(seedOf(clip, 'opacity')).toBe(1);
    expect(seedOf(clip, 'stroke')).toBe('#000000');
  });
});
