import { describe, expect, it, vi } from 'vitest';
import { githubBranches, githubConnect, githubStatus, importCode, repoLink } from './code-import-client';

const ASK = { projectId: 'p1', canvasId: 'c1', target: { repo: 'https://github.com/a/b', routes: ['/x', '/y'] }, at: { x: 1, y: 2 } };

const answering = (body: unknown, status = 200) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

describe('importCode', () => {
  it('chiama la route del progetto con canvas, repo, rotte e punto', async () => {
    const landed = { nodes: [{ id: 'f1' }], undo: [], skipped: [], truncated: false, pages: ['/x', '/y'], components: 2, variants: 3, instances: 4 };
    const fetchFn = answering(landed);

    const got = await importCode(ASK, fetchFn as unknown as typeof fetch);

    expect(got).toEqual({ ok: true, landed });
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/projects/p1/code-import', expect.objectContaining({ body: JSON.stringify({ canvasId: 'c1', repo: 'https://github.com/a/b', routes: ['/x', '/y'], x: 1, y: 2 }) }));
  });

  it('una Storybook manda il suo link al posto del repo', async () => {
    const fetchFn = answering({});

    await importCode({ ...ASK, target: { storybook: 'https://sb.example.com/' } }, fetchFn as unknown as typeof fetch);

    expect(fetchFn).toHaveBeenCalledWith('/api/v1/projects/p1/code-import', expect.objectContaining({ body: JSON.stringify({ canvasId: 'c1', storybook: 'https://sb.example.com/', x: 1, y: 2 }) }));
  });

  it('un rifiuto porta il suo codice e il dettaglio', async () => {
    const fetchFn = answering({ error: 'run_failed', detail: 'install_failed: x' }, 422);

    expect(await importCode(ASK, fetchFn as unknown as typeof fetch)).toEqual({ ok: false, error: 'run_failed', detail: 'install_failed: x' });
  });
});

describe('GitHub', () => {
  it('stato, collegamento e rami passano per le route del progetto', async () => {
    const fetchFn = answering({ configured: true, connected: false, label: null });

    expect(await githubStatus('p1', fetchFn as unknown as typeof fetch)).toEqual({ ok: true, value: { configured: true, connected: false, label: null } });
    await githubConnect('p1', '/p/p1/c/c1', fetchFn as unknown as typeof fetch);
    await githubBranches('p1', 'acme/app', fetchFn as unknown as typeof fetch);

    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['/api/v1/projects/p1/github', '/api/v1/projects/p1/github/connect', '/api/v1/projects/p1/github/branches?repo=acme%2Fapp']);
  });

  it('il link del repo porta il ramo scelto', () => {
    expect(repoLink('acme/app', 'dev')).toBe('https://github.com/acme/app/tree/dev');
    expect(repoLink('acme/app', null)).toBe('https://github.com/acme/app');
  });
});
