import { afterAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git-cli';
import { GitError, GitFailure } from './git-host';
import { CodeSourceKind } from './link';
import { capsOf, hostOf, PullCap } from './hosts';

const made: string[] = [];

afterAll(async () => {
  await Promise.all(made.map((d) => rm(d, { recursive: true, force: true })));
});

const none = async () => null;

describe('hostOf: un adattatore per ogni installazione, stesso dominio', () => {
  it('senza conto collegato non c’è host GitHub, neanche con un token in env', async () => {
    const withToken = { connected: none, env: { GITHUB_PUSH_TOKEN: 'tok' }, folder: () => null };

    expect(await hostOf(withToken)(CodeSourceKind.Github, 'acme/app')).toBeNull();
  });

  it('senza conto né token non c’è host GitHub', async () => {
    expect(await hostOf({ connected: none, folder: () => null })(CodeSourceKind.Github, 'acme/app')).toBeNull();
  });

  it('una cartella locale senza origin lavora sul clone, e senza token la PR è pull_unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'feega-hosts-'));
    made.push(dir);
    await git(dir, ['init', '-q', '-b', 'main']);

    const host = await hostOf({ connected: none, folder: (raw) => raw })(CodeSourceKind.Folder, dir);

    expect(await host?.defaultBranch()).toBe('main');
    const refused = await host!.upsertPull({ branch: 'feega/x', base: 'main', title: 't', body: '' }).catch((e: GitError) => e.failure);
    expect(refused).toBe(GitFailure.PullUnavailable);
  });

  it('una cartella fuori dalla modalità locale non ha host', async () => {
    expect(await hostOf({ connected: none, folder: () => null })(CodeSourceKind.Folder, '/tmp/x')).toBeNull();
  });
});

describe('capsOf: cosa sa fare ogni host, in una tabella', () => {
  const folderOf = async (setup: (dir: string) => Promise<unknown>) => {
    const dir = await mkdtemp(join(tmpdir(), 'feega-caps-'));
    made.push(dir);
    await setup(dir);
    return dir;
  };
  const connected = async () => async () => ({ status: 200, data: null, headers: {}, file: null });

  it('GitHub collegato: git, autosave sul ref di lavoro, PR', async () => {
    expect(await capsOf({ connected, folder: () => null })(CodeSourceKind.Github, 'acme/app')).toEqual({ git: true, wip: true, publish: true, pulls: PullCap.Ready });
  });

  it('una cartella che non è un repo git: nessun controllo git', async () => {
    const dir = await folderOf(async () => {});

    expect(await capsOf({ connected: none, folder: (raw) => raw })(CodeSourceKind.Folder, dir)).toEqual({ git: false, wip: false, publish: false, pulls: PullCap.None });
  });

  it('un repo git locale senza origin: commit locali, niente push né PR', async () => {
    const dir = await folderOf((d) => git(d, ['init', '-q', '-b', 'main']));

    expect(await capsOf({ connected: none, folder: (raw) => raw })(CodeSourceKind.Folder, dir)).toEqual({ git: true, wip: false, publish: false, pulls: PullCap.None });
  });

  it('origin su GitHub: push con le credenziali git locali, PR via conto collegato o Connect GitHub', async () => {
    const dir = await folderOf(async (d) => {
      await git(d, ['init', '-q', '-b', 'main']);
      await git(d, ['remote', 'add', 'origin', 'https://github.com/acme/app.git']);
    });
    const sources = (c: typeof connected | typeof none) => ({ connected: c, folder: (raw: string) => raw });

    expect(await capsOf(sources(connected))(CodeSourceKind.Folder, dir)).toEqual({ git: true, wip: false, publish: true, pulls: PullCap.Ready });
    expect(await capsOf(sources(none))(CodeSourceKind.Folder, dir)).toEqual({ git: true, wip: false, publish: true, pulls: PullCap.Connect });
  });

  it('origin non GitHub: push sì, PR no', async () => {
    const dir = await folderOf(async (d) => {
      await git(d, ['init', '-q', '-b', 'main']);
      await git(d, ['remote', 'add', 'origin', 'https://gitlab.com/acme/app.git']);
    });

    expect(await capsOf({ connected, folder: (raw) => raw })(CodeSourceKind.Folder, dir)).toEqual({ git: true, wip: false, publish: true, pulls: PullCap.None });
  });
});
