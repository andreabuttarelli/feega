import { describe, expect, it } from 'vitest';
import { GitScope, GitState, type GitView } from '../messages';
import { gitUi } from './git-view';

const READY: GitView = { state: GitState.Ready, branch: 'main', upstream: 'origin/main', remote: 'origin', ahead: 0, behind: 0, feega: ['src/Hero.svelte'], others: ['src/Other.css'], message: 'Update padding in Hero' };
const ui = (patch: Partial<GitView> = {}, scope = GitScope.Feega, message = 'msg') => gitUi({ ...READY, ...patch }, scope, message);

describe('gitUi', () => {
  it('explains a missing git program', () => {
    expect(ui({ state: GitState.NoGit })).toMatchObject({ notice: expect.stringContaining('not installed'), canCommit: false, canPush: false });
  });

  it('explains a folder that is not a repository, without offering to create one', () => {
    const out = ui({ state: GitState.NotRepo });

    expect(out.notice).toContain('not a git repository');
    expect(out).toMatchObject({ canCommit: false, canPush: false, canPull: false });
  });

  it('lists only Feega files by default and every changed file for all', () => {
    expect(ui().files).toEqual(['src/Hero.svelte']);
    expect(ui({}, GitScope.All).files).toEqual(['src/Hero.svelte', 'src/Other.css']);
  });

  it('allows a commit with files and a message only', () => {
    expect(ui().canCommit).toBe(true);
    expect(ui({}, GitScope.Feega, '  ').canCommit).toBe(false);
    expect(ui({ feega: [] })).toMatchObject({ canCommit: false, notice: 'Nothing to commit.' });
  });

  it('says how far ahead and behind the branch is', () => {
    expect(ui().branchLine).toBe('main');
    expect(ui({ ahead: 2, behind: 1 }).branchLine).toBe('main · 2 ahead · 1 behind');
    expect(ui({ branch: null }).branchLine).toBe('No branch checked out');
  });

  it('pushes only commits that are ahead, or a branch with no upstream', () => {
    expect(ui().canPush).toBe(false);
    expect(ui({ ahead: 1 }).canPush).toBe(true);
    expect(ui({ upstream: null }).canPush).toBe(true);
    expect(ui({ branch: null, ahead: 1 }).canPush).toBe(false);
  });

  it('warns about a missing remote', () => {
    expect(ui({ remote: null, upstream: null })).toMatchObject({ canPush: false, notice: expect.stringContaining('no remote') });
  });

  it('offers a pull only when behind', () => {
    expect(ui().canPull).toBe(false);
    expect(ui({ behind: 3 }).canPull).toBe(true);
  });
});
