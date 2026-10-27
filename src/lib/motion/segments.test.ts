import { describe, expect, it } from 'vitest';
import { SegmentIcon, segmentsOf } from './segments';

describe('case options', () => {
  it('every option is an icon with its full name as the label', () => {
    const options = segmentsOf('textCase', ['as-typed', 'upper', 'lower', 'title', 'small-caps']);

    expect(options.every((o) => o.icon !== null)).toBe(true);
    expect(options.map((o) => o.label)).toEqual(['As typed', 'Uppercase', 'Lowercase', 'Title case', 'Small caps']);
    expect(options[4].icon).toBe(SegmentIcon.SmallCaps);
  });
});
