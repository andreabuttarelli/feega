import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readStripeWebhook } from '$lib/server/stripe';
import { revenueOf } from '$lib/server/revenue-events';
import { captureForOrg, orgIdentify } from '$lib/server/core-usage';

const HTTP_BAD_REQUEST = 400;

export const POST: RequestHandler = async ({ request }) => {
  const event = readStripeWebhook(await request.text(), request.headers.get('stripe-signature'));
  if (!event) {
    return json({ error: 'invalid_signature' }, { status: HTTP_BAD_REQUEST });
  }

  const revenue = revenueOf(event);
  if (!revenue) {
    return json({ ok: true });
  }

  captureForOrg(revenue.orgId, revenue.event, revenue.props);
  if (revenue.props.plan) {
    orgIdentify(revenue.orgId, { plan: revenue.props.plan });
  }
  return json({ ok: true });
};
