import { describe, expect, it } from 'vitest';
import { fakeGithub } from './fake-github.testkit';
import { githubHost } from './github-host';
import { memoryLock } from './push-lock';
import { branchDiff, commitDiff, revertCommit, HistoryRefusal } from './history';

const REPO = { owner: 'acme', repo: 'app', ref: null };

const setup = () => {
  const gh = fakeGithub();
  gh.seed('main', { 'README.md': 'hi', 'src/Hero.tsx': 'v0' });
  return { gh, host: githubHost(gh.call, REPO), lock: memoryLock() };
};

describe('la storia di un ramo', () => {
  it('il diff di un commit dice prima e dopo di ogni file che ha toccato', async () => {
    const { gh, host } = setup();
    const sha = gh.seed('main', { 'README.md': 'hi', 'src/Hero.tsx': 'v1', 'src/New.tsx': 'n' });

    expect(await commitDiff(host, sha)).toEqual({
      ok: true,
      files: [
        { path: 'src/Hero.tsx', before: 'v0', after: 'v1' },
        { path: 'src/New.tsx', before: null, after: 'n' }
      ]
    });
  });

  it('annullare un commit è un commit nuovo in avanti, la storia resta', async () => {
    const { gh, host, lock } = setup();
    const bad = gh.seed('main', { 'README.md': 'hi', 'src/Hero.tsx': 'v1', 'src/New.tsx': 'n' });
    gh.seed('main', { 'README.md': 'hi', 'src/Hero.tsx': 'v1', 'src/New.tsx': 'n', 'src/Other.tsx': 'o' });

    const out = await revertCommit(host, lock, { branch: 'main', sha: bad });

    expect(out).toMatchObject({ ok: true, branch: 'main' });
    expect(gh.files('main')).toEqual({ 'README.md': 'hi', 'src/Hero.tsx': 'v0', 'src/Other.tsx': 'o' });
    expect(await host.isAncestor(bad, await host.headOf('main'))).toBe(true);
  });

  it('se un commit dopo ha toccato gli stessi file, annullare è conflict e nulla cambia', async () => {
    const { gh, host, lock } = setup();
    const bad = gh.seed('main', { 'README.md': 'hi', 'src/Hero.tsx': 'v1' });
    gh.seed('main', { 'README.md': 'hi', 'src/Hero.tsx': 'v2' });

    expect(await revertCommit(host, lock, { branch: 'main', sha: bad })).toEqual({ ok: false, refusal: HistoryRefusal.Conflict, paths: ['src/Hero.tsx'] });
    expect(gh.files('main')['src/Hero.tsx']).toBe('v2');
  });

  it('cosa ha cambiato il ramo rispetto alla base, prima di aprire la PR', async () => {
    const { gh, host } = setup();
    const head = await host.headOf('main');
    await host.createBranch('design/hero', head);
    gh.seed('design/hero', { 'README.md': 'hi', 'src/Hero.tsx': 'v9' });

    expect(await branchDiff(host, { branch: 'design/hero', base: 'main' })).toEqual({ ok: true, files: [{ path: 'src/Hero.tsx', before: 'v0', after: 'v9' }] });
  });
});
