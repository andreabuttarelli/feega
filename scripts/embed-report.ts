import { createClient } from '@supabase/supabase-js';
import { env } from './_shims/env-private';
import type { Db } from '$lib/server/db/client';
import { EMBED_BUCKET } from '$lib/server/motion/embed';
import { planRebuild, RebuildOutcome, type RebuildPorts } from '$lib/server/motion/embed-rebuild';
import { rebuildPorts } from '$lib/server/motion/embed-rebuild-db';

const PAGE = 1000;
const EMBED_FILE = /^([0-9a-f-]{36})\.html$/;
const ORIGIN = env.PUBLIC_APP_URL ?? 'https://feega.app';

const STATE: Record<RebuildOutcome, string> = {
  [RebuildOutcome.Current]: 'new',
  [RebuildOutcome.Ready]: 'legacy-rebuildable',
  [RebuildOutcome.Rebuilt]: 'new',
  [RebuildOutcome.Unpublished]: 'gone',
  [RebuildOutcome.Unreadable]: 'legacy-not-rebuildable',
  [RebuildOutcome.NoNode]: 'legacy-not-rebuildable',
  [RebuildOutcome.Deleted]: 'legacy-not-rebuildable',
  [RebuildOutcome.Refused]: 'legacy-not-rebuildable',
  [RebuildOutcome.NoRevision]: 'legacy-not-rebuildable',
  [RebuildOutcome.Mismatch]: 'legacy-not-rebuildable',
  [RebuildOutcome.Busy]: 'legacy-rebuildable',
  [RebuildOutcome.Changed]: 'legacy-rebuildable',
  [RebuildOutcome.Failed]: 'legacy-not-rebuildable'
};

const refuseWrite = () => {
  throw new Error('embed-report is read-only');
};

const db = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as Db;
const readOnly: RebuildPorts = { ...rebuildPorts(db), claim: refuseWrite, release: refuseWrite, write: refuseWrite };

async function embedIds(): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(EMBED_BUCKET).list('', { limit: PAGE, offset });
    if (error) {
      throw error;
    }
    ids.push(...(data ?? []).flatMap((f) => EMBED_FILE.exec(f.name)?.[1] ?? []));
    if ((data ?? []).length < PAGE) {
      return ids;
    }
  }
}

const counts = new Map<string, number>();
const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);

for (const id of await embedIds()) {
  const plan = await planRebuild(readOnly, id, ORIGIN).catch(() => ({ outcome: RebuildOutcome.Failed }));
  bump(STATE[plan.outcome]);
  bump(`  reason:${plan.outcome}`);
  console.log(id, plan.outcome);
}

console.log(Object.fromEntries([...counts].sort()));
