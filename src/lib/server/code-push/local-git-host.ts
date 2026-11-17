import { commitTree, git, type GitRun } from './git-cli';
import { Access, FileMove, GitError, GitFailure, type GitHost } from './git-host';

export enum Publish {
  Origin = 'origin',
  Local = 'local'
}

export type LocalOptions = { publish: Publish; pulls?: GitHost | null };

const ORIGIN = 'origin';
const MIRROR = 'refs/feega/origin/';
const FALLBACK_DEFAULT = 'main';
const NO_PULLS = 0;
const SHA = /^[0-9a-f]{7,40}$/;

const MOVE_OF_CODE: Record<string, FileMove> = { A: FileMove.Added, D: FileMove.Removed, R: FileMove.Renamed, M: FileMove.Modified };

const REFUSAL_OF_STDERR: [RegExp, GitFailure][] = [
  [/couldn't find remote ref|not a valid ref|unknown revision|bad revision/i, GitFailure.BranchGone],
  [/non-fast-forward|fetch first|already exists|stale info|cannot lock ref/i, GitFailure.Diverged],
  [/authentication failed|could not read username|invalid username or password|bad credentials/i, GitFailure.Unauthorized],
  [/permission denied|protected branch|403|GH006/i, GitFailure.Forbidden]
];

const failureOf = (run: GitRun) => REFUSAL_OF_STDERR.find(([pattern]) => pattern.test(run.err))?.[1] ?? GitFailure.Unexpected;

export function localGitHost(dir: string, options: LocalOptions): GitHost {
  const onOrigin = options.publish === Publish.Origin;

  const run = async (args: string[], refusal?: GitFailure) => {
    const done = await git(dir, args);
    if (done.code) {
      throw new GitError(refusal ?? failureOf(done), done.code);
    }
    return done.out.trim();
  };

  const headOf = async (branch: string) => {
    if (onOrigin) {
      await run(['fetch', '-q', '--no-tags', ORIGIN, `+refs/heads/${branch}:${MIRROR}${branch}`]);
      return run(['rev-parse', '--verify', `${MIRROR}${branch}^{commit}`], GitFailure.BranchGone);
    }
    return run(['rev-parse', '--verify', `refs/heads/${branch}^{commit}`], GitFailure.BranchGone);
  };

  const resolve = (ref: string) => (SHA.test(ref) ? run(['rev-parse', '--verify', `${ref}^{commit}`], GitFailure.NotFound) : headOf(ref));

  const setRef = async (branch: string, to: string, from: string | null) => {
    if (onOrigin) {
      await run(['push', '-q', '--no-verify', ORIGIN, `${to}:refs/heads/${branch}`]);
      await run(['update-ref', `${MIRROR}${branch}`, to]);
      return;
    }
    await run(['update-ref', `refs/heads/${branch}`, to, from ?? ''], GitFailure.Diverged);
  };

  const pulls = options.pulls ?? null;

  return {
    defaultBranch: async () => {
      if (!onOrigin) {
        return (await git(dir, ['symbolic-ref', '--short', 'HEAD'])).out.trim() || FALLBACK_DEFAULT;
      }
      const symref = await git(dir, ['ls-remote', '--symref', ORIGIN, 'HEAD']);
      return symref.out.match(/ref: refs\/heads\/(\S+)\s+HEAD/)?.[1] ?? FALLBACK_DEFAULT;
    },
    access: async () => Access.Write,
    headOf,
    readFile: async (path, ref) => {
      const shown = await git(dir, ['show', `${await resolve(ref)}:${path}`]);
      return shown.code ? null : shown.out;
    },
    writeCommit: async (ask) => {
      const done = await commitTree(dir, ask.files, [ask.parent], ask.message);
      if (done.code) {
        throw new GitError(failureOf(done), done.code);
      }
      return done.out.trim();
    },
    createBranch: (branch, sha) => setRef(branch, sha, null),
    moveBranch: async (branch, from, to) => {
      if ((await headOf(branch)) !== from) {
        throw new GitError(GitFailure.Diverged, 1);
      }
      await setRef(branch, to, from);
    },
    isAncestor: async (sha, head) => (await git(dir, ['merge-base', '--is-ancestor', sha, await resolve(head)])).code === 0,
    lastPull: async (branch) => (pulls ? pulls.lastPull(branch) : null),
    upsertPull: async (ask) => {
      if (!pulls) {
        throw new GitError(GitFailure.PullUnavailable, NO_PULLS);
      }
      return pulls.upsertPull(ask);
    },
    pull: async (number) => {
      if (!pulls) {
        throw new GitError(GitFailure.PullUnavailable, NO_PULLS);
      }
      return pulls.pull(number);
    },
    changedSince: async (sha, ref) => {
      const diff = await run(['diff', '--name-status', '-M', sha, await resolve(ref)]);
      return diff
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [code, a, b] = line.split('\t');
          const move = MOVE_OF_CODE[code[0]] ?? FileMove.Modified;
          return move === FileMove.Renamed ? { path: b, move, from: a } : { path: a, move, from: null };
        });
    }
  };
}
