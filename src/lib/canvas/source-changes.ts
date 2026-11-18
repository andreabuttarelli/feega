export enum SourceAction {
  Update = 'update',
  ViewPr = 'view-pr',
  Detach = 'detach'
}

export enum CiState {
  None = 'none',
  Running = 'running',
  Passed = 'passed',
  Failed = 'failed'
}

export type PullView = { number: number; url: string; status: string; checks: { name: string; status: string; conclusion: string | null }[] };

export type LinkView = { entry: string; appRoot: string; baseSha: string; baseBranch: string; writable: boolean; route?: string; pushBranch?: string; pullNumber?: number; beforePoster?: string };

export type FrameSync = { nodeId: string; name: string; state: string; link: LinkView; push: { pull?: PullView | null } | null };

export type Popover = { file: string; commit: string; branch: string; actions: SourceAction[] };

const SHORT_SHA = 7;
const CHANGED_STATES = new Set(['modified', 'conflict']);
const UPDATE_STATES = new Set(['newer_upstream', 'conflict', 'orphan']);
const GREEN = new Set(['success', 'skipped', 'neutral']);

type ActionRule = { action: SourceAction; holds: (s: FrameSync) => boolean };

const ACTION_RULES: ActionRule[] = [
  { action: SourceAction.Update, holds: (s) => UPDATE_STATES.has(s.state) },
  { action: SourceAction.ViewPr, holds: (s) => Boolean(s.push?.pull?.url) },
  { action: SourceAction.Detach, holds: () => true }
];

const fileOf = (link: LinkView) => (link.appRoot ? `${link.appRoot.replace(/\/$/, '')}/${link.entry}` : link.entry);

export const popoverOf = (s: FrameSync): Popover => ({ file: fileOf(s.link), commit: s.link.baseSha.slice(0, SHORT_SHA), branch: s.link.baseBranch, actions: ACTION_RULES.filter((r) => r.holds(s)).map((r) => r.action) });

export const changedRows = (syncs: readonly FrameSync[]) => syncs.filter((s) => CHANGED_STATES.has(s.state));

const PUSH_PREFIX = 'feega/';

export function pushAskOf(rows: readonly FrameSync[], picked: ReadonlySet<string>, name: string) {
  const chosen = rows.filter((r) => picked.has(r.nodeId));
  if (!chosen.length) {
    return null;
  }
  const open = chosen.find((r) => r.link.pushBranch)?.link.pushBranch;
  return { name: open ? open.slice(PUSH_PREFIX.length) : name, nodeIds: chosen.map((r) => r.nodeId) };
}

export function ciOf(pull: PullView): CiState {
  if (!pull.checks.length) {
    return CiState.None;
  }
  if (pull.checks.some((c) => c.conclusion === null)) {
    return CiState.Running;
  }
  return pull.checks.every((c) => GREEN.has(c.conclusion ?? '')) ? CiState.Passed : CiState.Failed;
}

export type ChangedFile = { path: string; diff: string };

const FILE_HEADER = /^--- a\/(.+)\n\+\+\+ b\/.+\n/m;

export function filesOfPatch(patch: string): ChangedFile[] {
  return patch
    .split(/(?=^--- a\/)/m)
    .flatMap((chunk) => {
      const header = chunk.match(FILE_HEADER);
      return header ? [{ path: header[1], diff: chunk.slice(header[0].length) }] : [];
    });
}

export const rowTitle = (s: FrameSync) => s.link.route ?? s.name ?? 'Frame';

export function filesToPush(picked: ReadonlySet<string>, files: ReadonlyMap<string, ChangedFile[]>): string[] {
  return [...new Set([...picked].flatMap((nodeId) => (files.get(nodeId) ?? []).map((f) => f.path)))].sort();
}

const NO_PULL = 'No PR opened: connect GitHub or set a token';

export const pushedNote = (pushed: { branch: string; pull: PullView | null }) => (pushed.pull ? `Branch ${pushed.branch} pushed · PR #${pushed.pull.number}` : `Branch ${pushed.branch} pushed. ${NO_PULL}`);

export function pushLabel(rows: readonly FrameSync[]): string {
  const pushed = rows.find((r) => r.link.pushBranch)?.link;
  if (!pushed) {
    return 'Push and open PR';
  }
  return pushed.pullNumber ? 'Update PR' : 'Update branch';
}
