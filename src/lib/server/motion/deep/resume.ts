import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { claimStale, staleDeepRuns } from '$lib/server/repos/deep-runs';
import { countResume, giveUp, resumeDeepRuns } from './job';
import { DEEP_STALE_MS } from './limits';

export const RESUME_PATH = '/api/v1/motion/deep/resume';
const STALE_BATCH = 10;

export function resumeStaleDeep(db: Db, origin: string): Promise<number> {
  return resumeDeepRuns({
    stale: () => staleDeepRuns(db, { before: new Date(Date.now() - DEEP_STALE_MS).toISOString(), limit: STALE_BATCH }),
    claim: (row) => claimStale(db, { orgId: row.orgId, runId: row.id, seen: row.heartbeatAt }),
    resumes: (row) => countResume(db, row.id),
    fail: (runId) => giveUp(db, runId),
    trigger: async (runId) => {
      const res = await fetch(`${origin}${RESUME_PATH}`, { method: 'POST', headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}`, 'content-type': 'application/json' }, body: JSON.stringify({ runId }) });
      if (!res.ok) {
        throw new Error(`resume ${runId} answered ${res.status}`);
      }
    }
  });
}
