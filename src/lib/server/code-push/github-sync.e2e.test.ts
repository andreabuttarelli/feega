import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SourceEdit } from '$lib/server/code-import/write-back';
import { FramesRefusal, framesPush, frameStatus, frameUndo, type FrameStatus } from './frames-push';
import { makeVariant, VariantChoice } from './variants';
import { linkImported } from './import-link';
import { ComponentRole, EntryKind } from './link';
import type { Pushed, Undone } from './push';
import { BUTTON_COLUMN, BUTTON_LINE, fixtureDeps, fixtureWorld, H1_COLUMN, H1_LINE, memoryLinks, NO_SCOPE, ROUTES, USER_BRANCH, USER_DIRTY, type FrameEdits, type World } from './github-sync.fixture';

const FRAME = 'frame-shop';
const VARIANT = 'frame-shop-b';

const inButton = { file: 'components/Button.tsx', line: BUTTON_LINE, column: BUTTON_COLUMN };
const pricingButton = { file: 'app/pricing/page.tsx', line: 7, column: 6 };

const h1 = (look: SourceEdit['look'], was: SourceEdit['was']): SourceEdit => ({ at: { file: 'app/page.tsx', line: H1_LINE, column: H1_COLUMN }, look, was });

let world: World;
let links: ReturnType<typeof memoryLinks>;
let edits: FrameEdits;

beforeEach(async () => {
  world = await fixtureWorld();
  links = memoryLinks();
  edits = new Map();
  const deps = fixtureDeps(world, links, edits);
  await linkImported({ host: deps.host, links }, FRAME, { kind: 'folder', repo: world.clone, branch: 'main', sha: null, routes: ROUTES.map((r) => r.path) }, { app: '', routes: ROUTES }, { components: [{ name: 'Button', file: 'components/Button.tsx' }], poster: null });
});

afterEach(async () => {
  await world.done();
});

describe('GitHub sync su un repo Next.js 15 + Tailwind', () => {
  it('l’import lega tre pagine, il componente main e un’istanza per pagina', () => {
    const kinds = links.every().map(({ link }) => [link.entryKind, link.role ?? null, link.route ?? null, link.entry]);

    expect(kinds).toEqual([
      [EntryKind.Page, null, '/', 'app/page.tsx'],
      [EntryKind.Page, null, '/pricing', 'app/pricing/page.tsx'],
      [EntryKind.Page, null, '/about', 'app/about/page.tsx'],
      [EntryKind.Component, ComponentRole.Main, null, 'components/Button.tsx'],
      [EntryKind.Component, ComponentRole.Instance, '/', 'components/Button.tsx'],
      [EntryKind.Component, ComponentRole.Instance, '/pricing', 'components/Button.tsx'],
      [EntryKind.Component, ComponentRole.Instance, '/about', 'components/Button.tsx']
    ]);
  });

  it('colore e testo arrivano su un ramo feega/ che contiene solo il diff voluto', async () => {
    edits.set(FRAME, [h1({ color: '#e11d48', text: 'Ship today' }, { color: '#171717', text: 'Ship faster' })]);
    const userHead = await world.run(['rev-parse', 'HEAD']);

    const out = (await framesPush(fixtureDeps(world, links, edits), NO_SCOPE, { name: 'hero copy', nodeIds: [FRAME] })) as Pushed;

    expect(out).toMatchObject({ ok: true, branch: 'feega/hero-copy' });
    expect(await world.changed('main', out.branch)).toEqual(['app/page.tsx']);
    const after = (await world.at(out.branch, 'app/page.tsx'))!;
    expect(after).toContain('Ship today');
    expect(after).toContain('#e11d48');
    expect(after).not.toContain('Ship faster');
    expect(await world.run(['rev-parse', '--abbrev-ref', 'HEAD'])).toBe(USER_BRANCH);
    expect(await world.run(['rev-parse', 'HEAD'])).toBe(userHead);
    expect(await readFile(join(world.clone, USER_DIRTY), 'utf8')).toBe('shop, half written\n');
    expect(await world.at('main', 'app/page.tsx')).toContain('Ship faster');
  });

  it('l’onClick del titolo sopravvive al suo cambio di colore', async () => {
    edits.set(FRAME, [h1({ color: '#e11d48' }, { color: '#171717' })]);

    const out = (await framesPush(fixtureDeps(world, links, edits), NO_SCOPE, { name: 'colour', nodeIds: [FRAME] })) as Pushed;

    const after = (await world.at(out.branch, 'app/page.tsx'))!;
    expect(after).toContain('onClick={() => window.scrollTo(0, 0)}');
    expect(after).toContain('#e11d48');
    expect(after).toContain('<Button label="Start free" />');
  });

  it('annullare l’ultima spinta è un commit in avanti che ripristina solo i file toccati', async () => {
    const deps = fixtureDeps(world, links, edits);
    edits.set(FRAME, [h1({ text: 'Ship today' }, { text: 'Ship faster' })]);
    const first = (await framesPush(deps, NO_SCOPE, { name: 'copy', nodeIds: [FRAME] })) as Pushed;
    edits.set(FRAME, [h1({ text: 'Ship tonight' }, { text: 'Ship faster' })]);
    const second = (await framesPush(deps, NO_SCOPE, { name: 'copy', nodeIds: [FRAME] })) as Pushed;

    const undone = (await frameUndo(deps, FRAME)) as Undone;

    expect(undone).toMatchObject({ ok: true, branch: first.branch });
    expect(await world.run(['--git-dir', world.origin, 'rev-parse', `${undone.sha}^`]).catch(() => null)).toBe(second.sha);
    expect(await world.changed(second.sha, undone.sha)).toEqual(['app/page.tsx']);
    expect(await world.at(undone.sha, 'app/page.tsx')).toContain('Ship today');
  });

  it('una modifica sul componente main cambia un solo file e dichiara tre pagine toccate', async () => {
    const deps = fixtureDeps(world, links, edits);
    edits.set(FRAME, [{ at: inButton, look: { color: '#e11d48' }, was: { color: '#ffffff' } }]);

    const status = (await frameStatus(deps, NO_SCOPE, FRAME)) as FrameStatus;
    const out = (await framesPush(deps, NO_SCOPE, { name: 'button', nodeIds: [FRAME] })) as Pushed;

    expect(status.affected).toEqual([{ path: 'components/Button.tsx', pages: 3 }]);
    expect(await world.changed('main', out.branch)).toEqual(['components/Button.tsx']);
    expect(await world.at(out.branch, 'components/Button.tsx')).toContain('#e11d48');
  });

  it('una modifica su un’istanza diventa una prop in quel solo punto d’uso', async () => {
    edits.set(FRAME, [{ at: inButton, usage: pricingButton, look: { text: 'Buy today' }, was: { text: 'Buy now' } }]);

    const out = (await framesPush(fixtureDeps(world, links, edits), NO_SCOPE, { name: 'pricing cta', nodeIds: [FRAME] })) as Pushed;

    expect(await world.changed('main', out.branch)).toEqual(['app/pricing/page.tsx']);
    expect(await world.at(out.branch, 'app/pricing/page.tsx')).toContain('<Button label="Buy today" />');
    expect(await world.at(out.branch, 'components/Button.tsx')).toBe(await world.at('main', 'components/Button.tsx'));
  });

  it('un’istanza senza prop adatta propone di aggiungerla; "applica al main" scrive il componente', async () => {
    const deps = fixtureDeps(world, links, edits);
    edits.set(FRAME, [{ at: inButton, usage: pricingButton, look: { color: '#e11d48' }, was: { color: '#ffffff' } }]);

    const status = (await frameStatus(deps, NO_SCOPE, FRAME)) as FrameStatus;
    const out = (await framesPush(deps, NO_SCOPE, { name: 'to main', nodeIds: [FRAME], mains: [FRAME] })) as Pushed;

    expect(status.proposals).toEqual([{ component: 'components/Button.tsx', usage: pricingButton, props: ['color'] }]);
    expect(await world.changed('main', out.branch)).toEqual(['components/Button.tsx']);
  });

  it('un duplicato resta una copia senza link', async () => {
    expect(await links.all('frame-copy')).toEqual([]);
  });

  it('una variante chiede cosa farne alla spinta, e come nuova rotta scrive un file nuovo', async () => {
    const deps = fixtureDeps(world, links, edits);
    await makeVariant(deps, { from: FRAME, to: VARIANT });
    edits.set(VARIANT, [h1({ text: 'Ship in a day' }, { text: 'Ship faster' })]);

    const asked = await framesPush(deps, NO_SCOPE, { name: 'home b', nodeIds: [VARIANT] });
    const out = (await framesPush(deps, NO_SCOPE, { name: 'home b', nodeIds: [VARIANT], variants: [{ nodeId: VARIANT, choice: VariantChoice.NewRoute, route: '/home-b' }] })) as Pushed;

    expect(asked).toMatchObject({ ok: false, refusal: FramesRefusal.VariantChoice, suggested: [{ nodeId: VARIANT, route: '/home-variant' }] });
    expect(await world.changed('main', out.branch)).toEqual(['app/home-b/page.tsx']);
    expect(await world.at(out.branch, 'app/home-b/page.tsx')).toContain('Ship in a day');
    expect(await world.at(out.branch, 'app/page.tsx')).toBe(await world.at('main', 'app/page.tsx'));
  });

  it('una variante tenuta sulla tela non spinge niente; sostituire scrive sull’originale', async () => {
    const deps = fixtureDeps(world, links, edits);
    await makeVariant(deps, { from: FRAME, to: VARIANT });
    edits.set(VARIANT, [h1({ text: 'Ship in a day' }, { text: 'Ship faster' })]);

    const kept = await framesPush(deps, NO_SCOPE, { name: 'keep', nodeIds: [VARIANT], variants: [{ nodeId: VARIANT, choice: VariantChoice.Keep }] });
    const replaced = (await framesPush(deps, NO_SCOPE, { name: 'replace', nodeIds: [VARIANT], variants: [{ nodeId: VARIANT, choice: VariantChoice.Replace }] })) as Pushed;

    expect(kept).toMatchObject({ ok: false, refusal: 'no_files' });
    expect(await world.changed('main', replaced.branch)).toEqual(['app/page.tsx']);
  });
});
