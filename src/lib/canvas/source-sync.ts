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
