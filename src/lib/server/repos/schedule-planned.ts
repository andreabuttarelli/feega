import type { Db } from '$lib/server/db/client';
import type { SocialPublisher } from '$lib/server/publishing/port';
import { findPlannedPost } from './post-planning';
import { listBrandAccounts } from './social-accounts';
import { scheduleDelivery, type DeliveryOutcome } from './post-delivery';
import { setPostStatus } from './posts';

const CONNECTED = 'connected';

export type ScheduleRefusal = 'post_not_found' | 'not_planned' | 'planned_in_past' | 'no_connected_accounts';

export type SchedulePlannedResult =
  | { ok: true; deliveries: DeliveryOutcome[] }
  | { ok: false; error: ScheduleRefusal }
  | { ok: false; error: 'delivery_failed'; deliveries: DeliveryOutcome[] };

export async function schedulePlanned(
  db: Db,
  publisher: SocialPublisher,
  input: { orgId: string; postId: string; now: Date }
): Promise<SchedulePlannedResult> {
  const post = await findPlannedPost(db, input);
  if (!post) {
    return { ok: false, error: 'post_not_found' };
  }
  if (!post.plannedFor) {
    return { ok: false, error: 'not_planned' };
  }
  if (Date.parse(post.plannedFor) <= input.now.getTime()) {
    return { ok: false, error: 'planned_in_past' };
  }

  const accounts = await listBrandAccounts(db, { orgId: input.orgId, brandId: post.brandId });
  const accountIds = accounts.filter((a) => a.status === CONNECTED).map((a) => a.id);
  if (!accountIds.length) {
    return { ok: false, error: 'no_connected_accounts' };
  }

  const { deliveries } = await scheduleDelivery(db, publisher, {
    orgId: input.orgId,
    postId: post.id,
    accountIds,
    scheduledFor: post.plannedFor
  });
  if (!deliveries.some((d) => d.ok)) {
    return { ok: false, error: 'delivery_failed', deliveries };
  }

  await setPostStatus(db, { orgId: input.orgId, postId: post.id, status: 'ready' });
  return { ok: true, deliveries };
}
