export enum GitFailure {
  BranchGone = 'branch_gone',
  Diverged = 'diverged',
  Unauthorized = 'unauthorized',
  Forbidden = 'forbidden',
  NotFound = 'not_found',
  Unexpected = 'unexpected'
}

export class GitError extends Error {
  constructor(
    readonly failure: GitFailure,
    readonly status: number
  ) {
    super(`git host refused: ${failure} (${status})`);
  }
}

export enum PullStatus {
  Open = 'open',
  Closed = 'closed',
  Merged = 'merged'
}

export enum Access {
  Write = 'write',
  Read = 'read'
}

export enum FileMove {
  Modified = 'modified',
  Added = 'added',
  Removed = 'removed',
  Renamed = 'renamed'
}

export type FileWrite = { path: string; content: string | null };

export type CommitAsk = { parent: string; message: string; files: FileWrite[] };

export type PullAsk = { branch: string; base: string; title: string; body: string };

export type PullRef = { number: number; url: string };

export type PullSeen = PullRef & { status: PullStatus };

export type Check = { name: string; status: string; conclusion: string | null };

export type PullState = PullSeen & { headSha: string; checks: Check[] };

export type FileChanged = { path: string; move: FileMove; from: string | null };

export type GitHost = {
  defaultBranch: () => Promise<string>;
  access: () => Promise<Access>;
  headOf: (branch: string) => Promise<string>;
  readFile: (path: string, ref: string) => Promise<string | null>;
  writeCommit: (ask: CommitAsk) => Promise<string>;
  createBranch: (branch: string, sha: string) => Promise<void>;
  moveBranch: (branch: string, from: string, to: string) => Promise<void>;
  isAncestor: (sha: string, head: string) => Promise<boolean>;
  lastPull: (branch: string) => Promise<PullSeen | null>;
  upsertPull: (ask: PullAsk) => Promise<PullRef>;
  pull: (number: number) => Promise<PullState>;
  changedSince: (sha: string, ref: string) => Promise<FileChanged[]>;
};
