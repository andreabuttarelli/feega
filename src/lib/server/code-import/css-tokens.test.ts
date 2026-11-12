import { describe, expect, it } from 'vitest';
import { PAGE_SHEET, parseSheets, readSheets } from './css-tokens';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';

const declared = async (name: string) => parseSheets(await readSheets(fixture(name)));

describe('readSheets', () => {
  it('trova il foglio di una app Tailwind e segue i suoi @import relativi, non quelli dei pacchetti', async () => {
    expect((await readSheets(fixture('tailwind4'))).map((s) => s.path)).toEqual(['src/app.css', 'src/theme/extra.css']);
  });

  it('in un progetto shadcn legge il foglio che components.json dichiara', async () => {
    expect((await readSheets(fixture('shadcn'))).map((s) => s.path)).toEqual(['src/styles/globals.css']);
  });

  it('una cartella senza fogli non dà niente', async () => {
    expect(await readSheets(async () => null)).toEqual([]);
  });
});

describe('readSheets dai fogli che la pagina ha caricato', () => {
  it('Nuxt 4: il foglio servito dal dev server porta al suo file nel repo, fuori dalla lista nota', async () => {
    const sheets = await readSheets(fixture('nuxt4'), [{ at: '/vercel/sandbox/app/assets/css/main.css?direct', text: ':root{--ui-radius:.375rem}' }]);

    expect(sheets.map((s) => s.path)).toEqual(['app/assets/css/main.css']);
  });

  it('monorepo: dal foglio della app segue un @import di un pacchetto del workspace fino al suo file', async () => {
    const sheets = await readSheets(fixture('monorepo'), [{ at: '/Users/me/acme/apps/web/src/app.css', text: '' }]);

    expect(sheets.map((s) => s.path)).toEqual(['apps/web/src/app.css', 'packages/ui/src/theme.css']);
  });

  it('un foglio senza file nel repo entra dal testo della pagina, segnato come letto dalla pagina', async () => {
    const sheets = await readSheets(fixture('plain'), [{ at: '/_next/static/css/app/layout.css', text: ':root{--ink:#123456}' }, { text: ':root{--paper:#fefefe}' }]);

    expect(sheets.map((s) => s.path)).toEqual(['src/index.css', `${PAGE_SHEET}/_next/static/css/app/layout.css`, `${PAGE_SHEET}inline 2`]);
  });

  it('un foglio caricato da node_modules non si legge dal repo: entra dal testo della pagina', async () => {
    const read = async (path: string) => (path === 'node_modules/leaflet/dist/leaflet.css' ? '.leaflet-bar{box-shadow:0 1px 5px rgba(0,0,0,.65)}' : null);

    const sheets = await readSheets(read, [{ at: '/Users/me/app/node_modules/leaflet/dist/leaflet.css', text: '.x{}' }]);

    expect(sheets.map((s) => s.path)).toEqual([`${PAGE_SHEET}/Users/me/app/node_modules/leaflet/dist/leaflet.css`]);
  });

  it('un foglio che è sia nella lista nota sia caricato dalla pagina si legge una volta', async () => {
    const sheets = await readSheets(fixture('plain'), [{ at: '/src/index.css', text: ':root{--brand:#000}' }]);

    expect(sheets.map((s) => s.path)).toEqual(['src/index.css']);
  });
});

describe('parseSheets', () => {
  it('un token dichiarato in un file del repo vince sullo stesso nome letto dalla pagina', () => {
    const parsed = parseSheets([
      { path: 'src/app.css', text: ':root {\n  --brand: #ff5500;\n}\n' },
      { path: `${PAGE_SHEET}inline 1`, text: ':root{--brand:#000000;--ink:#123456}' }
    ]);

    expect(parsed.declared.map((d) => [d.name, d.raw, d.at.file])).toEqual([
      ['--brand', '#ff5500', 'src/app.css'],
      ['--ink', '#123456', `${PAGE_SHEET}inline 1`]
    ]);
  });

  it('@theme è il modo Light, .dark il modo Dark, con file, riga e colonna di ogni dichiarazione', async () => {
    const { declared: found } = await declared('tailwind4');
    const primary = found.filter((d) => d.name === '--color-primary');

    expect(primary).toEqual([
      { name: '--color-primary', raw: '#111111', mode: 'Light', at: { file: 'src/app.css', line: 6, column: 1 } },
      { name: '--color-primary', raw: '#f0f0f0', mode: 'Dark', at: { file: 'src/app.css', line: 22, column: 1 } }
    ]);
    expect(found.find((d) => d.name === '--color-surface')).toMatchObject({ mode: 'Light', at: { file: 'src/theme/extra.css', line: 2 } });
  });

  it('una dichiarazione dentro un @media di larghezza non è un modo: resta fuori e lo dice', async () => {
    const parsed = await declared('tailwind4');

    expect(parsed.declared.filter((d) => d.name === '--color-muted').map((d) => d.raw)).toEqual(['#777777', '#888888']);
    expect(parsed.skipped).toContain('--color-muted under @media (min-width: 640px) :root is not a theme');
  });

  it('una regola che legge un token con var() resta, col suo selettore', async () => {
    const { rules } = await declared('tailwind4');

    expect(rules).toEqual([
      { selector: 'article .prose h2', property: 'color', token: '--color-primary' },
      { selector: '.btn-cta', property: 'background-color', token: '--color-brand-blue' },
      { selector: '.btn-cta', property: 'border-radius', token: '--radius-card' }
    ]);
  });

  it('shadcn: @theme inline tiene gli alias così come sono scritti, :root e .dark i valori', async () => {
    const { declared: found } = await declared('shadcn');

    expect(found.find((d) => d.name === '--color-primary')).toMatchObject({ raw: 'var(--primary)', mode: 'Light' });
    expect(found.filter((d) => d.name === '--primary').map((d) => [d.mode, d.raw])).toEqual([
      ['Light', 'oklch(0.205 0 0)'],
      ['Dark', 'oklch(0.922 0 0)']
    ]);
  });

  it('[data-theme] dà un modo col suo nome, prefers-color-scheme: dark il modo Dark', async () => {
    const { declared: found } = await declared('plain');

    expect(found.filter((d) => d.name === '--brand').map((d) => [d.mode, d.raw])).toEqual([
      ['Light', '#ff5500'],
      ['Ocean', '#0055ff'],
      ['Dark', '#ffaa77']
    ]);
  });

  it('un commento con graffe o punti e virgola non rompe la lettura', () => {
    const parsed = parseSheets([{ path: 'a.css', text: '/* { ; } */\n:root {\n  --a: #fff; /* --b: #000; */\n}\n' }]);

    expect(parsed.declared).toEqual([{ name: '--a', raw: '#fff', mode: 'Light', at: { file: 'a.css', line: 3, column: 2 } }]);
  });
});
