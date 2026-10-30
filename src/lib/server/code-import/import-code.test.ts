import { describe, expect, it, vi } from 'vitest';
import type { AppTab } from '$lib/server/web/browser';
import type { FrameStore } from '$lib/server/motion/move-element';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { CodeImportOutcome, importCodeAt } from './import-code';
import { RunFailure, type RepoRunner } from './sandbox-runner';

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
  root: { id: '1', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [button('2', 0, 10, 'Save'), button('3', 1, 100, 'Cancel'), button('4', 2, 200, 'Delete')] }
};

const USES = [
  { component: 'Button', props: { children: 'Save' } },
  { component: 'Button', props: { children: 'Cancel' } },
  { component: 'Button', props: { variant: 'destructive', children: 'Delete' } }
];

function tabOf() {
  return {
    goto: vi.fn(async () => 200),
    url: () => `${APP}/`,
    scroll: vi.fn(async () => undefined),
    reveal: vi.fn(async () => ({ height: 900, hidden: 0 })),
    settle: vi.fn(async () => undefined),
    seeAll: vi.fn(async () => undefined),
    overlay: vi.fn(async () => null),
    click: vi.fn(async () => undefined),
    press: vi.fn(async () => undefined),
    marks: vi.fn(async () => USES),
    tree: vi.fn(async () => TREE),
    close: vi.fn(async () => 0.002)
  } as unknown as AppTab & { marks: ReturnType<typeof vi.fn>; goto: ReturnType<typeof vi.fn> };
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
  const runner = vi.fn(async () => ({ ok: true as const, app: { url: APP, names: ['Button'], stop } }));
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

describe('importCodeAt', () => {
  it('avvia il repo, apre la rotta e segna i componenti coi nomi del codice', async () => {
    const { ask, tab, runner } = askOf();

    const done = await importCodeAt(ask);

    expect(done.outcome).toBe(CodeImportOutcome.Ok);
    expect(runner).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: null }, null);
    expect(tab.goto).toHaveBeenCalledWith(`${APP}/settings`);
    expect(tab.marks).toHaveBeenCalledWith(['Button']);
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
    expect(runner).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: null }, new Uint8Array([31, 139]));
  });

  it('senza sandbox configurata lo dice', async () => {
    const { ask } = askOf({ runner: null });

    expect((await importCodeAt(ask)).outcome).toBe(CodeImportOutcome.NoSandbox);
  });
});
