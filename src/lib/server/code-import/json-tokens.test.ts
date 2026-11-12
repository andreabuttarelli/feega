import { describe, expect, it } from 'vitest';
import type { Variables } from '@feega/motion-core/motion/variables-model';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { readTokenFiles } from './json-tokens';
import { designOf } from './design-system';
import { variablesOf } from './design-tokens';
import { writeTokens } from './token-write';

const read = fixture('w3c');

const edited = (variables: Variables, key: string, mode: string, value: unknown): Variables => {
  const [collection, name] = key.split('/');
  const col = variables[collection];
  return { ...variables, [collection]: { ...col, vars: { ...col.vars, [name]: { ...col.vars[name], values: { ...col.vars[name].values, [mode]: value } } } } } as Variables;
};

const changedLines = (before: string, after: string) => {
  const [a, b] = [before.split('\n'), after.split('\n')];
  return a.flatMap((l, i) => (l === b[i] ? [] : [[i + 1, l.trim(), b[i].trim()]]));
};

describe('readTokenFiles', () => {
  it('W3C design tokens: ogni $value è una dichiarazione col suo percorso, il tipo ereditato, gli alias come var(), la riga nel file', async () => {
    const { declared, skipped } = await readTokenFiles(read);

    const of = (name: string) => declared.filter((d) => d.name === name).map((d) => [d.mode, d.raw, `${d.at.file}:${d.at.line}`]);
    expect(of('--color-blue-500')).toEqual([['Light', '#1d4ed8', 'tokens.json:5']]);
    expect(of('--color-primary')).toEqual([['Light', 'var(--color-blue-500)', 'tokens.json:7']]);
    expect(of('--color-surface')).toEqual([
      ['Light', '#ffffff', 'tokens.json:8'],
      ['Dark', '#0b0b0b', 'tokens/dark.tokens.json:3']
    ]);
    expect(of('--spacing-lg')).toEqual([['Light', '1.5rem', 'tokens.json:13']]);
    expect(of('--font-family-sans')).toEqual([['Light', 'Inter, sans-serif', 'tokens.json:20']]);
    expect(skipped).toContain('--shadow-card: a shadow token is not a variable');
  });

  it('un repo senza file di token non dà niente', async () => {
    expect(await readTokenFiles(async () => null)).toEqual({ declared: [], skipped: [] });
  });
});

describe('W3C tokens through the design system', () => {
  it('diventano variabili con i modi, l’alias resta alias, e una modifica riscrive il $value nel suo file', async () => {
    const design = (await designOf(read))!;
    const made = variablesOf(design.set, 'app');

    expect(made.variables['app Colors'].vars.primary.values.Light).toEqual({ alias: 'app Colors/blue-500' });
    expect(made.variables['app Colors'].vars.surface.values).toEqual({ Light: '#ffffff', Dark: '#0b0b0b' });

    const variables = edited(edited(made.variables, 'app Colors/surface', 'Dark', '#111111'), 'app Spacing/md', 'Light', 20);
    const done = await writeTokens(variables, made.map, read);

    const byPath = Object.fromEntries(done.files.map((f) => [f.path, changedLines(f.before, f.after)]));
    expect(byPath).toEqual({
      'tokens/dark.tokens.json': [[3, '"surface": { "$type": "color", "$value": "#0b0b0b" }', '"surface": { "$type": "color", "$value": "#111111" }']],
      'tokens.json': [[12, '"md": { "$value": "16px" },', '"md": { "$value": "20px" },']]
    });
  });
});
