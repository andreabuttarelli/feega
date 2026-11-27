import { GitFix, GitHost } from '../messages';

export type GitStatus = { branch: string | null; upstream: string | null; ahead: number; behind: number; paths: string[] };

export type EditedRow = { at: string; prop: string; files: string[] };

export enum GitFailure {
  NeedsPull = 'needs-pull',
  Diverged = 'diverged',
  Auth = 'auth',
  Identity = 'identity',
  Other = 'other'
}

const HEAD = '# branch.head ';
const UPSTREAM = '# branch.upstream ';
const AHEAD_BEHIND = /^# branch\.ab \+(\d+) -(\d+)/;
const DETACHED = '(detached)';
const ORDINARY_FIELDS = 8;
const RENAMED_FIELDS = 9;
const UNMERGED_FIELDS = 10;
const CHANGED_PREFIX: Record<string, number> = { '1': ORDINARY_FIELDS, '2': RENAMED_FIELDS, u: UNMERGED_FIELDS };
const UNTRACKED_PREFIX = '? ';
const TAB = '\t';
const MAX_PROPS = 3;
const MAX_NAMED_FILES = 2;
const EXTENSION = /\.[^./]+$/;
const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;

const FAILURES: [RegExp, GitFailure][] = [
  [/rejected|fetch first|non-fast-forward/i, GitFailure.NeedsPull],
  [/Authentication failed|could not read (Username|Password)|terminal prompts disabled|Permission denied|403|Invalid username or password/i, GitFailure.Auth],
  [/Please tell me who you are|unable to auto-detect email|empty ident name/i, GitFailure.Identity],
  [/Not possible to fast-forward|diverging branches|divergent branches/i, GitFailure.Diverged]
];

function pathOf(line: string): string | null {
  if (line.startsWith(UNTRACKED_PREFIX)) {
    return line.slice(UNTRACKED_PREFIX.length);
  }
  const fields = CHANGED_PREFIX[line[0]];
  if (!fields || line[1] !== ' ') {
    return null;
  }
  const rest = line.split(' ').slice(fields).join(' ');
  return rest.split(TAB)[0];
}

export function parseStatus(out: string): GitStatus {
  const status: GitStatus = { branch: null, upstream: null, ahead: 0, behind: 0, paths: [] };
  for (const line of out.split('\n')) {
    if (line.startsWith(HEAD)) {
      const head = line.slice(HEAD.length);
      status.branch = head === DETACHED ? null : head;
      continue;
    }
    if (line.startsWith(UPSTREAM)) {
      status.upstream = line.slice(UPSTREAM.length);
      continue;
    }
    const counts = line.match(AHEAD_BEHIND);
    if (counts) {
      status.ahead = Number(counts[1]);
      status.behind = Number(counts[2]);
      continue;
    }
    const path = pathOf(line);
    if (path) {
      status.paths.push(path);
    }
  }
  return status;
}

export function splitFiles(paths: string[], edited: Set<string>): { feega: string[]; others: string[] } {
  return { feega: paths.filter((p) => edited.has(p)), others: paths.filter((p) => !edited.has(p)) };
}

const unique = <T>(items: T[]) => [...new Set(items)];
const words = (prop: string) => prop.replace(CAMEL_BOUNDARY, '$1 $2').toLowerCase();
const nameOf = (file: string) => (file.split('/').pop() ?? file).replace(EXTENSION, '');

function listed(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function commitMessage(rows: EditedRow[]): string {
  if (!rows.length) {
    return '';
  }
  const props = unique(rows.map((r) => words(r.prop)));
  const files = unique(rows.flatMap((r) => r.files.map(nameOf)));
  const shown = props.length > MAX_PROPS ? [...props.slice(0, MAX_PROPS), `${props.length - MAX_PROPS} more`] : props;
  const what = shown.length > MAX_PROPS ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : listed(shown);
  const where = files.length > MAX_NAMED_FILES ? `${files.length} files` : listed(files);
  return where ? `Update ${what} in ${where}` : `Update ${what}`;
}

export function failureOf(stderr: string): GitFailure {
  return FAILURES.find(([pattern]) => pattern.test(stderr))?.[1] ?? GitFailure.Other;
}

const FIXES: Record<GitFailure, GitFix> = {
  [GitFailure.NeedsPull]: GitFix.PullAndPush,
  [GitFailure.Diverged]: GitFix.Sync,
  [GitFailure.Auth]: GitFix.SignIn,
  [GitFailure.Identity]: GitFix.Identity,
  [GitFailure.Other]: GitFix.Agent
};

export const fixFor = (failure: GitFailure): GitFix => FIXES[failure];

export type GitFailed = { action: string; stderr: string };

export function fixPrompt(failed: GitFailed, status: GitStatus): string {
  const branch = status.branch ?? 'no branch (detached HEAD)';
  const sync = `${status.ahead} ahead, ${status.behind} behind ${status.upstream ?? 'no upstream'}`;
  const changed = status.paths.length ? status.paths.join(', ') : 'none';
  return [
    `Feega tried to ${failed.action} in this project and git failed. Resolve it safely.`,
    `Branch: ${branch} (${sync}).`,
    `Uncommitted files: ${changed}.`,
    `Git said:\n${failed.stderr.trim()}`,
    'Never force push, never discard uncommitted work, and never rewrite commits that are already pushed. Explain what you did when you are done.'
  ].join('\n');
}

const GITHUB_REMOTE = /^(?:[a-z+]+:\/\/(?:[^@/]+@)?|[^@/\s]+@)github\.com[/:]/i;

export const hostOf = (url: string): GitHost => (GITHUB_REMOTE.test(url.trim()) ? GitHost.GitHub : GitHost.Other);
