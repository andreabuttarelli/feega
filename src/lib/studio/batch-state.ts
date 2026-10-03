export enum ItemStatus {
  Queued = 'queued',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
  Blocked = 'blocked',
  Cancelled = 'cancelled'
}

export enum Approval {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected'
}

export const TRANSITIONS: Readonly<Record<ItemStatus, readonly ItemStatus[]>> = {
  [ItemStatus.Queued]: [ItemStatus.Running, ItemStatus.Cancelled],
  [ItemStatus.Running]: [ItemStatus.Done, ItemStatus.Failed, ItemStatus.Blocked, ItemStatus.Queued],
  [ItemStatus.Done]: [ItemStatus.Queued],
  [ItemStatus.Failed]: [ItemStatus.Queued],
  [ItemStatus.Blocked]: [],
  [ItemStatus.Cancelled]: [ItemStatus.Queued]
};

export function canMove(from: ItemStatus, to: ItemStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export enum FailureKind {
  Transient = 'transient',
  Moderation = 'moderation',
  Permanent = 'permanent'
}

const FAILURE_PATTERNS: readonly { pattern: RegExp; kind: FailureKind }[] = [
  { pattern: /^refused|moderat|not allowed|real person|safety/i, kind: FailureKind.Moderation },
  { pattern: /timeout|timed out|429|rate.?limit|5\d\d|unavailable|overloaded|network|fetch failed|conflict|ECONNRESET/i, kind: FailureKind.Transient }
];

export function failureKind(error: string): FailureKind {
  return FAILURE_PATTERNS.find((row) => row.pattern.test(error))?.kind ?? FailureKind.Permanent;
}

export const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 30_000;

export type AfterFailure =
  | { status: ItemStatus.Queued; delayMs: number }
  | { status: ItemStatus.Failed }
  | { status: ItemStatus.Blocked };

export function afterFailure(error: string, attempts: number): AfterFailure {
  const kind = failureKind(error);
  if (kind === FailureKind.Moderation) {
    return { status: ItemStatus.Blocked };
  }
  if (kind === FailureKind.Transient && attempts <= MAX_RETRIES) {
    return { status: ItemStatus.Queued, delayMs: BACKOFF_BASE_MS * 2 ** (attempts - 1) };
  }
  return { status: ItemStatus.Failed };
}

export const ORG_PARALLELISM = 4;

export type QueueEntry = { id: string; orgId: string; genNodeId: string | null };

export function pickRunnable(queued: QueueEntry[], running: QueueEntry[], perOrg = ORG_PARALLELISM): QueueEntry[] {
  const busyNodes = new Set(running.map((r) => r.genNodeId));
  const load = new Map<string, number>();
  for (const r of running) {
    load.set(r.orgId, (load.get(r.orgId) ?? 0) + 1);
  }

  const picked: QueueEntry[] = [];
  for (const entry of queued) {
    const orgLoad = load.get(entry.orgId) ?? 0;
    if (orgLoad >= perOrg || busyNodes.has(entry.genNodeId)) {
      continue;
    }
    picked.push(entry);
    busyNodes.add(entry.genNodeId);
    load.set(entry.orgId, orgLoad + 1);
  }
  return picked;
}

export type CreditCheck = { total: number; balance: number; enough: boolean };

export function creditCheck(perImage: number, count: number, balance: number): CreditCheck {
  const total = perImage * count;
  return { total, balance, enough: balance >= total };
}
