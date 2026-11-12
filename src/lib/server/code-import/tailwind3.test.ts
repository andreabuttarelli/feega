import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classTokens, configTokens } from './tailwind3';
import { tokenSetOf } from './design-tokens';
import { madeStyles, styleTokensOf } from './design-styles';

const resolved = async () => JSON.parse(await readFile(join(process.cwd(), 'tests/fixtures/design-tokens/tailwind3/resolved-config.json'), 'utf8')) as unknown;

const CONFIG = 'tailwind.config.ts';

describe('configTokens', () => {
  it('una config Tailwind 3 risolta diventa le stesse dichiarazioni di un @theme Tailwind 4', async () => {
    const declared = configTokens(await resolved(), CONFIG);

    const raw = Object.fromEntries(declared.map((d) => [d.name, d.raw]));
    expect(raw).toMatchObject({
      '--color-primary': 'hsl(222.2 47.4% 11.2%)',
      '--color-primary-foreground': 'hsl(210 40% 98%)',
      '--color-blue-500': '#3b82f6',
      '--spacing-4': '1rem',
      '--spacing-0.5': '0.125rem',
      '--radius': '0.25rem',
      '--radius-lg': '0.5rem',
      '--font-sans': 'Inter, ui-sans-serif, system-ui',
      '--text-sm': '0.875rem',
      '--text-sm--line-height': 'calc(1.25 / 0.875)',
      '--text-base': '1rem',
      '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      '--breakpoint-md': '768px'
    });
    expect(declared.every((d) => d.mode === 'Light' && d.at.file === CONFIG)).toBe(true);
  });

  it('i token passano dalla stessa pipeline: variabili, stili, e quelli non letterali restano fuori', async () => {
    const parsed = { declared: configTokens(await resolved(), CONFIG), rules: [], skipped: [], blocks: [], typed: [] };

    const set = tokenSetOf(parsed);

    expect(set.tokens.map((t) => t.name)).toEqual(expect.arrayContaining(['--color-primary', '--color-blue-500', '--spacing-4', '--radius-lg', '--font-sans', '--breakpoint-md']));
    expect(set.tokens.map((t) => t.name)).not.toContain('--color-current');
    expect(Object.keys(madeStyles(styleTokensOf(parsed), 'app', { side: 1280, scale: 1 }).styles)).toEqual(expect.arrayContaining(['app Text/sm', 'app Shadow/md']));
  });

  it('un JSON che non è una config risolta non dà niente', () => {
    expect(configTokens(null, CONFIG)).toEqual([]);
    expect(configTokens({ theme: 'x' }, CONFIG)).toEqual([]);
  });
});

describe('classTokens', () => {
  it('ogni classe che la config genera porta al suo token', async () => {
    const map = classTokens(await resolved());

    expect(map.get('bg-primary')).toBe('--color-primary');
    expect(map.get('text-primary-foreground')).toBe('--color-primary-foreground');
    expect(map.get('border-blue-500')).toBe('--color-blue-500');
    expect(map.get('p-4')).toBe('--spacing-4');
    expect(map.get('gap-0.5')).toBe('--spacing-0.5');
    expect(map.get('rounded')).toBe('--radius');
    expect(map.get('rounded-lg')).toBe('--radius-lg');
    expect(map.get('font-sans')).toBe('--font-sans');
    expect(map.get('text-sm')).toBe('--text-sm');
    expect(map.get('shadow-md')).toBe('--shadow-md');
  });
});
