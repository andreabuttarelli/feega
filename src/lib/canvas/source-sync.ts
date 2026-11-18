import { SourceSync } from './core/frame-header';

const SYNC_OF_STATE: Record<string, SourceSync> = {
  conflict: SourceSync.Conflict,
  orphan: SourceSync.Orphan,
  access_lost: SourceSync.ReadOnly,
  newer_upstream: SourceSync.Upstream,
  modified: SourceSync.Modified,
  in_pull: SourceSync.InPr,
  in_sync: SourceSync.InSync
};

const LINKABLE_KINDS = new Set(['github', 'folder']);

export const syncOf = (state: string): SourceSync[] => (SYNC_OF_STATE[state] ? [SYNC_OF_STATE[state]] : []);

type Summary = { id: string; data?: unknown };

const kindOf = (data: unknown) => ((data as { code?: { kind?: string } } | undefined)?.code?.kind ?? '');

export const linkedFrames = (nodes: readonly Summary[]): string[] => nodes.filter((n) => LINKABLE_KINDS.has(kindOf(n.data))).map((n) => n.id);

export enum PushOutcome {
  Pushed = 'pushed',
  NeedsConfirm = 'needs_confirm',
  ReadOnly = 'read_only',
  VariantChoice = 'variant_choice',
  Failed = 'failed'
}

const OUTCOME_OF_REFUSAL: Record<string, PushOutcome> = { needs_confirm: PushOutcome.NeedsConfirm, read_only: PushOutcome.ReadOnly, variant_choice: PushOutcome.VariantChoice };

export const pushOutcomeOf = (body: { ok?: boolean; refusal?: string } | null): PushOutcome => (body?.ok ? PushOutcome.Pushed : (OUTCOME_OF_REFUSAL[body?.refusal ?? ''] ?? PushOutcome.Failed));

export const editedFilesText = (files: readonly { path: string; content: string }[]) => files.map((f) => `--- ${f.path}\n${f.content}`).join('\n\n');
