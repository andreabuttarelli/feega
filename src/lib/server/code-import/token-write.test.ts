import { describe, expect, it } from 'vitest';
import type { Variables } from '@feega/motion-core/motion/variables-model';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { parseSheets, readSheets } from './css-tokens';
import { tokenSetOf, variablesOf } from './design-tokens';
import { frameEdits, writeTokens } from './token-write';
import type { MotionDoc } from '@feega/motion-core/motion/doc';

async function imported(name: string, repo = 'app') {
  const read = fixture(name);
  const made = variablesOf(tokenSetOf(parseSheets(await readSheets(read))), repo);
  return { read, ...made };
}

const edited = (variables: Variables, key: string, mode: string, value: unknown): Variables => {
  const [collection, name] = key.split('/');
  const col = variables[collection];
  return { ...variables, [collection]: { ...col, vars: { ...col.vars, [name]: { ...col.vars[name], values: { ...col.vars[name].values, [mode]: value } } } } } as Variables;
};

const changedLines = (before: string, after: string) => {
  const [a, b] = [before.split('\n'), after.split('\n')];
  return a.flatMap((line, i) => (line === b[i] ? [] : [[i + 1, line, b[i]]]));
};

describe('writeTokens', () => {
  it('nessuna modifica, nessun file', async () => {
    const { read, variables, map } = await imported('tailwind4');
    expect(await writeTokens(variables, map, read)).toMatchObject({ files: [], skipped: [] });
  });

  it('un colore cambiato in Dark tocca solo la dichiarazione dentro .dark, il resto del file resta com’era', async () => {
    const { read, variables, map } = await imported('tailwind4');

    const done = await writeTokens(edited(variables, 'app Colors/primary', 'Dark', '#ff0066'), map, read);

    expect(done.files.map((f) => f.path)).toEqual(['src/app.css']);
    expect(changedLines(done.files[0].before, done.files[0].after)).toEqual([[22, '\t--color-primary: #f0f0f0;', '\t--color-primary: #ff0066;']]);
    expect(done.map['app Colors/primary'].raw).toEqual({ Light: '#111111', Dark: '#ff0066' });
  });

  it('in Light tocca solo @theme', async () => {
    const { read, variables, map } = await imported('tailwind4');

    const done = await writeTokens(edited(variables, 'app Colors/primary', 'Light', '#222222'), map, read);

    expect(changedLines(done.files[0].before, done.files[0].after)).toEqual([[6, '\t--color-primary: #111111;', '\t--color-primary: #222222;']]);
  });

  it('un numero torna nella sua unità: px resta px, rem resta rem', async () => {
    const { read, variables, map } = await imported('tailwind4');
    const twice = edited(edited(variables, 'app Radius/card', 'Light', 16), 'app Spacing/gutter', 'Light', 32);

    const done = await writeTokens(twice, map, read);

    expect(changedLines(done.files[0].before, done.files[0].after).map(([, , after]) => after)).toEqual(['\t--radius-card: 16px;', '\t--spacing-gutter: 2rem;']);
  });

  it('oklch resta oklch, e un alias si scrive come var()', async () => {
    const { read, variables, map } = await imported('shadcn');
    const next = edited(edited(variables, 'app Palette/primary', 'Dark', '#ffffff'), 'app Colors/primary', 'Light', { alias: 'app Palette/foreground' });

    const done = await writeTokens(next, map, read);

    expect(changedLines(done.files[0].before, done.files[0].after).map(([, , after]) => after)).toEqual(['  --color-primary: var(--foreground);', '  --primary: oklch(1 0 0);']);
  });

  it('un modo senza dichiarazione si aggiunge in fondo al blocco di quel modo, nel formato della sorgente', async () => {
    const { read, variables, map } = await imported('tailwind4');

    const twice = edited(edited(variables, 'app Colors/brand-blue', 'Dark', '#000000'), 'app Colors/primary', 'Dark', '#ff0066');
    const done = await writeTokens(twice, map, read);

    expect(done.skipped).toEqual([]);
    expect(changedLines(done.files[0].before, done.files[0].after).slice(0, 2)).toEqual([
      [22, '\t--color-primary: #f0f0f0;', '\t--color-primary: #ff0066;'],
      [29, '}', '\t--color-brand-blue: #000000;']
    ]);
    expect(done.files[0].after.split('\n')[29]).toBe('}');
    expect(done.map['app Colors/brand-blue'].origins.Dark).toBe('src/app.css:29:1');
    expect(done.map['app Colors/brand-blue'].raw.Dark).toBe('#000000');
  });

  it("aggiungere una riga sposta l'origine dei token dichiarati più in basso nello stesso file", async () => {
    const { read, variables, map } = await imported('tailwind4');
    const before = map['app Colors/primary'].origins.Dark;
    const done = await writeTokens(edited(variables, 'app Colors/brand-blue', 'Dark', '#000000'), { ...map, 'app Colors/primary': { ...map['app Colors/primary'], origins: { ...map['app Colors/primary'].origins, Dark: 'src/app.css:40:1' } } }, read);
    expect(before).toBe('src/app.css:22:1');
    expect(done.map['app Colors/primary'].origins.Dark).toBe('src/app.css:41:1');
  });

  it('un modo senza blocco nel file non si scrive, e lo dice', async () => {
    const { read, variables, map } = await imported('tailwind4');
    const nowhere = { ...map, 'app Colors/surface': { ...map['app Colors/surface'] } };

    const done = await writeTokens(edited(variables, 'app Colors/surface', 'Dark', '#000000'), nowhere, read);

    expect(done.files).toEqual([]);
    expect(done.skipped).toEqual(['--color-surface: no Dark block in src/theme/extra.css, #000000 not written']);
  });

  it('se il codice è cambiato dall’import vince il codice, e il valore della tela è nel resoconto', async () => {
    const { variables, map } = await imported('tailwind4');
    const original = (await fixture('tailwind4')('src/app.css'))!;
    const moved = async (path: string) => (path === 'src/app.css' ? original.replace('--color-primary: #f0f0f0;', '--color-primary: #eeeeee;') : null);

    const done = await writeTokens(edited(variables, 'app Colors/primary', 'Dark', '#ff0066'), map, moved);

    expect(done.files).toEqual([]);
    expect(done.skipped).toEqual(['--color-primary (Dark) changed in the code since the import: the code wins, the canvas value was #ff0066']);
  });

  it('un percorso fuori dal repo nella mappa non viene mai scritto', async () => {
    const { read, variables, map } = await imported('tailwind4');
    const evil = { ...map, 'app Colors/primary': { ...map['app Colors/primary'], origins: { Light: '../../etc/app.css:6:1', Dark: '/etc/app.css:22:1' } } };

    const done = await writeTokens(edited(variables, 'app Colors/primary', 'Dark', '#ff0066'), evil, read);

    expect(done.files).toEqual([]);
    expect(done.skipped[0]).toMatch(/outside the repository/);
  });
});

describe('frameEdits', () => {
  it('una variabile cambiata sulla tela tocca il token, non i template dei livelli legati', async () => {
    const { read, variables, map } = await imported('tailwind4');
    const clip = { id: 'a', component: 'Text', props: { text: 'Ciao', color: '#ff0066' }, bind: { color: 'app Colors/primary' }, source: { at: 'src/routes/+page.svelte:1:0', tag: 'h1', cls: 'text-primary', was: { text: 'Ciao', color: '#111111' } } };
    const doc = { width: 100, height: 100, tracks: [{ clips: [clip] }], comps: {}, variables: edited(variables, 'app Colors/primary', 'Light', '#ff0066') } as unknown as MotionDoc;
    const page = async (path: string) => (path === 'src/routes/+page.svelte' ? '<h1 class="text-primary">Ciao</h1>\n' : read(path));

    const done = await frameEdits(doc, map, page);

    expect(done.files.map((f) => f.path)).toEqual(['src/app.css']);
    expect(done.skipped).toEqual([]);
  });

  it('senza mappa dei token restano solo le modifiche dei livelli', async () => {
    const clip = { id: 'a', component: 'Text', props: { text: 'Nuovo' }, source: { at: 'src/x.svelte:1:0', tag: 'h1', cls: '', was: { text: 'Vecchio' } } };
    const doc = { width: 100, height: 100, tracks: [{ clips: [clip] }], comps: {} } as unknown as MotionDoc;

    const done = await frameEdits(doc, undefined, async () => '<h1>Vecchio</h1>\n');

    expect(done.files.map((f) => f.after)).toEqual(['<h1>Nuovo</h1>\n']);
  });
});
