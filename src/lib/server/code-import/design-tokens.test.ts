import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_VARIABLES, VarType, variablesSchema } from '@feega/motion-core/motion/variables-model';
import { PAGE_SHEET, parseSheets, readSheets } from './css-tokens';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { TokenKind, collectionName, tokenSetOf, variableName, variablesOf } from './design-tokens';

const setOf = async (name: string) => tokenSetOf(parseSheets(await readSheets(fixture(name))));

describe('variableName', () => {
  it.each([
    ['--color-primary', 'primary'],
    ['--color-brand-blue', 'brand-blue'],
    ['--spacing-0.5', '0_5'],
    ['--radius-card', 'card'],
    ['--radius', 'radius'],
    ['--font-sans', 'sans'],
    ['--primary', 'primary']
  ])('%s diventa %s', (source, name) => {
    expect(variableName(source)).toBe(name);
  });

  it('il nome della collezione prende il nome del repo senza il dominio', () => {
    expect(collectionName('traidue.com', 'Colors')).toBe('traidue Colors');
    expect(collectionName('my/odd repo!', 'Palette')).toBe('my-odd repo- Palette');
  });
});

describe('tokenSetOf', () => {
  it('Tailwind 4: colori, raggi, spaziature e famiglie, ognuno col suo tipo; la scala del testo non è una variabile: diventa uno stile, senza finire tra i lasciati fuori', async () => {
    const set = await setOf('tailwind4');
    const kinds = Object.fromEntries(set.tokens.map((t) => [t.name, t.kind]));

    expect(kinds).toMatchObject({ '--color-primary': TokenKind.Colour, '--radius-card': TokenKind.Radius, '--spacing-gutter': TokenKind.Spacing, '--font-sans': TokenKind.Font, '--color-surface': TokenKind.Colour });
    expect(kinds['--text-hero']).toBeUndefined();
    expect(set.skipped.some((s) => s.startsWith('--text-hero'))).toBe(false);
    expect(set.modes).toEqual(['Light', 'Dark']);
  });

  it('shadcn: un calc() non è un valore letterale e resta fuori', async () => {
    const set = await setOf('shadcn');

    expect(set.tokens.map((t) => t.name)).not.toContain('--radius-sm');
    expect(set.skipped).toContain('--radius-sm: computed with calc(), not a literal');
  });

  it('CSS semplice: un nome senza prefisso è un colore se il valore lo è, uno spazio se il nome lo dice, altrimenti resta fuori', async () => {
    const set = await setOf('plain');
    const kinds = Object.fromEntries(set.tokens.map((t) => [t.name, t.kind]));

    expect(kinds).toEqual({ '--brand': TokenKind.Colour, '--brand-ink': TokenKind.Colour, '--gap-md': TokenKind.Spacing });
    expect(set.skipped).toContain('--header-height: not a colour, radius, spacing or font token');
    expect(set.modes).toEqual(['Light', 'Dark', 'Ocean']);
  });
});

describe('variablesOf', () => {
  it('Tailwind 4: ogni multiplo di --spacing usato da una classe diventa una variabile, a meno che il repo dichiari già --spacing-N', async () => {
    const made = variablesOf(await setOf('tailwind4'), 'app', { multiples: [4, 0.5] });

    expect(made.variables['app Spacing'].vars['4']).toEqual({ type: VarType.Number, values: { Light: 16 } });
    expect(made.map['app Spacing/4']).toMatchObject({ name: '--spacing', factor: 4, raw: { Light: '0.25rem' }, origins: { Light: 'src/theme/extra.css:3:1' } });
    expect(made.variables['app Spacing'].vars['0_5'].values.Light).toBe(2);
    expect(made.map['app Spacing/0_5']).toMatchObject({ name: '--spacing-0.5' });
  });


  it('traidue-like: una collezione Colors con Light e Dark, i nomi del repo, e la mappa che riporta ogni valore alla sua dichiarazione', async () => {
    const made = variablesOf(await setOf('tailwind4'), 'traidue.com');
    const colors = made.variables['traidue Colors'];

    expect(variablesSchema.safeParse(made.variables).success).toBe(true);
    expect(colors.modes).toEqual(['Light', 'Dark']);
    expect(colors.vars.primary).toEqual({ type: VarType.Colour, values: { Light: '#111111', Dark: '#f0f0f0' } });
    expect(colors.vars['brand-blue'].values).toEqual({ Light: '#5bcefa', Dark: '#5bcefa' });
    expect(made.variables['traidue Spacing'].vars).toEqual({ gutter: { type: VarType.Number, values: { Light: 24 } }, '0_5': { type: VarType.Number, values: { Light: 2 } }, spacing: { type: VarType.Number, values: { Light: 4 } } });
    expect(made.variables['traidue Type'].vars.sans).toEqual({ type: VarType.String, values: { Light: "'Inter', system-ui, sans-serif" } });
    expect(made.map['traidue Colors/primary']).toEqual({ name: '--color-primary', origins: { Light: 'src/app.css:6:1', Dark: 'src/app.css:22:1' }, raw: { Light: '#111111', Dark: '#f0f0f0' } });
    expect(made.map['traidue Colors/brand-blue'].origins).toEqual({ Light: 'src/app.css:13:1' });
  });

  it('shadcn: --color-primary è un alias verso Palette/primary, che porta i modi', async () => {
    const made = variablesOf(await setOf('shadcn'), 'acme');

    expect(variablesSchema.safeParse(made.variables).success).toBe(true);
    expect(made.variables['acme Colors'].vars.primary.values).toEqual({ Light: { alias: 'acme Palette/primary' } });
    expect(made.variables['acme Palette'].vars.primary.values).toEqual({ Light: '#171717', Dark: '#e5e5e5' });
    expect(made.variables['acme Radius'].vars.lg.values).toEqual({ Light: { alias: 'acme Radius/radius' } });
    expect(made.variables['acme Radius'].vars.radius.values).toEqual({ Light: 10 });
  });

  it('i numeri sono in unità del documento: la scala li moltiplica e la mappa la ricorda', async () => {
    const made = variablesOf(await setOf('tailwind4'), 'app', { scale: 0.5 });

    expect(made.variables['app Radius'].vars.card.values.Light).toBe(6);
    expect(made.map['app Radius/card'].scale).toBe(0.5);
  });

  it('oltre 64 variabili per collezione, le usate restano e le altre sono elencate come lasciate fuori', () => {
    const many = Array.from({ length: MAX_VARIABLES + 2 }, (_, i) => `  --color-c${i}: #${String(i).padStart(6, '0')};`).join('\n');
    const set = tokenSetOf(parseSheets([{ path: 'a.css', text: `@theme {\n${many}\n}` }]));

    const made = variablesOf(set, 'app', { used: new Set(['--color-c65']) });

    expect(Object.keys(made.variables['app Colors'].vars)).toHaveLength(MAX_VARIABLES);
    expect(made.variables['app Colors'].vars.c65).toBeDefined();
    expect(made.dropped).toEqual(['--color-c63: over the 64-variable limit of app Colors', '--color-c64: over the 64-variable limit of app Colors']);
  });

  it('un alias il cui bersaglio è stato lasciato fuori resta fuori anche lui, e lo dice', () => {
    const set = tokenSetOf(parseSheets([{ path: 'a.css', text: ':root { --a: var(--missing); }' }]));

    expect(set.tokens).toEqual([]);
    expect(set.skipped).toContain('--a: alias to --missing, which is not a token here');
  });

  it('MUI CSS-vars: il tema scuro di MUI è il modo Dark, il raggio in camelCase è un raggio', async () => {
    const text = await readFile(join(process.cwd(), 'tests/fixtures/design-tokens/mui/css-vars.css'), 'utf8');

    const set = tokenSetOf(parseSheets([{ path: `${PAGE_SHEET}inline 1`, text }]));

    const byName = Object.fromEntries(set.tokens.map((t) => [t.name, t]));
    expect(Object.keys(byName['--mui-palette-primary-main'].values)).toEqual(['Light', 'Dark']);
    expect(byName['--mui-shape-borderRadius'].kind).toBe(TokenKind.Radius);
    expect(byName['--mui-spacing'].kind).toBe(TokenKind.Spacing);
  });
});

describe('Arc tokens', () => {
  it('light and dark land as the modes of the palette, every accent as a mode of its own collection', async () => {
    const { variables } = variablesOf(await setOf('arc'), 'arc');

    expect(variables['arc Palette'].modes).toEqual(['Light', 'Dark']);
    expect(variables['arc Palette'].vars.accent.values).toEqual({ Light: expect.anything(), Dark: expect.anything() });
    expect(variables['arc Accent'].modes).toEqual(['Neutral', 'Violet', 'Blue', 'Green', 'Amber', 'Orange', 'Coral', 'Rose']);
    expect(variables['arc Accent'].vars.accent.type).toBe(VarType.Colour);
  });

  it('an accent inside dark mode stays out and says so', async () => {
    const set = await setOf('arc');
    expect(set.skipped.some((s) => s.startsWith('--accent under :root[data-theme="dark"][data-accent="violet"]'))).toBe(true);
  });
});
