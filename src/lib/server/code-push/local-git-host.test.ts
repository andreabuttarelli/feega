import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitTree, git } from './git-cli';
import { gitHostContract, PullSupport, type HostWorld } from './git-host.contract';
import { localGitHost, Publish } from './local-git-host';
import { memoryLock } from './push-lock';
import { pushFiles, type Pushed } from './push';
import { GitFailure } from './git-host';

const made: string[] = [];

afterAll(async () => {
  await Promise.all(made.map((d) => rm(d, { recursive: true, force: true })));
});

const scratch = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'feega-git-'));
  made.push(dir);
  return dir;
};

const must = async (run: Promise<{ code: number; out: string; err: string }>) => {
  const done = await run;
  if (done.code) {
    throw new Error(done.err);
  }
  return done.out.trim();
};

async function filesAt(dir: string, ref: string): Promise<Record<string, string>> {
  const listed = await git(dir, ['ls-tree', '-r', '--name-only', ref]);
  if (listed.code) {
    return {};
  }
  const names = listed.out.split('\n').filter(Boolean);
  return Object.fromEntries(await Promise.all(names.map(async (n) => [n, await must(git(dir, ['show', `${ref}:${n}`]))])));
}

async function setRef(dir: string, branch: string, files: Record<string, string>, parent: string | null) {
  const gone = parent ? Object.keys(await filesAt(dir, parent)).filter((p) => !(p in files)) : [];
  const edits = [...gone.map((path) => ({ path, content: null })), ...Object.entries(files).map(([path, content]) => ({ path, content }))];
  const commit = await must(commitTree(dir, edits, parent ? [parent] : [], 'seed'));
  await must(git(dir, ['update-ref', `refs/heads/${branch}`, commit]));
  return commit;
}

async function worlds() {
  const origin = await scratch();
  await must(git(origin, ['init', '--bare', '-b', 'main']));
  await setRef(origin, 'main', { 'README.md': 'hi' }, null);

  const clone = await scratch();
  await must(git(tmpdir(), ['clone', '-q', origin, clone]));
  await must(git(clone, ['config', 'user.email', 't@t']));
  await must(git(clone, ['config', 'user.name', 'T']));
  return { origin, clone };
}

async function originWorld(): Promise<HostWorld & { clone: string }> {
  const { origin, clone } = await worlds();
  const head = async (b: string) => (await git(origin, ['rev-parse', '--verify', `refs/heads/${b}`])).out.trim() || null;
  return {
    clone,
    host: localGitHost(clone, { publish: Publish.Origin }),
    tag: (name, ref) => must(git(origin, ['tag', name, ref])),
    files: (ref) => filesAt(origin, ref),
    forcePush: (branch, files) => setRef(origin, branch, files, null),
    seed: async (branch, files) => setRef(origin, branch, files, await head(branch)),
    branches: async () => (await must(git(origin, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']))).split('\n').filter(Boolean)
  };
}

async function localWorld(): Promise<HostWorld> {
  const { clone } = await worlds();
  const head = async (b: string) => (await git(clone, ['rev-parse', '--verify', `refs/heads/${b}`])).out.trim() || null;
  return {
    host: localGitHost(clone, { publish: Publish.Local }),
    tag: (name, ref) => must(git(clone, ['tag', name, ref])),
    files: (ref) => filesAt(clone, ref),
    forcePush: (branch, files) => setRef(clone, branch, files, null),
    seed: async (branch, files) => setRef(clone, branch, files, await head(branch)),
    branches: async () => (await must(git(clone, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']))).split('\n').filter(Boolean)
  };
}

describe('localGitHost che pubblica su origin', () => {
  gitHostContract(originWorld, PullSupport.None);
});

describe('localGitHost senza remote', () => {
  gitHostContract(localWorld, PullSupport.None);
});

describe('localGitHost: la copia di lavoro dell’utente non si tocca', () => {
  it('ramo corrente, modifiche non committate e storia restano dove sono', async () => {
    const w = await originWorld();
    await writeFile(join(w.clone, 'README.md'), 'work in progress');
    const before = await must(git(w.clone, ['rev-parse', 'HEAD']));

    const out = (await pushFiles(w.host, memoryLock(), { name: 'hero', files: [{ path: 'src/Hero.tsx', content: 'x' }], title: 't', body: '' })) as Pushed;

    expect(out).toMatchObject({ ok: true, branch: 'feega/hero', pull: null });
    expect(await must(git(w.clone, ['rev-parse', '--abbrev-ref', 'HEAD']))).toBe('main');
    expect(await must(git(w.clone, ['rev-parse', 'HEAD']))).toBe(before);
    expect(await readFile(join(w.clone, 'README.md'), 'utf8')).toBe('work in progress');
    expect((await w.files('feega/hero'))['src/Hero.tsx']).toBe('x');
  });

  it('un force-push su origin non viene mai sovrascritto: la spinta va su -sync', async () => {
    const w = await originWorld();
    const first = (await pushFiles(w.host, memoryLock(), { name: 'hero', files: [{ path: 'a.ts', content: '1' }], title: 't', body: '' })) as Pushed;
    await w.forcePush('feega/hero', { other: 'x' });

    const again = await pushFiles(w.host, memoryLock(), { name: 'hero', files: [{ path: 'a.ts', content: '2' }], title: 't', body: '', since: { branch: first.branch, sha: first.sha } });

    expect(again).toMatchObject({ ok: true, branch: 'feega/hero-sync' });
    expect(await w.files('feega/hero')).toEqual({ other: 'x' });
  });

  it('un origin irraggiungibile è un errore tipizzato', async () => {
    const { clone } = await worlds();
    await must(git(clone, ['remote', 'set-url', 'origin', join(clone, 'missing-origin')]));

    const out = await pushFiles(localGitHost(clone, { publish: Publish.Origin }), memoryLock(), { name: 'hero', files: [{ path: 'a.ts', content: '1' }], title: 't', body: '' });

    expect(out).toMatchObject({ ok: false, refusal: GitFailure.Unexpected });
  });
});
