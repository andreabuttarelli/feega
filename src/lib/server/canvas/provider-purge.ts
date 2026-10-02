import type { Db } from '$lib/server/db/client';
import { markProviderPurged, unpurgedRuns } from '$lib/server/repos/node-runs';

export type PurgeOutcome = 'purged' | 'not_ready';

export type Purge = (externalJobId: string) => Promise<PurgeOutcome>;

export type Purgers = Readonly<Record<string, Purge>>;

export type PurgeTally = { purged: number; waiting: number; failed: number };

export const PURGE_RETRY_DAYS = 7;
const PURGE_BATCH = 25;
const DAY_MS = 24 * 60 * 60_000;

export async function purgeProviderCopies(db: Db, purgers: Purgers, options: { now?: Date } = {}): Promise<PurgeTally> {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - PURGE_RETRY_DAYS * DAY_MS).toISOString();
  const tally: PurgeTally = { purged: 0, waiting: 0, failed: 0 };

  for (const [prefix, purge] of Object.entries(purgers)) {
    for (const run of await unpurgedRuns(db, { prefix, since, limit: PURGE_BATCH })) {
      try {
        if ((await purge(run.externalJobId!)) === 'not_ready') {
          tally.waiting += 1;
          continue;
        }
        await markProviderPurged(db, { orgId: run.orgId, runId: run.id, at: now.toISOString() });
        tally.purged += 1;
      } catch (error) {
        console.warn('[provider purge] retry next tick', run.id, error instanceof Error ? error.message : error);
        tally.failed += 1;
      }
    }
  }

  return tally;
}
