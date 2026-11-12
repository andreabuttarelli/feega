import { beforeEach, describe, expect, it, vi } from 'vitest';

const importCodeInto = vi.fn();
const rememberOrigin = vi.fn();
const read = vi.fn();
const write = vi.fn();
const findNode = vi.fn();

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('./canvas-import', () => ({ importCodeInto: (...a: unknown[]) => importCodeInto(...a), rememberOrigin: (...a: unknown[]) => rememberOrigin(...a), routesFound: async () => ({ ok: false, error: 'unreadable', detail: 'test', apps: [] }) }));
vi.mock('$lib/server/repos/canvas', () => ({ findNode: (...a: unknown[]) => findNode(...a) }));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({ read, write, remove: vi.fn() }) }));
vi.mock('./github-runtime', () => ({ githubFor: () => ({ call: async () => null }) }));
vi.mock('./code-source', async (actual) => ({ ...(await actual<object>()), githubSource: () => ({ head: async () => 'newsha', read: vi.fn() }) }));
vi.mock('./repo-sync', async (actual) => ({ ...(await actual<object>()), rebased: () => ({ doc: {}, carried: 0, conflicts: [] }) }));

const { codePull } = await import('./code-sync');

const DELAY = { ms: 1_500, routes: { '/blog/post': 4_000 } };

beforeEach(() => {
  findNode.mockResolvedValue({ projectId: 'p', data: { code: { kind: 'github', repo: 'a/b', branch: null, sha: 'oldsha', routes: ['/', '/blog/post'], delay: DELAY } } });
  read.mockResolvedValue({ doc: {}, version: 1, canvasId: 'c', at: { x: 0, y: 0 } });
  write.mockResolvedValue({ outcome: 'written' });
  importCodeInto.mockResolvedValue({ outcome: 'ok', frameId: 'f2', skipped: [] });
});

describe('codePull', () => {
  it('rifa l\'import con l\'attesa salvata con il frame', async () => {
    await codePull({ db: {}, orgId: 'o', userId: 'u', projectId: 'p', actor: { kind: 'user', id: 'u' } } as never, 'n1');

    expect(importCodeInto.mock.calls[0][2]).toMatchObject({ delay: DELAY, routes: ['/', '/blog/post'] });
  });

  it('re-captures every board the map lists, each page under its own conditions, and refreshes the map', async () => {
    const map = { pages: [{ path: '/', state: 'imported', boards: [{ cond: 'light@1280', clip: 'a' }, { cond: 'dark@390', clip: 'b' }] }, { path: '/blog/post', state: 'imported', boards: [{ cond: 'light@1280', clip: 'c' }] }] };
    findNode.mockResolvedValue({ projectId: 'p', data: { code: { kind: 'github', repo: 'a/b', branch: null, sha: 'oldsha', routes: ['/', '/blog/post'], map } } });
    importCodeInto.mockResolvedValue({ outcome: 'ok', frameId: 'f2', skipped: [], pages: ['/'], boards: [{ label: '/', route: '/', cond: 'light@1280', clip: 'z1' }] });

    await codePull({ db: {}, orgId: 'o', userId: 'u', projectId: 'p', actor: { kind: 'user', id: 'u' } } as never, 'n1');

    expect(importCodeInto.mock.calls.at(-1)![2].variants.map((v: { route: string; label: string }) => v.label)).toEqual(['/', '/ · dark · 390px', '/blog/post']);
    expect(rememberOrigin.mock.calls.at(-1)![2].map.pages[0]).toMatchObject({ path: '/', boards: [{ cond: 'light@1280', clip: 'z1' }] });
  });
});
