import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { HistoryFilter, HistorySource, SessionPrefix } from '$lib/canvas/history/timeline';
import { RejectOutcome, type Choice, type Keep, type RejectResult } from '$lib/canvas/reject-plan';
import { readHistory } from './history';
import { rejectChange } from './reject';

export enum RevertRefusal {
  NotRevertable = 'not_revertable'
}

export type RevertChoice = { path: string; keep: Keep; eventId?: number };

export type RevertInput = { orgId: string; canvasId: string; entryId: string; choices?: RevertChoice[]; confirm?: boolean; actor: Actor };

export type RevertResult = RejectResult | { outcome: RevertRefusal.NotRevertable };

type Resolved = number[] | RejectOutcome.NotFound | RevertRefusal.NotRevertable;

type Resolver = (db: Db, input: RevertInput, rest: string) => Promise<Resolved>;

const SEPARATOR = ':';

const notRevertable: Resolver = async () => RevertRefusal.NotRevertable;

const oneEvent: Resolver = async (_db, _input, rest) => (/^\d+$/.test(rest) ? [Number(rest)] : RejectOutcome.NotFound);

const eventIdOf = (entryId: string) => Number(entryId.slice(HistorySource.Event.length + SEPARATOR.length));

const sessionEvents: Resolver = async (db, input) => {
  const graph = await readHistory(db, { orgId: input.orgId, canvasId: input.canvasId, filter: HistoryFilter.All });
  const session = graph.sessions.find((s) => s.key === input.entryId);
  if (!session) {
    return RejectOutcome.NotFound;
  }

  const ids = session.rows.filter((r) => r.entry.source === HistorySource.Event).map((r) => eventIdOf(r.entry.id));
  return ids.length ? ids : RevertRefusal.NotRevertable;
};

const RESOLVERS: Record<string, Resolver> = {
  [HistorySource.Event]: oneEvent,
  [HistorySource.Version]: notRevertable,
  [HistorySource.Revision]: notRevertable,
  [HistorySource.Branch]: notRevertable,
  [SessionPrefix.Session]: sessionEvents,
  [SessionPrefix.Idle]: sessionEvents
};

const choicesFor = (choices: RevertChoice[], eventIds: number[]): Choice[] =>
  choices.flatMap((c) => (c.eventId === undefined ? eventIds.map((eventId) => ({ eventId, path: c.path, keep: c.keep })) : [{ eventId: c.eventId, path: c.path, keep: c.keep }]));

export async function revertChange(db: Db, input: RevertInput): Promise<RevertResult> {
  const at = input.entryId.indexOf(SEPARATOR);
  const resolver = at === -1 ? undefined : RESOLVERS[input.entryId.slice(0, at)];
  if (!resolver) {
    return { outcome: RejectOutcome.NotFound };
  }

  const resolved = await resolver(db, input, input.entryId.slice(at + SEPARATOR.length));
  if (!Array.isArray(resolved)) {
    return { outcome: resolved };
  }

  return rejectChange(db, { orgId: input.orgId, canvasId: input.canvasId, eventIds: resolved, choices: choicesFor(input.choices ?? [], resolved), confirm: input.confirm, actor: input.actor });
}
