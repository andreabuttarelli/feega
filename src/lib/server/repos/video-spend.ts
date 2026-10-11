import type { Db } from '$lib/server/db/client';

export async function videoSpentUsd(db: Db, scope: { orgId: string; nodeId: string }): Promise<number> {
  const { data, error } = await db.from('ai_calls').select('cost_usd').eq('org_id', scope.orgId).eq('node_id', scope.nodeId);
  if (error) {
    throw new Error(`video spend read failed: ${error.message}`);
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
}
