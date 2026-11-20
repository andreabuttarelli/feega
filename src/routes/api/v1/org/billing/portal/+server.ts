import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkApiKeyWriteAccess, openOrg } from '$lib/server/cli-auth';
import { billingLink } from '$lib/server/billing-links';
import { isOrgOwner } from '$lib/server/org-billing';
import { appOrigin } from '$lib/server/app-url';
import { BILLING_PATH } from '$lib/billing-path';

import { BILLING_PORTAL_LINK, statusForFailure } from '@feega/api-contracts';

/**
 * The URL is a bearer capability over the customer's billing, so it is minted, returned once and
 * never written anywhere: not a log line, not a row, not the error body.
 */
export const POST: RequestHandler = async ({ request, url }) => {
  const { call, error } = await openOrg(request);
  if (error) return error;

  const { supabase, user, orgId, apiKey } = call;

  const readOnly = checkApiKeyWriteAccess(apiKey);
  if (readOnly) return readOnly;

  const parsed = BILLING_PORTAL_LINK.input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: 'invalid_input', details: parsed.error.issues }, { status: 400 });
  }

  const appBillingUrl = `${appOrigin(url)}${BILLING_PATH}`;

  if (!(await isOrgOwner(supabase, orgId, user.id))) {
    return json(
      { error: 'not_org_owner' },
      { status: statusForFailure(BILLING_PORTAL_LINK, 'not_org_owner') }
    );
  }

  const link = await billingLink(supabase, { orgId, returnUrl: appBillingUrl });
  if (link.refusal) {
    return json(
      { error: link.refusal, message: link.message || undefined, app_billing_url: appBillingUrl },
      { status: statusForFailure(BILLING_PORTAL_LINK, link.refusal) }
    );
  }

  return json({ ok: true, url: link.url });
};
