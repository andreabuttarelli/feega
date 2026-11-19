import type { AutosaveState } from './code-autosave';
import { ciOf, CiState, type FrameSync, type PullView } from './source-changes';

export const COMMIT_IDLE_MS = 2 * 60_000;
export const COMMIT_MAX_MS = 10 * 60_000;

const GITHUB = 'github';
const NAMED_FRAMES = 2;

export type GitSummary = { repo: string; branch: string | null; imported: string; upstream: number; pull: PullView | null; draft: boolean; ci: CiState; autosave: AutosaveState; nodeId: string };

export const onGithub = (rows: readonly FrameSync[]) => rows.filter((r) => r.link.source === GITHUB);

function framesText(names: readonly string[]): string {
  if (names.length <= NAMED_FRAMES) {
    return names.join(' and ');
  }
  return `${names.slice(0, NAMED_FRAMES).join(', ')} and ${names.length - NAMED_FRAMES} more`;
}

export const commitSummary = (names: readonly string[], files: readonly string[]) => [`Update ${framesText(names)}`, '', ...files.map((f) => `- ${f}`)].join('\n');

export const commitDue = (at: { firstAt: number | null; lastAt: number | null; now: number }) => at.firstAt !== null && at.lastAt !== null && (at.now - at.lastAt >= COMMIT_IDLE_MS || at.now - at.firstAt >= COMMIT_MAX_MS);

export function gitSummary(syncs: readonly FrameSync[], autosave: AutosaveState): GitSummary | null {
  const github = onGithub(syncs);
  const lead = github.find((s) => s.link.workBranch) ?? github[0];
  if (!lead) {
    return null;
  }
  const pull = lead.push?.pull ?? null;
  return {
    repo: lead.link.repo ?? '',
    branch: lead.link.workBranch ?? null,
    imported: lead.link.baseBranch,
    upstream: lead.push?.upstream?.length ?? 0,
    pull,
    draft: pull?.draft === true,
    ci: pull ? ciOf(pull) : CiState.None,
    autosave,
    nodeId: lead.nodeId
  };
}
