import { describe, expect, it } from 'vitest';
import { diffOf } from './diff-preview';

describe('diffOf', () => {
  it('tiene solo le righe cambiate, con la riga di inizio', () => {
    const before = 'a\nb\nc\nd\n';
    const after = 'a\nb\nX\nY\nc\nd\n';

    expect(diffOf([{ path: 'src/A.tsx', before, after }])).toEqual([{ path: 'src/A.tsx', line: 3, removed: [], added: ['X', 'Y'] }]);
  });

  it('mostra la riga tolta e quella messa al suo posto', () => {
    expect(diffOf([{ path: 'a.css', before: '.a {\n  color: red;\n}\n', after: '.a {\n  color: blue;\n}\n' }])).toEqual([{ path: 'a.css', line: 2, removed: ['  color: red;'], added: ['  color: blue;'] }]);
  });

  it('un file nuovo e tutto aggiunto', () => {
    expect(diffOf([{ path: 'new.css', before: '', after: '.a {}\n' }])).toEqual([{ path: 'new.css', line: 1, removed: [], added: ['.a {}'] }]);
  });

  it('un file senza differenze non compare', () => {
    expect(diffOf([{ path: 'same.css', before: 'x\n', after: 'x\n' }])).toEqual([]);
  });

  it('taglia un diff lungo e dice quante righe mancano', () => {
    const after = Array.from({ length: 30 }, (_, i) => `row ${i}`).join('\n');
    const [file] = diffOf([{ path: 'big.css', before: '', after }]);

    expect(file.added).toHaveLength(8);
    expect(file.more).toBe(22);
  });
});
