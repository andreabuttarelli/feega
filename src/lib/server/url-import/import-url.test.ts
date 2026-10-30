import { describe, expect, it, vi } from 'vitest';
import type { AppTab } from '$lib/server/web/browser';
import type { FrameStore } from '$lib/server/motion/move-element';
import type { PageTree } from './page-tree';
import { importPageAt, UrlImportOutcome } from './import-url';

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
      docs.set('frame-1', { doc, version: 1, name: node.displayName });
      return 'frame-1';
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

describe('importPageAt', () => {
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
});
