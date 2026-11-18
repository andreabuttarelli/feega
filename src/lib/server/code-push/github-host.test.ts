import { describe, expect, it } from 'vitest';
import type { ProviderAnswer } from '$lib/server/connections/account-links';
import { fakeGithub } from './fake-github.testkit';
import { gitHostContract } from './git-host.contract';
import { Access, FileMove, GitError, GitFailure } from './git-host';
import { githubHost } from './github-host';

const REPO = { owner: 'acme', repo: 'app', ref: null };

describe('githubHost contro un GitHub finto', () => {
  gitHostContract(() => {
    const gh = fakeGithub();
    return { host: githubHost(gh.call, REPO), files: gh.files, forcePush: gh.forcePush, seed: gh.seed, branches: gh.branches, tag: gh.tag };
  });
});

const always = (status: number, data: unknown = null) => async (): Promise<ProviderAnswer> => ({ status, data, headers: {}, file: null });

const failureOf = (work: Promise<unknown>) =>
  work.then(
    () => null,
    (e: unknown) => (e instanceof GitError ? e.failure : e)
  );

describe('githubHost: ogni rifiuto di GitHub è un errore tipizzato', () => {
  it.each([
    [401, GitFailure.Unauthorized],
    [403, GitFailure.Forbidden],
    [404, GitFailure.NotFound],
    [500, GitFailure.Unexpected],
    [0, GitFailure.Unexpected]
  ])('%i diventa %s', async (status, failure) => {
    expect(await failureOf(githubHost(always(status), REPO).defaultBranch())).toBe(failure);
  });

  it('un token revocato è unauthorized', async () => {
    const revoked = githubHost(always(401, { message: 'Bad credentials' }), REPO);

    expect(await failureOf(revoked.writeCommit({ parent: 'abc', message: 'm', files: [{ path: 'a', content: 'a' }] }))).toBe(GitFailure.Unauthorized);
  });

  it('senza permesso push il repo è in sola lettura', async () => {
    expect(await githubHost(fakeGithub({ push: false }).call, REPO).access()).toBe(Access.Read);
  });

  it('spostare un ramo cancellato è branch_gone', async () => {
    const gh = fakeGithub();
    const host = githubHost(gh.call, REPO);
    const base = await host.headOf('main');
    const sha = await host.writeCommit({ parent: base, message: 'm', files: [{ path: 'a', content: 'a' }] });
    await host.createBranch('feega/y', base);
    gh.deleteBranch('feega/y');

    expect(await failureOf(host.moveBranch('feega/y', base, sha))).toBe(GitFailure.BranchGone);
  });

  it('i rinomini arrivano da git col nome di prima', async () => {
    const call = always(200, { status: 'ahead', files: [{ filename: 'src/new.tsx', status: 'renamed', previous_filename: 'src/old.tsx' }] });

    expect(await githubHost(call, REPO).changedSince('abc', 'main')).toEqual([{ path: 'src/new.tsx', move: FileMove.Renamed, from: 'src/old.tsx' }]);
  });

  it('i check della PR arrivano col loro esito', async () => {
    const gh = fakeGithub();
    const host = githubHost(gh.call, REPO);
    const base = await host.headOf('main');
    await host.createBranch('feega/z', base);
    const pr = await host.upsertPull({ branch: 'feega/z', base: 'main', title: 't', body: '' });
    gh.checks[base] = [{ name: 'test', status: 'completed', conclusion: 'success' }];

    expect((await host.pull(pr.number)).checks).toEqual([{ name: 'test', status: 'completed', conclusion: 'success' }]);
  });
});
