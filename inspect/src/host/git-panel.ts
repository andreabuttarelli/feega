import { GitAction, GitAfter, GitFix, GitScope, GitState, ToView, type GitView, type ViewMessage } from '../messages';
import { GitFailure, commitMessage, failureOf, fixFor, fixPrompt, parseStatus, splitFiles, type EditedRow, type GitFailed, type GitStatus } from './git-status';

export const GIT_MISSING = -1;

export type GitOut = { code: number; out: string; err: string };

export type GitRun = (args: string[]) => Promise<GitOut>;

export type GitPanelHost = { run: GitRun; post: (message: ViewMessage) => unknown; rows: () => EditedRow[] };

type Snapshot = { view: GitView; status: GitStatus };

const DEFAULT_REMOTE = 'origin';
const TOP = ':(top,literal)';
const WHOLE_TREE = ':/';
const STATUS_ARGS = ['-c', 'core.quotepath=off', '-c', 'status.relativePaths=false', 'status', '--porcelain=v2', '--branch', '--untracked-files=all'];
const FATAL = /^(fatal|error): /;

const NOTHING = 'Nothing to commit.';
const NO_MESSAGE = 'Write a commit message.';
const DETACHED = 'No branch is checked out: switch to a branch to push.';
const NO_REMOTE = 'This repository has no remote. Add one in a terminal with `git remote add origin <url>`, then push.';
const NOTHING_TO_PUSH = 'Nothing to push.';
const AUTH = 'Git could not sign in to the remote. Sign in to git or GitHub in a terminal (for example `gh auth login`), then try again. Feega does not store credentials.';
const NEEDS_PULL = 'The remote has commits you do not have. Pull, then push again.';
const DIVERGED = 'Your branch and the remote have diverged. Feega only fast-forwards: run `git pull --rebase` in a terminal.';
const IDENTITY = 'Git does not know who you are. Enter a name and email to save for this repository.';
const NEED_IDENTITY = 'Enter both a name and an email.';
const IDENTITY_SAVED = 'Saved for this repository. Commit again.';

const FAILURE_TEXT: Record<GitFailure, string | null> = {
  [GitFailure.Auth]: AUTH,
  [GitFailure.NeedsPull]: NEEDS_PULL,
  [GitFailure.Diverged]: DIVERGED,
  [GitFailure.Identity]: IDENTITY,
  [GitFailure.Other]: null
};

const reasonOf = (err: string) => {
  const line = err.split('\n').find((l) => l.trim()) ?? 'git failed';
  return line.replace(FATAL, '').trim();
};

const explain = (err: string) => FAILURE_TEXT[failureOf(err)] ?? reasonOf(err);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function gitPanel({ run, post, rows }: GitPanelHost) {
  let turn: Promise<unknown> = Promise.resolve();
  let last: GitFailed | null = null;

  const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
    const next = turn.then(work, work);
    turn = next.catch(() => undefined);
    return next;
  };

  const empty = (state: GitState): GitView => ({ state, branch: null, upstream: null, remote: null, ahead: 0, behind: 0, feega: [], others: [], message: '' });

  async function snapshot(): Promise<Snapshot> {
    const none = { branch: null, upstream: null, ahead: 0, behind: 0, paths: [] };
    const prefix = await run(['rev-parse', '--show-prefix']);
    if (prefix.code === GIT_MISSING) {
      return { view: empty(GitState.NoGit), status: none };
    }
    if (prefix.code !== 0) {
      return { view: empty(GitState.NotRepo), status: none };
    }
    const [status, remotes] = await Promise.all([run(STATUS_ARGS), run(['remote'])]);
    const parsed = parseStatus(status.out);
    const names = remotes.out.split('\n').filter(Boolean);
    const remote = names.includes(DEFAULT_REMOTE) ? DEFAULT_REMOTE : (names[0] ?? null);
    const edited = rows();
    const inRepo = new Set(edited.flatMap((r) => r.files.map((f) => prefix.out.trim() + f)));
    const { feega, others } = splitFiles(parsed.paths, inRepo);
    const message = commitMessage(edited);
    return { view: { state: GitState.Ready, branch: parsed.branch, upstream: parsed.upstream, remote, ahead: parsed.ahead, behind: parsed.behind, feega, others, message }, status: parsed };
  }

  const show = async () => {
    const { view } = await snapshot();
    await post({ kind: ToView.Git, view });
    return view;
  };

  const say = (action: GitAction, ok: boolean, text: string, fix = GitFix.None) => post({ kind: ToView.GitResult, action, ok, text, fix });

  async function fail(action: GitAction, err: string) {
    last = { action, stderr: err };
    await say(action, false, explain(err), fixFor(failureOf(err)));
  }

  async function addAndCommit(view: GitView, message: string, scope: GitScope) {
    const specs = view.feega.map((p) => `${TOP}${p}`);
    if (scope === GitScope.All) {
      const added = await run(['add', '-A', '--', WHOLE_TREE]);
      return added.code === 0 ? run(['commit', '-m', message]) : added;
    }
    const added = await run(['add', '--', ...specs]);
    return added.code === 0 ? run(['commit', '-m', message, '--only', '--', ...specs]) : added;
  }

  async function doCommit(message: string, scope: GitScope, after: GitAfter) {
    const text = message.trim();
    const { view } = await snapshot();
    if (view.state !== GitState.Ready) {
      await show();
      return;
    }
    const count = scope === GitScope.All ? view.feega.length + view.others.length : view.feega.length;
    if (!count) {
      await say(GitAction.Commit, false, NOTHING);
      await show();
      return;
    }
    if (!text) {
      await say(GitAction.Commit, false, NO_MESSAGE);
      return;
    }
    const done = await addAndCommit(view, text, scope);
    if (done.code !== 0) {
      await fail(GitAction.Commit, done.err || done.out);
      await show();
      return;
    }
    await say(GitAction.Commit, true, `Committed ${plural(count, 'file')}.`);
    await show();
    if (after === GitAfter.Push) {
      await doPush();
    }
  }

  async function doPush() {
    const { view } = await snapshot();
    if (view.state !== GitState.Ready) {
      await show();
      return;
    }
    if (!view.branch) {
      await say(GitAction.Push, false, DETACHED);
      return;
    }
    if (!view.remote) {
      await say(GitAction.Push, false, NO_REMOTE);
      return;
    }
    if (view.upstream && !view.ahead) {
      await say(GitAction.Push, false, NOTHING_TO_PUSH);
      return;
    }
    const args = view.upstream ? ['push'] : ['push', '-u', view.remote, 'HEAD'];
    const done = await run(args);
    if (done.code === 0) {
      await say(GitAction.Push, true, `Pushed ${view.branch} to ${view.remote}.`);
      await show();
      return;
    }
    await fail(GitAction.Push, done.err);
    await show();
  }

  async function doPull() {
    const done = await run(['pull', '--ff-only']);
    if (done.code === 0) {
      await say(GitAction.Pull, true, 'Pulled the latest commits.');
      await show();
      return;
    }
    await fail(GitAction.Pull, done.err);
    await show();
  }

  async function doPullPush() {
    const pulled = await run(['pull', '--ff-only']);
    if (pulled.code !== 0) {
      await fail(GitAction.Pull, pulled.err);
      await show();
      return;
    }
    const { view } = await snapshot();
    if (!view.ahead) {
      await say(GitAction.Pull, true, 'Pulled the latest commits.');
      await show();
      return;
    }
    await doPush();
  }

  async function doIdentity(name: string, email: string) {
    if (!name.trim() || !email.trim()) {
      await say(GitAction.Commit, false, NEED_IDENTITY, GitFix.Identity);
      return;
    }
    const saved = (await run(['config', '--local', 'user.name', name.trim()])).code === 0 && (await run(['config', '--local', 'user.email', email.trim()])).code === 0;
    await say(GitAction.Commit, saved, saved ? IDENTITY_SAVED : 'Could not write the repository git config.');
  }

  async function doFixPrompt(): Promise<string | null> {
    if (!last) {
      return null;
    }
    const { status } = await snapshot();
    return fixPrompt(last, status);
  }

  return {
    refresh: () => inTurn(show),
    commit: (message: string, scope: GitScope, after: GitAfter) => inTurn(() => doCommit(message, scope, after)),
    push: () => inTurn(doPush),
    pull: () => inTurn(doPull),
    pullAndPush: () => inTurn(doPullPush),
    identity: (name: string, email: string) => inTurn(() => doIdentity(name, email)),
    fixPrompt: () => inTurn(doFixPrompt)
  };
}
