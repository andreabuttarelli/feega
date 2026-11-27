import { describe, expect, it } from 'vitest';
import { GitAfter, GitFix, GitScope, GitState, type GitView } from '../messages';
import { copyOf, expandedOf, fixLabel, gitUi } from './git-view';

const READY: GitView = { state: GitState.Ready, branch: 'main', upstream: 'origin/main', remote: 'origin', ahead: 0, behind: 0, feega: ['src/Hero.svelte'], others: ['src/Other.css'], message: 'Update padding in Hero', open: false };
const ui = (patch: Partial<GitView> = {}, scope = GitScope.Feega, message = 'msg', changes = 2) => gitUi({ ...READY, ...patch }, scope, message, changes);

describe('gitUi', () => {
  it('explains a missing git program', () => {
    expect(ui({ state: GitState.NoGit })).toMatchObject({ notice: { text: expect.stringContaining('not installed'), fix: GitFix.None }, canCommit: false, canPush: false });
  });

  it('explains a folder that is not a repository and offers the command to copy', () => {
    const out = ui({ state: GitState.NotRepo });

    expect(out.notice).toEqual({ text: expect.stringContaining('not a git repository'), fix: GitFix.CopyInit });
    expect(out).toMatchObject({ canCommit: false, canPush: false });
  });

  it('says one commit holds every edit together', () => {
    expect(ui().header).toBe('Commit 2 changes in 1 file');
    expect(ui({}, GitScope.Feega, 'msg', 1).header).toBe('Commit 1 change in 1 file');
    expect(ui({ feega: ['a', 'b'] }).header).toBe('Commit 2 changes in 2 files');
    expect(ui({}, GitScope.All).header).toBe('Commit all 2 changed files');
  });

  it('lists only Feega files by default and every changed file for all', () => {
    expect(ui().files).toEqual(['src/Hero.svelte']);
    expect(ui({}, GitScope.All).files).toEqual(['src/Hero.svelte', 'src/Other.css']);
  });

  it('allows a commit with files and a message only', () => {
    expect(ui().canCommit).toBe(true);
    expect(ui({}, GitScope.Feega, '  ').canCommit).toBe(false);
    expect(ui({ feega: [] })).toMatchObject({ canCommit: false, notice: { text: 'Nothing to commit.', fix: GitFix.None } });
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

  it('shows the Push button only when commits wait to be pushed', () => {
    expect(ui().showPush).toBe(false);
    expect(ui({ upstream: null }).showPush).toBe(false);
    expect(ui({ ahead: 1 }).showPush).toBe(true);
  });

  it('makes Commit & push the primary action when there is a remote', () => {
    expect(ui().primary).toBe(GitAfter.Push);
    expect(ui({ remote: null, upstream: null }).primary).toBe(GitAfter.Stay);
  });

  it('warns about a missing remote with the command to copy', () => {
    expect(ui({ remote: null, upstream: null })).toMatchObject({ canPush: false, notice: { text: expect.stringContaining('no remote'), fix: GitFix.CopyRemote } });
  });

  it('offers a pull when behind and a sync when diverged', () => {
    expect(ui({ behind: 3 }).notice).toEqual({ text: 'main is 3 commits behind origin/main.', fix: GitFix.Pull });
    expect(ui({ behind: 1, ahead: 1 }).notice).toEqual({ text: 'main and origin/main have diverged.', fix: GitFix.Sync });
  });
});

describe('fixLabel', () => {
  it('names the action on the button', () => {
    expect(fixLabel(GitFix.Pull, null)).toBe('Pull');
    expect(fixLabel(GitFix.PullAndPush, null)).toBe('Pull and push');
    expect(fixLabel(GitFix.SignIn, null)).toBe('Copy `gh auth login`');
    expect(fixLabel(GitFix.CopyInit, null)).toBe('Copy `git init`');
    expect(fixLabel(GitFix.Identity, null)).toBe('Save');
    expect(fixLabel(GitFix.None, null)).toBeNull();
  });

  it('names the agent that will fix it, or points to installing one', () => {
    expect(fixLabel(GitFix.Sync, 'Claude Code')).toBe('Ask Claude Code to sync');
    expect(fixLabel(GitFix.Agent, 'Claude Code')).toBe('Fix with Claude Code');
    expect(fixLabel(GitFix.Agent, null)).toBe('Install an agent');
    expect(fixLabel(GitFix.Sync, null)).toBe('Install an agent');
  });
});

describe('copyOf', () => {
  it('gives the command a copy button puts on the clipboard', () => {
    expect(copyOf(GitFix.SignIn)).toBe('gh auth login');
    expect(copyOf(GitFix.CopyInit)).toBe('git init');
    expect(copyOf(GitFix.CopyRemote)).toBe('git remote add origin <url>');
    expect(copyOf(GitFix.Pull)).toBeNull();
  });
});

describe('collapsed summary', () => {
  it('names the commit in a short title', () => {
    expect(ui().summary).toBe('Commit 2 changes');
    expect(ui({}, GitScope.Feega, 'msg', 1).summary).toBe('Commit 1 change');
    expect(ui({}, GitScope.All).summary).toBe('Commit all 2 changed files');
  });
});

describe('what needs attention', () => {
  it('flags a behind or diverged branch and a repository to create, not a plain state', () => {
    expect(ui({ behind: 1 }).attention).toBe(true);
    expect(ui({ behind: 1, ahead: 1 }).attention).toBe(true);
    expect(ui({ state: GitState.NotRepo }).attention).toBe(true);
    expect(ui().attention).toBe(false);
    expect(ui({ feega: [] }).attention).toBe(false);
    expect(ui({ remote: null, upstream: null }).attention).toBe(false);
  });
});

describe('expandedOf', () => {
  it('stays collapsed unless the user opened it or something needs action', () => {
    expect(expandedOf(false, false, false)).toBe(false);
    expect(expandedOf(true, false, false)).toBe(true);
    expect(expandedOf(false, true, false)).toBe(true);
    expect(expandedOf(false, false, true)).toBe(true);
  });
});
