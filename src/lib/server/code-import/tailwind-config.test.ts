import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { readTailwindConfig, readConfigText } from './tailwind-config';
import { designOf } from './design-system';

const FILE = 'tailwind.config.ts';

const configText = async () => (await fixture('tailwind3-config')(FILE))!;

describe('readConfigText', () => {
  it('legge i letterali del tema e dice dove stanno', async () => {
    const read = readConfigText(await configText(), FILE);

    const byName = Object.fromEntries(read.declared.map((d) => [d.name, d]));
    expect(byName['--color-brand-500'].raw).toBe('#3b82f6');
    expect(byName['--color-brand-500'].at).toEqual({ file: FILE, line: 9, column: (await configText()).split('\n')[8].indexOf("'#3b82f6'") });
    expect(byName['--color-brand'].raw).toBe('#3b82f6');
    expect(byName['--spacing-18'].raw).toBe('4.5rem');
    expect(byName['--radius-card'].raw).toBe('0.75rem');
    expect(byName['--font-display'].raw).toBe('Fraunces, serif');
    expect(byName['--text-hero'].raw).toBe('3rem');
    expect(byName['--text-hero--letter-spacing'].raw).toBe('-0.02em');
    expect(byName['--text-hero--font-weight'].raw).toBe('700');
    expect(byName['--breakpoint-tablet'].raw).toBe('768px');
  });

  it('hsl(var(--x)) diventa un alias di --x', async () => {
    const read = readConfigText(await configText(), FILE);

    expect(read.declared.find((d) => d.name === '--color-surface')?.raw).toBe('var(--background)');
  });

  it('un valore che non è un letterale resta fuori e lo dice, senza inventare quello che c\'è', async () => {
    const read = readConfigText(await configText(), FILE);

    expect(read.declared.map((d) => d.name)).not.toContain('--font-sans');
    expect(read.skipped).toContain('--font-sans: tailwind.config.ts:15 is not a literal (a spread or a reference)');
  });

  it('una funzione del tema è elencata, non eseguita', () => {
    const read = readConfigText("export default { theme: { extend: { colors: ({ theme }) => ({ a: theme('x') }) } } };", FILE);

    expect(read.declared).toEqual([]);
    expect(read.skipped).toEqual(['--color: tailwind.config.ts:1 is a function, not a literal']);
  });

  it('module.exports e una variabile con satisfies si leggono come export default', () => {
    const cjs = readConfigText("module.exports = { theme: { spacing: { a: '1px' } } };", 'tailwind.config.cjs');
    const typed = readConfigText("const c = { theme: { spacing: { a: '2px' } } } satisfies Config; export default c;", FILE);

    expect(cjs.declared.map((d) => d.raw)).toEqual(['1px']);
    expect(typed.declared.map((d) => d.raw)).toEqual(['2px']);
  });
});

describe('readTailwindConfig', () => {
  it('trova la config dal nome o da components.json', async () => {
    const found = await readTailwindConfig(fixture('tailwind3-config'));

    expect(found.declared.length).toBeGreaterThan(10);
    expect(await readTailwindConfig(fixture('shadcn'))).toEqual({ declared: [], skipped: [] });
  });
});

describe('designOf con una config Tailwind 3', () => {
  it('colori, spaziature, raggi, famiglie, breakpoint e stili entrano nel design', async () => {
    const design = (await designOf(fixture('tailwind3-config')))!;

    const names = design.set.tokens.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['--color-brand-500', '--color-ink', '--color-surface', '--spacing-gutter', '--radius-card', '--font-display', '--breakpoint-tablet']));
    expect(design.styles.map((s) => s.leaf)).toEqual(expect.arrayContaining(['hero', 'card']));
  });
});
