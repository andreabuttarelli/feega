import type { AutosaveState } from './code-autosave';
import { ciOf, CiState, pushAskOf, type FrameSync, type PullView } from './source-changes';

export const AUTOSAVE_NAME = 'canvas-edits';

const GITHUB = 'github';
const DRAFT = 'draft';
const BASE_TARGET = 'base';

export enum BranchMode {
  Session = 'session',
  Direct = 'direct'
}

export type BranchOptions = { mode: BranchMode; branch: string };

export type GitSummary = { repo: string; branch: string; base: string; upstream: number; pull: PullView | null; draft: boolean; ci: CiState; autosave: AutosaveState; nodeId: string };

const onGithub = (rows: readonly FrameSync[]) => rows.filter((r) => r.link.source === GITHUB);

export function branchFields(options: BranchOptions) {
  const branch = options.branch.trim();
  return { ...(branch ? { branch } : {}), ...(options.mode === BranchMode.Direct ? { target: BASE_TARGET } : {}) };
}

export function autosaveAsk(rows: readonly FrameSync[], nodeIds: readonly string[], options: BranchOptions) {
  const ask = pushAskOf(onGithub(rows), new Set(nodeIds), AUTOSAVE_NAME);
  return ask ? { ...ask, pull: DRAFT, ...branchFields(options) } : null;
}

export function gitSummary(syncs: readonly FrameSync[], autosave: AutosaveState): GitSummary | null {
  const github = onGithub(syncs);
  const lead = github.find((s) => s.link.pushBranch) ?? github[0];
  if (!lead) {
    return null;
  }
  const pull = lead.push?.pull ?? null;
  return {
    repo: lead.link.repo ?? '',
    branch: lead.link.pushBranch ?? lead.link.baseBranch,
    base: lead.link.baseBranch,
    upstream: lead.push?.upstream?.length ?? 0,
    pull,
    draft: pull?.draft === true,
    ci: pull ? ciOf(pull) : CiState.None,
    autosave,
    nodeId: lead.nodeId
  };
}
