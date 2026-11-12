import { describe, expect, it, vi } from 'vitest';

const routesFound = vi.fn();
const importRoutesInto = vi.fn();

vi.mock('$lib/server/code-import/canvas-import', async (real) => ({ ...(await real<object>()), routesFound: (...a: unknown[]) => routesFound(...a), importRoutesInto: (...a: unknown[]) => importRoutesInto(...a) }));

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
});
