import type { Db } from '$lib/server/db/client';
import { cancelLoop } from './loop';
import { cancelVariants } from './variants';

export async function cancelBatch(db: Db, scope: { orgId: string; nodeId: string }): Promise<{ cancelled: number }> {
  const [loop, variants] = await Promise.all([cancelLoop(db, scope), cancelVariants(db, scope)]);
  return { cancelled: loop.cancelled + variants.cancelled };
}
