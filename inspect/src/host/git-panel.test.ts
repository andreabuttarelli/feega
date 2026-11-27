import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GitAction, GitAfter, GitFix, GitScope, GitState, ToView, type GitView, type ViewMessage } from '../messages';
import { GIT_MISSING, gitPanel, type GitRun } from './git-panel';
import { nodeGit } from './node-git';

const IDENTITY = { GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t.dev', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t.dev', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const ENV = { ...process.env, ...IDENTITY };

const sh = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' }).trim();
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `feega-${name}-`)));

function repo(sub = '') {
  const remote = tmp('remote');
  sh(remote, 'init', '--bare', '-b', 'main');
  const top = tmp('work');
  sh(top, 'init', '-b', 'main');
  sh(top, 'remote', 'add', 'origin', remote);
  const root = sub ? join(top, sub) : top;
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src/Hero.svelte'), '<h1>a</h1>\n');
  writeFileSync(join(root, 'src/Other.svelte'), '<p>a</p>\n');
  sh(top, 'add', '-A');
  sh(top, 'commit', '-m', 'first');
  sh(top, 'push', '-u', 'origin', 'main');
  return { top, root, remote };
}

function panel(root: string, edited = ['src/Hero.svelte'], run: GitRun = nodeGit(root, ENV)) {
  const sent: ViewMessage[] = [];
  const calls: string[][] = [];
  const logged: GitRun = (args) => (calls.push(args), run(args));
  const p = gitPanel({ run: logged, post: (m) => void sent.push(m), rows: () => [{ at: `${edited[0]}:1:1`, prop: 'padding', files: edited }] });
  const view = () => (sent.filter((m) => m.kind === ToView.Git).at(-1) as { view: GitView }).view;
  const result = () => sent.filter((m) => m.kind === ToView.GitResult).at(-1) as Extract<ViewMessage, { kind: ToView.GitResult }>;
  return { p, view, result, calls };
}

const edit = (root: string, file = 'src/Hero.svelte') => writeFileSync(join(root, file), `<h1>${Math.random()}</h1>\n`);

describe('git panel against a real repository', () => {
  it('splits changed files into Feega edits and the rest, with a prefilled message', async () => {
    const { root } = repo();
    edit(root);
    edit(root, 'src/Other.svelte');
    const { p, view } = panel(root);
    await p.refresh();

    expect(view()).toMatchObject({ state: GitState.Ready, branch: 'main', upstream: 'origin/main', remote: 'origin', ahead: 0, behind: 0, feega: ['src/Hero.svelte'], others: ['src/Other.svelte'], message: 'Update padding in Hero' });
  });

  it('commits only the files Feega edited and leaves the rest dirty', async () => {
    const { top, root } = repo();
    edit(root);
    edit(root, 'src/Other.svelte');
    const { p, view, result } = panel(root);
    await p.commit('Tweak hero', GitScope.Feega, GitAfter.Stay);

    expect(result()).toMatchObject({ action: GitAction.Commit, ok: true });
    expect(sh(top, 'show', '--name-only', '--format=%s', 'HEAD')).toBe('Tweak hero\n\nsrc/Hero.svelte');
    expect(view()).toMatchObject({ ahead: 1, feega: [], others: ['src/Other.svelte'] });
  });

  it('keeps unrelated staged files out of a Feega commit', async () => {
    const { top, root } = repo();
    edit(root);
    edit(root, 'src/Other.svelte');
    sh(top, 'add', 'src/Other.svelte');
    const { p } = panel(root);
    await p.commit('Only hero', GitScope.Feega, GitAfter.Stay);

    expect(sh(top, 'show', '--name-only', '--format=', 'HEAD')).toBe('src/Hero.svelte');
  });

  it('commits everything, new files included, when asked', async () => {
    const { top, root } = repo();
    edit(root);
    writeFileSync(join(root, 'src/New.svelte'), 'x\n');
    const { p } = panel(root);
    await p.commit('All of it', GitScope.All, GitAfter.Stay);

    expect(sh(top, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort()).toEqual(['src/Hero.svelte', 'src/New.svelte']);
  });

  it('commits and pushes to the remote in one go', async () => {
    const { top, root, remote } = repo();
    edit(root);
    const { p, view, result } = panel(root);
    await p.commit('Ship it', GitScope.Feega, GitAfter.Push);

    expect(result()).toMatchObject({ action: GitAction.Push, ok: true });
    expect(sh(remote, 'log', '-1', '--format=%s', 'main')).toBe('Ship it');
    expect(sh(top, 'rev-parse', 'HEAD')).toBe(sh(remote, 'rev-parse', 'main'));
    expect(view().ahead).toBe(0);
  });

  it('pushes a new branch and sets its upstream', async () => {
    const { top, root, remote } = repo();
    sh(top, 'checkout', '-b', 'feature');
    edit(root);
    const { p, view } = panel(root);
    await p.commit('On a branch', GitScope.Feega, GitAfter.Push);

    expect(sh(remote, 'log', '-1', '--format=%s', 'feature')).toBe('On a branch');
    expect(view()).toMatchObject({ branch: 'feature', upstream: 'origin/feature' });
  });

  it('works when the project is a subfolder of the repository', async () => {
    const { top, root, remote } = repo('apps/site');
    edit(root);
    const { p } = panel(root);
    await p.commit('From a subfolder', GitScope.Feega, GitAfter.Push);

    expect(sh(top, 'show', '--name-only', '--format=', 'HEAD')).toBe('apps/site/src/Hero.svelte');
    expect(sh(remote, 'log', '-1', '--format=%s', 'main')).toBe('From a subfolder');
  });

  it('says there is nothing to commit', async () => {
    const { root } = repo();
    const { p, result } = panel(root);
    await p.commit('Nothing', GitScope.Feega, GitAfter.Stay);

    expect(result()).toMatchObject({ ok: false, text: 'Nothing to commit.' });
  });

  it('refuses an empty message', async () => {
    const { root } = repo();
    edit(root);
    const { p, result } = panel(root);
    await p.commit('   ', GitScope.Feega, GitAfter.Stay);

    expect(result()).toMatchObject({ ok: false, text: 'Write a commit message.' });
  });

  it('offers a pull when the push is rejected, and pulls fast-forward', async () => {
    const { top, root, remote } = repo();
    const other = tmp('other');
    sh(other, 'clone', remote, '.');
    writeFileSync(join(other, 'remote.txt'), 'r\n');
    sh(other, 'add', '-A');
    sh(other, 'commit', '-m', 'remote change');
    sh(other, 'push');
    edit(root);
    const { p, result, view } = panel(root);
    await p.commit('Mine', GitScope.Feega, GitAfter.Push);

    expect(result()).toMatchObject({ action: GitAction.Push, ok: false, fix: GitFix.PullAndPush });
    expect(result().text).toContain('Pull');

    sh(top, 'reset', '--keep', 'HEAD~1');
    await p.pull();

    expect(result()).toMatchObject({ action: GitAction.Pull, ok: true });
    expect(view().behind).toBe(0);
    expect(sh(top, 'log', '-1', '--format=%s')).toBe('remote change');
  });

  it('explains diverged branches instead of rebasing or merging', async () => {
    const { top, root, remote } = repo();
    const other = tmp('other');
    sh(other, 'clone', remote, '.');
    writeFileSync(join(other, 'remote.txt'), 'r\n');
    sh(other, 'add', '-A');
    sh(other, 'commit', '-m', 'remote change');
    sh(other, 'push');
    edit(root);
    const { p, result } = panel(root);
    await p.commit('Mine', GitScope.Feega, GitAfter.Stay);
    const before = sh(top, 'rev-parse', 'HEAD');
    await p.pull();

    expect(result()).toMatchObject({ action: GitAction.Pull, ok: false });
    expect(result().text).toContain('diverged');
    expect(result().fix).toBe(GitFix.Sync);
    expect(sh(top, 'rev-parse', 'HEAD')).toBe(before);
  });

  it('pulls and pushes in one go when only behind', async () => {
    const { top, root, remote } = repo();
    const other = tmp('other');
    sh(other, 'clone', remote, '.');
    writeFileSync(join(other, 'remote.txt'), 'r\n');
    sh(other, 'add', '-A');
    sh(other, 'commit', '-m', 'remote change');
    sh(other, 'push');
    const { p, result, view } = panel(root);
    await p.pullAndPush();

    expect(result()).toMatchObject({ ok: true });
    expect(sh(top, 'log', '-1', '--format=%s')).toBe('remote change');
    expect(view()).toMatchObject({ behind: 0, ahead: 0 });
  });

  it('pulls and pushes a local commit when the remote can fast-forward', async () => {
    const { top, root, remote } = repo();
    edit(root);
    const { p } = panel(root);
    await p.commit('Mine', GitScope.Feega, GitAfter.Stay);
    await p.pullAndPush();

    expect(sh(remote, 'log', '-1', '--format=%s', 'main')).toBe('Mine');
    expect(sh(top, 'rev-parse', 'HEAD')).toBe(sh(remote, 'rev-parse', 'main'));
  });

  const diverge = (top: string, remote: string, remoteFile: string, remoteText: string) => {
    const other = tmp('other');
    sh(other, 'clone', remote, '.');
    writeFileSync(join(other, remoteFile), remoteText);
    sh(other, 'add', '-A');
    sh(other, 'commit', '-m', 'remote change');
    sh(other, 'push');
    return top;
  };

  it('rebases a diverged branch without conflicts and pushes in one click', async () => {
    const { top, root, remote } = repo();
    diverge(top, remote, 'remote.txt', 'r\n');
    edit(root);
    const { p, result } = panel(root);
    await p.commit('Mine', GitScope.Feega, GitAfter.Stay);
    await p.pullAndPush();

    expect(result()).toMatchObject({ action: GitAction.Push, ok: true });
    expect(sh(remote, 'log', '-2', '--format=%s', 'main')).toBe('Mine\nremote change');
    expect(sh(top, 'rev-parse', 'HEAD')).toBe(sh(remote, 'rev-parse', 'main'));
  });

  it('aborts the rebase on a conflict, leaves the repository as it was and offers the agent', async () => {
    const { top, root, remote } = repo();
    diverge(top, remote, 'src/Hero.svelte', '<h1>remote</h1>\n');
    writeFileSync(join(root, 'src/Hero.svelte'), '<h1>mine</h1>\n');
    const { p, result } = panel(root);
    await p.commit('Mine', GitScope.Feega, GitAfter.Stay);
    const before = sh(top, 'rev-parse', 'HEAD');
    await p.pullAndPush();

    expect(result()).toMatchObject({ ok: false, fix: GitFix.Sync });
    expect(sh(top, 'rev-parse', 'HEAD')).toBe(before);
    expect(sh(top, 'status', '--porcelain')).toBe('');
    expect(existsSync(join(top, '.git/rebase-merge'))).toBe(false);
    expect(existsSync(join(top, '.git/rebase-apply'))).toBe(false);
    expect(sh(remote, 'log', '-1', '--format=%s', 'main')).toBe('remote change');
  });

  it('does not rebase over unrelated uncommitted work and offers the agent', async () => {
    const { top, root, remote } = repo();
    diverge(top, remote, 'remote.txt', 'r\n');
    edit(root);
    const { p, result, calls } = panel(root);
    await p.commit('Mine', GitScope.Feega, GitAfter.Stay);
    edit(root, 'src/Other.svelte');
    const before = sh(top, 'rev-parse', 'HEAD');
    await p.pullAndPush();

    expect(result()).toMatchObject({ ok: false, fix: GitFix.Sync });
    expect(sh(top, 'rev-parse', 'HEAD')).toBe(before);
    expect(sh(top, 'status', '--porcelain')).toBe('M src/Other.svelte');
    expect(calls.flat()).not.toContain('--rebase');
    expect(calls.flat()).not.toContain('--autostash');
  });

  it('saves a name and email for this repository only', async () => {
    const { top, root } = repo();
    const { p, result } = panel(root);
    await p.identity('Ada Lovelace', 'ada@example.dev');

    expect(sh(top, 'config', '--local', 'user.name')).toBe('Ada Lovelace');
    expect(sh(top, 'config', '--local', 'user.email')).toBe('ada@example.dev');
    expect(result()).toMatchObject({ ok: true });
  });

  it('refuses an empty name or email', async () => {
    const { root } = repo();
    const { p, result, calls } = panel(root);
    await p.identity('  ', 'a@b.dev');

    expect(result()).toMatchObject({ ok: false, fix: GitFix.Identity });
    expect(calls.flat()).not.toContain('config');
  });

  it('hands a failed commit hook to the agent with the hook output', async () => {
    const { top, root } = repo();
    writeFileSync(join(top, '.git/hooks/pre-commit'), '#!/bin/sh\necho "lint failed: no tabs" >&2\nexit 1\n', { mode: 0o755 });
    edit(root);
    const { p, result } = panel(root);
    await p.commit('Blocked', GitScope.Feega, GitAfter.Stay);

    expect(result()).toMatchObject({ ok: false, fix: GitFix.Agent });
    expect(await p.fixPrompt()).toContain('lint failed: no tabs');
  });

  it('describes the diverged branches to the agent', async () => {
    const { root, remote } = repo();
    const other = tmp('other');
    sh(other, 'clone', remote, '.');
    writeFileSync(join(other, 'remote.txt'), 'r\n');
    sh(other, 'add', '-A');
    sh(other, 'commit', '-m', 'remote change');
    sh(other, 'push');
    edit(root);
    const { p } = panel(root);
    await p.commit('Mine', GitScope.Feega, GitAfter.Stay);
    await p.pull();
    const prompt = await p.fixPrompt();

    expect(prompt).toContain('1 ahead, 1 behind origin/main');
    expect(prompt).toContain('fast-forward');
  });

  it('has no prompt when nothing failed', async () => {
    const { root } = repo();
    const { p } = panel(root);

    expect(await p.fixPrompt()).toBeNull();
  });

  it('explains a repository without a remote', async () => {
    const { top, root } = repo();
    sh(top, 'remote', 'remove', 'origin');
    edit(root);
    const { p, result, view } = panel(root);
    await p.commit('Local only', GitScope.Feega, GitAfter.Push);

    expect(view().remote).toBeNull();
    expect(result()).toMatchObject({ action: GitAction.Push, ok: false });
    expect(result().text).toContain('remote');
  });

  it('never forces a push and never prompts for credentials', async () => {
    const { root } = repo();
    edit(root);
    const { p, calls } = panel(root);
    await p.commit('Safe', GitScope.Feega, GitAfter.Push);
    await p.pull();

    const flat = calls.flat();
    expect(flat.some((a) => /^(--force|-f$|--force-with-lease|\+)/.test(a))).toBe(false);
    expect(flat).toContain('push');
  });

  it('explains a folder that is not a repository', async () => {
    const dir = tmp('plain');
    const { p, view } = panel(dir);
    await p.refresh();

    expect(view().state).toBe(GitState.NotRepo);
  });
});

describe('git panel with a stubbed command', () => {
  const answer = (map: Record<string, { code: number; out?: string; err?: string }>): GitRun => async (args) => {
    const hit = Object.entries(map).find(([key]) => args.includes(key));
    const found = hit?.[1] ?? { code: 0 };
    return { code: found.code, out: found.out ?? '', err: found.err ?? '' };
  };
  const READY = '# branch.head main\n# branch.upstream origin/main\n# branch.ab +1 -0\n1 .M N... 1 1 1 a b src/Hero.svelte\n';

  it('reports a missing git program', async () => {
    const { p, view } = panel('/x', [], async () => ({ code: GIT_MISSING, out: '', err: '' }));
    await p.refresh();

    expect(view().state).toBe(GitState.NoGit);
  });

  it('sends the user to sign in from a terminal when git cannot authenticate', async () => {
    const run = answer({ '--show-prefix': { code: 0 }, status: { code: 0, out: READY }, remote: { code: 0, out: 'origin\n' }, push: { code: 1, err: 'fatal: Authentication failed for https://github.com/x/y' } });
    const { p, result } = panel('/x', ['src/Hero.svelte'], run);
    await p.push();

    expect(result()).toMatchObject({ ok: false, fix: GitFix.SignIn });
    expect(result().text).toContain('terminal');
    expect(result().text).toContain('Feega does not store credentials');
  });

  it('asks for a git identity when commit cannot tell who the author is', async () => {
    const run = answer({ '--show-prefix': { code: 0 }, status: { code: 0, out: READY }, remote: { code: 0, out: 'origin\n' }, commit: { code: 128, err: '*** Please tell me who you are.' } });
    const { p, result } = panel('/x', ['src/Hero.svelte'], run);
    await p.commit('m', GitScope.Feega, GitAfter.Stay);

    expect(result()).toMatchObject({ fix: GitFix.Identity });
    expect(result().text).toContain('name and email');
  });
});
