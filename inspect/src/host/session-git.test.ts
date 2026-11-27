import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp, Side } from '@feega/live-edit/live-fields';
import { GitAfter, GitScope, GitState, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { nodeGit } from './node-git';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

const IDENTITY = { GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t.dev', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t.dev', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const ENV = { ...process.env, ...IDENTITY };
const sh = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' }).trim();
const PADDING = { at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.Y, value: '16px', rem: 16 };

function setup() {
  const sent: ViewMessage[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'feega-session-git-')));
  const remote = realpathSync(mkdtempSync(join(tmpdir(), 'feega-session-remote-')));
  sh(remote, 'init', '--bare', '-b', 'main');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } }));
  writeFileSync(join(dir, 'src/Page.svelte'), '<section class="px-4 py-8"></section>\n');
  sh(dir, 'init', '-b', 'main');
  sh(dir, 'remote', 'add', 'origin', remote);
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-m', 'first');
  sh(dir, 'push', '-u', 'origin', 'main');
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    git: (root: string) => nodeGit(root, ENV)
  } as unknown as Platform;
  inspectSession(platform, dir);
  const view = () => (sent.filter((m) => m.kind === ToView.Git).at(-1) as Extract<ViewMessage, { kind: ToView.Git }>).view;
  return { sent, dir, remote, view, send: (m: HostMessage) => handle(m) };
}

describe('commit and push from the Changes tab', () => {
  it('lists the file Feega edited with a message built from the edit', async () => {
    const { send, view } = setup();
    await send({ kind: ToHost.Edit, ask: PADDING });
    await send({ kind: ToHost.GitRefresh });

    expect(view()).toMatchObject({ state: GitState.Ready, feega: ['src/Page.svelte'], message: 'Update padding in Page' });
  });

  it('commits and pushes the edit to the remote', async () => {
    const { send, view, dir, remote } = setup();
    await send({ kind: ToHost.Edit, ask: PADDING });
    await send({ kind: ToHost.GitCommit, message: 'Tighten padding', scope: GitScope.Feega, after: GitAfter.Push });

    expect(sh(remote, 'log', '-1', '--format=%s', 'main')).toBe('Tighten padding');
    expect(sh(dir, 'status', '--porcelain')).toBe('');
    expect(view()).toMatchObject({ ahead: 0, feega: [] });
  });

  it('answers a view without a git program available', async () => {
    const sent: ViewMessage[] = [];
    let handle: (m: HostMessage) => unknown = () => undefined;
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'feega-session-nogit-')));
    const platform = { version: '1', launcher: '', send: (m: ViewMessage) => sent.push(m), receive: (h: typeof handle) => void (handle = h), settings: () => ({}), stored: () => undefined, store: async () => undefined, log: () => undefined, account: memoryAccountStore(), onboarding: memoryOnboardingStore() } as unknown as Platform;
    inspectSession(platform, dir);
    await handle({ kind: ToHost.GitRefresh });

    expect(sent.filter((m) => m.kind === ToView.Git)).toEqual([expect.objectContaining({ view: expect.objectContaining({ state: GitState.NoGit }) })]);
  });
});
