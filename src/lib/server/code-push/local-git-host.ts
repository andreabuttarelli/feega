import { commitTree, git, type GitRun } from './git-cli';
import { Access, FileMove, GitError, GitFailure, RefKind, type GitHost, type RefSeen } from './git-host';

export enum Publish {
  Origin = 'origin',
  Local = 'local'
}

export type LocalOptions = { publish: Publish; pulls?: GitHost | null };

const ORIGIN = 'origin';
const MIRROR = 'refs/feega/origin/';
const TAG_MIRROR = 'refs/feega/tags/';
const FALLBACK_DEFAULT = 'main';
const NO_PULLS = 0;
const FIELD = '\x1f';
const LOG_FORMAT = ['%H', '%s', '%an', '%aI'].join('%x1f');
const PEELED = '^{}';
const SHA = /^[0-9a-f]{7,40}$/;

const MOVE_OF_CODE: Record<string, FileMove> = { A: FileMove.Added, D: FileMove.Removed, R: FileMove.Renamed, M: FileMove.Modified };

const REFUSAL_OF_STDERR: [RegExp, GitFailure][] = [
  [/couldn't find remote ref|not a valid ref|unknown revision|bad revision/i, GitFailure.BranchGone],
  [/non-fast-forward|fetch first|already exists|stale info|cannot lock ref/i, GitFailure.Diverged],
  [/authentication failed|could not read username|invalid username or password|bad credentials/i, GitFailure.Unauthorized],
  [/permission denied|protected branch|403|GH006/i, GitFailure.Forbidden]
];

const KIND_OF_PREFIX: [string, RefKind][] = [
  ['refs/heads/', RefKind.Branch],
  ['refs/tags/', RefKind.Tag]
];

function refsOf(lines: string): RefSeen[] {
  const seen = new Map<string, RefSeen>();
  for (const line of lines.split('\n').filter(Boolean)) {
    const [sha, full] = line.split(/\s+/);
    const peeled = full.endsWith(PEELED);
    const ref = peeled ? full.slice(0, -PEELED.length) : full;
    const kind = KIND_OF_PREFIX.find(([prefix]) => ref.startsWith(prefix));
    if (!kind || (seen.has(ref) && !peeled)) {
      continue;
    }
    seen.set(ref, { name: ref.slice(kind[0].length), kind: kind[1], sha });
  }
  return [...seen.values()];
}

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

  const tagOf = async (tag: string) => {
    if (onOrigin) {
      await run(['fetch', '-q', '--no-tags', ORIGIN, `+refs/tags/${tag}:${TAG_MIRROR}${tag}`], GitFailure.BranchGone);
      return run(['rev-parse', '--verify', `${TAG_MIRROR}${tag}^{commit}`], GitFailure.BranchGone);
    }
    return run(['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], GitFailure.BranchGone);
  };

  const branchOrTag = (ref: string) => headOf(ref).catch(() => tagOf(ref));

  const resolve = (ref: string) => (SHA.test(ref) ? run(['rev-parse', '--verify', `${ref}^{commit}`], GitFailure.NotFound) : branchOrTag(ref));

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
    markReady: async (number) => {
      if (!pulls) {
        throw new GitError(GitFailure.PullUnavailable, NO_PULLS);
      }
      return pulls.markReady(number);
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
    },
    listRefs: async () => {
      const listed = onOrigin ? await run(['ls-remote', '--heads', '--tags', ORIGIN]) : await run(['for-each-ref', '--format=%(if)%(*objectname)%(then)%(*objectname)%(else)%(objectname)%(end) %(refname)', 'refs/heads', 'refs/tags']);
      return refsOf(listed);
    },
    listCommits: async (ref, ask) => {
      const log = await run(['log', `--format=${LOG_FORMAT}`, '-n', String(ask.limit), await resolve(ref), '--', ...(ask.path ? [ask.path] : [])]);
      return log
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [sha, message, author, at] = line.split(FIELD);
          return { sha, message, author, at };
        });
    },
    listPulls: async () => (pulls ? pulls.listPulls() : [])
  };
}
