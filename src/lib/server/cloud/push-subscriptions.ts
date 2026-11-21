import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushSubscription } from './push';

const ENDPOINT_MAX_CHARS = 2000;
const KEY_MAX_CHARS = 200;

export function readSubscription(raw: unknown): PushSubscription | null {
  const body = (raw ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const { endpoint, keys } = body;
  const valid =
    typeof endpoint === 'string' &&
    endpoint.length <= ENDPOINT_MAX_CHARS &&
    URL.canParse(endpoint) &&
    new URL(endpoint).protocol === 'https:' &&
    typeof keys?.p256dh === 'string' &&
    keys.p256dh.length <= KEY_MAX_CHARS &&
    typeof keys.auth === 'string' &&
    keys.auth.length <= KEY_MAX_CHARS;

  return valid ? { endpoint, keys: { p256dh: keys.p256dh as string, auth: keys.auth as string } } : null;
}

export async function saveSubscription(db: SupabaseClient, owner: { userId: string; orgId: string }, subscription: PushSubscription): Promise<void> {
  const { error } = await db
    .from('push_subscriptions')
    .upsert({ endpoint: subscription.endpoint, user_id: owner.userId, org_id: owner.orgId, keys: subscription.keys }, { onConflict: 'endpoint' });
  if (error) {
    throw new Error(`push subscriptions: ${error.message}`);
  }
}

export async function removeSubscription(db: SupabaseClient, userId: string, endpoint: string): Promise<void> {
  const { error } = await db.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
  if (error) {
    throw new Error(`push subscriptions: ${error.message}`);
  }
}
