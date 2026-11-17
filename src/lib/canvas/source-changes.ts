export enum SourceAction {
  Update = 'update',
  ViewPr = 'view-pr',
  MakeVariant = 'make-variant',
  Detach = 'detach'
}

export enum CiState {
  None = 'none',
  Running = 'running',
  Passed = 'passed',
  Failed = 'failed'
}

export type PullView = { number: number; url: string; status: string; checks: { name: string; status: string; conclusion: string | null }[] };

export type LinkView = { entry: string; appRoot: string; baseSha: string; baseBranch: string; writable: boolean; pushBranch?: string; pullNumber?: number; beforePoster?: string; variantOf?: string };

export type Affected = { path: string; pages: number };

export type Proposal = { component: string; props: string[] };

export type FrameSync = { nodeId: string; name: string; state: string; link: LinkView; push: { pull?: PullView | null } | null; affected?: Affected[]; proposals?: Proposal[] };

export type Popover = { file: string; commit: string; branch: string; actions: SourceAction[] };

const SHORT_SHA = 7;
const CHANGED_STATES = new Set(['modified', 'conflict']);
const UPDATE_STATES = new Set(['newer_upstream', 'conflict', 'orphan']);
const GREEN = new Set(['success', 'skipped', 'neutral']);

type ActionRule = { action: SourceAction; holds: (s: FrameSync) => boolean };

const ACTION_RULES: ActionRule[] = [
  { action: SourceAction.Update, holds: (s) => UPDATE_STATES.has(s.state) },
  { action: SourceAction.ViewPr, holds: (s) => Boolean(s.push?.pull?.url) },
  { action: SourceAction.MakeVariant, holds: (s) => !s.link.variantOf },
  { action: SourceAction.Detach, holds: () => true }
];

const fileOf = (link: LinkView) => (link.appRoot ? `${link.appRoot.replace(/\/$/, '')}/${link.entry}` : link.entry);

export const popoverOf = (s: FrameSync): Popover => ({ file: fileOf(s.link), commit: s.link.baseSha.slice(0, SHORT_SHA), branch: s.link.baseBranch, actions: ACTION_RULES.filter((r) => r.holds(s)).map((r) => r.action) });

export const changedRows = (syncs: readonly FrameSync[]) => syncs.filter((s) => CHANGED_STATES.has(s.state));

const PUSH_PREFIX = 'feega/';

const NO_MAINS: ReadonlySet<string> = new Set();

export enum VariantChoice {
  Replace = 'replace',
  NewRoute = 'new_route',
  Keep = 'keep'
}

export type VariantAnswer = { nodeId: string; choice: `${VariantChoice}`; route?: string };

export function pushAskOf(rows: readonly FrameSync[], picked: ReadonlySet<string>, name: string, mains: ReadonlySet<string> = NO_MAINS, variants: readonly VariantAnswer[] = []) {
  const chosen = rows.filter((r) => picked.has(r.nodeId));
  if (!chosen.length) {
    return null;
  }
  const open = chosen.find((r) => r.link.pushBranch)?.link.pushBranch;
  const toMain = chosen.filter((r) => mains.has(r.nodeId)).map((r) => r.nodeId);
  const answered = variants.filter((v) => chosen.some((r) => r.nodeId === v.nodeId));
  return { name: open ? open.slice(PUSH_PREFIX.length) : name, nodeIds: chosen.map((r) => r.nodeId), ...(toMain.length ? { mains: toMain } : {}), ...(answered.length ? { variants: answered } : {}) };
}

export function impactOf(row: FrameSync): string | null {
  const pages = Math.max(0, ...(row.affected ?? []).map((a) => a.pages));
  return pages ? `${pages} pages affected` : null;
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
