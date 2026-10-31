import { describe, expect, it, vi } from 'vitest';
import type { AppTab } from '$lib/server/web/browser';
import type { FrameStore } from '$lib/server/motion/move-element';
import type { PageTree } from './page-tree';
import { importPageAt, UrlImportOutcome } from './import-url';
import { FULL_SHAPE, PLAIN_SHAPE } from './url-doc';
import type { MotionDoc } from '@feega/motion-core/motion/doc';

const TREE: PageTree = {
  title: 'Acme — ship faster',
  url: 'https://acme.test/',
  width: 1280,
  height: 900,
  truncated: false,
  root: {
    id: '1',
    type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 900 },
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
    children: [
      { id: '2', type: 'TEXT', characters: 'Ship faster', absoluteBoundingBox: { x: 100, y: 100, width: 300, height: 60 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], style: { fontFamily: 'Inter', fontSize: 48, fontWeight: 600 } },
      { id: '3', type: 'RECTANGLE', absoluteBoundingBox: { x: 100, y: 200, width: 400, height: 300 }, fills: [{ type: 'IMAGE', imageRef: 'https://acme.test/hero.png' }] }
    ]
  }
};

function tabOf(tree: unknown, status = 200) {
  return {
    goto: vi.fn(async () => status),
    url: () => 'https://acme.test/',
    scroll: vi.fn(async () => undefined),
    reveal: vi.fn(async () => ({ height: 900, hidden: 0 })),
    settle: vi.fn(async () => undefined),
    seeAll: vi.fn(async () => undefined),
    overlay: vi.fn(async () => null),
    click: vi.fn(async () => undefined),
    press: vi.fn(async () => undefined),
    tree: vi.fn(async () => tree),
    close: vi.fn(async () => 0.002)
  } as unknown as AppTab;
}

function storeOf() {
  const docs = new Map<string, { doc: unknown; version: number; name?: string }>();
  const store = {
    create: vi.fn(async (_at: unknown, doc: unknown, node: { displayName?: string }) => {
      const id = `frame-${docs.size + 1}`;
      docs.set(id, { doc, version: 1, name: node.displayName });
      return id;
    }),
    read: vi.fn(async (id: string) => docs.get(id) ?? null),
    write: vi.fn(async (id: string, version: number, doc: unknown) => {
      docs.set(id, { ...docs.get(id), doc, version: version + 1 });
      return true;
    })
  } as unknown as FrameStore;
  return { store, docs };
}

const PUBLIC = async () => undefined;
const PRIVATE = async () => {
  throw new Error('That host is not reachable');
};

const askOf = (over: Partial<Parameters<typeof importPageAt>[0]> = {}) => {
  const { store, docs } = storeOf();
  const tab = tabOf(TREE);
  return {
    docs,
    tab,
    ask: { url: 'https://acme.test/', at: { x: 0, y: 0 }, store, place: { projectId: 'p', canvasId: 'c' }, open: async () => tab, guard: PUBLIC, importImage: vi.fn(async () => 'asset-1'), newId: (() => {
      let n = 0;
      return () => `n${++n}`;
    })(), settleMs: 0, ...over }
  };
};

const NAV_TEXT = { id: '9', type: 'TEXT', characters: 'Acme', absoluteBoundingBox: { x: 20, y: 20, width: 80, height: 30 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], style: { fontFamily: 'Inter', fontSize: 20, fontWeight: 600 } };

const OUTLINED = { ...TREE, root: { ...TREE.root, children: [NAV_TEXT, ...TREE.root.children!] }, outline: { width: 1280, height: 900, root: { tag: 'body', box: { y: 0, height: 900, width: 1280 }, children: [{ tag: 'nav', box: { y: 0, height: 80, width: 1280 } }, { tag: 'section', h1: true, heading: 'Ship faster', box: { y: 80, height: 820, width: 1280 } }] } } };

const sectionNames = (docs: Map<string, { doc: unknown }>) => {
  const doc = docs.get('frame-1')!.doc as { tracks: { clips: { id: string; name?: string; parent?: string | null; autoLayout?: unknown; props: { comp?: string } }[] }[] };
  const clips = doc.tracks.flatMap((t) => t.clips);
  const page = clips.find((c) => !c.parent && c.autoLayout)?.id ?? null;
  return clips.filter((c) => c.parent === page && c.id !== page && (c.props.comp || c.autoLayout)).map((c) => c.name);
};

describe('importPageAt', () => {
  it('una pagina importata arriva divisa in sezioni con nome', async () => {
    const { ask, docs, tab } = askOf();
    vi.mocked(tab.tree).mockResolvedValue(OUTLINED as never);

    await importPageAt(ask);

    expect(sectionNames(docs)).toEqual(['Nav', 'Hero']);
  });

  it('con le sezioni spente la pagina arriva come prima', async () => {
    const { ask, docs, tab } = askOf({ shape: PLAIN_SHAPE });
    vi.mocked(tab.tree).mockResolvedValue(OUTLINED as never);

    await importPageAt(ask);

    expect(sectionNames(docs)).not.toContain('Hero');
  });

  it('the top of the page reads only the first screens, not the whole page', async () => {
    const { ask, tab } = askOf({ maxHeight: 1800 });
    vi.mocked(tab.reveal).mockResolvedValue({ height: 12_000, hidden: 0 } as never);

    await importPageAt(ask);

    expect(tab.tree).toHaveBeenCalledWith(1800);
    expect(vi.mocked(tab.scroll).mock.calls.filter(([step]) => 'px' in step).length).toBe(3);
  });

  it('una pagina pubblica diventa un frame col nome della pagina', async () => {
    const { ask, docs } = askOf();

    const done = await importPageAt(ask);

    expect(done.outcome).toBe(UrlImportOutcome.Ok);
    expect(docs.get('frame-1')?.name).toBe('Acme — ship faster');
  });

  it('un indirizzo privato è rifiutato prima di aprire il browser', async () => {
    const open = vi.fn();
    const { ask } = askOf({ guard: PRIVATE, open });

    const done = await importPageAt(ask);

    expect(done.outcome).toBe(UrlImportOutcome.NotPublic);
    expect(open).not.toHaveBeenCalled();
  });

  it('uno schema che non è http(s) è rifiutato', async () => {
    const open = vi.fn();
    const { ask } = askOf({ url: 'file:///etc/passwd', open });

    expect((await importPageAt(ask)).outcome).toBe(UrlImportOutcome.NotPublic);
    expect(open).not.toHaveBeenCalled();
  });

  it('una pagina che risponde con un errore non lascia un frame vuoto', async () => {
    const { ask, docs } = askOf();
    const tab = tabOf(TREE, 404);

    const done = await importPageAt({ ...ask, open: async () => tab });

    expect(done.outcome).toBe(UrlImportOutcome.Failed);
    expect(docs.size).toBe(0);
    expect(tab.close).toHaveBeenCalled();
  });

  it('un albero che non ha la forma attesa è illeggibile, e la scheda si chiude', async () => {
    const { ask } = askOf();
    const tab = tabOf({ nope: true });

    const done = await importPageAt({ ...ask, open: async () => tab });

    expect(done.outcome).toBe(UrlImportOutcome.Unreadable);
    expect(tab.close).toHaveBeenCalled();
  });

  it('senza browser disponibile lo dice, invece di fallire in silenzio', async () => {
    const { ask } = askOf({ open: null });

    expect((await importPageAt(ask)).outcome).toBe(UrlImportOutcome.NoBrowser);
  });

  it('le immagini della pagina vengono importate e messe nel frame', async () => {
    const { ask, docs } = askOf();

    await importPageAt(ask);

    expect(ask.importImage).toHaveBeenCalledWith('https://acme.test/hero.png');
    expect(JSON.stringify(docs.get('frame-1')?.doc)).toContain('asset-1');
  });

  it('i font della pagina arrivano al planner e il testo usa la loro famiglia vera', async () => {
    const importFont = vi.fn(async () => 'font-asset-1');
    const { ask, docs, tab } = askOf({ importFont });
    const sohne = { ...TREE.root.children![0], style: { fontFamily: 'Sohne', fontSize: 48, fontWeight: 600 } };
    vi.mocked(tab.tree).mockResolvedValue({ ...TREE, root: { ...TREE.root, children: [sohne] }, fonts: [{ family: 'Sohne', weight: '600', style: 'normal', url: 'https://acme.test/sohne.woff2' }] } as never);

    await importPageAt(ask);

    expect(importFont).toHaveBeenCalledWith('https://acme.test/sohne.woff2');
    const doc = docs.get('frame-1')!.doc as { fonts: { family: string }[] };
    expect(doc.fonts.map((f) => f.family)).toContain('Sohne');
    expect(JSON.stringify(doc)).toContain('font-asset-1');
  });

  it('i font dichiarati in un foglio di stile che la pagina non può leggere arrivano lo stesso', async () => {
    const importFont = vi.fn(async () => 'font-asset-2');
    const fetchText = vi.fn(async () => "@font-face{font-family:'sohne-var';src:url(../fonts/sohne.woff2) format('woff2');font-weight:300 700;font-style:normal}");
    const { ask, docs, tab } = askOf({ importFont, fetchText });
    const sohne = { ...TREE.root.children![0], style: { fontFamily: 'sohne-var', fontSize: 48, fontWeight: 400 } };
    vi.mocked(tab.tree).mockResolvedValue({ ...TREE, root: { ...TREE.root, children: [sohne] }, fonts: [], sheets: ['https://cdn.acme.test/css/app.css'] } as never);

    await importPageAt(ask);

    expect(fetchText).toHaveBeenCalledWith('https://cdn.acme.test/css/app.css');
    expect(importFont).toHaveBeenCalledWith('https://cdn.acme.test/fonts/sohne.woff2');
    expect(JSON.stringify(docs.get('frame-1')!.doc)).toContain('font-asset-2');
  });

  it('un campo che l\'albero non dichiara è illeggibile, non scartato in silenzio', async () => {
    const { ask, tab } = askOf();
    vi.mocked(tab.tree).mockResolvedValue({ ...TREE, mystery: 1 } as never);

    expect((await importPageAt(ask)).outcome).toBe(UrlImportOutcome.Unreadable);
  });

  it('every main of the page points at its own set frame on the Components page', async () => {
    const button = (id: string, x: number, label: string) => ({ id, type: 'FRAME', name: 'button', absoluteBoundingBox: { x, y: 600, width: 140, height: 44 }, fills: [{ type: 'SOLID', color: { r: 0.37, g: 0.42, b: 0.82, a: 1 } }], children: [{ id: `${id}t`, type: 'TEXT', characters: label, absoluteBoundingBox: { x: x + 20, y: 612, width: 90, height: 20 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], style: { fontFamily: 'Inter', fontSize: 15, fontWeight: 500 } }] });
    const tree = { ...TREE, root: { ...TREE.root, children: [...TREE.root.children!, button('b1', 100, 'Start'), button('b2', 300, 'Sign up')] } };
    const components = vi.fn(async () => ({ place: { projectId: 'p1', canvasId: 'components' }, at: { x: 0, y: 0 } }));
    const { ask, docs } = askOf({ open: async () => tabOf(tree), shape: FULL_SHAPE, components });

    await importPageAt(ask);

    const page = docs.get('frame-1')!.doc as MotionDoc;
    const homes = Object.values(page.comps).flatMap((c) => (c.component ? [c.component.home] : []));
    const sets = [...docs].filter(([id]) => id !== 'frame-1').map(([id]) => id);
    expect(components).toHaveBeenCalledOnce();
    expect(homes.length).toBeGreaterThan(0);
    expect(homes.every((home) => home && sets.includes(home))).toBe(true);
  });
});
