import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { isInternalEmail } from '$lib/server/internal-users';
import { decideReport, listQueue, markSuitFiled } from '$lib/server/reports/reports';
import { reportDeps } from '$lib/server/reports/report-deps';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;

async function requireAdmin(locals: App.Locals): Promise<string> {
  const { user } = await locals.safeGetSession();
  if (!user || !isInternalEmail(user.email)) {
    throw error(NOT_FOUND, 'Not found');
  }
  return user.id;
}

async function fieldsOf(request: Request): Promise<Record<string, string>> {
  return Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
}

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  await requireAdmin(locals);
  setHeaders?.({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  return { reports: await listQueue(reportDeps(url.origin).db) };
};

export const actions: Actions = {
  decide: async ({ locals, request, url }: RequestEvent) => {
    const adminId = await requireAdmin(locals);
    const form = await fieldsOf(request);

    const result = await decideReport(reportDeps(url.origin), {
      reportId: form.id ?? '',
      decision: form.decision ?? '',
      ground: form.ground ?? '',
      note: form.note ?? '',
      decidedBy: adminId
    });

    return result.ok ? { success: true, id: form.id } : fail(BAD_REQUEST, { id: form.id, error: result.error });
  },

  suitFiled: async ({ locals, request, url }: RequestEvent) => {
    await requireAdmin(locals);
    const form = await fieldsOf(request);
    await markSuitFiled(reportDeps(url.origin), form.id ?? '');
    return { success: true, id: form.id };
  }
};
