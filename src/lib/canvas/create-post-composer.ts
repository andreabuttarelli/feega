import { errorCopyFor } from '$lib/canvas/create-post-errors';

function swap(order: string[], from: number, to: number): string[] {
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function moveMediaUp(order: string[], id: string): string[] {
  const index = order.indexOf(id);
  if (index <= 0) return order;
  return swap(order, index, index - 1);
}

export function moveMediaDown(order: string[], id: string): string[] {
  const index = order.indexOf(id);
  if (index === -1 || index >= order.length - 1) return order;
  return swap(order, index, index + 1);
}

export function removeMedia(order: string[], id: string): string[] {
  return order.filter((mediaId) => mediaId !== id);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function defaultScheduleTime(now: Date): string {
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const year = later.getFullYear();
  const month = pad(later.getMonth() + 1);
  const day = pad(later.getDate());
  const hours = pad(later.getHours());
  const minutes = pad(later.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export type ComposerReadiness = {
  hasBrand: boolean;
  hasContent: boolean;
  hasConnectedAccounts: boolean;
};

const SAVE_BLOCKERS: Array<{ blocked: (r: ComposerReadiness) => boolean; reason: string }> = [
  { blocked: (r) => !r.hasBrand, reason: 'Create or pick a brand first.' },
  { blocked: (r) => !r.hasContent, reason: 'Add media or a caption first.' }
];

const SCHEDULE_BLOCKERS: Array<{ blocked: (r: ComposerReadiness) => boolean; reason: string }> = [
  ...SAVE_BLOCKERS,
  { blocked: (r) => !r.hasConnectedAccounts, reason: 'Connect an account for this brand first.' }
];

function reasonFrom(blockers: typeof SAVE_BLOCKERS, readiness: ComposerReadiness): string | null {
  return blockers.find((b) => b.blocked(readiness))?.reason ?? null;
}

export function saveReasonFor(readiness: ComposerReadiness): string | null {
  return reasonFrom(SAVE_BLOCKERS, readiness);
}

export function scheduleReasonFor(readiness: ComposerReadiness): string | null {
  return reasonFrom(SCHEDULE_BLOCKERS, readiness);
}

export function submittedNodeIds(mediaOrder: string[], captionNodeIds: string[]): string[] {
  return [...mediaOrder, ...captionNodeIds];
}

export type SubmitOutcome = 'network' | 'server' | Record<string, unknown> | null | undefined;

const NETWORK_ERROR_COPY = 'No connection. Try again.';

export function submitErrorFor(outcome: SubmitOutcome): string | null {
  if (outcome === 'network') return NETWORK_ERROR_COPY;
  if (outcome === 'server') return errorCopyFor('');
  if (!outcome || typeof outcome !== 'object') return null;
  if ('post' in outcome && outcome.post) return null;
  if (!('error' in outcome) || !outcome.error) return null;

  return errorCopyFor(String(outcome.error));
}
