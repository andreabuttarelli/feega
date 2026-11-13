import { describe, expect, it, vi } from 'vitest';

const routesFound = vi.fn();
const importRoutesInto = vi.fn();
const codeAdd = vi.fn();
const codeMap = vi.fn();

vi.mock('$lib/server/code-import/canvas-import', async (real) => ({ ...(await real<object>()), routesFound: (...a: unknown[]) => routesFound(...a), importRoutesInto: (...a: unknown[]) => importRoutesInto(...a) }));

vi.mock('$lib/server/code-import/code-sync', async (real) => ({ ...(await real<object>()), codeAdd: (...a: unknown[]) => codeAdd(...a), codeMap: (...a: unknown[]) => codeMap(...a) }));

const { CANVAS_OPS, canvasCtx } = await import('./canvas-ops');

const ctx = canvasCtx({ db: {} as never, orgId: 'o', projectId: 'p', userId: 'u' });

describe('discover_routes and import_code: the pages of an app, for agents too', () => {
  it('discover_routes answers the discovered routes of a repo, without a canvas', async () => {
    routesFound.mockResolvedValue({ ok: true, framework: 'next', app: '', routes: [{ path: '/' }] });

    const input = CANVAS_OPS.discover_routes.input.parse({ repo: 'https://github.com/a/b', app: 'apps/web' });

    expect(await CANVAS_OPS.discover_routes.run(ctx, input)).toEqual({ framework: 'next', app: '', routes: [{ path: '/' }] });
    expect(routesFound.mock.calls[0][1]).toEqual({ repo: 'https://github.com/a/b', app: 'apps/web' });
  });

  it('discover_routes passes a refusal on, with its reason and apps', async () => {
    routesFound.mockResolvedValue({ ok: false, error: 'choose_app', detail: 'this repository holds 2 apps: choose one', apps: ['a', 'b'] });

    expect(await CANVAS_OPS.discover_routes.run(ctx, CANVAS_OPS.discover_routes.input.parse({ repo: 'https://github.com/a/b' }))).toEqual({ error: 'choose_app', detail: 'this repository holds 2 apps: choose one', apps: ['a', 'b'] });
  });

  it('import_code takes routes "all", and more than the cap reaches the server check instead of a schema error', async () => {
    importRoutesInto.mockResolvedValue({ outcome: 'ok' });
    const all = CANVAS_OPS.import_code.input.parse({ canvasId: 'c', repo: 'https://github.com/a/b', routes: 'all', x: 0, y: 0 });
    const many = CANVAS_OPS.import_code.input.safeParse({ canvasId: 'c', repo: 'https://github.com/a/b', routes: Array.from({ length: 30 }, (_, i) => `/p${i}`), x: 0, y: 0 });

    await CANVAS_OPS.import_code.run(ctx, all);

    expect(importRoutesInto.mock.calls[0][2]).toMatchObject({ routes: 'all' });
    expect(many.success).toBe(true);
  });

  it('import_code with into adds the pages to that frame, written there, with no source of its own', async () => {
    codeAdd.mockResolvedValue({ outcome: 'ok' });
    const input = CANVAS_OPS.import_code.input.parse({ canvasId: 'c', into: 'f1', routes: ['/pricing'], conditions: [{ scheme: 'dark', width: 390 }], x: 0, y: 0 });

    await CANVAS_OPS.import_code.run(ctx, input);

    expect(codeAdd.mock.calls[0].slice(1)).toEqual(['f1', { routes: ['/pricing'], conditions: [{ scheme: 'dark', width: 390 }], land: 'frame' }]);
    expect(importRoutesInto).toHaveBeenCalledTimes(1);
  });

  it('code_map reads the map of a frame and says when the frame did not come from code', async () => {
    codeMap.mockResolvedValueOnce({ kind: 'github', map: { pages: [] }, used: 3, limit: 20 }).mockResolvedValueOnce(null);
    const input = CANVAS_OPS.code_map.input.parse({ nodeId: 'f1' });

    expect(await CANVAS_OPS.code_map.run(ctx, input)).toMatchObject({ used: 3, limit: 20 });
    expect(await CANVAS_OPS.code_map.run(ctx, input)).toEqual({ error: 'not_from_code' });
  });
});
