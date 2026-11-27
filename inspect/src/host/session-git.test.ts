import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp, Side } from '@feega/live-edit/live-fields';
import { fileURLToPath } from 'node:url';
import { GitAfter, GitFix, GitScope, GitState, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { nodeGit } from './node-git';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';
import { AcpId } from './ai/acp-agents';
import { AgentEventKind, type OpenAgent } from './ai/agent-session';
import { openAcpAgent } from './ai/acp-session';
import type { AgentEnv } from './agents';

const FAKE = fileURLToPath(new URL('./ai/fake-acp-agent.mjs', import.meta.url));

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
  const stored: { key: string; value: unknown }[] = [];
  const env: AgentEnv = { path: ['/bin'], home: '/home/none', exists: (p) => p === '/bin/opencode', appName: '', extensions: [] };
  const open: OpenAgent = (_launch, deps) => openAcpAgent({ command: process.execPath, args: [FAKE] }, deps);
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: (key: string) => stored.filter((s) => s.key === key).at(-1)?.value,
    store: async (key: string, value: unknown) => void stored.push({ key, value }),
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    git: (root: string) => nodeGit(root, ENV),
    ai: { env: () => env, open }
  } as unknown as Platform;
  inspectSession(platform, dir);
  const view = () => (sent.filter((m) => m.kind === ToView.Git).at(-1) as Extract<ViewMessage, { kind: ToView.Git }>).view;
  const result = () => sent.filter((m) => m.kind === ToView.GitResult).at(-1) as Extract<ViewMessage, { kind: ToView.GitResult }>;
  return { sent, stored, dir, remote, view, result, send: (m: HostMessage) => handle(m) };
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

  it('starts collapsed and remembers the commit area opened, through later prefs saves', async () => {
    const { send, view } = setup();
    await send({ kind: ToHost.GitRefresh });

    expect(view().open).toBe(false);

    await send({ kind: ToHost.GitOpen, open: true });

    expect(view().open).toBe(true);

    await send({ kind: ToHost.Prefs, prefs: { size: 'full', custom: null, barClosed: false } });
    await send({ kind: ToHost.GitRefresh });

    expect(view().open).toBe(true);
  });

  it('pulls and pushes from one message', async () => {
    const { send, dir, remote } = setup();
    const other = realpathSync(mkdtempSync(join(tmpdir(), 'feega-session-other-')));
    sh(other, 'clone', remote, '.');
    writeFileSync(join(other, 'remote.txt'), 'r\n');
    sh(other, 'add', '-A');
    sh(other, 'commit', '-m', 'remote change');
    sh(other, 'push');
    await send({ kind: ToHost.GitPullPush });

    expect(sh(dir, 'log', '-1', '--format=%s')).toBe('remote change');
  });

  it('saves the identity typed in the view', async () => {
    const { send, dir } = setup();
    await send({ kind: ToHost.GitIdentity, name: 'Ada', email: 'ada@example.dev' });

    expect(sh(dir, 'config', '--local', 'user.email')).toBe('ada@example.dev');
  });

  it('starts the chosen agent with the repository state and error when the branches diverged', async () => {
    const { send, dir, remote, result, stored, sent } = setup();
    const other = realpathSync(mkdtempSync(join(tmpdir(), 'feega-session-other-')));
    sh(other, 'clone', remote, '.');
    writeFileSync(join(other, 'remote.txt'), 'r\n');
    sh(other, 'add', '-A');
    sh(other, 'commit', '-m', 'remote change');
    sh(other, 'push');
    await send({ kind: ToHost.Edit, ask: PADDING });
    await send({ kind: ToHost.GitCommit, message: 'Mine', scope: GitScope.Feega, after: GitAfter.Stay });
    await send({ kind: ToHost.GitPull });

    expect(result()).toMatchObject({ ok: false, fix: GitFix.Sync });

    await send({ kind: ToHost.GitFix, agent: AcpId.OpenCode });
    await eventually(() => sent.some((m) => m.kind === ToView.AiEvent && m.event.kind === AgentEventKind.Done));

    const saved = JSON.stringify(stored.filter((s) => s.key.includes('aiChats')));
    expect(saved).toContain('1 ahead, 1 behind origin/main');
    expect(saved).toContain('Never force push');
    expect(sh(dir, 'log', '-1', '--format=%s')).toBe('Mine');
  });
});

const WAIT_MS = 5000;

async function eventually(check: () => boolean) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > WAIT_MS) {
      throw new Error('timed out');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}