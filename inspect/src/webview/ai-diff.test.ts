import { describe, expect, it } from 'vitest';
import { DiffLine, lineDiff } from './ai-diff';

describe('the diff preview', () => {
  it('marks every line added for a new file', () => {
    expect(lineDiff(null, 'a\nb')).toEqual([
      { kind: DiffLine.Added, text: 'a' },
      { kind: DiffLine.Added, text: 'b' }
    ]);
  });

  it('keeps the shared head and tail and swaps the middle', () => {
    expect(lineDiff('a\nb\nc', 'a\nx\nc')).toEqual([
      { kind: DiffLine.Same, text: 'a' },
      { kind: DiffLine.Removed, text: 'b' },
      { kind: DiffLine.Added, text: 'x' },
      { kind: DiffLine.Same, text: 'c' }
    ]);
  });

  it('shows no change lines for identical text', () => {
    expect(lineDiff('a', 'a').every((l) => l.kind === DiffLine.Same)).toBe(true);
  });
});
