import type { Db } from '$lib/server/db/client';
import { swallow } from '$lib/server/swallow';
import { CapReset, CapScope, applicableCaps, capSince, firstReached, type SpendCap } from './policy';
import { readCaps, spentUsd, type SpendQuery } from './store';

export const CAP_REACHED = 'cap_reached';

export type CapReader = {
  caps: (orgId: string) => Promise<SpendCap[] | null>;
  spent: (query: SpendQuery) => Promise<number>;
};

type RunScope = { orgId: string; userId: string; projectId: string | null; now?: Date };

const RESET_WORDS: Record<CapReset, string> = { [CapReset.None]: 'total', [CapReset.Monthly]: 'this month' };

const SCOPE_WORDS: Record<CapScope, string> = {
  [CapScope.OrgMember]: 'your spending limit in this organization',
  [CapScope.ProjectMember]: 'your spending limit in this project',
  [CapScope.ProjectTotal]: "this project's spending limit"
};

const usd = (amount: number) => `$${Number(amount.toFixed(2))}`;

const message = (cap: SpendCap) => `${CAP_REACHED}: ${SCOPE_WORDS[cap.scope]} of ${usd(cap.capUsd)} (${RESET_WORDS[cap.reset]}) is reached. Ask an admin to raise it.`;

function queryFor(cap: SpendCap, run: RunScope, now: Date): SpendQuery {
  const since = capSince(cap, now);

  if (cap.scope === CapScope.OrgMember) {
    return { orgId: run.orgId, userId: run.userId, since };
  }
  if (cap.scope === CapScope.ProjectTotal) {
    return { orgId: run.orgId, projectId: cap.projectId!, since };
  }
  return { orgId: run.orgId, userId: run.userId, projectId: cap.projectId!, since };
}

export async function capRefusal(reader: CapReader, run: RunScope): Promise<string | null> {
  try {
    const caps = await reader.caps(run.orgId);
    const applicable = applicableCaps(caps ?? [], run.projectId);
    if (!applicable.length) {
      return null;
    }

    const now = run.now ?? new Date();
    const reached = await firstReached(applicable, (cap) => reader.spent(queryFor(cap, run, now)));
    return reached ? message(reached) : null;
  } catch (cause) {
    swallow(`spend caps: allowed org ${run.orgId} without evaluating its caps`, cause);
    return null;
  }
}

export async function liveCapReader(db: Db): Promise<CapReader> {
  return {
    caps: (orgId) => readCaps(db, orgId),
    spent: async (query) => {
      const { createAdminClient } = await import('$lib/server/supabase-admin');
      return spentUsd(createAdminClient() as unknown as Db, query);
    }
  };
}
