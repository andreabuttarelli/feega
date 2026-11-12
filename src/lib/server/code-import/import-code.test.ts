import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import type { AppTab } from '$lib/server/web/browser';
import type { FrameStore } from '$lib/server/motion/move-element';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { CodeImportOutcome, Crop, importBoards, importCodeAt } from './import-code';
import { IMPORT_KEY_COOKIE } from './origin-proxy';
import { BASE_CONDITIONS, Scheme } from './render-conditions';
import { RunFailure, type RepoRunner } from './sandbox-runner';
import { PlanRefusal } from './run-plan';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { DesignSystem } from './design-system';
import { DESIGN_BOARD } from './design-board';
import { discover } from './component-discovery';

const APP = 'https://sb-1.vercel.run';
const button = (id: string, use: number, x: number, label: string) => ({
  id,
  type: 'FRAME',
  use,
  absoluteBoundingBox: { x, y: 10, width: 80, height: 30 },
  fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } }],
  children: [{ id: `${id}t`, type: 'TEXT', characters: label, absoluteBoundingBox: { x: x + 10, y: 17, width: 50, height: 16 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 500 } }]
});

const TREE: PageTree = {
  title: 'Dashboard',
  url: `${APP}/`,
  width: 400,
  height: 200,
  truncated: false,
  root: { id: '1', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [{ ...button('2', 0, 10, 'Save'), source: { at: 'src/a.tsx:3:1', tag: 'button', cls: '' } },  button('3', 1, 100, 'Cancel'), button('4', 2, 200, 'Delete')] }
};

const USES = [
  { component: 'Button', props: { children: 'Save' } },
  { component: 'Button', props: { children: 'Cancel' } },
  { component: 'Button', props: { variant: 'destructive', children: 'Delete' } }
];

function tabOf() {
  return {
    goto: vi.fn(async () => 200),
    waitFor: vi.fn(async () => {
      throw new Error('no password field');
    }),
    url: () => `${APP}/`,
    scroll: vi.fn(async () => undefined),
    reveal: vi.fn(async () => ({ height: 900, hidden: 0 })),
    settle: vi.fn(async () => undefined),
    scheme: vi.fn(async () => undefined),
    viewport: vi.fn(async () => undefined),
    seeAll: vi.fn(async () => undefined),
    sample: vi.fn(async () => 0),
    overlay: vi.fn(async () => null),
    click: vi.fn(async () => undefined),
    press: vi.fn(async () => undefined),
    marks: vi.fn(async () => USES),
    tree: vi.fn(async (): Promise<PageTree> => TREE),
    restore: vi.fn(async () => undefined),
    close: vi.fn(async () => 0.002)
  } as unknown as AppTab & { tree: ReturnType<typeof vi.fn>; marks: ReturnType<typeof vi.fn>; goto: ReturnType<typeof vi.fn>; scheme: ReturnType<typeof vi.fn>; viewport: ReturnType<typeof vi.fn> };
}

function storeOf() {
  const docs = new Map<string, { doc: unknown; version: number }>();
  const store = {
    create: vi.fn(async (_at: unknown, doc: unknown) => {
      docs.set('frame-1', { doc, version: 1 });
      return 'frame-1';
    }),
    read: vi.fn(async (id: string) => docs.get(id) ?? null),
    write: vi.fn(async (id: string, version: number, doc: unknown) => {
      docs.set(id, { doc, version: version + 1 });
      return true;
    })
  } as unknown as FrameStore;
  return { store, docs };
}

function askOf(over: Partial<Parameters<typeof importCodeAt>[0]> = {}) {
  const tab = tabOf();
  const stop = vi.fn(async () => undefined);
  const runner = vi.fn(async () => ({ ok: true as const, app: { url: APP, key: 'k3y', names: ['Button'], sha: null, stop } }));
  const { store, docs } = storeOf();
  let n = 0;
  return {
    tab,
    stop,
    runner,
    docs,
    ask: { repo: 'https://github.com/acme/app', routes: ['/settings'], at: { x: 0, y: 0 }, store, place: { projectId: 'p', canvasId: 'c' }, open: async () => tab, runner: runner as RepoRunner, guard: async () => undefined, importImage: async () => null, newId: () => `n${++n}`, settleMs: 0, ...over }
  };
}

const LIBRARY = discover({
  'src/components/Button.tsx': "export function Button({ type = 'button' }: { type?: 'button' | 'submit' | 'reset'; children?: React.ReactNode }) { return <button type={type} />; }",
  'src/lib/components/Callout.svelte': "<script lang=\"ts\">let { tone = 'info' }: { tone?: 'info' | 'error' } = $props();</script><aside />"
});

describe('importCodeAt con la libreria letta dal codice', () => {
  const withLibrary = () => vi.fn(async () => ({ ok: true as const, app: { url: APP, key: 'k3y', names: ['Button', 'Callout'], sha: null, stop: async () => undefined, library: LIBRARY } }));

  it('il report dice quali componenti del codice nessuna rotta catturata ha reso', async () => {
    const { ask } = askOf({ runner: withLibrary() });

    const done = await importCodeAt(ask);

    expect(done.outcome).toBe(CodeImportOutcome.Ok);
    const library = 'library' in done ? done.library! : null;
    expect(library?.uncaptured).toEqual(['Callout']);
    expect(library?.components.map((c) => [c.name, c.captured, c.cells])).toEqual([
      ['Button', true, 3],
      ['Callout', false, 2]
    ]);
  });

  it('una prop type dichiarata come unione diventa asse di variante', async () => {
    const { ask, tab } = askOf({ runner: withLibrary() });
    tab.marks.mockResolvedValue([
      { component: 'Button', props: { type: 'submit', children: 'Save' } },
      { component: 'Button', props: { type: 'reset', children: 'Cancel' } },
      { component: 'Button', props: { type: 'button', children: 'Delete' } }
    ]);

    expect(await importCodeAt(ask)).toMatchObject({ outcome: CodeImportOutcome.Ok, components: 1, variants: 3 });
  });
});

describe('importCodeAt', () => {
  it('avvia il repo, apre la rotta e segna i componenti coi nomi del codice', async () => {
    const { ask, tab, runner } = askOf();

    const done = await importCodeAt(ask);

    expect(done.outcome).toBe(CodeImportOutcome.Ok);
    expect(runner).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: null }, null, null);
    expect(tab.goto).toHaveBeenCalledWith(`${APP}/settings`);
    expect(tab.marks).toHaveBeenCalledWith(['Button']);
  });

  it('reports the same-origin link paths seen on the captured pages, so dynamic routes get values', async () => {
    const { ask, tab } = askOf();
    const elements = [{ tag: 'a', text: 'Post', href: `${APP}/blog/hello?ref=nav#top` }, { tag: 'a', text: 'Out', href: 'https://elsewhere.test/blog/x' }, { tag: 'p', text: 'x' }];
    Object.assign(tab, { ui: vi.fn(async () => ({ title: '', elements })) });

    const done = await importCodeAt(ask);

    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, links: ['/blog/hello'] });
  });

  it('riporta componenti, varianti e istanze trovati', async () => {
    const { ask } = askOf();

    const done = await importCodeAt(ask);

    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, components: 1, variants: 2, instances: 1 });
  });

  it('la sandbox si ferma sempre, anche quando l\'import fallisce', async () => {
    const { ask, stop } = askOf({ open: null });

    const done = await importCodeAt(ask);

    expect(done.outcome).toBe(CodeImportOutcome.NoBrowser);
    expect(stop).toHaveBeenCalled();
  });

  it('un link che non è un repo GitHub o una rotta con .. sono rifiutati prima di avviare nulla', async () => {
    const { ask, runner } = askOf();

    expect((await importCodeAt({ ...ask, repo: 'https://gitlab.com/a/b' })).outcome).toBe(CodeImportOutcome.Invalid);
    expect((await importCodeAt({ ...ask, routes: ['/../x'] })).outcome).toBe(CodeImportOutcome.Invalid);
    expect(runner).not.toHaveBeenCalled();
  });

  it('un repo che non parte porta il motivo', async () => {
    const runner = vi.fn(async () => ({ ok: false as const, failure: RunFailure.Install, detail: 'ERR' }));
    const { ask } = askOf({ runner });

    expect(await importCodeAt(ask)).toEqual({ outcome: CodeImportOutcome.RunFailed, error: 'install_failed: ERR' });
  });

  it('più rotte in un giro: un frame solo, una tavola per rotta, componenti in comune', async () => {
    const { ask, tab, runner, docs } = askOf({ routes: ['/', '/settings'] });

    const done = await importCodeAt(ask);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(tab.goto).toHaveBeenCalledWith(`${APP}/`);
    expect(tab.goto).toHaveBeenCalledWith(`${APP}/settings`);
    expect(docs.size).toBe(1);
    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, pages: ['/', '/settings'], components: 1, variants: 2, instances: 4 });
  });

  it('ogni rotta si apre in una scheda nuova, chiusa subito dopo', async () => {
    const { ask, tab } = askOf({ routes: ['/', '/settings'] });
    const open = vi.fn(async () => tab);

    await importCodeAt({ ...ask, open });

    expect(open).toHaveBeenCalledTimes(2);
    expect(tab.close).toHaveBeenCalledTimes(2);
  });

  it('ogni scheda porta la chiave dell\'import al proxy della sandbox, solo per il suo host', async () => {
    const { ask, tab } = askOf({ routes: ['/', '/settings'] });

    await importCodeAt(ask);

    const restore = tab.restore as unknown as ReturnType<typeof vi.fn>;
    expect(restore).toHaveBeenCalledTimes(2);
    expect(restore).toHaveBeenCalledWith({ cookies: [{ name: IMPORT_KEY_COOKIE, value: 'k3y', domain: 'sb-1.vercel.run', path: '/', expires: -1, httpOnly: true, secure: true }], storage: {} }, APP);
  });

  it('una rotta che non si apre resta fuori e lo dice, le altre arrivano', async () => {
    const { ask, tab } = askOf({ routes: ['/', '/missing'] });
    tab.goto.mockImplementation(async (url: string) => (url.endsWith('/missing') ? 404 : 200));

    const done = await importCodeAt(ask);

    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, pages: ['/'] });
    expect(done.outcome === CodeImportOutcome.Ok && done.skipped).toContain('/missing: could not be opened');
  });

  it('un repo privato arriva alla sandbox come archivio, scaricato qui', async () => {
    const archive = vi.fn(async () => new Uint8Array([31, 139]));
    const { ask, runner } = askOf({ archive });

    await importCodeAt(ask);

    expect(archive).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: null });
    expect(runner).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: null }, new Uint8Array([31, 139]), null);
  });

  it('a branch with / in tree/<ref>/<path> is resolved against the real branches, the rest is the app', async () => {
    const branches = vi.fn(async () => ['main', 'feature/new-nav']);
    const { ask, runner } = askOf({ repo: 'https://github.com/acme/app/tree/feature/new-nav/apps/web', branches });

    await importCodeAt(ask);

    expect(branches).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: 'feature/new-nav/apps/web' });
    expect(runner).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: 'feature/new-nav' }, null, 'apps/web');
  });

  it('an explicit app wins over the folder in the link, and branches are not asked for a plain ref', async () => {
    const branches = vi.fn(async () => ['main']);
    const { ask, runner } = askOf({ repo: 'https://github.com/acme/app/tree/main', app: './apps/docs/', branches });

    await importCodeAt(ask);

    expect(branches).not.toHaveBeenCalled();
    expect(runner).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: 'main' }, null, 'apps/docs');
  });

  it('an app path that escapes the repository is refused before anything runs', async () => {
    const { ask, runner } = askOf({ app: '../secrets' });

    expect((await importCodeAt(ask)).outcome).toBe(CodeImportOutcome.Invalid);
    expect(runner).not.toHaveBeenCalled();
  });

  it('several apps and none chosen: the answer lists them', async () => {
    const runner = vi.fn(async () => ({ ok: false as const, failure: PlanRefusal.ChooseApp, detail: 'this repository holds 2 apps: choose one', apps: ['apps/docs', 'apps/web'] }));
    const { ask } = askOf({ runner });

    expect(await importCodeAt(ask)).toEqual({ outcome: CodeImportOutcome.ChooseApp, error: 'choose_app: this repository holds 2 apps: choose one', apps: ['apps/docs', 'apps/web'] });
  });

  it('senza sandbox configurata lo dice', async () => {
    const { ask } = askOf({ runner: null });

    expect((await importCodeAt(ask)).outcome).toBe(CodeImportOutcome.NoSandbox);
  });

  it('una condizione chiesta apre ogni scheda con quel tema e quella larghezza, e la tavola lo dice', async () => {
    const { ask, tab } = askOf({ routes: ['/'], conditions: [BASE_CONDITIONS, { scheme: Scheme.Dark, width: 390 }] });

    const done = await importCodeAt(ask);

    expect(tab.scheme.mock.calls.map((c) => c[0])).toEqual([Scheme.Light, Scheme.Dark]);
    expect(tab.viewport.mock.calls.map((c) => c[0])).toEqual([1280, 390]);
    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, pages: ['/', '/ · dark · 390px'] });
  });

  it('i clip di una tavola dark portano la condizione, quelli della tavola base no', async () => {
    const { ask, docs } = askOf({ routes: ['/'], conditions: [BASE_CONDITIONS, { scheme: Scheme.Dark, width: 1280 }] });

    await importCodeAt(ask);

    const clips = (docs.get('frame-1')!.doc as { tracks: { clips: { source?: { cond?: string } }[] }[] }).tracks.flatMap((t) => t.clips);
    const sourced = clips.filter((c) => c.source);
    expect(sourced.map((c) => c.source!.cond ?? null)).toEqual(expect.arrayContaining([null, 'dark@1280']));
  });
});

describe('importCodeAt design system', () => {
  type Doc = { variables?: Record<string, { modes: string[]; active?: string }>; tracks: { clips: { name?: string }[] }[] };

  it('legge i token del repo alla revisione avviata: variabili con i modi, una tavola Design system, la mappa dei token', async () => {
    const revs: (string | null)[] = [];
    const { ask, docs } = askOf({ routes: ['/'], code: (rev) => (revs.push(rev), fixture('tailwind4')) });

    const done = await importCodeAt(ask);

    const doc = docs.get('frame-1')!.doc as Doc;
    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, pages: ['/'], design: { tokens: 14 } });
    expect(doc.variables!['app Colors']).toMatchObject({ modes: ['Light', 'Dark'], active: 'Light' });
    expect(doc.tracks.flatMap((t) => t.clips).some((c) => c.name === DESIGN_BOARD)).toBe(true);
    expect(done.outcome === CodeImportOutcome.Ok && done.tokenMap!['app Colors/primary'].origins).toEqual({ Light: 'src/app.css:6:1', Dark: 'src/app.css:22:1' });
    expect(revs).toEqual([null]);
  });

  it('con Design system spento non crea variabili né tavola', async () => {
    const { ask, docs } = askOf({ routes: ['/'], code: () => fixture('tailwind4'), designSystem: DesignSystem.Off });

    const done = await importCodeAt(ask);

    expect((docs.get('frame-1')!.doc as Doc).variables).toBeUndefined();
    expect(done).not.toHaveProperty('design');
  });

  it('legge anche i fogli che la pagina ha caricato: il foglio di Nuxt 4 fuori dalla lista nota', async () => {
    const { ask, tab, docs } = askOf({ routes: ['/'], code: () => fixture('nuxt4') });
    tab.tree.mockImplementation(async () => ({ ...TREE, styles: [{ at: '/vercel/sandbox/app/assets/css/main.css', text: '' }] }));

    const done = await importCodeAt(ask);

    expect(done.outcome === CodeImportOutcome.Ok && done.tokenMap!['app Palette/ui-primary'].origins).toEqual({ Light: 'app/assets/css/main.css:12:2', Dark: 'app/assets/css/main.css:16:2' });
    expect((docs.get('frame-1')!.doc as Doc).variables!['app Palette']).toMatchObject({ modes: ['Light', 'Dark'] });
  });

  it('la scala del testo e le ombre arrivano come stili, contati nel resoconto e scritti nella mappa', async () => {
    const { ask, docs } = askOf({ routes: ['/'], code: () => fixture('typescale') });

    const done = await importCodeAt(ask);

    const styles = (docs.get('frame-1')!.doc as { styles?: Record<string, unknown> }).styles ?? {};
    expect(Object.keys(styles)).toEqual(expect.arrayContaining(['app Text/hero', 'app Text/article prose h2', 'app Shadow/card']));
    expect(done).toMatchObject({ design: { styles: 5 } });
    expect(done.outcome === CodeImportOutcome.Ok && done.tokenMap!['app Text/hero#size'].origins).toEqual({ Light: 'src/app.css:5:1' });
  });

  it('le variabili che esistono solo nella pagina, lette dal :root calcolato, entrano di sola lettura con i modi delle catture', async () => {
    const { ask, tab } = askOf({ routes: ['/'], code: () => fixture('plain'), conditions: [BASE_CONDITIONS, { scheme: Scheme.Dark, width: 1280 }] });
    let shot = 0;
    tab.tree.mockImplementation(async () => ({ ...TREE, rootVars: { '--chakra-colors-brand': shot++ === 0 ? '#3182ce' : '#90cdf4', '--brand': '#000000' } }));

    const done = await importCodeAt(ask);

    const ok = done.outcome === CodeImportOutcome.Ok ? done : null;
    expect(ok!.tokenMap!['app Palette/chakra-colors-brand'].raw).toEqual({ Light: '#3182ce', Dark: '#90cdf4' });
    expect(Object.values(ok!.tokenMap!['app Palette/chakra-colors-brand'].origins).every((o) => o.startsWith('page:'))).toBe(true);
    expect(ok!.tokenMap!['app Palette/brand'].raw.Light).toBe('#ff5500');
  });

  it('un repo senza token importa come prima', async () => {
    const { ask, docs } = askOf({ routes: ['/'], code: () => async () => null });

    const done = await importCodeAt(ask);

    expect(done.outcome).toBe(CodeImportOutcome.Ok);
    expect((docs.get('frame-1')!.doc as Doc).variables).toBeUndefined();
  });
});

describe('importBoards images', () => {
  it('porta alla tela i byte di un\'immagine servita dal dev server', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'image/png');
      res.end(png);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const seen: string[] = [];
    const { ask, tab } = askOf({ importImage: async (url) => (seen.push(url), 'asset-1') });
    const tree = structuredClone(TREE);
    tree.url = `${origin}/`;
    tree.root.children = [{ id: '9', type: 'RECTANGLE', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 }, fills: [{ type: 'IMAGE', imageRef: `${origin}/hero.png`, scaleMode: 'FILL' }] } as never];
    vi.mocked(tab.tree).mockResolvedValue(tree);

    await importBoards({ ...ask, name: 'app', pages: [{ label: '/', url: `${origin}/` }], names: [], crop: Crop.Page }).finally(() => server.close());

    expect(seen).toHaveLength(1);
    expect(seen[0].startsWith('data:image/png;base64,')).toBe(true);
    expect(Buffer.from(seen[0].split(',')[1], 'base64').equals(png)).toBe(true);
  });
});


describe('attesa prima della cattura', () => {
  const SIDEBAR_AFTER_MS = 250;
  const MARGIN_MS = 100;
  const bar = button('9', 1, 300, 'Indice');

  function slowTab() {
    const tab = tabOf();
    let opened = 0;
    tab.goto.mockImplementation(async () => {
      opened = Date.now();
      return 200;
    });
    const tree = vi.fn(async (): Promise<PageTree> => {
      const late = Date.now() - opened >= SIDEBAR_AFTER_MS;
      return { ...TREE, root: { ...TREE.root, children: late ? [...(TREE.root.children ?? []), bar] : TREE.root.children } } as PageTree;
    });
    return Object.assign(tab, { tree });
  }

  async function firstCaptureHasBar(over: Partial<Parameters<typeof importCodeAt>[0]>) {
    const tab = slowTab();
    await importCodeAt(askOf({ open: async () => tab, ...over }).ask);
    return JSON.stringify(await tab.tree.mock.results[0].value).includes('Indice');
  }

  it('senza attesa la barra che compare dopo manca', async () => {
    expect(await firstCaptureHasBar({})).toBe(false);
  });

  it('con l\'attesa generale la barra c\'e', async () => {
    expect(await firstCaptureHasBar({ delay: { ms: SIDEBAR_AFTER_MS + MARGIN_MS, routes: {} } })).toBe(true);
  });

  it('l\'attesa della rotta batte quella generale', async () => {
    const over = { routes: ['/slow'], delay: { ms: 0, routes: { '/slow': SIDEBAR_AFTER_MS + MARGIN_MS } } };

    expect(await firstCaptureHasBar(over)).toBe(true);
  });

  it('un\'attesa a zero sulla rotta batte quella generale', async () => {
    const over = { routes: ['/fast'], delay: { ms: SIDEBAR_AFTER_MS + MARGIN_MS, routes: { '/fast': 0 } } };

    expect(await firstCaptureHasBar(over)).toBe(false);
  });
});
