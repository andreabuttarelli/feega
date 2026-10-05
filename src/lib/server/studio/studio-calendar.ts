import type { Db } from '$lib/server/db/client';
import { findBrand } from '$lib/server/repos/brands';
import { promoteToPost } from '$lib/server/repos/posts';
import { listItems } from '$lib/server/repos/product-batches';
import { Approval, ItemStatus } from '$lib/studio/batch-state';
import type { StudioCtx } from './studio-batch';

const PLANNED_HOUR_UTC = 'T09:00:00.000Z';
const MONTH_LENGTH = 7;

export type CalendarOutcome = { post: { id: string; href: string } } | { error: string };

export async function sendToCalendar(db: Db, ctx: StudioCtx, input: { batchId: string; brandId: string; date: string }): Promise<CalendarOutcome> {
  const brand = await findBrand(db, { orgId: ctx.orgId, brandId: input.brandId });
  if (!brand) {
    return { error: 'Choose one of your brands.' };
  }

  const picked = (await listItems(db, { orgId: ctx.orgId, batchId: input.batchId })).filter(
    (i) => i.status === ItemStatus.Done && i.approval === Approval.Approved && i.assetId
  );
  if (!picked.length) {
    return { error: 'Pick at least one photo first.' };
  }

  const cells = [...new Set(picked.flatMap((i) => (i.genNodeId ? [i.genNodeId] : [])))];
  const post = await promoteToPost(db, {
    orgId: ctx.orgId,
    brandId: brand.id,
    caption: '',
    media: picked.map((i, order) => ({ assetId: i.assetId!, order, role: 'media' })),
    actorKind: 'user',
    actorId: ctx.userId,
    sources: cells.map((nodeId) => ({ nodeId, role: 'media' })),
    plannedFor: `${input.date}${PLANNED_HOUR_UTC}`
  });

  return { post: { id: post.id, href: `/p/${ctx.projectId}/calendar?brand=${brand.id}&month=${input.date.slice(0, MONTH_LENGTH)}` } };
}
