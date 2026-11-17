import { expect, it } from 'vitest';
import { Access, FileMove, GitError, GitFailure, PullStatus, type GitHost } from './git-host';

export type HostWorld = {
  host: GitHost;
  files: (ref: string) => Record<string, string> | Promise<Record<string, string>>;
  forcePush: (branch: string, files: Record<string, string>) => unknown;
  seed: (branch: string, files: Record<string, string>) => unknown;
  branches: () => string[] | Promise<string[]>;
};

const failureOf = async (work: Promise<unknown>) => {
  const error = await work.then(
    () => null,
    (e: unknown) => e
  );
  return error instanceof GitError ? error.failure : error;
};

const onBranch = async (host: GitHost, branch: string, files: { path: string; content: string | null }[]) => {
  const base = await host.headOf(await host.defaultBranch());
  const sha = await host.writeCommit({ parent: base, message: 'Edit', files });
  await host.createBranch(branch, sha);
  return { base, sha };
};

export enum PullSupport {
  Full = 'full',
  None = 'none'
}

export function gitHostContract(world: () => HostWorld | Promise<HostWorld>, pulls: PullSupport = PullSupport.Full) {
  it('scrive più file in un solo commit, e il ramo nasce solo quando il commit esiste', async () => {
    const { host, files } = (await world());

    const { sha } = await onBranch(host, 'feega/s1', [
      { path: 'src/a.tsx', content: 'a' },
      { path: 'src/b.tsx', content: 'b' }
    ]);

    expect(await host.headOf('feega/s1')).toBe(sha);
    expect(await files('feega/s1')).toEqual({ 'README.md': 'hi', 'src/a.tsx': 'a', 'src/b.tsx': 'b' });
    expect(await files('main')).toEqual({ 'README.md': 'hi' });
  });

  it('un file a null viene tolto', async () => {
    const { host, files } = (await world());

    await onBranch(host, 'feega/del', [{ path: 'README.md', content: null }]);

    expect(await files('feega/del')).toEqual({});
  });

  it('un ramo che non esiste è branch_gone', async () => {
    expect(await failureOf((await world()).host.headOf('feega/none'))).toBe(GitFailure.BranchGone);
  });

  it('spostare un ramo che non è più dove lo avevamo lasciato è diverged, mai forzato', async () => {
    const { host, forcePush, files } = (await world());
    const { sha } = await onBranch(host, 'feega/s2', [{ path: 'a', content: 'a' }]);
    await forcePush('feega/s2', { other: 'x' });
    const next = await host.writeCommit({ parent: sha, message: 'Edit', files: [{ path: 'a', content: 'b' }] });

    expect(await failureOf(host.moveBranch('feega/s2', sha, next))).toBe(GitFailure.Diverged);
    expect(await files('feega/s2')).toEqual({ other: 'x' });
  });

  it("riconosce un force-push dall'ascendenza degli sha", async () => {
    const { host, forcePush } = (await world());
    const { sha } = await onBranch(host, 'feega/s3', [{ path: 'a', content: 'a' }]);

    expect(await host.isAncestor(sha, await host.headOf('feega/s3'))).toBe(true);
    await forcePush('feega/s3', { a: 'rewritten' });
    expect(await host.isAncestor(sha, await host.headOf('feega/s3'))).toBe(false);
  });

  it.skipIf(pulls === PullSupport.None)('una PR per ramo: la seconda richiesta la aggiorna, e la si ritrova col suo stato', async () => {
    const { host } = (await world());
    await onBranch(host, 'feega/s4', [{ path: 'a', content: 'a' }]);

    const first = await host.upsertPull({ branch: 'feega/s4', base: 'main', title: 'One', body: '' });
    const second = await host.upsertPull({ branch: 'feega/s4', base: 'main', title: 'Two', body: 'more' });

    expect(second.number).toBe(first.number);
    expect(await host.lastPull('feega/s4')).toEqual({ ...first, status: PullStatus.Open });
    expect((await host.pull(first.number)).checks).toEqual([]);
    expect(await host.lastPull('feega/none')).toBeNull();
  });

  it('dice quali file sono cambiati da uno sha, e riconosce un rinomino', async () => {
    const { host, seed } = (await world());
    const base = await host.headOf('main');
    await seed('main', { 'ui/README.md': 'hi' });

    expect(await host.changedSince(base, 'main')).toEqual([{ path: 'ui/README.md', move: FileMove.Renamed, from: 'README.md' }]);
  });

  it('legge un file a un ref, null se non c’è', async () => {
    const { host } = (await world());

    expect(await host.readFile('README.md', 'main')).toBe('hi');
    expect(await host.readFile('missing.ts', 'main')).toBeNull();
  });

  it.skipIf(pulls === PullSupport.Full)('senza un host di PR, aprirla è pull_unavailable e nessuna PR risulta', async () => {
    const { host } = await world();

    expect(await host.lastPull('feega/none')).toBeNull();
    expect(await failureOf(host.upsertPull({ branch: 'feega/none', base: 'main', title: 't', body: '' }))).toBe(GitFailure.PullUnavailable);
  });

  it('chi può scrivere ha accesso write', async () => {
    expect(await (await world()).host.access()).toBe(Access.Write);
  });
}
