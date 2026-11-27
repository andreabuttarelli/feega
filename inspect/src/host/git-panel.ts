import { GitAction, GitAfter, GitScope, GitState, ToView, type GitView, type ViewMessage } from '../messages';
import { GitFailure, commitMessage, failureOf, parseStatus, splitFiles, type EditedRow, type GitStatus } from './git-status';

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
const IDENTITY = 'Git does not know who you are. Run `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"` in a terminal.';

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

  const say = (action: GitAction, ok: boolean, text: string, pull = false) => post({ kind: ToView.GitResult, action, ok, text, pull });

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
      await say(GitAction.Commit, false, explain(done.err || done.out));
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
    const failure = failureOf(done.err);
    await say(GitAction.Push, false, explain(done.err), failure === GitFailure.NeedsPull);
    await show();
  }

  async function doPull() {
    const done = await run(['pull', '--ff-only']);
    if (done.code === 0) {
      await say(GitAction.Pull, true, 'Pulled the latest commits.');
      await show();
      return;
    }
    await say(GitAction.Pull, false, explain(done.err));
    await show();
  }

  return {
    refresh: () => inTurn(show),
    commit: (message: string, scope: GitScope, after: GitAfter) => inTurn(() => doCommit(message, scope, after)),
    push: () => inTurn(doPush),
    pull: () => inTurn(doPull)
  };
}
