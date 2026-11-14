import type { UndoItem } from '$lib/canvas/undo-plan';

export enum PasteState {
  Loading = 'loading',
  Landed = 'landed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Undone = 'undone'
}

export enum Landing {
  Show = 'show',
  Discard = 'discard'
}

export type PasteJob = {
  id: string;
  html: string;
  at: { x: number; y: number };
  state: PasteState;
  nodeIds: string[];
  undo: UndoItem[];
  error: string | null;
};

export type PasteAnswer = { nodeIds: string[]; undo: UndoItem[] };

export const PLACEHOLDER_STATES = new Set([PasteState.Loading, PasteState.Failed]);

export function startPaste(html: string, at: { x: number; y: number }): PasteJob {
  return { id: crypto.randomUUID(), html, at, state: PasteState.Loading, nodeIds: [], undo: [], error: null };
}

export function cancelPaste(job: PasteJob): PasteJob {
  return { ...job, state: PasteState.Cancelled };
}

export function failPaste(job: PasteJob, error: string): PasteJob {
  return { ...job, state: PasteState.Failed, error };
}

export function landPaste(job: PasteJob, answer: PasteAnswer): { job: PasteJob; landing: Landing } {
  const withAnswer = { ...job, nodeIds: answer.nodeIds, undo: answer.undo };
  if (job.state === PasteState.Cancelled) {
    return { job: withAnswer, landing: Landing.Discard };
  }
  return { job: { ...withAnswer, state: PasteState.Landed }, landing: Landing.Show };
}

export function undoPaste(job: PasteJob): PasteJob {
  return { ...job, state: PasteState.Undone };
}
