import { describe, expect, it } from 'vitest';
import { LineMove, lineDiff } from './line-diff';

describe('il diff per righe', () => {
  it('le righe uguali restano, le cambiate escono e entrano', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc')).toEqual([
      { move: LineMove.Same, text: 'a' },
      { move: LineMove.Removed, text: 'b' },
      { move: LineMove.Added, text: 'B' },
      { move: LineMove.Same, text: 'c' }
    ]);
  });

  it('un file nuovo è tutto aggiunto, uno tolto tutto rimosso', () => {
    expect(lineDiff(null, 'x')).toEqual([{ move: LineMove.Added, text: 'x' }]);
    expect(lineDiff('x', null)).toEqual([{ move: LineMove.Removed, text: 'x' }]);
  });
});
