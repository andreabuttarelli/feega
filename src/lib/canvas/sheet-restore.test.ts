import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
vi.mock('$app/navigation', () => ({
  goto: vi.fn(async (href: string, opts: unknown) => calls.push(`goto ${href} ${JSON.stringify(opts)}`)),
  pushState: vi.fn((href: string, state: unknown) => calls.push(`push ${href} ${JSON.stringify(state)}`)),
  replaceState: vi.fn(),
  preloadData: vi.fn()
}));

const { restoreSheet } = await import('./sheet-nav');

describe('restoreSheet: un link diretto diventa tela + foglio', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('sostituisce la voce con la tela, poi spinge il foglio con i dati già caricati', async () => {
    await restoreSheet({
      canvasHref: '/p/x/c/k',
      sheetHref: '/p/x/calendar?month=2026-10',
      path: '/calendar',
      data: { posts: [] }
    });

    expect(calls).toEqual([
      'goto /p/x/c/k {"replaceState":true}',
      'push /p/x/calendar?month=2026-10 {"sheet":{"path":"/calendar","data":{"posts":[]}}}'
    ]);
  });
});
