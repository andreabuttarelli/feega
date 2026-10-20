import type { Db } from '$lib/server/db/client';
import type { StoreChange } from './revenuecat';

export type StoreApplyOutcome = 'applied' | 'duplicate' | 'unknown_org';

const FOREIGN_KEY_VIOLATION = '23503';

type StoreEventRpc = {
  rpc(fn: 'apply_store_event', args: Record<string, unknown>): PromiseLike<{
    data: string | null;
    error: { code?: string; message: string } | null;
  }>;
};

export async function applyStoreChange(db: Db, change: StoreChange): Promise<StoreApplyOutcome> {
  const { data, error } = await (db as unknown as StoreEventRpc).rpc('apply_store_event', {
    _event_id: change.eventId,
    _org_id: change.orgId,
    _store: change.store,
    _environment: change.environment,
    _type: change.type,
    _product_id: change.productId,
    _payload: change.payload,
    _outcome: change.outcome,
    _grant_credits: change.grant?.credits ?? 0,
    _grant_source: change.grant?.source ?? null,
    _grant_expires_at: change.grant?.expiresAt ?? null,
    _revoke_credits: change.revokeCredits,
    _plan: change.plan,
    _plan_expires_at: change.planExpiresAt
  });

  if (error?.code === FOREIGN_KEY_VIOLATION) {
    return 'unknown_org';
  }
  if (error) {
    throw new Error(`apply_store_event failed: ${error.message}`);
  }
  return data === 'duplicate' ? 'duplicate' : 'applied';
}
