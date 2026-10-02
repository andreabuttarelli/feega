import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { fileCounterNotice } from '$lib/server/reports/reports';
import { reportDeps } from '$lib/server/reports/report-deps';

const BAD_REQUEST = 400;

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  return { id: params.id, token: url.searchParams.get('t') ?? '' };
};

export const actions: Actions = {
  default: async ({ params, request, url }) => {
    const form = Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
    const result = await fileCounterNotice(reportDeps(url.origin), {
      reportId: params.id,
      token: url.searchParams.get('t') ?? form.t ?? '',
      form
    });

    if (!result.ok) {
      return fail(BAD_REQUEST, { values: form, errors: result.errors });
    }
    return { success: true, restoreAfter: result.restoreAfter.toISOString().slice(0, 10) };
  }
};
