import { error, fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { publisher } from '$lib/server/publishing';
import { listOrgBrands } from '$lib/server/repos/brands';
import { listBrandAccounts } from '$lib/server/repos/social-accounts';
import { listPosts, findPost } from '$lib/server/repos/posts';
import { deliveryStatus, scheduleDelivery, cancelDelivery } from '$lib/server/repos/post-delivery';
import { buildCalendarData } from './calendar-load';
import { monthOf } from './calendar-month';
import type { Db } from '$lib/server/db/client';

const NOT_FOUND = 404;

export const load: PageServerLoad = async ({ parent, locals, url }) => {
  const { org } = await parent();
  const db = await locals.db();
  if (!db) throw error(500, 'sessione senza client');

  const data = await buildCalendarData(
    { listOrgBrands, listBrandAccounts, listPosts, deliveryStatus },
    { orgId: org.id, brandParam: url.searchParams.get('brand'), db, publisher }
  );

  return { ...data, month: monthOf(url.searchParams.get('month')) };
};

type PostScope = { db: Db; orgId: string; fd: FormData; postId: string };

async function requirePost(event: RequestEvent): Promise<PostScope | null> {
  const db = await event.locals.db();
  if (!db) throw error(500, 'sessione senza client');

  const { data } = await db.from('projects').select('org_id').eq('id', event.params.projectId ?? '').maybeSingle();
  const orgId = (data as { org_id: string } | null)?.org_id;
  if (!orgId) throw error(NOT_FOUND, 'Project not found');

  const fd = await event.request.formData();
  const postId = String(fd.get('postId') ?? '');
  if (!postId) return { db, orgId, fd, postId };

  const post = await findPost(db, { orgId, postId });
  return post ? { db, orgId, fd, postId } : null;
}

const postNotFound = () => fail(NOT_FOUND, { error: 'post_not_found' });

const CONFIRMED = 'true';

const confirmedUncensored = (fd: FormData) => fd.get('confirmUncensored') === CONFIRMED;

export const actions: Actions = {
  schedule: async (event) => {
    const scope = await requirePost(event);
    if (!scope) return postNotFound();
    const { db, orgId, fd, postId } = scope;

    const accountIds = fd.getAll('accountId').map(String);
    const scheduledFor = String(fd.get('scheduledFor') ?? '').trim() || undefined;
    if (!postId || !accountIds.length) return fail(400, { error: 'post_and_accounts_required' });

    const result = await scheduleDelivery(db, publisher, { orgId, postId, accountIds, scheduledFor, confirmUncensored: confirmedUncensored(fd) });
    return { scheduled: true, result };
  },

  publishNow: async (event) => {
    const scope = await requirePost(event);
    if (!scope) return postNotFound();
    const { db, orgId, fd, postId } = scope;

    const accountIds = fd.getAll('accountId').map(String);
    if (!postId || !accountIds.length) return fail(400, { error: 'post_and_accounts_required' });

    const result = await scheduleDelivery(db, publisher, { orgId, postId, accountIds, confirmUncensored: confirmedUncensored(fd) });
    return { published: true, result };
  },

  cancel: async (event) => {
    const scope = await requirePost(event);
    if (!scope) return postNotFound();
    const { db, orgId, fd, postId } = scope;

    const accountId = String(fd.get('accountId') ?? '');
    if (!postId || !accountId) return fail(400, { error: 'post_and_account_required' });

    try {
      await cancelDelivery(db, publisher, { orgId, postId, accountId });
    } catch (e) {
      return fail(502, { error: 'cancel_failed', message: e instanceof Error ? e.message : 'unknown' });
    }
    return { canceled: true };
  },

  reschedule: async (event) => {
    const scope = await requirePost(event);
    if (!scope) return postNotFound();
    const { db, orgId, fd, postId } = scope;

    const accountId = String(fd.get('accountId') ?? '');
    const scheduledFor = String(fd.get('scheduledFor') ?? '').trim();
    if (!postId || !accountId || !scheduledFor) return fail(400, { error: 'post_account_and_time_required' });

    try {
      await cancelDelivery(db, publisher, { orgId, postId, accountId });
    } catch (e) {
      return fail(502, { error: 'reschedule_cancel_failed', message: e instanceof Error ? e.message : 'unknown' });
    }
    const result = await scheduleDelivery(db, publisher, { orgId, postId, accountIds: [accountId], scheduledFor, confirmUncensored: confirmedUncensored(fd) });
    return { rescheduled: true, result };
  }
};
