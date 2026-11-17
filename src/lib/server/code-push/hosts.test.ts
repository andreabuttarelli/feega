import { afterAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git-cli';
import { GitError, GitFailure } from './git-host';
import { CodeSourceKind } from './link';
import { hostOf, tokenCall } from './hosts';

const made: string[] = [];

afterAll(async () => {
  await Promise.all(made.map((d) => rm(d, { recursive: true, force: true })));
});

const none = async () => null;

describe('hostOf: un adattatore per ogni installazione, stesso dominio', () => {
  it('self-hosted senza conto collegato usa il token di env sul base URL di GitHub Enterprise', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ default_branch: 'trunk' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchFn);

    const host = await hostOf({ connected: none, env: { GITHUB_PUSH_TOKEN: 'tok', GITHUB_API_URL: 'https://ghe.acme.dev/api/v3' }, folder: () => null })(CodeSourceKind.Github, 'acme/app');

    expect(await host?.defaultBranch()).toBe('trunk');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('https://ghe.acme.dev/api/v3/repos/acme/app');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    vi.unstubAllGlobals();
  });

  it('senza conto né token non c’è host GitHub', async () => {
    expect(await hostOf({ connected: none, env: {}, folder: () => null })(CodeSourceKind.Github, 'acme/app')).toBeNull();
  });

  it('una cartella locale senza origin lavora sul clone, e senza token la PR è pull_unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'feega-hosts-'));
    made.push(dir);
    await git(dir, ['init', '-q', '-b', 'main']);

    const host = await hostOf({ connected: none, env: {}, folder: (raw) => raw })(CodeSourceKind.Folder, dir);

    expect(await host?.defaultBranch()).toBe('main');
    const refused = await host!.upsertPull({ branch: 'feega/x', base: 'main', title: 't', body: '' }).catch((e: GitError) => e.failure);
    expect(refused).toBe(GitFailure.PullUnavailable);
  });

  it('una cartella fuori dalla modalità locale non ha host', async () => {
    expect(await hostOf({ connected: none, env: {}, folder: () => null })(CodeSourceKind.Folder, '/tmp/x')).toBeNull();
  });

  it('una rete giù è status 0, cioè unexpected, mai un successo', async () => {
    const call = tokenCall('tok', 'https://api.github.com', async () => {
      throw new Error('offline');
    });

    expect((await call({ endpoint: '/x' })).status).toBe(0);
  });
});
