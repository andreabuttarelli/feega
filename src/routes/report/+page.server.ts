import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';
import { fingerprintOf, submitReport, type ReportTarget } from '$lib/server/reports/reports';
import { reportDeps } from '$lib/server/reports/report-deps';

const BAD_REQUEST = 400;
const TOO_MANY_REQUESTS = 429;
const HONEYPOT = 'website';

function targetOf(url: URL): ReportTarget {
  return {
    shareToken: url.searchParams.get('share'),
    canvasId: url.searchParams.get('canvas'),
    nodeId: url.searchParams.get('node')
  };
}

export const load: PageServerLoad = async ({ url }) => {
  const target = targetOf(url);
  return {
    target,
    prefillUrl: target.shareToken ? `${url.origin}/s/${target.shareToken}` : (url.searchParams.get('url') ?? '')
  };
};

export const actions: Actions = {
  default: async ({ request, url, getClientAddress, locals }) => {
    const form = Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
    if (form[HONEYPOT]) {
      return { success: true };
    }

    const { user } = await locals.safeGetSession();
    const result = await submitReport(reportDeps(url.origin), {
      reason: form.reason ?? '',
      form,
      target: targetOf(url),
      reporterUserId: user?.id ?? null,
      fingerprint: fingerprintOf(getClientAddress(), env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev')
    });

    if (result.ok) {
      return { success: true };
    }
    if (result.kind === 'rate_limited') {
      return fail(TOO_MANY_REQUESTS, { values: form, errors: { form: 'Too many reports from this connection. Try again in an hour or write to support@feega.app.' } });
    }
    return fail(BAD_REQUEST, { values: form, errors: result.errors });
  }
};
