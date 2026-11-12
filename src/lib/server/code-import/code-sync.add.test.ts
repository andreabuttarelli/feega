import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { PageState, type ImportMap } from '$lib/canvas/import-map';
import { importCodeAt } from './import-code';
import { askOf } from './code-import.testkit';

async function imported(routes: string[]): Promise<MotionDoc> {
  const { ask, docs } = askOf({ routes });
  await importCodeAt(ask);
  return docs.get('frame-1')!.doc as MotionDoc;
}

const LOCAL = await imported(['/', '/settings']);
const PIECE = await imported(['/pricing']);

const MAP: ImportMap = {
  rev: 'abc1234',
  pages: [
    { path: '/', state: PageState.Imported, boards: [{ cond: 'light@1280', clip: 'n2' }] },
    { path: '/settings', state: PageState.Imported, boards: [{ cond: 'light@1280', clip: 'n17' }] },
    { path: '/pricing', state: PageState.NotSelected }
  ]
};

const SIZE_TOKEN = { name: 'font-size', origins: { Light: 'src/app.css:2:1' }, raw: { Light: '1.5rem' }, scale: 1 / 520, style: 'app Text/body', field: 'size' };

const origin = (map: ImportMap) => ({ kind: 'folder', repo: '/tmp/app', branch: null, sha: 'abc1234', routes: ['/', '/settings'], map, tokens: { 'app Text/body#size': SIZE_TOKEN } });

let node = { projectId: 'p1', data: { code: origin(MAP) } };
let localDoc: MotionDoc = LOCAL;
const writes: { doc: MotionDoc; version: number }[] = [];
const removed: string[] = [];
const remembered: { code: { map: ImportMap; routes: string[]; tokens?: Record<string, { scale?: number }> } }[] = [];
const asked: unknown[] = [];

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/local/local-mode', () => ({ localModeRefusal: () => null }));
vi.mock('./folder-source', async (real) => ({ ...(await real<object>()), folderOf: (path: string) => path }));
vi.mock('$lib/server/repos/canvas', async (real) => ({ ...(await real<object>()), findNode: async () => node }));
vi.mock('$lib/server/motion/move-element', async (real) => ({
  ...(await real<object>()),
  frameStore: () => ({
    read: async (id: string) => (id === 'fresh' ? { doc: PIECE, version: 1, canvasId: 'c1', at: { x: 0, y: 0 } } : { doc: localDoc, version: 4, canvasId: 'c1', at: { x: 0, y: 0 } }),
    write: async (_id: string, version: number, doc: MotionDoc) => (writes.push({ doc, version }), { outcome: 'written', version: version + 1 }),
    remove: async (id: string) => void removed.push(id)
  })
}));
let refuse = false;

vi.mock('./canvas-import', async (real) => ({
  ...(await real<object>()),
  importCodeInto: async (_scope: unknown, _canvas: string, ask: unknown) => {
    asked.push(ask);
    await new Promise((resolve) => setTimeout(resolve, (ask as { routes: string[] }).routes[0] === '/slow' ? 30 : 1));
    if (refuse) {
      return { outcome: 'failed', error: 'the page answered 404' };
    }
    const route = (ask as { routes: string[] }).routes[0];
    return { outcome: 'ok', frameId: 'fresh', name: 'app', undo: [], skipped: [], locked: [], truncated: false, pages: [route], boards: [{ label: route, route, cond: 'light@1280', clip: 'n1' }], components: 1, variants: 2, instances: 2 };
  },
  routesFound: async () => ({ ok: false, error: 'unreadable', detail: 'test', apps: [] }),
  rememberOrigin: async (_scope: unknown, _id: string, code: { map: ImportMap; routes: string[]; tokens?: Record<string, { scale?: number }> }) => {
    remembered.push({ code });
    node = { ...node, data: { ...node.data, code: code as never } };
  }
}));

const { codeAdd, Land, SyncOutcome } = await import('./code-sync');

const SCOPE = { orgId: 'o1', userId: 'u1', projectId: 'p1', db: {}, actor: { kind: 'user', id: 'u1' } } as never;

beforeEach(() => {
  node = { projectId: 'p1', data: { code: origin(MAP) } };
  localDoc = LOCAL;
  refuse = false;
  [writes, removed, remembered, asked].forEach((list) => list.splice(0));
});

describe('importing one more page into a code frame', () => {
  it('writes one revision with the new board and leaves the boards already there untouched', async () => {
    const out = await codeAdd(SCOPE, 'node-1', { routes: ['/pricing'], land: Land.Frame });

    expect(out.outcome).toBe(SyncOutcome.Ok);
    expect(writes).toHaveLength(1);
    expect(writes[0].version).toBe(4);
    const ids = new Set(clipsOf(writes[0].doc).map((c) => c.id));
    expect(clipsOf(LOCAL).every((c) => ids.has(c.id))).toBe(true);
    expect(removed).toEqual(['fresh']);
  });

  it('captures only the asked route under the asked condition, from the revision the frame came from', async () => {
    await codeAdd(SCOPE, 'node-1', { routes: ['/settings'], conditions: [{ scheme: 'dark', width: 390 }] as never, land: Land.Frame });

    expect(asked[0]).toMatchObject({ folder: '/tmp/app', routes: ['/settings'], variants: [{ route: '/settings', conditions: { scheme: 'dark', width: 390 } }] });
  });

  it('records the new page on the map with the board it landed on', async () => {
    await codeAdd(SCOPE, 'node-1', { routes: ['/pricing'], land: Land.Frame });

    const map = remembered[0].code.map;
    const pricing = map.pages.find((p) => p.path === '/pricing')!;
    expect(pricing.state).toBe(PageState.Imported);
    expect(clipsOf(writes[0].doc).some((c) => c.id === pricing.boards![0].clip)).toBe(true);
    expect(map.pages.find((p) => p.path === '/')?.boards?.[0].clip).toBe('n2');
    expect(remembered[0].code.routes).toEqual(['/', '/settings', '/pricing']);
  });

  it('hands the editor the new page instead of writing, so the editor lands it as one undo step', async () => {
    const out = await codeAdd(SCOPE, 'node-1', { routes: ['/pricing'], land: Land.Piece });

    expect(writes).toHaveLength(0);
    expect(out).toMatchObject({ outcome: SyncOutcome.Ok, boards: ['n1'], parent: 'n1' });
  });

  it('refuses before capturing anything when the frame already holds the most boards Pull can refresh', async () => {
    const full: ImportMap = { pages: Array.from({ length: 20 }, (_, i) => ({ path: `/p${i}`, state: PageState.Imported, boards: [{ cond: 'light@1280', clip: i ? `x${i}` : 'n2' }] })) };
    node = { projectId: 'p1', data: { code: origin(full) } };
    localDoc = { ...LOCAL, tracks: [...LOCAL.tracks, { id: 'extra', kind: 'visual', name: 'x', clips: Array.from({ length: 19 }, (_, i) => ({ ...clipsOf(LOCAL)[1], id: `x${i + 1}` })) }] } as MotionDoc;

    const out = await codeAdd(SCOPE, 'node-1', { routes: ['/pricing'], land: Land.Frame });

    expect(out.outcome).toBe(SyncOutcome.FrameFull);
    expect(asked).toHaveLength(0);
  });

  it('a page that could not be imported lands on the map as failed, with the reason, so it can be retried', async () => {
    refuse = true;

    const out = await codeAdd(SCOPE, 'node-1', { routes: ['/quiz/nope'], land: Land.Piece });

    expect(out.outcome).toBe('failed');
    expect(remembered[0].code.map.pages.find((p) => p.path === '/quiz/nope')).toEqual({ path: '/quiz/nope', state: PageState.Failed, reason: 'the page answered 404' });
  });

  it('rescales the write-back of a text style size when the new page changes the frame\'s short side', async () => {
    await codeAdd(SCOPE, 'node-1', { routes: ['/pricing'], land: Land.Frame });

    const unit = Math.min(writes[0].doc.width, writes[0].doc.height);
    expect(remembered[0].code.tokens!['app Text/body#size'].scale).toBeCloseTo((1 / 520) * (520 / unit), 9);
  });

  it('two pages imported at once into one frame both stay on its map', async () => {
    await Promise.all([codeAdd(SCOPE, 'node-1', { routes: ['/slow'], land: Land.Piece }), codeAdd(SCOPE, 'node-1', { routes: ['/pricing'], land: Land.Piece })]);

    const imported = ((node.data.code as unknown as { map: ImportMap }).map.pages ?? []).filter((p) => p.state === PageState.Imported).map((p) => p.path);
    expect(imported).toEqual(expect.arrayContaining(['/slow', '/pricing']));
  });
});
