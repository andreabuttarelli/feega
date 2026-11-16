import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { designOf } from './design-system';
import { readSassText, readSassVars } from './sass-vars';

const SCSS = 'src/styles/_variables.scss';

describe('readSassText', () => {
  it('una variabile SCSS con un letterale è una dichiarazione, con il suo posto', () => {
    const read = readSassText('$brand: #ff0066;\n$gap: 1rem !default;', SCSS);

    expect(read.declared).toEqual([
      { name: '--brand', raw: '#ff0066', mode: 'Light', at: { file: SCSS, line: 1, column: 8 } },
      { name: '--gap', raw: '1rem', mode: 'Light', at: { file: SCSS, line: 2, column: 6 } }
    ]);
  });

  it('un riferimento a un\'altra variabile è un alias; una funzione o un\'espressione resta fuori e lo dice', () => {
    const read = readSassText('$a: #fff;\n$b: $a;\n$c: darken($a, 10%);\n$d: $a * 2;', SCSS);

    expect(read.declared.map((d) => [d.name, d.raw])).toEqual([['--a', '#fff'], ['--b', 'var(--a)']]);
    expect(read.skipped).toEqual(['--c: src/styles/_variables.scss:3 is a Sass expression, not a literal', '--d: src/styles/_variables.scss:4 is a Sass expression, not a literal']);
  });

  it('LESS: @nome: valore', () => {
    const read = readSassText('@brand: #00aaff;\n@media (min-width: 1px) {\n}\n@radius-lg: 12px;', 'src/styles/variables.less');

    expect(read.declared.map((d) => [d.name, d.raw])).toEqual([['--brand', '#00aaff'], ['--radius-lg', '12px']]);
  });
});

describe('readSassVars', () => {
  it('trova i file delle variabili nelle cartelle comuni', async () => {
    const read = await readSassVars(fixture('scss-less'));

    expect(read.declared.map((d) => d.name)).toEqual(expect.arrayContaining(['--brand', '--radius-md', '--gap', '--font-body', '--brand-less', '--radius-lg']));
  });
});

describe('designOf con SCSS e LESS', () => {
  it('le variabili diventano token e quelle non letterali sono elencate', async () => {
    const design = (await designOf(fixture('scss-less')))!;

    expect(design.set.tokens.map((t) => t.name)).toEqual(expect.arrayContaining(['--brand', '--radius-md', '--gap', '--font-body', '--accent']));
    expect(design.set.skipped.some((s) => s.startsWith('--brand-dark'))).toBe(true);
  });
});
