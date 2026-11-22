import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClassFamily, LiveProp, Side } from '@feega/live-edit/live-fields';
import { fileEdits } from './file-edits';
import { Place } from '@feega/live-edit/move-node';
import { AddKind, AddPlace } from '@feega/live-edit/add-node';
import { StructureOp } from '@feega/live-edit/structure';
import { WrapTag } from '@feega/live-edit/wrap-node';
import { PageTarget } from '@feega/live-edit/page-rule';
import { ElementState } from '@feega/live-edit/element-state';

const PAGE = `<section class="px-4 py-8 text-black">
  <h1 class="text-2xl">Hello</h1>
  <p>{subtitle}</p>
</section>
`;

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } });
const PLAIN = JSON.stringify({ devDependencies: { vite: '^5.0.0' } });

function app(manifest = TAILWIND): string {
  const root = mkdtempSync(join(tmpdir(), 'inspect-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), manifest);
  writeFileSync(join(root, 'src/Page.svelte'), PAGE);
  return root;
}

const read = (root: string) => readFileSync(join(root, 'src/Page.svelte'), 'utf8');

describe('fileEdits', () => {
  it('il padding scrive la sola classe px, in token', async () => {
    const root = app();
    const out = await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.X, value: '24px', rem: 16 });

    expect(out.ok).toBe(true);
    expect(read(root)).toContain('class="px-6 py-8 text-black"');
  });

  it('il colore scrive la sola classe colore', async () => {
    const root = app();
    await fileEdits(root).edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#ff0000' });

    expect(read(root)).toContain('<h1 class="text-2xl text-[#ff0000]">');
  });

  it('undo rimette il file com era', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.Y, value: '16px', rem: 16 });
    await edits.undo();

    expect(read(root)).toBe(PAGE);
  });

  it('undo non sovrascrive quello che è cambiato dopo', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.Y, value: '16px', rem: 16 });
    writeFileSync(join(root, 'src/Page.svelte'), 'changed by someone else');

    expect((await edits.undo()).ok).toBe(false);
    expect(read(root)).toBe('changed by someone else');
  });

  it('un percorso fuori dalla cartella si rifiuta', async () => {
    const out = await fileEdits(app()).edit({ at: '../x.svelte:1:1', prop: LiveProp.Padding, value: '4px' });

    expect(out.ok).toBe(false);
  });

  it('il testo letterale cambia una riga sola, e undo lo rimette', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Text, value: 'Ciao' });

    expect(read(root).split('\n').filter((l, i) => l !== PAGE.split('\n')[i])).toEqual(['  <h1 class="text-2xl">Ciao</h1>']);
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('il testo da un espressione si rifiuta e dice dove sta', async () => {
    const out = await fileEdits(app()).edit({ at: 'src/Page.svelte:3:3', prop: LiveProp.Text, value: 'x' });

    expect(out).toEqual({ ok: false, reason: 'This text comes from `{subtitle}`.', at: { file: 'src/Page.svelte', line: 3, col: 6 } });
  });

  it('senza Tailwind scrive una regola nello <style> del componente, non uno style inline', async () => {
    const root = app(PLAIN);
    await fileEdits(root).edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.FontWeight, value: '700', css: { 'font-weight': '700' } });

    expect(read(root)).toContain('<h1 class="text-2xl page-h1">Hello</h1>');
    expect(read(root)).toContain('  .page-h1 {\n    font-weight: 700;\n  }');
  });

  it('show dopo hide toglie la dichiarazione aggiunta da hide, non scrive il display di prima', async () => {
    const root = app(PLAIN);
    const edits = fileEdits(root);
    const at = 'src/Page.svelte:2:3';
    await edits.edit({ at, prop: LiveProp.FontWeight, value: '700', css: { 'font-weight': '700' } });
    await edits.edit({ at, prop: LiveProp.Class, family: ClassFamily.Hidden, value: 'hidden', css: { display: 'none' } });
    await edits.edit({ at, prop: LiveProp.Class, family: ClassFamily.Hidden, value: '', css: { display: '' } });

    expect(read(root)).toContain('  .page-h1 {\n    font-weight: 700;\n  }');
    expect(read(root)).not.toContain('display');
  });

  it('show dopo hide su un elemento senza altre regole toglie anche la regola vuota', async () => {
    const root = app(PLAIN);
    const edits = fileEdits(root);
    const at = 'src/Page.svelte:2:3';
    await edits.edit({ at, prop: LiveProp.Class, family: ClassFamily.Hidden, value: 'hidden', css: { display: 'none' } });
    await edits.edit({ at, prop: LiveProp.Class, family: ClassFamily.Hidden, value: '', css: { display: '' } });

    expect(read(root)).not.toContain('.page-h1');
    expect(read(root)).not.toContain('display');
  });

  it('gli stili di pagina vanno nel foglio globale come regola body, anche con Tailwind', async () => {
    const root = app();
    writeFileSync(join(root, 'src/app.css'), '@import "tailwindcss";\n');
    const out = await fileEdits(root).edit({ at: 'page', page: PageTarget.Body, prop: LiveProp.Color, value: '#111111', css: { 'background-color': '#111111' } });

    expect(out.ok).toBe(true);
    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toBe('@import "tailwindcss";\n\nbody {\n  background-color: #111111;\n}\n');
  });

  it('undo toglie la regola e la classe aggiunte', async () => {
    const root = app(PLAIN);
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:3:3', prop: LiveProp.Color, value: 'red', css: { color: 'red' } });
    await edits.undo();

    expect(read(root)).toBe(PAGE);
  });

  it('spostare un fratello cambia l ordine nel sorgente, e undo lo rimette', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.move('src/Page.svelte:3:3', 'src/Page.svelte:2:3', Place.Before);

    expect(read(root)).toBe('<section class="px-4 py-8 text-black">\n  <p>{subtitle}</p>\n  <h1 class="text-2xl">Hello</h1>\n</section>\n');
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('redo riapplica un passo su piu file, e un cambio esterno lo blocca', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/App.tsx'), 'export const App = () => <h1>Hi</h1>;\n');
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/App.tsx:1:26', prop: LiveProp.Color, value: 'red', css: { color: 'red' } });
    const afterEdit = readFileSync(join(root, 'src/App.tsx'), 'utf8');
    await edits.undo();
    await edits.redo();

    expect(readFileSync(join(root, 'src/App.tsx'), 'utf8')).toBe(afterEdit);
    expect(existsSync(join(root, 'src/App.module.css'))).toBe(true);

    await edits.undo();
    writeFileSync(join(root, 'src/App.tsx'), 'changed outside');
    expect((await edits.redo()).ok).toBe(false);
  });

  it('la cronologia elenca le modifiche, la piu recente prima', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.X, value: '24px', rem: 16 });
    await edits.edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#ff0000' });

    expect(edits.history().map((h) => [h.prop, h.files])).toEqual([
      [LiveProp.Color, ['src/Page.svelte']],
      [LiveProp.Padding, ['src/Page.svelte']]
    ]);
  });

  it('un font Google scrive la famiglia e lo importa nel foglio globale, un passo solo', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/app.css'), ':root {}\n');
    const edits = fileEdits(root);
    await edits.font({ at: 'src/Page.svelte:2:3', prop: LiveProp.Class, value: 'Space Grotesk', css: { 'font-family': "'Space Grotesk', sans-serif" } }, true);

    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toContain('family=Space+Grotesk');
    expect(read(root)).toContain("font-family: 'Space Grotesk', sans-serif;");
    await edits.undo();
    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toBe(':root {}\n');
    expect(read(root)).toBe(PAGE);
  });

  it('un font Google senza foglio globale va come link nell\'html della pagina, un passo solo', async () => {
    const root = app(PLAIN);
    const html = '<html>\n<head></head>\n<body></body>\n</html>\n';
    writeFileSync(join(root, 'index.html'), html);
    const edits = fileEdits(root);
    const out = await edits.font({ at: 'src/Page.svelte:2:3', prop: LiveProp.Class, value: 'Space Grotesk', css: { 'font-family': "'Space Grotesk', sans-serif" } }, true);

    expect(out).toMatchObject({ ok: true });
    expect(out.ok && out.note).toBeUndefined();
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toContain('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk');
    await edits.undo();
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toBe(html);
    expect(read(root)).toBe(PAGE);
  });

  it('salva un colore come variabile: @theme con Tailwind v4, poi la classe del token', async () => {
    const root = app();
    writeFileSync(join(root, 'src/app.css'), '@import "tailwindcss";\n');
    await fileEdits(root).saveVariable({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#0078d4', css: { color: '#0078d4' } }, 'brand');

    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toContain('--color-brand: #0078d4;');
    expect(read(root)).toContain('<h1 class="text-2xl text-brand">');
  });

  it('senza Tailwind la variabile va in :root e la regola usa var()', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/app.css'), 'body {}\n');
    await fileEdits(root).saveVariable({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#0078d4', css: { color: '#0078d4' } }, 'brand');

    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toContain(':root {\n  --brand: #0078d4;\n}');
    expect(read(root)).toContain('color: var(--brand);');
  });

  it('cronologia e undo sopravvivono a una nuova sessione', async () => {
    const root = app();
    const first = fileEdits(root);
    await first.edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#ff0000' });
    const second = fileEdits(root, undefined, JSON.parse(JSON.stringify(first.snapshot())));

    expect(second.history()).toHaveLength(1);
    await second.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('in JSX senza Tailwind crea il CSS module del componente, e undo lo toglie', async () => {
    const root = app(PLAIN);
    const jsx = 'export const App = () => <h1>Hi</h1>;\n';
    writeFileSync(join(root, 'src/App.tsx'), jsx);
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/App.tsx:1:26', prop: LiveProp.Color, value: 'red', css: { color: 'red' } });

    expect(readFileSync(join(root, 'src/App.tsx'), 'utf8')).toContain('<h1 className={styles.appH1}>Hi</h1>');
    expect(readFileSync(join(root, 'src/App.module.css'), 'utf8')).toBe('.appH1 {\n  color: red;\n}\n');
    await edits.undo();
    expect(readFileSync(join(root, 'src/App.tsx'), 'utf8')).toBe(jsx);
    expect(existsSync(join(root, 'src/App.module.css'))).toBe(false);
  });

  it('la stessa modifica ripetuta su un CSS module non aggiunge un passo, un undo basta', async () => {
    const root = app(PLAIN);
    const jsx = 'export const App = () => <h1>Hi</h1>;\n';
    writeFileSync(join(root, 'src/App.tsx'), jsx);
    const edits = fileEdits(root);
    const ask = { at: 'src/App.tsx:1:26', prop: LiveProp.Color, value: 'red', css: { color: 'red' } };
    await edits.edit(ask);
    await edits.edit({ ...ask, at: 'src/App.tsx:2:26' });
    await edits.undo();

    expect(edits.history()).toHaveLength(0);
    expect(readFileSync(join(root, 'src/App.tsx'), 'utf8')).toBe(jsx);
    expect(existsSync(join(root, 'src/App.module.css'))).toBe(false);
  });

  it('un colore sull\'svg inline scrive la proprieta svg come classe, e undo la toglie', async () => {
    const root = app();
    const nav = '<a><svg class="h-4" viewBox="0 0 1 1"></svg></a>\n';
    writeFileSync(join(root, 'src/Nav.svelte'), nav);
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Nav.svelte:1:4', prop: LiveProp.Class, family: 'arbitrary:stroke', value: '[stroke:#ff0000]' });

    expect(readFileSync(join(root, 'src/Nav.svelte'), 'utf8')).toContain('class="h-4 [stroke:#ff0000]"');
    await edits.undo();
    expect(readFileSync(join(root, 'src/Nav.svelte'), 'utf8')).toBe(nav);
  });

  it('sostituisce un componente lucide e undo lo ripristina', async () => {
    const root = app(JSON.stringify({ dependencies: { 'lucide-react': '1' } }));
    const jsx = "import { Heart } from 'lucide-react';\nexport const A = () => <Heart />;\n";
    writeFileSync(join(root, 'src/A.tsx'), jsx);
    const edits = fileEdits(root);
    const out = await edits.icon('src/A.tsx:2:24', 'mail');

    expect(out.ok).toBe(true);
    expect(readFileSync(join(root, 'src/A.tsx'), 'utf8')).toBe("import { Mail } from 'lucide-react';\nexport const A = () => <Mail />;\n");
    await edits.undo();
    expect(readFileSync(join(root, 'src/A.tsx'), 'utf8')).toBe(jsx);
  });

  it('rifiuta di sostituire un\'icona senza libreria installata', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/A.tsx'), 'export const A = () => <Heart />;\n');
    const out = await fileEdits(root).icon('src/A.tsx:1:24', 'mail');

    expect(out).toEqual({ ok: false, reason: 'no icon library found in package.json' });
  });

  it('scrive la costante di un {@html}, come l\'icona della a.mac', async () => {
    const root = app();
    writeFileSync(join(root, 'src/Modes.svelte'), "<script>\n  import { APPLE } from './icons';\n</script>\n<a class=\"mac\">{@html APPLE}Mac app</a>\n");
    const icons = "export const APPLE = '<svg></svg>';\n";
    writeFileSync(join(root, 'src/icons.ts'), icons);
    const edits = fileEdits(root);
    await edits.svg('src/Modes.svelte:4:1', '<svg viewBox="0 0 1 1"></svg>', 'svg');

    expect(readFileSync(join(root, 'src/icons.ts'), 'utf8')).toBe('export const APPLE = `<svg viewBox="0 0 1 1"></svg>`;\n');
    await edits.undo();
    expect(readFileSync(join(root, 'src/icons.ts'), 'utf8')).toBe(icons);
  });

  it.each([
    [StructureOp.Delete, '<section class="px-4 py-8 text-black">\n  <p>{subtitle}</p>\n</section>\n'],
    [StructureOp.Duplicate, '<section class="px-4 py-8 text-black">\n  <h1 class="text-2xl">Hello</h1>\n  <h1 class="text-2xl">Hello</h1>\n  <p>{subtitle}</p>\n</section>\n']
  ])('%s scrive il sorgente in un solo passo di undo', async (op, expected) => {
    const root = app();
    const edits = fileEdits(root);
    const out = await edits.structure({ op, at: 'src/Page.svelte:2:3' });

    expect(out.ok).toBe(true);
    expect(read(root)).toBe(expected);
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it.each([
    [StructureOp.Duplicate, 1, "export const LINKS = [\n  { label: 'a' },\n  { label: 'b' },\n  { label: 'b' },\n  { label: 'c' },\n];\n"],
    [StructureOp.Delete, 0, "export const LINKS = [\n  { label: 'b' },\n  { label: 'c' },\n];\n"],
    [StructureOp.AddItem, 2, "export const LINKS = [\n  { label: 'a' },\n  { label: 'b' },\n  { label: 'c' },\n  { label: 'c' },\n];\n"]
  ])('%s su un elemento di un loop scrive la voce dell\'array importato, in un passo di undo', async (op, instance, expected) => {
    const root = app();
    const data = "export const LINKS = [\n  { label: 'a' },\n  { label: 'b' },\n  { label: 'c' },\n];\n";
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    writeFileSync(join(root, 'src/lib/links.ts'), data);
    writeFileSync(join(root, 'src/Page.svelte'), "<script>\n  import { LINKS } from '$lib/links';\n</script>\n<nav>\n  {#each LINKS as link}\n    <a>{link.label}</a>\n  {/each}\n</nav>\n");
    const edits = fileEdits(root);
    const out = await edits.structure({ op, at: 'src/Page.svelte:6:5', instance });

    expect(out.ok).toBe(true);
    expect(readFileSync(join(root, 'src/lib/links.ts'), 'utf8')).toBe(expected);
    await edits.undo();
    expect(readFileSync(join(root, 'src/lib/links.ts'), 'utf8')).toBe(data);
  });

  it('il testo e il link di un elemento di un loop scrivono la voce dell\'array importato, ognuno in un passo di undo', async () => {
    const root = app();
    const data = "export const LINKS = [\n  { href: '/a', label: 'a' },\n  { href: '/b', label: 'b' },\n];\n";
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    writeFileSync(join(root, 'src/lib/links.ts'), data);
    writeFileSync(join(root, 'src/Page.svelte'), "<script>\n  import { LINKS } from '$lib/links';\n</script>\n<nav>\n  {#each LINKS as link}\n    <a href={link.href}>{link.label}</a>\n  {/each}\n</nav>\n");
    const edits = fileEdits(root);

    const text = await edits.edit({ at: 'src/Page.svelte:6:5', prop: LiveProp.Text, value: 'B', was: 'b', instance: 1 });
    const link = await edits.link('src/Page.svelte:6:5', { href: '/bee' }, 1);

    expect(text.ok && link.ok).toBe(true);
    expect(readFileSync(join(root, 'src/lib/links.ts'), 'utf8')).toBe("export const LINKS = [\n  { href: '/a', label: 'a' },\n  { href: '/bee', label: 'B' },\n];\n");
    await edits.undo();
    expect(readFileSync(join(root, 'src/lib/links.ts'), 'utf8')).toContain("{ href: '/b', label: 'B' }");
    await edits.undo();
    expect(readFileSync(join(root, 'src/lib/links.ts'), 'utf8')).toBe(data);
  });

  it('spostare dentro un altro contenitore e un solo passo di undo', async () => {
    const root = app();
    writeFileSync(join(root, 'src/Page.svelte'), '<div>\n  <p>a</p>\n</div>\n<section>\n</section>\n');
    const edits = fileEdits(root);
    await edits.structure({ op: StructureOp.MoveInto, at: 'src/Page.svelte:2:3', to: 'src/Page.svelte:4:1' });

    expect(read(root)).toBe('<div>\n</div>\n<section>\n  <p>a</p>\n</section>\n');
    await edits.undo();
    expect(read(root)).toBe('<div>\n  <p>a</p>\n</div>\n<section>\n</section>\n');
  });

  it('riordinare due usi di componente sposta le righe nel file dove sono usati', async () => {
    const root = app();
    writeFileSync(join(root, 'src/Page.svelte'), '<main>\n  <Hero />\n  <Pricing />\n</main>\n');
    const edits = fileEdits(root);
    await edits.structure({ op: StructureOp.MoveUsage, at: 'src/Page.svelte:1:1', usage: { from: 'Pricing', to: 'Hero', place: Place.Before } });

    expect(read(root)).toBe('<main>\n  <Pricing />\n  <Hero />\n</main>\n');
    await edits.undo();
    expect(read(root)).toBe('<main>\n  <Hero />\n  <Pricing />\n</main>\n');
  });

  it('riordinare un elemento di un ciclo sposta il dato nell array e undo lo rimette', async () => {
    const root = app();
    const page = "<script>\n  const xs = ['a', 'b'];\n</script>\n\n<ul>\n  {#each xs as x}\n    <li>{x}</li>\n  {/each}\n</ul>\n";
    writeFileSync(join(root, 'src/Page.svelte'), page);
    const edits = fileEdits(root);
    await edits.structure({ op: StructureOp.MoveLoopItem, at: 'src/Page.svelte:7:5', loop: { from: 1, to: 0 } });

    expect(read(root)).toBe(page.replace("['a', 'b']", "['b', 'a']"));
    await edits.undo();
    expect(read(root)).toBe(page);
  });

  it('aggiungere un titolo in Tailwind usa le classi, seleziona il nuovo elemento e un undo lo toglie', async () => {
    const root = app();
    const edits = fileEdits(root);
    const out = await edits.structure({ op: StructureOp.Add, at: 'src/Page.svelte:2:3', add: { kind: AddKind.Heading } });

    expect(read(root)).toBe(PAGE.replace('  <h1 class="text-2xl">Hello</h1>\n', '  <h1 class="text-2xl">Hello</h1>\n  <h2 class="text-2xl font-semibold">Heading</h2>\n'));
    expect(out.ok && out.selected).toEqual({ file: 'src/Page.svelte', line: 3, col: 3 });
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('aggiungere un titolo senza Tailwind scrive una classe e la regola, mai uno style, e un undo toglie tutto', async () => {
    const root = app(PLAIN);
    const edits = fileEdits(root);
    const out = await edits.structure({ op: StructureOp.Add, at: 'src/Page.svelte:2:3', add: { kind: AddKind.Heading } });
    const page = read(root);

    expect(page).not.toMatch(/style=|style\{\{/);
    expect(page).toMatch(/<h2 class="[\w-]+">Heading<\/h2>/);
    expect(page).toMatch(/<style>[\s\S]*font-size: 1\.5rem;[\s\S]*font-weight: 600;/);
    expect(out.ok && out.selected).toEqual({ file: 'src/Page.svelte', line: 3, col: 3 });
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('aggiungere un bottone in JSX scrive il modulo css e non uno style', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/Page.tsx'), 'export function Page() {\n  return (\n    <main>\n      <h1>Hello</h1>\n    </main>\n  );\n}\n');
    const edits = fileEdits(root);
    await edits.structure({ op: StructureOp.Add, at: 'src/Page.tsx:4:7', add: { kind: AddKind.Button } });
    const page = readFileSync(join(root, 'src/Page.tsx'), 'utf8');
    const sheet = readFileSync(join(root, 'src/Page.module.css'), 'utf8');

    expect(page).not.toContain('style={{');
    expect(page).toMatch(/<button className=\{styles\.\w+\}>Button<\/button>/);
    expect(sheet).toContain('padding: 8px 16px;');
    await edits.undo();
    expect(existsSync(join(root, 'src/Page.module.css')) ? readFileSync(join(root, 'src/Page.module.css'), 'utf8') : '').toBe('');
  });

  it('avvolgere senza Tailwind dà al contenitore una classe flex in colonna e non uno style', async () => {
    const root = app(PLAIN);
    const edits = fileEdits(root);
    await edits.structure({ op: StructureOp.Wrap, at: 'src/Page.svelte:2:3' });
    const page = read(root);

    expect(page).not.toMatch(/style=/);
    expect(page).toMatch(/<div class="[\w-]+">\n    <h1 class="text-2xl">Hello<\/h1>\n  <\/div>/);
    expect(page).toMatch(/display: flex;[\s\S]*flex-direction: column;/);
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('avvolgere con section scrive il tag scelto, e un undo lo toglie', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.structure({ op: StructureOp.Wrap, at: 'src/Page.svelte:2:3', wrap: WrapTag.Section });

    expect(read(root)).toContain('  <section class="flex flex-col">\n    <h1 class="text-2xl">Hello</h1>\n  </section>\n');
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('avvolgere con un link senza Tailwind non scrive nessuna regola di layout', async () => {
    const root = app(PLAIN);
    const edits = fileEdits(root);
    await edits.structure({ op: StructureOp.Wrap, at: 'src/Page.svelte:2:3', wrap: WrapTag.Link });
    const page = read(root);

    expect(page).toContain('<a href="#">\n    <h1 class="text-2xl">Hello</h1>\n  </a>');
    expect(page).not.toMatch(/flex-direction/);
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('aggiungere come figlio mette il nuovo elemento ultimo dentro quello scelto, e un undo lo toglie', async () => {
    const root = app();
    const edits = fileEdits(root);
    const out = await edits.structure({ op: StructureOp.Add, at: 'src/Page.svelte:1:1', add: { kind: AddKind.Text, place: AddPlace.Child } });

    expect(out.ok).toBe(true);
    expect(read(root)).toMatch(/<p>Text<\/p>\n<\/section>/);
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('avvolgere in un contenitore e togliere il contenitore sono un passo di undo ciascuno', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.structure({ op: StructureOp.Wrap, at: 'src/Page.svelte:2:3' });
    const wrapped = read(root);

    expect(wrapped).toContain('  <div class="flex flex-col">\n    <h1 class="text-2xl">Hello</h1>\n  </div>\n');
    await edits.structure({ op: StructureOp.Unwrap, at: 'src/Page.svelte:2:3' });
    expect(read(root)).toBe(PAGE);
    await edits.undo();
    expect(read(root)).toBe(wrapped);
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });
});

describe('fileEdits in an element state', () => {
  it('tailwind: una modifica in hover scrive la variante hover:, undo la toglie in un passo', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#ff0000', state: ElementState.Hover });

    expect(read(root)).toContain('<h1 class="text-2xl hover:text-[#ff0000]">');
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('css: una modifica in hover scrive la regola :hover della classe', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/Page.svelte'), '<button class="cta">Go</button>\n\n<style>\n  .cta {\n    color: black;\n  }\n</style>\n');
    await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Class, family: 'x', value: '', css: { 'background-color': 'red' }, state: ElementState.Hover });

    expect(read(root)).toContain('.cta:hover {\n    background-color: red;\n  }');
  });

  it('css: un file senza foglia di stile rifiuta lo stato invece di scriverlo inline', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/Page.html'), '<button>Go</button>\n');
    const out = await fileEdits(root).edit({ at: 'src/Page.html:1:1', prop: LiveProp.Class, family: 'x', value: '', css: { color: 'red' }, state: ElementState.Hover });

    expect(out.ok).toBe(false);
  });

  it('in un file Astro il colore va in una regola del blocco style, non nell attributo style', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/Page.astro'), '---\nconst title = 1;\n---\n<main>\n  <h1>Hello</h1>\n</main>\n');
    await fileEdits(root).edit({ at: 'src/Page.astro:5:3', prop: LiveProp.Color, value: '#ff0000', css: { color: '#ff0000' } });
    const page = readFileSync(join(root, 'src/Page.astro'), 'utf8');

    expect(page).toContain('<style>');
    expect(page).toContain('color: #ff0000');
    expect(page).not.toContain('style="');
  });
});
